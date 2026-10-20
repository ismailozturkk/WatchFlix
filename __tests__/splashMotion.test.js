import fs from "fs";
import path from "path";
import {
  EXIT_GUARD_MS,
  EXIT_MS,
  FIRST_RING_RADIUS,
  GLOW_SIZE,
  INTRO_MS,
  LOGO_SIZE,
  MAX_RING_COUNT,
  MIN_VISIBLE_MS,
  NATIVE_SPLASH_BG,
  ORBIT_MS,
  ORBIT_SWEEP_DEG,
  RING_STEP,
  STATIC_LEVEL,
  TILE_H,
  TILE_W,
  bloomOpacityTable,
  bloomScaleTable,
  bloomWindow,
  breathTable,
  buildRings,
  ease,
  exitBackdropTable,
  exitGlowOpacityTable,
  exitGlowScaleTable,
  exitLogoOpacityTable,
  exitLogoScaleTable,
  exitRingOpacityTable,
  exitRingScaleTable,
  glowOpacityTable,
  glowPeakAlpha,
  glowScaleTable,
  logoPulseTable,
  orbitDirection,
  orbitTable,
  ringPeakOpacity,
  sampleCurve,
  veilTable,
  waveOpacityTable,
  waveScaleTable,
} from "../utils/splashMotion";

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

// RN'in interpolate'inin davranışı: doğrusal parçalar, istenirse uçlarda sabit.
function evalTable({ inputRange, outputRange }, x, clamp = true) {
  if (clamp) x = Math.min(inputRange[inputRange.length - 1], Math.max(inputRange[0], x));
  for (let i = 1; i < inputRange.length; i++) {
    if (x <= inputRange[i]) {
      const span = inputRange[i] - inputRange[i - 1];
      if (span === 0) return outputRange[i];
      const t = (x - inputRange[i - 1]) / span;
      return outputRange[i - 1] + (outputRange[i] - outputRange[i - 1]) * t;
    }
  }
  return outputRange[outputRange.length - 1];
}

const first = (t) => t.outputRange[0];
const last = (t) => t.outputRange[t.outputRange.length - 1];

const RINGS = [0, 1, 2, MAX_RING_COUNT - 1];

function everyTable() {
  const tables = [];
  for (const flat of [false, true]) {
    for (const ring of RINGS) {
      tables.push(
        ["bloomScale", ring, flat, bloomScaleTable(ring, flat)],
        ["exitRingScale", ring, flat, exitRingScaleTable(ring, flat)],
      );
    }
    tables.push(
      ["glowScale", 0, flat, glowScaleTable(flat)],
      ["exitLogoScale", 0, flat, exitLogoScaleTable(flat)],
      ["exitGlowScale", 0, flat, exitGlowScaleTable(flat)],
    );
  }
  for (const ring of RINGS) {
    tables.push(
      ["waveScale", ring, false, waveScaleTable(ring / 3)],
      ["waveOpacity", ring, false, waveOpacityTable(ring / 3)],
      ["bloomOpacity", ring, false, bloomOpacityTable(ring)],
      ["bloomOpacityStatic", ring, false, bloomOpacityTable(ring, STATIC_LEVEL)],
      ["exitRingOpacity", ring, false, exitRingOpacityTable(ring)],
    );
  }
  tables.push(
    ["logoPulse", 0, false, logoPulseTable()],
    ["breath", 0, false, breathTable(0.1)],
    ["veil", 0, false, veilTable()],
    ["glowOpacity", 0, false, glowOpacityTable()],
    ["glowOpacityLight", 0, false, glowOpacityTable(glowPeakAlpha(true))],
    ["exitLogoOpacity", 0, false, exitLogoOpacityTable()],
    ["exitGlowOpacity", 0, false, exitGlowOpacityTable()],
    ["exitBackdrop", 0, false, exitBackdropTable()],
  );
  return tables;
}

