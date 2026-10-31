// services/externalRatings.js
//
// Harici puanlar (IMDb, Rotten Tomatoes, Metascore): `getExternalRatings` Cloud Function'ını çağırır
// (functions/index.js). OMDb anahtarı istemcide DEĞİL; sunucuda. Biçim yardımcıları utils/externalRatings.js.
//
// ASLA FIRLATMAZ: ağ / oturum / kota hatasında `null` döner, çağıran TMDB puanına düşer (ekran puansız kalmaz).
// Önbellek iki katman: oturum içi Map + cihazda 7 gün (puanlar yavaş değişir; detay sayfası puanı
// anında gösterir, Functions/OMDb çağrısı azalır). Hata sonucu önbelleğe GİRMEZ — sonra yeniden denenir.

const titleCache = new Map();
const seasonCache = new Map();

export const RATINGS_CACHE_NS = "externalRatings";
export const RATINGS_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// Lazy require: saf JS testlerinde dosya sistemi modülü yüklenmesin; yüklenemezse yalnız Map kalır.
function persistentStore() {
  try {
    // eslint-disable-next-line global-require
    return require("../utils/cacheStore");
  } catch {
    return null;
  }
}

async function call(payload) {
  // Lazy require: bu modül saf JS testlerinde firebase'i yüklemesin (services/geminiService ile aynı kalıp).
  // eslint-disable-next-line global-require
  const { fns } = require("../firebase");
  // eslint-disable-next-line global-require
  const { httpsCallable } = require("firebase/functions");
  const { data } = await httpsCallable(fns, "getExternalRatings")(payload);
  return data;
}

async function cached(map, key, payload) {
  if (map.has(key)) return map.get(key);
  const store = persistentStore();
  const saved = store?.getJSON(RATINGS_CACHE_NS, key, { maxAge: RATINGS_CACHE_MAX_AGE });
  if (saved) {
    map.set(key, saved);
    return saved;
  }
  try {
    const data = await call(payload);
    // Yalnız kesin sonuç saklanır: bulunamadı da kesin; kota / ulaşılamıyor geçici.
    if (data?.found || data?.reason === "not-found") {
      map.set(key, data);
      store?.setJSON(RATINGS_CACHE_NS, key, data);
    }
    return data ?? null;
  } catch {
    return null;
  }
}

/** @returns {Promise<{found:boolean, imdbRating?:number|null, imdbVotes?:number|null, metascore?:number|null, rottenTomatoes?:number|null}|null>} */
export const fetchTitleRatings = (imdbId) =>
  imdbId ? cached(titleCache, imdbId, { imdbId }) : Promise.resolve(null);

/** @returns {Promise<{found:boolean, episodes?:Array<{episode:number, imdbRating:number|null}>}|null>} */
export const fetchSeasonRatings = (imdbId, season) =>
  imdbId && season ? cached(seasonCache, `${imdbId}:${season}`, { imdbId, season }) : Promise.resolve(null);

/** Testler için. */
export function __resetExternalRatingsCache() {
  titleCache.clear();
  seasonCache.clear();
  persistentStore()?.clearNamespace(RATINGS_CACHE_NS);
}
