// services/tmdbLookup.js
//
// AI asistanının önerdiği başlık adlarını (<MOVIE: ...> / <SERIES: ...>) TMDB'de
// arayıp poster kartı verisine çevirir. Sonuçlar bellek içi cache'lenir, böylece
// aynı başlık tekrar sorulmaz.
//
// Card = { key, mediaType, query, found, id?, title?, posterPath?, year?, rating?,
//          overview?, runtimeMinutes?, genres?, director?, cast?, providers?, similar? }

import * as cacheStore from "../utils/cacheStore";
import { shouldPersistInternetData } from "../utils/dataCacheSettings";

const cache = new Map(); // key -> Card

const langOf = (language) => (language === "tr" ? "tr-TR" : "en-US");
const cacheKey = (mediaType, language, title, includeDetails = false) =>
  `${mediaType}|${langOf(language)}|${title.toLowerCase().trim()}|${includeDetails ? "details" : "card"}`;
const regionOf = (language) => (language === "tr" ? "TR" : "US");

function cardFromResult(result, mediaType, query) {
  const dateStr = result?.release_date || result?.first_air_date || "";
  return {
    key: `${mediaType}-${result.id}`,
    mediaType,
    query,
    found: true,
    id: result.id,
    title: result.title || result.name || query,
    posterPath: result.poster_path || null,
    year: dateStr ? String(dateStr).slice(0, 4) : "",
    rating: typeof result.vote_average === "number" ? result.vote_average : 0,
  };
}

function mergeDetails(card, details, language) {
  if (!details || !card?.found) return card;
  const runtime = card.mediaType === "movie"
    ? details.runtime
    : details.episode_run_time?.find((value) => Number(value) > 0) || details.last_episode_to_air?.runtime;
  const director = card.mediaType === "movie"
    ? details.credits?.crew?.find((person) => person?.job === "Director")?.name
    : details.created_by?.[0]?.name || details.credits?.crew?.find((person) => person?.job === "Director")?.name;
  const providers = details["watch/providers"]?.results?.[regionOf(language)]?.flatrate || [];

  return {
    ...card,
    title: details.title || details.name || card.title,
    posterPath: details.poster_path || card.posterPath,
    overview: details.overview || "",
    runtimeMinutes: Number(runtime) > 0 ? Number(runtime) : 0,
    genres: (details.genres || []).map((genre) => genre?.name).filter(Boolean),
    director: director || "",
    cast: (details.credits?.cast || []).slice(0, 4).map((person) => person?.name).filter(Boolean),
    providers: providers.map((provider) => provider?.provider_name).filter(Boolean),
    similar: (details.recommendations?.results || []).slice(0, 6).map((result) =>
      cardFromResult(result, card.mediaType, result.title || result.name || "")),
  };
}

/**
 * Tek bir başlığı TMDB'de arar.
 * @param {object} opts
 * @param {string} opts.apiKey - "Bearer ..." formatında TMDB v4 token
 * @param {string} opts.title
 * @param {"movie"|"tv"} opts.mediaType
 * @param {string} [opts.language]
 * @param {boolean} [opts.includeAdult]
 * @param {boolean} [opts.includeDetails]
 * @returns {Promise<Card>}
 */
export async function lookupTitle({
  apiKey,
  title,
  mediaType,
  language = "en",
  includeAdult = false,
  includeDetails = false,
}) {
  const query = (title || "").trim();
  const fallback = { key: `${mediaType}-${query}`, mediaType, query, found: false };
  if (!query) return fallback;

  const key = cacheKey(mediaType, language, query, includeDetails);
  if (cache.has(key)) return cache.get(key);

  const diskCached = cacheStore.getJSON("tmdbLookup", key);
  if (diskCached) {
    cache.set(key, diskCached);
    return diskCached;
  }

  // API anahtarı yoksa fallback (en azından çip olarak gösterilir)
  if (!apiKey) {
    cache.set(key, fallback);
    return fallback;
  }

  try {
    // RN'de URLSearchParams polyfill'i eksik olabildiğinden query'i elle kuruyoruz
    const url =
      `https://api.themoviedb.org/3/search/${mediaType}` +
      `?query=${encodeURIComponent(query)}` +
      `&include_adult=${includeAdult ? "true" : "false"}` +
      `&language=${langOf(language)}` +
      `&page=1`;
    const res = await fetch(url, { headers: { Authorization: apiKey } });
    if (!res.ok) {
      cache.set(key, fallback);
      return fallback;
    }
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    // En iyi eşleşme: tam ad eşleşmesini önceliklendir, yoksa en popüler/oy sayılı.
    const norm = (s) => (s || "").toLowerCase().trim();
    const exact = results.find(
      (r) => norm(r.title || r.name) === norm(query),
    );
    const best =
      exact ||
      [...results].sort(
        (a, b) => (b.vote_count || 0) - (a.vote_count || 0),
      )[0];

    if (!best) {
      cache.set(key, fallback);
      return fallback;
    }

    let card = cardFromResult(best, mediaType, query);
    if (includeDetails) {
      try {
        const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${best.id}` +
          `?language=${langOf(language)}` +
          "&append_to_response=credits%2Cwatch%2Fproviders%2Crecommendations";
        const detailsRes = await fetch(detailsUrl, { headers: { Authorization: apiKey } });
        if (detailsRes.ok) card = mergeDetails(card, await detailsRes.json(), language);
      } catch {
        // Detay isteği başarısızsa arama sonucu kartı yine kullanılabilir.
      }
    }
    cache.set(key, card);
    if (
      shouldPersistInternetData({
        category: mediaType === "tv" ? "tvContent" : "movieContent",
      })
    ) {
      cacheStore.setJSON("tmdbLookup", key, card);
    }
    return card;
  } catch {
    const stale = cacheStore.getJSON("tmdbLookup", key);
    if (stale) {
      cache.set(key, stale);
      return stale;
    }
    cache.set(key, fallback);
    return fallback;
  }
}

/**
 * Bir AI yanıtından çıkarılan film + dizi başlıklarını paralel çözer.
 * @returns {Promise<Card[]>} — önce filmler, sonra diziler (bulunanlar önde)
 */
export async function resolveCards({
  apiKey,
  movies = [],
  series = [],
  language = "en",
  includeAdult = false,
  includeDetails = false,
}) {
  const tasks = [
    ...movies.map((title) =>
      lookupTitle({ apiKey, title, mediaType: "movie", language, includeAdult, includeDetails }),
    ),
    ...series.map((title) =>
      lookupTitle({ apiKey, title, mediaType: "tv", language, includeAdult, includeDetails }),
    ),
  ];
  const cards = await Promise.all(tasks);
  // Bulunanları (poster'ı olanları) öne al, bulunamayanları sona
  return cards.sort((a, b) => Number(b.found) - Number(a.found));
}