describe("splash motion tables", () => {
  test("every table is a valid native interpolation (monotonic input, finite numbers, same length)", () => {
    for (const [name, ring, flat, table] of everyTable()) {
      const label = `${name} ring=${ring} flat=${flat}`;
      expect({ label, same: table.inputRange.length === table.outputRange.length }).toEqual({
        label,
        same: true,
      });
      expect(table.inputRange.length).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < table.inputRange.length; i++) {
        expect(Number.isFinite(table.inputRange[i])).toBe(true);
        expect(Number.isFinite(table.outputRange[i])).toBe(true);
        if (i > 0) {
          expect({ label, ok: table.inputRange[i] >= table.inputRange[i - 1] }).toEqual({
            label,
            ok: true,
          });
        }
      }
      // Giriş/çıkış sürücüsü [0,1]; tablo dışına taşmamalı.
      expect(table.inputRange[0]).toBeGreaterThanOrEqual(0);
      expect(table.inputRange[table.inputRange.length - 1]).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  test("first frame matches the native splash: only the logo is visible, at scale 1", () => {
    // Giriş sürücüsü 0'dayken (JS donmuşken de) ekran = koyu zemin + logo.
    for (const ring of RINGS) {
      expect(evalTable(bloomOpacityTable(ring), 0)).toBe(0);
      expect(evalTable(bloomOpacityTable(ring, STATIC_LEVEL), 0)).toBe(0);
    }
    expect(evalTable(veilTable(), 0)).toBe(0);
    expect(evalTable(glowOpacityTable(), 0)).toBe(0);
    expect(evalTable(logoPulseTable(), 0)).toBe(1);
    expect(evalTable(breathTable(0.035), 0)).toBe(1);
    expect(evalTable(exitLogoOpacityTable(), 0)).toBe(1);
    expect(evalTable(exitLogoScaleTable(), 0)).toBe(1);
    expect(evalTable(exitBackdropTable(), 0)).toBe(1);
  });

  test("intro settles: rings bloom to scale 1 at their peak opacity, veil and glow fully in", () => {
    for (const ring of RINGS) {
      expect(last(bloomScaleTable(ring))).toBeCloseTo(1, 10);
      expect(last(bloomOpacityTable(ring))).toBeCloseTo(ringPeakOpacity(ring), 10);
      // Dalgasız kademede poster sabit, tepenin STATIC_LEVEL kesrinde oturur.
      expect(last(bloomOpacityTable(ring, STATIC_LEVEL))).toBeCloseTo(ringPeakOpacity(ring) * STATIC_LEVEL, 10);
    }
    expect(last(veilTable())).toBe(1);
    expect(last(glowOpacityTable())).toBe(1);
    expect(last(glowOpacityTable(0.65))).toBeCloseTo(0.65, 10);
    expect(last(glowScaleTable())).toBe(1);
    expect(evalTable(logoPulseTable(), 1)).toBeCloseTo(1, 10);
  });

  test("exit ends fully transparent, leaving the app visible", () => {
    for (const ring of RINGS) {
      expect(evalTable(exitRingOpacityTable(ring), 1)).toBe(0);
    }
    expect(evalTable(exitLogoOpacityTable(), 1)).toBe(0);
    expect(evalTable(exitGlowOpacityTable(), 1)).toBe(0);
    expect(evalTable(exitBackdropTable(), 1)).toBe(0);
  });

  test("backdrop opens last: content is gone before the app shows through", () => {
    const backdrop = exitBackdropTable();
    for (const t of [0, 0.1, 0.25]) expect(evalTable(backdrop, t)).toBe(1);
    // Backdrop yarı saydam olduğunda logo/ışıma zaten (neredeyse) çözülmüş olmalı.
    let halfOpen = 0;
    while (evalTable(backdrop, halfOpen) > 0.5) halfOpen += 0.01;
    expect(evalTable(exitLogoOpacityTable(), halfOpen)).toBeLessThan(0.1);
    expect(evalTable(exitGlowOpacityTable(), halfOpen)).toBeLessThan(0.25);
  });

  test("exit moves outward and is monotonic (rings grow, content fades, never reverses)", () => {
    const steps = 40;
    const samples = (fn) => Array.from({ length: steps + 1 }, (_, i) => fn(i / steps));
    const nonDecreasing = (a) => a.every((v, i) => i === 0 || v >= a[i - 1] - 1e-9);
    const nonIncreasing = (a) => a.every((v, i) => i === 0 || v <= a[i - 1] + 1e-9);
    for (const ring of RINGS) {
      expect(nonDecreasing(samples((t) => evalTable(exitRingScaleTable(ring), t)))).toBe(true);
      expect(nonIncreasing(samples((t) => evalTable(exitRingOpacityTable(ring), t)))).toBe(true);
    }
    expect(nonDecreasing(samples((t) => evalTable(exitLogoScaleTable(), t)))).toBe(true);
    expect(nonIncreasing(samples((t) => evalTable(exitLogoOpacityTable(), t)))).toBe(true);
    expect(nonDecreasing(samples((t) => evalTable(exitGlowScaleTable(), t)))).toBe(true);
    expect(nonIncreasing(samples((t) => evalTable(exitGlowOpacityTable(), t)))).toBe(true);
    expect(nonIncreasing(samples((t) => evalTable(exitBackdropTable(), t)))).toBe(true);
  });

  test("inner rings dissolve before outer rings (exit reads as moving through the field)", () => {
    for (let ring = 1; ring < 4; ring++) {
      const inner = exitRingOpacityTable(ring - 1);
      const outer = exitRingOpacityTable(ring);
      expect(outer.inputRange[0]).toBeGreaterThan(inner.inputRange[0]);
      for (const t of [0.3, 0.5, 0.7]) {
        expect(evalTable(outer, t)).toBeGreaterThanOrEqual(evalTable(inner, t));
      }
    }
  });

  test("looping tables have no seam: value at 0 equals value at 1", () => {
    for (const ring of RINGS) {
      const phase = ring / 3;
      expect(evalTable(waveScaleTable(phase), 0)).toBeCloseTo(evalTable(waveScaleTable(phase), 1), 10);
      expect(evalTable(waveOpacityTable(phase), 0)).toBeCloseTo(evalTable(waveOpacityTable(phase), 1), 10);
    }
    for (const amp of [0.035, 0.1]) {
      expect(evalTable(breathTable(amp), 0)).toBeCloseTo(evalTable(breathTable(amp), 1), 10);
    }
  });

  test("wave crest travels outward: each ring peaks later than the one inside it", () => {
    const ringCount = 3;
    const peakAt = (ring) => {
      const table = waveOpacityTable(ring / ringCount);
      let best = 0;
      let bestT = 0;
      for (let i = 0; i <= 200; i++) {
        const v = evalTable(table, i / 200);
        if (v > best + 1e-9) {
          best = v;
          bestT = i / 200;
        }
      }
      return bestT;
    };
    expect(peakAt(1)).toBeGreaterThan(peakAt(0));
    expect(peakAt(2)).toBeGreaterThan(peakAt(1));
  });

  test("rings keep a dim resting state and brighten on the crest", () => {
    const table = waveOpacityTable(0);
    expect(Math.min(...table.outputRange)).toBeGreaterThan(0);
    expect(Math.min(...table.outputRange)).toBeLessThan(0.3);
    expect(Math.max(...table.outputRange)).toBeCloseTo(1, 1);
  });

  test("outer rings stay dimmer than inner rings (depth)", () => {
    for (let ring = 1; ring < 4; ring++) {
      expect(ringPeakOpacity(ring)).toBeLessThan(ringPeakOpacity(ring - 1));
    }
    expect(ringPeakOpacity(0)).toBe(1);
  });

  test("bloom has a gentle overshoot but never explodes", () => {
    for (const ring of RINGS) {
      const t = bloomScaleTable(ring);
      expect(Math.max(...t.outputRange)).toBeGreaterThan(1);
      expect(Math.max(...t.outputRange)).toBeLessThan(1.08);
      expect(first(t)).toBeLessThan(1);
    }
  });

  test("flat tables (low tier / reduced motion) hold scale 1 everywhere", () => {
    for (const ring of RINGS) {
      expect(new Set(bloomScaleTable(ring, true).outputRange)).toEqual(new Set([1]));
      expect(new Set(exitRingScaleTable(ring, true).outputRange)).toEqual(new Set([1]));
    }
    expect(new Set(glowScaleTable(true).outputRange)).toEqual(new Set([1]));
    expect(new Set(exitLogoScaleTable(true).outputRange)).toEqual(new Set([1]));
    expect(new Set(exitGlowScaleTable(true).outputRange)).toEqual(new Set([1]));
  });
});

describe("splash orbit (bounded, upright posters)", () => {
  const degrees = (table) => table.outputRange.map((v) => parseFloat(v));

  test("rotation strings are valid for native interpolation (same unit pattern, finite)", () => {
    for (const dir of [1, -1]) {
      for (const counter of [false, true]) {
        const table = orbitTable(dir, counter);
        expect(table.inputRange[0]).toBe(0);
        expect(table.inputRange[table.inputRange.length - 1]).toBe(1);
        for (const value of table.outputRange) expect(value).toMatch(/^-?\d+\.\d{4}deg$/);
      }
    }
  });

  test("starts at rest, sweeps exactly ORBIT_SWEEP_DEG, and then STOPS (never spins forever)", () => {
    const d = degrees(orbitTable(1));
    expect(d[0]).toBe(0);
    expect(d[d.length - 1]).toBeCloseTo(ORBIT_SWEEP_DEG, 3);
    expect(d.every((v, i) => i === 0 || v >= d[i - 1])).toBe(true); // geri dönmez
    // Yavaşlayarak durur: son adım ilk adımdan küçük.
    expect(d[d.length - 1] - d[d.length - 2]).toBeLessThan(d[1] - d[0]);
    expect(ORBIT_MS).toBeGreaterThanOrEqual(5000);
    expect(ORBIT_SWEEP_DEG).toBeLessThanOrEqual(45);
  });

  test("container and poster rotations cancel at every sample (posters stay upright)", () => {
    for (const dir of [1, -1]) {
      const container = degrees(orbitTable(dir));
      const poster = degrees(orbitTable(dir, true));
      container.forEach((v, i) => expect(v + poster[i]).toBeCloseTo(0, 3));
    }
  });

  test("neighbouring rings orbit in opposite directions", () => {
    for (let ring = 1; ring < MAX_RING_COUNT; ring++) {
      expect(orbitDirection(ring)).toBe(-orbitDirection(ring - 1));
      expect(Math.sign(degrees(orbitTable(orbitDirection(ring)))[3])).toBe(-Math.sign(degrees(orbitTable(orbitDirection(ring - 1)))[3]));
    }
  });
});

describe("splash timeline", () => {
  test("the visible floor covers the whole bloom, so the exit never cuts it", () => {
    // Üretilebilecek en dış halka dahil hepsinin çiçeklenmesi taban süre içinde bitmeli.
    for (let ring = 0; ring < MAX_RING_COUNT; ring++) {
      expect(bloomWindow(ring).end * INTRO_MS).toBeLessThanOrEqual(MIN_VISIBLE_MS);
      expect(bloomWindow(ring).end).toBeLessThanOrEqual(1);
    }
  });

  test("rings bloom in order, centre first", () => {
    for (let ring = 1; ring < MAX_RING_COUNT; ring++) {
      expect(bloomWindow(ring).start).toBeGreaterThan(bloomWindow(ring - 1).start);
    }
  });

  test("durations are sane (no accidental multi-second splash)", () => {
    expect(MIN_VISIBLE_MS).toBeLessThanOrEqual(1000);
    expect(INTRO_MS).toBeLessThanOrEqual(1200);
    expect(EXIT_MS).toBeGreaterThanOrEqual(300);
    expect(EXIT_MS).toBeLessThanOrEqual(700);
    // Çıkış güvencesi gerçek çıkıştan sonra devreye girmeli, ondan önce değil.
    expect(EXIT_GUARD_MS).toBeGreaterThan(0);
  });

  test("easing helpers hit their endpoints", () => {
    for (const [name, fn] of Object.entries(ease)) {
      // `name` mesajı bozulan easing'i gösterir; -0 / 0 ayrımı toBeCloseTo'da yok.
      expect([name, Math.abs(fn(0)) < 1e-9]).toEqual([name, true]);
      expect([name, Math.abs(fn(1) - 1) < 1e-9]).toEqual([name, true]);
    }
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => ease.outBack(i / 49)))).toBeGreaterThan(1);
  });

  test("sampleCurve interpolates a range with the requested easing", () => {
    const t = sampleCurve({ from: 0.2, to: 0.6, a: 10, b: 20, easing: ease.linear, samples: 4 });
    expect(t.inputRange).toEqual([0.2, 0.3, 0.4, 0.5, 0.6].map((v) => expect.closeTo(v, 10)));
    expect(t.outputRange).toEqual([10, 12.5, 15, 17.5, 20].map((v) => expect.closeTo(v, 10)));
  });
});

