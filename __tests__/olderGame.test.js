// __tests__/olderGame.test.js
//
// "Önce hangisi?" saf çekirdeği (utils/olderGame.js): zorluk basamakları, çift seçimi (yıl farkı, tekrar yok,
// havuz yetersizliği), cevap değerlendirmesi ve cihaz-yerel kayıt.

const {
  OLDER_LIVES, OLDER_RECENT_WINDOW, gapForStreak, isUsable, judgeAnswer, keyOfItem, normalizeOlderStats,
  olderAccuracy, pairKeys, pickPair, pushRecent, recordOlderRun, toStoredOlderStats,
} = require("../utils/olderGame");

// Tohumlu, tekrar edilebilir [0,1) üreteç (mulberry32).
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
  mediaKey: `movie_${id}`, id, type: "movie", year: String(year), posterPath: `/p${id}.jpg`, title: `Film ${id}`, ...extra,
});
// 1950'den 2025'e, her yıl bir yapım.
const wide = () => Array.from({ length: 76 }, (_, i) => item(i + 1, 1950 + i));

describe("zorluk basamakları", () => {
  test("seri arttıkça en küçük yıl farkı düşer; asla 1'in altına inmez", () => {
    const gaps = [0, 2, 3, 5, 6, 9, 10, 14, 15, 21, 22, 99].map(gapForStreak);
    expect(gaps).toEqual([20, 20, 12, 12, 7, 7, 4, 4, 2, 2, 1, 1]);
    for (let i = 1; i < gaps.length; i += 1) expect(gaps[i]).toBeLessThanOrEqual(gaps[i - 1]);
    expect(gapForStreak(-5)).toBe(20);
    expect(gapForStreak("çöp")).toBe(20);
    expect(OLDER_LIVES).toBe(3);
  });
});

describe("soru olabilecek öğe", () => {
  test("yılı ve afişi olmalı; geçersiz yıl elenir", () => {
    expect(isUsable(item(1, 1999), 2026)).toBe(true);
    expect(isUsable(item(1, 1999, { posterPath: null }), 2026)).toBe(false);
    expect(isUsable(item(1, ""), 2026)).toBe(false);
    expect(isUsable(item(1, "abcd"), 2026)).toBe(false);
    expect(isUsable(item(1, 1700), 2026)).toBe(false); // sinemadan önce
    expect(isUsable(item(1, 2099), 2026)).toBe(false); // gelecek
    expect(isUsable(item(1, 2027), 2027)).toBe(true); // vizyon yılı +1'e izin
    expect(isUsable({ id: 3, year: "2000" }, 2026)).toBe(false);
    expect(isUsable(null)).toBe(false);
  });
});

describe("pickPair", () => {
  test("yıl farkı hedefe uyar; eski olan doğru işaretlenir; yerleşim iki yöne de dağılır", () => {
    const pool = wide();
    let aOlder = 0;
    for (let i = 0; i < 300; i += 1) {
      const pair = pickPair({ pool, streak: 0, rng: seeded(i + 1), maxYear: 2026 });
      expect(pair).not.toBeNull();
      expect(pair.gap).toBeGreaterThanOrEqual(20);
      expect(pair.a).not.toBe(pair.b);
      const older = Number(pair.a.year) < Number(pair.b.year) ? pair.a : pair.b;
      expect(pair.olderKey).toBe(keyOfItem(older));
      expect(pair.gap).toBe(Math.abs(Number(pair.a.year) - Number(pair.b.year)));
      if (pair.olderKey === keyOfItem(pair.a)) aOlder += 1;
    }
    expect(aOlder).toBeGreaterThan(90); // eski olan hep solda (ya da sağda) değil
    expect(aOlder).toBeLessThan(210);
  });

  test("yüksek seride fark küçülür ama asla aynı yıl olmaz", () => {
    const pool = wide();
    for (let i = 0; i < 300; i += 1) {
      const pair = pickPair({ pool, streak: 30, rng: seeded(i + 500), maxYear: 2026 });
      expect(pair.gap).toBeGreaterThanOrEqual(1);
      expect(Number(pair.a.year)).not.toBe(Number(pair.b.year));
    }
  });

  test("hedef fark havuzda yoksa gevşetilir (oyun çift bulunamadığı için bitmez)", () => {
    // Tüm yapımlar 2018–2024 arası: 20 yıllık fark imkânsız.
    const pool = Array.from({ length: 12 }, (_, i) => item(i + 1, 2018 + (i % 7)));
    const pair = pickPair({ pool, streak: 0, rng: seeded(7), maxYear: 2026 });
    expect(pair).not.toBeNull();
    expect(pair.gap).toBeGreaterThanOrEqual(1);
    expect(pair.gap).toBeLessThanOrEqual(6);
  });

  test("havuzdaki herkes aynı yıldaysa çift YOK (cevabı olmayan soru sorulmaz)", () => {
    const pool = Array.from({ length: 10 }, (_, i) => item(i + 1, 2020));
    expect(pickPair({ pool, streak: 0, maxYear: 2026 })).toBeNull();
  });

  test("havuz çok küçük ya da bozuksa null; kullanılamaz öğeler atlanır", () => {
    expect(pickPair({ pool: [], maxYear: 2026 })).toBeNull();
    expect(pickPair({ pool: [item(1, 2000)], maxYear: 2026 })).toBeNull();
    expect(pickPair({ pool: null })).toBeNull();
    expect(pickPair({})).toBeNull();
    const pool = [item(1, 2000), item(2, 1970, { posterPath: null }), item(3, "?")];
    expect(pickPair({ pool, maxYear: 2026 })).toBeNull(); // kullanılabilir yalnız biri
  });

  test("yakın zamanda sorulanlar tercih dışı; yetmezse yine de kullanılır", () => {
    const pool = wide();
    const recent = new Set(pool.slice(0, 70).map(keyOfItem)); // yalnız son 6 yapım taze
    for (let i = 0; i < 100; i += 1) {
      const pair = pickPair({ pool, streak: 0, recent, rng: seeded(i + 900), maxYear: 2026 });
      const [ka, kb] = pairKeys(pair);
      // Taze kümede 6 öğe var ama 20 yıllık fark yok → gevşer; yine de ikisi de taze olmalı.
      expect(recent.has(ka) && recent.has(kb)).toBe(false);
    }
    const allRecent = new Set(pool.map(keyOfItem));
    expect(pickPair({ pool, streak: 0, recent: allRecent, rng: seeded(3), maxYear: 2026 })).not.toBeNull();
  });

  test("aynı tohum aynı çifti verir (tekrar edilebilirlik)", () => {
    const pool = wide();
    const a = pickPair({ pool, streak: 4, rng: seeded(42), maxYear: 2026 });
    const b = pickPair({ pool, streak: 4, rng: seeded(42), maxYear: 2026 });
    expect(keyOfItem(a.a)).toBe(keyOfItem(b.a));
    expect(a.olderKey).toBe(b.olderKey);
  });

  test("gerçekçi karışık havuzda (çoğu yeni, az klasik) 400 çift sorunsuz çıkar", () => {
    const pool = [
      ...Array.from({ length: 200 }, (_, i) => item(i + 1, 2010 + (i % 16))),
      ...Array.from({ length: 40 }, (_, i) => item(1000 + i, 1940 + i * 2)),
    ];
    let recent = new Set();
    for (let i = 0; i < 400; i += 1) {
      const streak = i % 25;
      const pair = pickPair({ pool, streak, recent, rng: seeded(i + 11), maxYear: 2026 });
      expect(pair).not.toBeNull();
      recent = pushRecent(recent, pair);
    }
  });
});

