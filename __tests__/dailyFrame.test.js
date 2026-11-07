// __tests__/dailyFrame.test.js
//
// Günün Karesi: saf çekirdek (utils/dailyFrame.js), bulmaca servisi (services/dailyFrameService.js — taklit TMDB) ve
// sohbet kartı gövdesi (utils/chatShare buildFrameShare). Tasarım: docs/ozellikler/GUNUN_KARESI.md.

import {
  FRAME_COUNT,
  FRAME_EPOCH_DAY,
  FRAME_HISTORY_DAYS,
  FRAME_MAX_GUESSES,
  FRAME_PAGES,
  FRAME_SLOTS,
  applyGuess,
  buildShareText,
  candidateOrder,
  emptyRound,
  hintAtFrame,
  initialOf,
  marksToEmoji,
  normalizeFrameStore,
  openFrameCount,
  puzzleNumberOf,
  recordFrameResult,
  roundMarks,
  selectFrames,
  slotOfPuzzle,
  slotPosition,
  solvedAt,
  storeRound,
  visibleFrameStreak,
  visibleHints,
} from "../utils/dailyFrame";

jest.mock("axios", () => ({ get: jest.fn() }));
jest.mock("../utils/cachedRead", () => ({
  cachedRead: jest.fn(async (_ns, _key, fetchFn) => ({ data: await fetchFn() })),
}));
jest.mock("../services/sceneGameService", () => ({ fetchTitleImages: jest.fn() }));
jest.mock("../utils/i18nText", () => ({
  i18nText: (_key, fallback, params) =>
    String(fallback).replace(/\{\{(\w+)\}\}/g, (_, name) => String(params?.[name] ?? "")),
}));

const axios = require("axios");
const { buildDailyFramePuzzle, searchFrameMovies } = require("../services/dailyFrameService");
const { buildFrameShare, buildShareMessage, readShare, sharePreview } = require("../utils/chatShare");

const backdrop = (n, extra = {}) => ({ file_path: `/b${n}.jpg`, width: 1920, aspect_ratio: 1.778, iso_639_1: null, ...extra });
const backdrops = (count) => Array.from({ length: count }, (_, i) => backdrop(i));

const ANSWER = "movie_603";
const play = (round, ...guesses) => guesses.reduce((r, g) => applyGuess(r, g).round, round);

describe("gün numarası ve yuva", () => {
  test("ilk gün #1, ertesi gün #2, öncesi ve bozuk anahtar 0", () => {
    expect(puzzleNumberOf(FRAME_EPOCH_DAY)).toBe(1);
    expect(puzzleNumberOf("2026-10-31")).toBe(2);
    expect(puzzleNumberOf("2026-11-01")).toBe(3);
    expect(puzzleNumberOf("2027-10-30")).toBe(366);
    expect(puzzleNumberOf("2026-10-29")).toBe(0);
    expect(puzzleNumberOf("bozuk")).toBe(0);
  });

  test("400 ardışık günde aynı yuva iki kez gelmez (permütasyon)", () => {
    const seen = new Set();
    for (let n = 1; n <= FRAME_SLOTS; n += 1) seen.add(slotOfPuzzle(n));
    expect(seen.size).toBe(FRAME_SLOTS);
  });

  test("ardışık günler listenin uzak yerlerine düşer", () => {
    const pages = [1, 2, 3, 4, 5].map((n) => slotPosition(slotOfPuzzle(n)).page);
    for (let i = 1; i < pages.length; i += 1) expect(pages[i]).not.toBe(pages[i - 1]);
  });

  test("yuva → sayfa 1–20, sıra 0–19", () => {
    for (let n = 1; n <= 50; n += 1) {
      const { page, index } = slotPosition(slotOfPuzzle(n));
      expect(page).toBeGreaterThanOrEqual(1);
      expect(page).toBeLessThanOrEqual(FRAME_PAGES);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(20);
    }
  });

  test("aday sırası TMDB sayfa sırasından bağımsız (kimliğe göre) ve başa sarar", () => {
    const a = [{ id: 30 }, { id: 10 }, { id: 20 }];
    const b = [{ id: 20 }, { id: 30 }, { id: 10 }];
    expect(candidateOrder(a, 1).map((x) => x.id)).toEqual([20, 30, 10]);
    expect(candidateOrder(b, 1)).toEqual(candidateOrder(a, 1));
    expect(candidateOrder(a, 5).map((x) => x.id)).toEqual([30, 10, 20]);
    expect(candidateOrder([], 3)).toEqual([]);
  });
});

