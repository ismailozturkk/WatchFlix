// utils/gameImage.js
//
// Oyun sorusunun görsel adresini TEK yerde üretir. Ekran ile önbellek ısıtma
// (hooks/useSceneGame → Image.prefetch) AYNI URL'yi kullanmak zorunda; biri
// farklı genişlik isterse TMDB başka boyut döner ve prefetch boşa gider.

import { buildTmdbUrl } from "./tmdbImageUtils";

// Afiş oyununda afiş kartı ekran genişliğinin bu oranı kadardır.
export const POSTER_CARD_WIDTH_RATIO = 0.62;

export function buildQuestionImageUrl(path, kind, screenWidth) {
  if (!path) return null;
  if (kind === "poster") {
    return buildTmdbUrl(path, "poster", Math.round(screenWidth * POSTER_CARD_WIDTH_RATIO), "good");
  }
  return buildTmdbUrl(path, "backdrop", screenWidth, "good");
}
