// context/DeviceNotificationsContext.js
//
// Cihaz bildirimlerinin merkezi yöneticisi. Ayarlar (AppSettings) + reminder/not
// verisini dinler ve:
//   1) Reminder local bildirimlerini zamanlar/günceller/iptal eder.
//   2) Uygulama açık/canlıyken gelen yeni sosyal bildirimleri (Firestore
//      notifications listener) anlık local bildirim olarak gösterir — tür bazında
//      ayarlarla kapatılabilir.
//   3) OS izin akışını yönetir, Expo push token'ı kaydeder (ileride backend için).
//   4) Bildirime dokunulduğunda ilgili ekrana yönlendirir (navigation ref).
//
// Tüm bu hook'lara erişebilmesi için sağlayıcılar (Auth, AppSettings,
// Notifications, ProfileReminders, ProfileNotes, Language) ÜSTTE olmalı.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import {
  useNotificationSettings,
  useStreamingProviderSettings,
} from "./AppSettingsContext";
import { useNotifications } from "./NotificationsContext";
import { useProfileReminders } from "./ProfileRemindersContext";
import { useProfileNotes } from "./ProfileNotesContext";
import {
  configureNotificationHandler,
  ensureAndroidChannels,
  setChannelNames,
  getPermissionInfo,
  requestNotificationPermission,
  registerForPushNotificationsAsync,
  presentNow,
  addNotificationResponseReceivedListener,
  setBadgeCount,
  CHANNELS,
  REMINDER_PREFIX,
} from "../services/pushNotificationsService";
import {
  computeReminderSchedule,
  syncReminderNotifications,
} from "../services/reminderNotificationScheduler";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import useStartupGate from "../hooks/useStartupGate";
import NotificationPrimingSheet from "../components/notifications/NotificationPrimingSheet";
import {
  PRIME_HANDOFF_MS,
  shouldPrimeNotifications,
} from "../utils/notificationPriming";
import { Keys, get, set } from "../services/storage";

// iOS'ta bekleyen local bildirim üst sınırı 64; fazlası sessizce düşer. En
// yakın tarihli 60'ını zamanlıyoruz (kalan pay foreground sosyal bildirimlere).
const IOS_PENDING_LIMIT = 60;

const DeviceNotificationsContext = createContext({
  permissionStatus: "undetermined",
  canAskPermission: true,
  requestPermission: async () => false,
  needsPermissionPriming: false,
  primeNotificationPermission: () => false,
});
export const useDeviceNotifications = () => useContext(DeviceNotificationsContext);

// notification.type → { ayar anahtarı }
const SOCIAL_SETTING_KEY = {
  friend_request: "friendRequestsEnabled",
  friend_accepted: "friendAcceptedEnabled",
  post_like: "postLikesEnabled",
  post_comment: "postCommentsEnabled",
  comment_reply: "postCommentsEnabled",
  mention: "mentionsEnabled",
  message: "messagesEnabled",
};

// WhatsApp/Instagram tarzı: BAŞLIK = kişi/grup adı, GÖVDE = aksiyon (emoji) / mesaj.
// Backend buildContent (functions/index.js) ile birebir aynı mantık → foreground ve
// background bildirimleri tutarlı görünür.
function buildSocialContent(item, t) {
  const name = item.fromName || t.someone || "Birisi";
  const text = item.text ? String(item.text) : "";
  switch (item.type) {
    case "friend_request":
      return { title: name, body: t.notifBodyFriendRequest || "👤 sana arkadaşlık isteği gönderdi" };
    case "friend_accepted":
      return { title: name, body: t.notifBodyFriendAccepted || "🤝 arkadaşlık isteğini kabul etti" };
    case "post_like":
      return { title: name, body: t.notifBodyPostLike || "❤️ gönderini beğendi" };
    case "post_comment":
      return {
        title: name,
        body: text
          ? (t.notifBodyPostCommentText || "💬 yorum yaptı: {text}").replace("{text}", text)
          : (t.notifBodyPostComment || "💬 gönderine yorum yaptı"),
      };
    case "comment_reply":
      return {
        title: name,
        body: text
          ? (t.notifBodyCommentReplyText || "💬 yanıt verdi: {text}").replace("{text}", text)
          : (t.notifBodyCommentReply || "💬 yorumuna yanıt verdi"),
      };
    case "mention":
      return {
        title: name,
        body: text
          ? (t.notifBodyMentionText || "💬 senden bahsetti: {text}").replace("{text}", text)
          : (t.notifBodyMention || "💬 senden bahsetti"),
      };
    case "message": {
      const fallback = t.notifBodyMessage || "sana bir mesaj gönderdi";
      // Grup → başlık=grup adı, gövde="gönderen: mesaj"; 1-1 → başlık=isim, gövde=mesaj.
      if (item.groupId) {
        return { title: item.groupName || name, body: `${name}: ${text || fallback}` };
      }
      return { title: name, body: text || `${name} ${fallback}` };
    }
    default:
      return { title: t.notifications, body: name };
  }
}