describe("kare seçimi", () => {
  test("6 kare, sondan başa (1. kare en az bilinen, 6. kare en tanınır)", () => {
    const frames = selectFrames(backdrops(11));
    expect(frames).toEqual(["/b10.jpg", "/b8.jpg", "/b6.jpg", "/b4.jpg", "/b2.jpg", "/b0.jpg"]);
  });

  test("tam 6 nitelikli kare: hepsi, ters sırada", () => {
    expect(selectFrames(backdrops(6))).toEqual(["/b5.jpg", "/b4.jpg", "/b3.jpg", "/b2.jpg", "/b1.jpg", "/b0.jpg"]);
  });

  test("yazılı, dar ya da tekrarlı görseller sayılmaz; 6'dan azsa null", () => {
    const list = [
      ...backdrops(5),
      backdrop(90, { iso_639_1: "en" }),
      backdrop(91, { aspect_ratio: 1.0 }),
      backdrop(0),
    ];
    expect(selectFrames(list)).toBeNull();
    expect(selectFrames(null)).toBeNull();
  });

  test("keskin kare yetmezse 780+ genişlik kabul edilir", () => {
    const list = [...backdrops(3), ...[10, 11, 12].map((n) => backdrop(n, { width: 1000 }))];
    expect(selectFrames(list)).toHaveLength(FRAME_COUNT);
    expect(selectFrames([...backdrops(3), ...[10, 11, 12].map((n) => backdrop(n, { width: 500 }))])).toBeNull();
  });
});

