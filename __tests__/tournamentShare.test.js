// Sohbete gönderilen turnuva kartının saf yardımcıları: eleme ağacı anlık
// görüntüsü (kodla → doğrula → çöz) ve görüntüleyenin oy durumu.
import { buildBracket, setDebugNow } from "../services/tournamentEngine";
import {
  BRACKET_MATCHES,
  decidedCount,
  decodeBracketSnapshot,
  encodeBracketSnapshot,
  sanitizeBracketSnapshot,
  tournamentVoteStatus,
} from "../utils/tournamentShare";
import { buildTournamentShare, buildShareMessage, readShare } from "../utils/chatShare";

const nominees = Array.from({ length: 32 }, (_, i) => ({
  id: 100 + i,
  title: `Film ${i + 1}`,
  posterPath: `/p${i + 1}.jpg`,
  mediaType: "movie",
  seed: i + 1,
}));
const at = (d) => new Date(2026, 9, d, 12).getTime();

afterEach(() => setDebugNow(null));

describe("encodeBracketSnapshot", () => {
  test("31 maçın durumunu tek dizgide taşır: bitmiş tur kazananı, canlı tur 'v', sıradaki '.'", () => {
    // 10 Ekim: Son 32 bitti (seed'e göre kazanan "a"), Son 16 oylanıyor.
    const bracket = buildBracket({ nominees, tallies: { r32_3: { a: 0, b: 2 } }, periodId: "2026-10", ms: at(10) });
    const snap = encodeBracketSnapshot(bracket, { activeRound: 1 });
    expect(snap.states).toHaveLength(BRACKET_MATCHES);
    expect(snap.states.slice(0, 16)).toBe("aaab" + "a".repeat(12));
    expect(snap.states.slice(16, 24)).toBe("v".repeat(8));
    expect(snap.states.slice(24)).toBe(".".repeat(7));
    expect(snap.round).toBe(1);
    expect(decidedCount(snap)).toBe(16);
  });

  test("final çiftinin posterlerini ve seçimde ilk üç adayı kompakt taşır", () => {
    const bracket = buildBracket({ nominees, tallies: {}, periodId: "2026-10", ms: at(3) });
    const snap = encodeBracketSnapshot(bracket, { activeRound: -1, top: nominees });
    expect(snap.top).toEqual([
      { id: 100, title: "Film 1", poster_path: "/p1.jpg", seed: 1 },
      { id: 101, title: "Film 2", poster_path: "/p2.jpg", seed: 2 },
      { id: 102, title: "Film 3", poster_path: "/p3.jpg", seed: 3 },
    ]);
    // Seçimde ağaç henüz kurulmadı: kazanan yok, final çifti de yok.
    expect(snap.final).toBeUndefined();
    expect(snap.states).toBe(".".repeat(31));
  });

  test("bracket yoksa null", () => {
    expect(encodeBracketSnapshot(null)).toBeNull();
    expect(encodeBracketSnapshot({ rounds: [] })).toBeNull();
  });
});

describe("decodeBracketSnapshot", () => {
  test("bitmiş turnuvada şampiyonu ve final çiftini geri kurar", () => {
    const bracket = buildBracket({ nominees, tallies: {}, periodId: "2026-10", ms: at(25) });
    const decoded = decodeBracketSnapshot(encodeBracketSnapshot(bracket, { activeRound: 5 }));
    expect(decoded.rounds).toHaveLength(5);
    expect(decoded.rounds.map((r) => r.matches.length)).toEqual([16, 8, 4, 2, 1]);
    expect(decoded.championDecided).toBe(true);
    expect(decoded.champion).toMatchObject({ id: 100, posterPath: "/p1.jpg", seed: 1 });
    expect(decoded.rounds[4].matches[0].matchId).toBe("final_0");
  });

  test("bozuk anlık görüntüyü reddeder", () => {
    expect(decodeBracketSnapshot(null)).toBeNull();
    expect(sanitizeBracketSnapshot({ states: "abc", round: 1 })).toBeNull();
    expect(sanitizeBracketSnapshot({ states: "x".repeat(31), round: 1 })).toBeNull();
    expect(sanitizeBracketSnapshot({ states: ".".repeat(31), round: 99 }).round).toBe(-1);
    // Başlıksız yarışmacı düşer; javascript: posteri taşınmaz.
    const s = sanitizeBracketSnapshot({
      states: ".".repeat(31),
      round: 0,
      final: { a: { id: 1 }, b: { id: 2, title: "B", poster_path: "javascript:x" } },
    });
    expect(s.final).toEqual({ b: { id: 2, title: "B" } });
  });
});

describe("chatShare ile gidiş-dönüş", () => {
  test("ağaç anlık görüntüsü mesajdan aynen okunur, eski mesajda yoktur", () => {
    const bracket = buildBracket({ nominees, tallies: {}, periodId: "2026-10", ms: at(10) });
    const share = buildTournamentShare({
      periodId: "2026-10",
      phase: "voting",
      bracket: encodeBracketSnapshot(bracket, { activeRound: 1 }),
    });
    const read = readShare(buildShareMessage(share));
    expect(read.bracket.states).toBe(share.bracket.states);
    expect(read.bracket.final).toBeUndefined();
    expect(buildTournamentShare({ periodId: "2026-10", phase: "voting" }).bracket).toBeUndefined();
    expect(buildTournamentShare({ periodId: "2026-10", phase: "voting", bracket: { states: "?" } }).bracket).toBeUndefined();
  });
});

describe("tournamentVoteStatus", () => {
  test("seçim: hype verilmiş mi", () => {
    expect(tournamentVoteStatus({ phase: "selection", activeRound: -1, vote: { noms: { 5: true } } }).kind).toBe("hyped");
    expect(tournamentVoteStatus({ phase: "selection", activeRound: -1, vote: null }).kind).toBe("hypeOpen");
  });

  test("oylama: yalnız AKTİF turun maçları sayılır", () => {
    const picks = { r32_0: "a", r32_1: "b", r16_0: "a", r16_1: "b" };
    expect(tournamentVoteStatus({ phase: "voting", activeRound: 1, vote: { picks } })).toEqual({
      kind: "roundPartial",
      done: 2,
      total: 8,
      roundIndex: 1,
    });
    expect(tournamentVoteStatus({ phase: "voting", activeRound: 4, vote: { picks } }).kind).toBe("roundOpen");
    expect(tournamentVoteStatus({ phase: "voting", activeRound: 4, vote: { picks: { final_0: "a" } } }).kind).toBe(
      "roundDone",
    );
  });

  test("doküman okunmadıysa kişisel durum söylenmez; bitmiş turnuvada sorulmaz", () => {
    expect(tournamentVoteStatus({ phase: "voting", activeRound: 1, loaded: false }).kind).toBe("unknown");
    expect(tournamentVoteStatus({ phase: "results", activeRound: 5 }).kind).toBe("results");
    expect(tournamentVoteStatus({ phase: "upcoming", activeRound: -1 }).kind).toBe("upcoming");
  });
});
