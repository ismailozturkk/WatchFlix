// utils/filmChain.js
//
// Film Zinciri'nin (docs/ozellikler/FILM_ZINCIRI.md) SAF çekirdeği: bulmaca seçimi (günlük / serbest), zincir
// adımları (ekle / geri al / çözüldü mü), puan ve yıldız, cihaz-yerel kayıt + günlük seri, paylaşım metni.
// React/RN/Firebase bağımlılığı yok. Kenar kuralı (hangi film / oyuncu seçilebilir) ayrı: utils/filmChainRules.js.
//
// ZİNCİR: düğüm dizisi. İlk düğüm başlangıç oyuncusu (silinmez), sonra film / oyuncu sırayla:
//   [kişi A] → [film] → [kişi] → [film] → … → [kişi hedef]
// "Halka sayısı" = zincirdeki FİLM sayısı (Six Degrees'in "derece"si). En çok CHAIN_MAX_FILMS.

import { FILM_CHAIN_PUZZLES } from "../data/filmChainPuzzles";
import { dayKeyOf, previousDayKey } from "./dailyChallenge";

export const CHAIN_MAX_FILMS = 6;
// Günlük bulmaca #1'in günü (TR). Numara paylaşımda görünür; değiştirmek herkesin numarasını kaydırır.
export const CHAIN_EPOCH_DAY = "2026-10-30";
export const CHAIN_DAYS_KEPT = 60;
export const CHAIN_MODES = Object.freeze(["daily", "free"]);
// Bulmaca başına ilk sonuç (sohbetteki meydan okuma kartı kıyas için okur); en yeni bu kadarı tutulur.
export const CHAIN_RESULTS_KEPT = 120;

const DAY_MS = 86400000;
const utcOfDay = (dayKey) => {
  const [y, m, d] = String(dayKey).split("-").map(Number);
  return y && m && d ? Date.UTC(y, m - 1, d) : NaN;
};

// ── Bulmaca seçimi ──────────────────────────────────────────────────────────

/** Günlük bulmaca numarası (1'den başlar; epoch'tan önceki günler de geçerli bir sayı alır). */
export function chainDayNumber(dayKey) {
  const diff = Math.round((utcOfDay(dayKey) - utcOfDay(CHAIN_EPOCH_DAY)) / DAY_MS);
  return Number.isFinite(diff) ? diff + 1 : 1;
}

/** Günün bulmacası: herkes aynı listeden aynı sırayla. `number` paylaşım numarası. */
export function dailyChainPuzzle(dayKey = dayKeyOf(), puzzles = FILM_CHAIN_PUZZLES) {
  if (!puzzles.length) return null;
  const number = chainDayNumber(dayKey);
  const index = (((number - 1) % puzzles.length) + puzzles.length) % puzzles.length;
  return { ...puzzles[index], number, dayKey };
}

/** Kimliğiyle bulmaca (sohbetteki meydan okumadan gelen); yoksa null (eski/yeni sürüm farkı). */
export function chainPuzzleById(id, puzzles = FILM_CHAIN_PUZZLES) {
  const puzzle = id ? puzzles.find((p) => p.id === id) : null;
  return puzzle ? { ...puzzle, number: null, dayKey: null } : null;
}

/** Serbest mod: rastgele bulmaca; `exclude` (kimlik kümesi) — bugünün günlüğü ve son oynananlar. */
export function randomChainPuzzle({ exclude = [], rng = Math.random, puzzles = FILM_CHAIN_PUZZLES } = {}) {
  const skip = new Set(exclude);
  const usable = puzzles.filter((p) => !skip.has(p.id));
  const list = usable.length ? usable : puzzles;
  if (!list.length) return null;
  return { ...list[Math.floor(rng() * list.length) % list.length], number: null, dayKey: null };
}

// ── Zincir ──────────────────────────────────────────────────────────────────

export const nodeKey = (node) => `${node?.kind}:${node?.id}`;

export const personNode = (p) => ({ kind: "person", id: p.id, name: p.name || "", profilePath: p.profilePath || null });
export const filmNode = (f) => ({ kind: "film", id: f.id, title: f.title || "", year: f.year || null, posterPath: f.posterPath || null });

export const startChain = (puzzle) => (puzzle?.start ? [personNode(puzzle.start)] : []);

export const chainFilmCount = (chain) => (Array.isArray(chain) ? chain.filter((n) => n.kind === "film").length : 0);