describe("oyun durumu", () => {
  test("yanlış tahmin ve geç birer hak harcar, sıradaki kareyi açar", () => {
    let round = emptyRound("2026-10-30", ANSWER);
    expect(openFrameCount(round)).toBe(1);
    round = play(round, { key: "movie_1", title: "Yanlış" }, { skip: true });
    expect(round.status).toBe("playing");
    expect(openFrameCount(round)).toBe(3);
    expect(roundMarks(round)).toEqual(["miss", "skip", "empty", "empty", "empty", "empty"]);
  });

  test("doğru tahmin kazanır; sonra başka tahmin işlenmez", () => {
    const round = play(emptyRound("2026-10-30", ANSWER), { skip: true }, { key: ANSWER, title: "Matrix" });
    expect(round.status).toBe("won");
    expect(solvedAt(round)).toBe(2);
    expect(openFrameCount(round)).toBe(FRAME_COUNT);
    expect(applyGuess(round, { key: "movie_2" }).changed).toBe(false);
  });

  test("altı yanlışta kaybedilir", () => {
    const guesses = Array.from({ length: FRAME_MAX_GUESSES }, (_, i) => ({ key: `movie_${i + 1}`, title: `F${i}` }));
    const round = play(emptyRound("2026-10-30", ANSWER), ...guesses);
    expect(round.status).toBe("lost");
    expect(solvedAt(round)).toBeNull();
    expect(roundMarks(round)).toEqual(Array(6).fill("miss"));
  });

  test("aynı film ikinci kez hak yemez; boş tahmin yok sayılır", () => {
    const round = play(emptyRound("2026-10-30", ANSWER), { key: "movie_1", title: "A" });
    expect(applyGuess(round, { key: "movie_1", title: "A" }).changed).toBe(false);
    expect(applyGuess(round, {}).changed).toBe(false);
    expect(applyGuess(round, null).changed).toBe(false);
  });

  test("ipuçları 3. karede tür, 4.'te yıl, 5.'te yönetmen, 6.'da baş harf", () => {
    const none = { genres: false, year: false, director: false, initial: false };
    let round = emptyRound("2026-10-30", ANSWER);
    expect(visibleHints(round)).toEqual(none);
    round = play(round, { skip: true });
    expect(visibleHints(round)).toEqual(none);
    round = play(round, { skip: true });
    expect(visibleHints(round)).toEqual({ ...none, genres: true });
    round = play(round, { skip: true });
    expect(visibleHints(round)).toEqual({ ...none, genres: true, year: true });
    round = play(round, { skip: true });
    expect(visibleHints(round)).toEqual({ genres: true, year: true, director: true, initial: false });
    round = play(round, { skip: true });
    expect(visibleHints(round)).toEqual({ genres: true, year: true, director: true, initial: true });
    expect([1, 2, 3, 4, 5, 6].map(hintAtFrame)).toEqual([null, null, "genres", "year", "director", "initial"]);
  });

  test("baş harf: baştaki tırnak / parantez atlanır, harf ya da rakam büyük harfle", () => {
    expect(initialOf("matrix")).toBe("M");
    expect(initialOf("  'Salem's Lot")).toBe("S");
    expect(initialOf("(500) Days of Summer")).toBe("5");
    expect(initialOf("¡Three Amigos!")).toBe("T");
    expect(initialOf("")).toBe("");
  });

  test("tahmin kaydı yıl ve afişi saklar; bozuk yıl / yol atılır", () => {
    let round = play(emptyRound("2026-10-30", ANSWER), { key: "movie_1", title: "A", year: "2010", posterPath: "/a.jpg" });
    expect(round.guesses[0]).toEqual({ key: "movie_1", title: "A", year: "2010", posterPath: "/a.jpg" });
    round = play(round, { key: "movie_2", title: "B", year: "20", posterPath: "http://x/y.jpg" });
    expect(round.guesses[1]).toEqual({ key: "movie_2", title: "B" });
    const stored = normalizeFrameStore(storeRound(null, round));
    expect(stored.rounds["2026-10-30"].guesses[0]).toEqual({ key: "movie_1", title: "A", year: "2010", posterPath: "/a.jpg" });
  });

  test("paylaşım metni kutucukları taşır, cevabı taşımaz", () => {
    const round = play(emptyRound("2026-10-30", ANSWER), { key: "movie_1", title: "Inception" }, { skip: true }, { key: ANSWER, title: "The Matrix" });
    const text = buildShareText({ title: "Seelogd · Günün Karesi", number: 1, marks: roundMarks(round) });
    expect(text).toBe("Seelogd · Günün Karesi #1\n🎬 🟥 ⬜ 🟩 ⬛ ⬛ ⬛");
    expect(text).not.toMatch(/Matrix|Inception/);
    expect(marksToEmoji(["hit"])).toBe("🟩");
  });
});

