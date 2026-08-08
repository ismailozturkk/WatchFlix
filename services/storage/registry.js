// services/storage/registry.js
//
// PROJEDEKİ HER KALICI ANAHTARIN TEK TANIM YERİ.
//
// Neden: geçiş öncesi `apicache_` üç dosyada, `feed_cache_v1` üç dosyada,
// `list_status_cache_` üç dosyada elle yazılıydı; `hapticsEnabled` iki modülün
// sahipliğindeydi. Birini değiştiren diğerini bilmiyordu. Artık fiziksel anahtar
// adı YALNIZ burada geçer; çağrı yerleri `Keys.haptics` gibi tanımlayıcı kullanır.
//
// Bir girdi şunları söyler:
//   key      → MMKV'deki fiziksel ad. AsyncStorage'daki adla AYNI tutuldu ki
//              göç düz kopya olsun (bkz. migration.js).
//   store    → hangi MMKV örneği (silme davranışını belirler, bkz. instances.js)
//   type     → string | number | boolean | json
//   default  → kayıt yoksa VE kayıt bozuksa dönecek değer
//   scope    → "global" | "user" (user ise `key` bir ÖNEKtir, sonuna uid gelir)
//   validate → opsiyonel; false dönerse değer yok sayılır ve default kullanılır
//   legacy   → göçte ayrıca denenecek eski AsyncStorage anahtarları
//
// YENİ ANAHTAR EKLERKEN: buraya bir girdi ekle, çağrı yerinde `Keys.<ad>` kullan.
// Başka hiçbir yere fiziksel anahtar adı yazma.

import {
  TYPES,
  oneOf,
  range,
  arrayOf,
  plainObject,
} from "./codec";

/** Kullanıcıya bağlı anahtarlarda uid yoksa kullanılan kova. */
export const GUEST_SCOPE = "guest";

const VALID_STORES = new Set(["settings", "data", "cache", "session"]);

function defineKey(name, spec) {
  if (!spec.key) throw new Error(`[storage] ${name}: "key" zorunlu`);
  if (!VALID_STORES.has(spec.store))
    throw new Error(`[storage] ${name}: geçersiz store "${spec.store}"`);
  if (!TYPES[spec.type]) throw new Error(`[storage] ${name}: geçersiz type "${spec.type}"`);
  return Object.freeze({
    name,
    scope: "global",
    validate: null,
    // scope:"user" anahtarlarda çıkışta korunsun mu? Varsayılan hayır — istisna
    // olanlar girdilerinde gerekçesiyle birlikte işaretli.
    keepOnLogout: false,
    ...spec,
    legacy: Object.freeze(spec.legacy || []),
  });
}

/* ================================================================== */
/* AYARLAR — kullanıcı tercihleri. Asla otomatik silinmez.             */
/* ================================================================== */

