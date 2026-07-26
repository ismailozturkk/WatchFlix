// services/tmdbLookup.js
//
// AI asistanının önerdiği başlık adlarını (<MOVIE: ...> / <SERIES: ...>) TMDB'de
// arayıp poster kartı verisine çevirir. Sonuçlar bellek içi cache'lenir, böylece
// aynı başlık tekrar sorulmaz.
//
// Card = { key, mediaType, query, found, id?, title?, posterPath?, year?, rating? }

import * as cacheStore from "../utils/cacheStore";
import { shouldPersistInternetData } from "../utils/dataCacheSettings";

const cache = new Map(); // key -> Card

const langOf = (language) => (language === "tr" ? "tr-TR" : "en-US");
const cacheKey = (mediaType, language, title) =>
  `${mediaType}|${langOf(language)}|${title.toLowerCase().trim()}`;

/**
 * Tek bir başlığı TMDB'de arar.
 * @param {object} opts
 * @param {string} opts.apiKey - "Bearer ..." formatında TMDB v4 token
 * @param {string} opts.title
 * @param {"movie"|"tv"} opts.mediaType
 * @param {string} [opts.language]
 * @param {boolean} [opts.includeAdult]
 * @returns {Promise<Card>}
 */
export async function lookupTitle({
  apiKey,
  title,
  mediaType,
  language = "en",
  includeAdult = false,
}) {
  const query = (title || "").trim();
  const fallback = { key: `${mediaType}-${query}`, mediaType, query, found: false };
  if (!query) return fallback;

  const key = cacheKey(mediaType, language, query);
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

    const dateStr = best.release_date || best.first_air_date || "";
    const card = {
      key: `${mediaType}-${best.id}`,
      mediaType,
      query,
      found: true,
      id: best.id,
      title: best.title || best.name || query,
      posterPath: best.poster_path || null,
      year: dateStr ? String(dateStr).slice(0, 4) : "",
      rating: typeof best.vote_average === "number" ? best.vote_average : 0,
    };
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
}) {
  const tasks = [
    ...movies.map((title) =>
      lookupTitle({ apiKey, title, mediaType: "movie", language, includeAdult }),
    ),
    ...series.map((title) =>
      lookupTitle({ apiKey, title, mediaType: "tv", language, includeAdult }),
    ),
  ];
  const cards = await Promise.all(tasks);
  // Bulunanları (poster'ı olanları) öne al, bulunamayanları sona
  return cards.sort((a, b) => Number(b.found) - Number(a.found));
}
