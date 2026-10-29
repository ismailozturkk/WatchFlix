// services/import/tmdbResolver.js
//
// Dışa aktarılan film/dizi öğelerini TMDB ile eşleştiren ve
// süre (runtime/minutes), türler (genres), çıkış tarihi gibi
// profil istatistikleri için zorunlu olan zengin verileri çeken çözümleyici.
//
// Dayanıklılık kuralları:
//  • Yalnız KESİN sonuç önbelleğe girer (bulundu / TMDB'de yok). Ağ hatası, 429 ve 5xx
//    geri çekilerek yeniden denenir; yine olmazsa öğe "eşleşmedi" DEĞİL "başarısız"
//    sayılır. Eskiden ağ kopunca her öğe null olarak önbelleğe yazılıp sessizce
//    atlanıyor, aynı oturumda yeniden denemek de işe yaramıyordu.
//  • Arka arkaya çok sayıda başarısızlık = bağlantı yok → iş `network` hatasıyla durur,
//    kullanıcı kaldığı yerden devam eder. 401/403 (anahtar sorunu) hemen durdurur.
//  • Başlık araması İngilizce yapılır (Letterboxd/IMDb başlıkları İngilizce) ve adaylar
//    ad + yıl benzerliğiyle puanlanır; ilk sonucu körü körüne almak yeniden çevrimleri
//    ve aynı adlı filmleri karıştırıyordu. Kayıtta görünen ad/afiş ise ayrıntı çağrısından
//    kullanıcının dilinde gelir.
//  • `include_adult` yazılmaz: yetişkin içerik kuralı utils/tmdbAdultGuard'da merkezî.

import axios from "axios";
import { ImportError } from "./importErrors";
import { classifyHttpError, retryAfterMs, throwIfCancelled, withRetry } from "./importRetry";

const RAW_KEY = process.env.EXPO_PUBLIC_API_KEY || "";
const API_KEY = RAW_KEY && !RAW_KEY.startsWith("Bearer ") ? `Bearer ${RAW_KEY}` : RAW_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const REQUEST_TIMEOUT_MS = 10000;
const SEARCH_LANGUAGE = "en-US";
const DEFAULT_LANGUAGE = "tr-TR";

// Kesin sonuç önbelleği + aynı anda sorulan aynı sorgunun tek isteğe inmesi
const resolveCache = new Map();
const inflight = new Map();

export function clearResolveCache() {
  resolveCache.clear();
  inflight.clear();
}

