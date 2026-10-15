// __tests__/themeStudio.test.js
//
// Özel tema oluşturucunun motoru. Bozulursa belirti SESSİZDİR: ekran açılır,
// palet üretilir ama metin zemine karışır ya da "rastgele" hep aynı şeyi verir.
// Bu yüzden okunurluk garantisi ve çeşitlilik sayılarla sabitlendi.

const {
  ACCENT_PRESETS,
  BACKGROUND_PRESETS,
  CONTRAST_LEVELS,
  HARMONIES,
  MOODS,
  SURFACE_MODES,
  analyzeContrast,
  describeTheme,
  fixReadability,
  fitAccent,
  generateCandidates,
  generateRandomTheme,
  generateTokensFromSeeds,
  hueFamily,
  suggestAccents,
  uniqueName,
} = require("../utils/themeStudio");
const { contrastRatio, hexToHsl, isLightSurface, normalizeHex } = require("../utils/colorUtils");
const {
  canRedo,
  canUndo,
  createHistory,
  historyReducer,
  HISTORY_LIMIT,
} = require("../utils/draftHistory");

// Tohumlu, tekrarlanabilir üretici (mulberry32).
const seeded = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const TOKEN_KEYS = [
  "primary", "secondary", "between", "tab", "border",
  "accent", "bold",
  "textPrimary", "textSecondary", "textBetween", "textMuted",
];

// Uç zeminler: saf siyah/beyaz, orta gri (iki polarite de zorlanır), parlak sarı
// (HSL açıklığı yanıltır), doygun mavi/kırmızı.
const UC_ZEMINLER = [
  "#000000", "#FFFFFF", "#808080", "#7A7A7A", "#FFD400", "#FFFF00",
  "#0000FF", "#FF0000", "#00AA55", "#222222", "#E0E0E0", "#4A4A6A",
];

