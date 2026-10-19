const { FAVORITES_COPY, getFavoritesCopy } = require("../utils/favoritesCopy");
const { FAVORITE_KINDS, MAX_FAVORITES } = require("../utils/fourFavorites");

// Anahtar yapısı (nesne / fonksiyon / metin) iki dilde de aynı olmalı: biri eksik
// kalırsa o dilde bir etiket boş ya da `undefined` görünür.
const shape = (value) => {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  }
  return typeof value;
};

describe("dört favori metinleri", () => {
  it("tr, en ve es aynı yapıda", () => {
    expect(shape(FAVORITES_COPY.en)).toEqual(shape(FAVORITES_COPY.tr));
    expect(shape(FAVORITES_COPY.es)).toEqual(shape(FAVORITES_COPY.tr));
  });

  it("bilinmeyen dil İngilizceye düşer (Türkçeye DEĞİL)", () => {
    expect(getFavoritesCopy("de")).toBe(FAVORITES_COPY.en);
    expect(getFavoritesCopy(undefined)).toBe(FAVORITES_COPY.en);
    expect(getFavoritesCopy("tr")).toBe(FAVORITES_COPY.tr);
    expect(getFavoritesCopy("en")).toBe(FAVORITES_COPY.en);
    expect(getFavoritesCopy("es")).toBe(FAVORITES_COPY.es);
  });

  it("her kategori için tüm etiketler dolu", () => {
    for (const lang of ["tr", "en", "es", "pt"]) {
      for (const kind of FAVORITE_KINDS) {
        const k = FAVORITES_COPY[lang].kinds[kind];
        for (const key of ["label", "add", "pickTitle", "search", "icon"]) {
          expect(typeof k[key]).toBe("string");
          expect(k[key].trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("işlev metinleri başlığı içeriyor ve sayaç doğru biçimde", () => {
    for (const lang of ["tr", "en", "es", "pt"]) {
      const copy = FAVORITES_COPY[lang];
      expect(copy.counter(2, MAX_FAVORITES)).toBe("2/4");
      expect(copy.picker.add("Heat")).toContain("Heat");
      expect(copy.picker.removeLabel("Heat")).toContain("Heat");
      expect(copy.rail.subtitle("Heat, Dune")).toContain("Heat, Dune");
      expect(copy.rail.more(3)).toBe("+3");
    }
  });
});
