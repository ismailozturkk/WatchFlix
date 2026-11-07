// utils/dailyFrame.js
//
// "Günün Karesi"nin (Framed tarzı günlük film oyunu) SAF çekirdeği. RN / Firebase / TMDB importu YOK.
// Ayrıntılı tasarım: docs/ozellikler/GUNUN_KARESI.md.
//
//   • Gün numarası ve yuva permütasyonu: hangi gün TMDB "en iyi filmler" listesinin hangi yuvası (tekrarsız).
//   • Kare seçimi: dilsiz sahne karelerinden 6'sı, zor → kolay.
//   • Oyun durumu: tahmin / geç, 6 hak, ipucu basamakları.
//   • Seri + dağılım istatistiği ve paylaşım metni (emoji kutucukları).
//
// Gün sınırı Günlük Meydan Okuma ile aynı (utils/dailyChallenge.dayKeyOf, TR 00:00 — herkese aynı gün).

import { effectiveStreak, previousDayKey } from "./dailyChallenge";

export const FRAME_MAX_GUESSES = 6;
export const FRAME_COUNT = 6;
/** #1 bulmacanın günü. Değiştirilirse bütün numaralar ve yuvalar kayar — DOKUNMA. */
export const FRAME_EPOCH_DAY = "2026-10-30";

// Yuva uzayı: TMDB movie/top_rated ilk FRAME_PAGES sayfası × sayfa başına FRAME_PAGE_SIZE film.
export const FRAME_PAGES = 20;
export const FRAME_PAGE_SIZE = 20;
export const FRAME_SLOTS = FRAME_PAGES * FRAME_PAGE_SIZE;
// FRAME_SLOTS ile aralarında asal → n ↦ (STRIDE·n + OFFSET) mod SLOTS bir permütasyon: 400 gün tekrarsız.
// Büyük adım ardışık günleri listenin uzak yerlerine düşürür (aynı dönemden iki film art arda gelmesin).
export const FRAME_STRIDE = 263;
export const FRAME_OFFSET = 137;

/** Kayıtta tutulan gün sayısı (eski günler atılır). */
export const FRAME_HISTORY_DAYS = 30;

/** Kare n (1 tabanlı) açılınca görünen ek ipuçları. */
export const FRAME_HINT_STEPS = Object.freeze({ genres: 3, year: 4, director: 5, initial: 6 });

const DAY_MS = 86400000;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const dayIndexOf = (dayKey) => {
  const match = DAY_PATTERN.exec(String(dayKey || ""));
  if (!match) return null;
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS);
};

/** "2026-10-30" → 1, ertesi gün → 2 … İlk günden önceki ya da bozuk anahtar → 0. */
export function puzzleNumberOf(dayKey) {
  const day = dayIndexOf(dayKey);
  const epoch = dayIndexOf(FRAME_EPOCH_DAY);
  if (day === null || day < epoch) return 0;
  return day - epoch + 1;
}

/** Bulmaca numarası → yuva [0, FRAME_SLOTS). */
export function slotOfPuzzle(number) {
  const n = Math.max(0, Math.trunc(Number(number)) || 0);
  return (FRAME_STRIDE * n + FRAME_OFFSET) % FRAME_SLOTS;
}

/** Yuva → { page (1 tabanlı), index (sayfa içi, kimliğe göre sıralı) }. */
export function slotPosition(slot) {
  const s = ((Math.trunc(Number(slot)) || 0) % FRAME_SLOTS + FRAME_SLOTS) % FRAME_SLOTS;
  return { page: Math.floor(s / FRAME_PAGE_SIZE) + 1, index: s % FRAME_PAGE_SIZE };
}

/**
 * Sayfadaki adayların deneme sırası: yuvanın gösterdiği film başta, sonra sayfanın kalanı sırayla (sona gelince
 * başa sarar). Sayfa kimliğe göre sıralanır — TMDB'nin sayfa içi sırası puanla gün içinde oynayabilir.
 * @param {Array<{id:number}>} pageItems
 */