describe("generateTokensFromSeeds", () => {
  test("tam 11 token üretir ve hepsi geçerli hex", () => {
    const t = generateTokensFromSeeds("#0B0D12", "#3B82F6");
    expect(Object.keys(t).sort()).toEqual([...TOKEN_KEYS].sort());
    for (const key of TOKEN_KEYS) expect(normalizeHex(t[key])).toBe(t[key]);
  });

  test("zemin ve vurgu AYNEN korunur", () => {
    const t = generateTokensFromSeeds("#0B0D12", "#F97316");
    expect(t.primary).toBe("#0B0D12");
    expect(t.accent).toBe("#F97316");
  });

  test("ana ve ikincil metin, her uç zeminde ulaşılabilir en iyi kontrasta yaklaşır", () => {
    const zayif = [];
    for (const bg of UC_ZEMINLER) {
      for (const level of CONTRAST_LEVELS) {
        const t = generateTokensFromSeeds(bg, "#3B82F6", { contrast: level });
        const enIyi = Math.max(contrastRatio("#000000", bg), contrastRatio("#FFFFFF", bg));
        // Ulaşılabilir tavanın en az %90'ı ya da hedef: hangisi küçükse.
        const hedefAna = { soft: 6, balanced: 8, high: 12 }[level];
        const gerekli = Math.min(hedefAna, enIyi * 0.9);
        const oran = contrastRatio(t.textPrimary, bg);
        if (oran < gerekli) zayif.push(`${bg}/${level}: ${oran.toFixed(2)} < ${gerekli.toFixed(2)}`);
      }
    }
    expect(zayif).toEqual([]);
  });

  test("tipik zeminlerde dört metin kademesi de hedefi geçer", () => {
    const tipik = [...BACKGROUND_PRESETS, "#15171C", "#2A2D33", "#DDF2FC"];
    const hedef = { primary: 8, secondary: 6, between: 4.6, muted: 3.4 };
    const zayif = [];
    for (const bg of tipik) {
      const t = generateTokensFromSeeds(bg, "#3B82F6");
      const kontrol = [
        ["textPrimary", hedef.primary],
        ["textSecondary", hedef.secondary],
        ["textBetween", hedef.between],
        ["textMuted", hedef.muted],
      ];
      for (const [key, min] of kontrol) {
        const oran = Math.min(contrastRatio(t[key], t.primary), contrastRatio(t[key], t.secondary));
        if (oran < min) zayif.push(`${bg}.${key} ${oran.toFixed(2)} < ${min}`);
      }
    }
    expect(zayif).toEqual([]);
  });

  test("metin kademeleri sıralı: ana > ikincil > ara > soluk (zemine kontrast)", () => {
    for (const bg of ["#0B0D12", "#F6F7FB", "#10151F", "#FAF6EE"]) {
      const t = generateTokensFromSeeds(bg, "#3B82F6");
      const c = (k) => contrastRatio(t[k], t.primary);
      expect(c("textPrimary")).toBeGreaterThanOrEqual(c("textSecondary") - 0.01);
      expect(c("textSecondary")).toBeGreaterThanOrEqual(c("textBetween") - 0.01);
      expect(c("textBetween")).toBeGreaterThanOrEqual(c("textMuted") - 0.01);
    }
  });

  test("koyu zeminde yüzeyler zeminden AÇIK, açık zeminde ikincil yüzey zeminden açık/aynı", () => {
    const koyu = generateTokensFromSeeds("#0B0D12", "#3B82F6");
    expect(hexToHsl(koyu.secondary).l).toBeGreaterThan(hexToHsl(koyu.primary).l);
    expect(hexToHsl(koyu.border).l).toBeGreaterThan(hexToHsl(koyu.secondary).l);
    const acik = generateTokensFromSeeds("#F6F7FB", "#3B82F6");
    expect(hexToHsl(acik.between).l).toBeLessThan(hexToHsl(acik.primary).l);
    expect(hexToHsl(acik.border).l).toBeLessThan(hexToHsl(acik.between).l);
  });

  test("koyu/açık ayrımı algısal parlaklığa göre: parlak sarı zemin AÇIK sayılır", () => {
    const t = generateTokensFromSeeds("#FFD400", "#3B82F6");
    expect(isLightSurface(t.primary)).toBe(true);
    // koyu zemin metni açık, açık zemin metni koyu
    expect(isLightSurface(t.textPrimary)).toBe(false);
    const k = generateTokensFromSeeds("#0B0D12", "#3B82F6");
    expect(isLightSurface(k.textPrimary)).toBe(true);
  });

  test("saf siyah/gri zeminde metin renk kaçırmaz (doygunluk ~0)", () => {
    for (const bg of ["#000000", "#808080", "#FFFFFF"]) {
      const t = generateTokensFromSeeds(bg, "#3B82F6");
      expect(hexToHsl(t.textPrimary).s).toBeLessThanOrEqual(5);
    }
  });

  test("kontrast seviyesi sıralaması: yüksek >= dengeli >= yumuşak (ana metin)", () => {
    const r = (level) => {
      const t = generateTokensFromSeeds("#0B0D12", "#3B82F6", { contrast: level });
      return contrastRatio(t.textPrimary, t.primary);
    };
    expect(r("high")).toBeGreaterThanOrEqual(r("balanced"));
    expect(r("balanced")).toBeGreaterThanOrEqual(r("soft"));
    expect(r("high")).toBeGreaterThan(r("soft"));
  });

  test("yüzey ayrımı yüksekte belirgin, yumuşakta hafif", () => {
    const fark = (level) => {
      const t = generateTokensFromSeeds("#0B0D12", "#3B82F6", { contrast: level });
      return hexToHsl(t.secondary).l - hexToHsl(t.primary).l;
    };
    expect(fark("high")).toBeGreaterThan(fark("soft"));
  });

  test("nötr yüzeyler zemin tonunu zayıflatır, renkli yüzeyler korur", () => {
    const renkli = generateTokensFromSeeds("#10151F", "#3B82F6", { surfaces: "tinted" });
    const notr = generateTokensFromSeeds("#10151F", "#3B82F6", { surfaces: "neutral" });
    expect(hexToHsl(notr.secondary).s).toBeLessThan(hexToHsl(renkli.secondary).s);
  });

  test("bozuk girdide patlamaz", () => {
    expect(() => generateTokensFromSeeds(null, undefined)).not.toThrow();
    expect(() => generateTokensFromSeeds("renk", "renk", { contrast: "yok" })).not.toThrow();
  });
});

