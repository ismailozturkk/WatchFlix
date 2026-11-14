// __tests__/ratingDistribution.test.js
//
// Profil "Puan dağılımı" kartının saf çekirdeği (utils/ratingDistribution.js):
// 0-10 puanlar (10 yıldız, yarım puan) 20 kademeye doğru düşüyor mu, geçersizler
// atılıyor mu, ortalama / en sık kademe / etiket biçimi doğru mu.

const {
  RATING_STEPS,
  ratingStep,
  buildRatingDistribution,
  formatStarAverage,
  formatStep,
  stepToStars,
} = require("../utils/ratingDistribution");

describe("ratingStep", () => {
  test("yarım puan adımları kademeye birebir düşer (0.5 → 1 … 10 → 20)", () => {
    for (let k = 1; k <= 20; k += 1) expect(ratingStep(k / 2)).toBe(k);
    expect(ratingStep(8.5)).toBe(17);
  });
  test("eski tam sayı kayıtlar çift kademelere düşer", () => {
    expect(ratingStep(7)).toBe(14);
    expect(ratingStep(10)).toBe(20);
  });
  test("kesirli içe aktarma değerleri en yakın yarım puana yuvarlanır, sınırlar kırpılır", () => {
    expect(ratingStep(7.4)).toBe(15);
    expect(ratingStep(7.2)).toBe(14);
    expect(ratingStep(0.1)).toBe(1);
    expect(ratingStep(12)).toBe(20);
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
      expect(RATING_STEPS).toBe(20);
      expect(d.total).toBe(0);
      expect(d.max).toBe(0);
      expect(d.average).toBeNull();
      expect(d.modeStep).toBeNull();
    }
  });

  test("kademeleri sayar; kaldırılmış (null) puanları atlar", () => {
    const d = buildRatingDistribution({
      movie_1: 8.5,
      movie_2: 8.5,
      tv_3: 10,
      movie_4: 0.5,
      movie_6: 8,
      movie_5: null, // removeMyRating activityIndex'e null yazar
    });
    expect(d.total).toBe(5);
    expect(d.counts[16]).toBe(2); // 8.5
    expect(d.counts[15]).toBe(1); // 8
    expect(d.counts[19]).toBe(1); // 10
    expect(d.counts[0]).toBe(1); // 0.5
    expect(d.max).toBe(2);
    expect(d.modeStep).toBe(17);
    expect(d.average).toBeCloseTo((8.5 + 8.5 + 10 + 0.5 + 8) / 5);
  });

  test("ortalama ham puanlardan, 10'a kırpılarak", () => {
    expect(buildRatingDistribution({ a: 7.4, b: 12 }).average).toBeCloseTo((7.4 + 10) / 2);
  });

  test("eşit en sık kademelerde yüksek olan seçilir", () => {
    expect(buildRatingDistribution({ a: 4, b: 9.5 }).modeStep).toBe(19);
  });
});

describe("biçim", () => {
  test("kademe → puan / yıldız", () => {
    expect(stepToStars(17)).toBe(8.5);
    expect(stepToStars(20)).toBe(10);
  });
  test("kademe etiketi dile göre, tam sayıda ondalık yok", () => {
    expect(formatStep(17, "tr")).toBe("8,5");
    expect(formatStep(17, "en")).toBe("8.5");
    expect(formatStep(16, "de")).toBe("8");
    expect(formatStep(1, "tr")).toBe("0,5");
  });
  test("ortalama 10 yıldız ölçeğinde tek ondalık; ondalık ayracı dile göre", () => {
    expect(formatStarAverage(7.24, "tr")).toBe("7,2");
    expect(formatStarAverage(7.25, "en")).toBe("7.3");
    expect(formatStarAverage(10, "de")).toBe("10,0");
    expect(formatStarAverage(null, "tr")).toBe("–");
  });
});

describe("5 yıldız ölçeği", () => {
  const { ratingStepsOf } = require("../utils/ratingDistribution");
  test("10 kademe; yarım yıldız = 1 puan, 8.5 → 9. kademe, etiket 10 üzerinden tam puan", () => {
    expect(ratingStepsOf("five")).toBe(10);
    expect(ratingStepsOf("ten")).toBe(20);
    expect(ratingStep(8.5, "five")).toBe(9);
    expect(ratingStep(7, "five")).toBe(7);
    const d = buildRatingDistribution({ a: 8.5, b: 9, c: 2 }, "five");
    expect(d.counts).toHaveLength(10);
    expect(d.counts[8]).toBe(2);
    expect(d.modeStep).toBe(9);
    expect(formatStep(9, "tr", "five")).toBe("9");
    expect(formatStep(10, "tr", "five")).toBe("10");
    expect(formatStep(9, "tr", "ten")).toBe("4,5");
  });
  test("ortalama iki modda da 10 üzerinden", () => {
    expect(formatStarAverage(7.2, "tr")).toBe("7,2");
  });
});