describe("splash ring geometry (screen-centre relative)", () => {
  test("phones get three rings, big phones and tablets four", () => {
    expect(buildRings(390, 844)).toHaveLength(3);
    expect(buildRings(375, 667)).toHaveLength(3);
    expect(buildRings(430, 932)).toHaveLength(4);
    expect(buildRings(820, 1180)).toHaveLength(MAX_RING_COUNT);
  });

  test("maxRings caps the count but never removes the first ring", () => {
    expect(buildRings(820, 1180, 2)).toHaveLength(2);
    expect(buildRings(820, 1180, 1)).toHaveLength(1);
    expect(buildRings(320, 480, 4).length).toBeGreaterThanOrEqual(1);
    expect(buildRings(820, 1180, 99)).toHaveLength(MAX_RING_COUNT);
  });

  test("every tile sits exactly on its ring circle around the centre", () => {
    for (const { radius, tiles } of buildRings(390, 844)) {
      for (const tile of tiles) {
        expect(Math.hypot(tile.dx, tile.dy)).toBeCloseTo(radius, 6);
      }
    }
  });

  test("geometry does not depend on the screen size beyond the ring count (no relayout needed)", () => {
    const small = buildRings(360, 800);
    const large = buildRings(390, 844);
    for (let i = 0; i < Math.min(small.length, large.length); i++) {
      expect(small[i].tiles).toEqual(large[i].tiles);
    }
  });

  test("rings are concentric and radially separated by at least one tile height", () => {
    const rings = buildRings(390, 844);
    expect(rings[0].radius).toBe(FIRST_RING_RADIUS);
    for (let i = 1; i < rings.length; i++) {
      expect(rings[i].radius - rings[i - 1].radius).toBe(RING_STEP);
      expect(RING_STEP).toBeGreaterThanOrEqual(TILE_H);
    }
  });

  test("tiles of one ring never overlap, at any orbit angle", () => {
    for (const { radius, tiles } of buildRings(390, 844)) {
      // Komşu merkezler arası kiriş ≥ poster genişliği.
      const chord = 2 * radius * Math.sin(Math.PI / tiles.length);
      expect(chord).toBeGreaterThanOrEqual(TILE_W);
    }
  });

  test("ring 0 clears the logo: nearest poster edge is outside the visible mark", () => {
    // Görünür "S" kutunun ~%45'i; yarı yüksekliği ışımayla birlikte ilk halkanın iç kenarından içeride kalmalı.
    const innerEdge = FIRST_RING_RADIUS - TILE_H / 2;
    const visibleHalfHeight = LOGO_SIZE * 0.45 * 0.5;
    expect(innerEdge).toBeGreaterThan(visibleHalfHeight);
  });
});

