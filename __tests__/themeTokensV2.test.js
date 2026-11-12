// __tests__/themeTokensV2.test.js
//
// Tema token şeması v2 (theme/themeTokens.js) + beş ton modeli (theme/toneModel.js).
// Bozulursa belirti çoğu zaman sessizdir: bir tonda yazı okunmaz, bir kademe
// "rgba(NaN…)" olup görünmez ya da özel tema yerleşik temadan farklı şekil taşır.

const {
  THEME_FAMILIES,
  alpha,
  buildCustomTheme,
  buildCustomThemeFromEntry,
  getThemeColors,
  themeToTokens,
  themes,
} = require("../theme/colors");
const {
  ACCENT_ALPHA_STEPS,
  ACCENT_SCALE_STEPS,
  TOKENS_VERSION,
  expandTheme,
  mix,
  toRgba,
} = require("../theme/themeTokens");
const {
  DEFAULT_TONE,
  LEGACY_TONES,
  TONES,
  TONE_LABEL_KEYS,
  TONE_POLARITY,
  completeToneMap,
  isTone,
  toneLabel,
  toneLabelMap,
} = require("../theme/toneModel");
const { generateToneSet } = require("../utils/themeStudio");
const { PRESET_IDS, getPresetBundle, entryFromBundle } = require("../utils/themePresets");
const { contrastRatio, hexToHsl, isLightSurface, luminance, toHex } = require("../utils/colorUtils");

const HEX = /^#[0-9A-F]{6}$/i;
const RGBA = /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (0|1|0?\.\d+)\)$/;
const isColor = (v) => typeof v === "string" && (HEX.test(v) || RGBA.test(v));

// Yerleşik temalar + her hazır destenin her tonu + bir eski tek tonlu özel tema.
function allThemes() {
  const list = Object.entries(themes).map(([key, theme]) => [key, theme]);
  for (const id of PRESET_IDS) {
    const entry = entryFromBundle(getPresetBundle(id), { id: `p-${id}`, name: id });
    for (const tone of TONES) list.push([`preset:${id}:${tone}`, buildCustomThemeFromEntry(entry, tone)]);
  }
  const legacy = { id: "legacy", name: "Eski", tokens: themeToTokens("purple") };
  for (const tone of TONES) list.push([`legacy:${tone}`, buildCustomThemeFromEntry(legacy, tone)]);
  return list;
}
const ALL = allThemes();

describe("ton modeli", () => {
  test("beş ton, sıra ve varsayılan", () => {
    expect(TONES).toEqual(["bright", "light", "mid", "dark", "amoled"]);
    expect(LEGACY_TONES.every(isTone)).toBe(true);
    expect(DEFAULT_TONE).toBe("dark");
    expect(isTone("bozuk")).toBe(false);
    expect(isTone(undefined)).toBe(false);
    for (const tone of TONES) {
      expect(TONE_LABEL_KEYS[tone]).toBeTruthy();
      expect(["light", "dark"]).toContain(TONE_POLARITY[tone]);
    }
  });

  test("etiketler: çeviri tablosu > yedek ad", () => {
    expect(toneLabel({ themeToneBright: "Very light" }, "bright")).toBe("Very light");
    expect(toneLabel({}, "amoled")).toBe("AMOLED");
    expect(Object.keys(toneLabelMap({}))).toEqual([...TONES]);
  });

  test("completeToneMap eksikleri doldurur, olanı değiştirmez", () => {
    const mid = { a: 1 };
    const out = completeToneMap({ mid, light: "bozuk" }, (tone) => ({ tone }));
    expect(Object.keys(out)).toEqual([...TONES]);
    expect(out.mid).toBe(mid);
    expect(out.light).toEqual({ tone: "light" });
  });

  test("ailelerin kutupluluğu ton modeline uyar", () => {
    for (const family of THEME_FAMILIES) {
      for (const tone of TONES) {
        const light = isLightSurface(themes[family.tones[tone]].primary);
        expect(light ? "light" : "dark").toBe(TONE_POLARITY[tone]);
      }
    }
  });

  test("motor her tonda doğru kutuplulukta zemin üretir; AMOLED saf siyah", () => {
    for (const base of ["#3B6FD4", "#16A34A", "#E11D48", "#64748B"]) {
      const set = generateToneSet(base, "#F97316");
      for (const tone of TONES) {
        expect(isLightSurface(set[tone].primary) ? "light" : "dark").toBe(TONE_POLARITY[tone]);
      }
      expect(set.amoled.primary).toBe("#000000");
      // AMOLED kartları ana rengin tonunu taşır (renkli zeminde gri değil).
      if (base !== "#64748B") expect(hexToHsl(set.amoled.secondary).s).toBeGreaterThan(10);
      expect(luminance(set.bright.primary)).toBeGreaterThan(luminance(set.light.primary));
    }
  });
});

