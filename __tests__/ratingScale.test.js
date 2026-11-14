// __tests__/ratingScale.test.js — 10 yıldız, yarım puan ölçeği (utils/ratingScale.js).
const {
  RATING_MAX,
  RATING_STEP,
  RATING_STARS,
  normalizeUserRating,
  formatUserRating,
  decimalSeparatorOf,
} = require("../utils/ratingScale");

describe("ölçek", () => {
  test("10 yıldız, 0.5 adım, tavan 10", () => {
    expect(RATING_STARS).toBe(10);
    expect(RATING_STEP).toBe(0.5);
    expect(RATING_MAX).toBe(10);
  });
});

describe("normalizeUserRating", () => {
  test("geçerli yarım puanlar aynen kalır", () => {
    for (let k = 1; k <= 20; k += 1) expect(normalizeUserRating(k / 2)).toBe(k / 2);
  });
  test("ara değerler en yakın 0.5'e yuvarlanır", () => {
    expect(normalizeUserRating(8.4)).toBe(8.5);
    expect(normalizeUserRating(8.2)).toBe(8);
    expect(normalizeUserRating(8.75)).toBe(9);
    expect(normalizeUserRating("7.5")).toBe(7.5);
  });
  test("sınırlar: en az 0.5, en çok 10; geçersiz → 0", () => {
    expect(normalizeUserRating(0.1)).toBe(0.5);
    expect(normalizeUserRating(14)).toBe(10);
    for (const v of [0, -1, null, undefined, NaN, "x"]) expect(normalizeUserRating(v)).toBe(0);
  });
});

describe("formatUserRating", () => {
  test("ondalık ayraç dile göre; tam sayıda ',0' yok", () => {
    expect(formatUserRating(8.5, "tr")).toBe("8,5");
    expect(formatUserRating(8.5, "en")).toBe("8.5");
    expect(formatUserRating(8.5, "ja")).toBe("8.5");
    expect(formatUserRating(8.5, "pt-BR")).toBe("8,5");
    expect(formatUserRating(8, "tr")).toBe("8");
    expect(formatUserRating(10, "en")).toBe("10");
    expect(formatUserRating(0, "tr")).toBeNull();
  });
  test("decimalSeparatorOf", () => {
    expect(decimalSeparatorOf("en-US")).toBe(".");
    expect(decimalSeparatorOf("fr")).toBe(",");
  });
});

describe("5 yıldız ölçeği (Ayarlar > Kişiselleştirme)", () => {
  const { RATING_SCALES, DEFAULT_RATING_SCALE, ratingScaleSpec, ratingInScale, formatRatingInScale, isRatingScale } =
    require("../utils/ratingScale");
  const { getRatingScaleCopy, RATING_SCALE_COPY } = require("../utils/ratingScaleCopy");

  test("seçenekler ve varsayılan", () => {
    expect(RATING_SCALES).toEqual(["ten", "five"]);
    expect(DEFAULT_RATING_SCALE).toBe("ten");
    expect(isRatingScale("five")).toBe(true);
    expect(isRatingScale("3")).toBe(false);
    expect(ratingScaleSpec("five")).toEqual({ stars: 5, step: 1, max: 10 });
    expect(ratingScaleSpec("bozuk")).toEqual(ratingScaleSpec("ten"));
  });
  test("5'li modda saklama adımı 1 puan (yarım yıldız)", () => {
    expect(normalizeUserRating(8.5, "five")).toBe(9);
    expect(normalizeUserRating(8.4, "five")).toBe(8);
    expect(normalizeUserRating(0.3, "five")).toBe(1);
  });
  test("gösterim iki modda da 10 üzerinden; 5'li mod küsuratsız", () => {
    expect(ratingInScale(8.5, "ten")).toBe(8.5);
    expect(ratingInScale(8.5, "five")).toBe(9);
    expect(ratingInScale(7, "five")).toBe(7);
    expect(formatRatingInScale(8.5, "tr", "five")).toBe("9");
    expect(formatRatingInScale(8.4, "en", "five")).toBe("8");
    expect(formatRatingInScale(8.5, "tr", "ten")).toBe("8,5");
    expect(formatRatingInScale(0, "tr", "five")).toBeNull();
  });
  test("ayar metni 8 dilde aynı alanlara sahip", () => {
    const keys = Object.keys(RATING_SCALE_COPY.tr).sort();
    for (const lang of ["tr", "en", "es", "pt", "de", "it", "fr", "ja"]) {
      expect(Object.keys(RATING_SCALE_COPY[lang]).sort()).toEqual(keys);
    }
    expect(getRatingScaleCopy("pt-BR").title).toBe("Sistema de notas");
    expect(getRatingScaleCopy("xx").title).toBe("Rating system");
  });
});
