// utils/dailyChallenge.js
//
// Günlük Meydan Okuma'nın saf kuralları: gün sınırı, tohum, seri hesabı ve
// Oyun Merkezi'nin göstereceği durum. Firestore/TMDB/React bağımlılığı YOK.
//
// GÜN SINIRI: herkes için aynı olsun diye sabit bir saat dilimine bağlı.
// Türkiye 2016'dan beri kalıcı UTC+3 (yaz saati yok); bu yüzden "gün" her
// cihazda gece 00:00 (TR) olarak biter. Cihaz saat dilimi KULLANILMAZ — yoksa
// yurt dışındaki bir arkadaş başka güne ait sorularla yarışırdı.
//
// BU MODÜL NEYİ GARANTİ ETMEZ: istemci saati değiştirilebilir; "tek deneme"
// ve liderlik sunucuda doğrulanmaz (projedeki diğer oyun skorlarıyla aynı güven
// modeli — bkz. docs/ozellikler/OYUN_KISMI_GELISTIRME.txt Part 17/29).

import { XP_DAILY_BONUS } from "./gameScoring";

// Bonus XP tek yerde tanımlı: gameScoring ile aynı değeri paylaşır.
export const DAILY_BONUS_XP = XP_DAILY_BONUS;
export const DAILY_MODE_ID = "daily";
export const DAILY_SOURCE_ID = "daily";
export const DAILY_QUESTION_COUNT = 10;
export const DAILY_UTC_OFFSET_HOURS = 3;
// Sorular/seçenek mantığı değişirse artırılır; eski günlerin tohumu bozulmaz.
export const DAILY_SEED_VERSION = 1;

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

const pad2 = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" — Türkiye gününe göre. */
export function dayKeyOf(now = Date.now()) {
  const shifted = new Date(Number(now) + DAILY_UTC_OFFSET_HOURS * HOUR_MS);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

/** Bir gün anahtarının önceki günü ("2026-03-01" → "2026-02-28"). */
export function previousDayKey(dayKey) {
  const [y, m, d] = String(dayKey).split("-").map(Number);
  if (!y || !m || !d) return null;
  const prev = new Date(Date.UTC(y, m - 1, d) - DAY_MS);
  return `${prev.getUTCFullYear()}-${pad2(prev.getUTCMonth() + 1)}-${pad2(prev.getUTCDate())}`;
}

/** Bir sonraki gün sınırının (TR 00:00) epoch ms değeri. */
export function nextDayStartMs(now = Date.now()) {
  const offsetMs = DAILY_UTC_OFFSET_HOURS * HOUR_MS;
  const shifted = Number(now) + offsetMs;
  return Math.floor(shifted / DAY_MS) * DAY_MS + DAY_MS - offsetMs;
}

export const dailySeed = (dayKey) => `seelogd-daily-v${DAILY_SEED_VERSION}-${dayKey}`;
export const dailyBoardId = (dayKey) => `scene_daily_${dayKey}`;

/**
 * Kesintisiz oynama serisi: bugün veya dün oynadıysa korunur, daha eskiyse
 * KIRILMIŞTIR (0). Firestore'daki sayaç yalnızca bir sonraki oyunda güncellenir;
 * ekran, oynamadığı günlerde eski seriyi göstermesin diye burada süzülür.
 */
export function effectiveStreak(count, lastDayKey, now = Date.now()) {
  const n = Number(count) || 0;
  if (!n || !lastDayKey) return 0;
  const today = dayKeyOf(now);
  if (lastDayKey === today || lastDayKey === previousDayKey(today)) return n;
  return 0;
}

/** Bir oyunun biteceği gün için yeni seri değeri (transaction içinde kullanılır). */
export function nextStreak(count, lastDayKey, todayKey) {
  if (lastDayKey === todayKey) return Math.max(1, Number(count) || 0);
  if (lastDayKey && lastDayKey === previousDayKey(todayKey)) return (Number(count) || 0) + 1;
  return 1;
}

/**
 * Oyun Merkezi / Hub modülünün kullandığı günlük görünüm.
 *   status: "available" → bugün henüz oynanmadı
 *           "completed" → bugünkü deneme kullanıldı (result dolu)
 */
export function buildDailyView(stats, now = Date.now()) {
  const dayKey = dayKeyOf(now);
  const state = stats?.dailyState;
  const completed = Boolean(state && state.dayKey === dayKey);
  return {
    dayKey,
    status: completed ? "completed" : "available",
    expiresAt: nextDayStartMs(now),
    questionCount: DAILY_QUESTION_COUNT,
    rewardXp: DAILY_BONUS_XP,
    streak: effectiveStreak(stats?.dailyStreak, stats?.lastDailyDay, now),
    result: completed
      ? {
          score: Number(state.score) || 0,
          correct: Number(state.correctCount) || 0,
          total: Number(state.totalCount) || DAILY_QUESTION_COUNT,
          outcome: state.outcome || "completed",
          xpEarned: Number(state.xpEarned) || 0,
        }
      : null,
  };
}

/** "05:42" biçiminde kalan süre (saat:dakika). */
export function formatRemaining(expiresAt, now = Date.now()) {
  const remaining = Math.max(0, Number(expiresAt) - Number(now));
  if (!Number.isFinite(remaining)) return "--:--";
  const hours = Math.floor(remaining / HOUR_MS);
  const minutes = Math.floor((remaining % HOUR_MS) / 60000);
  return `${pad2(hours)}:${pad2(minutes)}`;
}
