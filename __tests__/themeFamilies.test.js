// __tests__/themeFamilies.test.js
//
// Tema aileleri (Varsayılan / Mavi / Yeşil × çok açık · açık · orta · koyu · AMOLED),
// özel temaların beş tonu, ton merdiveni göçü (12 Kas), hazır temalar ve bunların
// kayıt/yedek yolu. Bozulursa belirti sessizdir: ekranda bir ton boş/aynı görünür,
// basamaklar arasında uçurum açılır ya da eski seçimli kullanıcı yanlış temaya düşer.

const {
  FAMILY_THEME_KEYS,
  LEGACY_PRESET_THEME_KEYS,
  THEME_FAMILIES,
  THEME_NAMES,
  TONE_LADDER,
  buildCustomTheme,
  buildCustomThemeFromEntry,
  customSelectionKey,
  customToneTokens,
  familyOfTheme,
  isLegacyCustomEntry,
  migrateCustomEntry,
  migrateCustomSelection,
  migrateThemeLadder,
  parseCustomSelection,
  themeToTokens,
  themes,
} = require("../theme/colors");
const { DEFAULT_TONE, TONES, analyzeContrast, generateToneSet } = require("../utils/themeStudio");
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
const { planImport, sanitizeCustomThemes, valueProblem } = require("../utils/settingsBackup");
const { getStudioCopy, presetLabel, toneLabel } = require("../components/theme/themeStudioCopy");
const tr = require("../translations/tr.json");
const en = require("../translations/en.json");
const es = require("../translations/es.json");

const TOKEN_KEYS = [
  "primary", "secondary", "between", "tab", "border",
  "accent", "bold",
  "textPrimary", "textSecondary", "textBetween", "textMuted",
];

// Algısal açıklık (CIE L*, 0 = siyah, 100 = beyaz).
const lstar = (hex) => {
  const y = luminance(hex);
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
};

