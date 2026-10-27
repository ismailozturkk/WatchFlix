// utils/quickGames.js
//
// "Hızlı oyunlar"ın SAF çekirdeği: Sahne Tahmin'in başlık havuzundan (yıl, oy sayısı, tür kimlikleri, film/dizi)
// kurulan, üç canlı, art arda doğru sayısı skor olan kısa sorular. RN/Firebase importu YOK.
// "Önce hangisi?" (utils/olderGame.js) bu ailenin ilk üyesidir; aşağıdakiler aynı iskeleti kullanır:
//
//   popular : iki afiş — hangisi DAHA ÇOK OY ALDI (TMDB oy sayısı = "kaç kişi izlemiş/oylamış" göstergesi)
//   decade  : bir afiş — hangi ON YIL? (dört şık)
//   kind    : bir afiş — FİLM Mİ, DİZİ Mİ?
//   genre   : bir afiş — hangi TÜR? (dört şık)
//   blur    : bulanık afiş — HANGİ YAPIM? (dört başlık şıkkı). ZAMANLI: afiş %50 bulanık başlar, süre aktıkça
//             netleşir; puan da aynı oranda düşer (erken bilen çok alır). Skor = puan TOPLAMI, doğru sayısı ayrı.
//             Süre dolarsa yanlış sayılır (can gider).
//
// SORU KAYNAĞI: havuz öğelerinde yıl, oy SAYISI, tür kimlikleri ve film/dizi bilgisi var; oy ORTALAMASI ve oyuncu
// kadrosu YOK. Bu yüzden "hangisinin puanı yüksek" ya da "baş rolde kim" soruları kasten yok (her başlığı TMDB'den
// çekmek ağ + kota ister ve çevrimdışı bozulur).
//
// ZORLUK seriyle yükselir (her oyunda farklı kolu var): oy oranı küçülür, on yıl şıkları birbirine yaklaşır, türde
// şıklar bilindik türlerden seçilir, "film mi dizi mi"de başlık gizlenir.
//
// Skor kaydı cihaz-yerel (Keys.quickGames); liderlik / XP / günlük hak YOK.

import { OLDER_LIVES, isUsable, keyOfItem, normalizeOlderStats, recordOlderRun } from "./olderGame";
import { shuffleWith } from "./seededRandom";

export const QUICK_LIVES = OLDER_LIVES;
export const QUICK_RECENT_WINDOW = 40;
export const QUICK_GAME_IDS = Object.freeze(["popular", "decade", "kind", "genre", "blur"]);
export const isQuickGame = (id) => QUICK_GAME_IDS.includes(id);

/**
 * Ekran düzeni: pair = iki afiş yan yana, single = tek büyük afiş + şık düğmeleri, blur = netleşen afiş + başlık
 * şıkları. `timed`: soru başına geri sayım ve süreye bağlı puan (bkz. "Bulanık afiş" bölümü).
 */
export const QUICK_GAME_META = Object.freeze({
  popular: { layout: "pair", icon: "people", colors: ["#F97316", "#C2410C"] },
  decade: { layout: "single", icon: "hourglass", colors: ["#0EA5E9", "#1D4ED8"] },
  kind: { layout: "single", icon: "film", colors: ["#EC4899", "#9D174D"] },
  genre: { layout: "single", icon: "pricetags", colors: ["#10B981", "#047857"] },
  blur: { layout: "blur", icon: "eye", colors: ["#A855F7", "#7E22CE"], timed: true },
});
export const isTimedQuickGame = (id) => !!QUICK_GAME_META[id]?.timed;

// ── Tür kimlikleri ───────────────────────────────────────────────────────────

/** Kanonik türler (şık olarak çıkabilenler). */
export const QUICK_GENRES = Object.freeze([
  "action", "adventure", "animation", "comedy", "crime", "documentary", "drama", "family", "fantasy",
  "history", "horror", "music", "mystery", "romance", "scifi", "thriller", "war", "western",
]);
// Bilindik türler: zor seviyede şıklar bunlardan gelir (akla yatkın yanlışlar).
const COMMON_GENRES = Object.freeze(["drama", "comedy", "action", "thriller", "adventure", "scifi", "romance", "crime"]);

// TMDB film + dizi tür kimlikleri → kanonik. Haber / realite / talk show / TV filmi şık olamaz (atlanır).
const TMDB_GENRE = Object.freeze({
  28: "action", 12: "adventure", 16: "animation", 35: "comedy", 80: "crime", 99: "documentary", 18: "drama",
  10751: "family", 14: "fantasy", 36: "history", 27: "horror", 10402: "music", 9648: "mystery", 10749: "romance",
  878: "scifi", 53: "thriller", 10752: "war", 37: "western",
  10759: "action", 10762: "family", 10765: "scifi", 10766: "drama", 10768: "war",
});