describe("istatistik ve seri", () => {
  const won = (day, at = 1) =>
    play(emptyRound(day, ANSWER), ...Array.from({ length: at - 1 }, () => ({ skip: true })), { key: ANSWER, title: "M" });
  const lost = (day) => play(emptyRound(day, ANSWER), ...Array.from({ length: 6 }, () => ({ skip: true })));

  test("ardışık kazanılan günler seriyi büyütür; dağılım işlenir", () => {
    let stats = recordFrameResult(null, won("2026-10-30", 2));
    stats = recordFrameResult(stats, won("2026-10-31", 4));
    expect(stats).toMatchObject({ played: 2, won: 2, streak: 2, bestStreak: 2, lastWinDay: "2026-10-31" });
    expect(stats.dist).toEqual([0, 1, 0, 1, 0, 0]);
  });

  test("kayıp ya da atlanan gün seriyi bitirir; en iyi seri kalır", () => {
    let stats = recordFrameResult(recordFrameResult(null, won("2026-10-30")), won("2026-10-31"));
    stats = recordFrameResult(stats, lost("2026-11-01"));
    expect(stats).toMatchObject({ played: 3, won: 2, streak: 0, bestStreak: 2 });
    stats = recordFrameResult(stats, won("2026-11-03"));
    expect(stats.streak).toBe(1);
  });

  test("aynı gün iki kez işlenmez; süren oyun işlenmez", () => {
    const once = recordFrameResult(null, won("2026-10-30"));
    expect(recordFrameResult(once, won("2026-10-30"))).toEqual(once);
    expect(recordFrameResult(null, emptyRound("2026-10-30", ANSWER)).played).toBe(0);
  });

  test("görünen seri: son kazanç dünden eskiyse 0", () => {
    const stats = { streak: 5, lastWinDay: "2026-10-30" };
    expect(visibleFrameStreak(stats, Date.parse("2026-10-31T12:00:00+03:00"))).toBe(5);
    expect(visibleFrameStreak(stats, Date.parse("2026-11-02T12:00:00+03:00"))).toBe(0);
  });

  test("depo: tur yazılır, bitince istatistiğe girer, eski günler atılır, bozuk girdiler süzülür", () => {
    let raw = storeRound(null, play(emptyRound("2026-10-30", ANSWER), { skip: true }));
    expect(raw.rounds["2026-10-30"].guesses).toHaveLength(1);
    expect(raw.stats.played).toBe(0);
    raw = storeRound(raw, won("2026-10-30", 2));
    expect(raw.stats).toMatchObject({ played: 1, won: 1 });

    const rounds = {};
    for (let d = 1; d <= FRAME_HISTORY_DAYS + 5; d += 1) {
      rounds[`2026-12-${String(d).padStart(2, "0")}`] = { answerKey: ANSWER, guesses: [], status: "playing" };
    }
    rounds.bozuk = { answerKey: ANSWER };
    rounds["2026-11-01"] = { guesses: "x" };
    const store = normalizeFrameStore({ rounds, stats: { played: "3", dist: [1, "x"] } });
    expect(Object.keys(store.rounds)).toHaveLength(FRAME_HISTORY_DAYS);
    expect(store.rounds.bozuk).toBeUndefined();
    expect(store.stats.played).toBe(3);
    expect(store.stats.dist).toEqual([1, 0, 0, 0, 0, 0]);
  });
});

