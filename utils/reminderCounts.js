// utils/reminderCounts.js
//
// Film/dizi hatırlatma LİMİTİNİN sayacı (registry: movie_reminders, tv_reminders).
// Saf modül: React/Firestore importu yok, jest doğrudan test eder.
//
// Kural — yalnız SÜREN hatırlatmalar hak harcar:
//   • Film: çıkış tarihi geçmediyse (bugün dahil) ya da tarih yoksa sayılır.
//     Çıkışı geçmiş film bildirimini zaten vermiş; hakkı serbest bırakır.
//   • Dizi: bölümlerden en az biri henüz yayınlanmadıysa (ya da tarihi yoksa)
//     dizi TEK hak sayılır — kaç bölüm hatırlatıcısı kurulursa kurulsun.
// Tarihi çözülemeyen kayıt "süren" sayılır: şüphede kullanıcı aleyhine
// hak silmek yerine hak harcatmak, limiti sessizce delmekten daha güvenli.
import { daysUntil } from "./airDate";

/** Çıkışı geçmemiş (ya da tarihsiz) film hatırlatmaları. */
export function activeMovieReminders(movieReminders, now = new Date()) {
  if (!Array.isArray(movieReminders)) return [];
  return movieReminders.filter((movie) => {
    const days = daysUntil(movie?.releaseDate, now);
    return days === null || days >= 0;
  });
}

/**
 * Süren dizi hatırlatması olan dizilerin kimlikleri (string). Girdi,
 * Reminders/{uid}/tvShows/{showId}/episodes belgelerinin düz listesidir.
 */
export function activeTvShowIds(episodes, now = new Date()) {
  const ids = new Set();
  if (!Array.isArray(episodes)) return ids;
  for (const episode of episodes) {
    if (episode?.showId === undefined || episode?.showId === null) continue;
    const days = daysUntil(episode.airDate, now);
    if (days === null || days >= 0) ids.add(String(episode.showId));
  }
  return ids;
}
