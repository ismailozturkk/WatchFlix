// utils/ratingSummaryModel.js
//
// Detaydaki sade puan özeti (components/RatingSummary.js) için SAF biçim yardımcıları — RN/Firebase yok.

import { formatCompactVotes } from "./externalRatings";
import { formatRatingInScale } from "./ratingScale";

/** 7.84 → "7.8"; puan yoksa (0 / geçersiz) null. */
export function formatScore(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toFixed(1) : null;
}

/** Kullanıcının kendi puanı 10 üzerinden: ten "8,5" · five (küsuratsız) "9"; tam sayıda ondalık yok. */
export function formatMyRating(value, language = "en", scale = "ten") {
  return formatRatingInScale(value, language, scale);
}

/** TMDB + Seelogd oylarının toplamı, kısa biçimde ("12.3K"); oy yoksa null. */
export function summarizeVotes(tmdbCount, appCount) {
  const total = Math.max(0, Number(tmdbCount) || 0) + Math.max(0, Number(appCount) || 0);
  return formatCompactVotes(total);
}
