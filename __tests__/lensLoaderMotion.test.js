import {
  BASE_ANGLE,
  GEOM,
  GEOM_COMPACT,
  LOADER_SIZES,
  TOTAL_TURN,
  WAVE,
  angleAt,
  closeAt,
  fillSizeFor,
  screenScaleFor,
  posAt,
  reachAt,
  resolveLoaderSize,
  sampleLoop,
  tideAt,
  waveAt,
} from "../utils/lensLoaderMotion";

const grid = (n = 2000) => Array.from({ length: n + 1 }, (_, i) => i / n);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
// Camgöbeği merkezinin konumu (kutu oranı): eksen açısı + işaretli konum.
const cyanAt = (x) => {
  const a = (angleAt(x) * Math.PI) / 180;
  const r = posAt(x) * GEOM.amp;
  return [r * Math.cos(a), r * Math.sin(a)];
};

describe("lensLoaderMotion — iki karadelik", () => {
  test("döngü dikişsiz: 1'deki poz 0'dakiyle aynı (yer değiştirme + yarım tur)", () => {
    expect(posAt(0)).toBe(1);
    expect(posAt(1)).toBe(-1);
    expect(angleAt(0)).toBe(BASE_ANGLE);
    expect(near(angleAt(1), BASE_ANGLE + TOTAL_TURN, 1e-9)).toBe(true);
    expect(TOTAL_TURN % 360).toBe(180);
    const [x0, y0] = cyanAt(0);
    const [x1, y1] = cyanAt(1);
    expect(near(x0, x1, 1e-9) && near(y0, y1, 1e-9)).toBe(true);
    expect(y0).toBeLessThan(0); // camgöbeği üstte başlar
  });

  test("yavaş yaklaşır, ortada hızlı geçer, yavaşlayarak uzaklaşır", () => {
    const speed = (x, h = 0.005) => Math.abs(posAt(x + h) - posAt(x - h)) / (2 * h);
    expect(speed(0.5)).toBeGreaterThan(5 * speed(0.06));
    expect(speed(0.5)).toBeGreaterThan(5 * speed(0.94));
    expect(speed(0.3)).toBeGreaterThan(speed(0.1)); // giderek hızlanır
    expect(speed(0.9)).toBeLessThan(speed(0.7)); // yavaşlayarak uzaklaşır
    expect(closeAt(0.5)).toBeCloseTo(1, 6);
  });

  test("dönüş yakınken hızlı (Kepler benzeri), uzakta ağır ama durmaz", () => {
    const spin = (x, h = 0.002) => (angleAt(x + h) - angleAt(x - h)) / (2 * h);
    expect(spin(0.5)).toBeGreaterThan(5 * spin(0.05));
    expect(spin(0.05)).toBeGreaterThan(0);
    for (const x of grid(400).slice(1)) expect(angleAt(x)).toBeGreaterThanOrEqual(angleAt(x - 1 / 400));
  });

  test("karadelikler ve dalga kutudan taşmaz", () => {
    for (const x of grid()) {
      expect(reachAt(x)).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(reachAt(x, GEOM_COMPACT)).toBeLessThanOrEqual(0.5 + 1e-9);
    }
    expect(GEOM.wave).toBeLessThanOrEqual(0.5);
  });

  test("gelgit yalnız iç içeyken, dalga yalnız geçişten sonra", () => {
    expect(tideAt(0)).toEqual([1, 1]);
    expect(tideAt(0.5)[0]).toBeGreaterThan(1.2);
    expect(waveAt(0.2)[1]).toBe(0);
    expect(waveAt(WAVE.start + 0.08)[1]).toBeGreaterThan(0.3);
    expect(waveAt(WAVE.end)[1]).toBeCloseTo(0, 6);
  });

  test("tablo sıralı, uçları kapsar, geçiş çevresi sık", () => {
    const { inputRange, outputRange } = sampleLoop(posAt);
    expect(inputRange[0]).toBe(0);
    expect(inputRange[inputRange.length - 1]).toBe(1);
    for (let i = 1; i < inputRange.length; i += 1) expect(inputRange[i]).toBeGreaterThan(inputRange[i - 1]);
    expect(outputRange).toHaveLength(inputRange.length);
    const middle = inputRange.filter((x) => x > 0.45 && x < 0.55).length;
    expect(middle).toBeGreaterThanOrEqual(20);
    // Ardışık iki örnek arasında konum sıçraması küçük (geçiş köşe yapmasın).
    for (let i = 1; i < inputRange.length; i += 1) {
      expect(Math.abs(outputRange[i] - outputRange[i - 1])).toBeLessThan(0.08);
    }
  });

  test("boy: adlar + sayı; boşta tona göre", () => {
    expect(resolveLoaderSize("small")).toBe(LOADER_SIZES.small);
    expect(resolveLoaderSize("medium")).toBe(LOADER_SIZES.medium);
    expect(resolveLoaderSize("large")).toBe(LOADER_SIZES.large);
    expect(resolveLoaderSize(undefined)).toBe(LOADER_SIZES.medium);
    expect(resolveLoaderSize(undefined, "mono")).toBe(LOADER_SIZES.small);
    expect(resolveLoaderSize(52)).toBe(52);
    expect(resolveLoaderSize(-3)).toBe(LOADER_SIZES.medium);
    expect(resolveLoaderSize("screen")).toBe(LOADER_SIZES.screen);
  });

  test("responsive: ekran ölçeği + fill", () => {
    expect(screenScaleFor(390, 844)).toBe(1);
    expect(screenScaleFor(1024, 1366)).toBe(1.5);
    expect(screenScaleFor(320, 568)).toBe(0.9);
    expect(screenScaleFor(0, 0)).toBe(1);
    expect(resolveLoaderSize("large", "brand", 1.5)).toBe(Math.round(LOADER_SIZES.large * 1.5));
    expect(resolveLoaderSize("small", "brand", 1.5)).toBe(Math.round(LOADER_SIZES.small * 1.2));
    expect(resolveLoaderSize("small", "brand", 0.9)).toBe(LOADER_SIZES.small);
    expect(resolveLoaderSize(40, "brand", 1.5)).toBe(40);
    expect(fillSizeFor(120, 180)).toBe(36); // poster
    expect(fillSizeFor(390, 700)).toBe(96); // tam ekran → tavan
    expect(fillSizeFor(30, 300)).toBeNull();
  });
});
