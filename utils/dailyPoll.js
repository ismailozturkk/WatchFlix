// utils/dailyPoll.js
//
// "Günün Sorusu" kararlarının SAF çekirdeği: günün sorusunu seçme, oy yüzdeleri ve cihaz-yerel oy kaydı.
// RN/Firebase importu YOK.
//
// SORU SEÇİMİ: bank (data/dailyPollQuestions) KALICI id'ye göre bir kez karıştırılır (sabit tuz); gün numarası bu
// sıranın içinde döner. Böylece (a) herkes aynı günde aynı soruyu görür, (b) bankadaki son soru dolana kadar tekrar yok,
// (c) yeni soru eklemek yalnız karışık sıranın içindeki yerini değiştirir. Gün TR günüdür (utils/dailyChallenge.dayKeyOf).
//
// YÜZDE EŞİĞİ: toplam oy az iken "%100 – %0" yanıltıcıdır; eşiğin altında yalnız sayı gösterilir (UI karar verir,
// burada `showPercent`).

import { DAILY_POLL_QUESTIONS } from "../data/dailyPollQuestions";
import { copyLanguage } from "./appLanguages";
import { hashString } from "./seededRandom";

export const POLL_MIN_VOTES_FOR_PERCENT = 5;
export const POLL_HISTORY_DAYS = 14;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86400000;
const EPOCH = Date.UTC(2026, 0, 1);

/** "YYYY-AA-GG" → 2026-01-01'den beri gün sayısı (negatif olabilir); geçersizse null. */
export function dayNumberOf(dayKey) {
  const m = DAY_RE.exec(String(dayKey || ""));
  if (!m) return null;
  const time = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(time) ? null : Math.round((time - EPOCH) / DAY_MS);
}

// Sabit sıra: id'nin tuzlu özeti. (Karışık ama tekrar edilebilir; sıralama çakışması id ile kırılır.)
const ORDER = [...DAILY_POLL_QUESTIONS].sort((a, b) => {
  const diff = hashString(`poll|${a.id}`) - hashString(`poll|${b.id}`);
  return diff || (a.id < b.id ? -1 : 1);
});

/** Günün sorusu (ham kayıt). Geçersiz gün anahtarı için null. */
export function questionForDay(dayKey, order = ORDER) {
  const n = dayNumberOf(dayKey);
  if (n === null || order.length === 0) return null;
  return order[((n % order.length) + order.length) % order.length];
}

/** Sorunun bir dildeki görünümü: { id, prompt, a, b }. Bilinmeyen dil İngilizce. */
export function localizeQuestion(question, language) {
  if (!question) return null;
  const lang = copyLanguage(language, ["tr", "en", "es", "pt", "de"]);
  const [prompt, a, b] = question[lang] || question.en;
  return { id: question.id, prompt, a, b };
}

/**
 * Sayaçtan yüzdeler. `counts` yoksa/bozuksa null.
 * @returns {{ a: number, b: number, total: number, percentA: number, percentB: number, showPercent: boolean } | null}
 */
export function pollShares(counts) {
  const a = Math.max(0, Math.trunc(Number(counts?.a)) || 0);
  const b = Math.max(0, Math.trunc(Number(counts?.b)) || 0);
  const total = a + b;
  if (total === 0) return null;
  const percentA = Math.round((a / total) * 100);
  return { a, b, total, percentA, percentB: 100 - percentA, showPercent: total >= POLL_MIN_VOTES_FOR_PERCENT };
}

// ── Parçalı sayaç ───────────────────────────────────────────────────────────
// Herkes aynı günün sayacına yazdığı için tek belge kilitleniyordu; oylar POLL_SHARD_COUNT parçaya dağılır
// (DailyPolls/{gün}/shards/{0..N-1}). firestore.rules parça kimliğini '^[0-9]$' ile sınırlar: sayı değişirse
// kural da değişmeli.
export const POLL_SHARD_COUNT = 10;

/** Oyun yazılacağı parça (0..POLL_SHARD_COUNT-1). `random` testte sabitlenir. */
export function pickPollShard(random = Math.random) {
  const n = Math.floor(Number(random()) * POLL_SHARD_COUNT);
  return Number.isInteger(n) && n >= 0 && n < POLL_SHARD_COUNT ? n : 0;
}

/**
 * Gün belgesi (eski istemcilerin sayacı) + parçalar → tek sayaç. Bozuk/eksik parça 0 sayılır.
 * @param {Array<{a?: number, b?: number} | null | undefined>} parts
 */
export function sumPollCounts(parts) {
  return (parts || []).reduce(
    (acc, part) => ({
      a: acc.a + (Math.max(0, Math.trunc(Number(part?.a)) || 0)),
      b: acc.b + (Math.max(0, Math.trunc(Number(part?.b)) || 0)),
    }),
    { a: 0, b: 0 },
  );
}

/** Benim oyum dahil edilmiş sayaç (sunucu henüz yansıtmadıysa iyimser gösterim için). */
export function withMyVote(counts, choice) {
  const a = Math.max(0, Math.trunc(Number(counts?.a)) || 0);
  const b = Math.max(0, Math.trunc(Number(counts?.b)) || 0);
  return choice === "a" ? { a: a + 1, b } : choice === "b" ? { a, b: b + 1 } : { a, b };
}

// ── Cihaz-yerel oy kaydı ────────────────────────────────────────────────────

/**
 * Depodan okunan ham değer → { [gün]: { choice: "a"|"b", synced: boolean } }; son 14 gün tutulur.
 * `synced`: oyun sunucuya yazıldığı doğrulandı mı (yazılamadıysa kart açıldığında yeniden denenir).
 */
export function normalizePollHistory(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  Object.keys(raw)
    .filter((day) => dayNumberOf(day) !== null)
    .sort()
    .slice(-POLL_HISTORY_DAYS)
    .forEach((day) => {
      const entry = raw[day];
      if (!entry || (entry.choice !== "a" && entry.choice !== "b")) return;
      out[day] = { choice: entry.choice, synced: entry.synced === true };
    });
  return out;
}

/** Oyu yerele işler. Aynı gün ikinci kez DEĞİŞTİRMEZ (ilk oy kalıcı; kural da böyle). */
export function recordPollVote(history, dayKey, choice, synced = false) {
  const current = normalizePollHistory(history);
  if (dayNumberOf(dayKey) === null || (choice !== "a" && choice !== "b")) return current;
  if (current[dayKey]) {
    // Kayıt zaten var: yalnız "senkronlandı" bayrağı yükselebilir.
    if (synced && !current[dayKey].synced) return normalizePollHistory({ ...current, [dayKey]: { ...current[dayKey], synced: true } });
    return history && typeof history === "object" && !Array.isArray(history) ? history : current;
  }
  return normalizePollHistory({ ...current, [dayKey]: { choice, synced: synced === true } });
}

export const toStoredPollHistory = (history) => {
  const normalized = normalizePollHistory(history);
  return Object.keys(normalized).length ? normalized : null;
};

/** Kaç gündür üst üste oy verildi (bugün dahil; bugün henüz verilmediyse dünden geriye). */
export function pollStreak(history, todayKey) {
  const normalized = normalizePollHistory(history);
  let n = dayNumberOf(todayKey);
  if (n === null) return 0;
  const keyOf = (num) => {
    const date = new Date(EPOCH + num * DAY_MS);
    const p = (x) => String(x).padStart(2, "0");
    return `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}`;
  };
  if (!normalized[keyOf(n)]) n -= 1;
  let streak = 0;
  while (normalized[keyOf(n)]) {
    streak += 1;
    n -= 1;
  }
  return streak;
}
