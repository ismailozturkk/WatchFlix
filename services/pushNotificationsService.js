// services/pushNotificationsService.js
//
// expo-notifications üzerine ince bir sarmalayıcı. React'tan bağımsız; tüm
// izin / kanal / zamanlama / token işleri burada toplanır.
//
// İki tür bildirim:
//   1) Local (reminder) — cihazda zamanlanır: film/dizi/not hatırlatıcıları.
//      identifier prefix'leri: reminder_movie_ / reminder_tv_ / reminder_note_
//   2) Foreground social — uygulama açık/canlıyken Firestore listener bir
//      "anlık" bildirim sunar (presentNow). identifier prefix: social_
//
// Uzak push CANLI: functions/index.js içindeki onSocialNotificationCreated
// (sosyal bildirimler) ve dailyStreamingAvailability (yayın uygunluğu) burada
// kaydedilen token'lara gönderim yapar.

import { Platform, AppState } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import {
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// Token'ların YERİ: Users/{uid} kök dokümanı tüm oturumlulara okunur olduğu
// için token'lar orada duramaz — herhangi bir kullanıcı hepsini döküp Expo
// push ucundan herkese sahte bildirim atabilirdi. Bu doküman yalnız sahibine
// açık (firestore.rules → match /Users/{uid}/private/{docId}).
const pushDocRef = (uid) => doc(db, "Users", uid, "private", "push");

export const REMINDER_PREFIX = "reminder_";
export const SOCIAL_PREFIX = "social_";

export const CHANNELS = {
  default: "default",
  reminders: "reminders",
  social: "social",
};

let handlerConfigured = false;

// Android kanal adları OS bildirim ayarlarında KULLANICIYA görünür. Uygulama dili
// TR/EN olduğuna göre bunları da yerelleştiriyoruz. React katmanı (dile erişimi
// olan) setChannelNames ile günceller; servis içi çağrılar (izin akışı) bu güncel
// değerleri kullanır. Varsayılan TR — React katmanı açılışta doğru dile çeker.
let channelNames = {
  default: "Genel",
  reminders: "Hatırlatıcılar",
  social: "Sosyal",
};

/**
 * Kanal adlarını (yerelleştirilmiş) ayarla. ensureAndroidChannels bir sonraki
 * çağrıda bu adları uygular (Android var olan kanalın adını günceller).
 */
export function setChannelNames(names) {
  channelNames = { ...channelNames, ...(names || {}) };
}

/**
 * Bildirim davranışını ayarla (uygulama açıkken de banner göster).
 * Bir kez yeterli — App başlangıcında çağrılır.
 */
export function configureNotificationHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification?.request?.content?.data || {};
      // Uygulama önplandayken backend'den gelen sosyal push'u GÖSTERME:
      // aynı bildirimi yerel presentNow (data.local === true) zaten gösteriyor
      // (üstelik tür ayarlarına saygı duyarak). Böylece çift bildirim olmaz.
      // Arka planda handler çağrılmaz → backend push'u OS normal gösterir.
      const isForeground = AppState.currentState === "active";
      const isRemoteSocial = data?.kind === "social" && data?.local !== true;
      if (isForeground && isRemoteSocial) {
        return {
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }
      // Yeni API (banner/list) — shouldShowAlert kaldırıldı (deprecated uyarısı).
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    },
  });
}

/**
 * Android bildirim kanallarını oluştur (idempotent). iOS'ta no-op.
 */
export async function ensureAndroidChannels() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNELS.default, {
      name: channelNames.default,
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1E1E1E",
    });
    await Notifications.setNotificationChannelAsync(CHANNELS.reminders, {
      name: channelNames.reminders,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FFA500",
    });
    await Notifications.setNotificationChannelAsync(CHANNELS.social, {
      name: channelNames.social,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 150, 200],
      lightColor: "#3B82F6",
    });
  } catch (e) {
    if (__DEV__) console.warn("ensureAndroidChannels error:", e?.message);
  }
}

/**
 * Mevcut izin durumu ('granted' | 'denied' | 'undetermined') + tekrar sorulabilirlik.
 *
 * `canAskAgain` KRİTİK: Android 13+ (targetSdk 33+) cihazlarda POST_NOTIFICATIONS
 * hiç istenmemişken bile durum 'denied' döner (bildirimler sistemce kapalıdır).
 * Yani "izin hiç istenmedi" ile "kullanıcı reddetti" durumu YALNIZ canAskAgain
 * ile ayrılabilir; sadece 'undetermined'a bakan bir akış izni hiç istemez.
 *
 * @returns {Promise<{status:string, canAskAgain:boolean, granted:boolean}>}
 */
export async function getPermissionInfo() {
  try {
    const res = await Notifications.getPermissionsAsync();
    return {
      status: res.status,
      canAskAgain: res.canAskAgain !== false,
      granted: res.status === "granted",
    };
  } catch {
    return { status: "undetermined", canAskAgain: true, granted: false };
  }
}

/**
 * İzin iste. Zaten verilmişse tekrar istemez. granted boolean döner.
 */
export async function requestNotificationPermission() {
  try {
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== "granted" && current.canAskAgain !== false) {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status === "granted") {
      await ensureAndroidChannels();
    }
    return status === "granted";
  } catch (e) {
    if (__DEV__) console.warn("requestNotificationPermission error:", e?.message);
    return false;
  }
}

function resolveProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    undefined
  );
}

