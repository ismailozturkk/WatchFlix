// __tests__/themeFamilies.test.js
//
// Tema aileleri (Varsayılan / Mavi / Yeşil × açık · orta · koyu), özel temaların
// üç tonu, hazır temalar ve bunların kayıt/yedek yolu. Bozulursa belirti sessizdir:
// ekranda bir ton boş/aynı görünür ya da eski seçimli kullanıcı yanlış temaya düşer.

const {
  FAMILY_THEME_KEYS,
  LEGACY_PRESET_THEME_KEYS,
  THEME_FAMILIES,
  THEME_NAMES,
  buildCustomTheme,
  buildCustomThemeFromEntry,
  customSelectionKey,
  customToneTokens,
  familyOfTheme,
  parseCustomSelection,
  themeToTokens,
  themes,
} = require("../theme/colors");
const { TONES, analyzeContrast, generateToneSet } = require("../utils/themeStudio");
const {
  PRESET_IDS,
  THEME_PRESETS,
  bundleFromEntry,
  entryFromBundle,
  getPresetBundle,
  initialBundle,
  isBundle,
} = require("../utils/themePresets");
const { isLightSurface, luminance } = require("../utils/colorUtils");
const { sanitizeCustomThemes, valueProblem } = require("../utils/settingsBackup");
const { getStudioCopy, presetLabel, toneLabel } = require("../components/theme/themeStudioCopy");
const tr = require("../translations/tr.json");
const en = require("../translations/en.json");
const es = require("../translations/es.json");

const TOKEN_KEYS = [
  "primary", "secondary", "between", "tab", "border",
  "accent", "bold",
  "textPrimary", "textSecondary", "textBetween", "textMuted",
];

describe("tema aileleri", () => {
  test("üç aile, her biri açık · orta · koyu ve hepsi gerçek tema", () => {
    expect(THEME_FAMILIES.map((f) => f.id)).toEqual(["default", "blue", "green"]);
    for (const family of THEME_FAMILIES) {
      for (const tone of TONES) expect(themes[family.tones[tone]]).toBeTruthy();
    }
    expect(FAMILY_THEME_KEYS).toHaveLength(9);
    expect(new Set(FAMILY_THEME_KEYS).size).toBe(9);
  });

  test("her ailede zemin açıklığı koyu < orta < açık, açık ton gerçekten açık", () => {
    for (const family of THEME_FAMILIES) {
      const lum = (tone) => luminance(themeToTokens(family.tones[tone]).primary);
      expect(lum("dark")).toBeLessThan(lum("mid"));
      expect(lum("mid")).toBeLessThan(lum("light"));
      expect(isLightSurface(themeToTokens(family.tones.light).primary)).toBe(true);
      expect(isLightSurface(themeToTokens(family.tones.dark).primary)).toBe(false);
    }
  });

  test("eski kayıtlı seçimler (gray, dark, light, sky, blue, green) değişmeden ailelerde", () => {
    expect(familyOfTheme("gray")).toMatchObject({ tone: "mid", family: { id: "default" } });
    expect(familyOfTheme("dark")).toMatchObject({ tone: "dark", family: { id: "default" } });
    expect(familyOfTheme("light")).toMatchObject({ tone: "light", family: { id: "default" } });
    expect(familyOfTheme("sky")).toMatchObject({ tone: "light", family: { id: "blue" } });
    expect(familyOfTheme("blue")).toMatchObject({ tone: "mid", family: { id: "blue" } });
    expect(familyOfTheme("green")).toMatchObject({ tone: "light", family: { id: "green" } });
    expect(familyOfTheme("blueDeep")).toMatchObject({ tone: "dark", family: { id: "blue" } });
    expect(familyOfTheme("nope")).toBeNull();
  });

  test("Gece Moru / Kızıl Sinema ailelerde YOK ama temalarda duruyor (seçili kalanlar bozulmasın)", () => {
    expect(LEGACY_PRESET_THEME_KEYS).toEqual(["purple", "amber"]);
    for (const key of LEGACY_PRESET_THEME_KEYS) {
      expect(themes[key]).toBeTruthy();
      expect(THEME_NAMES).toContain(key);
      expect(FAMILY_THEME_KEYS).not.toContain(key);
      expect(familyOfTheme(key)).toBeNull();
    }
  });

  test("yeni üç tema tam şekilde ve okunur", () => {
    for (const key of ["blueDeep", "greenMid", "greenDeep"]) {
      const t = themes[key];
      expect(Object.keys(t.text).sort()).toEqual(["between", "muted", "primary", "secondary"]);
      expect(t.colors.red).toBeTruthy();
      expect(t.notesColor.blue).toBeTruthy();
      expect(analyzeContrast(themeToTokens(key)).passes).toBe(true);
    }
  });

  test("bilinmeyen anahtar gri temaya düşer", () => {
    const { getThemeColors } = require("../theme/colors");
    expect(getThemeColors("nope")).toBe(themes.gray);
  });

  test("ailelerin ve yeni temaların etiketleri üç dilde var", () => {
    const keys = [
      "themeFamilyDefault", "themeFamilyBlue", "themeFamilyGreen",
      "themeToneLight", "themeToneMid", "themeToneDark",
      "blueDeepTheme", "greenMidTheme", "greenDeepTheme",
    ];
    for (const table of [tr, en, es]) {
      for (const key of keys) expect(typeof table[key] === "string" && table[key].trim()).toBeTruthy();
    }
    for (const family of THEME_FAMILIES) expect(tr[family.labelKey]).toBeTruthy();
  });
});

