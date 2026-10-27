// __tests__/quickGames.test.js
//
// Hızlı oyunların saf çekirdeği (utils/quickGames.js): beş oyunun soru üretimi, zorluk eğrileri, cevap
// değerlendirmesi, tür eşlemesi ve oyun başına cihaz-yerel kayıt.

const {
  BLUR_MAX_POINTS, BLUR_MIN_POINTS, BLUR_ROUND_MS, BLUR_SIMILAR_AT, BLUR_START, blurAmount, blurPoints, blurRemaining,
  isTimedQuickGame, KIND_HIDE_TITLE_AT, QUICK_GAME_IDS, QUICK_GAME_META, QUICK_GENRES, buildQuickQuestion, canonGenresOf, decadeOf,
  isQuickGame, judgeQuickAnswer, normalizeQuickStats, pushQuickRecent, questionItemKeys, ratioForStreak,
  recordQuickRun, statsOfQuickGame, toStoredQuickStats, QUICK_RECENT_WINDOW,
} = require("../utils/quickGames");
const { recordOlderRun } = require("../utils/olderGame");

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const item = (id, year, extra = {}) => ({
  mediaKey: `${extra.type || "movie"}_${id}`, id, type: "movie", year: String(year), posterPath: `/p${id}.jpg`,
  title: `Yapım ${id}`, voteCount: 1000 + id * 37, genreIds: [18], ...extra,
});
const MAX_YEAR = 2026;
// Karışık, gerçekçi havuz: film + dizi, 1950–2025, farklı oy sayıları ve türler.
const pool = () => {
  const items = [];
  for (let i = 0; i < 160; i += 1) {
    const isTv = i % 4 === 0;
    items.push(item(i + 1, 1950 + (i % 76), {
      type: isTv ? "tv" : "movie",
      voteCount: Math.round(60 * Math.pow(1.045, i * 1.4)),
      genreIds: [[28, 12], [35], [18, 10749], [27, 53], [878, 14], [16, 10751], [80, 9648], [99]][i % 8],
    }));
  }
  return items;
};
const ask = (gameId, streak, seed, extra = {}) =>
  buildQuickQuestion(gameId, { pool: pool(), streak, rng: seeded(seed), maxYear: MAX_YEAR, ...extra });

describe("kayıt defteri", () => {
  test("beş oyun, her birinin düzeni ve rengi var; yalnız Bulanık Afiş zamanlı", () => {
    expect(QUICK_GAME_IDS).toEqual(["popular", "decade", "kind", "genre", "blur"]);
    expect(QUICK_GAME_IDS.filter(isTimedQuickGame)).toEqual(["blur"]);
    QUICK_GAME_IDS.forEach((id) => {
      expect(isQuickGame(id)).toBe(true);
      expect(["pair", "single", "blur"]).toContain(QUICK_GAME_META[id].layout);
      expect(QUICK_GAME_META[id].colors).toHaveLength(2);
    });
    expect(isQuickGame("older")).toBe(false);
    expect(buildQuickQuestion("yok", { pool: pool() })).toBeNull();
  });
});

describe("tür eşlemesi", () => {
  test("film ve dizi kimlikleri kanonik türe iner; haber/realite/talk atılır; tekrar yok", () => {
    expect(canonGenresOf({ genreIds: [28, 10759, 878, 10765] })).toEqual(["action", "scifi"]);
    expect(canonGenresOf({ genreIds: [10766, 18] })).toEqual(["drama"]);
    expect(canonGenresOf({ genreIds: [10763, 10764, 10767, 10770] })).toEqual([]);
    expect(canonGenresOf({ genreIds: [10762, 10751] })).toEqual(["family"]);
    expect(canonGenresOf({})).toEqual([]);
    expect(canonGenresOf(null)).toEqual([]);
    canonGenresOf({ genreIds: [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37] })
      .forEach((g) => expect(QUICK_GENRES).toContain(g));
  });
});

