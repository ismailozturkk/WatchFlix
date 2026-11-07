// utils/tournamentShare.js
//
// Sohbete gönderilen TURNUVA kartının (utils/chatShare.js, kind
// "tournamentShare") iki saf yardımcısı:
//
//   1) Eleme ağacı ANLIK GÖRÜNTÜSÜ — Hub widget'ındaki ağaç önizlemesinin,
//      gönderildiği andaki hâli mesaja gömülür; alıcı aynı ağacı ağ olmadan
//      çizer. 31 maçın durumu tek bir dizgide taşınır (tur sırası r32→final,
//      her turda maç sırası):
//        "a" / "b" → tur bitti, kazanan o taraf
//        "v"       → şu an oylanıyor
//        "."       → sırada / henüz kurulmadı
//      Posterler yalnız merkezde (final çifti) ve seçim fazında öne çıkan ilk
//      üç adayda gerekir; ağacın geri kalanı çentiklerden ibaret.
//
//   2) Görüntüleyenin OY DURUMU — kartı açan kişinin kendi oy dokümanından
//      ("zaten oy verdin", "3/8 maç", "hype'ın kayıtlı") türetilir.
//
// RN/Firebase importu yok → node'da test edilir (__tests__/tournamentShare.test.js).

import { ROUNDS } from "../services/tournamentEngine";

export const BRACKET_MATCHES = ROUNDS.reduce((sum, round) => sum + round.matches, 0); // 31
export const MAX_TOP_NOMINEES = 3;
const STATES = new RegExp(`^[abv.]{${BRACKET_MATCHES}}$`);
const MAX_TITLE = 90;

const clip = (value, max) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

const idOf = (raw) => {
  const id = raw?.id;
  return typeof id === "number" || (typeof id === "string" && id !== "") ? id : null;
};

/** Yarışmacı → mesajdaki kompakt hâli ({ id, title, poster_path?, seed? }). */
function packContestant(raw) {
  const id = idOf(raw);
  const title = clip(raw?.title, MAX_TITLE);
  if (id === null || !title) return null;
  const out = { id, title };
  const poster = raw.poster_path || raw.posterPath;
  if (typeof poster === "string" && poster.startsWith("/")) out.poster_path = poster;
  const seed = Number(raw.seed);
  if (Number.isInteger(seed) && seed > 0 && seed <= 999) out.seed = seed;
  return out;
}

/** Mesajdaki yarışmacı → ağaç bileşeninin beklediği şekil (posterPath). */
const unpackContestant = (c) =>
  c ? { id: c.id, title: c.title, posterPath: c.poster_path || null, seed: c.seed } : null;

const matchState = (m) => {
  if (m?.decided && (m.winnerSide === "a" || m.winnerSide === "b")) return m.winnerSide;
  if (m?.votable) return "v";
  return ".";
};

/**
 * buildBracket çıktısı → mesaja gömülecek anlık görüntü. Bracket yoksa null.
 * `activeRound`: getPhaseInfo().activeRound (seçimde -1, sonuçta ROUNDS.length).
 * `top`: seçim fazında öne çıkan adaylar (sıralı finalistler) — ilk üçü alınır.
 */
export function encodeBracketSnapshot(bracket, { activeRound = -1, top } = {}) {
  const rounds = bracket?.rounds;
  if (!Array.isArray(rounds) || rounds.length !== ROUNDS.length) return null;
  const states = ROUNDS.map((def, r) =>
    Array.from({ length: def.matches }, (_, i) => matchState(rounds[r]?.matches?.[i])).join(""),
  ).join("");
  const snapshot = { states, round: Number.isInteger(activeRound) ? activeRound : -1 };
  const finalMatch = rounds[ROUNDS.length - 1]?.matches?.[0];
  const a = packContestant(finalMatch?.a);
  const b = packContestant(finalMatch?.b);
  if (a || b) snapshot.final = { ...(a && { a }), ...(b && { b }) };
  if (Array.isArray(top)) {
    const picks = top.map(packContestant).filter(Boolean).slice(0, MAX_TOP_NOMINEES);
    if (picks.length) snapshot.top = picks;
  }
  return sanitizeBracketSnapshot(snapshot);
}

