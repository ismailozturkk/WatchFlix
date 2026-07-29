// utils/analyticsEvents.js
//
// Analytics olay sözlüğü ve GA4/Firebase kısıtlarının SAF doğrulaması.
// RN/Firebase importu YOK — jest yalnız saf modülleri çalıştırabiliyor.
//
// NEDEN DOĞRULAMA KATMANI: Firebase Analytics geçersiz olay/parametre adını
// SESSİZCE atar. Konsolda 3 gün veri beklerken olayın hiç gitmediğini fark
// etmek, yayın sonrası en pahalı zaman kaybı. Ad ve parametreler gönderilmeden
// önce burada normalize edilir; düzeltilemeyecek kadar bozuksa __DEV__'de
// gürültü çıkarıp olay düşürülür.
//
// Kaynak kısıtlar (Firebase Analytics):
//   olay adı        : 1-40 karakter, harfle başlar, [A-Za-z0-9_]
//   parametre adı   : aynı kural
//   metin değer     : en fazla 100 karakter
//   parametre sayısı: olay başına en fazla 25
//   kullanıcı özelliği: ad ≤ 24, değer ≤ 36 karakter

export const EVENT_NAME_MAX = 40;
export const PARAM_NAME_MAX = 40;
export const PARAM_VALUE_MAX = 100;
export const PARAM_COUNT_MAX = 25;
export const USER_PROPERTY_NAME_MAX = 24;
export const USER_PROPERTY_VALUE_MAX = 36;

// Firebase'in kendi kullanımına ayırdığı önekler.
const RESERVED_PREFIXES = ["firebase_", "google_", "ga_"];

// Firebase'in otomatik topladığı, uygulamanın gönderemeyeceği olay adları.
const RESERVED_EVENT_NAMES = new Set([
  "ad_activeview", "ad_click", "ad_exposure", "ad_impression", "ad_query",
  "ad_reward", "adunit_exposure", "app_background", "app_clear_data",
  "app_exception", "app_remove", "app_store_refund",
  "app_store_subscription_cancel", "app_store_subscription_convert",
  "app_store_subscription_renew", "app_update", "app_upgrade",
  "dynamic_link_app_open", "dynamic_link_app_update",
  "dynamic_link_first_open", "error", "first_open", "first_visit",
  "in_app_purchase", "notification_dismiss", "notification_foreground",
  "notification_open", "notification_receive", "os_update", "session_start",
  "session_start_with_rollout", "user_engagement",
]);

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Yol haritası (Faz 1 Hafta 4) temel olay seti.
 *
 * İki isim GA4'ün ÖNERİLEN adıyla gönderiliyor (`sign_up`, `purchase`):
 * bu adlar konsolda hazır huni/gelir raporlarına düşer, kendi adımızı
 * uydurursak o raporlar boş kalır.
 */
export const ANALYTICS_EVENTS = {
  SIGNUP: "sign_up",
  CONTENT_TRACKED: "content_tracked",
  POST_CREATED: "post_created",
  GAME_PLAYED: "game_played",
  AI_MESSAGE: "ai_message",
  PAYWALL_VIEW: "paywall_view",
  TRIAL_START: "trial_start",
  PURCHASE: "purchase",
};

/** Ölçüm hunisinde kullanılan kullanıcı özellikleri. */
export const USER_PROPERTIES = {
  PREMIUM_TIER: "premium_tier", // "free" | "pro" | "unlimited"
  DEVICE_TIER: "device_tier",   // utils/deviceTier.js sınıfı
  APP_LANGUAGE: "app_language", // "tr" | "en"
};

export function isValidEventName(name) {
  if (typeof name !== "string") return false;
  if (name.length === 0 || name.length > EVENT_NAME_MAX) return false;
  if (!NAME_PATTERN.test(name)) return false;
  if (RESERVED_EVENT_NAMES.has(name)) return false;
  return !RESERVED_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export function isValidParamName(name) {
  if (typeof name !== "string") return false;
  if (name.length === 0 || name.length > PARAM_NAME_MAX) return false;
  if (!NAME_PATTERN.test(name)) return false;
  return !RESERVED_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * Parametreleri Firebase'in kabul ettiği biçime indirger:
 *  - null/undefined ve geçersiz adlar düşer
 *  - boolean → 1/0 (Firebase boolean kabul etmez)
 *  - metin → 100 karaktere kırpılır
 *  - sonlu olmayan sayı (NaN/Infinity) düşer
 *  - 25 parametreden sonrası düşer
 */
export function sanitizeParams(params) {
  if (!params || typeof params !== "object") return {};
  const clean = {};
  let count = 0;

  for (const [key, raw] of Object.entries(params)) {
    if (count >= PARAM_COUNT_MAX) break;
    if (!isValidParamName(key)) continue;
    if (raw === null || raw === undefined) continue;

    let value;
    if (typeof raw === "boolean") value = raw ? 1 : 0;
    else if (typeof raw === "number") {
      if (!Number.isFinite(raw)) continue;
      value = raw;
    } else if (typeof raw === "string") {
      if (raw.length === 0) continue;
      value = raw.slice(0, PARAM_VALUE_MAX);
    } else continue; // dizi/nesne desteklenmiyor

    clean[key] = value;
    count += 1;
  }

  return clean;
}

/**
 * Gönderilmeye hazır olayı üretir. Ad geçersizse `null` döner — çağıran
 * taraf olayı düşürür (bkz. services/analytics.js).
 */
export function buildEvent(name, params) {
  if (!isValidEventName(name)) return null;
  return { name, params: sanitizeParams(params) };
}

/** Kullanıcı özelliği değerini sınırlara indirger; geçersizse null. */
export function sanitizeUserProperty(name, value) {
  if (typeof name !== "string" || name.length === 0) return null;
  if (name.length > USER_PROPERTY_NAME_MAX || !NAME_PATTERN.test(name)) return null;
  if (value === null || value === undefined) return { name, value: null }; // temizleme
  const text = String(value);
  if (text.length === 0) return { name, value: null };
  return { name, value: text.slice(0, USER_PROPERTY_VALUE_MAX) };
}
