// utils/decorLayout.js — tohumlu desen + yoğunluk çözümleme.

const {
  AMBIENT_DENSITY_BLOBS,
  AMBIENT_OPACITY_MIN,
  DECOR_DENSITIES,
  ICON_DENSITY_GRIDS,
  ICON_SEED_SALT,
  AMBIENT_SEED_SALT,
  buildIconLayout,
  clampAmbientOpacity,
  deriveSeed,
  isValidSeed,
  newDecorSeed,
  normalizeDensity,
  resolveAmbientBlobCount,
  resolveIconGrid,
  seededRandom,
} = require("../utils/decorLayout");
const { getEffectPreset } = require("../utils/deviceTier");
const { buildAmbientBlobs } = require("../utils/ambientBackground");
const { Keys } = require("../services/storage/registry");

const SCREEN = { width: 390, height: 844, iconCount: 174 };

describe("tohum", () => {
  test("aynı tohum aynı diziyi verir, farklı tohum farklı", () => {
    const a = seededRandom(12345);
    const b = seededRandom(12345);
    const c = seededRandom(54321);
    const seqA = Array.from({ length: 20 }, a);
    expect(Array.from({ length: 20 }, b)).toEqual(seqA);
    expect(Array.from({ length: 20 }, c)).not.toEqual(seqA);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test("yeni tohum hiçbir zaman 0 değil ve geçerli", () => {
    expect(isValidSeed(newDecorSeed(() => 0))).toBe(true);
    expect(isValidSeed(newDecorSeed(() => 0.999999999))).toBe(true);
    expect(isValidSeed(0)).toBe(false);
    expect(isValidSeed(1.5)).toBe(false);
  });

  test("ikon ve ambiyans alt tohumları ayrı (biri değişince öteki oynamaz)", () => {
    expect(deriveSeed(42, ICON_SEED_SALT)).not.toBe(deriveSeed(42, AMBIENT_SEED_SALT));
    expect(deriveSeed(42, ICON_SEED_SALT)).toBe(deriveSeed(42, ICON_SEED_SALT));
    expect(isValidSeed(deriveSeed(0, 0))).toBe(true);
  });

  test("tohum kaydı registry'de: varsayılan 0 (henüz üretilmedi)", () => {
    expect(Keys.decorSeed.default).toBe(0);
    expect(Keys.decorSeed.validate(0)).toBe(true);
    expect(Keys.decorSeed.validate(newDecorSeed())).toBe(true);
  });
});

describe("ikon yerleşimi", () => {
  const layout = (seed, grid) =>
    buildIconLayout(seededRandom(deriveSeed(seed, ICON_SEED_SALT)), { ...grid, ...SCREEN });

  test("aynı tohum + ızgara → birebir aynı desen (her ekranda/açılışta)", () => {
    expect(layout(7, { cols: 4, rows: 7 })).toEqual(layout(7, { cols: 4, rows: 7 }));
    expect(layout(7, { cols: 4, rows: 7 })).not.toEqual(layout(8, { cols: 4, rows: 7 }));
  });

  test("öğe sayısı = sütun × satır; her öğe kendi hücresinde ve ekranın içinde", () => {
    for (const { cols, rows } of Object.values(ICON_DENSITY_GRIDS)) {
      const items = layout(99, { cols, rows });
      expect(items).toHaveLength(cols * rows);
      const cellW = SCREEN.width / cols;
      const cellH = SCREEN.height / rows;
      items.forEach((it, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        expect(it.left).toBeGreaterThanOrEqual(c * cellW - 0.1);
        expect(it.left + it.size).toBeLessThanOrEqual((c + 1) * cellW + 0.2);
        expect(it.top).toBeGreaterThanOrEqual(r * cellH - 0.1);
        expect(it.top + it.size).toBeLessThanOrEqual((r + 1) * cellH + 0.2);
        expect(Number.isInteger(it.imgIndex)).toBe(true);
        expect(it.imgIndex).toBeGreaterThanOrEqual(0);
        expect(it.imgIndex).toBeLessThan(SCREEN.iconCount);
      });
    }
  });
});

describe("yoğunluk", () => {
  test("basamaklar ve bilinmeyen değer 'auto'ya düşer", () => {
    expect(DECOR_DENSITIES).toEqual(["auto", "low", "medium", "high"]);
    expect(normalizeDensity("nope")).toBe("auto");
    expect(normalizeDensity(undefined)).toBe("auto");
  });

  test("ikon: sabit basamaklar artan, 'auto' efekt modunu izler", () => {
    const n = (g) => g.cols * g.rows;
    expect(n(ICON_DENSITY_GRIDS.low)).toBeLessThan(n(ICON_DENSITY_GRIDS.medium));
    expect(n(ICON_DENSITY_GRIDS.medium)).toBeLessThan(n(ICON_DENSITY_GRIDS.high));
    for (const mode of ["full", "balanced", "off"]) {
      const preset = getEffectPreset(mode);
      expect(resolveIconGrid("auto", preset)).toEqual({
        cols: preset.iconBackgroundCols,
        rows: preset.iconBackgroundRows,
      });
      // Açık seçim efekt modundan bağımsız.
      expect(resolveIconGrid("high", preset)).toEqual(ICON_DENSITY_GRIDS.high);
    }
  });

  test("ambiyans: leke sayısı 1..5, 'auto' efekt modunu izler", () => {
    expect(AMBIENT_DENSITY_BLOBS.low).toBeLessThan(AMBIENT_DENSITY_BLOBS.medium);
    expect(AMBIENT_DENSITY_BLOBS.medium).toBeLessThan(AMBIENT_DENSITY_BLOBS.high);
    expect(AMBIENT_DENSITY_BLOBS.high).toBeLessThanOrEqual(5);
    expect(resolveAmbientBlobCount("auto", getEffectPreset("full"))).toBe(
      getEffectPreset("full").ambientBlobCount,
    );
    expect(resolveAmbientBlobCount("low", getEffectPreset("full"))).toBe(AMBIENT_DENSITY_BLOBS.low);
  });

  test("ambiyans renkleri tohumdan: aynı tohum aynı palet", () => {
    const blobs = (seed) => buildAmbientBlobs(seededRandom(deriveSeed(seed, AMBIENT_SEED_SALT)), 5);
    expect(blobs(3).map((b) => b.color)).toEqual(blobs(3).map((b) => b.color));
    expect(blobs(3).map((b) => b.color)).not.toEqual(blobs(4).map((b) => b.color));
  });

  test("ambiyans saydamlığı [min, 1] aralığına sıkışır; registry aynı sınırı kullanır", () => {
    expect(clampAmbientOpacity(0)).toBe(AMBIENT_OPACITY_MIN);
    expect(clampAmbientOpacity(5)).toBe(1);
    expect(clampAmbientOpacity("x")).toBe(1);
    expect(Keys.ambientOpacity.validate(AMBIENT_OPACITY_MIN)).toBe(true);
    expect(Keys.ambientOpacity.validate(AMBIENT_OPACITY_MIN - 0.01)).toBe(false);
    expect(Keys.iconBackgroundDensity.default).toBe("auto");
    expect(Keys.ambientDensity.default).toBe("auto");
  });
});
