// __tests__/ratingGame.test.js
//
// "Hangisinin puanı daha yüksek?" saf çekirdeği (utils/ratingGame.js): uygun yapım süzgeci, iki puanın gizliliği,
// eşit puanlı çiftin HİÇ seçilmemesi, bağımsız turlar, zorluk eğrisi, bilindiklik ağırlığı, afiş anahtarıyla cevap
// değerlendirmesi ve hızlı oyun kayıt defterine bağlanma (tek can, kayıt, tablo kimliği).

const {
  RATING_MIN_GAP, RATING_MIN_VOTES, buildRatingQuestion, compareRatings, gapForStreak,
  isRatingCandidate, judgeRatingAnswer, ratingOf, weightedPick,
} = require("../utils/ratingGame");
const {
  QUICK_GAME_IDS, QUICK_GAME_META, QUICK_LIVES, buildQuickQuestion, judgeQuickAnswer, pushQuickRecent,
  quickLivesOf, recordQuickRun,
} = require("../utils/quickGames");
const { boardIdOf, QUICK_BOARD_IDS } = require("../utils/gameBoards");
const { keyOfItem } = require("../utils/olderGame");

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

const MAX_YEAR = 2026;
const item = (id, voteAverage, extra = {}) => ({
  mediaKey: `${extra.type || "movie"}_${id}`, id, type: "movie", year: "2001", posterPath: `/p${id}.jpg`,
  title: `Yapım ${id}`, voteCount: 5000, popularity: 40, voteAverage, ...extra,
});
// 120 yapım, puanlar 3.0–9.0 arası (çoğu birbirinden farklı, bazıları kasten eşit).
const pool = () => Array.from({ length: 120 }, (_, i) => item(i + 1, 3 + ((i * 7) % 61) / 10, { voteCount: 400 + i * 150 }));
const ask = (extra = {}) => buildRatingQuestion({ pool: pool(), rng: seeded(1), maxYear: MAX_YEAR, ...extra });

describe("puan ve uygunluk", () => {
  test("puan tek ondalığa yuvarlanır; puansız / bozuk değer 0", () => {
    expect(ratingOf({ voteAverage: 7.849 })).toBe(7.8);
    expect(ratingOf({ voteAverage: 7.85 })).toBe(7.9);
    expect(ratingOf({ voteAverage: 0 })).toBe(0);
    expect(ratingOf({ voteAverage: "abc" })).toBe(0);
    expect(ratingOf({})).toBe(0);
    expect(ratingOf({ voteAverage: 12 })).toBe(10);
  });

  test("uygun yapım: afiş + yıl + puan + en az RATING_MIN_VOTES oy; yetişkin yalnız izinle", () => {
    const opts = { maxYear: MAX_YEAR };
    expect(isRatingCandidate(item(1, 7.1), opts)).toBe(true);
    expect(isRatingCandidate(item(2, 0), opts)).toBe(false); // puansız (eski önbellek)
    expect(isRatingCandidate(item(3, 7.1, { voteCount: RATING_MIN_VOTES - 1 }), opts)).toBe(false); // az oylu
    expect(isRatingCandidate(item(4, 7.1, { voteCount: RATING_MIN_VOTES }), opts)).toBe(true);
    expect(isRatingCandidate(item(5, 7.1, { posterPath: null }), opts)).toBe(false);
    expect(isRatingCandidate(item(6, 7.1, { year: "2099" }), opts)).toBe(false);
    expect(isRatingCandidate(item(7, 7.1, { adult: true }), opts)).toBe(false);
    expect(isRatingCandidate(item(7, 7.1, { adult: true }), { ...opts, allowAdult: true })).toBe(true);
  });
});

