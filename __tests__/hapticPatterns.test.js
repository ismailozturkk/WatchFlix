// __tests__/hapticPatterns.test.js
//
// Saf desen kataloğu: her desen geçerli kategori/düzey/atom kullanıyor mu, düzey ve
// kategori filtresi doğru mu, iOS/Android çözümlemesi ve güç kademeleri beklenen
// native çağrıları üretiyor mu, Android "strong" dalga formu tutarlı mı.

const hp = require("../utils/hapticPatterns");

const {
  HAPTIC_ATOMS,
  HAPTIC_CATEGORIES,
  HAPTIC_LEVELS,
  HAPTIC_PATTERNS,
  HAPTIC_PATTERN_NAMES,
  HAPTIC_SAMPLES,
  buildWaveform,
  isHapticCategoryMap,
  isPatternAllowed,
  normalizeCategories,
  patternForLegacy,
  resolvePattern,
} = hp;

describe("katalog bütünlüğü", () => {
  test.each(HAPTIC_PATTERN_NAMES)("%s geçerli kategori, düzey, öncelik ve atomlar kullanır", (name) => {
    const p = HAPTIC_PATTERNS[name];
    expect(HAPTIC_CATEGORIES).toContain(p.category);
    expect(HAPTIC_LEVELS).toContain(p.level);
    expect(p.priority).toBeGreaterThanOrEqual(1);
    expect(p.priority).toBeLessThanOrEqual(5);
    expect(p.gap).toBeGreaterThan(0);
    expect(p.steps.length).toBeGreaterThan(0);
    let previous = -1;
    for (const [atom, at] of p.steps) {
      expect(HAPTIC_ATOMS[atom]).toBeDefined();
      expect(at).toBeGreaterThanOrEqual(previous); // zamana göre sıralı
      previous = at;
    }
    expect(p.steps[0][1]).toBe(0); // ilk vuruş anında
    expect(previous).toBeLessThanOrEqual(600); // desen uzun sürmez
  });

  test("ayarlar ekranındaki örnekler katalogda var ve doğru kategoride", () => {
    expect(Object.keys(HAPTIC_SAMPLES).sort()).toEqual([...HAPTIC_CATEGORIES].sort());
    for (const [category, names] of Object.entries(HAPTIC_SAMPLES)) {
      for (const name of names) expect(HAPTIC_PATTERNS[name]?.category).toBe(category);
    }
  });

  test("her Android zinciri eski API'lerde de var olan bir sabitle biter ya da hafif atomdur", () => {
    const everywhere = new Set(["clock-tick", "context-click", "keyboard-tap", "long-press", "virtual-key"]);
    for (const [name, atom] of Object.entries(HAPTIC_ATOMS)) {
      const tail = atom.android[atom.android.length - 1];
      const hasFallback = !atom.light;
      expect(everywhere.has(tail) || hasFallback).toBe(true);
      if (!everywhere.has(tail)) expect(name).toMatch(/success|warning|error/);
    }
  });
});

describe("düzey ve kategori filtresi", () => {
  test("minimal = eski 'az olsun': seçim/dokunuş sessiz, baskı/sonuç/kutlama çalar", () => {
    const prefs = { level: "minimal" };
    expect(isPatternAllowed("select", prefs)).toBe(false);
    expect(isPatternAllowed("tap", prefs)).toBe(false);
    expect(isPatternAllowed("toggleOn", prefs)).toBe(false);
    expect(isPatternAllowed("press", prefs)).toBe(true);
    expect(isPatternAllowed("success", prefs)).toBe(true);
    expect(isPatternAllowed("error", prefs)).toBe(true);
    expect(isPatternAllowed("badge", prefs)).toBe(true);
    expect(isPatternAllowed("wrong", prefs)).toBe(true);
  });

  test("balanced seçim/sürükleme/sosyal ekler; rich ayrıca hafif dokunuşları", () => {
    expect(isPatternAllowed("select", { level: "balanced" })).toBe(true);
    expect(isPatternAllowed("dragStart", { level: "balanced" })).toBe(true);
    expect(isPatternAllowed("like", { level: "balanced" })).toBe(true);
    expect(isPatternAllowed("tap", { level: "balanced" })).toBe(false);
    expect(isPatternAllowed("sheetOpen", { level: "balanced" })).toBe(false);
    expect(isPatternAllowed("tap", { level: "rich" })).toBe(true);
    expect(isPatternAllowed("sheetOpen", { level: "rich" })).toBe(true);
  });

  test("kapatılan kategori düzeyden bağımsız susar; diğerleri etkilenmez", () => {
    const prefs = { level: "rich", categories: { games: false } };
    expect(isPatternAllowed("wrong", prefs)).toBe(false);
    expect(isPatternAllowed("win", prefs)).toBe(false);
    expect(isPatternAllowed("success", prefs)).toBe(true);
    expect(isPatternAllowed("select", prefs)).toBe(true);
  });

  test("bilinmeyen desen ve bozuk düzey güvenli davranır", () => {
    expect(isPatternAllowed("yok-boyle", { level: "rich" })).toBe(false);
    expect(isPatternAllowed("select", { level: "çılgın" })).toBe(true); // varsayılan balanced
  });

  test("kategori haritası normalize/doğrulama", () => {
    expect(normalizeCategories(null)).toEqual(Object.fromEntries(HAPTIC_CATEGORIES.map((id) => [id, true])));
    expect(normalizeCategories({ social: false, junk: 1 }).social).toBe(false);
    expect(isHapticCategoryMap({ social: false })).toBe(true);
    expect(isHapticCategoryMap({ social: "no" })).toBe(false);
    expect(isHapticCategoryMap({ hacker: true })).toBe(false);
    expect(isHapticCategoryMap([])).toBe(false);
  });
});