describe("popular (hangisi daha çok oy aldı)", () => {
  test("doğru taraf oyu çok olandır; oran hedefe uyar; düzen iki yöne dağılır", () => {
    let firstWins = 0;
    for (let i = 0; i < 300; i += 1) {
      const q = ask("popular", 0, i + 1);
      expect(q.layout).toBe("pair");
      const [a, b] = q.items;
      expect(a).not.toBe(b);
      const [va, vb] = q.facts.votes;
      expect(Math.max(va, vb) / Math.min(va, vb)).toBeGreaterThanOrEqual(ratioForStreak(0) * 0.5 - 1e-9);
      expect(q.correctKey).toBe(va > vb ? q.options[0].key : q.options[1].key);
      expect(judgeQuickAnswer(q, q.correctKey).correct).toBe(true);
      expect(judgeQuickAnswer(q, va > vb ? q.options[1].key : q.options[0].key).correct).toBe(false);
      if (va > vb) firstWins += 1;
    }
    expect(firstWins).toBeGreaterThan(90);
    expect(firstWins).toBeLessThan(210);
  });

  test("oran basamakları azalır; yüksek seride oran küçülür ama eşit oy asla çıkmaz", () => {
    expect([0, 2, 3, 5, 6, 9, 10, 14, 15, 21, 22].map(ratioForStreak)).toEqual([8, 8, 4, 4, 2.5, 2.5, 1.8, 1.8, 1.4, 1.4, 1.2]);
    for (let i = 0; i < 200; i += 1) {
      const q = ask("popular", 30, i + 1000);
      expect(q.facts.votes[0]).not.toBe(q.facts.votes[1]);
    }
  });

  test("az oylu yapımlar sorulmaz", () => {
    const small = Array.from({ length: 30 }, (_, i) => item(i + 1, 2000 + (i % 20), { voteCount: 10 }));
    expect(buildQuickQuestion("popular", { pool: small, maxYear: MAX_YEAR })).toBeNull();
    const mixed = [...small, item(100, 2001, { voteCount: 500 }), item(101, 2002, { voteCount: 90000 })];
    const q = buildQuickQuestion("popular", { pool: mixed, maxYear: MAX_YEAR, rng: seeded(3) });
    expect(q.items.map((x) => x.id).sort()).toEqual([100, 101]);
  });

  test("havuzdaki herkesin oyu aynıysa soru yok", () => {
    const same = Array.from({ length: 20 }, (_, i) => item(i + 1, 2000 + i, { voteCount: 500 }));
    expect(buildQuickQuestion("popular", { pool: same, maxYear: MAX_YEAR })).toBeNull();
  });
});

describe("decade (hangi on yıl)", () => {
  test("dört benzersiz, sıralı şık; doğru on yıl içinde; yıl öğeyle tutarlı", () => {
    for (let i = 0; i < 300; i += 1) {
      const q = ask("decade", i % 20, i + 1);
      expect(q.layout).toBe("single");
      expect(q.options).toHaveLength(4);
      const keys = q.options.map((o) => Number(o.key));
      expect(new Set(keys).size).toBe(4);
      expect([...keys].sort((a, b) => a - b)).toEqual(keys);
      expect(keys).toContain(decadeOf(q.facts.year));
      expect(q.correctKey).toBe(String(decadeOf(q.facts.year)));
      keys.forEach((d) => {
        expect(d % 10).toBe(0);
        expect(d).toBeLessThanOrEqual(2020);
      });
    }
  });

  test("erken seride yanlış şıklar uzak, sonra yakın on yıllardır", () => {
    let easyNear = 0;
    let hardNear = 0;
    for (let i = 0; i < 300; i += 1) {
      const easy = ask("decade", 0, i + 1);
      const hard = ask("decade", 10, i + 1);
      const c1 = Number(easy.correctKey);
      const c2 = Number(hard.correctKey);
      easyNear += easy.options.filter((o) => Number(o.key) !== c1 && Math.abs(Number(o.key) - c1) <= 10).length;
      hardNear += hard.options.filter((o) => Number(o.key) !== c2 && Math.abs(Number(o.key) - c2) <= 10).length;
    }
    expect(hardNear).toBeGreaterThan(easyNear); // zor seviyede komşu on yıl şıkta daha sık
  });

  test("bütün havuz tek on yıldaysa bile şık üretir (yakın/uzak ayrımı havuza bağlı değil)", () => {
    const one = Array.from({ length: 20 }, (_, i) => item(i + 1, 1990 + (i % 10)));
    const q = buildQuickQuestion("decade", { pool: one, maxYear: MAX_YEAR, rng: seeded(5) });
    expect(q.options).toHaveLength(4);
    expect(q.correctKey).toBe("1990");
  });
});