export function isChainSolved(chain, puzzle) {
  const last = Array.isArray(chain) ? chain[chain.length - 1] : null;
  return !!(last && chain.length > 1 && last.kind === "person" && puzzle?.target && last.id === puzzle.target.id);
}

/** Sıradaki seçimin türü: "film" | "person" | null (zincir bitti / boş). */
export function nextPickKind(chain, puzzle) {
  if (!Array.isArray(chain) || !chain.length || isChainSolved(chain, puzzle)) return null;
  return chain[chain.length - 1].kind === "person" ? "film" : "person";
}

/** Film halkası sınırı doldu mu (yeni film eklenemez, geri alınmalı). */
export const chainAtLimit = (chain, puzzle) =>
  nextPickKind(chain, puzzle) === "film" && chainFilmCount(chain) >= CHAIN_MAX_FILMS;

export const usedKeysOf = (chain) => new Set((chain || []).map(nodeKey));

/** Düğümü ekler. Geçersizse (tür sırası, tekrar, sınır, bitmiş zincir) AYNI diziyi döner. */
export function appendChainNode(chain, node, puzzle) {
  const kind = nextPickKind(chain, puzzle);
  if (!kind || !node || node.kind !== kind) return chain;
  if (usedKeysOf(chain).has(nodeKey(node))) return chain;
  if (kind === "film" && chainFilmCount(chain) >= CHAIN_MAX_FILMS) return chain;
  return [...chain, node.kind === "film" ? filmNode(node) : personNode(node)];
}

/** Son halkayı siler; başlangıç oyuncusu kalır. */
export const undoChainNode = (chain) => (Array.isArray(chain) && chain.length > 1 ? chain.slice(0, -1) : chain);

const fold = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .toLowerCase()
    .trim();

/** Seçenek listesi: zincirde kullanılanlar düşer, arama (aksan/büyük-küçük harf duyarsız) ad/başlık ve rolde. */
export function filterChainOptions(items, { query = "", used = new Set(), kind = "film" } = {}) {
  const q = fold(query);
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (used.has(`${kind}:${item.id}`)) return false;
    if (!q) return true;
    return fold(kind === "film" ? item.title : item.name).includes(q) || fold(item.character).includes(q);
  });
}

// ── Puan ────────────────────────────────────────────────────────────────────

/** 100 = en kısa; her fazla film −25, en az 10. Pes etmek 0. Par'dan kısa (TMDB verisi değiştiyse) yine 100. */
export function chainPoints(links, par, gaveUp = false) {
  if (gaveUp || !links) return 0;
  return Math.max(10, 100 - 25 * Math.max(0, links - par));
}

export function chainStars(links, par, gaveUp = false) {
  if (gaveUp || !links) return 0;
  const over = links - par;
  return over <= 0 ? 3 : over === 1 ? 2 : 1;
}

// ── Kayıt ───────────────────────────────────────────────────────────────────

const EMPTY_STATS = Object.freeze({ plays: 0, solved: 0, perfect: 0, gaveUp: 0, bestStreak: 0, days: {}, results: {} });
const count = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);

function normalizeDay(record) {
  if (!record || typeof record !== "object") return null;
  const path = Array.isArray(record.path)
    ? record.path.filter((n) => n && (n.kind === "person" || n.kind === "film") && n.id)
    : [];
  return {
    puzzleId: String(record.puzzleId || ""),
    links: count(record.links),
    par: count(record.par),
    points: count(record.points),
    gaveUp: !!record.gaveUp,
    path,
  };
}

export function normalizeChainStats(raw) {
  if (!raw || typeof raw !== "object") return { ...EMPTY_STATS, days: {}, results: {} };
  const days = {};
  if (raw.days && typeof raw.days === "object") {
    Object.keys(raw.days).forEach((key) => {
      const day = normalizeDay(raw.days[key]);
      if (day && /^\d{4}-\d{2}-\d{2}$/.test(key)) days[key] = day;
    });
  }
  const results = {};
  if (raw.results && typeof raw.results === "object") {
    Object.keys(raw.results).forEach((id) => {
      const r = raw.results[id];
      if (!r || typeof r !== "object" || !/^\d+-\d+$/.test(id)) return;
      results[id] = { links: count(r.links), points: count(r.points), gaveUp: !!r.gaveUp };
    });
  }
  return {
    plays: count(raw.plays),
    solved: count(raw.solved),
    perfect: count(raw.perfect),
    gaveUp: count(raw.gaveUp),
    bestStreak: count(raw.bestStreak),
    days,
    results,
  };
}

