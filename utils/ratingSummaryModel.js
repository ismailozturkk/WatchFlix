// utils/ratingSummaryModel.js
//
// Detaydaki sade puan özeti (components/RatingSummary.js) için SAF biçim yardımcıları — RN/Firebase yok.

import { formatCompactVotes } from "./externalRatings";

/** 7.84 → "7.8"; puan yoksa (0 / geçersiz) null. */
export function formatScore(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toFixed(1) : null;
}

/** Kullanıcının kendi puanı: tam sayıysa "8", değilse "7.5" (sondaki .0 atılır). */
export function formatMyRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

/** TMDB + Seelogd oylarının toplamı, kısa biçimde ("12.3K"); oy yoksa null. */
export function summarizeVotes(tmdbCount, appCount) {
  const total = Math.max(0, Number(tmdbCount) || 0) + Math.max(0, Number(appCount) || 0);
  return formatCompactVotes(total);
}
