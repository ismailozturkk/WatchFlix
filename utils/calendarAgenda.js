// utils/calendarAgenda.js
//
// Takvim ekranının (screens/calendar/CalendarScreen.js) saf yardımcıları.
// Bileşenden ayrı durmasının nedeni test edilebilmesi: tarih aritmetiği ve ay
// sayımları UTC+3 gibi dilimlerde sessizce bir gün kayabilen türden işler.
//
// TARİH ANAHTARI: her yerde YERELDEN türetilen "YYYY-MM-DD". toISOString UTC
// gününü verir; UTC+3'te yerel gece yarısı bir önceki güne düşerdi (bkz.
// context/CalendarContext.js toDateStr — iki taraf aynı takvimde konuşmalı).

import { pickByLanguage } from "./appLanguages";

const DAY_MS = 86400000;

export function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const parseDay = (dateStr) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || "");
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

/**
 * `dateStr` günü `todayStr`den kaç gün sonra (negatifse önce). UTC günü
 * üzerinden hesaplanır: yerel gece yarısı farkını DST geçişi 23/25 saate
 * çevirse bile sonuç tam sayı gün kalır. Geçersiz girdide `null`.
 */
export function dayDiff(dateStr, todayStr) {
  const a = parseDay(dateStr);
  const b = parseDay(todayStr);
  if (a == null || b == null) return null;
  return Math.round((a - b) / DAY_MS);
}

/**
 * Gün başlığının aciliyet tonu. Renk eşlemesi görünüm katmanında kalır.
 *   past   → geçmiş       today → bugün
 *   soon   → 1-3 gün      week  → 4-7 gün     normal → daha uzak
 */
export function urgencyTone(diff) {
  if (diff == null) return "normal";
  if (diff < 0) return "past";
  if (diff === 0) return "today";
  if (diff <= 3) return "soon";
  if (diff <= 7) return "week";
  return "normal";
}

/** "2026-10-14" → "2026-10". Geçersiz girdide boş dizgi. */
export function monthKeyOf(dateStr) {
  return /^\d{4}-\d{2}/.test(dateStr || "") ? dateStr.slice(0, 7) : "";
}

/**
 * Bir aydaki etkinlik sayıları (tür kırılımıyla). Notlar `noteEvents`ten,
 * film/dizi hatırlatıcıları `reminderEvents`ten gelir; ikisi de
 * { "YYYY-MM-DD": [öğe, …] } haritasıdır.
 */
export function countEventsInMonth(noteEvents, reminderEvents, monthKey) {
  const counts = { note: 0, movie: 0, tv: 0, total: 0 };
  if (!monthKey) return counts;

  for (const [date, list] of Object.entries(noteEvents || {})) {
    if (date.startsWith(monthKey)) counts.note += list?.length || 0;
  }
  for (const [date, list] of Object.entries(reminderEvents || {})) {
    if (!date.startsWith(monthKey)) continue;
    for (const item of list || []) {
      if (item?.type === "tv") counts.tv += 1;
      else if (item?.type === "movie") counts.movie += 1;
    }
  }
  counts.total = counts.note + counts.movie + counts.tv;
  return counts;
}

/** "S1B3" (TR) / "S1E3" (EN). Sezon ya da bölüm yoksa boş dizgi. */
export function formatEpisodeCode(seasonNumber, episodeNumber, language) {
  if (seasonNumber == null || episodeNumber == null) return "";
  return `${pickByLanguage(language, { tr: "S", en: "S", es: "T" })}${seasonNumber}${pickByLanguage(language, { tr: "B", en: "E", es: "E" })}${episodeNumber}`;
}