/** Saklanacak biçim; hiç oynanmamışsa null (anahtar silinir). */
export function toStoredChainStats(stats) {
  const s = normalizeChainStats(stats);
  return s.plays === 0 && Object.keys(s.days).length === 0 && Object.keys(s.results).length === 0 ? null : s;
}

/** Günlük seri: bugün (ya da dün) dahil geriye kesintisiz ÇÖZÜLEN günler. */
export function chainStreak(stats, todayKey = dayKeyOf()) {
  const days = normalizeChainStats(stats).days;
  const solvedOn = (key) => days[key] && !days[key].gaveUp && days[key].links > 0;
  let key = solvedOn(todayKey) ? todayKey : previousDayKey(todayKey);
  let streak = 0;
  while (key && solvedOn(key)) {
    streak += 1;
    key = previousDayKey(key);
  }
  return streak;
}

export const dailyChainRecord = (stats, dayKey = dayKeyOf()) => normalizeChainStats(stats).days[dayKey] || null;

/** Bu bulmacadaki İLK sonucun (mod fark etmez) { links, points, gaveUp } ya da null. */
export const chainResultOf = (stats, puzzleId) => normalizeChainStats(stats).results[puzzleId] || null;

/**
 * Bir oyunun sonucunu işler. Günlükte aynı gün İKİNCİ kez sayılmaz (ilk sonuç kalır).
 * @returns {{ stats, counted: boolean, streak: number }}
 */
export function recordChainResult(current, { mode, dayKey, puzzle, chain, gaveUp = false }) {
  const stats = normalizeChainStats(current);
  const links = gaveUp ? 0 : chainFilmCount(chain);
  const par = count(puzzle?.par);
  if (mode === "daily") {
    if (!dayKey || stats.days[dayKey]) return { stats, counted: false, streak: chainStreak(stats, dayKey) };
    stats.days[dayKey] = {
      puzzleId: String(puzzle?.id || ""),
      links,
      par,
      points: chainPoints(links, par, gaveUp),
      gaveUp: !!gaveUp,
      path: (chain || []).map((n) => (n.kind === "film" ? filmNode(n) : personNode(n))),
    };
    const keep = Object.keys(stats.days).sort().slice(-CHAIN_DAYS_KEPT);
    stats.days = Object.fromEntries(keep.map((k) => [k, stats.days[k]]));
  }
  if (puzzle?.id && !stats.results[puzzle.id]) {
    stats.results[puzzle.id] = { links, points: chainPoints(links, par, gaveUp), gaveUp: !!gaveUp };
    const ids = Object.keys(stats.results);
    if (ids.length > CHAIN_RESULTS_KEPT) {
      // Ekleme sırası korunur (JS nesne anahtarları): en eskiler düşer.
      stats.results = Object.fromEntries(ids.slice(-CHAIN_RESULTS_KEPT).map((id) => [id, stats.results[id]]));
    }
  }
  stats.plays += 1;
  if (gaveUp) stats.gaveUp += 1;
  else {
    stats.solved += 1;
    if (links <= par) stats.perfect += 1;
  }
  const streak = mode === "daily" ? chainStreak(stats, dayKey) : chainStreak(stats);
  stats.bestStreak = Math.max(stats.bestStreak, streak);
  return { stats, counted: true, streak };
}

// ── Paylaşım ────────────────────────────────────────────────────────────────

/** Sistem paylaşım sayfası metni (emoji özet; zincirin kendisi spoiler olmasın diye yazılmaz). */
export function chainShareText(copy, { puzzle, links, gaveUp }) {
  const head = puzzle?.number ? copy.shareHeadDaily(puzzle.number) : copy.shareHeadFree;
  const route = `${puzzle?.start?.name || ""} → ${puzzle?.target?.name || ""}`;
  const body = gaveUp
    ? copy.shareGaveUp
    : `${"🎬".repeat(Math.max(1, links))} ${copy.shareLinks(links, puzzle?.par || 0)}`;
  const stars = gaveUp ? "" : `\n${"⭐".repeat(chainStars(links, puzzle?.par || 0))}`;
  return `${head}\n${route}\n${body}${stars}`;
}
