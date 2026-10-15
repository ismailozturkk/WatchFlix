// __tests__/themeStudioCopy.test.js
//
// Tema stüdyosu metinleri: iki dil aynı anahtar kümesine sahip olmalı, hiçbir
// değer boş kalmamalı ve motorun ürettiği her kimlik (ruh hali, uyum, ton
// ailesi) için bir etiket bulunmalı — yoksa kullanıcı ham kimliği görür
// ("midnight", "analogousR").

const { STUDIO_COPY, fillCopy, getStudioCopy, harmonyLabel, hueLabel, moodLabel, suggestedThemeName } =
  require("../components/theme/themeStudioCopy");
const { HARMONIES, MOODS, hueFamily } = require("../utils/themeStudio");

describe("themeStudioCopy", () => {
  test("tr ve en aynı anahtar kümesine sahip", () => {
    expect(Object.keys(STUDIO_COPY.en).sort()).toEqual(Object.keys(STUDIO_COPY.tr).sort());
  });

  test("hiçbir değer boş değil", () => {
    for (const lang of ["tr", "en"]) {
      const bos = Object.entries(STUDIO_COPY[lang]).filter(([, v]) => typeof v !== "string" || !v.trim());
      expect(bos).toEqual([]);
    }
  });

  test("her ruh hali, uyum ve ton ailesi için etiket var (ham kimlik görünmez)", () => {
    for (const lang of [false, true]) {
      const copy = getStudioCopy(lang);
      for (const mood of MOODS) expect(moodLabel(copy, mood.id)).not.toBe(mood.id);
      for (const h of HARMONIES) expect(harmonyLabel(copy, h.id)).not.toBe(h.id);
      const aileler = new Set(["gray"]);
      for (let h = 0; h < 360; h += 5) aileler.add(hueFamily(h));
      for (const f of aileler) expect(hueLabel(copy, f)).not.toBe(f);
    }
  });

  test("fillCopy yer tutucuyu doldurur, bilinmeyeni olduğu gibi bırakır", () => {
    expect(fillCopy("{n} sorun", { n: 3 })).toBe("3 sorun");
    expect(fillCopy("{n} {x}", { n: 1 })).toBe("1 {x}");
  });

  test("isim önerisi", () => {
    const tr = getStudioCopy(false);
    const en = getStudioCopy(true);
    expect(suggestedThemeName(tr, { moodId: "ocean", polarity: "dark", family: "orange" })).toBe("Okyanus · Turuncu");
    expect(suggestedThemeName(en, { polarity: "light", family: "blue" })).toBe("Light · Blue");
    expect(suggestedThemeName(tr, { polarity: "dark", family: "gray" })).toBe("Koyu · Gri");
  });
});