describe("tema aileleri", () => {
  test("üç aile, her biri beş tonlu ve hepsi gerçek tema", () => {
    expect(TONES).toEqual(["bright", "light", "mid", "dark", "amoled"]);
    expect(DEFAULT_TONE).toBe("dark");
    expect(THEME_FAMILIES.map((f) => f.id)).toEqual(["default", "blue", "green"]);
    for (const family of THEME_FAMILIES) {
      expect(Object.keys(family.tones).sort()).toEqual([...TONES].sort());
      for (const tone of TONES) expect(themes[family.tones[tone]]).toBeTruthy();
    }
    expect(FAMILY_THEME_KEYS).toHaveLength(15);
    expect(new Set(FAMILY_THEME_KEYS).size).toBe(15);
  });

  test("her ailede zemin açıklığı AMOLED < koyu < orta < açık < çok açık; kutupluluk doğru", () => {
    for (const family of THEME_FAMILIES) {
      const lum = (tone) => luminance(themeToTokens(family.tones[tone]).primary);
      expect(lum("amoled")).toBeLessThan(lum("dark"));
      expect(lum("dark")).toBeLessThan(lum("mid"));
      expect(lum("mid")).toBeLessThan(lum("light"));
      expect(lum("light")).toBeLessThan(lum("bright"));
      expect(themeToTokens(family.tones.amoled).primary).toBe("#000000");
      for (const tone of ["bright", "light"]) expect(isLightSurface(themeToTokens(family.tones[tone]).primary)).toBe(true);
      for (const tone of ["mid", "dark", "amoled"]) expect(isLightSurface(themeToTokens(family.tones[tone]).primary)).toBe(false);
    }
  });

  test("ton merdiveni dengeli: basamaklar hedefte, iki ton üst üste binmiyor, uçurum yok", () => {
    // Hedef L*: 97 · 76 · 27 · 11 · 0 (±5). Yazı açık→koyu dönerken (açık→orta)
    // en büyük basamak oluşur; o da 55'i geçmemeli (eski merdivende ~70'ti).
    const TARGET = { bright: 97, light: 76, mid: 27, dark: 11, amoled: 0 };
    for (const family of THEME_FAMILIES) {
      const L = Object.fromEntries(TONES.map((t) => [t, lstar(themeToTokens(family.tones[t]).primary)]));
      for (const tone of TONES) expect(Math.abs(L[tone] - TARGET[tone])).toBeLessThanOrEqual(5);
      const order = ["amoled", "dark", "mid", "light", "bright"];
      for (let i = 1; i < order.length; i += 1) {
        const step = L[order[i]] - L[order[i - 1]];
        expect(step).toBeGreaterThanOrEqual(9); // iki komşu ton ayırt edilir
        expect(step).toBeLessThanOrEqual(55);
      }
    }
  });

  test("yayımlanmış seçimler aynı görünümle yeni basamaklarında", () => {
    // Görünümü DEĞİŞMEYEN eski anahtarlar: yalnız basamak adı değişti.
    expect(familyOfTheme("light")).toMatchObject({ tone: "bright", family: { id: "default" } });
    expect(familyOfTheme("gray")).toMatchObject({ tone: "dark", family: { id: "default" } });
    expect(familyOfTheme("dark")).toMatchObject({ tone: "amoled", family: { id: "default" } });
    expect(familyOfTheme("blue")).toMatchObject({ tone: "dark", family: { id: "blue" } });
    expect(familyOfTheme("blueDeep")).toMatchObject({ tone: "amoled", family: { id: "blue" } });
    expect(familyOfTheme("greenMid")).toMatchObject({ tone: "dark", family: { id: "green" } });
    expect(familyOfTheme("greenDeep")).toMatchObject({ tone: "amoled", family: { id: "green" } });
    // Açık tonlar bir basamak koyulaştı (merdiven dengesi için), yeri aynı.
    expect(familyOfTheme("sky")).toMatchObject({ tone: "light", family: { id: "blue" } });
    expect(familyOfTheme("green")).toMatchObject({ tone: "light", family: { id: "green" } });
    // Yeni ara basamaklar.
    expect(familyOfTheme("silver")).toMatchObject({ tone: "light", family: { id: "default" } });
    expect(familyOfTheme("dusk")).toMatchObject({ tone: "mid", family: { id: "default" } });
    expect(familyOfTheme("blueDusk")).toMatchObject({ tone: "mid", family: { id: "blue" } });
    expect(familyOfTheme("greenDusk")).toMatchObject({ tone: "mid", family: { id: "green" } });
    expect(familyOfTheme("nope")).toBeNull();
    // Uygulama varsayılanı (Lacivert) değişmedi.
    expect(themeToTokens("blue").primary).toBe("#141C33");
    expect(themeToTokens("gray").primary).toBe("#1D1F23");
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

  test("aile temaları tam şekilde ve okunur", () => {
    for (const key of FAMILY_THEME_KEYS) {
      const t = themes[key];
      expect(Object.keys(t.text)).toEqual(expect.arrayContaining(["between", "muted", "primary", "secondary"]));
      expect(t.colors.red).toBeTruthy();
      expect(t.notesColor.blue).toBeTruthy();
      const tok = themeToTokens(key);
      expect(analyzeContrast(tok).passes).toBe(true);
      // Vurgu zeminde ve kartta ayırt edilir; üstündeki beyaz düğme yazısı okunur.
      const { contrastRatio } = require("../utils/colorUtils");
      expect(contrastRatio(tok.accent, tok.primary)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(tok.accent, tok.secondary)).toBeGreaterThanOrEqual(2.5);
      expect(contrastRatio("#FFFFFF", tok.accent)).toBeGreaterThanOrEqual(3);
    }
  });

  test("bilinmeyen anahtar gri temaya düşer", () => {
    const { getThemeColors } = require("../theme/colors");
    expect(getThemeColors("nope")).toBe(themes.gray);
  });

  test("ailelerin ve yeni temaların etiketleri üç dilde var", () => {
    const keys = [
      "themeFamilyDefault", "themeFamilyBlue", "themeFamilyGreen",
      "themeToneBright", "themeToneLight", "themeToneMid", "themeToneDark", "themeToneAmoled",
      "blueDeepTheme", "greenMidTheme", "greenDeepTheme",
      "silverTheme", "duskTheme", "blueBrightTheme", "blueDuskTheme", "greenBrightTheme", "greenDuskTheme",
    ];
    for (const table of [tr, en, es]) {
      for (const key of keys) expect(typeof table[key] === "string" && table[key].trim()).toBeTruthy();
      for (const gone of ["whiteTheme", "graphiteTheme", "blueAmoledTheme", "greenAmoledTheme"]) {
        expect(table[gone]).toBeUndefined();
      }
    }
    for (const family of THEME_FAMILIES) expect(tr[family.labelKey]).toBeTruthy();
  });
});

describe("özel tema seçimi ve tonlar", () => {
  test("seçim anahtarı: varsayılan (koyu) ton eksiz, diğerleri :ton ekiyle", () => {
    expect(customSelectionKey("abc")).toBe("custom:abc");
    expect(customSelectionKey("abc", "dark")).toBe("custom:abc");
    expect(customSelectionKey("abc", "mid")).toBe("custom:abc:mid");
    expect(customSelectionKey("abc", "light")).toBe("custom:abc:light");
    expect(customSelectionKey("abc", "amoled")).toBe("custom:abc:amoled");
    expect(customSelectionKey("abc", "bozuk")).toBe("custom:abc");
  });

  test("parseCustomSelection eksiz anahtarı varsayılan tona okur", () => {
    expect(parseCustomSelection("custom:abc")).toEqual({ id: "abc", tone: "dark" });
    expect(parseCustomSelection("custom:abc:light")).toEqual({ id: "abc", tone: "light" });
    expect(parseCustomSelection("custom:abc:mid")).toEqual({ id: "abc", tone: "mid" });
    expect(parseCustomSelection("custom:abc:bozuk")).toEqual({ id: "abc", tone: "dark" });
    expect(parseCustomSelection("custom")).toEqual({ id: null, tone: "dark" });
    expect(parseCustomSelection("blue")).toBeNull();
    expect(parseCustomSelection(undefined)).toBeNull();
  });

  const eski = { id: "x1", name: "Eski", tokens: themeToTokens("purple") };

  test("eski tek tonlu tema: varsayılan ton AYNEN, diğerleri türetilir ve merdivende sıralı", () => {
    expect(customToneTokens(eski, "dark")).toBe(eski.tokens);
    const L = Object.fromEntries(TONES.map((t) => [t, luminance(customToneTokens(eski, t).primary)]));
    expect(L.amoled).toBeLessThan(L.dark);
    expect(L.dark).toBeLessThan(L.mid);
    expect(L.mid).toBeLessThan(L.light);
    expect(L.light).toBeLessThan(L.bright);
    expect(isLightSurface(customToneTokens(eski, "light").primary)).toBe(true);
    expect(isLightSurface(customToneTokens(eski, "mid").primary)).toBe(false);
    // önbellek: aynı girdi için aynı nesne
    expect(customToneTokens(eski, "light")).toBe(customToneTokens(eski, "light"));
  });

  test("beş ton kayıtlıysa (yeni merdiven) olduğu gibi kullanılır", () => {
    const tones = generateToneSet("#3B6FD4", "#F97316");
    const yeni = { id: "x2", name: "Yeni", ladder: TONE_LADDER, tokens: tones.dark, tones };
    for (const tone of TONES) expect(customToneTokens(yeni, tone)).toBe(tones[tone]);
  });

  test("tam tema nesnesi yerleşik temalarla aynı şekle sahip", () => {
    const built = buildCustomThemeFromEntry(eski, "mid");
    expect(Object.keys(built).sort()).toEqual(Object.keys(themes.gray).sort());
    expect(Object.keys(built.text).sort()).toEqual(Object.keys(themes.gray.text).sort());
    expect(built.primary).toBe(customToneTokens(eski, "mid").primary);
    expect(buildCustomThemeFromEntry(eski).primary).toBe(buildCustomTheme(eski.tokens).primary);
  });

  test("bozuk girdide patlamaz", () => {
    expect(customToneTokens(undefined, "dark")).toEqual({});
    expect(customToneTokens({ id: "q", tokens: {} }, "bozuk")).toEqual({});
  });
});

describe("ton merdiveni göçü (eski kayıt → yeni basamaklar)", () => {
  // Eski motorun üç tonu: açık ~94, orta ~13, koyu ~4 (HSL L).
  const { generateTokensFromSeeds } = require("../utils/themeStudio");
  const oldLight = generateTokensFromSeeds("#E8EEF8", "#2563EB");
  const oldMid = generateTokensFromSeeds("#141C33", "#4C8DFF");
  const oldDark = generateTokensFromSeeds("#050A13", "#4C8DFF");
  const ucTon = { id: "u1", name: "Üç", tokens: oldMid, tones: { light: oldLight, mid: oldMid, dark: oldDark } };

  test("eski orta = yeni koyu (varsayılan); eski açık = yeni çok açık; eski koyu atılır, AMOLED saf siyah", () => {
    expect(isLegacyCustomEntry(ucTon)).toBe(true);
    const m = migrateCustomEntry(ucTon);
    expect(m.ladder).toBe(TONE_LADDER);
    expect(isLegacyCustomEntry(m)).toBe(false);
    expect(m.tokens).toBe(oldMid);
    expect(m.tones).toEqual({ bright: oldLight, dark: oldMid });
    expect(migrateCustomEntry(ucTon)).toBe(m); // saf + önbellekli
    expect(migrateCustomEntry(m)).toBe(m); // idempotent
    // Okuma yolu göçü kendisi uygular.
    expect(customToneTokens(ucTon, "dark")).toBe(oldMid);
    expect(customToneTokens(ucTon, "bright")).toBe(oldLight);
    expect(customToneTokens(ucTon, "amoled").primary).toBe("#000000");
    const bundle = bundleFromEntry(ucTon);
    expect(isBundle(bundle)).toBe(true);
    expect(bundle.tones.dark).toBe(oldMid);
  });

  test("seçim: eski eksiz = koyu (aynı), eski :dark → :amoled, eski :light → :bright", () => {
    expect(migrateCustomSelection("custom:u1", ucTon)).toBe("custom:u1");
    expect(migrateCustomSelection("custom:u1:dark", ucTon)).toBe("custom:u1:amoled");
    expect(migrateCustomSelection("custom:u1:light", ucTon)).toBe("custom:u1:bright");
    // yeni kayıt ya da başka temanın seçimi dokunulmaz
    expect(migrateCustomSelection("custom:u1:dark", migrateCustomEntry(ucTon))).toBe("custom:u1:dark");
    expect(migrateCustomSelection("custom:baska:dark", ucTon)).toBe("custom:baska:dark");
    expect(migrateCustomSelection("blue", ucTon)).toBe("blue");
  });

  test("migrateThemeLadder: liste + seçim birlikte, yeni kayıtlarda değişiklik yok", () => {
    const out = migrateThemeLadder("custom:u1:dark", [ucTon]);
    expect(out.changed).toBe(true);
    expect(out.selectedTheme).toBe("custom:u1:amoled");
    expect(out.customThemes[0].ladder).toBe(TONE_LADDER);
    const again = migrateThemeLadder(out.selectedTheme, out.customThemes);
    expect(again.changed).toBe(false);
    expect(again.selectedTheme).toBe("custom:u1:amoled");
    expect(migrateThemeLadder("blue", []).changed).toBe(false);
    expect(migrateThemeLadder("blue", undefined).changed).toBe(false);
  });
});

describe("hazır temalar (deste)", () => {
  test("kimlikler benzersiz ve Gece Moru / Kızıl Sinema içeride", () => {
    expect(new Set(PRESET_IDS).size).toBe(PRESET_IDS.length);
    expect(PRESET_IDS).toEqual(expect.arrayContaining(["default", "blue", "green", "purple", "crimson"]));
    expect(PRESET_IDS.length).toBeGreaterThanOrEqual(8);
  });

  test("her hazır tema tam, beş tonlu bir deste", () => {
    for (const preset of THEME_PRESETS) {
      const bundle = getPresetBundle(preset.id);
      expect(isBundle(bundle)).toBe(true);
      expect(bundle.base).toMatch(/^#[0-9A-F]{6}$/i);
      expect(bundle.accent).toMatch(/^#[0-9A-F]{6}$/i);
      for (const tone of TONES) expect(Object.keys(bundle.tones[tone]).sort()).toEqual([...TOKEN_KEYS].sort());
      expect(isLightSurface(bundle.tones.light.primary)).toBe(true);
      expect(isLightSurface(bundle.tones.mid.primary)).toBe(false);
    }
    expect(getPresetBundle("yok")).toBeNull();
  });

  test("aile hazır temaları yerleşik temaların AYNISI", () => {
    for (const family of THEME_FAMILIES) {
      const bundle = getPresetBundle(family.id);
      for (const tone of TONES) expect(bundle.tones[tone]).toEqual(themeToTokens(family.tones[tone]));
    }
  });

  test("Gece Moru / Kızıl Sinema: koyu ton eski temanın aynısı, tüm tonlar okunur", () => {
    const pairs = [["purple", "purple"], ["crimson", "amber"]];
    for (const [id, key] of pairs) {
      const bundle = getPresetBundle(id);
      expect(bundle.tones.dark).toEqual(themeToTokens(key));
      for (const tone of TONES) expect(analyzeContrast(bundle.tones[tone]).passes).toBe(true);
    }
  });

  test("motorla kurulan yeni setlerin her tonu okunur", () => {
    for (const id of ["ocean", "forest", "mocha", "sunset"]) {
      const bundle = getPresetBundle(id);
      for (const tone of TONES) expect(analyzeContrast(bundle.tones[tone]).passes).toBe(true);
    }
  });

  test("hazır temaların etiketi her dilde var (ham kimlik görünmez)", () => {
    for (const lang of ["tr", "en", "es", "pt", "de", "it"]) {
      const copy = getStudioCopy(lang);
      for (const id of PRESET_IDS) expect(presetLabel(copy, id)).not.toBe(id);
      for (const tone of TONES) expect(toneLabel(copy, tone)).not.toBe(tone);
    }
  });
});

describe("deste ↔ kayıt", () => {
  test("entryFromBundle: tokens = varsayılan ton, ladder bayrağı, tones + base taşınır; geri çevrilir", () => {
    const bundle = getPresetBundle("ocean");
    const entry = entryFromBundle(bundle, { id: "e1", name: "Okyanus" });
    expect(entry.ladder).toBe(TONE_LADDER);
    expect(entry.tokens).toBe(bundle.tones.dark);
    expect(entry.tones).toBe(bundle.tones);
    expect(entry.base).toBe(bundle.base);
    const back = bundleFromEntry(entry);
    expect(back.tones).toEqual(bundle.tones);
    expect(back.base).toBe(bundle.base);
  });

  test("eski tek tonlu kayıt: varsayılan ton değişmez, diğerleri türetilir", () => {
    const eski = { id: "e2", name: "E", tokens: themeToTokens("blue") };
    const bundle = bundleFromEntry(eski);
    expect(bundle.tones.dark).toBe(eski.tokens);
    expect(isBundle(bundle)).toBe(true);
    expect(isLightSurface(bundle.tones.light.primary)).toBe(true);
  });

  test("initialBundle: seçili temaya göre başlar", () => {
    expect(initialBundle({ selectedTheme: "blueDeep" })).toMatchObject({ tone: "amoled" });
    expect(initialBundle({ selectedTheme: "sky" }).bundle.tones.light).toEqual(themeToTokens("sky"));
    const purple = initialBundle({ selectedTheme: "purple" });
    expect(purple.tone).toBe("dark");
    expect(purple.bundle.tones.dark).toEqual(themeToTokens("purple"));
    expect(initialBundle({ selectedTheme: "nope" })).toMatchObject({ tone: "dark" });
    const custom = { id: "c9", name: "C", ladder: TONE_LADDER, tokens: themeToTokens("greenMid") };
    const fromCustom = initialBundle({ selectedTheme: "custom:c9:light", customThemes: [custom] });
    expect(fromCustom.tone).toBe("light");
    expect(fromCustom.bundle.tones.dark).toBe(custom.tokens);
    const editing = initialBundle({ existing: custom, selectedTheme: "blue", customThemes: [custom] });
    expect(editing.tone).toBe("dark");
  });
});

describe("yedek: çok tonlu temalar", () => {
  const tones = generateToneSet("#3B6FD4", "#F97316");

  test("beş ton ve ana renk yedekte korunur (yeni merdiven)", () => {
    const { themes: list } = sanitizeCustomThemes([
      { id: "a1", name: "Mavi", ladder: TONE_LADDER, tokens: tones.dark, tones, base: "#3b6fd4" },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].ladder).toBe(TONE_LADDER);
    expect(list[0].tones).toEqual(tones);
    expect(list[0].base.toUpperCase()).toBe("#3B6FD4");
  });

  test("bozuk bir ton atılır, geri kalanı korunur; tonsuz eski kayıt olduğu gibi geçer", () => {
    const { themes: list } = sanitizeCustomThemes([
      { id: "a2", name: "X", ladder: TONE_LADDER, tokens: tones.dark, tones: { light: tones.light, mid: "bozuk", dark: null } },
      { id: "a3", name: "Eski", tokens: tones.dark },
    ]);
    expect(Object.keys(list[0].tones)).toEqual(["light"]);
    expect(list[1].tones).toEqual({ dark: tones.dark });
    expect(list[1].ladder).toBe(TONE_LADDER);
    expect(list[1].base).toBeUndefined();
  });

  test("eski merdivenli yedek: temalar çevrilir, seçili tonu da yeni basamağa geçer", () => {
    const oldMid = tones.dark;
    const backup = {
      settings: {
        theme: "custom:old1:dark",
        customThemes: [{ id: "old1", name: "Eski", tokens: oldMid, tones: { light: tones.bright, mid: oldMid, dark: tones.amoled } }],
      },
    };
    const plan = planImport(backup, { currentThemes: [], themeMode: "replace" });
    const themeWrite = plan.writes.find((w) => w.id === "theme");
    const themesWrite = plan.writes.find((w) => w.id === "customThemes");
    expect(themeWrite.value).toBe("custom:old1:amoled");
    expect(themesWrite.value[0].ladder).toBe(TONE_LADDER);
    expect(themesWrite.value[0].tones.bright).toEqual(tones.bright);
    expect(themesWrite.value[0].tokens).toEqual(oldMid);
  });

  test("ton ekli seçim geri yüklemede temayı kaybetmez", () => {
    const backup = {
      settings: {
        theme: "custom:n1:light",
        customThemes: [{ id: "n1", name: "Yeni", ladder: TONE_LADDER, tokens: tones.dark, tones }],
      },
    };
    const plan = planImport(backup, { currentThemes: [], themeMode: "replace" });
    expect(plan.writes.find((w) => w.id === "theme").value).toBe("custom:n1:light");
    expect(plan.warnings).not.toContain("theme-missing");
  });

  test("seçili tema: yeni ton ekli anahtar ve yeni hazır temalar geçerli, bozuk ton değil", () => {
    const entry = { id: "theme", key: "theme" };
    const problem = (value) => valueProblem(entry, value);
    expect(problem("custom:abc")).toBeNull();
    expect(problem("custom:abc:light")).toBeNull();
    expect(problem("custom:abc:mid")).toBeNull();
    expect(problem("custom:abc:bright")).toBeNull();
    expect(problem("custom:abc:amoled")).toBeNull();
    for (const key of FAMILY_THEME_KEYS) expect(problem(key)).toBeNull();
    expect(problem("blueDeep")).toBeNull();
    expect(problem("greenMid")).toBeNull();
    expect(problem("greenDeep")).toBeNull();
    expect(problem("custom:abc:bozuk")).toBe("invalid");
    expect(problem("custom:abc:light:fazla")).toBe("invalid");
  });
});
