// TMDB baslik onceligi, uygulamanin tum axios tabanli TMDB akislarinda ortaktir:
//   1) uygulama dili, 2) Ingilizce, 3) TMDB'nin ozgun basligi.
//
// Liste uclari ceviri listesini dondurmez. TMDB istenen dilde bir ceviri
// bulamayinca `title`/`name` alanina ozgun basligi koyar. Bu durumda yalniz o
// yapim icin /translations istenir. Sonuc bulunamazsa kayit ASLA elenmez;
// gelen ozgun baslik aynen korunur.

import axios from "axios";
import * as cacheStore from "./cacheStore";

const TMDB_HOST = "themoviedb.org";
const CACHE_NS = "tmdbTitles";
const CACHE_MAX_AGE = 90 * 24 * 60 * 60 * 1000;
const MAX_PARALLEL_REQUESTS = 4;

const memoryCache = new Map();
const inflight = new Map();
let installed = false;
let currentAppLanguage = "en";

const clean = (value) => (typeof value === "string" ? value.trim() : "");
const baseLanguage = (value) => clean(value).toLowerCase().split(/[-_]/)[0] || "en";

export function tmdbLanguageForApp(language) {
  const value = clean(language).replace("_", "-");
  const base = baseLanguage(value);
  if (base === "tr") return "tr-TR";
  if (base === "en") return "en-US";
  return value || "en-US";
}

export function setTmdbTitleLanguage(language) {
  if (clean(language)) currentAppLanguage = language;
}

