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
//
// MMKV GEÇİŞİ — kaldırılan yarış: eskiden modül seviyesinde bir ayna vardı ve
// `hydrateAutoDataCacheSetting()` ile AÇILIŞTA ASENKRON dolduruluyordu. Hidrasyon
// bitmeden yapılan her cache yazması ayarı `false` görüyordu; yani "Verileri
// indir" açık olan kullanıcıda bile açılıştaki ilk istekler diske yazılmıyordu.
// MMKV senkron okuduğu için ayna artık ilk erişimde anında doluyor ve anahtar
// değiştiğinde aboneliğle tazeleniyor — hidrasyon adımı tamamen kalktı.

import { Keys, get, set as write, subscribe } from "../services/storage";

export const AUTO_DATA_CACHE_KEY = Keys.autoDataCache.key;
export const DATA_TYPES_KEY = Keys.dataCacheTypes.key;

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

// Okuma aynası. `null` = henüz okunmadı; ilk erişimde MMKV'den SENKRON dolar.
// Anahtar herhangi bir yerden değişirse abonelik aynayı düşürür.
let mirror = null;
let wired = false;

const refresh = () => {
  mirror = {
    enabled: get(Keys.autoDataCache),
    types: normalizeDataTypes(get(Keys.dataCacheTypes)),
  };
  return mirror;
};

const current = () => {
  if (!wired) {
    wired = true;
    const invalidate = () => {
      mirror = null;
    };
    subscribe(Keys.autoDataCache, invalidate);
    subscribe(Keys.dataCacheTypes, invalidate);
  }
  return mirror || refresh();
};

export const getAutoDataCacheEnabled = () => current().enabled;

export const setAutoDataCacheEnabled = (enabled) => {
  write(Keys.autoDataCache, !!enabled);
  mirror = null;
};

export const getDataTypes = () => current().types;

export const setDataTypes = (next) => {
  write(Keys.dataCacheTypes, next === null || next === undefined ? null : normalizeDataTypes(next));
  mirror = null;
};

/** Ana anahtar + tür birlikte açık mı? Tür verilmezse sadece ana anahtar. */
export const isDataTypeEnabled = (category) => {
  const { enabled, types } = current();
  return enabled && (!category || types[category] !== false);
};

/**
 * Bu veri diske yazılabilir mi?
 * @param {object} [opts]
 * @param {boolean} [opts.force] Tür filtresini atlar — ana anahtarı ATLAMAZ.
 * @param {string}  [opts.category] DATA_CACHE_CATEGORIES üyesi
 */
export const shouldPersistInternetData = ({ force = false, category } = {}) => {
  const { enabled, types } = current();
  if (!enabled) return false;
  if (force) return true;
  return !category || types[category] !== false;
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