describe("özel tema seçimi ve tonlar", () => {
  test("seçim anahtarı: orta ton eski biçimle, diğerleri :ton ekiyle", () => {
    expect(customSelectionKey("abc")).toBe("custom:abc");
    expect(customSelectionKey("abc", "mid")).toBe("custom:abc");
    expect(customSelectionKey("abc", "light")).toBe("custom:abc:light");
    expect(customSelectionKey("abc", "dark")).toBe("custom:abc:dark");
    expect(customSelectionKey("abc", "bozuk")).toBe("custom:abc");
  });

  test("parseCustomSelection eski ve yeni biçimleri okur", () => {
    expect(parseCustomSelection("custom:abc")).toEqual({ id: "abc", tone: "mid" });
    expect(parseCustomSelection("custom:abc:light")).toEqual({ id: "abc", tone: "light" });
    expect(parseCustomSelection("custom:abc:dark")).toEqual({ id: "abc", tone: "dark" });
    expect(parseCustomSelection("custom:abc:bozuk")).toEqual({ id: "abc", tone: "mid" });
    expect(parseCustomSelection("custom")).toEqual({ id: null, tone: "mid" });
    expect(parseCustomSelection("blue")).toBeNull();
    expect(parseCustomSelection(undefined)).toBeNull();
  });

  const eski = { id: "x1", name: "Eski", tokens: themeToTokens("purple") };

  test("eski tek tonlu tema: orta ton AYNEN, açık/koyu türetilir ve ayrışır", () => {
    expect(customToneTokens(eski, "mid")).toBe(eski.tokens);
    const light = customToneTokens(eski, "light");
    const dark = customToneTokens(eski, "dark");
    expect(isLightSurface(light.primary)).toBe(true);
    expect(isLightSurface(dark.primary)).toBe(false);
    expect(luminance(dark.primary)).toBeLessThan(luminance(eski.tokens.primary));
    // önbellek: aynı girdi için aynı nesne
    expect(customToneTokens(eski, "light")).toBe(light);
  });

  test("üç ton kayıtlıysa olduğu gibi kullanılır", () => {
    const tones = generateToneSet("#3B6FD4", "#F97316");
    const yeni = { id: "x2", name: "Yeni", tokens: tones.mid, tones };
    for (const tone of TONES) expect(customToneTokens(yeni, tone)).toBe(tones[tone]);
  });

  test("tam tema nesnesi yerleşik temalarla aynı şekle sahip", () => {
    const built = buildCustomThemeFromEntry(eski, "dark");
    expect(Object.keys(built).sort()).toEqual(Object.keys(themes.gray).sort());
    expect(built.primary).toBe(customToneTokens(eski, "dark").primary);
    expect(buildCustomThemeFromEntry(eski).primary).toBe(buildCustomTheme(eski.tokens).primary);
  });

  test("bozuk girdide patlamaz", () => {
    expect(customToneTokens(undefined, "dark")).toEqual({});
    expect(customToneTokens({ id: "q", tokens: {} }, "bozuk")).toEqual({});
  });
});

