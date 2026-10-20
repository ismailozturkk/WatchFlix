// utils/gameSelection.js — oyunun "ne seçilsin" kuralları. Bozulursa ya
// başlıklı afiş (soru bir bakışta çözülür) ya da tanınmayan yapımlar çıkar;
// günlük için bias=0 yolu da eski source.shuffle ile birebir kalmak zorunda.
const {
  maxPageForSource,
  pickWeightedPages,
  recognitionWeight,
  weightedOrder,
  distillImages,
  pickTextlessPoster,
  pickSceneImage,
} = require("../utils/gameSelection");
const { createRng, createStableSource, randomSource } = require("../utils/seededRandom");

const item = (id, voteCount = 0, popularity = 0) => ({
  id,
  type: "movie",
  mediaKey: `movie_${id}`,
  voteCount,
  popularity,
});

describe("pickWeightedPages", () => {
  test("istenen sayıda FARKLI sayfa verir ve aralıkta kalır", () => {
    for (let i = 0; i < 100; i += 1) {
      const pages = pickWeightedPages(3, 25);
      expect(pages).toHaveLength(3);
      expect(new Set(pages).size).toBe(3);
      pages.forEach((p) => {
        expect(p).toBeGreaterThanOrEqual(1);
        expect(p).toBeLessThanOrEqual(25);
      });
    }
  });

  test("ilk sayfalar uç sayfalardan belirgin biçimde daha olası", () => {
    const rng = createRng("sayfa-dagilimi");
    let early = 0;
    let late = 0;
    const trials = 3000;
    for (let i = 0; i < trials; i += 1) {
      pickWeightedPages(3, 25, { rng }).forEach((p) => {
        if (p <= 3) early += 1;
        if (p > 12) late += 1;
      });
    }
    const total = trials * 3;
    expect(early / total).toBeGreaterThan(0.4); // düzgün dağılımda 3/25 = %12
    expect(late / total).toBeLessThan(0.25); // düzgün dağılımda 13/25 = %52
    expect(late).toBeGreaterThan(0); // uçlar tamamen kapanmaz
  });

  test("exclude edilen sayfalar bir daha seçilmez; tükenince eldekini verir", () => {
    const exclude = new Set([1, 2, 3, 4]);
    const pages = pickWeightedPages(3, 6, { exclude });
    expect(pages.sort()).toEqual([5, 6]);
    expect(pickWeightedPages(3, 4, { exclude })).toEqual([]);
  });

  test("kaynak başına tavan: tanınmayan derin sayfalara inilmez", () => {
    expect(maxPageForSource("popular_movie")).toBeLessThanOrEqual(30);
    expect(maxPageForSource("top_rated_tv")).toBeLessThanOrEqual(30);
    expect(maxPageForSource("bilinmeyen")).toBeGreaterThan(0);
  });
});

describe("recognitionWeight", () => {
  test("en az 1 ve eksik alanlarda patlamaz", () => {
    expect(recognitionWeight({})).toBe(1);
    expect(recognitionWeight(null)).toBe(1);
    expect(recognitionWeight({ voteCount: -5, popularity: "x" })).toBe(1);
  });

  test("oy sayısı ve popülerlik arttıkça ağırlık artar", () => {
    expect(recognitionWeight(item(1, 20000, 100))).toBeGreaterThan(
      recognitionWeight(item(2, 200, 100)),
    );
    expect(recognitionWeight(item(1, 200, 100))).toBeGreaterThan(
      recognitionWeight(item(2, 200, 5)),
    );
    expect(recognitionWeight(item(1, 200, 5))).toBeGreaterThan(
      recognitionWeight(item(2, 5, 5)),
    );
  });

  test("baskın ama sınırlı: çok bilinen en fazla ~onlarca kat olası", () => {
    const ratio = recognitionWeight(item(1, 20000, 300)) / recognitionWeight(item(2, 5, 3));
    expect(ratio).toBeGreaterThan(5);
    expect(ratio).toBeLessThan(100);
  });
});

