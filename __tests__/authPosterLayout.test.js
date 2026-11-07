import { generatePosterLayout, pickPosters, seededRandom } from "../utils/authPosterLayout";

describe("generatePosterLayout", () => {
  const opts = { width: 390, height: 844, count: 10 };

  test("her poster rastgele ama sınırlı boyut, eğim ve süzülme alır", () => {
    const items = generatePosterLayout({ ...opts, random: seededRandom(7) });
    expect(items).toHaveLength(10);
    for (const item of items) {
      expect(item.w).toBeGreaterThanOrEqual(54);
      expect(item.w).toBeLessThanOrEqual(opts.width * 0.38 + 0.001);
      expect(item.h).toBeCloseTo(item.w * 1.5);
      expect(Math.abs(item.rotate)).toBeLessThanOrEqual(12);
      expect(item.opacity).toBeGreaterThanOrEqual(0.55);
      expect(item.opacity).toBeLessThanOrEqual(1);
      expect(item.duration).toBeGreaterThan(5000);
      // En az bir kısmı ekranda görünmeli.
      expect(item.x + item.w).toBeGreaterThan(0);
      expect(item.x).toBeLessThan(opts.width);
      expect(item.y + item.h).toBeGreaterThan(0);
      expect(item.y).toBeLessThan(opts.height);
    }
  });

  test("aynı tohum aynı düzeni, farklı tohum farklı düzeni verir", () => {
    const a = generatePosterLayout({ ...opts, random: seededRandom(1) });
    const b = generatePosterLayout({ ...opts, random: seededRandom(1) });
    const c = generatePosterLayout({ ...opts, random: seededRandom(2) });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  test("boyutlar birbirinden farklı (hepsi aynı değil)", () => {
    const items = generatePosterLayout({ ...opts, random: seededRandom(3) });
    expect(new Set(items.map((i) => Math.round(i.w))).size).toBeGreaterThan(5);
  });

  test("geçersiz alan ya da sayı boş döner", () => {
    expect(generatePosterLayout({ width: 0, height: 800 })).toEqual([]);
    expect(generatePosterLayout({ width: 300, height: 600, count: 0 })).toEqual([]);
  });
});

describe("pickPosters", () => {
  test("kısa listeyi başa sararak doldurur, boş listede boş döner", () => {
    expect(pickPosters(["a", "b"], 5)).toEqual(["a", "b", "a", "b", "a"]);
    expect(pickPosters([], 3)).toEqual([]);
  });
});
