import {
  BASE_ANGLE,
  BOX_UNITS,
  LENS,
  LOADER_SIZES,
  PHASE,
  angleAt,
  apartAt,
  discScaleAt,
  eyeAt,
  eyeScaleFor,
  pupilAt,
  reachAt,
  resolveLoaderSize,
  sampleLoop,
  sepAt,
} from "../utils/lensLoaderMotion";

const grid = (n = 2000) => Array.from({ length: n + 1 }, (_, i) => i / n);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

describe("lensLoaderMotion", () => {
  test("döngü Lens işaretiyle başlar ve biter (dikiş yok)", () => {
    for (const x of [0, 1]) {
      expect(near(sepAt(x), LENS.d, 1e-3)).toBe(true);
      expect(near(discScaleAt(x), 1, 1e-3)).toBe(true);
      const [along, across] = eyeAt(x);
      expect(near(along, 1, 1e-2)).toBe(true);
      expect(near(across, 1, 1e-2)).toBe(true);
      expect(pupilAt(x)).toBeGreaterThan(0.98);
    }
    // Açı: -90 → 270 (aynı poz)
    expect(angleAt(0)).toBe(BASE_ANGLE);
    expect(near(angleAt(1), BASE_ANGLE + 360)).toBe(true);
  });

  test("ayrık evrede göz tamamen kapanır, bebek görünmez", () => {
    const mid = (PHASE.splitEnd + PHASE.merge) / 2;
    expect(apartAt(mid)).toBe(1);
    expect(eyeAt(mid)).toEqual([0, 0]);
    expect(pupilAt(mid)).toBe(0);
  });

  test("daireler dönerken kutudan (2r + d) taşmaz", () => {
    for (const x of grid()) expect(reachAt(x)).toBeLessThanOrEqual(BOX_UNITS / 2 + 1e-9);
  });

  test("ayrılık ve ölçek sürekli (ani sıçrama yok)", () => {
    const xs = grid();
    for (let i = 1; i < xs.length; i += 1) {
      expect(Math.abs(sepAt(xs[i]) - sepAt(xs[i - 1]))).toBeLessThan(4);
      expect(Math.abs(discScaleAt(xs[i]) - discScaleAt(xs[i - 1]))).toBeLessThan(0.02);
      expect(Math.abs(angleAt(xs[i]) - angleAt(xs[i - 1]))).toBeLessThan(2);
    }
  });

  test("kesişim ölçeği: son ayrılıkta 1, temas ve ötesinde 0", () => {
    expect(eyeScaleFor(LENS.d)).toEqual([1, 1]);
    expect(eyeScaleFor(2 * LENS.r)).toEqual([0, 0]);
    expect(eyeScaleFor(400)).toEqual([0, 0]);
  });

  test("tablo evre sınırlarını içerir ve sıralıdır", () => {
    const { inputRange, outputRange } = sampleLoop(sepAt);
    Object.values(PHASE).forEach((x) => expect(inputRange).toContain(x));
    expect(inputRange[0]).toBe(0);
    expect(inputRange[inputRange.length - 1]).toBe(1);
    for (let i = 1; i < inputRange.length; i += 1) expect(inputRange[i]).toBeGreaterThan(inputRange[i - 1]);
    expect(outputRange).toHaveLength(inputRange.length);
  });

  test("boy: ActivityIndicator adları + sayı", () => {
    expect(resolveLoaderSize("small")).toBe(LOADER_SIZES.small);
    expect(resolveLoaderSize("large")).toBe(LOADER_SIZES.large);
    expect(resolveLoaderSize(undefined)).toBe(LOADER_SIZES.small);
    expect(resolveLoaderSize(52)).toBe(52);
    expect(resolveLoaderSize(-3)).toBe(LOADER_SIZES.small);
  });
});