describe("weightedOrder", () => {
  const pool = Array.from({ length: 30 }, (_, i) => item(i + 1, 50, 5));

  test("bias 0 → source.shuffle ile BİREBİR aynı (günlük kayması olmaz)", () => {
    const stable = createStableSource("gunluk");
    const direct = stable.shuffle(pool, "correct:1").map((x) => x.id);
    const viaOrder = weightedOrder(pool, stable, "correct:1", 0).map((x) => x.id);
    expect(viaOrder).toEqual(direct);
  });

  test("tüm elemanları korur, girdiyi bozmaz", () => {
    const snapshot = JSON.stringify(pool);
    const out = weightedOrder(pool, randomSource, "x", 1);
    expect(out).toHaveLength(pool.length);
    expect(new Set(out.map((x) => x.id)).size).toBe(pool.length);
    expect(JSON.stringify(pool)).toBe(snapshot);
  });

  test("kararlı kaynakta aynı tuz aynı sıralamayı verir", () => {
    const a = weightedOrder(pool, createStableSource("s"), "t", 1).map((x) => x.id);
    const b = weightedOrder(pool, createStableSource("s"), "t", 1).map((x) => x.id);
    expect(a).toEqual(b);
  });

  test("bir kayıt çıkınca diğerlerinin göreli sırası değişmez", () => {
    const stable = createStableSource("s");
    const full = weightedOrder(pool, stable, "t", 1).map((x) => x.id);
    const without = weightedOrder(
      pool.filter((x) => x.id !== 7),
      stable,
      "t",
      1,
    ).map((x) => x.id);
    expect(without).toEqual(full.filter((id) => id !== 7));
  });

  test("bilindik yapımlar belirgin biçimde daha sık öne gelir", () => {
    const famous = [item(101, 20000, 300), item(102, 20000, 300), item(103, 20000, 300)];
    const obscure = Array.from({ length: 20 }, (_, i) => item(i + 1, 20, 5));
    const mixed = [...obscure, ...famous];
    const trials = 600;
    let biased = 0;
    let flat = 0;
    for (let i = 0; i < trials; i += 1) {
      if (weightedOrder(mixed, randomSource, "x", 1)[0].id > 100) biased += 1;
      if (weightedOrder(mixed, randomSource, "x", 0)[0].id > 100) flat += 1;
    }
    // Düz rastgelede 3/23 ≈ %13; ağırlıkta ≈ %60.
    expect(biased / trials).toBeGreaterThan(0.45);
    expect(flat / trials).toBeLessThan(0.3);
  });

  test("tek ve boş listede patlamaz", () => {
    expect(weightedOrder([], randomSource, "x", 1)).toEqual([]);
    expect(weightedOrder([item(1)], randomSource, "x", 1)).toHaveLength(1);
  });
});

describe("distillImages", () => {
  test("yalnız gereken alanları ve sınırlı adedi tutar", () => {
    const data = {
      backdrops: Array.from({ length: 60 }, (_, i) => ({
        file_path: `/b${i}.jpg`,
        width: 1920,
        height: 1080,
        aspect_ratio: 1.78,
        iso_639_1: null,
        vote_average: 5,
      })),
      posters: Array.from({ length: 40 }, (_, i) => ({ file_path: `/p${i}.jpg`, iso_639_1: null })),
      logos: [{ file_path: "/logo.png" }],
    };
    const out = distillImages(data);
    expect(out.backdrops.length).toBeLessThanOrEqual(24);
    expect(out.posters.length).toBeLessThanOrEqual(16);
    expect(out.backdrops[0]).not.toHaveProperty("height");
    expect(out).not.toHaveProperty("logos");
  });

  test("boş/bozuk cevapta boş listeler verir", () => {
    expect(distillImages(null)).toEqual({ backdrops: [], posters: [] });
    expect(distillImages({ posters: "x" })).toEqual({ backdrops: [], posters: [] });
  });
});