describe("çift seçimi", () => {
  test("iki farklı yapım; iki afiş doğrudan şık, doğru anahtar puanı yüksek yapım", () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const q = ask({ rng: seeded(seed) });
      const [a, b] = q.items;
      expect(keyOfItem(a)).not.toBe(keyOfItem(b));
      expect(q.gameId).toBe("rating");
      expect(q.layout).toBe("rating");
      expect(q.options.map((o) => o.key)).toEqual(q.items.map(keyOfItem));
      expect(q.facts.ratings).toEqual([ratingOf(a), ratingOf(b)]);
      expect(q.correctKey).toBe(keyOfItem(ratingOf(b) > ratingOf(a) ? b : a));
    }
  });

  test("EŞİT PUANLI ÇİFT HİÇ SEÇİLMEZ (en zor seride bile; puanların yarısı eşit olan havuzda)", () => {
    // Puanlar yalnız üç değer: 6.0, 6.0 ve 6.04 (görünen 6.0) ile 7.5 — eşit çift bolca var.
    const ties = Array.from({ length: 60 }, (_, i) => item(i + 1, [6, 6.04, 7.5][i % 3]));
    for (let seed = 1; seed <= 200; seed += 1) {
      const q = buildRatingQuestion({ pool: ties, streak: 40, rng: seeded(seed), maxYear: MAX_YEAR });
      expect(ratingOf(q.items[0])).not.toBe(ratingOf(q.items[1]));
      expect(Math.abs(q.facts.ratings[0] - q.facts.ratings[1])).toBeGreaterThanOrEqual(RATING_MIN_GAP - 1e-9);
    }
  });

  test("hepsi aynı puanlıysa soru kurulmaz (null); boş / tek öğeli / bozuk havuz da null", () => {
    const flat = Array.from({ length: 30 }, (_, i) => item(i + 1, 6.98 + (i % 2) * 0.06)); // 6.98 / 7.04: hepsi 7.0 görünür
    expect(buildRatingQuestion({ pool: flat, maxYear: MAX_YEAR })).toBeNull();
    expect(buildRatingQuestion({ pool: [], maxYear: MAX_YEAR })).toBeNull();
    expect(buildRatingQuestion({ pool: [item(1, 7)], maxYear: MAX_YEAR })).toBeNull();
    expect(buildRatingQuestion({ pool: null })).toBeNull();
    expect(buildRatingQuestion()).toBeNull();
  });

  test("az oylu ve puansız yapımlar hiç sorulmaz", () => {
    const mixed = [
      ...pool(),
      ...Array.from({ length: 40 }, (_, i) => item(500 + i, 9.9, { voteCount: 12 })),
      ...Array.from({ length: 40 }, (_, i) => item(600 + i, 0)),
    ];
    for (let seed = 1; seed <= 80; seed += 1) {
      const q = buildRatingQuestion({ pool: mixed, rng: seeded(seed), maxYear: MAX_YEAR });
      q.items.forEach((x) => expect(x.id).toBeLessThan(500));
    }
  });

  test("yetişkin içerik izni yoksa yetişkin yapım ne ilk ne ikinci olur; izin varsa çıkabilir", () => {
    const adultPool = [...pool(), ...Array.from({ length: 200 }, (_, i) => item(700 + i, 1 + (i % 9), { adult: true, voteCount: 90000, popularity: 900 }))];
    let adultSeen = false;
    for (let seed = 1; seed <= 80; seed += 1) {
      const q = buildRatingQuestion({ pool: adultPool, rng: seeded(seed), maxYear: MAX_YEAR });
      q.items.forEach((x) => expect(x.adult).not.toBe(true));
      const allowed = buildRatingQuestion({ pool: adultPool, rng: seeded(seed), maxYear: MAX_YEAR, allowAdult: true });
      if (allowed.items.some((x) => x.adult)) adultSeen = true;
    }
    expect(adultSeen).toBe(true);
    // Hızlı oyun kapısından da aynı: allowAdult geçmezse kapalı.
    const viaQuick = buildQuickQuestion("rating", { pool: adultPool, rng: seeded(3), maxYear: MAX_YEAR });
    viaQuick.items.forEach((x) => expect(x.adult).not.toBe(true));
  });

  test("zorluk: seri arttıkça en küçük puan farkı düşer (1.5 → 0.1); erken turlarda fark büyük", () => {
    expect(gapForStreak(0)).toBe(1.5);
    expect(gapForStreak(3)).toBe(1);
    expect(gapForStreak(6)).toBe(0.6);
    expect(gapForStreak(10)).toBe(0.3);
    expect(gapForStreak(15)).toBe(RATING_MIN_GAP);
    expect(gapForStreak(-4)).toBe(1.5);
    expect(gapForStreak("x")).toBe(1.5);
    for (let s = 0; s < 30; s += 1) expect(gapForStreak(s + 1)).toBeLessThanOrEqual(gapForStreak(s));
    for (let seed = 1; seed <= 60; seed += 1) {
      const q = ask({ rng: seeded(seed), streak: 0 });
      expect(Math.abs(q.facts.ratings[0] - q.facts.ratings[1])).toBeGreaterThanOrEqual(1.5 - 1e-9);
    }
  });

  test("uygun fark yoksa gevşetilir (oyun çift çıkmadı diye bitmez) ama asla eşit değil", () => {
    const narrow = Array.from({ length: 20 }, (_, i) => item(i + 1, 7 + (i % 4) / 10)); // 7.0–7.3
    const q = buildRatingQuestion({ pool: narrow, streak: 0, rng: seeded(5), maxYear: MAX_YEAR });
    expect(q).not.toBeNull();
    expect(ratingOf(q.items[0])).not.toBe(ratingOf(q.items[1]));
  });

  test("aynı tohum aynı soruyu verir", () => {
    const a = ask({ rng: seeded(42), streak: 4 });
    const b = ask({ rng: seeded(42), streak: 4 });
    expect(a.items.map(keyOfItem)).toEqual(b.items.map(keyOfItem));
  });
});