function cached(key, loader) {
  if (resolveCache.has(key)) return Promise.resolve(resolveCache.get(key));
  if (inflight.has(key)) return inflight.get(key);
  const promise = loader()
    .then((value) => {
      resolveCache.set(key, value);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/**
 * TMDB GET: geçici hatada yeniden dener; 404 → null; 401/403 → `tmdbUnavailable`;
 * tükenen geçici hata → `network`.
 */
async function tmdbGet(path, params, signal) {
  try {
    const res = await withRetry(
      () => axios.get(`${TMDB_BASE}${path}`, {
        params,
        headers: { accept: "application/json", Authorization: API_KEY },
        timeout: REQUEST_TIMEOUT_MS,
      }),
      {
        retries: 3,
        baseMs: 600,
        signal,
        isRetryable: (error) => classifyHttpError(error) === "transient",
        delayFor: (error) => retryAfterMs(error),
      },
    );
    return res?.data ?? null;
  } catch (error) {
    if (error instanceof ImportError) throw error;
    const kind = classifyHttpError(error);
    if (kind === "notFound") return null;
    if (kind === "auth") throw new ImportError("tmdbUnavailable", `TMDB responded ${error?.response?.status}`);
    throw new ImportError("network", error?.message || "TMDB request failed");
  }
}

// ---- Aday seçimi -----------------------------------------------------------

const PUNCTUATION = /[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~’‘“”«»–—…·]+/g;

/** Karşılaştırma için başlık: küçük harf, aksansız, noktalama yerine tek boşluk. */
export const normalizeTitle = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(PUNCTUATION, " ")
    .trim();

const yearOf = (date) => {
  const year = parseInt(String(date || "").slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
};

/** Ad (tam > önek) ve yıl yakınlığına göre aday puanı. */
export function scoreCandidate(candidate, { title, originalTitle, year }) {
  const wanted = [title, originalTitle].map(normalizeTitle).filter(Boolean);
  const names = [candidate?.title, candidate?.name, candidate?.original_title, candidate?.original_name]
    .map(normalizeTitle)
    .filter(Boolean);
  let score = 0;
  if (names.some((name) => wanted.includes(name))) score += 4;
  else if (names.some((name) => wanted.some((want) => name.startsWith(want) || want.startsWith(name)))) score += 1;

  const candidateYear = yearOf(candidate?.release_date || candidate?.first_air_date);
  if (year && candidateYear) {
    const diff = Math.abs(candidateYear - year);
    score += diff === 0 ? 3 : diff === 1 ? 2 : diff === 2 ? 0 : -3;
  }
  return score;
}

/**
 * En iyi aday. `strict`: yıl filtresi düşürülmüş aramada ad da yıl da tutmuyorsa yanlış
 * filmi kaydetmektense eşleşmedi denir.
 */
export function pickBestCandidate(results, query, { strict = false } = {}) {
  const list = (Array.isArray(results) ? results : []).filter((item) => item?.id != null).slice(0, 10);
  if (!list.length) return null;
  const ranked = list
    // TMDB'nin kendi sırası eşitliği bozar (popülerlik/uygunluk).
    .map((candidate, index) => ({ candidate, score: scoreCandidate(candidate, query) - index * 0.01 }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (strict && best.score < 1) return null;
  return best.candidate;
}

// ---- Ayrıntı -----------------------------------------------------------------

function buildDetails(data, mediaType) {
  const genres = (Array.isArray(data.genres) ? data.genres : [])
    .map((g) => g?.name)
    .filter((name) => typeof name === "string" && name.trim().length > 0);

  const runtime = mediaType === "movie" && Number(data.runtime) > 0 ? Number(data.runtime) : null;

  const episodeMinutes =
    mediaType === "tv"
      ? (Array.isArray(data.episode_run_time) && data.episode_run_time.length > 0
          ? Number(data.episode_run_time[0])
          : Number(data.last_episode_to_air?.runtime) || 0)
      : null;

  return {
    id: data.id,
    title: data.title || data.name,
    original_title: data.original_title || data.original_name,
    mediaType,
    poster_path: data.poster_path || null,
    backdrop_path: data.backdrop_path || null,
    release_date: data.release_date || data.first_air_date || null,
    vote_average: typeof data.vote_average === "number" ? data.vote_average : 0,
    overview: data.overview || "",
    minutes: runtime,
    episodeMinutes,
    seasonCount: mediaType === "tv" ? (Number(data.number_of_seasons) || 1) : null,
    episodeCount: mediaType === "tv" ? (Number(data.number_of_episodes) || 1) : null,
    genres,
  };
}

/**
 * Bir içeriğin (film veya dizi) TMDB'den süre, türler ve detay bilgilerini çeker.
 * @param {number|string} id - TMDB ID
 * @param {"movie"|"tv"} mediaType
 * @param {string} language
 * @param {{ signal?: object }} [options]
 */
export function fetchMediaDetails(id, mediaType = "movie", language = DEFAULT_LANGUAGE, { signal } = {}) {
  if (!id) return Promise.resolve(null);
  return cached(`details:${mediaType}:${id}:${language}`, async () => {
    const data = await tmdbGet(`/${mediaType}/${id}`, { language }, signal);
    return data ? buildDetails(data, mediaType) : null;
  });
}

/** Aday + ayrıntı → kayıt biçimi. Görünen ad/afiş kullanıcının dilindeki ayrıntıdan. */
function normalizeMedia(candidate, details, mediaType) {
  return {
    id: candidate.id,
    title: details?.title || candidate.title || candidate.name,
    original_title: details?.original_title || candidate.original_title || candidate.original_name,
    mediaType,
    poster_path: details?.poster_path || candidate.poster_path || null,
    backdrop_path: details?.backdrop_path || candidate.backdrop_path || null,
    release_date: candidate.release_date || candidate.first_air_date || details?.release_date || null,
    vote_average: candidate.vote_average ?? details?.vote_average ?? 0,
    overview: details?.overview || candidate.overview || "",
    minutes: details?.minutes || null,
    episodeMinutes: details?.episodeMinutes || null,
    seasonCount: mediaType === "tv" ? details?.seasonCount || 1 : null,
    episodeCount: mediaType === "tv" ? details?.episodeCount || 1 : null,
    genres: details?.genres || [],
  };
}

/**
 * IMDb ID ile TMDB kaydını bulur ve detaylarıyla birleştirir.
 * @param {string} imdbId - ör. "tt1375666"
 * @param {string} language - "tr-TR" veya "en-US"
 */
export function resolveByImdbId(imdbId, language = DEFAULT_LANGUAGE, { signal } = {}) {
  const id = String(imdbId || "").trim();
  if (!/^tt\d+$/i.test(id)) return Promise.resolve(null);
  return cached(`imdb:${id}:${language}`, async () => {
    const data = await tmdbGet(`/find/${id}`, { external_source: "imdb_id", language }, signal);
    const movie = data?.movie_results?.[0];
    const tv = data?.tv_results?.[0];
    const found = movie || tv;
    if (!found) return null;
    const mediaType = movie ? "movie" : "tv";
    const details = await fetchMediaDetails(found.id, mediaType, language, { signal });
    return normalizeMedia(found, details, mediaType);
  });
}

function searchTitles(mediaType, title, year, signal) {
  const params = { query: title, language: SEARCH_LANGUAGE };
  if (year) {
    if (mediaType === "movie") {
      params.year = year;
      params.primary_release_year = year;
    } else {
      params.first_air_date_year = year;
    }
  }
  return cached(`search:${mediaType}:${title.toLowerCase()}:${year || "any"}`, async () => {
    const data = await tmdbGet(`/search/${mediaType}`, params, signal);
    return Array.isArray(data?.results) ? data.results : [];
  });
}

/**
 * İsim ve Yıl ile TMDB film/dizi kaydını bulur ve detaylarıyla birleştirir.
 * Yıl uyuşmazlıklarına karşı toleranslıdır (Önce Yılla, bulamazsa Yılsız arar).
 * @param {string} title - Başlık
 * @param {number|null} year - Çıkış yılı
 * @param {string} language - kayıtta görünecek dil ("tr-TR", "en-US" …)
 * @param {{ signal?: object, mediaType?: "movie"|"tv", originalTitle?: string }} [options]
 */
export function resolveByTitleYear(title, year = null, language = DEFAULT_LANGUAGE, options = {}) {
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) return Promise.resolve(null);
  const { signal, mediaType: hint, originalTitle } = options;
  const order = hint === "tv" ? ["tv", "movie"] : ["movie", "tv"];
  const query = { title: cleanTitle, originalTitle, year };

  return cached(`title:${order[0]}:${cleanTitle.toLowerCase()}:${year || "any"}:${language}`, async () => {
    for (const mediaType of order) {
      let candidate = pickBestCandidate(await searchTitles(mediaType, cleanTitle, year, signal), query);
      // Yılla bulunamadıysa YILSIZ ara (Letterboxd festival / vizyon yılı farkları)
      if (!candidate && year) {
        candidate = pickBestCandidate(await searchTitles(mediaType, cleanTitle, null, signal), query, { strict: true });
      }
      if (candidate) {
        const details = await fetchMediaDetails(candidate.id, mediaType, language, { signal });
        return normalizeMedia(candidate, details, mediaType);
      }
    }
    return null;
  });
}

/** Tek öğe: önce IMDb kimliği (kesin), sonra başlık + yıl. */
export async function resolveImportItem(item, { language = DEFAULT_LANGUAGE, signal } = {}) {
  throwIfCancelled(signal);
  let media = null;
  if (item?.imdbId) media = await resolveByImdbId(item.imdbId, language, { signal });
  if (!media && item?.title) {
    media = await resolveByTitleYear(item.title, item.year, language, {
      signal,
      mediaType: item.mediaType,
      originalTitle: item.originalTitle,
    });
  }
  return media;
}

/** Çözülen TMDB kaydına dosyadan gelen kullanıcı verisini (puan, tarih, inceleme) ekler. */
export function attachSourceData(media, item) {
  // Fallback: Eğer CSV'den gelen süre varsa ve TMDB'de yoksa CSV süresini kullan
  const minutes = media.minutes || (Number(item.rawMinutes) > 0 ? Number(item.rawMinutes) : null);
  const genres = (media.genres && media.genres.length > 0)
    ? media.genres
    : (Array.isArray(item.rawGenres) ? item.rawGenres : []);

  return {
    ...media,
    minutes,
    genres,
    userRating: item.rating ?? null,
    watchedDate: item.watchedDate ?? null,
    dateAdded: item.dateAdded ?? null,
    isRewatch: item.isRewatch ?? false,
    watchEvents: Array.isArray(item.watchEvents) ? item.watchEvents : null,
    watchDates: Array.isArray(item.watchDates) ? item.watchDates : null,
    review: item.review ?? null,
    targetList: item.targetList ?? "watchedMovies",
    customListName: item.customListName ?? null,
    importSource: item.importSource ?? null,
    sourceTitle: item.title || null,
    sourceYear: item.year ?? null,
  };
}

/**
 * Toplu öğe listesini eşzamanlılık kontrollü kuyrukla çözümler ve her öğenin sonucunu
 * ayrı raporlar.
 * @param {Array<Object>} items
 * @param {{ language?: string, concurrency?: number, signal?: object,
 *   maxConsecutiveFailures?: number,
 *   onProgress?: (done:number, total:number, detail:{ item:Object, media:Object|null,
 *     status:"matched"|"unmatched"|"failed", index:number })=>void }} options
 * @returns {Promise<{ resolved: Object[], unmatched: Object[], failed: Object[] }>}
 *   Sonuçlar girdi SIRASINDADIR. Durdurulursa / bağlantı koparsa fırlatılan hatanın
 *   `partial` alanı o ana kadarki sonuçları taşır.
 */
export async function resolveImportItems(items, options = {}) {
  const {
    language = DEFAULT_LANGUAGE,
    concurrency = 5,
    signal,
    onProgress,
    maxConsecutiveFailures = 6,
  } = options;
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const outcomes = new Array(total);
  let next = 0;
  let done = 0;
  let consecutiveFailures = 0;
  let fatal = null;

  async function worker() {
    while (!fatal && next < total) {
      if (signal?.cancelled) {
        fatal = fatal || new ImportError("cancelled");
        break;
      }
      const index = next++;
      const item = list[index];
      let media = null;
      let status;
      try {
        media = await resolveImportItem(item, { language, signal });
        status = media ? "matched" : "unmatched";
        consecutiveFailures = 0;
      } catch (error) {
        if (error?.code === "cancelled" || error?.code === "tmdbUnavailable") {
          fatal = fatal || error;
          break;
        }
        status = "failed";
        consecutiveFailures += 1;
        if (consecutiveFailures >= maxConsecutiveFailures) {
          fatal = fatal || new ImportError("network", "Too many consecutive TMDB failures.");
        }
      }
      outcomes[index] = { status, item, media: media ? attachSourceData(media, item) : null };
      done += 1;
      onProgress?.(done, total, { item, media: outcomes[index].media, status, index });
    }
  }

  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), total) }, () => worker()));

  const resolved = [];
  const unmatched = [];
  const failed = [];
  outcomes.forEach((outcome) => {
    if (!outcome) return;
    if (outcome.status === "matched") resolved.push(outcome.media);
    else if (outcome.status === "unmatched") unmatched.push(outcome.item);
    else failed.push(outcome.item);
  });

  if (fatal) {
    fatal.partial = { resolved, unmatched, failed, processed: done };
    throw fatal;
  }
  return { resolved, unmatched, failed };
}

/**
 * Eski API: yalnız eşleşenleri döndürür.
 * @param {Array<Object>} items
 * @param {Object|Function} optionsOrProgress - { onProgress, concurrency, language } veya direkt onProgress callback
 */
export async function resolveBatchMedia(items, optionsOrProgress = {}) {
  const options = typeof optionsOrProgress === "function" ? { onProgress: optionsOrProgress } : optionsOrProgress || {};
  const { resolved } = await resolveImportItems(items, {
    ...options,
    onProgress: options.onProgress
      ? (done, total, { item }) => options.onProgress(done, total, item.title || item.imdbId || "")
      : undefined,
  });
  return resolved;
}
