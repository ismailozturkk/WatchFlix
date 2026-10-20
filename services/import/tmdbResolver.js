// services/import/tmdbResolver.js
//
// Dışa aktarılan film/dizi öğelerini TMDB ile eşleştiren ve
// süre (runtime/minutes), türler (genres), çıkış tarihi gibi
// profil istatistikleri için zorunlu olan zengin verileri çeken yüksek performanslı çözümleyici.

import axios from "axios";

const RAW_KEY = process.env.EXPO_PUBLIC_API_KEY || "";
const API_KEY = RAW_KEY && !RAW_KEY.startsWith("Bearer ") ? `Bearer ${RAW_KEY}` : RAW_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

// Tekrar eden sorguları yakalayan hafıza önbelleği
const resolveCache = new Map();

/**
 * HTTP isteğini 429 (rate limit) durumunda otomatik tekrar dener.
 */
async function fetchWithRetry(url, config, retries = 2) {
  try {
    return await axios.get(url, config);
  } catch (err) {
    if (retries > 0 && err.response?.status === 429) {
      await new Promise((r) => setTimeout(r, 600));
      return fetchWithRetry(url, config, retries - 1);
    }
    throw err;
  }
}

/**
 * Bir içeriğin (film veya dizi) TMDB'den süre, türler ve detay bilgilerini çeker.
 * @param {number|string} id - TMDB ID
 * @param {"movie"|"tv"} mediaType
 * @param {string} language
 */