describe("bulmaca servisi", () => {
  const { fetchTitleImages } = require("../services/sceneGameService");

  beforeEach(() => {
    axios.get.mockReset();
    fetchTitleImages.mockReset();
  });

  const pageOf = (ids) => ({ data: { results: ids.map((id) => ({ id, title: `T${id}`, release_date: "1999-03-31", genre_ids: [28], poster_path: `/p${id}.jpg` })) } });

  test("yuvadaki filmin 6 karesi yoksa sıradaki aday; seçim dilden bağımsız", async () => {
    // Gün #1: yuvanın sırası; sayfa kimliğe göre dizilir.
    const { index } = slotPosition(slotOfPuzzle(1));
    const ids = Array.from({ length: 20 }, (_, i) => 1000 + i);
    const crew = [
      { job: "Director", name: "Lana Wachowski" },
      { job: "Writer", name: "Lana Wachowski" },
      { job: "Director", name: "Lilly Wachowski" },
      { job: "Director", name: "Üçüncü" },
    ];
    axios.get.mockImplementation(async (url) => (url.endsWith("/credits") ? { data: { crew } } : pageOf([...ids].reverse())));
    const first = ids[index];
    fetchTitleImages.mockImplementation(async (_key, item) => ({ backdrops: item.id === first ? backdrops(3) : backdrops(8) }));

    const tr = await buildDailyFramePuzzle("key", "tr", FRAME_EPOCH_DAY);
    const en = await buildDailyFramePuzzle("key", "en", FRAME_EPOCH_DAY);
    const expected = ids[(index + 1) % ids.length];
    expect(tr.answerKey).toBe(`movie_${expected}`);
    expect(en.answerKey).toBe(tr.answerKey);
    expect(tr).toMatchObject({ number: 1, dayKey: FRAME_EPOCH_DAY, year: "1999", posterPath: `/p${expected}.jpg` });
    expect(tr.frames).toHaveLength(FRAME_COUNT);
    expect(tr.directors).toEqual(["Lana Wachowski", "Lilly Wachowski"]);
    expect(axios.get.mock.calls.filter(([url]) => url.endsWith("/credits"))[0][0]).toContain(`movie/${expected}/credits`);
    expect(axios.get.mock.calls[0][1].params.page).toBe(slotPosition(slotOfPuzzle(1)).page);
    expect(axios.get.mock.calls[0][1].params).not.toHaveProperty("include_adult");
  });

  test("yönetmen alınamazsa bulmaca yine kurulur (ipucu boş)", async () => {
    axios.get.mockImplementation(async (url) => {
      if (url.endsWith("/credits")) throw new Error("ağ");
      return pageOf([1, 2, 3]);
    });
    fetchTitleImages.mockResolvedValue({ backdrops: backdrops(7) });
    const puzzle = await buildDailyFramePuzzle("key", "tr", FRAME_EPOCH_DAY);
    expect(puzzle.directors).toEqual([]);
    expect(puzzle.frames).toHaveLength(FRAME_COUNT);
  });

  test("hiçbir adayın karesi yoksa frame_unavailable", async () => {
    axios.get.mockResolvedValue(pageOf([1, 2, 3]));
    fetchTitleImages.mockResolvedValue({ backdrops: backdrops(2) });
    await expect(buildDailyFramePuzzle("key", "tr", FRAME_EPOCH_DAY)).rejects.toMatchObject({ code: "frame_unavailable" });
  });

  test("yetişkin sonuçlar ne bulmacaya ne aramaya girer", async () => {
    axios.get.mockResolvedValue({
      data: {
        results: [
          { id: 1, title: "A", adult: true, release_date: "2001-01-01" },
          { id: 2, title: "B", release_date: "2002-01-01", poster_path: "/b.jpg" },
          { id: 2, title: "B kopya" },
        ],
      },
    });
    const found = await searchFrameMovies("key", "tr", "ab");
    expect(found).toEqual([{ key: "movie_2", id: 2, title: "B", year: "2002", posterPath: "/b.jpg" }]);
    expect(await searchFrameMovies("key", "tr", "a")).toEqual([]);
  });
});

describe("sohbet kartı (frameShare)", () => {
  const marks = ["miss", "skip", "hit", "empty", "empty", "empty"];

  test("bitmiş oyun gönderilir; mesaj metni numara + kutucuk, cevap yok", () => {
    const share = buildFrameShare({ dayKey: "2026-10-30", number: 1, marks, host: "Ali", answer: "The Matrix" });
    expect(share).toEqual({ v: 1, type: "frame", dayKey: "2026-10-30", number: 1, marks, host: "Ali" });
    const message = buildShareMessage(share);
    expect(message.kind).toBe("frameShare");
    expect(message.text).toBe("🎬 Günün Karesi #1 🟥⬜🟩⬛⬛⬛");
    expect(readShare(message)).toEqual(share);
    expect(sharePreview(share)).toBe("Günün Karesi #1");
  });

  test("süren oyun, bozuk kutucuk, iki doğru ya da geçersiz numara reddedilir", () => {
    const base = { dayKey: "2026-10-30", number: 1 };
    expect(buildFrameShare({ ...base, marks: ["miss", "empty", "empty", "empty", "empty", "empty"] })).toBeNull();
    expect(buildFrameShare({ ...base, marks: ["hit", "hit", "empty", "empty", "empty", "empty"] })).toBeNull();
    expect(buildFrameShare({ ...base, marks: ["miss", "x", "hit", "empty", "empty", "empty"] })).toBeNull();
    expect(buildFrameShare({ ...base, marks: marks.slice(0, 5) })).toBeNull();
    expect(buildFrameShare({ ...base, number: 0, marks })).toBeNull();
    expect(buildFrameShare({ dayKey: "30-10-2026", number: 1, marks })).toBeNull();
    expect(buildFrameShare({ ...base, marks: Array(6).fill("miss") })).not.toBeNull();
  });
});
