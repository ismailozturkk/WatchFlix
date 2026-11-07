// utils/tmdbPosterFallback.js
//
// Liste/raf/arama yanıtlarında afiş ve arka plan için dil önceliği — detay
// ekranlarındaki kuralın (utils/tmdbLocalizedMedia) aynısı:
//   seçili dil → İngilizce → TMDB'nin varsayılanı.
//
// NEDEN: Liste uçları (`/discover`, `/search`, `/trending`, öneriler …) yalnız tek bir
// `poster_path` döndürür; `language=tr` ile Türkçe afiş yoksa TMDB doğrudan varsayılana
// (çoğu zaman özgün dildeki afişe) düşer, İngilizcesi olsa bile onu seçmez. Görselin
// dili yanıtta yazmadığı için yalnız bu durumun YAŞANABİLDİĞİ yapımlar için `/images`
// istenir: uygulama dili İngilizce değilken özgün dili ne uygulama dili ne İngilizce
// olan yapımlar. (Özgün dili uygulama dili ya da İngilizce olanda TMDB'nin varsayılanı
// zaten doğru sıradadır.) Sonuç — "değişiklik yok" dahil — önbelleğe yazılır.
//
// Ortak axios katmanı (utils/tmdbTitleFallback → installTmdbTitleFallback) her TMDB
// yanıtında başlıkla birlikte bunu da uygular; fetch kullanan yerler doğrudan çağırır.

import * as cacheStore from "./cacheStore";
import { getAppLanguage, tmdbImageLanguagesOf } from "./appLanguages";
import { pickLocalizedImagePath } from "./tmdbLocalizedMedia";

const CACHE_NS = "tmdbImages";
const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
// Liste yanıtı bu aramaları bekler: takılan istek rafı tutmasın, TMDB afişi kalır.
const LOOKUP_TIMEOUT_MS = 4000;

const memoryCache = new Map();
const inflight = new Map();

const clean = (value) => (typeof value === "string" ? value.trim() : "");
const baseLanguage = (value) => clean(value).toLowerCase().split(/[-_]/)[0];

function mediaTypeOf(item, fallbackType) {
  const type = item?.media_type || fallbackType;
  return type === "movie" || type === "tv" ? type : null;
}

/** Görsel listesinden seçim; o dillerde görsel yoksa null (dilsiz/özgün afiş seçilmez). */
function pickFromImages(images, languages) {
  return {
    poster: pickLocalizedImagePath(images?.posters, languages, null),
    backdrop: pickLocalizedImagePath(images?.backdrops, languages, null),
  };
}

/** Bu yapımın afişi için `/images` sorulmalı mı (saf; sınanır). */
export function needsImageLookup(item, mediaType, language) {
  if (!item?.id || !mediaTypeOf(item, mediaType)) return false;
  if (!item.poster_path && !item.backdrop_path) return false;
  const appBase = getAppLanguage(language).code;
  const originalLanguage = baseLanguage(item.original_language);
  // Sezon/bölüm/kişi yanıtları özgün dil taşımaz: yapım değildir, dokunulmaz.
  if (!originalLanguage) return false;
  return appBase !== "en" && originalLanguage !== appBase && originalLanguage !== "en";
}

function withPaths(item, paths) {
  if (!paths) return item;
  const poster = paths.poster || item.poster_path || null;
  const backdrop = paths.backdrop || item.backdrop_path || null;
  if (poster === (item.poster_path ?? null) && backdrop === (item.backdrop_path ?? null)) return item;
  return { ...item, poster_path: poster, backdrop_path: backdrop };
}

async function fetchImages(type, id, language, authorization) {
  const languages = tmdbImageLanguagesOf(language);
  const key = `${type}|${id}|${languages.join(",")}`;
  const cached = memoryCache.get(key) || cacheStore.getJSON(CACHE_NS, key, { maxAge: CACHE_MAX_AGE });
  if (cached) {
    memoryCache.set(key, cached);
    return cached;
  }
  if (inflight.has(key)) return inflight.get(key);

  const request = (async () => {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS) : null;
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/${type}/${id}/images?include_image_language=${languages.join(",")}`,
        {
          headers: {
            accept: "application/json",
            ...(authorization ? { Authorization: authorization } : {}),
          },
          ...(controller ? { signal: controller.signal } : {}),
        },
      );
      if (!response.ok) return null;
      const data = await response.json();
      // null = o dillerde görsel yok → TMDB'nin yolu kalır (negatif sonuç da saklanır).
      const result = pickFromImages(data, languages);
      memoryCache.set(key, result);
      cacheStore.setJSON(CACHE_NS, key, result);
      return result;
    } catch {
      // Ağ hatası / zaman aşımı geçicidir: önbelleğe yazılmaz.
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  })().finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}

/**
 * Tek yapımın `poster_path` / `backdrop_path` alanlarını dil önceliğine göre çözer
 * (yeni nesne döner; değişiklik yoksa aynısı). Yanıtta `images` eki varsa ağsız seçer.
 */
export async function resolveTmdbItemImages(item, { mediaType, language, authorization = "" } = {}) {
  const type = mediaTypeOf(item, mediaType);
  if (!item || typeof item !== "object" || !type) return item;
  // `images` eki `include_image_language` verilmeden istendiyse yalnız istek dilini
  // taşır; orada İngilizce bulunamazsa yine `/images`e sorulur.
  const appended = pickFromImages(item.images, tmdbImageLanguagesOf(language));
  const resolved = withPaths(item, appended);
  if (appended.poster || !needsImageLookup(item, type, language)) return resolved;
  return withPaths(resolved, await fetchImages(type, item.id, language, authorization));
}