// Lead-time'a göre "ne zaman yayında" bilgisini doğal dilde üretir.
// Kullanıcı ayarlardan "3 gün önce" seçtiyse bildirim tam da o an tetiklendiği
// için içerik gerçekten `leadTimeDays` gün sonra yayınlanır.
function buildReminderBody(leadTimeDays, t) {
  const days = Number(leadTimeDays) || 0;
  if (days <= 0) return t.notifReminderBodyToday || "Bugün yayında!";
  if (days === 1) return t.notifReminderBodyTomorrow || "Yarın yayında";
  if (days === 7) return t.notifReminderBodyWeek || "1 hafta sonra yayında";
  return (t.notifReminderBodyBefore || "{days} gün sonra yayında").replace(
    "{days}",
    String(days),
  );
}

export function DeviceNotificationsProvider({ children, navigationRef }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const { t, language } = useLanguage();
  const { notificationSettings: settings } = useNotificationSettings();
  const { streamingProviderIds } = useStreamingProviderSettings();
  const { items, loading: notifLoading } = useNotifications();
  const { reminders } = useProfileReminders();
  const { notes } = useProfileNotes();

  // status + canAskAgain birlikte tutulur: Android 13+'ta izin HİÇ istenmemişken
  // de status 'denied' döner, ikisini ayıran tek şey canAskAgain (bkz.
  // services/pushNotificationsService.getPermissionInfo).
  const [permission, setPermission] = useState({
    status: "undetermined",
    canAskAgain: true,
  });
  const permissionStatus = permission.status;

  // Ayar aynalama (Firestore yazması) + reminder senkronu açılışta acil değil;
  // splash sonrası donma penceresinin dışına ertele. Kapı açıldıktan sonra
  // davranış birebir aynı (debounce'lar korunur).
  const startupReady = useStartupGate(4200);

  // ── 1. Bir kerelik kurulum: handler + mevcut izin durumu ──────────────────
  useEffect(() => {
    configureNotificationHandler();
    getPermissionInfo().then(setPermission);
  }, []);

  // ── 1b. Android kanalları — adları dile göre yerelleştir ──────────────────
  // Kanal adları OS bildirim ayarlarında görünür. Dil değişince yeniden uygula
  // (Android var olan kanalın adını günceller). Mount'ta da çalışır → ilk kurulum.
  useEffect(() => {
    setChannelNames({
      default: t.notifChannelGeneral,
      reminders: t.notifChannelReminders,
      social: t.notifChannelSocial,
    });
    ensureAndroidChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // İzin durumunu uygulama öne geldikçe tazele (kullanıcı OS ayarından değiştirebilir).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") getPermissionInfo().then(setPermission);
    });
    return () => sub.remove();
  }, []);

  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    // Durumu diyalogdan SONRA sistemden tazele; canAskAgain de değişmiş olabilir
    // (Android'de ikinci ret kalıcıdır, iOS'ta ilk retten sonra dialog açılmaz).
    // Ekranlar buna bakıp kullanıcıyı OS ayarlarına yönlendiriyor.
    setPermission(await getPermissionInfo());
    return granted;
  }, []);

  // ── 1c. İzin ön-açıklaması (priming) ─────────────────────────────────────
  //
  // Ayarlarda "Tüm bildirimler" varsayılan olarak AÇIK; OS izni yoksa hiçbir
  // hatırlatma zamanlanmaz (canSchedule false → tüm reminder_* iptal) ve
  // kullanıcı bunu hiç fark etmez. İzni sormak şart, ama SORULMA ANI kritik:
  //
  //   ESKİDEN: açılıştan ~4.2 sn sonra sistem diyaloğu habersiz açılıyordu.
  //   Kullanıcı neyin sorulduğunu görmeden "İzin verme" diyor, iOS'ta o hak
  //   ömürlük yanıyordu. App Review'da da yorum konusu.
  //
  //   ŞİMDİ: önce KENDİ sayfamız açılıyor ve yalnız kullanıcı "İzin ver"
  //   dedikten sonra sistem diyaloğu geliyor. Sayfayı çağıran taraf belirliyor
  //   (ilk hatırlatıcı kurulduğunda) — açılışta değil, anlamlı bağlamda.
  //
  // Sayfa TEK SEFERLİK: iki düğme de bayrağı yakıyor. "Şimdi değil" diyen
  // kullanıcı bir daha rahatsız edilmez, Ayarlar'daki uyarı satırı
  // (components/NotificationPermissionNotice.js) her zaman açık kapı.
  const [primeVisible, setPrimeVisible] = useState(false);
  const [primeShown, setPrimeShown] = useState(
    () => get(Keys.notificationPrimeShown) === true,
  );

  const needsPermissionPriming = shouldPrimeNotifications({
    status: permission.status,
    canAskAgain: permission.canAskAgain,
    alreadyPrimed: primeShown,
    notificationsEnabled: settings.enabled,
  });

  // Karar çağrı anında okunmalı (kullanıcı arada izin vermiş olabilir), ama
  // fonksiyon kimliği sabit kalmalı — çağrı yerleri bunu useCallback bağımlılığı
  // olarak taşıyor.
  const needsPrimingRef = useRef(needsPermissionPriming);
  needsPrimingRef.current = needsPermissionPriming;

  /** Ön-açıklama sayfasını açar. Gerek yoksa sessizce hiçbir şey yapmaz. */
  const primeNotificationPermission = useCallback(() => {
    if (!needsPrimingRef.current) return false;
    setPrimeVisible(true);
    return true;
  }, []);

  const closePrime = useCallback(() => {
    set(Keys.notificationPrimeShown, true);
    setPrimeShown(true);
    setPrimeVisible(false);
  }, []);

  const onPrimeAllow = useCallback(() => {
    closePrime();
    // Sistem diyaloğunu sayfanın kapanış animasyonu bittikten sonra aç: iOS'ta
    // kapanmakta olan Modal'ın üstüne gelen native uyarı kaybolabiliyor
    // (aynı gerekçe MediaQuickActionsSheet'teki HANDOFF_MS'te de var).
    setTimeout(() => {
      requestPermission();
    }, PRIME_HANDOFF_MS);
  }, [closePrime, requestPermission]);

  // ── 2. Push token kaydı (izin verilince) ─────────────────────────────────
  useEffect(() => {
    if (uid && settings.enabled && permissionStatus === "granted") {
      registerForPushNotificationsAsync(uid);
    }
  }, [uid, settings.enabled, permissionStatus]);

  // ── 2b. Tür-bazlı ayarları Firestore'a yansıt (backend push bunlara saygı duysun) ──
  // Cihazdaki sosyal bildirim ayarları AsyncStorage'da → Cloud Function göremez.
  // İlgili sosyal anahtarları + master 'enabled'ı Users/{uid}.notificationSettings'e
  // yazıyoruz; backend bir tür kapalıysa o push'u atmasın. Debounce'lu.
  const settingsMirrorTimerRef = useRef(null);
  useEffect(() => {
    if (!uid || !startupReady) return undefined;
    if (settingsMirrorTimerRef.current) clearTimeout(settingsMirrorTimerRef.current);
    settingsMirrorTimerRef.current = setTimeout(() => {
      updateDoc(doc(db, "Users", uid), {
        notificationSettings: {
          enabled: settings.enabled !== false,
          friendRequestsEnabled: settings.friendRequestsEnabled !== false,
          friendAcceptedEnabled: settings.friendAcceptedEnabled !== false,
          postLikesEnabled: settings.postLikesEnabled !== false,
          postCommentsEnabled: settings.postCommentsEnabled !== false,
          mentionsEnabled: settings.mentionsEnabled !== false,
          messagesEnabled: settings.messagesEnabled !== false,
          // Streaming uygunluk push'u (opt-in, varsayılan kapalı). Backend
          // (dailyStreamingAvailability) yalnız true olanları işler.
          streamingEnabled: settings.streamingEnabled === true,
        },
        // Backend push'unun dilini bilmesi için (foreground/background tutarlılığı).
        notificationLanguage: language === "en" ? "en" : "tr",
        // Streaming bildirimleri: abone olunan sağlayıcılar + TMDB bölgesi.
        streamingProviders: {
          ids: streamingProviderIds,
          region: language === "en" ? "US" : "TR",
        },
      }).catch(() => {});
    }, 600);
    return () => {
      if (settingsMirrorTimerRef.current) clearTimeout(settingsMirrorTimerRef.current);
    };
  }, [
    uid,
    startupReady,
    settings.enabled,
    settings.friendRequestsEnabled,
    settings.friendAcceptedEnabled,
    settings.postLikesEnabled,
    settings.postCommentsEnabled,
    settings.mentionsEnabled,
    settings.messagesEnabled,
    settings.streamingEnabled,
    streamingProviderIds,
    language,
  ]);

  // ── 3. TV bölümlerini düzleştir ──────────────────────────────────────────
  const tvEpisodes = useMemo(() => {
    const out = [];
    (reminders?.tvReminders || []).forEach((show) => {
      (show.seasons || []).forEach((season) => {
        (season.episodes || []).forEach((ep) => out.push(ep));
      });
    });
    return out;
  }, [reminders]);

  const movieReminders = useMemo(
    () => reminders?.movieReminders || [],
    [reminders],
  );

  // ── 4. Reminder local bildirimlerini senkronize et (debounce'lu) ─────────
  const syncTimerRef = useRef(null);
  useEffect(() => {
    if (!startupReady) return undefined;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    syncTimerRef.current = setTimeout(() => {
      const canSchedule =
        !!uid &&
        settings.enabled &&
        settings.remindersEnabled &&
        permissionStatus === "granted";

      const jobs = [];
      if (canSchedule) {
        const lead = settings.leadTimeDays || 0;

        if (settings.moviesEnabled) {
          movieReminders.forEach((m) => {
            if (!m?.movieId) return;
            // leadDays = GERÇEKLEŞEN erken bildirim; seçilen pencere kaçmışsa
            // scheduler daha yakın bir slota düşer ve metin ona göre kurulur.
            const slot = computeReminderSchedule(m.releaseDate, { leadTimeDays: lead });
            if (!slot) return;
            jobs.push({
              identifier: `${REMINDER_PREFIX}movie_${m.movieId}`,
              title: m.movieName || t.movieReminderNotifications,
              body: buildReminderBody(slot.leadDays, t),
              fireMs: slot.fireMs,
              channelId: CHANNELS.reminders,
              data: { kind: "reminder", type: "movie", movieId: String(m.movieId) },
            });
          });
        }

        if (settings.tvShowsEnabled) {
          tvEpisodes.forEach((ep) => {
            if (!ep?.episodeId) return;
            const slot = computeReminderSchedule(ep.airDate, { leadTimeDays: lead });
            if (!slot) return;
            const fireMs = slot.fireMs;
            const epLabel = (t.notifEpisodeShort || "S{s}·B{e}")
              .replace("{s}", String(ep.seasonNumber ?? "?"))
              .replace("{e}", String(ep.episodeNumber ?? "?"));
            // Zamanlama bilgisi (kaç gün sonra) bölüm etiketinin hemen ardında —
            // bildirim kısalsa bile "kaç gün sonra" görünür, bölüm adı en sonda.
            const timing = buildReminderBody(slot.leadDays, t);
            jobs.push({
              identifier: `${REMINDER_PREFIX}tv_${ep.episodeId}`,
              title: ep.showName || t.tvReminderNotifications,
              body: `${epLabel} · ${timing}${ep.episodeName ? ` · ${ep.episodeName}` : ""}`,
              fireMs,
              channelId: CHANNELS.reminders,
              data: {
                kind: "reminder",
                type: "tv",
                episodeId: String(ep.episodeId),
                showId: String(ep.showId ?? ""),
              },
            });
          });
        }

        if (settings.noteRemindersEnabled) {
          (notes || []).forEach((n) => {
            if (!n?.id || !n.scheduledDate) return;
            // Notlarda lead-time uygulanmaz; seçilen tam tarihte tetiklenir.
            const fireMs = computeReminderSchedule(n.scheduledDate, {
              leadTimeDays: 0,
            })?.fireMs;
            if (!fireMs) return;
            const label =
              (n.title && n.title.trim()) ||
              (n.content && String(n.content).slice(0, 40)) ||
              t.noteReminderNotifications;
            jobs.push({
              identifier: `${REMINDER_PREFIX}note_${n.id}`,
              title: t.noteReminderNotifications,
              body: label,
              fireMs,
              channelId: CHANNELS.reminders,
              data: { kind: "reminder", type: "note", noteId: String(n.id) },
            });
          });
        }
      }

      // canSchedule false ise jobs=[] → tüm reminder_* iptal edilir.
      syncReminderNotifications(jobs, {
        limit: Platform.OS === "ios" ? IOS_PENDING_LIMIT : Infinity,
      }).catch(() => {});
    }, 800);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    uid,
    startupReady,
    permissionStatus,
    settings.enabled,
    settings.remindersEnabled,
    settings.moviesEnabled,
    settings.tvShowsEnabled,
    settings.noteRemindersEnabled,
    settings.leadTimeDays,
    movieReminders,
    tvEpisodes,
    notes,
    // Dil değişince reminder metinleri (buildReminderBody, bölüm etiketi, not
    // başlığı) yeni dile göre yeniden üretilip yeniden zamanlansın.
    language,
  ]);

  // ── 5. Foreground sosyal bildirim gösterimi ──────────────────────────────
  const knownIdsRef = useRef(new Set());
  const seededRef = useRef(false);

  // Kullanıcı değişince sıfırla — başka hesabın bildirimlerini gösterme.
  useEffect(() => {
    seededRef.current = false;
    knownIdsRef.current = new Set();
  }, [uid]);

  useEffect(() => {
    if (notifLoading) return;

    // İlk yüklemede mevcut bildirimleri "bilinen" olarak işaretle → backfill yok.
    if (!seededRef.current) {
      knownIdsRef.current = new Set(items.map((i) => i.id));
      seededRef.current = true;
      setBadgeCount(items.filter((i) => !i.read).length);
      return;
    }

    const showAllowed =
      settings.enabled && permissionStatus === "granted";

    const now = Date.now();
    items.forEach((item) => {
      if (knownIdsRef.current.has(item.id)) return;
      knownIdsRef.current.add(item.id);

      if (!showAllowed) return;
      if (item.read) return;

      // Çok eski (listener gecikmesi / yeniden bağlanma) bildirimleri atla.
      const createdMs = item.createdAt?.toMillis?.() ?? null;
      if (createdMs !== null && now - createdMs > 5 * 60 * 1000) return;

      const settingKey = SOCIAL_SETTING_KEY[item.type];
      if (settingKey && settings[settingKey] === false) return;

      const { title, body } = buildSocialContent(item, t);
      presentNow({
        title,
        body,
        channelId: CHANNELS.social,
        data: {
          kind: "social",
          type: item.type,
          notifId: item.id,
          postId: item.postId || null,
          fromUid: item.fromUid || null,
          fromName: item.fromName || null,
          groupId: item.groupId || null,
          groupName: item.groupName || null,
        },
      });
    });

    setBadgeCount(items.filter((i) => !i.read).length);
  }, [items, notifLoading, settings, permissionStatus, t]);

  // ── 6. Bildirime dokunma → yönlendirme ───────────────────────────────────
  useEffect(() => {
    const sub = addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      const nav = navigationRef?.current;
      if (!nav?.isReady?.()) return;
      try {
        if (data.kind === "social") {
          if (data.type === "message") {
            // Grup mesajı → gruba; 1-1 → gönderenle sohbete (WhatsApp gibi).
            if (data.groupId) {
              nav.navigate("ChatScreen", {
                groupId: data.groupId,
                groupName: data.groupName || "",
              });
            } else if (data.fromUid) {
              nav.navigate("ChatScreen", {
                friendUid: data.fromUid,
                friendName: data.fromName || "",
              });
            }
          } else if (data.type === "friend_request") {
            nav.navigate("FriendRequestsScreen");
          } else if (
            (data.type === "post_like" ||
              data.type === "post_comment" ||
              data.type === "comment_reply" ||
              data.type === "mention") &&
            data.postId
          ) {
            // Beğeni → gönderi; yorum/yanıt/mention → gönderi + yorumlar açık.
            nav.navigate("PostDetailScreen", {
              postId: data.postId,
              openComments: data.type !== "post_like",
            });
          }
        } else if (data.kind === "streaming" && data.tmdbId) {
          // İzleme listesi yapımı bir platforma geldi → detay ekranına git.
          nav.navigate(
            data.mediaType === "movie" ? "MovieDetails" : "TvShowsDetails",
            { id: Number(data.tmdbId) },
          );
        }
        // Reminder dokunuşları uygulamayı açar; özel yönlendirme gerekmez.
      } catch {
        /* yok say */
      }
    });
    return () => sub.remove();
  }, [navigationRef]);

  const value = useMemo(
    () => ({
      permissionStatus,
      canAskPermission: permission.canAskAgain,
      requestPermission,
      needsPermissionPriming,
      primeNotificationPermission,
    }),
    [
      permissionStatus,
      permission.canAskAgain,
      requestPermission,
      needsPermissionPriming,
      primeNotificationPermission,
    ],
  );

  return (
    <DeviceNotificationsContext.Provider value={value}>
      {children}
      {/* Sayfa burada, çağrı yerlerinde değil: tek örnek olsun ve hangi ekrandan
          tetiklenirse tetiklensin aynı yerde çizilsin. */}
      <NotificationPrimingSheet
        visible={primeVisible}
        onAllow={onPrimeAllow}
        onDismiss={closePrime}
      />
    </DeviceNotificationsContext.Provider>
  );
}