/** Öğenin kanonik türleri (tekrarsız, bilinmeyen kimlikler atılır). */
export function canonGenresOf(item) {
  const ids = Array.isArray(item?.genreIds) ? item.genreIds : [];
  return [...new Set(ids.map((id) => TMDB_GENRE[id]).filter(Boolean))];
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

const yearOf = (item) => Number(String(item?.year ?? "").slice(0, 4));
export const decadeOf = (year) => Math.floor(Number(year) / 10) * 10;
const votesOf = (item) => Math.max(0, Number(item?.voteCount) || 0);

const pickOne = (list, rng) => list[Math.floor(rng() * list.length)];

/** Havuzdan, yakın zamanda sorulmamış öğeler (yetmezse tümü). */
function freshOf(pool, recent, min = 1, maxYear) {
  const usable = (Array.isArray(pool) ? pool : []).filter((item) => isUsable(item, maxYear));
  const fresh = usable.filter((item) => !recent.has(keyOfItem(item)));
  return fresh.length >= min ? fresh : usable;
}

// ── Oy sayısı oranı (popular) ────────────────────────────────────────────────

/** Seri → iki yapımın oy sayısı arasındaki EN KÜÇÜK oran (büyük/küçük). */
export function ratioForStreak(streak) {
  const s = Math.max(0, Math.trunc(Number(streak)) || 0);
  if (s < 3) return 8;
  if (s < 6) return 4;
  if (s < 10) return 2.5;
  if (s < 15) return 1.8;
  if (s < 22) return 1.4;
  return 1.2;
}
const MIN_VOTES = 50; // az oylu yapımlarda oran anlamsız (ve bilinmez)

function popularQuestion({ pool, streak, recent, rng, maxYear }) {
  const base = freshOf(pool, recent, 2, maxYear).filter((item) => votesOf(item) >= MIN_VOTES);
  if (base.length < 2) return null;
  const target = ratioForStreak(streak);
  const steps = [target, target * 0.75, target * 0.5, 1.15].map((r) => Math.max(1.15, r));
  for (const ratio of steps) {
    const first = pickOne(base, rng);
    let candidates = base.filter((item) => item !== first && Math.max(votesOf(item), votesOf(first)) / Math.min(votesOf(item), votesOf(first)) >= ratio);
    let left = first;
    if (candidates.length === 0) {
      const pairs = [];
      for (let i = 0; i < base.length; i += 1) {
        for (let j = i + 1; j < base.length; j += 1) {
          const hi = Math.max(votesOf(base[i]), votesOf(base[j]));
          const lo = Math.min(votesOf(base[i]), votesOf(base[j]));
          if (hi / lo >= ratio) pairs.push([base[i], base[j]]);
        }
      }
      if (pairs.length === 0) continue;
      const [x, y] = pickOne(pairs, rng);
      left = x;
      candidates = [y];
    }
    const right = pickOne(candidates, rng);
    const flip = rng() < 0.5;
    const a = flip ? right : left;
    const b = flip ? left : right;
    if (votesOf(a) === votesOf(b)) continue;
    return {
      gameId: "popular",
      layout: "pair",
      items: [a, b],
      showTitle: true,
      options: [{ key: keyOfItem(a) }, { key: keyOfItem(b) }],
      correctKey: keyOfItem(votesOf(a) > votesOf(b) ? a : b),
      facts: { votes: [votesOf(a), votesOf(b)] },
    };
  }
  return null;
}

// ── On yıl (decade) ──────────────────────────────────────────────────────────

const FIRST_OPTION_DECADE = 1920;

function decadeQuestion({ pool, streak, recent, rng, maxYear }) {
  const base = freshOf(pool, recent, 1, maxYear);
  if (base.length === 0) return null;
  const item = pickOne(base, rng);
  const correct = decadeOf(yearOf(item));
  const currentDecade = decadeOf(maxYear ?? new Date().getFullYear() + 1);
  const all = [];
  for (let d = FIRST_OPTION_DECADE; d <= currentDecade; d += 10) if (d !== correct) all.push(d);
  // Erken: uzak on yıllar (kolay ayırt edilir). Sonra: yakın on yıllar (≤ 20 yıl).
  const hard = streak >= 4;
  const near = all.filter((d) => Math.abs(d - correct) <= 20);
  const far = all.filter((d) => Math.abs(d - correct) >= 20);
  const preferred = shuffleWith(hard ? near : far, rng);
  const rest = shuffleWith(all.filter((d) => !preferred.includes(d)), rng);
  const distractors = [...preferred, ...rest].slice(0, 3);
  if (distractors.length < 3) return null;
  const options = [correct, ...distractors].sort((a, b) => a - b).map((d) => ({ key: String(d) }));
  return {
    gameId: "decade",
    layout: "single",
    items: [item],
    showTitle: true,
    options,
    correctKey: String(correct),
    facts: { year: yearOf(item) },
  };
}

// ── Film mi, dizi mi (kind) ──────────────────────────────────────────────────

/** Başlık, serinin bu eşiğinden sonra gizlenir (yalnız afiş). */
export const KIND_HIDE_TITLE_AT = 8;

function kindQuestion({ pool, streak, recent, rng, maxYear }) {
  const base = freshOf(pool, recent, 1, maxYear);
  const movies = base.filter((item) => item.type !== "tv");
  const shows = base.filter((item) => item.type === "tv");
  if (movies.length === 0 || shows.length === 0) return null; // tek tür varsa soru anlamsız
  // %50/%50: önce tür, sonra o türden öğe (havuzda film çoksa dizi seyrelmesin).
  const item = pickOne(rng() < 0.5 ? movies : shows, rng);
  const options = shuffleWith([{ key: "movie" }, { key: "tv" }], rng);
  return {
    gameId: "kind",
    layout: "single",
    items: [item],
    showTitle: streak < KIND_HIDE_TITLE_AT,
    options,
    correctKey: item.type === "tv" ? "tv" : "movie",
    facts: { year: yearOf(item) },
  };
}

// ── Tür (genre) ──────────────────────────────────────────────────────────────

function genreQuestion({ pool, streak, recent, rng, maxYear }) {
  const base = freshOf(pool, recent, 1, maxYear).filter((item) => canonGenresOf(item).length > 0);
  if (base.length === 0) return null;
  const item = pickOne(base, rng);
  const own = canonGenresOf(item);
  const correct = pickOne(own, rng);
  // Öğenin KENDİ türü olan hiçbir şık yanlış sayılmamalı (ör. "Aksiyon" doğru, "Macera" da öğenin türü → belirsiz).
  const forbidden = new Set(own);
  const common = COMMON_GENRES.filter((g) => !forbidden.has(g));
  const anyOther = QUICK_GENRES.filter((g) => !forbidden.has(g));
  const pool1 = streak >= 5 && common.length >= 3 ? common : anyOther;
  const distractors = shuffleWith(pool1, rng).slice(0, 3);
  if (distractors.length < 3) return null;
  const options = shuffleWith([correct, ...distractors], rng).map((key) => ({ key }));
  return {
    gameId: "genre",
    layout: "single",
    items: [item],
    showTitle: true,
    options,
    correctKey: correct,
    facts: { genres: own },
  };
}

// ── Bulanık afiş (blur) ──────────────────────────────────────────────────────
//
// TEK SAAT: tur süresi. Bulanıklık ve puan aynı "kalan süre oranı"ndan (1 → 0) türer, yani ekranda gördüğün
// netlik ile kazanacağın puan her an birbirini tutar:
//   bulanıklık = BLUR_START × kalan      (%50 → %0; %100 = afiş hiç seçilmez, bkz. BlurPoster'daki yarıçap)
//   puan       = MIN + (MAX − MIN) × kalan (100 → 10; süre dolunca 0 ve yanlış)
// Sayaç afiş YÜKLENİNCE başlar (hook: arm) — yavaş ağ oyuncunun puanını yemesin.

export const BLUR_ROUND_MS = 10000;
export const BLUR_START = 0.5;
export const BLUR_MAX_POINTS = 100;
export const BLUR_MIN_POINTS = 10;
/** Bu kadar doğrudan sonra yanlış şıklar benzer yapımlardan (ortak tür ya da ±10 yıl) seçilir. */
export const BLUR_SIMILAR_AT = 5;

/** Geçen süre → kalan oran (1 → 0). */
export function blurRemaining(elapsedMs, durationMs = BLUR_ROUND_MS) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  return Math.max(0, 1 - elapsed / durationMs);
}