/** Güvenilmeyen (mesajdan okunan) anlık görüntüyü doğrular; bozuksa null. */
export function sanitizeBracketSnapshot(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (typeof raw.states !== "string" || !STATES.test(raw.states)) return null;
  const round = Number(raw.round);
  const out = {
    states: raw.states,
    round: Number.isInteger(round) && round >= -1 && round <= ROUNDS.length ? round : -1,
  };
  if (raw.final && typeof raw.final === "object") {
    const a = packContestant(raw.final.a);
    const b = packContestant(raw.final.b);
    if (a || b) out.final = { ...(a && { a }), ...(b && { b }) };
  }
  if (Array.isArray(raw.top)) {
    const top = raw.top.map(packContestant).filter(Boolean).slice(0, MAX_TOP_NOMINEES);
    if (top.length) out.top = top;
  }
  return out;
}

/**
 * Anlık görüntü → TournamentTreePreview'ın okuduğu bracket şekli
 * ({ rounds[r].matches[i]: { matchId, decided, votable, winnerSide, a, b },
 *    champion, championDecided }). Yalnız final maçı yarışmacı taşır.
 */
export function decodeBracketSnapshot(snapshot) {
  const snap = sanitizeBracketSnapshot(snapshot);
  if (!snap) return null;
  let cursor = 0;
  const rounds = ROUNDS.map((def, r) => {
    const matches = Array.from({ length: def.matches }, (_, i) => {
      const s = snap.states[cursor++];
      const decided = s === "a" || s === "b";
      return {
        matchId: `${def.key}_${i}`,
        decided,
        votable: s === "v",
        winnerSide: decided ? s : null,
        a: null,
        b: null,
      };
    });
    return {
      round: r,
      key: def.key,
      decided: matches.every((m) => m.decided),
      votable: matches.some((m) => m.votable),
      matches,
    };
  });
  const finalMatch = rounds[ROUNDS.length - 1].matches[0];
  finalMatch.a = unpackContestant(snap.final?.a);
  finalMatch.b = unpackContestant(snap.final?.b);
  const champion = finalMatch.decided ? finalMatch[finalMatch.winnerSide] : null;
  return { rounds, champion, championDecided: !!champion };
}

/** Bitmiş maç sayısı (ağaç başlığındaki "12/31"). */
export const decidedCount = (snapshot) =>
  (sanitizeBracketSnapshot(snapshot)?.states.match(/[ab]/g) || []).length;

/**
 * Görüntüleyenin bu turnuvadaki oy durumu — kartın durum satırını ve düğmesini
 * belirler. `vote`: kendi oy dokümanı ({ noms, picks }) | null; `loaded` false
 * iken (doküman henüz okunmadı ya da oturum yok) kişisel durum söylenmez.
 *
 *   kind: "hyped" | "hypeOpen"                       (seçim)
 *         "roundDone" | "roundPartial" | "roundOpen" (oylama, aktif tur)
 *         "results" | "upcoming" | "unknown"
 */
export function tournamentVoteStatus({ phase, activeRound, vote, loaded = true } = {}) {
  if (phase === "results") return { kind: "results" };
  if (phase === "upcoming") return { kind: "upcoming" };
  if (!loaded) return { kind: "unknown" };
  if (phase === "selection") {
    const hyped = Object.keys(vote?.noms || {}).some((k) => vote.noms[k]);
    return { kind: hyped ? "hyped" : "hypeOpen" };
  }
  const def = ROUNDS[activeRound];
  if (phase !== "voting" || !def) return { kind: "unknown" };
  const picks = vote?.picks || {};
  const done = Object.keys(picks).filter((k) => k.startsWith(`${def.key}_`) && picks[k]).length;
  const total = def.matches;
  const kind = done >= total ? "roundDone" : done > 0 ? "roundPartial" : "roundOpen";
  return { kind, done: Math.min(done, total), total, roundIndex: activeRound };
}