const settingsKeys = {
  showSnow: { key: "showSnow", type: TYPES.boolean, default: false },
  language: { key: "selectedLanguage", type: TYPES.string, default: "tr" },
  // "blue" | "dark" | ... | "custom:<id>" — serbest string, doğrulama tema
  // listesine bağlı ve o liste çalışma anında büyüyor (özel temalar).
  theme: { key: "selectedTheme", type: TYPES.string, default: "blue" },
  customThemes: {
    key: "customThemes",
    type: TYPES.json,
    default: [],
    validate: arrayOf((t) => !!(t && t.id && t.tokens)),
    // Eski tek tema kaydı (`customThemeTokens`) buraya ÇAPRAZ ANAHTAR etkisiyle
    // taşınıyor (seçili tema da "custom:<id>" olmalı), o yüzden `legacy` değil
    // migration.js'teki migrateCustomThemes hallediyor.
  },
  selectedAvatar: { key: "selectedAvatar", type: TYPES.json, default: null },
  adultContent: { key: "adultContent", type: TYPES.boolean, default: false },
  showOngoingTvShows: { key: "showOngoingTvShows", type: TYPES.boolean, default: true },
  showIconBackground: { key: "showIconBackground", type: TYPES.boolean, default: false },
  iconBackgroundMode: {
    key: "iconBackgroundMode",
    type: TYPES.string,
    default: "shared",
    validate: oneOf("shared", "random"),
  },
  iconBackgroundOpacity: {
    key: "iconBackgroundOpacity",
    type: TYPES.number,
    default: 1,
    validate: range(0.1, 1),
  },
  imageQualityLevel: {
    key: "imageQualityLevel",
    type: TYPES.string,
    default: "good",
    // Eski kayıt TMDB genişliğini tutuyordu ("w500"); yeni kayıt kalite adını.
    legacy: [
      {
        key: "imageQuality",
        transform: (raw) => ({
          ok: true,
          value: { w300: "low", w500: "good", w780: "high", w1280: "high", original: "original" }[raw] || "good",
        }),
      },
    ],
  },
  haptics: { key: "hapticsEnabled", type: TYPES.boolean, default: false },
  notificationSettings: {
    key: "notificationSettings",
    type: TYPES.json,
    default: null,
    validate: plainObject,
    legacy: ["reminderNotificationSettings"],
  },
  autoDataCache: { key: "autoDownloadData", type: TYPES.boolean, default: false },
  dataCacheTypes: { key: "autoDownloadDataTypes", type: TYPES.json, default: null },
  listsGridColumns: {
    key: "listsGridColumns",
    type: TYPES.number,
    default: 3,
    validate: oneOf(3, 4),
  },
  listsPosterRadius: {
    key: "listsPosterRadius",
    type: TYPES.number,
    default: 10,
    validate: oneOf(2, 10, 20),
  },
  seeAllGridColumns: {
    key: "seeAllGridColumns",
    type: TYPES.number,
    default: 3,
    validate: oneOf(3, 4),
  },
  seeAllPosterRadius: {
    key: "seeAllPosterRadius",
    type: TYPES.number,
    default: 10,
    validate: oneOf(2, 10, 20),
  },
  railPosterSize: {
    key: "railPosterSize",
    type: TYPES.string,
    default: "normal",
    validate: oneOf("normal", "small"),
  },
  railPosterRadius: {
    key: "railPosterRadius",
    type: TYPES.number,
    default: 15,
    validate: oneOf(4, 15, 24),
  },
  postListPosterLayout: {
    key: "postListPosterLayout",
    type: TYPES.string,
    default: "spaced",
    validate: oneOf("spaced", "joined"),
  },
  posterBadges: { key: "showPosterBadges", type: TYPES.json, default: null },
  streamingProviderIds: {
    key: "streamingProviderIds",
    type: TYPES.json,
    default: [],
    validate: Array.isArray,
  },
  // Profil/liste görünümü
  // ---- Cihaz düzeyi, çıkışta KORUNUR ------------------------------------
  // Bu ikisi bilinçli olarak `settings` deposunda: `session` deposu çıkışta
  // komple boşaltılıyor ve orada dursalardı çıkış yapan kullanıcı onboarding'i
  // baştan görür, hızlı giriş çipleri de silinirdi. İkisi de kullanıcıya değil
  // CİHAZA ait.
  hasSeenOnboarding: { key: "hasSeenOnboarding", type: TYPES.boolean, default: false },
  // Bildirim izni ön-açıklama sayfası gösterildi mi (bkz.
  // utils/notificationPriming.js). OS izni CİHAZA ait, hesaba değil — bayrak da
  // öyle: aynı cihazda başka hesaba geçen kullanıcıya aynı sayfa tekrar
  // gösterilmez, izin durumu zaten ortak.
  notificationPrimeShown: {
    key: "notificationPrimeShown",
    type: TYPES.boolean,
    default: false,
  },
  recentUsers: {
    key: "recentUsers",
    type: TYPES.json,
    default: [],
    validate: Array.isArray,
  },

  listGridStyle: {
    key: "listGridStyle",
    type: TYPES.number,
    default: 1,
    validate: oneOf(1, 2, 3, 4),
    // Anahtar iki kuşak gördü: önce boolean ("true"/"false" = 1/2 sütun),
    // sonra sayı ("1".."4"). İkisi de aynı fiziksel adı kullandığı için
    // dönüşüm burada; okuma yolunda tolerans bırakmıyoruz.
    fromLegacy: (raw) => {
      if (raw === "true") return { ok: true, value: 1 };
      if (raw === "false") return { ok: true, value: 2 };
      const n = parseInt(raw, 10);
      return n >= 1 && n <= 4 ? { ok: true, value: n } : { ok: false };
    },
  },
  allCornersRounded: { key: "allCornersRounded", type: TYPES.boolean, default: false },
  statsCountMode: {
    key: "statsCountMode",
    type: TYPES.string,
    default: "total",
    validate: oneOf("total", "unique"),
  },
  // Görsel efekt modu — sahibi services/effectSettings.js
  effectMode: { key: "effectMode", type: TYPES.string, default: null },
  // Tipografi — sahibi services/typographySettings.js
  fontRoles: {
    key: "appFontRoles",
    type: TYPES.json,
    default: null,
    // Rol ayrımından önceki sürüm TEK bir font adı tutuyordu ("Monoton").
    // Üç role birden yayılır; typographySettings okurken normalizeFontRoles ile
    // role uygun olmayanları (ör. Monoton gövde metnine) zaten eliyor.
    legacy: [
      {
        key: "appFontFamily",
        transform: (raw) =>
          raw ? { ok: true, value: { heading: raw, body: raw, numeric: raw } } : { ok: false },
      },
    ],
  },
  // Widget tercihleri — sahibi services/widgetPreferencesService.js
  widgetPreferences: { key: "widgetPreferences", type: TYPES.json, default: null },
  // Pet
  petEnabled: { key: "pet_enabled", type: TYPES.boolean, default: false },
  // { [petId]: true } — dizi DEĞİL, kilidi açılmış petlerin haritası.
  petOwned: { key: "pet_owned", type: TYPES.json, default: null, validate: plainObject },
  petSelected: { key: "pet_selected", type: TYPES.string, default: null },
  petPosition: { key: "pet_position", type: TYPES.json, default: null },
  petSize: { key: "pet_size", type: TYPES.number, default: 124 },
};

