// utils/tmdbLocalizedMedia.js
//
// Detay ekranlarında afiş, arka plan ve yapım adı için dil önceliği:
//   seçili dil → İngilizce → TMDB'nin varsayılanı (özgün dil ya da birincil görsel).
//
// NEDEN: TMDB `language=tr` ile Türkçe görsel/ad yoksa doğrudan varsayılana düşer
// (Korece bir dizide Korece ad ve afiş); İngilizcesi olsa bile onu seçmez. Detay
// yanıtı `images` + `translations` eklerini zaten taşıdığı için ek istek gerekmez.
//
// Saf modül: ağ ve React yok, node'da sınanır (__tests__/tmdbLocalizedMedia.test.js).

import { getAppLanguage, tmdbImageLanguagesOf } from "./appLanguages";

const byVotes = (a, b) =>
  (b.vote_average || 0) - (a.vote_average || 0) || (b.vote_count || 0) - (a.vote_count || 0);

/** Öncelik sırasındaki ilk dilin en beğenilen görseli; hiçbiri yoksa `fallbackPath`. */
export function pickLocalizedImagePath(images, languages, fallbackPath = null) {
  const list = Array.isArray(images) ? images : [];
  for (const code of languages) {
    const [best] = list.filter((img) => img?.file_path && img.iso_639_1 === code).sort(byVotes);
    if (best) return best.file_path;
  }
  return fallbackPath;
}

const translatedTitle = (translations, code, field) => {
  const entry = (Array.isArray(translations) ? translations : []).find((t) => t?.iso_639_1 === code);
  const value = entry?.data?.[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

/**
 * TMDB detay yanıtına dil önceliğini uygular (yeni nesne döner, girdiye dokunmaz).
 * Özgün dil seçiliyse ad zaten doğrudur; çevirisi yoksa İngilizce ad, o da yoksa
 * TMDB'nin verdiği ad kalır.
 */
export function localizeMediaDetails(details, language) {
  if (!details) return details;
  const code = getAppLanguage(language).code;
  const languages = tmdbImageLanguagesOf(language);
  const out = {
    ...details,
    poster_path: pickLocalizedImagePath(details.images?.posters, languages, details.poster_path ?? null),
    backdrop_path: pickLocalizedImagePath(details.images?.backdrops, languages, details.backdrop_path ?? null),
  };

  const field = "title" in details || details.original_title ? "title" : "name";
  const translations = details.translations?.translations;
  if (details.original_language !== code && !translatedTitle(translations, code, field)) {
    const english = translatedTitle(translations, "en", field);
    if (english) out[field] = english;
  }
  return out;
}