/** Geçen süre → bulanıklık oranı (BLUR_START → 0). */
export const blurAmount = (elapsedMs, durationMs = BLUR_ROUND_MS) => BLUR_START * blurRemaining(elapsedMs, durationMs);

/** Geçen süre → doğru cevabın puanı (MAX → MIN); süre dolduysa 0. */
export function blurPoints(elapsedMs, durationMs = BLUR_ROUND_MS) {
  const remaining = blurRemaining(elapsedMs, durationMs);
  if (remaining <= 0) return 0;
  return Math.round(BLUR_MIN_POINTS + (BLUR_MAX_POINTS - BLUR_MIN_POINTS) * remaining);
}

const titleKeyOf = (item) => String(item?.title || "").trim().toLocaleLowerCase();

function blurQuestion({ pool, streak, recent, rng, maxYear }) {
  const usable = (Array.isArray(pool) ? pool : []).filter((item) => isUsable(item, maxYear) && titleKeyOf(item));
  const base = freshOf(usable, recent, 1, maxYear);
  if (base.length === 0) return null;
  const item = pickOne(base, rng);
  // Aynı adlı iki şık (yeniden çevrim, aynı adlı dizi) cevabı belirsiz yapar: başlıklar tekil.
  const taken = new Set([titleKeyOf(item)]);
  const others = usable.filter((other) => other !== item && !taken.has(titleKeyOf(other)));
  // Film sorusunda film, dizi sorusunda dizi şıkları ("dizi olan tek şık" ipucu vermesin); yetmezse karışık.
  const sameKind = others.filter((other) => (other.type === "tv") === (item.type === "tv"));
  const kindPool = sameKind.length >= 3 ? sameKind : others;
  const own = new Set(canonGenresOf(item));
  const year = yearOf(item);
  const similar = kindPool.filter(
    (other) => canonGenresOf(other).some((g) => own.has(g)) || Math.abs(yearOf(other) - year) <= 10,
  );
  const preferred = streak >= BLUR_SIMILAR_AT ? shuffleWith(similar, rng) : [];
  const ordered = [...preferred, ...shuffleWith(kindPool.filter((other) => !preferred.includes(other)), rng)];
  const distractors = [];
  for (const other of ordered) {
    const key = titleKeyOf(other);
    if (taken.has(key)) continue;
    taken.add(key);
    distractors.push(other);
    if (distractors.length === 3) break;
  }
  if (distractors.length < 3) return null;
  const options = shuffleWith([item, ...distractors], rng).map((option) => ({ key: keyOfItem(option), title: option.title }));
  return {
    gameId: "blur",
    layout: "blur",
    items: [item],
    showTitle: false,
    options,
    correctKey: keyOfItem(item),
    facts: { year },
  };
}