/* ================================================================== */
/* VERİ — kullanıcının ürettiği içerik. Önbellek temizliği DOKUNMAZ.   */
/* ================================================================== */

const dataKeys = {
  // ---- Kullanıcıya bağlı içerik ------------------------------------------
  //
  // GİZLİLİK DÜZELTMESİ: bu beş anahtar geçiş öncesinde uid'SİZ globaldi
  // ("post_drafts", "@seelogd/ai_conversations", ...). Aynı cihazda hesap
  // değiştiren kullanıcı öncekinin gönderilmemiş taslaklarını ve AI sohbet
  // geçmişini görüyordu. Artık uid ile kapsanıyorlar; göç, eski global kaydı
  // `cachedUserId`nin işaret ettiği sahibin altına taşır (bkz. migration.js).
  postDrafts: {
    key: "post_drafts:",
    type: TYPES.json,
    default: [],
    scope: "user",
    validate: Array.isArray,
    legacy: ["post_drafts"],
  },
  storyDrafts: {
    key: "story_drafts_v1:",
    type: TYPES.json,
    default: [],
    scope: "user",
    legacy: ["story_drafts_v1"],
  },
  aiConversations: {
    key: "@seelogd/ai_conversations:",
    type: TYPES.json,
    default: null,
    scope: "user",
    legacy: ["@seelogd/ai_conversations"],
  },
  aiCineConversations: {
    key: "@seelogd/ai_cine_conversations:",
    type: TYPES.json,
    default: null,
    scope: "user",
    legacy: ["@seelogd/ai_cine_conversations"],
  },
  aiCinePrefs: {
    key: "@seelogd/ai_cine_prefs:",
    type: TYPES.json,
    default: null,
    scope: "user",
    legacy: ["@seelogd/ai_cine_prefs"],
  },

  // Zaten uid ile kapsanmış olanlar — `key` bir ÖNEK, sonuna uid eklenir.
  avatarIndex: { key: "avatar_", type: TYPES.number, default: 0, scope: "user" },
  upNextPreferences: {
    key: "up-next:preferences:",
    type: TYPES.json,
    default: null,
    scope: "user",
    keepOnLogout: true,
  },
  sceneGamePreferences: {
    key: "scene_game:last_settings:",
    type: TYPES.json,
    default: null,
    scope: "user",
    keepOnLogout: true,
  },
  // İzleme rozeti defteri — seri/aktiflik geçmişi burada. Çıkışta SİLİNMEZ:
  // kayıp, aynı kullanıcı geri döndüğünde onarılamayan bir seri kaybı demek
  // (yeniden tohumlama rozetleri kurtarır, gün geçmişini kurtarmaz).
  watchLedger: {
    key: "watch_progress:ledger:",
    type: TYPES.json,
    default: null,
    scope: "user",
    keepOnLogout: true,
  },
  // İlk içerik aktivasyon damgası. Çıkışta SİLİNMEZ — silinirse kullanıcı geri
  // döndüğünde aynı analytics olayı ikinci kez üretilir ve metrik şişer.
  firstContentAt: {
    key: "analytics/first-content/",
    type: TYPES.string,
    default: null,
    scope: "user",
    keepOnLogout: true,
  },

  // ---- Cihaz düzeyi -------------------------------------------------------
  // Takvime yazılmış etkinliklerin kimlikleri. Kasten uid'siz: kayıt silinirse
  // cihazın takviminde sahipsiz etkinlikler kalır ve bir daha temizlenemez.
  phoneCalendarEvents: {
    key: "phone_calendar_saved_events_v1",
    type: TYPES.json,
    default: null,
  },
};