describe("bağımsız turlar ve tekrar", () => {
  test("sonraki tur önceki çifte zincirlenmez; yakın zamanda sorulan yapımlar gelmez", () => {
    const items = pool();
    const rng = seeded(9);
    let recent = new Set();
    for (let streak = 0; streak < 30; streak += 1) {
      const q = buildRatingQuestion({ pool: items, previous: { gameId: "rating", items: items.slice(0, 2) }, streak, recent, rng, maxYear: MAX_YEAR });
      q.items.forEach((entry) => expect(recent.has(keyOfItem(entry))).toBe(false)); // havuz 120, pencere 40 → taze
      expect(q.facts.chained).toBeUndefined();
      recent = pushQuickRecent(recent, q);
    }
  });

  test("previous artık soru seçimini etkilemez", () => {
    const items = pool();
    const previous = { gameId: "rating", items: [items[0], { ...items[1], id: 999, mediaKey: "movie_999" }] };
    const withPrevious = buildRatingQuestion({ pool: items, previous, rng: seeded(2), maxYear: MAX_YEAR });
    const withoutPrevious = buildRatingQuestion({ pool: items, rng: seeded(2), maxYear: MAX_YEAR });
    expect(withPrevious.items.map(keyOfItem)).toEqual(withoutPrevious.items.map(keyOfItem));
  });
});

describe("bilindik ağırlık", () => {
  test("weightedPick çok oylu / popüler yapımı belirgin biçimde daha sık seçer; boş listede null", () => {
    const famous = item(1, 8, { voteCount: 30000, popularity: 120 });
    const obscure = item(2, 8, { voteCount: 310, popularity: 1 });
    const rng = seeded(11);
    let famousCount = 0;
    for (let i = 0; i < 2000; i += 1) if (weightedPick([famous, obscure], rng) === famous) famousCount += 1;
    expect(famousCount).toBeGreaterThan(1300);
    expect(famousCount).toBeLessThan(2000); // tanınmayan da arada çıkar
    expect(weightedPick([], rng)).toBeNull();
    expect(weightedPick(null, rng)).toBeNull();
  });

  test("soruda çok oylu yapımlar, az oylu çoğunluğa rağmen öne çıkar", () => {
    const famous = Array.from({ length: 10 }, (_, i) => item(i + 1, 3 + i * 0.6, { voteCount: 40000, popularity: 150 }));
    const obscure = Array.from({ length: 90 }, (_, i) => item(100 + i, 3 + (i % 60) / 10, { voteCount: 320, popularity: 1 }));
    let famousSlots = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const q = buildRatingQuestion({ pool: [...famous, ...obscure], rng: seeded(seed), maxYear: MAX_YEAR });
      famousSlots += q.items.filter((x) => x.id <= 10).length;
    }
    // Düz rastgelede 400 yuvanın ~%10'u (≈40); ağırlıkla belirgin biçimde fazlası.
    expect(famousSlots).toBeGreaterThan(100);
  });
});