const BUILDERS = { popular: popularQuestion, decade: decadeQuestion, kind: kindQuestion, genre: genreQuestion, blur: blurQuestion };

/**
 * Bir sonraki soru. Havuz o oyun için yetersizse null (çağıran hata durumuna geçer).
 *
 * @param {string} gameId
 * @param {{ pool: Array, streak?: number, recent?: Set<string>, rng?: () => number, maxYear?: number }} p
 */
export function buildQuickQuestion(gameId, { pool, streak = 0, recent = new Set(), rng = Math.random, maxYear } = {}) {
  const build = BUILDERS[gameId];
  return build ? build({ pool, streak, recent, rng, maxYear }) : null;
}

/** @returns {{ correct: boolean, correctKey: string }} */
export function judgeQuickAnswer(question, chosenKey) {
  return { correct: chosenKey === question.correctKey, correctKey: question.correctKey };
}

export const questionItemKeys = (question) => question.items.map(keyOfItem);

/** Yakın-zaman penceresine ekler (en eski çıkar). */
export function pushQuickRecent(recent, question, windowSize = QUICK_RECENT_WINDOW) {
  return new Set([...recent, ...questionItemKeys(question)].slice(-windowSize));
}

// ── Kayıt (oyun başına) ──────────────────────────────────────────────────────

/** Depodan okunan ham değer → { [oyun]: {best, plays, correct, answered} } (yalnız bilinen oyunlar). */
export function normalizeQuickStats(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = {};
  QUICK_GAME_IDS.forEach((id) => {
    const stats = normalizeOlderStats(source[id]);
    if (stats.plays > 0) out[id] = stats;
  });
  return out;
}

/**
 * Biten koşuyu o oyunun kaydına işler.
 * @returns {{ all: object, stats: object, newBest: boolean, previousBest: number }}
 */
export function recordQuickRun(raw, gameId, run) {
  const all = normalizeQuickStats(raw);
  if (!isQuickGame(gameId)) return { all, stats: normalizeOlderStats(null), newBest: false, previousBest: 0 };
  const result = recordOlderRun(all[gameId], run);
  return { all: { ...all, [gameId]: result.stats }, stats: result.stats, newBest: result.newBest, previousBest: result.previousBest };
}

export const statsOfQuickGame = (raw, gameId) => normalizeOlderStats(normalizeQuickStats(raw)[gameId]);

/** Depoya yazılacak değer: hiç oynanmadıysa `null` (anahtar silinir). */
export const toStoredQuickStats = (all) => {
  const normalized = normalizeQuickStats(all);
  return Object.keys(normalized).length ? normalized : null;
};
