// utils/dailyUsage.js
//
// Günlük premium hakları (oyun, CineSwipe odası/kartı) için saf sayaç
// mantığı. Depolama ve React tarafı services/premiumUsage.js'tedir.
//
// Durum biçimi: { day: "2026-09-18", counts: { games: 2, cineswipe_rooms: 1 } }
// Gün değişince tüm sayaçlar birlikte sıfırlanır; eski günün verisi tutulmaz.
// Gün YEREL saate göredir: kullanıcı "yarın yenilenir" sözünü kendi gece
// yarısında görmeli (AI kotası ise sunucuda UTC ile sayılır, ayrı bir sistem).

const pad = (value) => String(value).padStart(2, "0");

export function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const isState = (value) =>
  Boolean(value) &&
  typeof value === "object" &&
  typeof value.day === "string" &&
  value.counts &&
  typeof value.counts === "object";

/** Bugün bu özellik için harcanan hak. Başka güne ait kayıt 0 sayılır. */
export function readDailyCount(state, featureId, dayKey = localDayKey()) {
  if (!isState(state) || state.day !== dayKey) return 0;
  const count = Number(state.counts[featureId]);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

/**
 * Sayacı `delta` kadar değiştirilmiş YENİ durum döner (negatif delta iade).
 * Gün değiştiyse önceki günün tüm sayaçları atılır. Sayaç 0'ın altına inmez.
 */
export function withDailyDelta(state, featureId, delta = 1, dayKey = localDayKey()) {
  const sameDay = isState(state) && state.day === dayKey;
  const counts = sameDay ? { ...state.counts } : {};
  const next = Math.max(0, readDailyCount(state, featureId, dayKey) + delta);
  if (next === 0) delete counts[featureId];
  else counts[featureId] = next;
  return { day: dayKey, counts };
}