describe("native splash handoff", () => {
  const appJson = JSON.parse(read("app.json"));
  const splashPlugin = appJson.expo.plugins.find(
    (p) => Array.isArray(p) && p[0] === "expo-splash-screen",
  );
  const config = splashPlugin[1];

  test("JS splash starts on the exact colour of the native splash", () => {
    expect(config.backgroundColor.toLowerCase()).toBe(NATIVE_SPLASH_BG.toLowerCase());
  });

  test("native iOS logo width equals the JS logo box, so the handoff does not jump", () => {
    expect(config.ios.imageWidth).toBe(LOGO_SIZE);
  });

  test("the logo is the same artwork on both sides of the handoff", () => {
    // JS tarafı useAppLogo → varsayılan simgenin foreground'u; yerel splash da aynı dosya.
    expect(config.image).toBe("./assets/icon_default/android-icon-foreground.png");
    expect(read("components/appLogoSources.js")).toContain("icon_default/android-icon-foreground.png");
  });
});

describe("glow", () => {
  test("glow is more subtle on light backgrounds, never stronger than the baked image", () => {
    expect(glowPeakAlpha(true)).toBeLessThan(glowPeakAlpha(false));
    expect(glowPeakAlpha(false)).toBeLessThanOrEqual(1);
    expect(glowPeakAlpha(true)).toBeGreaterThan(0);
  });

  test("glow box is larger than the logo box (the halo extends past the mark)", () => {
    expect(GLOW_SIZE).toBeGreaterThan(LOGO_SIZE);
  });
});