export async function fetchMediaDetails(id, mediaType = "movie", language = "tr-TR") {
  if (!id) return null;
  const cacheKey = `details_${mediaType}_${id}_${language}`;
  if (resolveCache.has(cacheKey)) return resolveCache.get(cacheKey);

  try {
    const res = await fetchWithRetry(`${TMDB_BASE}/${mediaType}/${id}`, {
      params: { language },
      headers: { accept: "application/json", Authorization: API_KEY },
      timeout: 8000,
    });

    const data = res.data;
    if (!data) return null;

    const genres = (Array.isArray(data.genres) ? data.genres : [])
      .map((g) => g?.name)
      .filter((name) => typeof name === "string" && name.trim().length > 0);

    const runtime =
      mediaType === "movie"
        ? (Number(data.runtime) > 0 ? Number(data.runtime) : null)
        : null;

    const episodeMinutes =
      mediaType === "tv"
        ? (Array.isArray(data.episode_run_time) && data.episode_run_time.length > 0
            ? Number(data.episode_run_time[0])
            : Number(data.last_episode_to_air?.runtime) || 0)
        : null;

    const details = {
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

    resolveCache.set(cacheKey, details);
    return details;
  } catch (e) {
    resolveCache.set(cacheKey, null);
    return null;
  }
}

/**
 * IMDb ID ile TMDB kaydını bulur ve detaylarıyla birleştirir.
 * @param {string} imdbId - ör. "tt1375666"
 * @param {string} language - "tr-TR" veya "en-US"
 */
export async function resolveByImdbId(imdbId, language = "tr-TR") {
  if (!imdbId) return null;
  const cacheKey = `imdb_${imdbId}_${language}`;
  if (resolveCache.has(cacheKey)) return resolveCache.get(cacheKey);

  try {
    const res = await fetchWithRetry(`${TMDB_BASE}/find/${imdbId}`, {
      params: { external_source: "imdb_id", language },
      headers: { accept: "application/json", Authorization: API_KEY },
      timeout: 8000,
    });

    const data = res.data;
    const movie = data.movie_results?.[0];
    const tv = data.tv_results?.[0];
    const foundItem = movie || tv;

    if (foundItem) {
      const mediaType = movie ? "movie" : "tv";
      const details = await fetchMediaDetails(foundItem.id, mediaType, language);

      const normalized = {
        id: foundItem.id,
        title: foundItem.title || foundItem.name,
        original_title: foundItem.original_title || foundItem.original_name,
        mediaType,
        poster_path: foundItem.poster_path || details?.poster_path || null,
        backdrop_path: foundItem.backdrop_path || details?.backdrop_path || null,
        release_date: foundItem.release_date || foundItem.first_air_date || details?.release_date || null,
        vote_average: foundItem.vote_average ?? details?.vote_average ?? 0,
        overview: foundItem.overview || details?.overview || "",
        minutes: details?.minutes || null,
        episodeMinutes: details?.episodeMinutes || null,
        seasonCount: details?.seasonCount || null,
        episodeCount: details?.episodeCount || null,
        genres: details?.genres || [],
      };

      resolveCache.set(cacheKey, normalized);
      return normalized;
    }
  } catch (e) {
    // Hata durumunda sessizce null dön
  }

  resolveCache.set(cacheKey, null);
  return null;
}

/**
 * İsim ve Yıl ile TMDB film/dizi kaydını bulur ve detaylarıyla birleştirir.
 * Yıl uyuşmazlıklarına karşı toleranslıdır (Önce Yılla, bulamazsa Yılsız arar).
 * @param {string} title - Başlık
 * @param {number|null} year - Çıkış yılı
 * @param {string} language - "tr-TR" veya "en-US"
 */
export async function resolveByTitleYear(title, year = null, language = "tr-TR") {
  if (!title) return null;
  const cleanTitle = title.trim();
  const cacheKey = `title_${cleanTitle.toLowerCase()}_${year || "any"}_${language}`;
  if (resolveCache.has(cacheKey)) return resolveCache.get(cacheKey);

  try {
    // 1. ADIM: Film Ara (Başlık + Yıl)
    const params = {
      query: cleanTitle,
      language,
      include_adult: false,
    };
    if (year) {
      params.year = year;
      params.primary_release_year = year;
    }

    let res = await fetchWithRetry(`${TMDB_BASE}/search/movie`, {
      params,
      headers: { accept: "application/json", Authorization: API_KEY },
      timeout: 8000,
    });

    let results = res.data?.results;

    // 2. ADIM: Yılla bulunamadıysa YILSIZ film ara (Letterboxd festival çıkış yılı farkları için)
    if ((!results || results.length === 0) && year) {
      const fallbackParams = { query: cleanTitle, language, include_adult: false };
      const fallbackRes = await fetchWithRetry(`${TMDB_BASE}/search/movie`, {
        params: fallbackParams,
        headers: { accept: "application/json", Authorization: API_KEY },
        timeout: 8000,
      });
      results = fallbackRes.data?.results;
    }

    if (results && results.length > 0) {
      const item = results[0];
      const details = await fetchMediaDetails(item.id, "movie", language);

      const normalized = {
        id: item.id,
        title: item.title,
        original_title: item.original_title,
        mediaType: "movie",
        poster_path: item.poster_path || details?.poster_path || null,
        backdrop_path: item.backdrop_path || details?.backdrop_path || null,
        release_date: item.release_date || details?.release_date || null,
        vote_average: item.vote_average ?? details?.vote_average ?? 0,
        overview: item.overview || details?.overview || "",
        minutes: details?.minutes || null,
        episodeMinutes: null,
        seasonCount: null,
        episodeCount: null,
        genres: details?.genres || [],
      };

      resolveCache.set(cacheKey, normalized);
      return normalized;
    }

    // 3. ADIM: Filmde bulunamazsa Dizi Ara (Mini-diziler veya TV şovları için)
    const tvRes = await fetchWithRetry(`${TMDB_BASE}/search/tv`, {
      params: { query: cleanTitle, language, include_adult: false, ...(year ? { first_air_date_year: year } : {}) },
      headers: { accept: "application/json", Authorization: API_KEY },
      timeout: 8000,
    });

    const tvResults = tvRes.data?.results;
    if (tvResults && tvResults.length > 0) {
      const item = tvResults[0];
      const details = await fetchMediaDetails(item.id, "tv", language);

      const normalized = {
        id: item.id,
        title: item.name,
        original_title: item.original_name,
        mediaType: "tv",
        poster_path: item.poster_path || details?.poster_path || null,
        backdrop_path: item.backdrop_path || details?.backdrop_path || null,
        release_date: item.first_air_date || details?.release_date || null,
        vote_average: item.vote_average ?? details?.vote_average ?? 0,
        overview: item.overview || details?.overview || "",
        minutes: null,
        episodeMinutes: details?.episodeMinutes || null,
        seasonCount: details?.seasonCount || 1,
        episodeCount: details?.episodeCount || 1,
        genres: details?.genres || [],
      };

      resolveCache.set(cacheKey, normalized);
      return normalized;
    }
  } catch (e) {
    // Hata durumunda sessizce null dön
  }

  resolveCache.set(cacheKey, null);
  return null;
}

/**
 * Toplu öğe listesini eşzamanlılık kontrollü ve kuyruk yapısıyla çözümler.
 * @param {Array<Object>} items
 * @param {Object|Function} optionsOrProgress - { onProgress, concurrency } veya direkt onProgress callback
 */
export async function resolveBatchMedia(items, optionsOrProgress = {}) {
  const onProgress =
    typeof optionsOrProgress === "function"
      ? optionsOrProgress
      : optionsOrProgress?.onProgress;
  const concurrency = optionsOrProgress?.concurrency || 5;

  const total = items.length;
  let resolvedCount = 0;
  const results = [];

  // Eşzamanlı kuyruk işleyici
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];

      let media = null;
      if (item.imdbId) {
        media = await resolveByImdbId(item.imdbId);
      }
      if (!media && item.title) {
        media = await resolveByTitleYear(item.title, item.year);
      }

      if (media) {
        // Fallback: Eğer CSV'den gelen süre varsa ve TMDB'de yoksa CSV süresini kullan
        const minutes = media.minutes || (Number(item.rawMinutes) > 0 ? Number(item.rawMinutes) : null);
        const genres = (media.genres && media.genres.length > 0)
          ? media.genres
          : (Array.isArray(item.rawGenres) ? item.rawGenres : []);

        results.push({
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
        });
      }

      resolvedCount++;
      if (onProgress) {
        onProgress(resolvedCount, total, item.title || item.imdbId || "");
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  return results;
}