describe("hazır temalar (deste)", () => {
  test("kimlikler benzersiz ve Gece Moru / Kızıl Sinema içeride", () => {
    expect(new Set(PRESET_IDS).size).toBe(PRESET_IDS.length);
    expect(PRESET_IDS).toEqual(expect.arrayContaining(["default", "blue", "green", "purple", "crimson"]));
    expect(PRESET_IDS.length).toBeGreaterThanOrEqual(8);
  });

  test("her hazır tema tam, üç tonlu bir deste", () => {
    for (const preset of THEME_PRESETS) {
      const bundle = getPresetBundle(preset.id);
      expect(isBundle(bundle)).toBe(true);
      expect(bundle.base).toMatch(/^#[0-9A-F]{6}$/i);
      expect(bundle.accent).toMatch(/^#[0-9A-F]{6}$/i);
      for (const tone of TONES) expect(Object.keys(bundle.tones[tone]).sort()).toEqual([...TOKEN_KEYS].sort());
      expect(isLightSurface(bundle.tones.light.primary)).toBe(true);
      expect(isLightSurface(bundle.tones.dark.primary)).toBe(false);
    }
    expect(getPresetBundle("yok")).toBeNull();
  });

  test("aile hazır temaları yerleşik temaların AYNISI", () => {
    for (const family of THEME_FAMILIES) {
      const bundle = getPresetBundle(family.id);
      for (const tone of TONES) expect(bundle.tones[tone]).toEqual(themeToTokens(family.tones[tone]));
    }
  });

  test("Gece Moru / Kızıl Sinema: orta ton eski temanın aynısı, açık/koyu okunur", () => {
    const pairs = [["purple", "purple"], ["crimson", "amber"]];
    for (const [id, key] of pairs) {
      const bundle = getPresetBundle(id);
      expect(bundle.tones.mid).toEqual(themeToTokens(key));
      expect(analyzeContrast(bundle.tones.light).passes).toBe(true);
      expect(analyzeContrast(bundle.tones.dark).passes).toBe(true);
    }
  });

  test("motorla kurulan yeni setlerin her tonu okunur", () => {
    for (const id of ["ocean", "forest", "mocha", "sunset"]) {
      const bundle = getPresetBundle(id);
      for (const tone of TONES) expect(analyzeContrast(bundle.tones[tone]).passes).toBe(true);
    }
  });

  test("hazır temaların etiketi her dilde var (ham kimlik görünmez)", () => {
    for (const lang of ["tr", "en", "es"]) {
      const copy = getStudioCopy(lang);
      for (const id of PRESET_IDS) expect(presetLabel(copy, id)).not.toBe(id);
      for (const tone of TONES) expect(toneLabel(copy, tone)).not.toBe(tone);
    }
  });
});

describe("deste ↔ kayıt", () => {
  test("entryFromBundle: tokens = orta ton, tones + base taşınır; bundleFromEntry geri çevirir", () => {
    const bundle = getPresetBundle("ocean");
    const entry = entryFromBundle(bundle, { id: "e1", name: "Okyanus" });
    expect(entry.tokens).toBe(bundle.tones.mid);
    expect(entry.tones).toBe(bundle.tones);
    expect(entry.base).toBe(bundle.base);
    const back = bundleFromEntry(entry);
    expect(back.tones).toEqual(bundle.tones);
    expect(back.base).toBe(bundle.base);
  });

  test("eski tek tonlu kayıt: orta ton değişmez, açık/koyu türetilir", () => {
    const eski = { id: "e2", name: "E", tokens: themeToTokens("blue") };
    const bundle = bundleFromEntry(eski);
    expect(bundle.tones.mid).toBe(eski.tokens);
    expect(isBundle(bundle)).toBe(true);
    expect(isLightSurface(bundle.tones.light.primary)).toBe(true);
  });

  test("initialBundle: seçili temaya göre başlar", () => {
    expect(initialBundle({ selectedTheme: "blueDeep" })).toMatchObject({ tone: "dark" });
    expect(initialBundle({ selectedTheme: "sky" }).bundle.tones.light).toEqual(themeToTokens("sky"));
    expect(initialBundle({ selectedTheme: "purple" }).bundle.tones.mid).toEqual(themeToTokens("purple"));
    expect(initialBundle({ selectedTheme: "nope" })).toMatchObject({ tone: "mid" });
    const custom = { id: "c9", name: "C", tokens: themeToTokens("green") };
    const fromCustom = initialBundle({ selectedTheme: "custom:c9:light", customThemes: [custom] });
    expect(fromCustom.tone).toBe("light");
    expect(fromCustom.bundle.tones.mid).toBe(custom.tokens);
    const editing = initialBundle({ existing: custom, selectedTheme: "blue", customThemes: [custom] });
    expect(editing.tone).toBe("mid");
  });
});

describe("yedek: üç tonlu temalar", () => {
  const tones = generateToneSet("#3B6FD4", "#F97316");

  test("üç ton ve ana renk yedekte korunur", () => {
    const { themes: list } = sanitizeCustomThemes([
      { id: "a1", name: "Mavi", tokens: tones.mid, tones, base: "#3b6fd4" },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].tones).toEqual(tones);
    expect(list[0].base.toUpperCase()).toBe("#3B6FD4");
  });

  test("bozuk bir ton atılır, geri kalanı korunur; tonsuz eski kayıt olduğu gibi geçer", () => {
    const { themes: list } = sanitizeCustomThemes([
      { id: "a2", name: "X", tokens: tones.mid, tones: { light: tones.light, mid: "bozuk", dark: null } },
      { id: "a3", name: "Eski", tokens: tones.mid },
    ]);
    expect(Object.keys(list[0].tones)).toEqual(["light"]);
    expect(list[1].tones).toBeUndefined();
    expect(list[1].base).toBeUndefined();
  });

  test("seçili tema: yeni ton ekli anahtar ve yeni hazır temalar geçerli, bozuk ton değil", () => {
    const entry = { id: "theme", key: "theme" };
    const problem = (value) => valueProblem(entry, value);
    expect(problem("custom:abc")).toBeNull();
    expect(problem("custom:abc:light")).toBeNull();
    expect(problem("custom:abc:dark")).toBeNull();
    expect(problem("blueDeep")).toBeNull();
    expect(problem("greenMid")).toBeNull();
    expect(problem("greenDeep")).toBeNull();
    expect(problem("custom:abc:bozuk")).toBe("invalid");
    expect(problem("custom:abc:light:fazla")).toBe("invalid");
  });
});
