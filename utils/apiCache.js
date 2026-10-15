import {
  categoryForCacheKey,
  shouldPersistInternetData,
} from "./dataCacheSettings";
import { getIsOnline } from "../context/ConnectivityContext";
import { Namespaces, createNamespace } from "../services/storage";
import { trackTmdbRequest } from "../services/usageTrackerService";

/** TTL constants (milliseconds) */
export const TTL = {
  DAILY:       24 * 60 * 60 * 1000,       // 24 hours — referans sabiti
  TREND:       24 * 60 * 60 * 1000,       // 24 hours (eskiden 1 saat)
  NOW_PLAYING: 24 * 60 * 60 * 1000,       // 24 hours (eskiden 6 saat)
  PROVIDERS:   24 * 60 * 60 * 1000,       // 24 hours
  GENRES:       7 * 24 * 60 * 60 * 1000,  // 7 days
  OSCAR:        7 * 24 * 60 * 60 * 1000,  // 7 days
  EMMY:         7 * 24 * 60 * 60 * 1000,  // 7 days
  COLLECTION:   7 * 24 * 60 * 60 * 1000,  // 7 days
  CALENDAR:    24 * 60 * 60 * 1000,       // 24 hours (eskiden 1 saat)
};

// Fiziksel anahtar öneki ("apicache_") artık burada DEĞİL, registry'de tanımlı.
// Eskiden aynı önek bu dosyada, SplashPosterWave'de ve cacheInspector'da ayrı
// ayrı yazılıydı; biri değişse diğerleri sessizce ıskalardı.
const store = createNamespace(Namespaces.apiCache);

// Oturum içi ayrıştırma önbelleği. MMKV okuması ucuz ama büyük TMDB listelerinde
// JSON.parse değil — aynı anahtar bir oturumda onlarca kez okunuyor.
const mem = new Map();

/**
 * Returns cached data if the entry exists and is within ttlMs.
 * Checks memory first, then MMKV.
 *
 * ÇEVRİMDIŞI: TTL yok sayılır ve bayat kayıt silinmez — "Verileri indir" ile
 * indirilen film/dizi içeriği internet yokken TTL dolmuş olsa da kullanılabilsin.
 *
 * MMKV GEÇİŞİ: senkron olduğu için artık Promise dönmesi şart değil; ancak
 * çağrı yerlerinin tamamı `await` ile kullanıyor ve `await` senkron değeri de
 * kabul ediyor. İmza korunarak çağrı yerleri olduğu gibi bırakıldı.
 * @returns {any|null}
 */
export const getCachedValue = (key, ttlMs) => {
  const now = Date.now();
  const offline = !getIsOnline();

  const hit = mem.get(key);
  if (hit) {
    if (offline || now - hit.ts < ttlMs) {
      trackTmdbRequest(key, true);
      return hit.data;
    }
    mem.delete(key);
  }

  const entry = store.getJSON(key);
  if (!entry || entry.ts === undefined) return null;
  if (offline || now - entry.ts < ttlMs) {
    mem.set(key, entry);
    trackTmdbRequest(key, true);
    return entry.data;
  }
  store.remove(key);
  return null;
};

/* ────────────────────────────────────────────────────────────────────────────
 * BAYAT GÖSTER, ARKA PLANDA TAZELE (stale-while-revalidate)
 *
 * `getCachedValue` TTL dolunca null döner ve kaydı SİLER — çağıran iskelet
 * gösterip ağı beklemek zorunda kalır. Trend TTL'i 1 saat olduğu için bu
 * pratikte her açılış demekti; oysa dünkü trend listesi bir kare boyunca
 * göstermek için fazlasıyla iyi.
 *
 * Bu yol kaydı SİLMEZ ve TTL dolmuş olsa da veriyi döner; "taze mi?" bilgisini
 * çağırana bırakır. Çağıran veriyi hemen çizer, tazelemeyi arka planda yapar ve
 * yalnız içerik gerçekten değiştiyse state'i günceller (bkz. utils/sameData.js).
 *
 * `getCachedValue` bilerek olduğu gibi bırakıldı: 17 çağrı yeri ona dayanıyor.
 * ──────────────────────────────────────────────────────────────────────────── */