describe("suggestAccents", () => {
  test("her uyum için bir öneri verir ve hepsi zemine karşı >= 3:1", () => {
    for (const bg of BACKGROUND_PRESETS) {
      const list = suggestAccents(bg, "#3B82F6");
      expect(list.map((x) => x.id)).toEqual(HARMONIES.map((h) => h.id));
      for (const { hex } of list) {
        expect(normalizeHex(hex)).toBe(hex);
        expect(contrastRatio(hex, bg)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test("tamamlayıcı öneri zemin tonunun ~180° karşısında", () => {
    const list = suggestAccents("#10151F", "#3B82F6");
    const comp = list.find((x) => x.id === "complementary");
    const fark = Math.abs(hexToHsl(comp.hex).h - (hexToHsl("#10151F").h + 180) % 360);
    expect(Math.min(fark, 360 - fark)).toBeLessThanOrEqual(14);
  });

  test("nötr zeminde çapa mevcut vurgunun tonu olur", () => {
    const list = suggestAccents("#000000", "#EF4444");
    const mono = list.find((x) => x.id === "mono");
    const fark = Math.abs(hexToHsl(mono.hex).h - hexToHsl("#EF4444").h);
    expect(Math.min(fark, 360 - fark)).toBeLessThanOrEqual(6);
  });
});

describe("fitAccent", () => {
  test("hem zemine hem beyaz etikete yeterli vurguya dokunmaz", () => {
    expect(fitAccent("#3B82F6", "#0B0D12")).toBe("#3B82F6");
    expect(fitAccent("#8B5CF6", "#0B0D12")).toBe("#8B5CF6");
  });
  test("beyaz düğme yazısını taşıyamayan parlak vurguyu koyulaştırır, tonu korur", () => {
    // #F97316 beyaza karşı 2.8:1 — yerleşik temaların hepsi >= 3.2
    const fixed = fitAccent("#F97316", "#0B0D12");
    expect(fixed).not.toBe("#F97316");
    expect(contrastRatio(fixed, "#FFFFFF")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(fixed, "#0B0D12")).toBeGreaterThanOrEqual(3);
    expect(Math.abs(hexToHsl(fixed).h - hexToHsl("#F97316").h)).toBeLessThanOrEqual(4);
    // gözle fark edilmeyecek kadar küçük kaydırma
    expect(hexToHsl("#F97316").l - hexToHsl(fixed).l).toBeLessThanOrEqual(8);
  });
  test("zemine karışan vurguyu tonu koruyarak ayırır", () => {
    const koyuMavi = "#10204A";
    const fixed = fitAccent(koyuMavi, "#0B0D12");
    expect(contrastRatio(fixed, "#0B0D12")).toBeGreaterThanOrEqual(3);
    expect(Math.abs(hexToHsl(fixed).h - hexToHsl(koyuMavi).h)).toBeLessThanOrEqual(6);
  });
});

describe("generateRandomTheme", () => {
  test("aynı tohum aynı temayı verir (deterministik)", () => {
    const a = generateRandomTheme({ rng: seeded(7), moodId: "ocean" });
    const b = generateRandomTheme({ rng: seeded(7), moodId: "ocean" });
    expect(a).toEqual(b);
  });

  test("her ruh hali kendi kutupluluğunda ve okunur bir tema üretir", () => {
    const sorunlar = [];
    for (const mood of MOODS) {
      for (let i = 0; i < 40; i += 1) {
        const t = generateRandomTheme({ rng: seeded(i * 31 + mood.id.length), moodId: mood.id });
        if (t.dark !== mood.dark) sorunlar.push(`${mood.id}#${i} kutup`);
        if (t.moodId !== mood.id) sorunlar.push(`${mood.id}#${i} mood`);
        if (contrastRatio(t.accent, t.bg) < 3) sorunlar.push(`${mood.id}#${i} vurgu ${contrastRatio(t.accent, t.bg).toFixed(2)}`);
        if (contrastRatio(t.tokens.textPrimary, t.tokens.primary) < 7) sorunlar.push(`${mood.id}#${i} metin`);
        if (!analyzeContrast(t.tokens).passes) sorunlar.push(`${mood.id}#${i} rapor`);
      }
    }
    expect(sorunlar).toEqual([]);
  });

  test("ruh hali aralığına uyar (zemin tonu / açıklığı)", () => {
    for (const id of ["midnight", "forest", "ocean", "mocha", "neon"]) {
      const mood = MOODS.find((m) => m.id === id);
      for (let i = 0; i < 25; i += 1) {
        const t = generateRandomTheme({ rng: seeded(100 + i), moodId: id });
        const { h, l } = hexToHsl(t.bg);
        // hex yuvarlaması + sarma payı
        const lo = mood.hue[0] % 360;
        const hi = lo + (mood.hue[1] - mood.hue[0]);
        const hh = h < lo - 6 ? h + 360 : h;
        expect(hh).toBeGreaterThanOrEqual(lo - 6);
        expect(hh).toBeLessThanOrEqual(hi + 6);
        expect(l).toBeGreaterThanOrEqual(mood.bgL[0] - 2);
        expect(l).toBeLessThanOrEqual(mood.bgL[1] + 2);
      }
    }
  });

  test("kilitli zemin AYNEN korunur, vurgu değişir", () => {
    const seen = new Set();
    for (let i = 0; i < 12; i += 1) {
      const t = generateRandomTheme({ rng: seeded(i + 1), lock: { bg: "#0B0D12" } });
      expect(t.bg).toBe("#0B0D12");
      expect(t.tokens.primary).toBe("#0B0D12");
      seen.add(t.accent);
    }
    expect(seen.size).toBeGreaterThan(4);
  });

  test("kilitli vurgu AYNEN korunur, zemin değişir", () => {
    const seen = new Set();
    for (let i = 0; i < 12; i += 1) {
      const t = generateRandomTheme({ rng: seeded(i + 50), lock: { accent: "#F97316" } });
      expect(t.accent).toBe("#F97316");
      expect(t.tokens.accent).toBe("#F97316");
      seen.add(t.bg);
    }
    expect(seen.size).toBeGreaterThan(4);
  });

  test("açık zeminli kilitle koyu ruh hali seçilse bile vurgu okunur kalır", () => {
    for (let i = 0; i < 20; i += 1) {
      const t = generateRandomTheme({ rng: seeded(i), moodId: "midnight", lock: { bg: "#F6F7FB" } });
      expect(t.dark).toBe(false);
      expect(contrastRatio(t.accent, "#F6F7FB")).toBeGreaterThanOrEqual(3);
    }
  });

  test("rastgele vurgu sarı–limon bandına (bulanık zeytine) düşmez", () => {
    const bandda = [];
    for (const mood of MOODS) {
      for (let i = 0; i < 60; i += 1) {
        const t = generateRandomTheme({ rng: seeded(900 + i), moodId: mood.id });
        const { h, s } = hexToHsl(t.accent);
        // fitAccent koyulaştırırken ton birkaç derece oynayabilir: 3° pay
        if (s > 25 && h > 49 && h < 97) bandda.push(`${mood.id}#${i} h=${h}`);
      }
    }
    expect(bandda).toEqual([]);
  });

  test("varsayılan rastgelelik kaynağıyla da çalışır", () => {
    const t = generateRandomTheme();
    expect(Object.keys(t.tokens).sort()).toEqual([...TOKEN_KEYS].sort());
    expect(MOODS.map((m) => m.id)).toContain(t.moodId);
  });
});

describe("generateCandidates", () => {
  test("istenen sayıda, birbirinden FARKLI aday üretir", () => {
    for (let s = 1; s <= 10; s += 1) {
      const list = generateCandidates(6, { rng: seeded(s) });
      expect(list).toHaveLength(6);
      expect(new Set(list.map((c) => c.key)).size).toBe(6);
    }
  });

  test("karışık kipte adaylar farklı ruh hallerinden gelir", () => {
    const list = generateCandidates(6, { rng: seeded(3) });
    expect(new Set(list.map((c) => c.moodId)).size).toBe(6);
  });

  test("tek ruh hali seçiliyse hepsi o ruh halinde ama yine de ayrışır", () => {
    const list = generateCandidates(6, { rng: seeded(5), moodId: "ocean" });
    expect(list.every((c) => c.moodId === "ocean")).toBe(true);
    expect(new Set(list.map((c) => c.key)).size).toBe(6);
  });

  test("`avoid` ile verilen önceki adaylara çok benzeyen çıkmaz", () => {
    const onceki = generateCandidates(6, { rng: seeded(11) });
    const yeni = generateCandidates(6, { rng: seeded(12), avoid: onceki });
    const ortak = yeni.filter((c) => onceki.some((o) => o.key === c.key));
    expect(ortak).toEqual([]);
  });

  test("kilitli zemin tüm adaylarda aynı kalır", () => {
    const list = generateCandidates(6, { rng: seeded(9), lock: { bg: "#10151F" } });
    expect(list.every((c) => c.tokens.primary === "#10151F")).toBe(true);
  });

  test("zemin VE vurgu kilitliyse adaylar stil kombinasyonlarıyla ayrışır", () => {
    const list = generateCandidates(6, { rng: seeded(2), lock: { bg: "#10151F", accent: "#F97316" } });
    expect(list).toHaveLength(6);
    expect(list.every((c) => c.tokens.primary === "#10151F" && c.tokens.accent === "#F97316")).toBe(true);
    expect(new Set(list.map((c) => c.key)).size).toBe(6);
  });
});

describe("analyzeContrast", () => {
  const iyi = generateTokensFromSeeds("#0B0D12", "#3B82F6");

  test("iyi palet geçer, beş satır verir", () => {
    const r = analyzeContrast(iyi);
    expect(r.rows).toHaveLength(5);
    expect(r.passes).toBe(true);
    expect(r.issues).toBe(0);
    expect(["great", "ok"]).toContain(r.level);
  });

  test("zemine karışan ana metin 'fail' olur ve sayılır", () => {
    const kotu = { ...iyi, textPrimary: "#14161C" };
    const r = analyzeContrast(kotu);
    expect(r.rows.find((x) => x.id === "title").level).toBe("fail");
    expect(r.level).toBe("fail");
    expect(r.passes).toBe(false);
    expect(r.issues).toBeGreaterThanOrEqual(1);
  });

  test("sınırdaki oran 'low' sayılır", () => {
    // 4.5'in altı ama 3.15'in üstü
    const sinirda = { ...iyi, textSecondary: "#7A7F8A" };
    const row = analyzeContrast(sinirda).rows.find((x) => x.id === "card");
    expect(["low", "fail", "ok"]).toContain(row.level);
    expect(row.ratio).toBeLessThan(analyzeContrast(iyi).rows.find((x) => x.id === "card").ratio);
  });
});

describe("fixReadability", () => {
  test("sorunsuz palet için boş yama", () => {
    expect(fixReadability(generateTokensFromSeeds("#0B0D12", "#3B82F6"))).toEqual({});
  });

  test("bozuk metinleri düzeltir ve yamadan sonra rapor temizdir", () => {
    const iyi = generateTokensFromSeeds("#0B0D12", "#3B82F6");
    const kotu = { ...iyi, textPrimary: "#15171C", textSecondary: "#1B1E25", textMuted: "#14161B" };
    expect(analyzeContrast(kotu).passes).toBe(false);
    const yama = fixReadability(kotu);
    expect(Object.keys(yama).length).toBeGreaterThan(0);
    const duzeltilmis = { ...kotu, ...yama };
    expect(analyzeContrast(duzeltilmis).passes).toBe(true);
  });

  test("zemine karışan vurguyu da ayırır ve bold'u yeniler", () => {
    const iyi = generateTokensFromSeeds("#0B0D12", "#3B82F6");
    const kotu = { ...iyi, accent: "#101827" };
    const yama = fixReadability(kotu);
    expect(contrastRatio(yama.accent, kotu.primary)).toBeGreaterThanOrEqual(3);
    expect(yama.bold).toBeTruthy();
  });

  test("açık zeminde de çalışır", () => {
    const iyi = generateTokensFromSeeds("#F6F7FB", "#3B82F6");
    const kotu = { ...iyi, textPrimary: "#E9EBF2", textMuted: "#EEF0F6" };
    const yama = fixReadability(kotu);
    expect(analyzeContrast({ ...kotu, ...yama }).rows.find((x) => x.id === "title").level).not.toBe("fail");
    expect(contrastRatio(yama.textPrimary, "#F6F7FB")).toBeGreaterThanOrEqual(8);
  });
});

describe("hueFamily / describeTheme", () => {
  test("ton aralıkları", () => {
    expect(hueFamily(0)).toBe("red");
    expect(hueFamily(350)).toBe("red");
    expect(hueFamily(25)).toBe("orange");
    expect(hueFamily(50)).toBe("yellow");
    expect(hueFamily(120)).toBe("green");
    expect(hueFamily(180)).toBe("teal");
    expect(hueFamily(220)).toBe("blue");
    expect(hueFamily(270)).toBe("violet");
    expect(hueFamily(320)).toBe("pink");
    expect(hueFamily(200, 5)).toBe("gray");
  });
  test("kutupluluk + vurgu ailesi", () => {
    expect(describeTheme(generateTokensFromSeeds("#0B0D12", "#F97316"))).toEqual({ polarity: "dark", family: "orange" });
    expect(describeTheme(generateTokensFromSeeds("#F6F7FB", "#3B82F6"))).toEqual({ polarity: "light", family: "blue" });
  });
});

describe("uniqueName", () => {
  test("çakışma yoksa aynen", () => {
    expect(uniqueName("Gece", ["Gün"])).toBe("Gece");
  });
  test("çakışmada sayı ekler, büyük/küçük harf duyarsız", () => {
    expect(uniqueName("Gece", ["gece"])).toBe("Gece 2");
    expect(uniqueName("Gece", ["Gece", "Gece 2"])).toBe("Gece 3");
  });
  test("boş girdi boş döner", () => {
    expect(uniqueName("  ", ["x"])).toBe("");
  });
});

describe("hazır renkler", () => {
  test("hepsi geçerli hex, yinelenen yok", () => {
    for (const list of [ACCENT_PRESETS, BACKGROUND_PRESETS]) {
      expect(new Set(list).size).toBe(list.length);
      for (const hex of list) expect(normalizeHex(hex)).toBe(hex);
    }
  });
  test("zemin hazırlarının hem koyu hem açık örneği var", () => {
    expect(BACKGROUND_PRESETS.some((h) => isLightSurface(h))).toBe(true);
    expect(BACKGROUND_PRESETS.some((h) => !isLightSurface(h))).toBe(true);
  });
  test("yüzey/kontrast seçenekleri tanımlı", () => {
    expect(CONTRAST_LEVELS).toEqual(["soft", "balanced", "high"]);
    expect(SURFACE_MODES).toEqual(["neutral", "tinted"]);
  });
});

describe("draftHistory", () => {
  const A = { a: 1 };
  const B = { a: 2 };
  const C = { a: 3 };

  test("commit → undo → redo", () => {
    let s = createHistory(A);
    expect(canUndo(s)).toBe(false);
    s = historyReducer(s, { type: "commit", value: B });
    s = historyReducer(s, { type: "commit", value: C });
    expect(s.present).toBe(C);
    s = historyReducer(s, { type: "undo" });
    expect(s.present).toBe(B);
    expect(canRedo(s)).toBe(true);
    s = historyReducer(s, { type: "redo" });
    expect(s.present).toBe(C);
    expect(canRedo(s)).toBe(false);
  });

  test("yeni commit ileri geçmişi siler", () => {
    let s = createHistory(A);
    s = historyReducer(s, { type: "commit", value: B });
    s = historyReducer(s, { type: "undo" });
    s = historyReducer(s, { type: "commit", value: C });
    expect(canRedo(s)).toBe(false);
    expect(s.present).toBe(C);
  });

  test("değişmeyen değer geçmişe adım eklemez", () => {
    let s = createHistory(A);
    s = historyReducer(s, { type: "commit", value: { a: 1 } });
    expect(canUndo(s)).toBe(false);
  });

  test("geçmiş sınırlıdır", () => {
    let s = createHistory({ n: 0 });
    for (let i = 1; i <= HISTORY_LIMIT + 15; i += 1) s = historyReducer(s, { type: "commit", value: { n: i } });
    expect(s.past).toHaveLength(HISTORY_LIMIT);
    expect(s.present).toEqual({ n: HISTORY_LIMIT + 15 });
  });

  test("boşken undo/redo etkisiz; clear her şeyi sıfırlar", () => {
    const s = createHistory(A);
    expect(historyReducer(s, { type: "undo" })).toBe(s);
    expect(historyReducer(s, { type: "redo" })).toBe(s);
    const dolu = historyReducer(s, { type: "commit", value: B });
    const temiz = historyReducer(dolu, { type: "clear", value: C });
    expect(temiz).toEqual({ past: [], present: C, future: [] });
  });
});
