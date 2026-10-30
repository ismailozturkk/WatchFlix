// __tests__/filmChain.test.js
//
// Film Zinciri çekirdeği (utils/filmChain.js), kenar kuralı (utils/filmChainRules.js), üretilmiş bulmaca verisi
// (data/filmChainPuzzles.js) ve metin tabloları.

const fs = require("fs");
const path = require("path");
const {
  CHAIN_CAST_LIMIT,
  CHAIN_MIN_FILM_VOTES,
  chainCastOf,
  chainFilmsOf,
  isSelfRole,
} = require("../utils/filmChainRules");
const {
  CHAIN_DAYS_KEPT,
  CHAIN_MAX_FILMS,
  appendChainNode,
  CHAIN_RESULTS_KEPT,
  chainAtLimit,
  chainDayNumber,
  chainPuzzleById,
  chainResultOf,
  chainFilmCount,
  chainPoints,
  chainShareText,
  chainStars,
  chainStreak,
  dailyChainPuzzle,
  dailyChainRecord,
  filterChainOptions,
  isChainSolved,
  nextPickKind,
  normalizeChainStats,
  randomChainPuzzle,
  recordChainResult,
  startChain,
  toStoredChainStats,
  undoChainNode,
} = require("../utils/filmChain");
const { FILM_CHAIN_PUZZLES } = require("../data/filmChainPuzzles");
const { FILM_CHAIN_COPY, getFilmChainCopy } = require("../utils/filmChainCopy");

const NOW = Date.parse("2026-10-30T12:00:00Z");
const film = (over = {}) => ({
  id: 1, title: "Film", release_date: "2000-01-01", vote_count: 500, popularity: 10, order: 0,
  character: "Hero", genre_ids: [18], adult: false, poster_path: "/p.jpg", ...over,
});
const castEntry = (over = {}) => ({ id: 1, name: "Kişi", order: 0, character: "Hero", adult: false, profile_path: "/a.jpg", ...over });

