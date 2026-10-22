// utils/dailyWatchLimit.js
//
// "Bir günde en fazla 1440 dakika (24 saat) içerik izlenmiş sayılır" kuralının SAF
// çekirdeği — Firebase, React yok; jest ile doğrudan test edilir. Uygulama kapısı
// services/libraryActions.js, mesajlar utils/dailyLimitCopy.js.
//
// NE SAYILIR: izleme tarihi (`watchedAt`, "YYYY-MM-DD") o güne denk gelen HER
// izleme olayının süresi — film olayları (belgedeki `minutes`), dizi olayları
// (olayın `minutes`'ı; yoksa bölüm sürelerinden türetilir). Tekrar izleme de süre
// harcar, bu yüzden ayrı olay olarak sayılır. Süresi bilinmeyen (0 dk) içerik
// sınırı doldurmaz.
//
// BÜYÜK TOPLU EKLEME (tüm dizi / sezon): bir günün kalanına sığmıyorsa içerik
// bölümler SIRASIYLA günlere paylaştırılır. Seçilen tarih İZLEMENİN BİTTİĞİ gündür:
// son bölümler o güne, öncekiler geriye doğru önceki günlere yazılır (gelecek
// tarih üretmemek için yön geriye). Önceki günlerde zaten izlenmiş süre varsa
// o günün yalnız boş kısmı kullanılır. Yayılma `MAX_SPREAD_DAYS` günü aşarsa
// HİÇBİR ŞEY yazılmaz (reason: "span").

import { materializeTvWatchState, movieWatchEvents, normalizeWatchDate } from "./watchHistory";

/** Bir günün dakikası. */
export const DAY_MINUTES = 1440;
/** Toplu eklemenin geriye doğru yayılabileceği en çok gün (≈ 1 yıl). */
export const MAX_SPREAD_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" − n gün (UTC öğlen üzerinden: yaz saati kaymasından etkilenmez). */
export function shiftDay(day, delta) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day ?? ""));
  if (!match) return null;
  const base = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  const date = new Date(base + delta * DAY_MS);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

const minutesOf = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

// Yerel liste nesneleri güncellemede yenisiyle DEĞİŞİR; kimlik üzerinden önbellek
// her ekleme tıklamasında yüzlerce dizinin olaylarını yeniden türetmeyi önler.
const tvEventCache = new WeakMap();
function tvEventsOf(show) {
  if (!show || typeof show !== "object") return [];
  let events = tvEventCache.get(show);
  if (!events) {
    events = materializeTvWatchState(show).watchEvents.map((event) => ({
      day: normalizeWatchDate(event.watchedAt),
      minutes: minutesOf(event.minutes),
    }));
    tvEventCache.set(show, events);
  }
  return events;
}

/**
 * Günlük kullanım haritası: gün → o güne yazılmış toplam dakika.
 * @param {{ watchedMovies?: Record<string, any>, watchedTv?: Record<string, any> }} lists
 *        yerel liste haritaları ({ [docId]: belge })
 * @returns {Map<string, number>}
 */
export function dayUsage({ watchedMovies, watchedTv } = {}) {
  const usage = new Map();
  const add = (day, minutes) => {
    if (!day || !minutes) return;
    usage.set(day, (usage.get(day) || 0) + minutes);
  };
  Object.values(watchedMovies || {}).forEach((movie) => {
    const minutes = minutesOf(movie?.minutes);
    if (!minutes) return;
    movieWatchEvents(movie).forEach((event) => add(normalizeWatchDate(event.watchedAt), minutes));
  });
  Object.values(watchedTv || {}).forEach((show) => {
    tvEventsOf(show).forEach((event) => add(event.day, event.minutes));
  });
  return usage;
}

/** O günün kalan dakikası (sınır zaten aşılmışsa 0). */
export const remainingMinutes = (usage, day) =>
  Math.max(0, DAY_MINUTES - (usage?.get?.(day) || 0));

/**
 * Sıralı öğeleri (bölümler ya da tek film/bölüm) günlere yerleştirir.
 *
 * @param {object} p
 * @param {Array<{minutes?: number}>} p.items  izleme sırasıyla
 * @param {string} p.watchDate                 izlemenin bittiği gün
 * @param {Map<string, number>} p.usage        `dayUsage` çıktısı
 * @param {boolean} [p.allowSpread=true]       false → yalnız `watchDate`e yazılabilir
 * @param {number} [p.maxSpreadDays=MAX_SPREAD_DAYS]
 * @returns {{ ok: true, chunks: Array<{date: string, from: number, to: number, minutes: number}>,
 *             spread: boolean, startDate: string|null, endDate: string|null, totalMinutes: number }
 *         | { ok: false, reason: "full"|"span"|"invalid", day: string|null, used: number,
 *             remaining: number, requested: number }}
 *   `chunks` kronolojik; `from..to` (dahil) `items` indeksleri, her öğe tam bir kez.
 */
export function planDailyWatch({
  items,
  watchDate,
  usage,
  allowSpread = true,
  maxSpreadDays = MAX_SPREAD_DAYS,
}) {
  const list = Array.isArray(items) ? items : [];
  const endDay = normalizeWatchDate(watchDate);
  const requested = list.reduce((sum, item) => sum + minutesOf(item?.minutes), 0);
  if (!endDay) {
    return { ok: false, reason: "invalid", day: null, used: 0, remaining: 0, requested };
  }
  if (list.length === 0) {
    return { ok: true, chunks: [], spread: false, startDate: null, endDate: null, totalMinutes: 0 };
  }

  const chunks = [];
  let index = list.length - 1;
  let day = endDay;
  let scanned = 0;

  while (index >= 0) {
    const used = usage?.get?.(day) || 0;
    const remaining = Math.max(0, DAY_MINUTES - used);

    if (scanned >= (allowSpread ? maxSpreadDays : 1)) {
      return {
        ok: false,
        reason: allowSpread ? "span" : "full",
        day: endDay,
        used: usage?.get?.(endDay) || 0,
        remaining: remainingMinutes(usage, endDay),
        requested,
      };
    }

    // Bu günün payı: sondan başlayıp sığdığı kadar. Tek bir öğe bir günden uzunsa
    // (veri hatası) boş güne tek başına yazılabilsin diye 1440'a kıstırılır.
    let total = 0;
    const last = index;
    while (index >= 0) {
      const cost = Math.min(minutesOf(list[index]?.minutes), DAY_MINUTES);
      if (cost > 0 && total + cost > remaining) break;
      total += cost;
      index -= 1;
    }
    if (index < last) {
      chunks.push({ date: day, from: index + 1, to: last, minutes: total });
    }

    scanned += 1;
    if (index >= 0) day = shiftDay(day, -1);
    if (!day) {
      return { ok: false, reason: "invalid", day: null, used: 0, remaining: 0, requested };
    }
  }

  chunks.reverse();
  return {
    ok: true,
    chunks,
    spread: chunks.length > 1,
    startDate: chunks[0]?.date ?? null,
    endDate: chunks[chunks.length - 1]?.date ?? null,
    totalMinutes: requested,
  };
}