describe("iOS çözümlemesi", () => {
  test("normal güçte atomlar UIKit üreteçlerine birebir gider", () => {
    expect(resolvePattern("select", { platform: "ios" }).steps).toEqual([{ at: 0, call: { kind: "selection" } }]);
    expect(resolvePattern("press", { platform: "ios" }).steps[0].call).toEqual({ kind: "impact", style: "medium" });
    expect(resolvePattern("error", { platform: "ios" }).steps[0].call).toEqual({ kind: "notification", type: "error" });
  });

  test("çok adımlı desen zamanlamasını korur", () => {
    const { steps, duration } = resolvePattern("like", { platform: "ios" });
    expect(steps.map((s) => s.at)).toEqual([0, 90]);
    expect(steps.map((s) => s.call.style)).toEqual(["light", "medium"]);
    expect(duration).toBe(90);
  });

  test("güç kademesi darbe stilini kaydırır, bildirim türüne dokunmaz", () => {
    const style = (name, intensity) => resolvePattern(name, { platform: "ios", intensity }).steps[0].call;
    expect(style("press", "soft")).toEqual({ kind: "impact", style: "light" });
    expect(style("press", "strong")).toEqual({ kind: "impact", style: "heavy" });
    expect(style("select", "strong")).toEqual({ kind: "impact", style: "light" });
    expect(style("select", "soft")).toEqual({ kind: "selection" });
    expect(style("success", "strong")).toEqual({ kind: "notification", type: "success" });
  });
});

describe("Android çözümlemesi", () => {
  test("normal güçte performHapticFeedback zinciri + doğru yedek", () => {
    const call = (name) => resolvePattern(name, { platform: "android" }).steps[0].call;
    expect(call("select")).toEqual({ kind: "android", chain: ["segment-tick", "clock-tick"], fallback: null });
    expect(call("press")).toEqual({ kind: "android", chain: ["long-press"], fallback: { kind: "impact", style: "medium" } });
    expect(call("success")).toEqual({ kind: "android", chain: ["confirm"], fallback: { kind: "notification", type: "success" } });
    expect(call("toggleOn").chain).toEqual(["toggle-on", "virtual-key"]);
  });

  test("soft güç zinciri bir kademe hafifletir", () => {
    const chain = (name) => resolvePattern(name, { platform: "android", intensity: "soft" }).steps[0].call.chain;
    expect(chain("select")[0]).toBe("segment-frequent-tick");
    expect(chain("press")).toEqual(["virtual-key"]);
    expect(chain("success")).toEqual(["confirm"]); // sonuç efektleri değişmez
  });

  test("strong güç tek bir dalga formu üretir", () => {
    const r = resolvePattern("like", { platform: "android", intensity: "strong" });
    expect(r.mode).toBe("waveform");
    // tap(12) @0, click(18) @90 → [0,12, 78,18]
    expect(r.pattern).toEqual([0, 12, 78, 18]);
  });

  test("dalga formu çok darbeli atomları ve çakışmaları düzgün birleştirir", () => {
    expect(buildWaveform([["success", 0]])).toEqual([0, 22, 70, 30]);
    // ikinci atom birincinin içine düşerse birleşir
    expect(buildWaveform([["thud", 0], ["tap", 10]])).toEqual([0, 32]);
    for (const name of HAPTIC_PATTERN_NAMES) {
      const wf = resolvePattern(name, { platform: "android", intensity: "strong" }).pattern;
      expect(wf.length % 2).toBe(0);
      wf.forEach((ms) => expect(ms).toBeGreaterThanOrEqual(0));
      for (let i = 1; i < wf.length; i += 2) expect(wf[i]).toBeGreaterThan(0);
    }
  });
});

test("eski çağrıların desen karşılığı", () => {
  expect(patternForLegacy("selection")).toBe("select");
  expect(patternForLegacy("impact", "light")).toBe("tap");
  expect(patternForLegacy("impact", "soft")).toBe("tap");
  expect(patternForLegacy("impact", "medium")).toBe("press");
  expect(patternForLegacy("impact", "rigid")).toBe("press");
  expect(patternForLegacy("impact", "heavy")).toBe("pressHeavy");
  expect(patternForLegacy("notification", "warning")).toBe("warning");
  expect(patternForLegacy("notification", "error")).toBe("error");
  expect(patternForLegacy("notification", "success")).toBe("success");
});