describe("kenar kuralı", () => {
  test("film süzgeci: belgesel, yetişkin, çıkmamış, az oylu, kendisi ve alt sıradaki rol düşer", () => {
    const credits = {
      cast: [
        film({ id: 1, popularity: 5 }),
        film({ id: 2, genre_ids: [99] }),
        film({ id: 3, adult: true }),
        film({ id: 4, release_date: "2027-05-01" }),
        film({ id: 5, release_date: "" }),
        film({ id: 6, vote_count: CHAIN_MIN_FILM_VOTES - 1 }),
        film({ id: 7, character: "Himself" }),
        film({ id: 8, order: CHAIN_CAST_LIMIT }),
        film({ id: 9, character: "Ilsa (archive footage)" }),
        film({ id: 10, popularity: 50 }),
        film({ id: 10, popularity: 50, character: "Tekrar" }),
      ],
    };
    const films = chainFilmsOf(credits, NOW);
    expect(films.map((f) => f.id)).toEqual([10, 1]); // popülerden aza, tekil
    expect(films[0]).toMatchObject({ year: 2000, posterPath: "/p.jpg", title: "Film" });
  });

  test("kadro süzgeci: TMDB sırası, ilk 25, kendisi değil, tekil", () => {
    const cast = chainCastOf({
      cast: [
        castEntry({ id: 3, order: 2 }),
        castEntry({ id: 1, order: 0 }),
        castEntry({ id: 2, order: 1, character: "Herself" }),
        castEntry({ id: 4, order: 30 }),
        castEntry({ id: 1, order: 5 }),
      ],
    });
    expect(cast.map((p) => p.id)).toEqual([1, 3]);
  });

  test("boş/bozuk yanıt boş liste", () => {
    expect(chainFilmsOf(null)).toEqual([]);
    expect(chainCastOf({ cast: "x" })).toEqual([]);
    expect(isSelfRole("Narrator")).toBe(false);
    expect(isSelfRole("Self - Host")).toBe(true);
  });

  test("kural dosyası hiçbir şey içe aktarmaz (Node script'i alias'sız okur)", () => {
    const src = fs.readFileSync(path.join(__dirname, "../utils/filmChainRules.js"), "utf8");
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toMatch(/require\(/);
  });
});

describe("üretilmiş bulmacalar", () => {
  test("yeterli sayıda, tekil ve hem kolay hem zor var", () => {
    expect(FILM_CHAIN_PUZZLES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(FILM_CHAIN_PUZZLES.map((p) => p.id)).size).toBe(FILM_CHAIN_PUZZLES.length);
    const pars = new Set(FILM_CHAIN_PUZZLES.map((p) => p.par));
    expect([...pars].sort()).toEqual([2, 3]);
  });

  test.each(FILM_CHAIN_PUZZLES.map((p) => [p.id, p]))("%s: çözüm başlangıçtan hedefe, par uzunlukta, sıralı ve tekrarsız", (_, p) => {
    const s = p.solution;
    expect(s).toHaveLength(p.par * 2 + 1);
    expect(s[0]).toMatchObject({ kind: "person", id: p.start.id });
    expect(s[s.length - 1]).toMatchObject({ kind: "person", id: p.target.id });
    s.forEach((node, i) => expect(node.kind).toBe(i % 2 === 0 ? "person" : "film"));
    expect(new Set(s.map((n) => `${n.kind}:${n.id}`)).size).toBe(s.length);
    expect(p.start.id).not.toBe(p.target.id);
    expect(p.start.name && p.target.name).toBeTruthy();
    expect(isChainSolved(s, p)).toBe(true);
    expect(chainFilmCount(s)).toBe(p.par);
  });

  test("ardışık günlerde aynı oyuncu art arda gelmez (çoğunlukla)", () => {
    let repeats = 0;
    for (let i = 1; i < FILM_CHAIN_PUZZLES.length; i += 1) {
      const a = FILM_CHAIN_PUZZLES[i - 1];
      const b = FILM_CHAIN_PUZZLES[i];
      if ([a.start.id, a.target.id].some((id) => id === b.start.id || id === b.target.id)) repeats += 1;
    }
    expect(repeats / FILM_CHAIN_PUZZLES.length).toBeLessThan(0.1);
  });
});

describe("bulmaca seçimi", () => {
  const list = [{ id: "a", par: 2 }, { id: "b", par: 3 }, { id: "c", par: 2 }];

  test("gün numarası epoch'tan sayılır", () => {
    expect(chainDayNumber("2026-10-30")).toBe(1);
    expect(chainDayNumber("2026-10-31")).toBe(2);
    expect(chainDayNumber("2026-12-01")).toBe(33);
    expect(chainDayNumber("2026-10-29")).toBe(0);
  });

  test("günlük deterministik ve listede döner (epoch öncesi de geçerli)", () => {
    expect(dailyChainPuzzle("2026-10-30", list)).toMatchObject({ id: "a", number: 1, dayKey: "2026-10-30" });
    expect(dailyChainPuzzle("2026-11-01", list).id).toBe("c");
    expect(dailyChainPuzzle("2026-11-02", list).id).toBe("a");
    expect(dailyChainPuzzle("2026-10-29", list).id).toBe("c");
    expect(dailyChainPuzzle("2026-10-30", [])).toBeNull();
  });

  test("kimlikle bulmaca: numarasız kopya; bilinmeyen null", () => {
    expect(chainPuzzleById("b", list)).toEqual({ id: "b", par: 3, number: null, dayKey: null });
    expect(chainPuzzleById("z", list)).toBeNull();
    expect(chainPuzzleById(null, list)).toBeNull();
    expect(chainPuzzleById(FILM_CHAIN_PUZZLES[5].id).start).toEqual(FILM_CHAIN_PUZZLES[5].start);
  });

  test("serbest: dışlananlar seçilmez; hepsi dışlandıysa yine bir bulmaca", () => {
    expect(randomChainPuzzle({ exclude: ["a", "b"], puzzles: list, rng: () => 0.99 }).id).toBe("c");
    expect(randomChainPuzzle({ exclude: ["a", "b", "c"], puzzles: list, rng: () => 0 }).id).toBe("a");
    expect(randomChainPuzzle({ puzzles: list, rng: () => 0.5 }).number).toBeNull();
  });
});

describe("zincir", () => {
  const puzzle = { id: "p", par: 2, start: { id: 1, name: "A" }, target: { id: 2, name: "B" } };
  const f = (id) => ({ kind: "film", id, title: `F${id}` });
  const p = (id) => ({ kind: "person", id, name: `P${id}` });

  test("sıra kişi → film → kişi; yanlış tür, tekrar ve bitmiş zincir reddedilir", () => {
    let chain = startChain(puzzle);
    expect(nextPickKind(chain, puzzle)).toBe("film");
    expect(appendChainNode(chain, p(3), puzzle)).toBe(chain);
    chain = appendChainNode(chain, f(10), puzzle);
    expect(nextPickKind(chain, puzzle)).toBe("person");
    expect(appendChainNode(chain, p(1), puzzle)).toBe(chain); // başlangıç tekrar
    chain = appendChainNode(chain, p(3), puzzle);
    expect(appendChainNode(chain, f(10), puzzle)).toBe(chain); // film tekrar
    chain = appendChainNode(chain, f(11), puzzle);
    chain = appendChainNode(chain, p(2), puzzle);
    expect(isChainSolved(chain, puzzle)).toBe(true);
    expect(nextPickKind(chain, puzzle)).toBeNull();
    expect(appendChainNode(chain, f(12), puzzle)).toBe(chain);
    expect(chainFilmCount(chain)).toBe(2);
  });

  test("geri al başlangıcı silmez", () => {
    const chain = appendChainNode(startChain(puzzle), f(10), puzzle);
    expect(undoChainNode(chain)).toHaveLength(1);
    expect(undoChainNode(undoChainNode(chain))).toHaveLength(1);
  });

  test("en çok CHAIN_MAX_FILMS film", () => {
    let chain = startChain(puzzle);
    for (let i = 0; i < CHAIN_MAX_FILMS; i += 1) {
      chain = appendChainNode(chain, f(100 + i), puzzle);
      chain = appendChainNode(chain, p(200 + i), puzzle);
    }
    expect(chainFilmCount(chain)).toBe(CHAIN_MAX_FILMS);
    expect(chainAtLimit(chain, puzzle)).toBe(true);
    expect(appendChainNode(chain, f(999), puzzle)).toBe(chain);
    expect(chainAtLimit(undoChainNode(chain), puzzle)).toBe(false);
  });

  test("seçenek süzgeci: kullanılanlar düşer, arama aksan ve harf duyarsız, rolde de arar", () => {
    const items = [
      { id: 1, title: "Amélie" },
      { id: 2, title: "Inception", character: "Cobb" },
      { id: 3, title: "Işıklar" },
    ];
    const used = new Set(["film:2"]);
    expect(filterChainOptions(items, { used }).map((i) => i.id)).toEqual([1, 3]);
    expect(filterChainOptions(items, { query: "AMELIE" }).map((i) => i.id)).toEqual([1]);
    expect(filterChainOptions(items, { query: "cobb" }).map((i) => i.id)).toEqual([2]);
    expect(filterChainOptions(items, { query: "isik" }).map((i) => i.id)).toEqual([3]);
    expect(filterChainOptions([{ id: 5, name: "Zendaya" }], { query: "zen", kind: "person" })).toHaveLength(1);
  });
});

describe("puan", () => {
  test("par = 100, her fazla film −25, en az 10; pes = 0; par altı yine 100", () => {
    expect(chainPoints(2, 2)).toBe(100);
    expect(chainPoints(3, 2)).toBe(75);
    expect(chainPoints(4, 2)).toBe(50);
    expect(chainPoints(6, 2)).toBe(10);
    expect(chainPoints(1, 2)).toBe(100);
    expect(chainPoints(2, 2, true)).toBe(0);
    expect(chainPoints(0, 2)).toBe(0);
  });
  test("yıldız 3 / 2 / 1 / 0", () => {
    expect([chainStars(2, 2), chainStars(3, 2), chainStars(5, 2), chainStars(2, 2, true)]).toEqual([3, 2, 1, 0]);
  });
});

describe("kayıt ve seri", () => {
  const puzzle = { id: "p", par: 2, start: { id: 1, name: "A" }, target: { id: 2, name: "B" } };
  const solved = [
    { kind: "person", id: 1, name: "A" }, { kind: "film", id: 10, title: "F" },
    { kind: "person", id: 3, name: "X" }, { kind: "film", id: 11, title: "G" }, { kind: "person", id: 2, name: "B" },
  ];

  test("günlük sonuç bir kez sayılır, zincir saklanır", () => {
    const first = recordChainResult(null, { mode: "daily", dayKey: "2026-10-30", puzzle, chain: solved });
    expect(first.counted).toBe(true);
    expect(first.stats).toMatchObject({ plays: 1, solved: 1, perfect: 1, gaveUp: 0, bestStreak: 1 });
    expect(dailyChainRecord(first.stats, "2026-10-30")).toMatchObject({ puzzleId: "p", links: 2, par: 2, points: 100 });
    expect(dailyChainRecord(first.stats, "2026-10-30").path).toHaveLength(5);
    const again = recordChainResult(first.stats, { mode: "daily", dayKey: "2026-10-30", puzzle, chain: solved, gaveUp: true });
    expect(again.counted).toBe(false);
    expect(again.stats.plays).toBe(1);
  });

  test("bulmaca başına İLK sonuç tutulur (mod fark etmez); en çok CHAIN_RESULTS_KEPT", () => {
    const one = { ...puzzle, id: "1-2" };
    let { stats } = recordChainResult(null, { mode: "free", puzzle: one, chain: solved });
    ({ stats } = recordChainResult(stats, { mode: "free", puzzle: one, chain: solved, gaveUp: true }));
    expect(chainResultOf(stats, "1-2")).toEqual({ links: 2, points: 100, gaveUp: false });
    expect(chainResultOf(stats, "yok")).toBeNull();
    for (let i = 0; i < CHAIN_RESULTS_KEPT + 3; i += 1) {
      ({ stats } = recordChainResult(stats, { mode: "free", puzzle: { ...puzzle, id: `${i}-${i + 1}` }, chain: solved }));
    }
    expect(Object.keys(stats.results)).toHaveLength(CHAIN_RESULTS_KEPT);
    expect(chainResultOf(stats, "0-1")).toBeNull(); // en eskiler düştü
    expect(chainResultOf(stats, `${CHAIN_RESULTS_KEPT + 2}-${CHAIN_RESULTS_KEPT + 3}`)).not.toBeNull();
    expect(normalizeChainStats({ results: { "1-2": { links: 2, points: 75 }, kötü: { links: 1 } } }).results).toEqual({
      "1-2": { links: 2, points: 75, gaveUp: false },
    });
  });

  test("serbest oyun günü kaydetmez; pes etmek seriyi kırar", () => {
    let { stats } = recordChainResult(null, { mode: "free", puzzle, chain: solved });
    expect(Object.keys(stats.days)).toHaveLength(0);
    expect(stats.solved).toBe(1);
    ({ stats } = recordChainResult(stats, { mode: "daily", dayKey: "2026-10-28", puzzle, chain: solved }));
    ({ stats } = recordChainResult(stats, { mode: "daily", dayKey: "2026-10-29", puzzle, chain: solved }));
    expect(chainStreak(stats, "2026-10-30")).toBe(2); // dün dahil
    ({ stats } = recordChainResult(stats, { mode: "daily", dayKey: "2026-10-30", puzzle, chain: solved, gaveUp: true }));
    expect(chainStreak(stats, "2026-10-30")).toBe(2); // bugün pes: dünden geriye sayılır
    expect(chainStreak(stats, "2026-10-31")).toBe(0);
    expect(stats.gaveUp).toBe(1);
    expect(stats.bestStreak).toBe(2);
  });

  test("en çok CHAIN_DAYS_KEPT gün tutulur; bozuk kayıt temizlenir; boş kayıt null", () => {
    let stats = null;
    for (let d = 0; d < CHAIN_DAYS_KEPT + 5; d += 1) {
      const day = new Date(Date.UTC(2026, 0, 1) + d * 86400000).toISOString().slice(0, 10);
      ({ stats } = recordChainResult(stats, { mode: "daily", dayKey: day, puzzle, chain: solved }));
    }
    expect(Object.keys(stats.days)).toHaveLength(CHAIN_DAYS_KEPT);
    expect(stats.days["2026-01-01"]).toBeUndefined();
    expect(normalizeChainStats({ plays: -3, days: { bad: {}, "2026-01-01": { links: "x", path: [null, { kind: "?" }] } } }))
      .toMatchObject({ plays: 0, days: { "2026-01-01": { links: 0, path: [] } } });
    expect(toStoredChainStats(null)).toBeNull();
  });
});

describe("paylaşım", () => {
  const copy = getFilmChainCopy("tr");
  const puzzle = { id: "p", par: 2, number: 12, start: { name: "Tom Hanks" }, target: { name: "Zendaya" } };
  test("emoji özet; zincirin kendisi yazılmaz", () => {
    expect(chainShareText(copy, { puzzle, links: 3 })).toBe(
      "Seelogd Film Zinciri #12\nTom Hanks → Zendaya\n🎬🎬🎬 3 film · en kısa 2\n⭐⭐",
    );
    expect(chainShareText(copy, { puzzle: { ...puzzle, number: null }, links: 0, gaveUp: true })).toBe(
      "Seelogd Film Zinciri\nTom Hanks → Zendaya\nBugün çözemedim 🫠",
    );
  });
});

describe("metinler", () => {
  const shape = (table) =>
    Object.keys(table).sort().map((key) => `${key}:${typeof table[key]}`);
  test.each(Object.keys(FILM_CHAIN_COPY))("%s aynı anahtarlar", (lang) => {
    expect(shape(FILM_CHAIN_COPY[lang])).toEqual(shape(FILM_CHAIN_COPY.tr));
  });

  test("her anahtar bir yerde kullanılıyor", () => {
    const sources = [
      "../screens/game/FilmChainScreen.js",
      "../components/game/QuickGamesGrid.js",
      "../utils/filmChain.js",
      "../components/game/QuickGameParts.js", // LoadingState / ErrorState ortak metinleri
      "../components/chat/SharedChainMessage.js",
    ].map((file) => fs.readFileSync(path.join(__dirname, file), "utf8")).join("\n");
    const unused = Object.keys(FILM_CHAIN_COPY.tr).filter((key) => !new RegExp(`\\.${key}\\b`).test(sources));
    expect(unused).toEqual([]);
  });

  test("bilinmeyen dil İngilizce", () => {
    expect(getFilmChainCopy("xx")).toBe(FILM_CHAIN_COPY.en);
  });
});
