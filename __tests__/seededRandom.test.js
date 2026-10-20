// utils/seededRandom.js — Günlük Meydan Okuma'nın "herkeste aynı sorular" garantisi
// bu modüle dayanır; bozulursa iki oyuncu aynı gün farklı soruyla yarışır.
const {
  hashString,
  createRng,
  createStableSource,
  randomSource,
  shuffleWith,
  randomIntWith,
} = require("../utils/seededRandom");

const items = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, type: "movie" }));

describe("hashString / createRng", () => {
  test("aynı girdi aynı hash'i verir, farklı girdi farklı", () => {
    expect(hashString("a")).toBe(hashString("a"));
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(hashString("")).toBe(hashString(""));
  });

  test("hash 32-bit işaretsiz tam sayıdır", () => {
    for (const s of ["x", "seelogd-daily-v1-2026-10-03", "çğış"]) {
      const h = hashString(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });

  test("aynı tohum aynı diziyi üretir, [0,1) aralığında kalır", () => {
    const a = createRng("tohum");
    const b = createRng("tohum");
    for (let i = 0; i < 200; i += 1) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  test("farklı tohum farklı dizi üretir", () => {
    const a = createRng("bir");
    const b = createRng("iki");
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  test("randomIntWith uçlar dahil aralıkta kalır", () => {
    const rng = createRng(7);
    const seen = new Set();
    for (let i = 0; i < 500; i += 1) seen.add(randomIntWith(rng, 3, 6));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });
});

describe("shuffleWith (Fisher–Yates)", () => {
  test("girdiyi bozmaz, elemanları kaybetmez", () => {
    const input = items(12);
    const snapshot = JSON.stringify(input);
    const out = shuffleWith(input, createRng(1));
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(out).toHaveLength(12);
    expect(new Set(out.map((x) => x.id)).size).toBe(12);
  });

  test("dağılım kabaca düzgün: ilk eleman her yerde görülür", () => {
    const rng = createRng("dagilim");
    const counts = {};
    for (let i = 0; i < 4000; i += 1) {
      const first = shuffleWith([0, 1, 2, 3], rng)[0];
      counts[first] = (counts[first] || 0) + 1;
    }
    for (const k of [0, 1, 2, 3]) {
      expect(counts[k]).toBeGreaterThan(800);
      expect(counts[k]).toBeLessThan(1200);
    }
  });
});

describe("createStableSource (günlük soru kaynağı)", () => {
  const pool = items(40);

  test("aynı tohum + tuz → aynı sıralama", () => {
    const a = createStableSource("seed").shuffle(pool, "correct:1").map((x) => x.id);
    const b = createStableSource("seed").shuffle(pool, "correct:1").map((x) => x.id);
    expect(a).toEqual(b);
  });

  test("giriş sırası sonucu etkilemez (TMDB sayfa içi sırası oynasa da aynı)", () => {
    const src = createStableSource("seed");
    const forward = src.shuffle(pool, "t").map((x) => x.id);
    const backward = src.shuffle([...pool].reverse(), "t").map((x) => x.id);
    expect(forward).toEqual(backward);
  });

  test("farklı tohum ya da tuz farklı sıralama verir", () => {
    const base = createStableSource("seed").shuffle(pool, "a").map((x) => x.id);
    expect(createStableSource("baska").shuffle(pool, "a").map((x) => x.id)).not.toEqual(base);
    expect(createStableSource("seed").shuffle(pool, "b").map((x) => x.id)).not.toEqual(base);
  });

  test("havuza bir kayıt eklenip çıkınca seçimlerin çoğu KAYMAZ", () => {
    // Rendezvous hashing'in asıl amacı: TMDB listesi kıyıda oynasa da günlük
    // soruların büyük kısmı herkeste aynı kalır.
    const src = createStableSource("seed");
    const top10 = (list) => src.shuffle(list, "correct:1").slice(0, 10).map((x) => x.id);
    const before = top10(pool);
    const swapped = pool.filter((x) => x.id !== 40).concat({ id: 999, type: "movie" });
    const after = top10(swapped);
    const kept = before.filter((id) => after.includes(id)).length;
    expect(kept).toBeGreaterThanOrEqual(8);
  });

  test("girdiyi bozmaz", () => {
    const input = items(10);
    const snapshot = JSON.stringify(input);
    createStableSource("seed").shuffle(input, "x");
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  test("mediaKey / type_id / id / ilkel değerlerle anahtar çıkarır", () => {
    const src = createStableSource("seed");
    expect(src.shuffle([{ mediaKey: "movie_1" }, { mediaKey: "movie_2" }], "t")).toHaveLength(2);
    expect(src.shuffle(["b", "a", "c"], "t").slice().sort()).toEqual(["a", "b", "c"]);
  });

  test("int() aralıkta ve deterministik", () => {
    const src = createStableSource("seed");
    for (let i = 0; i < 50; i += 1) {
      const v = src.int(2, 9, `s${i}`);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(9);
      expect(v).toBe(createStableSource("seed").int(2, 9, `s${i}`));
    }
    expect(src.int(5, 5, "x")).toBe(5);
  });
});

describe("randomSource (normal oyun)", () => {
  test("stabil değil, tüm elemanları korur", () => {
    expect(randomSource.stable).toBe(false);
    const out = randomSource.shuffle(items(8), "yoksayilir");
    expect(out).toHaveLength(8);
    expect(new Set(out.map((x) => x.id)).size).toBe(8);
  });

  test("int() aralıkta", () => {
    for (let i = 0; i < 100; i += 1) {
      const v = randomSource.int(1, 3);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
    }
  });
});