const EMPTY_SWR = Object.freeze({ data: null, fresh: false, ts: 0, age: Infinity });

/**
 * @param {string} key
 * @param {{maxAge?: number}} [options] Bu yaştan eskiyse `fresh:false` döner.
 * @returns {{data: any, fresh: boolean, ts: number, age: number}}
 */
export const getSwr = (key, { maxAge = 0 } = {}) => {
  const entry = mem.get(key) ?? store.getJSON(key);
  if (!entry || entry.ts === undefined) return EMPTY_SWR;

  mem.set(key, entry);
  const age = Date.now() - entry.ts;
  const fresh = !getIsOnline() || age < maxAge;
  if (entry.data) {
    trackTmdbRequest(key, true);
  }
  return { data: entry.data, fresh, ts: entry.ts, age };
};

/**
 * Ray tohumlama yardımcısı.
 *
 * Aynı önbellek ailesine iki farklı biçimde yazılıyor: `loadPage`
 * `{results, total_pages}` yazarken `fetchSeriesTrends` düz dizi yazıyor.
 * Tohumlayan tarafın bunu bilmesi gerekmesin diye normalleştiriyoruz.
 *
 * @returns {{list: any[], totalPages: number, fresh: boolean, hasCache: boolean}}
 */
export const seedList = (key, { maxAge = 0 } = {}) => {
  const { data, fresh } = getSwr(key, { maxAge });
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
      ? data.results
      : null;
  if (!list) return { list: [], totalPages: 1, fresh: false, hasCache: false };
  return {
    list,
    totalPages: (!Array.isArray(data) && data?.total_pages) || 1,
    fresh,
    hasCache: true,
  };
};

/**
 * Writes data to memory and MMKV.
 * Fire-and-forget — never throws.
 */
export const setCachedValue = (
  key,
  data,
  { force = false, startupSnapshot = false } = {},
) => {
  trackTmdbRequest(key, false);
  const entry = { data, ts: Date.now() };
  mem.set(key, entry);

  // Ana ekranın ilk görünür rayları küçük bir "açılış snapshot'ı"dır. Bunlar
  // çevrimdışı arşiv ayarından bağımsız tutulur: amaç bütün kataloğu indirmek
  // değil, uygulama yeniden açıldığında boş ekran/iskelet yerine son görüleni
  // ilk karede çizmektir. Diğer tüm TMDB kayıtları kullanıcının veri indirme
  // tercihine bağlı kalır.
  if (
    !startupSnapshot &&
    !shouldPersistInternetData({ force, category: categoryForCacheKey(key) })
  )
    return;
  store.setJSON(key, entry);
};

/**
 * Belirli bir önekteki tüm apicache girdilerini (bellek + MMKV) siler.
 * prefix "" verilirse tüm apicache temizlenir. Örn: clearCachedByPrefix("movie_").
 */
export const clearCachedByPrefix = (prefix = "") => {
  for (const k of Array.from(mem.keys())) {
    if (k.startsWith(prefix)) mem.delete(k);
  }
  store.clear(prefix);
};

/** Bu ailedeki anahtarlar — SplashPosterWave gibi tarayıcılar için. */
export const cachedKeys = (prefix = "") => store.keys(prefix);

/** Ham girdiyi ({ data, ts }) TTL uygulamadan döner. */
export const rawCachedEntry = (key) => mem.get(key) ?? store.getJSON(key) ?? null;

/** Önbellek ailesinin yaklaşık disk boyutu (bayt). */
export const cachedByteSize = (prefix = "") => store.byteSize(prefix);
