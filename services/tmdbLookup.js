// services/tmdbLookup.js
//
// AI asistanının önerdiği başlık adlarını (<MOVIE: ...> / <SERIES: ...>) TMDB'de
// arayıp poster kartı verisine çevirir. Sonuçlar bellek içi cache'lenir, böylece
// aynı başlık tekrar sorulmaz.
//
// Card = { key, mediaType, query, found, id?, title?, posterPath?, backdropPath?, year?, rating?,
//          overview?, tagline?, runtimeMinutes?, genres?, director?, cast?, providers?, similar? }

import { tmdbLanguageOf, tmdbRegionOf } from "../utils/appLanguages";
import * as cacheStore from "../utils/cacheStore";
import { shouldPersistInternetData } from "../utils/dataCacheSettings";
import { adultContentAllowed } from "../utils/ageGate";
import {
  resolveTmdbItemTitle,
  resolveTmdbItems,
} from "../utils/tmdbTitleFallback";

const cache = new Map(); // key -> Card
// Kart şekli değişince artır: diskteki eski kartlar (ör. backdropPath yok) yeniden çekilir.
// v3: eşleşme kuralı değişti (T3 B9) — diskte kalmış yanlış eşleşmeler yeniden çözülsün.
const CARD_VERSION = "v3";

const langOf = (language) => (tmdbLanguageOf(language));
// Yetişkin içerik açıkken anahtara "+adult" ekleniyor: ayar sonradan
// kapatıldığında önbellekte kalmış yetişkin kart geri dönmesin.
const cacheKey = (mediaType, language, title, includeDetails = false, includeAdult = false) =>
  `${mediaType}|${langOf(language)}|${title.toLowerCase().trim()}|${includeDetails === "lite" ? "lite" : includeDetails ? "details" : "card"}${includeAdult ? "|+adult" : ""}|${CARD_VERSION}`;
const regionOf = (language) => (tmdbRegionOf(language));

const normTitle = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

/** "Knives Out (2019)" → { title: "Knives Out", year: "2019" }; yıl yoksa year "". */
export function splitTitleYear(raw) {
  const text = (raw || "").trim();
  const m = text.match(/^(.*\S)\s*\((\d{4})\)$/);
  return m ? { title: m[1], year: m[2] } : { title: text, year: "" };
}

/**
 * Arama sonuçlarından AI'ın kastettiği yapımı seçer.
 *
 * Tam ad eşleşmesi ÖZGÜN adla da aranır: AI başlığı çoğunlukla özgün (İngilizce)
 * adla yazıyor, arama ise yerelleştirilmiş adı döndürüyor. Almancada gerçek
 * "Knives Out" adı "Knives Out – Mord ist Familiensache" olduğu için tam
 * eşleşme yalnız yerel adla aranınca, adı tam "Knives Out" olan az bilinen bir
 * yapım kazanıyordu (T3 B9). Birden çok tam eşleşmede oy sayısı yüksek olan;
 * AI yıl verdiyse o yılın yapımı önce gelir.
 */
export function pickBestMatch(results, query, year = "") {
  const list = Array.isArray(results) ? results.filter(Boolean) : [];
  if (!list.length) return null;
  const q = normTitle(query);
  const yearOf = (r) => String(r.release_date || r.first_air_date || "").slice(0, 4);
  const byVotes = (a, b) => (b.vote_count || 0) - (a.vote_count || 0);
  const yearFirst = (pool) => {
    const sorted = [...pool].sort(byVotes);
    return (year && sorted.find((r) => yearOf(r) === year)) || sorted[0];
  };
  const exact = list.filter((r) =>
    [r.title, r.name, r.original_title, r.original_name].some(
      (t) => t && normTitle(t) === q,
    ),
  );
  return exact.length ? yearFirst(exact) : yearFirst(list);
}

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
    backdropPath: result.backdrop_path || null,
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
    backdropPath: details.backdrop_path || card.backdropPath || null,
    tagline: details.tagline || "",
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
 * @param {boolean|"lite"} [opts.includeDetails]  true = tam (oyuncu, benzer yapım, çeviriler);
 *   "lite" = süre + tür + platform (öneri satırları için; tek ek istek, benzer yapım çözümü yok)
 * @returns {Promise<Card>}
 */
export async function lookupTitle({
  apiKey,
  title,
  mediaType,
  language = "en",
  // Varsayılan doğrudan ayardan: bu modül fetch kullandığı için
  // utils/tmdbAdultGuard'ın axios interceptor'ına takılmıyor. Ayarı ÇIPLAK
  // okumak yaş kısıtını atlardı — kural tek yerde: utils/ageGate.js.
  includeAdult = adultContentAllowed(),
  includeDetails = false,
}) {
  const query = (title || "").trim();
  const { title: searchTitle, year: queryYear } = splitTitleYear(query);
  const fallback = { key: `${mediaType}-${query}`, mediaType, query, found: false };
  if (!query) return fallback;

  const key = cacheKey(mediaType, language, query, includeDetails, includeAdult);
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
      `?query=${encodeURIComponent(searchTitle)}` +
      `&include_adult=${includeAdult ? "true" : "false"}` +
      `&language=${langOf(language)}` +
      `&page=1`;
    const res = await fetch(url, { headers: { Authorization: apiKey } });
    if (!res.ok) {
      cache.set(key, fallback);
      return fallback;
    }
    const data = await res.json();
    const results = (Array.isArray(data?.results) ? data.results : []).filter(
      (result) => includeAdult || result?.adult !== true,
    );

    const best = pickBestMatch(results, searchTitle, queryYear);

    if (!best) {
      cache.set(key, fallback);
      return fallback;
    }

    const titledBest = await resolveTmdbItemTitle(best, {
      mediaType,
      language,
      authorization: apiKey,
    });
    let card = cardFromResult(titledBest, mediaType, query);
    if (includeDetails) {
      try {
        const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${best.id}` +
          `?language=${langOf(language)}` +
          (includeDetails === "lite"
            ? "&append_to_response=watch%2Fproviders"
            : "&append_to_response=credits%2Cwatch%2Fproviders%2Crecommendations%2Ctranslations");
        const detailsRes = await fetch(detailsUrl, { headers: { Authorization: apiKey } });
        if (detailsRes.ok) {
          let details = await detailsRes.json();
          details = await resolveTmdbItemTitle(details, {
            mediaType,
            language,
            authorization: apiKey,
          });
          if (Array.isArray(details?.recommendations?.results)) {
            details = {
              ...details,
              recommendations: {
                ...details.recommendations,
                results: await resolveTmdbItems(details.recommendations.results, {
                  mediaType,
                  language,
                  authorization: apiKey,
                }),
              },
            };
          }
          card = mergeDetails(card, details, language);
        }
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