export function candidateOrder(pageItems, index) {
  const sorted = (Array.isArray(pageItems) ? pageItems : [])
    .filter((item) => item && Number.isFinite(Number(item.id)))
    .sort((a, b) => Number(a.id) - Number(b.id));
  if (sorted.length === 0) return [];
  const start = Math.max(0, Math.trunc(Number(index)) || 0) % sorted.length;
  return [...sorted.slice(start), ...sorted.slice(0, start)];
}

// ── Kareler ──────────────────────────────────────────────────────────────────

const isTextless = (image) => image && image.file_path && !image.iso_639_1;
const aspectOk = (image) => {
  const ratio = Number(image.aspect_ratio) || 0;
  return ratio >= 1.6 && ratio <= 2.0;
};

/**
 * Bulmacanın 6 karesi, GÖSTERİM sırasıyla (1. kare = en zor). TMDB görsel listesi oy sırasındadır (baştakiler en
 * ikonik): kareler listeye eşit aralıkla yayılır, sondan başa gösterilir. Rastgelelik yok → herkeste aynı.
 * Nitelikli (dilsiz, ~16:9, geniş) kare FRAME_COUNT'tan azsa null — bu film günün bulmacası olamaz.
 *
 * @param {Array<{file_path:string, width:number, aspect_ratio:number, iso_639_1:string|null}>} backdrops
 * @returns {string[]|null} file_path listesi
 */
export function selectFrames(backdrops, count = FRAME_COUNT) {
  const textless = (Array.isArray(backdrops) ? backdrops : []).filter((b) => isTextless(b) && aspectOk(b));
  const sharp = textless.filter((b) => (Number(b.width) || 0) >= 1280);
  const pool = sharp.length >= count ? sharp : textless.filter((b) => (Number(b.width) || 0) >= 780);
  const unique = [];
  const seen = new Set();
  pool.forEach((image) => {
    if (seen.has(image.file_path)) return;
    seen.add(image.file_path);
    unique.push(image.file_path);
  });
  if (unique.length < count) return null;
  const last = unique.length - 1;
  const picked = [];
  for (let k = 0; k < count; k += 1) {
    // k = 0 → listenin sonu (en az bilinen), k = count-1 → listenin başı (en tanınır).
    picked.push(unique[Math.round(last * (1 - k / (count - 1)))]);
  }
  return picked;
}

// ── Oyun durumu ──────────────────────────────────────────────────────────────

const MAX_TITLE = 120;
const YEAR_PATTERN = /^\d{4}$/;
const POSTER_PATTERN = /^\/[\w.-]{1,100}$/;

/** Kayda yazılan tahmin: kimlik + başlık; sonuç ekranında gösterilsin diye varsa yıl ve afiş yolu. */
function guessEntry(raw) {
  const entry = { key: raw.key, title: String(raw.title || "").slice(0, MAX_TITLE) };
  const year = String(raw.year || "");
  if (YEAR_PATTERN.test(year)) entry.year = year;
  if (typeof raw.posterPath === "string" && POSTER_PATTERN.test(raw.posterPath)) entry.posterPath = raw.posterPath;
  return entry;
}

/**
 * Tek günün oyun kaydı.
 *   guesses: [{ key: "movie_603", title, year?, posterPath? }] | [{ skip: true }]
 *   status : "playing" | "won" | "lost"
 */
export function emptyRound(dayKey, answerKey) {
  return { dayKey, answerKey, guesses: [], status: "playing" };
}

/** Şu an açık olan kare (1 tabanlı). Oyun bitince hepsi açık. */
export function openFrameCount(round) {
  if (!round) return 1;
  if (round.status !== "playing") return FRAME_COUNT;
  return Math.min(FRAME_COUNT, (round.guesses?.length || 0) + 1);
}