describe("renk yardımcıları", () => {
  test("alpha kısa / uzun hex ve rgba'yı doğru çözer (eski '#fff' → siyah hatası)", () => {
    expect(alpha("#fff", 0.12)).toBe("rgba(255, 255, 255, 0.12)");
    expect(alpha("#FFFFFF", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    expect(alpha("#11223344", 0.5)).toBe("rgba(17, 34, 51, 0.5)");
    expect(alpha("rgba(74, 79, 88, 0.8)", 0.5)).toBe("rgba(74, 79, 88, 0.5)");
    expect(alpha("rgb(1,2,3)", 1)).toBe("rgba(1, 2, 3, 1)");
    expect(alpha(undefined, 0.3)).toBe("rgba(0, 0, 0, 0.3)");
    expect(alpha("bozuk", 0.3)).toBe("rgba(0, 0, 0, 0.3)");
    expect(toRgba("#000", 2)).toBe("rgba(0, 0, 0, 1)");
  });

  test("mix uçlarda kaynağı verir", () => {
    expect(mix("#000000", "#FFFFFF", 0)).toBe("#000000");
    expect(mix("#000000", "#FFFFFF", 1)).toBe("#FFFFFF");
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });
});

describe("v2 şeması: her tema, her ton", () => {
  test.each(ALL)("%s — şema tam ve tüm değerler geçerli renk", (name, t) => {
    expect(t.tokensVersion).toBe(TOKENS_VERSION);
    expect(t.scheme).toBe(t.isDark ? "dark" : "light");
    expect(t.isDark).toBe(!isLightSurface(t.primary));

    // Ham anahtarlar korunur ve türleri değişmez.
    for (const key of ["primary", "secondary", "between", "border", "tab", "accent", "bold", "shadow", "secondaryt", "ai"]) {
      expect(typeof t[key]).toBe("string");
    }
    for (const key of ["primary", "secondary", "between", "muted", "faint", "disabled", "placeholder", "inverse", "onAccent", "link"]) {
      expect(isColor(t.text[key])).toBe(true);
    }

    for (const key of ["sunken", "canvas", "subtle", "card", "raised", "overlay", "highest", "inverse"]) {
      expect(isColor(t.surface[key])).toBe(true);
    }
    expect(t.surface.canvas).toBe(toHex(t.primary));
    expect(t.surface.card).toBe(toHex(t.secondary));
    expect(t.surfaceScale).toHaveLength(7);
    expect(t.textScale).toHaveLength(6);
    t.surfaceScale.concat(t.textScale).forEach((c) => expect(isColor(c)).toBe(true));

    expect(Object.keys(t.accentScale).map(Number)).toEqual([...ACCENT_SCALE_STEPS]);
    expect(t.accentScale[500]).toBe(toHex(t.accent));
    Object.values(t.accentScale).forEach((c) => expect(HEX.test(c)).toBe(true));
    expect(Object.keys(t.accentAlpha).map(Number)).toEqual([...ACCENT_ALPHA_STEPS]);
    Object.values(t.accentAlpha).forEach((c) => expect(RGBA.test(c)).toBe(true));

    for (const key of ["accentSoft", "accentSubtle", "accentText", "accentHover", "accentPressed", "onAccent"]) {
      expect(isColor(t[key])).toBe(true);
    }
    for (const key of ["hairline", "subtle", "strong", "focus", "accent", "inverse"]) expect(isColor(t.borders[key])).toBe(true);
    expect(t.borders.default).toBe(t.border);
    for (const key of ["hover", "pressed", "focus", "selected", "dragged", "disabledContainer"]) expect(isColor(t.state[key])).toBe(true);
    expect(t.state.disabledOpacity).toBeGreaterThan(0);
    for (const key of ["faint", "soft", "medium", "strong", "heavy"]) expect(isColor(t.scrim[key])).toBe(true);
    for (const kind of ["success", "warning", "danger", "info"]) {
      for (const key of ["base", "fg", "soft", "softSolid", "border", "on"]) expect(isColor(t.status[kind][key])).toBe(true);
    }
    expect(t.elevation).toHaveLength(6);
    t.elevation.forEach((lvl, i) => {
      expect(isColor(lvl.shadowColor)).toBe(true);
      expect(lvl.elevation).toBeGreaterThanOrEqual(i === 0 ? 0 : 1);
      if (i > 0) expect(lvl.shadowRadius).toBeGreaterThan(t.elevation[i - 1].shadowRadius);
    });
    expect(t.chart.length).toBeGreaterThanOrEqual(6);
    t.chart.forEach((c) => expect(HEX.test(c)).toBe(true));
    for (const key of ["accent", "surface", "hero"]) expect(t.gradients[key]).toHaveLength(2);
  });

  test.each(ALL)("%s — okunabilirlik eşikleri", (name, t) => {
    const canvas = t.surface.canvas;
    const card = t.surface.card;
    // Vurgu zemininde yazı: beyaz ya da koyu mürekkep, en az 3:1.
    expect(contrastRatio(t.onAccent, t.accent)).toBeGreaterThanOrEqual(3);
    expect(t.text.onAccent).toBe(t.onAccent);
    // Metin olarak vurgu (bağlantı vb.) zeminde ve kartta AA'ya yakın.
    expect(contrastRatio(t.accentText, canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.accentText, card)).toBeGreaterThanOrEqual(4.2);
    // Durum renklerinin metin hali zeminde okunur.
    for (const kind of ["success", "warning", "danger", "info"]) {
      expect(contrastRatio(t.status[kind].fg, canvas)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.status[kind].on, t.status[kind].base)).toBeGreaterThanOrEqual(2.2);
    }
    // Metin kademeleri güçlüden soluğa sıralı (zemine karşı kontrast azalır).
    const ratios = t.textScale.map((c) => contrastRatio(c, canvas));
    for (let i = 1; i < ratios.length; i += 1) expect(ratios[i]).toBeLessThanOrEqual(ratios[i - 1] + 0.05);
    // Pasif metin bile zeminden ayrılır; ama ana metinle karışmaz.
    expect(ratios[5]).toBeGreaterThan(1.2);
  });

  test.each(ALL.filter(([, t]) => t.isDark))("%s — koyu temada yükseltilmiş yüzeyler açılır", (name, t) => {
    const s = t.surface;
    expect(luminance(s.sunken)).toBeLessThanOrEqual(luminance(s.canvas));
    expect(luminance(s.raised)).toBeGreaterThanOrEqual(luminance(s.card));
    expect(luminance(s.overlay)).toBeGreaterThanOrEqual(luminance(s.raised));
    expect(luminance(s.highest)).toBeGreaterThanOrEqual(luminance(s.overlay));
  });
});

describe("kimlik ve geriye uyumluluk", () => {
  test("yerleşik tema nesneleri sabit; getThemeColors aynı nesneyi verir", () => {
    for (const key of Object.keys(themes)) expect(getThemeColors(key)).toBe(themes[key]);
    expect(Object.isFrozen(themes)).toBe(true);
  });

  test("expandTheme idempotent ve önbellekli", () => {
    expect(expandTheme(themes.gray)).toBe(themes.gray);
    const raw = { primary: "#101010", secondary: "#202020", border: "#303030", text: { primary: "#FFFFFF" }, accent: "#3B82F6" };
    expect(expandTheme(raw)).toBe(expandTheme(raw));
    expect(expandTheme(null)).toBeNull();
  });

  test("eski değerler aynen duruyor (gri tema)", () => {
    expect(themes.gray.primary).toBe("#1D1F23");
    expect(themes.gray.text.primary).toBe("#F6F7F9");
    expect(themes.gray.border).toBe("rgba(74, 79, 88, 0.8)");
    expect(themes.gray.accent).toBe("#3B82F6");
  });

  test("özel tema yerleşik temayla aynı şekli taşır", () => {
    const custom = buildCustomTheme(themeToTokens("blue"));
    expect(Object.keys(custom).sort()).toEqual(Object.keys(themes.blue).sort());
    expect(Object.keys(custom.surface).sort()).toEqual(Object.keys(themes.blue.surface).sort());
    expect(Object.keys(custom.status).sort()).toEqual(Object.keys(themes.blue.status).sort());
  });
});
