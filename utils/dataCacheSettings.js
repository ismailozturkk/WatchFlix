// utils/dataCacheSettings.js
//
// "Verileri indir" (çevrimdışı kullanım) ayarının TEK kaynağı.
//
// İki katman var:
//   1) ANA ANAHTAR (autoDownloadData) — kapalıysa uygulama internetten gelen
//      HİÇBİR veriyi/görseli kalıcı olarak diske yazmaz; manuel "Verileri indir"
//      de çalışmaz. Ekranlar yine çalışır, sadece kalıcı kopya tutulmaz.
//   2) VERİ TÜRLERİ (autoDownloadDataTypes) — ana anahtar açıkken hangi
//      türlerin indirileceği. Kapalı tür ne otomatik cache'lenir ne de manuel
//      indirmeye dahil edilir.
//
// React'e bağımlı değildir: cache yazan katmanlar (apiCache, cachedRead,
// axiosDataCache, context'ler, dataDownloader) senkron olarak buradan okur.
// AppSettingsContext ayarı değiştirdiğinde buradaki aynayı da günceller.

import AsyncStorage from "@react-native-async-storage/async-storage";

export const AUTO_DATA_CACHE_KEY = "autoDownloadData";
export const DATA_TYPES_KEY = "autoDownloadDataTypes";

/**
 * İndirilebilir veri türleri. `services/cacheInspector.js` kategorileriyle
 * (Önbellek ekranı) aynı adlandırma kullanılır ki kullanıcı neyi seçtiyse
 * önbellekte de aynı isimle görsün.
 */
export const DATA_CACHE_CATEGORIES = Object.freeze([
  "profile",
  "lists",
  "reminders",
  "notes",
  "posts",
  "activity",
  "movieContent",
  "tvContent",
  "images",
]);

export const DEFAULT_DATA_TYPES = Object.freeze(
  Object.fromEntries(DATA_CACHE_CATEGORIES.map((id) => [id, true])),
);

/** Bilinmeyen anahtarları eler, eksikleri varsayılana (açık) tamamlar. */
export const normalizeDataTypes = (raw) => {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const id of DATA_CACHE_CATEGORIES) out[id] = src[id] !== false;
  return out;
};

let autoDataCacheEnabled = false;
let dataTypes = { ...DEFAULT_DATA_TYPES };

export const getAutoDataCacheEnabled = () => autoDataCacheEnabled;

export const setAutoDataCacheEnabled = (enabled) => {
  autoDataCacheEnabled = !!enabled;
};

export const getDataTypes = () => dataTypes;

export const setDataTypes = (next) => {
  dataTypes = normalizeDataTypes(next);
};

/** Ana anahtar + tür birlikte açık mı? Tür verilmezse sadece ana anahtar. */
export const isDataTypeEnabled = (category) =>
  autoDataCacheEnabled && (!category || dataTypes[category] !== false);

export const hydrateAutoDataCacheSetting = async () => {
  try {
    const [[, rawEnabled], [, rawTypes]] = await AsyncStorage.multiGet([
      AUTO_DATA_CACHE_KEY,
      DATA_TYPES_KEY,
    ]);
    setAutoDataCacheEnabled(rawEnabled === "true");
    try {
      setDataTypes(rawTypes ? JSON.parse(rawTypes) : null);
    } catch {
      setDataTypes(null); // bozuk kayıt → varsayılan (hepsi açık)
    }
    return autoDataCacheEnabled;
  } catch {
    setAutoDataCacheEnabled(false);
    setDataTypes(null);
    return false;
  }
};

/**
 * Bu veri diske yazılabilir mi?
 * @param {object} [opts]
 * @param {boolean} [opts.force] Tür filtresini atlar — ana anahtarı ATLAMAZ.
 * @param {string}  [opts.category] DATA_CACHE_CATEGORIES üyesi
 */
export const shouldPersistInternetData = ({ force = false, category } = {}) => {
  if (!autoDataCacheEnabled) return false;
  if (force) return true;
  return !category || dataTypes[category] !== false;
};

// ── Genel cache katmanlarını kategoriye eşleyen yardımcılar ─────────────────
// apiCache/axiosDataCache/cachedRead tür bilgisi taşımaz; kategoriyi anahtar,
// URL ya da namespace'ten türetiriz. Eşleşme yoksa null → sadece ana anahtar.

/** `apicache_` anahtarı → kategori (movie_bests_…, tv_trends_…). */
export const categoryForCacheKey = (key) => {
  const k = String(key || "");
  if (k.startsWith("movie_")) return "movieContent";
  if (k.startsWith("tv_")) return "tvContent";
  return null;
};

/** TMDB URL'i → kategori (…/movie… → film, …/tv… → dizi). */
export const categoryForTmdbUrl = (url) => {
  const u = String(url || "");
  if (!u.includes("themoviedb.org")) return null;
  if (/\/tv(\/|\?|$)/.test(u)) return "tvContent";
  if (/\/movie(\/|\?|$)/.test(u)) return "movieContent";
  return null;
};

/** cacheStore namespace'i → kategori. */
export const categoryForNamespace = (ns) => {
  switch (ns) {
    case "profile":
    case "lists":
    case "reminders":
    case "notes":
    case "activity":
      return ns;
    default:
      return null;
  }
};
