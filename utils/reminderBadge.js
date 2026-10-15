// utils/reminderBadge.js
//
// Poster rozetlerindeki "hatırlatma" (zil) rozetinin SAF mantığı: React ve
// Firestore importu yok, jest doğrudan test eder. Hook'u hooks/useUpcomingReminder.js,
// çizimi components/ListBadges.js, ayar satırı Ayarlar > Poster görünümü yapar.
//
// NE ZAMAN GÖRÜNÜR — kullanıcı o içerik için hatırlatma kurmuş VE hatırlatma hâlâ
// bekliyorsa ("daha sonra gelecek"):
//   • Film: çıkış tarihi geçmediyse (bugün dahil) ya da tarih yoksa.
//   • Dizi: kurulu bölüm hatırlatmalarından en az biri henüz yayınlanmadıysa.
// Çıkışı geçmiş film / yayınlanmış bölüm bildirimini zaten vermiştir; poster
// üstünde zil görmek "haber verilecek" yanılgısı yaratırdı. Hatırlatma profilde
// ve takvimde durmaya devam eder, yalnız poster rozeti söner.
//
// "Süren" tanımı hatırlatma LİMİTİNİN sayacıyla (utils/reminderCounts.js) AYNI
// fonksiyonlardan gelir: iki yerde iki ayrı tarih kuralı olup birbirinden
// ayrışamaz. Tarihi çözülemeyen kayıt orada da burada da "süren" sayılır.

import { activeMovieReminders, activeTvShowIds } from "./reminderCounts";

/**
 * Rozetin kimliği. `key`, Ayarlar > Poster görünümü'ndeki `posterBadges` anahtarı;
 * ayar ekranı ve ListBadges aynı kaydı okur, simge/renk iki yerde ayrışmasın.
 * Renk, yığındaki diğer yedi rozetin hiçbiriyle çakışmayan tek ton (pembe).
 */
export const REMINDER_BADGE = Object.freeze({
  key: "reminder",
  icon: "notifications",
  color: "#f472b6",
});

const EMPTY_INDEX = Object.freeze({
  day: "",
  movies: new Set(),
  shows: new Set(),
});

// Görünüm nesnesi (services/userData) veri değişmedikçe aynı referanstır ve
// dondurulmuştur; indeks onun üstüne bir kez kurulur, her poster O(1) bakar.
// WeakMap: görünüm atılınca (çıkış, yeni veri) indeks de serbest kalır.
const cache = new WeakMap();

const dayKey = (now) => `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

/**
 * Süren hatırlatmaların kimlik kümeleri.
 *
 * Gün anahtarı önbelleğe girer: veri hiç değişmese de gece yarısı geçince
 * "çıkışı geçti" kararı yenilensin (ekran açık kalan ya da yeniden çizilen
 * poster dünkü kümeyle yaşamasın).
 *
 * @param {{lists?: {movies?: object[], episodes?: object[]}}|null} view
 *        remindersDomain.getSnapshot(uid) çıktısı
 * @returns {{day: string, movies: Set<string>, shows: Set<string>}}
 */
export function upcomingReminderIndex(view, now = new Date()) {
  if (!view || typeof view !== "object" || !view.lists) return EMPTY_INDEX;

  const day = dayKey(now);
  const hit = cache.get(view);
  if (hit && hit.day === day) return hit;

  const movies = new Set();
  for (const movie of activeMovieReminders(view.lists.movies, now)) {
    if (movie?.movieId !== undefined && movie?.movieId !== null && movie.movieId !== "") {
      movies.add(String(movie.movieId));
    }
  }

  const index = { day, movies, shows: activeTvShowIds(view.lists.episodes, now) };
  cache.set(view, index);
  return index;
}

/**
 * Bu içerik için süren bir hatırlatma var mı?
 *
 * Film ve dizi kimlikleri AYRI uzaydır (TMDB'de aynı sayı hem bir film hem bir
 * dizi olabilir); `mediaType === "tv"` dışındaki her şey film sayılır —
 * useListStatus ile aynı sözleşme.
 */
export function hasUpcomingReminder(view, mediaId, mediaType, now = new Date()) {
  if (mediaId === undefined || mediaId === null || mediaId === "") return false;
  const index = upcomingReminderIndex(view, now);
  return (mediaType === "tv" ? index.shows : index.movies).has(String(mediaId));
}