describe("kind (film mi dizi mi)", () => {
  test("cevap öğenin türüdür; film/dizi dengeli; başlık eşikten sonra gizlenir", () => {
    let tv = 0;
    for (let i = 0; i < 400; i += 1) {
      const q = ask("kind", 0, i + 1);
      expect(q.options.map((o) => o.key).sort()).toEqual(["movie", "tv"]);
      expect(q.correctKey).toBe(q.items[0].type === "tv" ? "tv" : "movie");
      expect(q.showTitle).toBe(true);
      if (q.correctKey === "tv") tv += 1;
    }
    // Havuzda dizi yalnız %25 ama soruda ~%50 olmalı.
    expect(tv).toBeGreaterThan(150);
    expect(tv).toBeLessThan(250);
    expect(ask("kind", KIND_HIDE_TITLE_AT - 1, 1).showTitle).toBe(true);
    expect(ask("kind", KIND_HIDE_TITLE_AT, 1).showTitle).toBe(false);
  });

  test("havuzda tek tür varsa soru yok", () => {
    const onlyMovies = Array.from({ length: 20 }, (_, i) => item(i + 1, 2000 + i));
    expect(buildQuickQuestion("kind", { pool: onlyMovies, maxYear: MAX_YEAR })).toBeNull();
  });
});

describe("genre (hangi tür)", () => {
  test("doğru şık öğenin türlerindendir; yanlış şıkların HİÇBİRİ öğenin türü değildir", () => {
    for (let i = 0; i < 400; i += 1) {
      const q = ask("genre", i % 12, i + 1);
      expect(q.options).toHaveLength(4);
      const keys = q.options.map((o) => o.key);
      expect(new Set(keys).size).toBe(4);
      const own = canonGenresOf(q.items[0]);
      expect(own).toContain(q.correctKey);
      keys.filter((k) => k !== q.correctKey).forEach((k) => expect(own).not.toContain(k));
      keys.forEach((k) => expect(QUICK_GENRES).toContain(k));
      expect(q.facts.genres).toEqual(own);
    }
  });

  test("yüksek seride yanlış şıklar bilindik türlerden gelir", () => {
    const common = new Set(["drama", "comedy", "action", "thriller", "adventure", "scifi", "romance", "crime"]);
    let allCommon = 0;
    for (let i = 0; i < 200; i += 1) {
      const q = ask("genre", 10, i + 1);
      if (q.options.filter((o) => o.key !== q.correctKey).every((o) => common.has(o.key))) allCommon += 1;
    }
    expect(allCommon).toBe(200);
  });

  test("türü tanınmayan öğeler elenir; hiçbiri yoksa soru yok", () => {
    const unknown = Array.from({ length: 20 }, (_, i) => item(i + 1, 2000 + i, { genreIds: [10763, 10764] }));
    expect(buildQuickQuestion("genre", { pool: unknown, maxYear: MAX_YEAR })).toBeNull();
    const none = Array.from({ length: 20 }, (_, i) => item(i + 1, 2000 + i, { genreIds: undefined }));
    expect(buildQuickQuestion("genre", { pool: none, maxYear: MAX_YEAR })).toBeNull();
  });
});