/* ================================================================== */
/* ÖNBELLEK — yeniden üretilebilir. "Önbelleği temizle" hepsini siler. */
/* ================================================================== */

const cacheKeys = {
  feed: { key: "feed_cache_v1", type: TYPES.json, default: null },
  watchedTvShows: { key: "cache_watchedTvShows", type: TYPES.json, default: null },
  listStatus: {
    key: "list_status_cache_",
    type: TYPES.json,
    default: null,
    scope: "user",
  },
  mediaActivity: {
    key: "media_activity_cache_",
    type: TYPES.json,
    default: null,
    scope: "user",
  },
};

/* ================================================================== */
/* OTURUM — kimlik/akış durumu.                                        */
/* ================================================================== */

// DİKKAT: bu depo çıkışta KOMPLE boşaltılıyor (scope.js → clearUserScope).
// Buraya yalnız oturuma bağlı, kaybı zararsız olan durum konur. Cihaz düzeyi
// kalıcı kayıtlar (onboarding görüldü mü, son giren kullanıcılar) `settings`
// deposunda duruyor.
const sessionKeys = {
  cachedUserId: { key: "cachedUserId", type: TYPES.string, default: null },
  // "Oturumdaki hesap 18 yaşından küçük mü?" — Users/{uid}.birthDate'ten
  // TÜRETİLİR, doğum tarihinin kendisi cihaza yazılmaz. Yetişkin içerik
  // süzgeci her istekte senkron cevap istediği için burada aynalanıyor
  // (bkz. utils/ageGate.js). `session` deposunda olması çıkış temizliğini
  // bedava getiriyor: bayrak sonraki hesaba sızmaz.
  ageRestricted: { key: "ageRestricted", type: TYPES.boolean, default: false },
  googleProfilePendingUid: {
    key: "googleProfilePendingUid",
    type: TYPES.string,
    default: null,
  },
};

function build(group, store) {
  const out = {};
  for (const [name, spec] of Object.entries(group)) {
    out[name] = defineKey(name, { ...spec, store });
  }
  return out;
}

/**
 * Tüm anahtar tanımlayıcıları. Çağrı yerleri `Keys.theme` gibi kullanır:
 *   get(Keys.theme) / set(Keys.theme, "dark")
 *   get(Keys.avatarIndex, { uid })   // scope: "user"
 */
export const Keys = Object.freeze({
  ...build(settingsKeys, "settings"),
  ...build(dataKeys, "data"),
  ...build(cacheKeys, "cache"),
  ...build(sessionKeys, "session"),
});

export const ALL_KEYS = Object.freeze(Object.values(Keys));

/* ================================================================== */
/* DİNAMİK ANAHTAR AİLELERİ                                            */
/* ================================================================== */
//
// Sabit adı olmayan, çalışma anında üreyen anahtarlar (her TMDB isteği için bir
// cache girdisi, her dizi için bir ilerleme defteri). Registry'de tek tek yer
// alamazlar; bunun yerine ÖNEK + depo olarak tanımlanır ki temizlik ve ölçüm
// yine tek yerden yönetilebilsin.

export const Namespaces = Object.freeze({
  /** TMDB/ağ yanıt önbelleği — utils/apiCache.js */
  apiCache: Object.freeze({ store: "cache", prefix: "apicache_" }),
});

export const ALL_NAMESPACES = Object.freeze(Object.values(Namespaces));

/**
 * Kullanıcı kapsamlı bir anahtarın fiziksel adını üretir.
 * @param {object} descriptor Keys.* girdisi
 * @param {string} [uid]
 */
export function physicalKey(descriptor, uid) {
  if (descriptor.scope !== "user") return descriptor.key;
  return `${descriptor.key}${uid || GUEST_SCOPE}`;
}