/** Açık kare sayısına göre görünen ipuçları. */
export function visibleHints(round) {
  const open = openFrameCount(round);
  return {
    genres: open >= FRAME_HINT_STEPS.genres,
    year: open >= FRAME_HINT_STEPS.year,
    director: open >= FRAME_HINT_STEPS.director,
    initial: open >= FRAME_HINT_STEPS.initial,
  };
}

/** Bu kare (1 tabanlı) açılınca HANGİ ipucu açılır? Yoksa null. Sonuç ekranının adım adım dökümü için. */
export function hintAtFrame(frame) {
  const n = Math.trunc(Number(frame)) || 0;
  return Object.keys(FRAME_HINT_STEPS).find((key) => FRAME_HINT_STEPS[key] === n) || null;
}

/**
 * Baş harf ipucu: başlığın ilk harfi ya da rakamı; baştaki tırnak / noktalama atlanır ("'71" → "7", "(500) Days" → "5").
 * Hiçbiri yoksa ilk karakter.
 */
export function initialOf(title) {
  const text = String(title || "").trim();
  if (!text) return "";
  const letter = text.match(/[\p{L}\p{N}]/u);
  return (letter ? letter[0] : text.charAt(0)).toLocaleUpperCase();
}

/** Bu film bugün zaten denendi mi (aynı tahmin hak yemez)? */
export const alreadyGuessed = (round, key) => (round?.guesses || []).some((g) => g.key && g.key === key);

/**
 * Bir tahmin ya da geç uygular. Oyun bitmişse, tahmin geçersizse ya da aynı film tekrar denendiyse kayıt AYNEN döner
 * (`changed: false`).
 * @param {{ key?: string, title?: string, skip?: boolean }} guess
 * @returns {{ round: object, changed: boolean, correct: boolean }}
 */
export function applyGuess(round, guess) {
  if (!round || round.status !== "playing") return { round, changed: false, correct: false };
  let entry;
  if (guess?.skip) entry = { skip: true };
  else if (guess?.key && typeof guess.key === "string") {
    if (alreadyGuessed(round, guess.key)) return { round, changed: false, correct: false };
    entry = guessEntry(guess);
  } else return { round, changed: false, correct: false };
  const correct = !entry.skip && entry.key === round.answerKey;
  const guesses = [...round.guesses, entry];
  const status = correct ? "won" : guesses.length >= FRAME_MAX_GUESSES ? "lost" : "playing";
  return { round: { ...round, guesses, status }, changed: true, correct };
}

/** Kutucuk dizisi: "miss" | "skip" | "hit" | "empty", her zaman FRAME_MAX_GUESSES uzunlukta. */
export function roundMarks(round) {
  const marks = (round?.guesses || []).slice(0, FRAME_MAX_GUESSES).map((g) =>
    g.skip ? "skip" : g.key === round.answerKey ? "hit" : "miss",
  );
  while (marks.length < FRAME_MAX_GUESSES) marks.push("empty");
  return marks;
}

const MARK_EMOJI = { miss: "🟥", skip: "⬜", hit: "🟩", empty: "⬛" };
export const marksToEmoji = (marks) => (marks || []).map((m) => MARK_EMOJI[m] || MARK_EMOJI.empty).join(" ");

/** Kaçıncı tahminde bilindi (1–6); bilinmediyse null. */
export function solvedAt(round) {
  if (round?.status !== "won") return null;
  return round.guesses.length;
}

/**
 * Dışarı paylaşım metni. Cevabı İÇERMEZ (spoiler olmasın).
 * @param {{ title: string, number: number, marks: string[], footer?: string }} p
 */
export function buildShareText({ title, number, marks, footer }) {
  const lines = [`${title} #${number}`, `🎬 ${marksToEmoji(marks)}`];
  if (footer) lines.push(footer);
  return lines.join("\n");
}

// ── İstatistik ───────────────────────────────────────────────────────────────

