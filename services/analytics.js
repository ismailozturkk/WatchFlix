// services/analytics.js
//
// Firebase Analytics sarmalayıcısı. Çağrı yerleri yalnız buradaki
// `trackEvent(ANALYTICS_EVENTS.X, {...})` API'sini görür.
//
// TASARIM KARARLARI
// 1. Native modül TEMBEL yüklenir (try/catch). Analytics yeni bir derleme
//    gerektiriyor; mevcut dev client'ta modül yokken import patlarsa uygulama
//    hiç açılmazdı. Modül yoksa her çağrı sessiz no-op olur.
// 2. Geliştirmede olaylar VARSAYILAN OLARAK gönderilmez, konsola yazılır —
//    üretim panosu test verisiyle kirlenmesin. Gerçekten göndermek için
//    .env'e EXPO_PUBLIC_ANALYTICS_DEV=1 ekle.
// 3. Ad/parametre doğrulaması saf katmanda (utils/analyticsEvents.js).
//    Geçersiz olay Firebase tarafından SESSİZCE atılırdı; burada __DEV__'de
//    gürültü çıkarıp düşürüyoruz.
import {
  ANALYTICS_EVENTS,
  USER_PROPERTIES,
  buildEvent,
  sanitizeUserProperty,
} from "../utils/analyticsEvents";

export { ANALYTICS_EVENTS, USER_PROPERTIES };

const SEND_IN_DEV = process.env.EXPO_PUBLIC_ANALYTICS_DEV === "1";

let api = null;        // @react-native-firebase/analytics modülü
let instance = null;   // Analytics örneği
let resolved = false;

function getAnalyticsApi() {
  if (resolved) return api;
  resolved = true;
  try {
    // eslint-disable-next-line global-require
    api = require("@react-native-firebase/analytics");
    instance = api.getAnalytics();
  } catch (error) {
    api = null;
    instance = null;
    if (__DEV__) {
      console.warn(
        "[analytics] Native modül yok (yeni build gerekli?):",
        error?.message || error,
      );
    }
  }
  return api;
}

// Gerçekten Firebase'e gönderilsin mi? (Geliştirmede varsayılan hayır.)
const shouldSend = () => !__DEV__ || SEND_IN_DEV;

/**
 * Olay gönderir. Ad geçersizse olay DÜŞER (Firebase'in sessiz atmasındansa
 * geliştirmede görünür hata).
 */
export function trackEvent(name, params) {
  const event = buildEvent(name, params);
  if (!event) {
    if (__DEV__) console.error(`[analytics] Geçersiz olay adı: ${name}`);
    return false;
  }

  if (!shouldSend()) {
    if (__DEV__) console.log("[analytics dev]", event.name, event.params);
    return false;
  }

  const analyticsApi = getAnalyticsApi();
  if (!analyticsApi || !instance) return false;

  // Analytics ateşle-unut: hiçbir kullanıcı akışı buna bağlı beklememeli.
  // RNFB 26 kırıcı değişikliği: `logEvent` artık firebase-js-sdk ile hizalı
  // olarak SENKRON `void` dönüyor (setUserId/logScreenView hâlâ Promise).
  // Eski `.catch(...)` zinciri burada "undefined.catch is not a function" ile
  // her olayda patlardı; hata yakalama try/catch'e taşındı.
  try {
    analyticsApi.logEvent(instance, event.name, event.params);
  } catch (error) {
    if (__DEV__) console.warn("[analytics] logEvent:", error?.message || error);
    return false;
  }
  return true;
}

/** Ekran görüntülemesi (huni analizinin temeli). */
export function trackScreen(screenName) {
  if (typeof screenName !== "string" || !screenName) return false;
  if (!shouldSend()) {
    if (__DEV__) console.log("[analytics dev] screen:", screenName);
    return false;
  }
  const analyticsApi = getAnalyticsApi();
  if (!analyticsApi || !instance) return false;

  analyticsApi
    .logScreenView(instance, { screen_name: screenName, screen_class: screenName })
    .catch((error) => {
      if (__DEV__) console.warn("[analytics] logScreenView:", error?.message || error);
    });
  return true;
}

/** Oturum açan kullanıcıyı bağlar; çıkışta `null` ile temizlenir. */
export function setAnalyticsUser(uid) {
  if (!shouldSend()) return false;
  const analyticsApi = getAnalyticsApi();
  if (!analyticsApi || !instance) return false;
  analyticsApi.setUserId(instance, uid || null).catch(() => {});
  return true;
}

/** Kullanıcı özelliği (premium katmanı, cihaz sınıfı, dil...). */
export function setAnalyticsUserProperty(name, value) {
  const prop = sanitizeUserProperty(name, value);
  if (!prop) {
    if (__DEV__) console.error(`[analytics] Geçersiz kullanıcı özelliği: ${name}`);
    return false;
  }
  if (!shouldSend()) {
    if (__DEV__) console.log("[analytics dev] prop:", prop.name, prop.value);
    return false;
  }
  const analyticsApi = getAnalyticsApi();
  if (!analyticsApi || !instance) return false;
  analyticsApi.setUserProperties(instance, { [prop.name]: prop.value }).catch(() => {});
  return true;
}

/** Kullanıcı ölçümü reddederse (gelecekteki consent akışı) toplamayı kapatır. */
export function setAnalyticsEnabled(enabled) {
  const analyticsApi = getAnalyticsApi();
  if (!analyticsApi || !instance) return false;
  analyticsApi.setAnalyticsCollectionEnabled(instance, Boolean(enabled)).catch(() => {});
  return true;
}
