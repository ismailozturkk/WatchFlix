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

import { normalizeAppLanguage, tmdbRegionOf } from "../utils/appLanguages";
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
import { notificationInboxCopy } from "../utils/notificationInboxCopy";
import { cineResultDestination } from "../utils/notificationInbox";
import {
  floatingNoticesPresenting,
  requestFloatingNoticeFocus,
} from "../services/floatingNoticeBus";
import { useFriends } from "./FriendsContext";
import { useUnreadMessages } from "./UnreadMessagesContext";
import { useProfileReminders } from "./ProfileRemindersContext";
import { useProfileNotes } from "./ProfileNotesContext";
import { noteReminderDateValue } from "../utils/noteReminders";
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
import {
  chatIdForNotification,
  isChatActive,
} from "../services/activeChatTracker";
import { computeAppBadgeCount } from "../utils/appBadge";

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
  cineswipe_invite: "messagesEnabled",
  game_challenge: "messagesEnabled",
  cineswipe_result: "messagesEnabled",
};

// WhatsApp/Instagram tarzı: BAŞLIK = kişi/grup adı, GÖVDE = aksiyon (emoji) / mesaj.
// Backend buildContent (functions/index.js) ile birebir aynı mantık → foreground ve
// background bildirimleri tutarlı görünür.
function buildSocialContent(item, t, language) {
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
    case "cineswipe_invite":
      return { title: name, body: `🎬 ${notificationInboxCopy(language).cineInvite}` };
    case "game_challenge":
      return { title: name, body: `⚔️ ${notificationInboxCopy(language).duelInvite}` };
    case "cineswipe_result": {
      const copy = notificationInboxCopy(language);
      const detail = Number.isInteger(item.matchCount) ? ` · ${copy.cineResultDetail(item.matchCount)}` : "";
      return { title: name, body: `🎬 ${copy.cineResult}${detail}` };
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
  const friendsState = useFriends();
  const { unreadMessages, ready: unreadReady } = useUnreadMessages();
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
  const startupReady = useStartupGate(3600);

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
  // hatırlatma zamanlanmaz ve kullanıcı bunu hiç fark etmez. İzni sormak şart,
  // ama SORULMA ANI kritik:
  //
  //   ESKİDEN: açılıştan ~4.2 sn sonra sistem diyaloğu habersiz açılıyordu.
  //   Kullanıcı neyin sorulduğunu görmeden "İzin verme" diyor, iOS'ta o hak
  //   ömürlük yanıyordu. App Review'da da yorum konusu.
  //
  //   ŞİMDİ (startup-prime): splash + navigation settle ettikten 1.5 sn sonra
  //   KENDİ sayfamız açılıyor. Kullanıcı içeriği gördükten sonra bağlamını
  //   anlayarak karar veriyor. "Şimdi değil" seçeneği hiçbir sistem hakkını
  //   harcamaz — Ayarlar'daki uyarı satırı her zaman açık kapı.
  //
  // Sayfa TEK SEFERLİK: iki düğme de bayrağı yakıyor. Daha önce gösterilmişse
  // (primeShown=true) ya da izin zaten verilmişse (granted) açılmaz.
  // Kalıcı reddedilmişse (canAskAgain=false) açmak anlamsız — sadece
  // NotificationPermissionNotice ayarlar satırı aktif olur.
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

  // ── 1d. Startup otomatik priming ──────────────────────────────────────────
  //
  // startupReady=true (splash + 4.2 sn buffer) + uid (oturum açık) olduktan
  // sonra 1.5 sn daha bekle: navigation stack settle etsin ve kullanıcı ana
  // içeriği bir an görsün. Ardından izin gerekiyorsa PrimingSheet aç.
  //
  // uid bağımlılığı: kullanıcı çıkış yapıp başka hesapla girerse yeni hesap
  // için de değerlendirilir (primeShown kişiye değil cihaza kayıtlı).
  const startupPrimeRef = useRef(false);
  useEffect(() => {
    // startupReady henüz açılmadıysa veya oturum yoksa bekle.
    if (!startupReady || !uid) return undefined;
    // Bu effect uid her değiştiğinde çalışır; bir kez yeterli.
    if (startupPrimeRef.current) return undefined;
    startupPrimeRef.current = true;

    const timer = setTimeout(() => {
      // Gecikme sırasında izin verilmiş ya da bayrak atılmış olabilir —
      // needsPrimingRef her render'da güncelleniyor, anlık doğru değeri tutar.
      if (needsPrimingRef.current) {
        setPrimeVisible(true);
      }
    }, 1500);

    return () => clearTimeout(timer);
    // startupReady bir kez true olur; uid değişirse yeni hesap için de tetikle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startupReady, uid]);

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
          // Haftalık özet (opt-in, varsayılan kapalı). Backend (weeklyReleaseDigest) yalnız true olanları işler.
          weeklyDigestEnabled: settings.weeklyDigestEnabled === true,
        },
        // Backend push'unun dilini bilmesi için (foreground/background tutarlılığı).
        // Sunucu push dili (functions/index.js pickNotificationLang): uygulama dili aynen.
        notificationLanguage: normalizeAppLanguage(language),
        // Streaming bildirimleri: abone olunan sağlayıcılar + TMDB bölgesi.
        streamingProviders: {
          ids: streamingProviderIds,
          region: tmdbRegionOf(language),
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
    settings.weeklyDigestEnabled,
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
            // Notlarda lead-time uygulanmaz; seçilen gün + saatte tetiklenir
            // (saatsiz eski notlar 09:00).
            const fireMs = computeReminderSchedule(noteReminderDateValue(n), {
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

      // Yerel kopya YALNIZ uygulama ön plandayken üretilir. Arka planda (özellikle
      // Android'de JS birkaç dakika canlı kalır) Firestore listener yine tetiklenir;
      // orada yerel kopya basılırsa backend push'uyla ÇİFT bildirim olurdu —
      // arka planın tek kaynağı backend push'u.
      if (AppState.currentState !== "active") return;

      // Çok eski (listener gecikmesi / yeniden bağlanma) bildirimleri atla.
      const createdMs = item.createdAt?.toMillis?.() ?? null;
      if (createdMs !== null && now - createdMs > 5 * 60 * 1000) return;

      const settingKey = SOCIAL_SETTING_KEY[item.type];
      if (settingKey && settings[settingKey] === false) return;

      // Mesaj bildirimlerinde sohbet kimliği taşınır: hem aşağıdaki erken kontrol
      // hem de OS handler'ı (utils/notificationPresentation.js) onunla karar verir.
      const chatId =
        item.type === "message" ? chatIdForNotification(item, uid) : null;

      // Bu mesaj, kullanıcının o an ekranda tuttuğu sohbetten geldiyse banner
      // gereksiz — mesajı zaten sohbette canlı görüyor.
      if (chatId && isChatActive(chatId)) return;

      // Davet: yüzen bildirim katmanı görünürse kartı zaten üstte açıyor; sistem
      // afişi ikinci kez çıkmasın. Katman gizli rotadaysa (oyun, sohbet…) afiş kalır.
      if (
        (item.type === "cineswipe_invite" || item.type === "game_challenge") &&
        floatingNoticesPresenting()
      ) {
        return;
      }

      const { title, body } = buildSocialContent(item, t, language);
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
          inviteCode: item.inviteCode || null,
          dayKey: item.dayKey || null,
          chatId,
        },
      });
    });
  }, [items, notifLoading, settings, permissionStatus, t, language, uid]);

  // ── 5b. Uygulama simgesi rozeti ──────────────────────────────────────────
  //
  // Rozet = okunmamış 1-1 mesajlar + bekleyen gelen arkadaşlık istekleri
  // (tanım ve gerekçe: utils/appBadge.js). Sayı HER değiştiğinde mutlak değer
  // olarak yazılır; kullanıcı sohbeti okuyup isteği yanıtlayınca kendiliğinden
  // düşer. Uygulama kapalıyken aynı sayıyı sunucu push'unun `badge` alanı
  // taşır (functions/appBadge.js).
  //
  // Her iki kaynak da ilk snapshot'ını almadan yazılmaz: hazır olmayan "0",
  // sunucunun bıraktığı doğru rozeti açılışta bir an silip geri getirirdi.
  const friendsReady = friendsState ? friendsState.loading === false : false;
  const incomingRequestCount = friendsState?.incomingRequests?.length ?? 0;
  const appBadgeCount = computeAppBadgeCount({
    unreadMessages,
    incomingRequests: incomingRequestCount,
  });
  const badgeAllowed =
    !!uid && settings.enabled !== false && permissionStatus === "granted";

  // Çıkışı "açılışta oturum henüz yok" durumundan ayırmak için: yalnız bir uid
  // GERÇEKTEN düşerse temizlenir; soğuk açılışta oturum geri yüklenirken uid
  // kısa süre null olur ve o an rozeti silmek sunucunun doğru sayısını yakardı.
  const hadUidRef = useRef(false);

  useEffect(() => {
    if (!uid) {
      if (hadUidRef.current) {
        hadUidRef.current = false;
        // Çıkış: önceki hesabın sayısı simgede kalmasın.
        setBadgeCount(0);
      }
      return;
    }
    hadUidRef.current = true;
    // İzin yok ya da henüz çözülmedi ("undetermined" ilk karedir): dokunma —
    // izin yokken rozet zaten gösterilemez, çözülmemişken yazmak yanlış olur.
    if (permissionStatus !== "granted") return;
    if (settings.enabled === false) {
      // Kullanıcı bildirimleri kapattıysa rozet de kalmasın.
      setBadgeCount(0);
      return;
    }
    if (!unreadReady || !friendsReady) return;
    setBadgeCount(appBadgeCount);
  }, [
    uid,
    permissionStatus,
    settings.enabled,
    unreadReady,
    friendsReady,
    appBadgeCount,
  ]);

  // Uygulama öne gelince sayıyı yeniden yaz: arka plandayken gelen push'lar
  // sunucu sayısını bıraktı; gerçek değer artık istemcide.
  useEffect(() => {
    if (!badgeAllowed || !unreadReady || !friendsReady) return undefined;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setBadgeCount(appBadgeCount);
    });
    return () => sub.remove();
  }, [badgeAllowed, unreadReady, friendsReady, appBadgeCount]);

  // ── 6. Bildirime dokunma → yönlendirme ───────────────────────────────────
  useEffect(() => {
    const sub = addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      // Davet kartı her ekranda yüzen katmanda açılır (Kabul / Reddet orada); gidilecek
      // ekran yok, navigasyon hazır olmasa da istek katman kurulunca alınır.
      // Kimlik utils/floatingNotices.inviteNotices ile aynı.
      if (
        data.kind === "social" &&
        (data.type === "cineswipe_invite" || data.type === "game_challenge")
      ) {
        requestFloatingNoticeFocus(data.notifId ? `invite:${data.notifId}` : "invite:");
        return;
      }
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
          } else if (data.type === "cineswipe_result") {
            const target = cineResultDestination({ roomId: data.roomId });
            nav.navigate(target.name, target.params);
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
        } else if (data.kind === "weeklyDigest") {
          // Haftalık özet → bu haftanın çıkışlarını gösteren takvim ekranı.
          nav.navigate("CalendarScreen");
        } else if (data.kind === "reminder" && data.type === "note" && data.noteId) {
          // Not hatırlatması → Notlar'da o notun düzenleyicisi (okundu da sayılır).
          nav.navigate("NotesScreen", { openNoteId: String(data.noteId) });
        }
        // Film / dizi reminder dokunuşları uygulamayı açar; özel yönlendirme gerekmez.
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