describe("SplashPosterWave source guards", () => {
  const src = read("components/SplashPosterWave.js");
  // Açıklama satırları sayılmasın (yorumlarda aynı ifadeler geçiyor).
  const code = src
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

  test("every Animated.timing is native and stays out of InteractionManager", () => {
    // isInteraction:false şart: sonsuz döngü InteractionManager'ı meşgul tutar ve
    // runAfterInteractions'a bağlı açılış işleri (useStartupGate) hiç başlamaz.
    const timings = code.match(/Animated\.timing\(/g) || [];
    expect(timings.length).toBeGreaterThanOrEqual(4); // giriş, döngüler, yörünge, çıkış
    expect((code.match(/isInteraction:\s*false/g) || []).length).toBe(timings.length);
    expect((code.match(/useNativeDriver:\s*true/g) || []).length).toBe(timings.length);
    expect(code).not.toMatch(/useNativeDriver:\s*false/);
  });

  test("opacity is applied per poster, never on the ring container", () => {
    // Yarı saydam kap Android'de 60+ posteri ekran dışı katmana çizdirir.
    const container = code.match(/<Animated\.View\s+key=\{ring\}[\s\S]*?>\s*\n/);
    expect(container).not.toBeNull();
    expect(container[0]).not.toMatch(/opacity/);
  });

  test("posters are single native views: no wrapper View, no per-poster mask layer", () => {
    expect(code).toMatch(/<Animated\.Image\s+key=\{s\}/);
    expect(code).not.toMatch(/overflow:\s*["']hidden["']/);
    expect(code).not.toMatch(/expo-image/);
    expect(code).not.toMatch(/react-native-svg/);
  });

  test("no screen measurement: no onLayout, no layout state", () => {
    expect(code).not.toMatch(/onLayout/);
    expect(code).not.toMatch(/setLayout/);
  });

  test("Android image quirks are neutralised on every Animated.Image", () => {
    const images = code.match(/<Animated\.Image[\s\S]*?\/>/g) || [];
    expect(images.length).toBeGreaterThanOrEqual(3); // poster, ışıma, logo
    for (const image of images) expect(image).toMatch(/fadeDuration=\{0\}/);
    // Posterler görünüm boyutuna indirgenir (342×513 kaynak, 78×117 dp kutu).
    expect(images[0]).toMatch(/resizeMethod="resize"/);
  });

  test("exit does not touch the intro driver (continuity if exit starts mid-intro)", () => {
    const exitEffect = src.slice(src.indexOf("if (!exiting)"));
    expect(exitEffect.slice(0, 700)).not.toMatch(/Animated\.timing\(intro/);
  });

  test("the animated stage is wrapped by an error boundary with a SEPARATE static fallback", () => {
    expect(code).toMatch(/<SplashBoundary fallback=\{<StaticSplash/);
    expect(code).toMatch(/captureError\(/);
  });
});