describe("ortak", () => {
  test("her oyunda aynı tohum aynı soruyu verir", () => {
    QUICK_GAME_IDS.forEach((id) => {
      const a = ask(id, 4, 77);
      const b = ask(id, 4, 77);
      expect(questionItemKeys(a)).toEqual(questionItemKeys(b));
      expect(a.correctKey).toBe(b.correctKey);
    });
  });

  test("havuz boş / bozuk / çok küçükse null", () => {
    QUICK_GAME_IDS.forEach((id) => {
      expect(buildQuickQuestion(id, { pool: [], maxYear: MAX_YEAR })).toBeNull();
      expect(buildQuickQuestion(id, { pool: null })).toBeNull();
      expect(buildQuickQuestion(id, {})).toBeNull();
    });
    // Tek öğeli havuz: iki afişli oyun kurulamaz; tek afişli oyunlar teknik olarak kurulabilir (havuz alt sınırını
    // hooks/useQuickGame MIN_USABLE_POOL ile zorlar).
    expect(buildQuickQuestion("popular", { pool: [item(1, 2000)], maxYear: MAX_YEAR })).toBeNull();
  });

  test("yakın zamanda sorulanlar tercih dışı; pencere aşılmaz", () => {
    const items = pool();
    let recent = new Set();
    for (let i = 0; i < 80; i += 1) {
      const q = buildQuickQuestion("decade", { pool: items, streak: 0, recent, rng: seeded(i + 1), maxYear: MAX_YEAR });
      expect(recent.has(questionItemKeys(q)[0])).toBe(false); // havuz 160, pencere 40 → taze her zaman var
      recent = pushQuickRecent(recent, q);
      expect(recent.size).toBeLessThanOrEqual(QUICK_RECENT_WINDOW);
    }
  });

  test("gelecekten gelen yıl (vizyon yılı +1 ötesi) soru olmaz", () => {
    const future = [...pool(), item(900, 2099)];
    for (let i = 0; i < 100; i += 1) {
      const q = buildQuickQuestion("kind", { pool: future, rng: seeded(i + 1), maxYear: MAX_YEAR });
      expect(q.items[0].id).not.toBe(900);
    }
  });
});

describe("kayıt (oyun başına)", () => {
  test("bozuk kayıt güvenli; yalnız bilinen oyunlar; oynanmamış oyun listede yok", () => {
    expect(normalizeQuickStats(null)).toEqual({});
    expect(normalizeQuickStats([])).toEqual({});
    expect(normalizeQuickStats({ yok: { best: 5, plays: 1 }, genre: { best: 3, plays: 2, correct: 4, answered: 9 }, kind: { best: 9 } }))
      .toEqual({ genre: { best: 3, plays: 2, correct: 4, answered: 9 } });
  });

  test("koşu yalnız o oyunun kaydını etkiler; rekor kuralları older ile aynı", () => {
    const first = recordQuickRun(null, "popular", { score: 6, answered: 9 });
    expect(first.newBest).toBe(true);
    expect(first.all).toEqual({ popular: { best: 6, plays: 1, correct: 6, answered: 9 } });
    const second = recordQuickRun(first.all, "decade", { score: 2, answered: 5 });
    expect(second.all.popular).toEqual(first.all.popular);
    expect(second.all.decade).toEqual({ best: 2, plays: 1, correct: 2, answered: 5 });
    const worse = recordQuickRun(second.all, "popular", { score: 3, answered: 6 });
    expect(worse.newBest).toBe(false);
    expect(worse.stats.best).toBe(6);
    expect(worse.stats.plays).toBe(2);
    expect(recordQuickRun(null, "popular", { score: 0, answered: 3 }).newBest).toBe(false);
  });

  test("bilinmeyen oyun kaydı değiştirmez; yardımcılar", () => {
    const base = recordQuickRun(null, "kind", { score: 4, answered: 7 }).all;
    const out = recordQuickRun(base, "yok", { score: 9, answered: 9 });
    expect(out.all).toEqual(base);
    expect(out.newBest).toBe(false);
    expect(statsOfQuickGame(base, "kind").best).toBe(4);
    expect(statsOfQuickGame(base, "genre")).toEqual({ best: 0, plays: 0, correct: 0, answered: 0 });
    expect(toStoredQuickStats({})).toBeNull();
    expect(toStoredQuickStats(base)).toEqual(base);
  });
});

