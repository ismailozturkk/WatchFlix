// __tests__/ratingDistribution.test.js
//
// Profil "Puan dağılımı" kartının saf çekirdeği (utils/ratingDistribution.js):
// 0-10 puanlar 10 kademeye (½★ … ★★★★★) doğru düşüyor mu, geçersizler atılıyor mu,
// ortalama / en sık kademe / yıldız biçimi doğru mu.

const {
  RATING_STEPS,
  ratingStep,
  buildRatingDistribution,
  formatStarAverage,
  stepToStars,
} = require("../utils/ratingDistribution");

describe("ratingStep", () => {
  test("yarım yıldız adımları kademeye birebir düşer", () => {
    for (let k = 1; k <= 10; k += 1) expect(ratingStep(k)).toBe(k);
  });
  test("kesirli içe aktarma değerleri en yakın kademeye yuvarlanır, sınırlar kırpılır", () => {
    expect(ratingStep(7.4)).toBe(7);
    expect(ratingStep(7.6)).toBe(8);
    expect(ratingStep(0.3)).toBe(1);
    expect(ratingStep(12)).toBe(10);
  });
  test("0, negatif, boş ve sayı olmayan sayılmaz", () => {
    for (const v of [0, -2, null, undefined, NaN, "abc"]) expect(ratingStep(v)).toBeNull();
  });
});

describe("buildRatingDistribution", () => {
  test("boş / eksik harita boş dağılım verir", () => {
    for (const input of [null, undefined, {}]) {
      const d = buildRatingDistribution(input);
      expect(d.counts).toHaveLength(RATING_STEPS);
      expect(d.total).toBe(0);
      expect(d.max).toBe(0);
      expect(d.average).toBeNull();
      expect(d.modeStep).toBeNull();
    }
  });

  test("kademeleri sayar; kaldırılmış (null) puanları atlar", () => {
    const d = buildRatingDistribution({
      movie_1: 8,
      movie_2: 8,
      tv_3: 10,
      movie_4: 1,
      movie_5: null, // removeMyRating activityIndex'e null yazar
    });
    expect(d.total).toBe(4);
    expect(d.counts).toEqual([1, 0, 0, 0, 0, 0, 0, 2, 0, 1]);
    expect(d.max).toBe(2);
    expect(d.modeStep).toBe(8);
    expect(d.average).toBeCloseTo((8 + 8 + 10 + 1) / 4);
  });

  test("eşit en sık kademelerde yüksek olan seçilir", () => {
    expect(buildRatingDistribution({ a: 4, b: 9 }).modeStep).toBe(9);
  });
});

describe("biçim", () => {
  test("kademe → yıldız", () => {
    expect(stepToStars(7)).toBe(3.5);
    expect(stepToStars(10)).toBe(5);
  });
  test("ortalama 5 yıldız ölçeğinde tek ondalık; ondalık ayracı dile göre", () => {
    expect(formatStarAverage(7.2, "tr")).toBe("3,6");
    expect(formatStarAverage(7.2, "en")).toBe("3.6");
    expect(formatStarAverage(10, "de")).toBe("5,0");
    expect(formatStarAverage(null, "tr")).toBe("–");
  });
});
