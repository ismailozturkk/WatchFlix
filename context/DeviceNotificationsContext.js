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
import { AppState } from "react-native";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import { useNotificationSettings } from "./AppSettingsContext";
import { useNotifications } from "./NotificationsContext";
import { useProfileReminders } from "./ProfileRemindersContext";
import { useProfileNotes } from "./ProfileNotesContext";
import {
  configureNotificationHandler,
  ensureAndroidChannels,
  getPermissionStatus,
  requestNotificationPermission,
  registerForPushNotificationsAsync,
  presentNow,
  addNotificationResponseReceivedListener,
  setBadgeCount,
  CHANNELS,
  REMINDER_PREFIX,
} from "../services/pushNotificationsService";
import {
  computeReminderFireMs,
  syncReminderNotifications,
} from "../services/reminderNotificationScheduler";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import useStartupGate from "../hooks/useStartupGate";

const DeviceNotificationsContext = createContext({
  permissionStatus: "undetermined",
  requestPermission: async () => false,
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

function buildReminderBody(leadTimeDays, t) {
  if (!leadTimeDays || leadTimeDays === 0) {
    return t.notifReminderBodyToday || "Bugün yayında!";
  }
  return (t.notifReminderBodyBefore || "{days} gün içinde yayında").replace(
    "{days}",
    String(leadTimeDays),
  );
}

export function DeviceNotificationsProvider({ children, navigationRef }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const { t, language } = useLanguage();
  const { notificationSettings: settings } = useNotificationSettings();
  const { items, loading: notifLoading } = useNotifications();
  const { reminders } = useProfileReminders();
  const { notes } = useProfileNotes();

  const [permissionStatus, setPermissionStatus] = useState("undetermined");

  // Ayar aynalama (Firestore yazması) + reminder senkronu açılışta acil değil;
  // splash sonrası donma penceresinin dışına ertele. Kapı açıldıktan sonra
  // davranış birebir aynı (debounce'lar korunur).
  const startupReady = useStartupGate(4200);

  // ── 1. Bir kerelik kurulum: handler + kanallar + mevcut izin durumu ───────
  useEffect(() => {
    configureNotificationHandler();
    ensureAndroidChannels();
    getPermissionStatus().then(setPermissionStatus);
  }, []);

  // İzin durumunu uygulama öne geldikçe tazele (kullanıcı OS ayarından değiştirebilir).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") getPermissionStatus().then(setPermissionStatus);
    });
    return () => sub.remove();
  }, []);

  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setPermissionStatus(granted ? "granted" : "denied");
    return granted;
  }, []);

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
        },
        // Backend push'unun dilini bilmesi için (foreground/background tutarlılığı).
        notificationLanguage: language === "en" ? "en" : "tr",
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
            const fireMs = computeReminderFireMs(m.releaseDate, { leadTimeDays: lead });
            if (!fireMs) return;
            jobs.push({
              identifier: `${REMINDER_PREFIX}movie_${m.movieId}`,
              title: m.movieName || t.movieReminderNotifications,
              body: buildReminderBody(lead, t),
              fireMs,
              channelId: CHANNELS.reminders,
              data: { kind: "reminder", type: "movie", movieId: String(m.movieId) },
            });
          });
        }

        if (settings.tvShowsEnabled) {
          tvEpisodes.forEach((ep) => {
            if (!ep?.episodeId) return;
            const fireMs = computeReminderFireMs(ep.airDate, { leadTimeDays: lead });
            if (!fireMs) return;
            const epLabel = `S${ep.seasonNumber ?? "?"}·B${ep.episodeNumber ?? "?"}`;
            jobs.push({
              identifier: `${REMINDER_PREFIX}tv_${ep.episodeId}`,
              title: ep.showName || t.tvReminderNotifications,
              body: ep.episodeName ? `${epLabel} · ${ep.episodeName}` : epLabel,
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
            const fireMs = computeReminderFireMs(n.scheduledDate, { leadTimeDays: 0 });
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
      syncReminderNotifications(jobs).catch(() => {});
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
        }
        // Reminder dokunuşları uygulamayı açar; özel yönlendirme gerekmez.
      } catch {
        /* yok say */
      }
    });
    return () => sub.remove();
  }, [navigationRef]);

  const value = useMemo(
    () => ({ permissionStatus, requestPermission }),
    [permissionStatus, requestPermission],
  );

  return (
    <DeviceNotificationsContext.Provider value={value}>
      {children}
    </DeviceNotificationsContext.Provider>
  );
}