describe("blur (Bulanık Afiş)", () => {
  test("saat: bulanıklık %50'den 0'a, puan 100'den 10'a DOĞRUSAL iner; süre dolunca 0", () => {
    expect(BLUR_START).toBe(0.5);
    expect(BLUR_ROUND_MS).toBe(10000);
    expect(blurAmount(0)).toBe(0.5);
    expect(blurAmount(BLUR_ROUND_MS / 2)).toBe(0.25);
    expect(blurAmount(BLUR_ROUND_MS)).toBe(0);
    expect(blurAmount(BLUR_ROUND_MS * 3)).toBe(0); // taşma yok
    expect(blurPoints(0)).toBe(BLUR_MAX_POINTS);
    expect(blurPoints(3000)).toBe(73); // 10 + 90 × 0,7
    expect(blurPoints(BLUR_ROUND_MS / 2)).toBe(55);
    expect(blurPoints(BLUR_ROUND_MS - 1)).toBe(BLUR_MIN_POINTS);
    expect(blurPoints(BLUR_ROUND_MS)).toBe(0);
    expect(blurPoints(-500)).toBe(BLUR_MAX_POINTS); // saat sapması fazladan puan vermez
    expect(blurRemaining("bozuk")).toBe(1);
    // Puan ve bulanıklık aynı saatten: hiçbir anda "daha net ama daha çok puan" olmaz.
    for (let t = 0; t < BLUR_ROUND_MS; t += 250) {
      expect(blurPoints(t + 250)).toBeLessThanOrEqual(blurPoints(t));
      expect(blurAmount(t + 250)).toBeLessThan(blurAmount(t));
    }
  });

  test("dört TEKİL başlık şıkkı; doğru cevap afişin kendisi; başlık gizli; şıklar aynı türden (film/dizi)", () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const q = ask("blur", 0, seed);
      expect(q.layout).toBe("blur");
      expect(q.showTitle).toBe(false);
      expect(q.options).toHaveLength(4);
      const [target] = q.items;
      expect(q.correctKey).toBe(target.mediaKey);
      expect(q.options.map((o) => o.key)).toContain(q.correctKey);
      expect(new Set(q.options.map((o) => o.title.toLowerCase())).size).toBe(4);
      const kinds = q.options.map((o) => pool().find((x) => x.mediaKey === o.key).type === "tv");
      kinds.forEach((isTv) => expect(isTv).toBe(target.type === "tv"));
      expect(judgeQuickAnswer(q, q.correctKey).correct).toBe(true);
    }
  });

  test("aynı adlı yapımlar aynı soruda şık olmaz (yeniden çevrim)", () => {
    const items = [
      item(1, 1976, { title: "Carrie" }), item(2, 2013, { title: "carrie " }),
      ...Array.from({ length: 10 }, (_, i) => item(10 + i, 1990 + i)),
    ];
    for (let seed = 1; seed <= 40; seed += 1) {
      const q = buildQuickQuestion("blur", { pool: items, rng: seeded(seed), maxYear: MAX_YEAR });
      expect(new Set(q.options.map((o) => o.title.trim().toLowerCase())).size).toBe(4);
    }
  });

  test("yüksek seride yanlış şıklar benzer yapımlardan (ortak tür ya da ±10 yıl)", () => {
    let similar = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const q = ask("blur", BLUR_SIMILAR_AT, seed);
      const target = q.items[0];
      const own = new Set(canonGenresOf(target));
      q.options.filter((o) => o.key !== q.correctKey).forEach((o) => {
        const other = pool().find((x) => x.mediaKey === o.key);
        total += 1;
        if (canonGenresOf(other).some((g) => own.has(g)) || Math.abs(Number(other.year) - Number(target.year)) <= 10) similar += 1;
      });
    }
    expect(similar).toBe(total);
  });

  test("dörtten az farklı başlık varsa soru yok", () => {
    const items = [item(1, 2000), item(2, 2001), item(3, 2002, { title: "Yapım 1" })];
    expect(buildQuickQuestion("blur", { pool: items, rng: seeded(1), maxYear: MAX_YEAR })).toBeNull();
  });

  test("kayıt: skor puan toplamı, doğru sayısı AYRI (isabet oranı bozulmaz)", () => {
    const first = recordQuickRun(null, "blur", { score: 245, correct: 3, answered: 6 });
    expect(first.stats).toEqual({ best: 245, plays: 1, correct: 3, answered: 6 });
    expect(first.newBest).toBe(true);
    const second = recordQuickRun(first.all, "blur", { score: 180, correct: 2, answered: 5 });
    expect(second.stats).toEqual({ best: 245, plays: 2, correct: 5, answered: 11 });
    // `correct` verilmeyen eski çağrı: skor = doğru sayısı (diğer oyunlar değişmedi).
    expect(recordOlderRun(null, { score: 4, answered: 7 }).stats).toEqual({ best: 4, plays: 1, correct: 4, answered: 7 });
  });
});