/**
 * İzin + Expo push token al ve Firestore'a kaydet.
 * Sadece fiziksel cihazda token üretilir. Hata durumunda sessizce null döner.
 * @returns {Promise<string|null>} expo push token
 */
export async function registerForPushNotificationsAsync(uid) {
  try {
    if (!Device.isDevice) return null;

    // Expo Go'da üretilen token Expo Go uygulamasına bağlanır → backend o token'a
    // gönderince bildirim standalone uygulamaya değil Expo Go'ya düşer. Bu yüzden
    // Expo Go'da çalışırken token KAYDETME (eski kullanıcı sorunu buradan geldi).
    if (Constants.appOwnership === "expo" || Constants.executionEnvironment === "storeClient") {
      if (__DEV__) console.warn("registerForPush: Expo Go'da token kaydedilmez");
      return null;
    }

    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const projectId = resolveProjectId();
    if (!projectId) {
      if (__DEV__) console.warn("registerForPush: projectId yok");
      return null;
    }

    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResp?.data;
    if (!token || !uid) return token || null;

    // Token'ı gizli alt dokümana yaz. setDoc+merge: doküman ilk seferde yok.
    try {
      await setDoc(
        pushDocRef(uid),
        {
          expoPushToken: token,
          expoPushTokens: arrayUnion(token),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (e) {
      if (__DEV__) console.warn("push token yazilamadi:", e?.message);
      return token;
    }

    // KENDİ KENDİNİ GÖÇ ETTİRME: yeni yol yazıldıktan SONRA eski kök alanları
    // sil. Sırası önemli — önce silip sonra yazma başarısız olsaydı kullanıcı
    // token'sız kalır, bildirim almazdı. Sunucu bir süre daha eski alanlara da
    // bakıyor (functions/index.js), o yüzden ara durumda kayıp olmuyor.
    await updateDoc(doc(db, "Users", uid), {
      expoPushToken: deleteField(),
      expoPushTokens: deleteField(),
      pushTokenUpdatedAt: deleteField(),
    }).catch(() => {});

    return token;
  } catch (e) {
    if (__DEV__) console.warn("registerForPushNotificationsAsync error:", e?.message);
    return null;
  }
}

/**
 * Belirli bir tarihte tetiklenecek local bildirim zamanla (idempotent identifier).
 * Geçmiş tarih verilirse zamanlamaz.
 * @returns {Promise<string|null>} identifier
 */
export async function scheduleLocalNotification({
  identifier,
  title,
  body,
  date,
  channelId = CHANNELS.default,
  data = {},
}) {
  try {
    const when = date instanceof Date ? date : new Date(date);
    if (isNaN(when.getTime()) || when.getTime() <= Date.now()) return null;

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title, body, data, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        // Android kanalı YALNIZ trigger'dan okunur (BaseNotificationBuilder);
        // content.channelId yok sayılır ve bildirim "Diğer" kanalına düşerdi.
        ...(Platform.OS === "android" ? { channelId } : {}),
      },
    });
    return identifier;
  } catch (e) {
    if (__DEV__) console.warn("scheduleLocalNotification error:", e?.message);
    return null;
  }
}

/**
 * Hemen (anlık) bir local bildirim göster — foreground sosyal bildirimler için.
 */
export async function presentNow({
  title,
  body,
  data = {},
  channelId = CHANNELS.social,
}) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        // local:true → handler bunu "yerel" olarak tanır, backend push'unun
        // foreground kopyasını bastırırken bunu gösterir (çift bildirim önlenir).
        data: { ...data, local: true },
        sound: true,
      },
      // Android'de kanal trigger'dan gelir; trigger null verilirse bildirim
      // "social" kanalına değil fallback kanala düşer (sessiz + yanlış ayar
      // grubu). `{ channelId }` biçimi kanal trigger'ıdır: yine ANINDA gösterir.
      // iOS'ta kanal kavramı yok → null (hemen göster).
      trigger: Platform.OS === "android" ? { channelId } : null,
    });
  } catch (e) {
    if (__DEV__) console.warn("presentNow error:", e?.message);
  }
}

export async function cancelScheduledNotification(identifier) {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (e) {
    if (__DEV__) console.warn("cancelScheduledNotification error:", e?.message);
  }
}

export async function cancelAllScheduled() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    if (__DEV__) console.warn("cancelAllScheduled error:", e?.message);
  }
}

/**
 * Tüm zamanlanmış bildirimleri döner.
 * @returns {Promise<Array<{identifier:string, content:object, trigger:object}>>}
 */
export async function getAllScheduled() {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return [];
  }
}

/**
 * Verilen prefix ile başlayan tüm zamanlanmış bildirimleri iptal et.
 */
export async function cancelScheduledByPrefix(prefix) {
  const all = await getAllScheduled();
  await Promise.all(
    all
      .filter((n) => typeof n.identifier === "string" && n.identifier.startsWith(prefix))
      .map((n) => cancelScheduledNotification(n.identifier)),
  );
}

// Listener helper'ları — React tarafı bunları kullanır.
export function addNotificationReceivedListener(cb) {
  return Notifications.addNotificationReceivedListener(cb);
}

export function addNotificationResponseReceivedListener(cb) {
  return Notifications.addNotificationResponseReceivedListener(cb);
}

export async function getLastNotificationResponse() {
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch {
    return null;
  }
}

export async function setBadgeCount(count) {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count || 0));
  } catch {
    /* no-op */
  }
}
