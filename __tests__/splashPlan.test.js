import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import { EFFECT_MODES, getEffectPreset } from "../utils/deviceTier";
import { GLOW_SIZE } from "../utils/splashMotion";
import {
  SPLASH_QUALITY,
  nativeViewCount,
  planSplash,
  splashQualityFor,
} from "../utils/splashPlan";

const root = path.join(__dirname, "..");
const SCREENS = [
  [360, 800],
  [375, 667],
  [390, 844],
  [430, 932],
  [820, 1180],
];

describe("splash quality tiers follow the user's effect mode", () => {
  test("every effect mode has a splash tier (a new mode cannot silently fall through)", () => {
    for (const mode of EFFECT_MODES) {
      expect(SPLASH_QUALITY[mode]).toBeDefined();
    }
    expect(Object.keys(SPLASH_QUALITY).sort()).toEqual([...EFFECT_MODES].sort());
  });

  test("unknown mode falls to the middle tier, same rule as the effect presets", () => {
    expect(splashQualityFor("???")).toBe(SPLASH_QUALITY.balanced);
    expect(splashQualityFor(undefined)).toBe(SPLASH_QUALITY.balanced);
    expect(getEffectPreset("???")).toBe(getEffectPreset("balanced"));
  });

  test("tiers are strictly ordered by continuous work: full ⊃ balanced ⊃ off", () => {
    const flags = ["orbit", "waveLoop", "waveScale", "glowMotion", "breath"];
    const on = (q) => flags.filter((f) => q[f]).length;
    const { full, balanced, off } = SPLASH_QUALITY;
    expect(on(full)).toBeGreaterThan(on(balanced));
    expect(on(balanced)).toBeGreaterThan(on(off));
    // Bir üst kademede kapalı olan hiçbir özellik alt kademede açık olmaz.
    for (const flag of flags) {
      if (!full[flag]) expect(balanced[flag]).toBe(false);
      if (!balanced[flag]) expect(off[flag]).toBe(false);
    }
    expect(full.maxRings).toBeGreaterThanOrEqual(balanced.maxRings);
    expect(balanced.maxRings).toBeGreaterThan(off.maxRings);
    expect(full.posterPool).toBeGreaterThanOrEqual(off.posterPool);
  });

  test("Off (the weak-device default) runs NO continuous animation", () => {
    const off = SPLASH_QUALITY.off;
    expect(off.orbit || off.waveLoop || off.waveScale || off.glowMotion || off.breath).toBe(false);
  });

  test("waveScale needs waveLoop (the scale node is driven by the wave driver)", () => {
    for (const quality of Object.values(SPLASH_QUALITY)) {
      if (quality.waveScale) expect(quality.waveLoop).toBe(true);
    }
  });

  test("reduced motion kills every continuous/scaled effect but keeps the mode's ring count", () => {
    for (const mode of EFFECT_MODES) {
      const still = splashQualityFor(mode, true);
      expect(still.orbit || still.waveLoop || still.waveScale || still.glowMotion || still.breath).toBe(false);
      expect(still.pulse || still.bloomScale).toBe(false);
      expect(still.maxRings).toBe(SPLASH_QUALITY[mode].maxRings);
      expect(still.posterPool).toBe(SPLASH_QUALITY[mode].posterPool);
    }
  });

  test("tiers are frozen (a stray mutation cannot degrade every later launch)", () => {
    expect(Object.isFrozen(SPLASH_QUALITY)).toBe(true);
    for (const quality of Object.values(SPLASH_QUALITY)) expect(Object.isFrozen(quality)).toBe(true);
    expect(Object.isFrozen(splashQualityFor("full", true))).toBe(true);
  });
});

