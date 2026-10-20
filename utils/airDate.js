// utils/airDate.js
//
// Yayın tarihi (TMDB air_date / release_date) hesaplarında tek doğruluk kaynağı.
// Hatırlatıcı listesi, geri sayım rozeti ve ana ekran widget'ı buradan besleniyor
// ki üçü aynı günü söylesin.
//
// Kapattığı iki tuzak:
//
//  1) TARİH-ONLY STRING'LER UTC OLARAK ÇÖZÜLÜYORDU.
//     `new Date("2026-07-26")` → 2026-07-26T00:00:00Z. UTC+3'te bu 26 Temmuz
//     03:00, ama UTC-5'te 25 Temmuz 19:00 — yani negatif ofsetli kullanıcıda
//     gösterilen gün bir geri kayıyordu. Burada tarih-only değerler YEREL gece
//     yarısı olarak çözülür.
//
//  2) GERİ SAYIM "GEÇEN SÜRE" İLE HESAPLANIYORDU.
//     `Math.floor((airDate - now) / 24sa)` takvim günü değil, aradaki süreyi
//     ölçer. 25 Temmuz saat 18:00'de, 26 Temmuz'da yayınlanacak bir bölüme
//     kalan süre ~9 saat → floor(9/24) = 0 → ekranda "Bugün" yazıyordu.
//     Burada iki taraf da yerel gece yarısına yuvarlanıp çıkarılır: yarın,
//     saat kaç olursa olsun, her zaman 1'dir.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

// Date, Firestore Timestamp, "YYYY-MM-DD" ve tam ISO string kabul eder.
// Çözülemeyen değer için null döner (çağıran taraf `isNaN` kontrolü yapmasın).
export const parseAirDate = (value) => {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  // Firestore Timestamp
  if (typeof value?.toDate === "function") {
    const converted = value.toDate();
    return converted instanceof Date && !Number.isNaN(converted.getTime())
      ? converted
      : null;
  }

  if (typeof value === "string") {
    const match = value.match(DATE_ONLY);
    // Yerel gece yarısı: UTC kaymasını önleyen kritik satır.
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// Değeri yerel gün başlangıcına (00:00:00.000) yuvarlar.
export const startOfDay = (value) => {
  const parsed = parseAirDate(value);
  if (!parsed) return null;
  const copy = new Date(parsed.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
};

// Takvim günü farkı: bugün 0, yarın 1, dün -1. Saatten bağımsız.
// Math.round kullanılıyor çünkü yaz saati geçişlerinde iki yerel gece yarısı
// arası 24 saat değil 23 ya da 25 saat olabilir.
export const daysUntil = (value, now = new Date()) => {
  const target = startOfDay(value);
  const today = startOfDay(now);
  if (!target || !today) return null;
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
};