export function containsJapaneseOrChineseScript(value) {
  return /[\u3040-\u30ff\u31f0-\u31ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(
    clean(value),
  );
}

function mediaTypeOf(item, fallbackType) {
  const type = item?.media_type || fallbackType;
  return type === "movie" || type === "tv" ? type : null;
}

function titleKeys(mediaType) {
  return mediaType === "tv"
    ? { display: "name", original: "original_name" }
    : { display: "title", original: "original_title" };
}

function translationRows(item) {
  const block = item?.translations;
  if (Array.isArray(block)) return block;
  return Array.isArray(block?.translations) ? block.translations : [];
}

function translatedTitle(row, mediaType) {
  const data = row?.data || {};
  return clean(mediaType === "tv" ? data.name || data.title : data.title || data.name);
}

function findTranslation(rows, mediaType, language, country) {
  const lang = baseLanguage(language);
  const wantedCountry = clean(country).toUpperCase();
  const candidates = rows.filter(
    (row) =>
      baseLanguage(row?.iso_639_1) === lang &&
      translatedTitle(row, mediaType),
  );
  if (!candidates.length) return "";
  if (wantedCountry) {
    const exact = candidates.find(
      (row) => clean(row?.iso_3166_1).toUpperCase() === wantedCountry,
    );
    if (exact) return translatedTitle(exact, mediaType);
  }
  return translatedTitle(candidates[0], mediaType);
}

/**
 * Mevcut TMDB nesnesinden basligi sec. `translations` yoksa TMDB'nin istenen
 * dil icin verdigi title/name zaten birinci tercihtir.
 */
export function preferredTmdbTitle(item, mediaType, language = currentAppLanguage) {
  const type = mediaTypeOf(item, mediaType);
  if (!type) return clean(item?.title || item?.name);

  const keys = titleKeys(type);
  const shown = clean(item?.[keys.display]);
  const original = clean(item?.[keys.original]);
  const rows = translationRows(item);
  if (!rows.length) return shown || original;

  const locale = tmdbLanguageForApp(language);
  const [appLang, appCountry] = locale.split("-");
  const appTitle = findTranslation(rows, type, appLang, appCountry);
  const englishTitle =
    findTranslation(rows, type, "en", "US") ||
    findTranslation(rows, type, "en", "GB") ||
    findTranslation(rows, type, "en", "");

  return appTitle || englishTitle || shown || original;
}

export function applyPreferredTmdbTitle(item, mediaType, language = currentAppLanguage) {
  if (!item || typeof item !== "object") return item;
  const type = mediaTypeOf(item, mediaType);
  if (!type) return item;
  const key = titleKeys(type).display;
  const selected = preferredTmdbTitle(item, type, language);
  if (!selected || selected === item[key]) return item;
  return { ...item, [key]: selected };
}

function needsTranslationLookup(item, mediaType, language) {
  if (!item?.id || translationRows(item).length) return false;
  const type = mediaTypeOf(item, mediaType);
  if (!type) return false;

  const appBase = baseLanguage(language);
  const originalLanguage = baseLanguage(item?.original_language);
  // Japonca/Cince uygulama dili ileride desteklenirse o yaziyi Ingilizceyle
  // ezmeyiz; her zaman uygulama dili birinci siradadir.
  if (["ja", "zh"].includes(appBase)) return false;

  const keys = titleKeys(type);
  const shown = clean(item?.[keys.display]);
  const original = clean(item?.[keys.original]);
  if (!shown) return false;
  // Sezon, bolum, video ve kisi yanitlari da `name` tasiyabilir. Bir yapim
  // oldugunu gosteren original_* / original_language kaniti yoksa bunlari film
  // veya dizi sanip yanlis /translations ucuna gonderme.
  if (!original && !originalLanguage) return false;
  if (containsJapaneseOrChineseScript(shown)) return true;

  // Yalniz CJK degil, Kiril/Arap vb. ozgun adlarda da ayni oncelik calissin.
  // TMDB'nin gosterdigi ad ozgun adla ayniysa ve ozgun dil uygulama dili ya da
  // Ingilizce degilse, istenen dilde ceviri bulunmamis kabul edilir.
  return Boolean(
    original &&
      shown.localeCompare(original, undefined, { sensitivity: "base" }) === 0 &&
      originalLanguage &&
      originalLanguage !== appBase &&
      originalLanguage !== "en",
  );
}

function authorizationFrom(config = {}) {
  const headers = config.headers || {};
  return (
    clean(headers.Authorization) ||
    clean(headers.authorization) ||
    clean(typeof headers.get === "function" ? headers.get("Authorization") : "")
  );
}

function languageFromConfig(config = {}) {
  const fromParams = clean(config?.params?.language);
  if (fromParams) return fromParams;
  const match = clean(config?.url).match(/[?&]language=([^&]+)/i);
  return match ? decodeURIComponent(match[1]) : currentAppLanguage;
}

function cacheKey(item, mediaType, language) {
  return `${mediaType}|${item.id}|${tmdbLanguageForApp(language)}`;
}

async function fetchTranslations(item, mediaType, language, authorization) {
  const key = cacheKey(item, mediaType, language);
  const cached = memoryCache.get(key) || cacheStore.getJSON(CACHE_NS, key, {
    maxAge: CACHE_MAX_AGE,
  });
  if (cached) {
    memoryCache.set(key, cached);
    return cached;
  }
  if (inflight.has(key)) return inflight.get(key);

  const request = (async () => {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${item.id}/translations`,
        {
          headers: {
            accept: "application/json",
            ...(authorization ? { Authorization: authorization } : {}),
          },
        },
      );
      if (!response.ok) return null;
      const data = await response.json();
      const enriched = { ...item, translations: data };
      const resolved = applyPreferredTmdbTitle(enriched, mediaType, language);
      // Baslik degismese de negatif sonucu cache'le; ayni yapim icin her rayda
      // tekrar istek atilmasin. Yapim yine ozgun basligiyla gosterilir.
      const result = {
        title: clean(resolved?.[titleKeys(mediaType).display]),
      };
      memoryCache.set(key, result);
      cacheStore.setJSON(CACHE_NS, key, result);
      return result;
    } catch {
      return null;
    }
  })().finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}

export async function resolveTmdbItemTitle(
  item,
  { mediaType, language = currentAppLanguage, authorization = "" } = {},
) {
  const type = mediaTypeOf(item, mediaType);
  if (!type) return item;

  const directlyResolved = applyPreferredTmdbTitle(item, type, language);
  if (!needsTranslationLookup(directlyResolved, type, language)) {
    return directlyResolved;
  }
  const fallback = await fetchTranslations(
    directlyResolved,
    type,
    language,
    authorization,
  );
  const key = titleKeys(type).display;
  return fallback?.title && fallback.title !== directlyResolved[key]
    ? { ...directlyResolved, [key]: fallback.title }
    : directlyResolved;
}

async function mapWithLimit(items, mapper, limit = MAX_PARALLEL_REQUESTS) {
  const output = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, Math.max(items.length, 1)) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        output[index] = await mapper(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return output;
}

export async function resolveTmdbItems(
  items,
  { mediaType, language = currentAppLanguage, authorization = "" } = {},
) {
  if (!Array.isArray(items) || !items.length) return items || [];
  // map sonucu sirayi ve eleman sayisini birebir korur: burada filtre yoktur.
  return mapWithLimit(items, (item) =>
    resolveTmdbItemTitle(item, { mediaType, language, authorization }),
  );
}

function mediaTypeFromUrl(url) {
  const value = clean(url);
  if (/\/collection(?:\/|\?|$)/.test(value)) return "movie";
  if (/\/movie(?:\/|\?|$)/.test(value) || /\/(?:discover|search)\/movie/.test(value)) {
    return "movie";
  }
  if (/\/tv(?:\/|\?|$)/.test(value) || /\/(?:discover|search)\/tv/.test(value)) {
    return "tv";
  }
  if (/\/trending\/movie\//.test(value)) return "movie";
  if (/\/trending\/tv\//.test(value)) return "tv";
  return null;
}

async function resolvePayload(data, options) {
  if (!data || typeof data !== "object") return data;
  let next = data;

  if (Array.isArray(data.results)) {
    next = {
      ...next,
      results: await resolveTmdbItems(data.results, options),
    };
  } else if (data.id) {
    next = await resolveTmdbItemTitle(data, options);
  }

  // Detay yanitlarinin icindeki raylar da ayni baslik kuralini kullanir.
  for (const key of ["recommendations", "similar"]) {
    if (Array.isArray(next?.[key]?.results)) {
      next = {
        ...next,
        [key]: {
          ...next[key],
          results: await resolveTmdbItems(next[key].results, options),
        },
      };
    }
  }
  if (Array.isArray(next?.parts)) {
    next = {
      ...next,
      parts: await resolveTmdbItems(next.parts, { ...options, mediaType: "movie" }),
    };
  }
  return next;
}

export function installTmdbTitleFallback() {
  if (installed) return;
  installed = true;

  axios.interceptors.response.use(async (response) => {
    const config = response?.config || {};
    const url = clean(config.url);
    if (!url.includes(TMDB_HOST) || /\/translations(?:\?|$)/.test(url)) {
      return response;
    }
    const mediaType = mediaTypeFromUrl(url);
    if (!mediaType && !Array.isArray(response?.data?.results)) return response;

    const language = languageFromConfig(config);
    response.data = await resolvePayload(response.data, {
      mediaType,
      language,
      authorization: authorizationFrom(config),
    });
    return response;
  });
}