describe("cevap", () => {
  test("doğru / yanlış ve yıllar", () => {
    const pair = pickPair({ pool: wide(), streak: 0, rng: seeded(5), maxYear: 2026 });
    const [ka, kb] = pairKeys(pair);
    const rightKey = pair.olderKey;
    const wrongKey = rightKey === ka ? kb : ka;
    expect(judgeAnswer(pair, rightKey).correct).toBe(true);
    expect(judgeAnswer(pair, wrongKey).correct).toBe(false);
    expect(judgeAnswer(pair, wrongKey).years).toEqual({ a: Number(pair.a.year), b: Number(pair.b.year) });
    expect(judgeAnswer(pair, "yok").correct).toBe(false);
  });

  test("pushRecent pencereyi aşmaz, en eskiyi atar", () => {
    let recent = new Set();
    const pool = wide();
    for (let i = 0; i < 38; i += 1) recent = pushRecent(recent, { a: pool[i * 2], b: pool[i * 2 + 1] }); // 76 yapım
    expect(recent.size).toBe(OLDER_RECENT_WINDOW);
    expect(recent.has(keyOfItem(pool[0]))).toBe(false); // en eski atıldı
    expect(recent.has(keyOfItem(pool[35]))).toBe(false); // 76 − 40 = ilk 36 atıldı
    expect(recent.has(keyOfItem(pool[36]))).toBe(true);
    expect(recent.has(keyOfItem(pool[75]))).toBe(true);
  });
});

describe("kayıt", () => {
  test("bozuk kayıt güvenli; sınırlar kırpılır; doğru ≤ cevaplanan", () => {
    expect(normalizeOlderStats(null)).toEqual({ best: 0, plays: 0, correct: 0, answered: 0 });
    expect(normalizeOlderStats([])).toEqual({ best: 0, plays: 0, correct: 0, answered: 0 });
    expect(normalizeOlderStats({ best: -4, plays: "x", correct: 50, answered: 10 })).toEqual({ best: 0, plays: 0, correct: 10, answered: 10 });
    expect(normalizeOlderStats({ best: 9e9 }).best).toBe(100000);
  });

  test("koşu kaydı: rekor yalnız yükselir, ilk koşuda 0 puan rekor sayılmaz", () => {
    const first = recordOlderRun(null, { score: 0, answered: 3 });
    expect(first.newBest).toBe(false);
    expect(first.stats).toEqual({ best: 0, plays: 1, correct: 0, answered: 3 });

    const second = recordOlderRun(first.stats, { score: 7, answered: 10 });
    expect(second.newBest).toBe(true);
    expect(second.previousBest).toBe(0);
    expect(second.stats).toEqual({ best: 7, plays: 2, correct: 7, answered: 13 });

    const third = recordOlderRun(second.stats, { score: 7, answered: 10 });
    expect(third.newBest).toBe(false); // eşitlik rekor değil
    const fourth = recordOlderRun(third.stats, { score: 5, answered: 8 });
    expect(fourth.stats.best).toBe(7);
    expect(fourth.stats.plays).toBe(4);
  });

  test("doğruluk yüzdesi ve boş kayıtta null saklama", () => {
    expect(olderAccuracy({ correct: 13, answered: 20 })).toBe(65);
    expect(olderAccuracy(null)).toBe(0);
    expect(toStoredOlderStats(null)).toBeNull();
    expect(toStoredOlderStats({ best: 5, plays: 2, correct: 6, answered: 9 })).toEqual({ best: 5, plays: 2, correct: 6, answered: 9 });
  });
});
