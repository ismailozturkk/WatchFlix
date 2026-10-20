// utils/durationText.js
//
// Kısa süre metinleri ("45 dk" / "45 min" / "2 sa 5 dk" / "2h 5m"). Birimler `autoI18n.duration_*`
// çevirilerinden gelir; eskiden ekranlar `${n} dk` / `${h} sa` sabit Türkçe basıyordu ve
// yabancı dil kullanıcısı Türkçe birim görüyordu.

import { i18nText } from "./i18nText";

export const minutesText = (minutes) =>
  i18nText("autoI18n.duration_minutes", "{{minutes}} dk", { minutes });

export const hoursText = (hours) => i18nText("autoI18n.duration_hours", "{{hours}} sa", { hours });

export const daysText = (days) => i18nText("autoI18n.duration_days", "{{days}} g", { days });

/**
 * Toplam dakikayı "3 sa 25 dk" / "3 sa" / "45 dk" olarak yazar. Sıfır/geçersiz → "".
 * (Gün birimine çevirmez; gün gerektiren yerler `autoI18n.duration_days_hours` kullanır.)
 */
export function hoursMinutesText(totalMinutes) {
  const total = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  if (!total) return "";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return minutesText(minutes);
  if (!minutes) return hoursText(hours);
  return i18nText("autoI18n.duration_hours_minutes", "{{hours}} sa {{minutes}} dk", { hours, minutes });
}