describe("pickTextlessPoster (yazısız afiş)", () => {
  const poster = (path, extra = {}) => ({
    file_path: path,
    iso_639_1: null,
    width: 2000,
    aspect_ratio: 0.667,
    vote_average: 5,
    vote_count: 10,
    ...extra,
  });

  test("dilli (başlıklı) afişi ASLA seçmez", () => {
    const posters = [
      poster("/en.jpg", { iso_639_1: "en", vote_average: 9, vote_count: 999 }),
      poster("/tr.jpg", { iso_639_1: "tr", vote_average: 9, vote_count: 999 }),
      poster("/textless.jpg"),
    ];
    for (let i = 0; i < 50; i += 1) {
      expect(pickTextlessPoster(posters, randomSource, "x")).toBe("/textless.jpg");
    }
  });

  test("yazısız afiş yoksa null", () => {
    expect(
      pickTextlessPoster([poster("/en.jpg", { iso_639_1: "en" })], randomSource, "x"),
    ).toBeNull();
    expect(pickTextlessPoster([], randomSource, "x")).toBeNull();
    expect(pickTextlessPoster(undefined, randomSource, "x")).toBeNull();
    expect(pickTextlessPoster([{ iso_639_1: null }], randomSource, "x")).toBeNull();
  });

  test("küçük ya da afiş oranında olmayan görsele, uygun olan varken düşmez", () => {
    const posters = [
      poster("/small.jpg", { width: 300 }),
      poster("/wide.jpg", { aspect_ratio: 1.78 }),
      poster("/good.jpg"),
    ];
    for (let i = 0; i < 30; i += 1) {
      expect(pickTextlessPoster(posters, randomSource, "x")).toBe("/good.jpg");
    }
  });

  test("uygun yoksa küçük ama yazısız olana düşer (hiç yoktan iyi)", () => {
    expect(pickTextlessPoster([poster("/small.jpg", { width: 300 })], randomSource, "x")).toBe(
      "/small.jpg",
    );
  });

  test("en iyi 3 arasından seçer (4. ve sonrası gelmez)", () => {
    const posters = [
      poster("/a.jpg", { vote_average: 9, vote_count: 500 }),
      poster("/b.jpg", { vote_average: 8, vote_count: 400 }),
      poster("/c.jpg", { vote_average: 7, vote_count: 300 }),
      poster("/d.jpg", { vote_average: 2, vote_count: 1 }),
    ];
    const seen = new Set();
    for (let i = 0; i < 200; i += 1) seen.add(pickTextlessPoster(posters, randomSource, "x"));
    expect(seen.has("/d.jpg")).toBe(false);
    expect(seen.size).toBeGreaterThan(1);
  });

  test("kararlı kaynakta herkeste aynı afiş", () => {
    const posters = ["/a", "/b", "/c"].map((p) => poster(`${p}.jpg`));
    const pick = () => pickTextlessPoster(posters, createStableSource("gun"), "poster:movie_1");
    expect(pick()).toBe(pick());
  });
});

describe("pickSceneImage (sahne karesi)", () => {
  const backdrops = Array.from({ length: 10 }, (_, i) => ({
    file_path: `/s${i}.jpg`,
    width: 1920,
    aspect_ratio: 1.78,
    iso_639_1: null,
  }));
  const indexOf = (path) => Number(path.match(/\d+/)[0]);

  test("kare yoksa null", () => {
    expect(pickSceneImage([], "normal", randomSource)).toBeNull();
    expect(pickSceneImage(undefined, "normal", randomSource)).toBeNull();
  });

  test("tek kare → ipucu yok", () => {
    expect(pickSceneImage(backdrops.slice(0, 1), "hard", randomSource)).toEqual({
      mainImage: "/s0.jpg",
      hints: [],
    });
  });

  test("zorluk tanınırlık aralığını belirler", () => {
    for (let i = 0; i < 100; i += 1) {
      expect(indexOf(pickSceneImage(backdrops, "easy", randomSource).mainImage)).toBeLessThanOrEqual(2);
      expect(indexOf(pickSceneImage(backdrops, "normal", randomSource).mainImage)).toBeGreaterThanOrEqual(1);
      expect(indexOf(pickSceneImage(backdrops, "hard", randomSource).mainImage)).toBeGreaterThanOrEqual(3);
    }
  });

  test("ipuçları ana kareyi içermez ve en fazla 5", () => {
    const out = pickSceneImage(backdrops, "normal", randomSource);
    expect(out.hints).not.toContain(out.mainImage);
    expect(out.hints.length).toBeLessThanOrEqual(5);
  });

  test("kalite süzgeci: yeterli kare varsa küçük/geniş olanlar elenir", () => {
    const mixed = [
      ...backdrops.slice(0, 4),
      { file_path: "/tiny.jpg", width: 500, aspect_ratio: 1.78, iso_639_1: null },
    ];
    for (let i = 0; i < 60; i += 1) {
      const out = pickSceneImage(mixed, "hard", randomSource);
      expect(out.mainImage).not.toBe("/tiny.jpg");
      expect(out.hints).not.toContain("/tiny.jpg");
    }
  });

  test("kararlı kaynakta herkeste aynı kare", () => {
    const a = pickSceneImage(backdrops, "normal", createStableSource("gun"), "image:movie_1");
    const b = pickSceneImage(backdrops, "normal", createStableSource("gun"), "image:movie_1");
    expect(a).toEqual(b);
  });
});