describe("cevap değerlendirmesi", () => {
  const q = (a, b) => {
    const items = [item(1, a), item(2, b)];
    return { gameId: "rating", items, correctKey: keyOfItem(b > a ? items[1] : items[0]) };
  };

  test("yüksek puanlı afiş anahtarı doğru değerlendirilir (tek ondalıklı puanla)", () => {
    expect(compareRatings(item(1, 6.5), item(2, 7.2))).toBe("higher");
    expect(compareRatings(item(1, 7.2), item(2, 6.5))).toBe("lower");
    expect(compareRatings(item(1, 7.04), item(2, 6.96))).toBe("equal"); // ikisi de 7.0 görünür
    expect(judgeRatingAnswer(q(6.5, 7.2), "movie_2")).toEqual({ correct: true, correctKey: "movie_2" });
    expect(judgeRatingAnswer(q(6.5, 7.2), "movie_1")).toEqual({ correct: false, correctKey: "movie_2" });
    expect(judgeRatingAnswer(q(8.1, 7.2), "movie_1")).toEqual({ correct: true, correctKey: "movie_1" });
  });

  test("eşit puan gelirse (savunma) iki cevap da doğru; anlamsız anahtar yanlış", () => {
    const tie = { gameId: "rating", items: [item(1, 7.04), item(2, 6.96)] };
    expect(judgeRatingAnswer(tie, "movie_1").correct).toBe(true);
    expect(judgeRatingAnswer(tie, "movie_2").correct).toBe(true);
    expect(judgeRatingAnswer(tie, "__timeout__").correct).toBe(false);
  });

  test("ortak judgeQuickAnswer rating sorusunu bu kurala yönlendirir", () => {
    const tie = { gameId: "rating", items: [item(1, 7.04), item(2, 6.96)], correctKey: "movie_1" };
    expect(judgeQuickAnswer(tie, "movie_2").correct).toBe(true);
    expect(judgeQuickAnswer(q(5, 9), "movie_2").correct).toBe(true);
  });
});

describe("hızlı oyun kayıt defterine bağlanma", () => {
  test("QUICK_GAME_IDS'te; kendi düzeni; TEK CAN (diğer oyunlar QUICK_LIVES)", () => {
    expect(QUICK_GAME_IDS).toContain("rating");
    expect(QUICK_GAME_META.rating.layout).toBe("rating");
    expect(QUICK_GAME_META.rating.timed).toBeFalsy();
    expect(quickLivesOf("rating")).toBe(1);
    expect(quickLivesOf("popular")).toBe(QUICK_LIVES);
    expect(quickLivesOf("yok")).toBe(QUICK_LIVES);
  });

  test("liderlik tablosu quick_rating (oyun kimliği sunucunun board/XP kalıbına uyar)", () => {
    expect(boardIdOf("rating")).toBe("quick_rating");
    expect(QUICK_BOARD_IDS).toContain("quick_rating");
    // functions/publicBoards BOARD_ID_RE ve functions/leagueRules game ref kalıbı
    expect("quick_rating").toMatch(/^quick_[a-z0-9_]{1,32}$/);
    expect("quick_rating:123").toMatch(/^[a-z_]{1,24}:[A-Za-z0-9_:.-]{1,60}$/);
  });

  test("skor = seri: koşu kaydı rekor / oyun / doğru sayısını tutar", () => {
    const first = recordQuickRun(null, "rating", { score: 7, correct: 7, answered: 8 });
    expect(first.newBest).toBe(true);
    expect(first.all.rating).toEqual({ best: 7, plays: 1, correct: 7, answered: 8 });
    const second = recordQuickRun(first.all, "rating", { score: 3, correct: 3, answered: 4 });
    expect(second.newBest).toBe(false);
    expect(second.all.rating).toEqual({ best: 7, plays: 2, correct: 10, answered: 12 });
  });

  test("buildQuickQuestion 'rating' bağımsız çift ve yakın-zaman süzgecini geçirir", () => {
    const items = pool();
    const first = buildQuickQuestion("rating", { pool: items, rng: seeded(4), maxYear: MAX_YEAR });
    const recent = pushQuickRecent(new Set(), first);
    const next = buildQuickQuestion("rating", { pool: items, previous: first, recent, streak: 1, rng: seeded(5), maxYear: MAX_YEAR });
    next.items.forEach((entry) => expect(recent.has(keyOfItem(entry))).toBe(false));
  });
});