export function emptyFrameStats() {
  return { played: 0, won: 0, streak: 0, bestStreak: 0, lastDay: null, lastWinDay: null, dist: [0, 0, 0, 0, 0, 0] };
}

const count = (value) => Math.max(0, Math.trunc(Number(value)) || 0);
const dayOrNull = (value) => (typeof value === "string" && DAY_PATTERN.test(value) ? value : null);

export function normalizeFrameStats(raw) {
  const base = emptyFrameStats();
  if (!raw || typeof raw !== "object") return base;
  const dist = Array.isArray(raw.dist) ? raw.dist : [];
  return {
    played: count(raw.played),
    won: count(raw.won),
    streak: count(raw.streak),
    bestStreak: count(raw.bestStreak),
    lastDay: dayOrNull(raw.lastDay),
    lastWinDay: dayOrNull(raw.lastWinDay),
    dist: base.dist.map((_, i) => count(dist[i])),
  };
}

/**
 * Biten günü istatistiğe işler. Aynı gün ikinci kez işlenmez. Seri = ardışık KAZANILAN günler: kayıp ya da
 * atlanan gün seriyi bitirir.
 */
export function recordFrameResult(rawStats, round) {
  const stats = normalizeFrameStats(rawStats);
  if (!round || round.status === "playing" || !dayOrNull(round.dayKey)) return stats;
  if (stats.lastDay === round.dayKey) return stats;
  const next = { ...stats, dist: [...stats.dist], played: stats.played + 1, lastDay: round.dayKey };
  if (round.status === "won") {
    const continued = stats.lastWinDay && stats.lastWinDay === previousDayKey(round.dayKey);
    next.won = stats.won + 1;
    next.streak = continued ? stats.streak + 1 : 1;
    next.bestStreak = Math.max(stats.bestStreak, next.streak);
    next.lastWinDay = round.dayKey;
    const at = solvedAt(round);
    if (at) next.dist[at - 1] += 1;
  } else {
    next.streak = 0;
  }
  return next;
}

/** Ekranda görünen seri: son kazanılan gün bugün ya da dün değilse kırılmıştır. */
export const visibleFrameStreak = (stats, now = Date.now()) =>
  effectiveStreak(stats?.streak, stats?.lastWinDay, now);

// ── Depo ─────────────────────────────────────────────────────────────────────

function normalizeRound(dayKey, raw) {
  if (!raw || typeof raw !== "object" || typeof raw.answerKey !== "string") return null;
  const guesses = (Array.isArray(raw.guesses) ? raw.guesses : [])
    .slice(0, FRAME_MAX_GUESSES)
    .map((g) => (g?.skip ? { skip: true } : typeof g?.key === "string" ? guessEntry(g) : null))
    .filter(Boolean);
  const status = ["playing", "won", "lost"].includes(raw.status) ? raw.status : "playing";
  return { dayKey, answerKey: raw.answerKey, guesses, status };
}

/** Depodan okunan ham değer → { rounds: { [gün]: round }, stats }. */
export function normalizeFrameStore(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const rounds = {};
  const days = source.rounds && typeof source.rounds === "object" ? Object.keys(source.rounds) : [];
  days
    .filter((day) => DAY_PATTERN.test(day))
    .sort()
    .slice(-FRAME_HISTORY_DAYS)
    .forEach((day) => {
      const round = normalizeRound(day, source.rounds[day]);
      if (round) rounds[day] = round;
    });
  return { rounds, stats: normalizeFrameStats(source.stats) };
}

/** Bir günün kaydını yazar; bitmişse istatistiğe de işler. Depoya yazılacak yeni değeri döner. */
export function storeRound(raw, round) {
  const store = normalizeFrameStore(raw);
  const rounds = { ...store.rounds, [round.dayKey]: { answerKey: round.answerKey, guesses: round.guesses, status: round.status } };
  const stats = round.status === "playing" ? store.stats : recordFrameResult(store.stats, round);
  return normalizeFrameStore({ rounds, stats });
}