describe("splash plan and view budget", () => {
  test("ring count never exceeds the tier's maxRings and the first ring always exists", () => {
    for (const [width, height] of SCREENS) {
      for (const mode of EFFECT_MODES) {
        const quality = splashQualityFor(mode);
        const plan = planSplash({ width, height, quality });
        expect(plan.ringCount).toBeGreaterThanOrEqual(1);
        expect(plan.ringCount).toBeLessThanOrEqual(quality.maxRings);
        expect(plan.tileCount).toBe(plan.rings.reduce((n, r) => n + r.tiles.length, 0));
      }
    }
  });

  test("reduced motion does not change the poster set (late accessibility info cannot rebuild it)", () => {
    for (const [width, height] of SCREENS) {
      for (const mode of EFFECT_MODES) {
        const normal = planSplash({ width, height, quality: splashQualityFor(mode) });
        // plan yalnız maxRings'e bakar; hareketi azalt maxRings'i değiştirmez
        const still = planSplash({ width, height, quality: splashQualityFor(mode, true) });
        expect(still).toEqual(normal);
      }
    }
  });

  test("native view budget on common phones (was 135 views before the single-view rewrite)", () => {
    const phone = (mode) => nativeViewCount(planSplash({ width: 390, height: 844, quality: splashQualityFor(mode) }));
    expect(phone("full")).toBeLessThanOrEqual(75);
    expect(phone("balanced")).toBeLessThanOrEqual(75);
    expect(phone("off")).toBeLessThanOrEqual(45);
    expect(phone("off")).toBeLessThan(phone("full"));
    // Eski yapı: 63 poster × (sarmalayıcı + resim) + kaplar + SVG = 135.
    expect(phone("full")).toBeLessThan(135 * 0.6);
  });

  test("the plan is deterministic (no randomness or time in layout)", () => {
    const a = planSplash({ width: 390, height: 844, quality: SPLASH_QUALITY.full });
    const b = planSplash({ width: 390, height: 844, quality: SPLASH_QUALITY.full });
    expect(a).toEqual(b);
  });
});

describe("glow asset (assets/splash-glow.png)", () => {
  const file = path.join(root, "assets", "splash-glow.png");
  const png = PNG.sync.read(fs.readFileSync(file));
  const at = (x, y) => {
    const i = (y * png.width + x) * 4;
    return { r: png.data[i], g: png.data[i + 1], b: png.data[i + 2], a: png.data[i + 3] };
  };
  const mid = Math.floor(png.width / 2);

  test("is small and square (a texture, not a full-size bitmap)", () => {
    expect(png.width).toBe(png.height);
    expect(png.width).toBeLessThanOrEqual(256);
    expect(fs.statSync(file).size).toBeLessThan(60 * 1024);
    // Gerildiği kutu (GLOW_SIZE) görselden büyük: yumuşak büyütme, keskin değil.
    expect(GLOW_SIZE).toBeGreaterThan(png.width);
  });

  test("is fully transparent at the corners/edges (no visible square)", () => {
    for (const [x, y] of [[0, 0], [png.width - 1, 0], [0, png.height - 1], [png.width - 1, png.height - 1]]) {
      expect(at(x, y).a).toBe(0);
    }
    for (let i = 0; i < png.width; i++) {
      expect(at(i, 0).a).toBe(0);
      expect(at(0, i).a).toBe(0);
      expect(at(png.width - 1, i).a).toBe(0);
      expect(at(i, png.height - 1).a).toBe(0);
    }
  });

  test("is strongest near the centre and falls off smoothly (no banding steps > 6 levels per pixel)", () => {
    const row = Array.from({ length: png.width }, (_, x) => at(x, mid).a);
    const peak = Math.max(...row);
    expect(peak).toBeGreaterThan(120);
    expect(Math.abs(row.indexOf(peak) - mid)).toBeLessThan(png.width * 0.2);
    for (let x = 1; x < row.length; x++) {
      expect(Math.abs(row[x] - row[x - 1])).toBeLessThanOrEqual(6);
    }
  });

  test("carries the logo palette: purple, blue and teal all contribute", () => {
    // Merkezin etrafında örnekle: ortalama renkte mavi baskın, mor ve turkuaz izi var.
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = mid - 30; y <= mid + 30; y += 6) {
      for (let x = mid - 30; x <= mid + 30; x += 6) {
        const p = at(x, y);
        if (p.a > 40) {
          r += p.r;
          g += p.g;
          b += p.b;
          n += 1;
        }
      }
    }
    expect(n).toBeGreaterThan(20);
    r /= n;
    g /= n;
    b /= n;
    expect(b).toBeGreaterThan(r); // mavi/turkuaz/mor üçü de mavi kanalı yüksek
    expect(b).toBeGreaterThan(150);
    expect(g).toBeGreaterThan(80); // turkuaz/mavi yeşil kanalı taşır
    expect(r).toBeGreaterThan(30); // mor kırmızı kanalı katar (saf mavi/turkuaz olsaydı ~40 altı)
  });

  test("is required exactly where it is rendered", () => {
    expect(fs.readFileSync(path.join(root, "components", "SplashPosterWave.js"), "utf8")).toContain(
      'require("../assets/splash-glow.png")',
    );
  });
});
