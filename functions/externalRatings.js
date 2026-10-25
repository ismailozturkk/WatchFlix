"use strict";

// functions/externalRatings.js
//
// SAF (bağımsız) yardımcılar — OMDb'den IMDb / Rotten Tomatoes / Metascore puanlarını getiren
// `getExternalRatings` callable'ının mantığı. Firebase'den bağımsız → node:test ile test edilir
// (externalRatings.test.js).
//
// NEDEN SUNUCUDA: OMDb API anahtarı eskiden istemciye (TvGraphDetailScreen) düz metin gömülüydü;
// uygulama paketinden herkes çıkarabilirdi. Anahtar artık yalnız Secret Manager'da (OMDB_API_KEY) durur,
// istemci bu callable'ı çağırır. Girdi sıkı doğrulanır: istemci OMDb'ye keyfi sorgu gönderemez
// (yalnız IMDb kimliği + isteğe bağlı sezon) — anahtarı başka amaçla kullandıramaz.

const IMDB_ID = /^tt\d{6,10}$/;
const MAX_SEASON = 99;

/** İstek gövdesini doğrular. @returns {{ok:true, kind:"title"|"season", imdbId:string, season:number|null}|{ok:false, reason:string}} */
function validateRatingsRequest(data) {
  const imdbId = typeof data?.imdbId === "string" ? data.imdbId.trim() : "";
  if (!IMDB_ID.test(imdbId)) return { ok: false, reason: "invalid-imdb-id" };
  if (data.season === undefined || data.season === null) {
    return { ok: true, kind: "title", imdbId, season: null };
  }
  const season = Number(data.season);
  if (!Number.isInteger(season) || season < 1 || season > MAX_SEASON) {
    return { ok: false, reason: "invalid-season" };
  }
  return { ok: true, kind: "season", imdbId, season };
}

/** OMDb URL'i. Anahtar yalnız burada, sunucuda eklenir. */
function buildOmdbUrl({ imdbId, season = null, apiKey }) {
  const params = new URLSearchParams({ i: imdbId, apikey: apiKey });
  if (season !== null) params.set("Season", String(season));
  return `https://www.omdbapi.com/?${params.toString()}`;
}

const numberOrNull = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text || text === "N/A") return null;
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * OMDb başlık yanıtı → { imdbRating (0–10), imdbVotes, metascore (0–100), rottenTomatoes (0–100) }.
 * Yanıt başarısızsa (`Response !== "True"`) null döner.
 */
function parseTitleResponse(json) {
  if (!json || json.Response !== "True") return null;
  const rt = (Array.isArray(json.Ratings) ? json.Ratings : []).find((r) => r?.Source === "Rotten Tomatoes");
  return {
    imdbRating: numberOrNull(json.imdbRating),
    imdbVotes: numberOrNull(json.imdbVotes),
    metascore: numberOrNull(json.Metascore),
    rottenTomatoes: rt ? numberOrNull(String(rt.Value).replace("%", "")) : null,
  };
}

/** OMDb sezon yanıtı → [{ episode, imdbRating }]. Başarısızsa null. */
function parseSeasonResponse(json) {
  if (!json || json.Response !== "True" || !Array.isArray(json.Episodes)) return null;
  return json.Episodes.map((entry) => ({
    episode: numberOrNull(entry?.Episode),
    imdbRating: numberOrNull(entry?.imdbRating),
  })).filter((entry) => entry.episode !== null);
}

/** OMDb'nin kota hatası ("Request limit reached!") mı? */
const isQuotaResponse = (json) => /limit/i.test(String(json?.Error || ""));

/**
 * OMDb'nin KESİN "yok" cevabı mı? ("Movie not found!", "Series or season not found!",
 * "Incorrect IMDb ID.") Yalnız bu önbelleğe "bulunamadı" olarak girer; geçersiz anahtar,
 * "Error getting data." ya da HTTP hatası geçicidir ve 12–24 saat sabitlenmemeli.
 */
const isNotFoundResponse = (json) =>
  json?.Response === "False" && /not found|incorrect imdb id/i.test(String(json?.Error || ""));

/** Basit TTL önbellek (örnek içi). `now` enjekte edilebilir (test). */
function createTtlCache({ ttlMs, maxEntries = 500, now = Date.now } = {}) {
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (now() - hit.at > ttlMs) {
        map.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value) {
      if (map.size >= maxEntries) map.delete(map.keys().next().value); // en eski
      map.set(key, { value, at: now() });
    },
    get size() {
      return map.size;
    },
  };
}

/**
 * Kullanıcı başına kayan pencere sınırlayıcı (örnek içi). Dağıtık değildir: birden çok örnekte sınır
 * örnek sayısıyla çarpılır — anahtar kötüye kullanımını CAYDIRMAK için, kesin kota için değil.
 * @returns {(key: string) => boolean} true = izin
 */
function createRateLimiter({ limit, windowMs, now = Date.now } = {}) {
  const hits = new Map();
  return (key) => {
    const t = now();
    const recent = (hits.get(key) || []).filter((at) => t - at < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > 5000) hits.delete(hits.keys().next().value);
    return true;
  };
}

module.exports = {
  IMDB_ID,
  MAX_SEASON,
  buildOmdbUrl,
  createRateLimiter,
  createTtlCache,
  isNotFoundResponse,
  isQuotaResponse,
  parseSeasonResponse,
  parseTitleResponse,
  validateRatingsRequest,
};
