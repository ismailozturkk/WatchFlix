// services/sceneGameService.js — soru üretimi ve havuz. Ağ (axios), Firebase ve
// disk önbelleği taklit edilir; asıl sınanan: Poster Bulmaca'ya YALNIZ yazısız
// afişin gitmesi, bilindik yapımların öne çıkması, günlüğün kaymaması ve havuzun
// gereksiz ağ isteği yapmadan büyümesi.

jest.mock("axios", () => ({ get: jest.fn() }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  runTransaction: jest.fn(),
  where: jest.fn(),
}));
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: { GAME_PLAYED: "game_played" },
  trackEvent: jest.fn(),
}));
// cachedRead RN bağlantı durumuna dayanır; burada doğrudan fetchFn çalıştırılır.
jest.mock("../utils/cachedRead", () => ({
  cachedRead: jest.fn(async (_ns, _key, fetchFn) => ({ data: await fetchFn() })),
}));

const load = () => {
  jest.resetModules();
  const axios = require("axios");
  axios.get.mockReset();
  return { axios, service: require("../services/sceneGameService") };
};

const { createStableSource, randomSource } = require("../utils/seededRandom");

const titledPoster = (path) => ({
  file_path: path,
  iso_639_1: "en",
  width: 2000,
  aspect_ratio: 0.667,
  vote_average: 9,
  vote_count: 999,
});
const textlessPoster = (path) => ({
  file_path: path,
  iso_639_1: null,
  width: 2000,
  aspect_ratio: 0.667,
  vote_average: 5,
  vote_count: 10,
});
const backdrop = (path) => ({
  file_path: path,
  iso_639_1: null,
  width: 1920,
  aspect_ratio: 1.78,
});

const poolItem = (id, extra = {}) => ({
  mediaKey: `movie_${id}`,
  id,
  type: "movie",
  title: `Film ${String.fromCharCode(65 + (id % 26))}${id}x${"abcdefghij"[id % 10]}`,
  genreIds: [18],
  popularity: 10,
  voteCount: 100,
  posterPath: `/default-${id}.jpg`,
  backdropPath: `/bd-${id}.jpg`,
  year: "2010",
  ...extra,
});

/** `/movie/<id>/images` isteklerine id'ye göre cevap verir. */
const mockImages = (axios, resolver) => {
  axios.get.mockImplementation(async (url) => {
    const match = /\/(movie|tv)\/(\d+)\/images$/.exec(url);
    if (!match) throw new Error(`beklenmeyen istek: ${url}`);
    const data = resolver(Number(match[2]));
    if (data instanceof Error) throw data;
    return { data };
  });
};

const imageCalls = (axios) => axios.get.mock.calls.filter(([url]) => /\/images$/.test(url));

describe("generateQuestion — Poster Bulmaca (yazısız afiş)", () => {
  test("soru görseli YAZISIZ afiştir; başlıklı afiş asla gitmez", async () => {
    const { axios, service } = load();
    const pool = Array.from({ length: 12 }, (_, i) => poolItem(i + 1));
    mockImages(axios, (id) => ({
      posters: [titledPoster(`/titled-${id}.jpg`), textlessPoster(`/textless-${id}.jpg`)],
      backdrops: [],
    }));

    for (let round = 1; round <= 15; round += 1) {
      const q = await service.generateQuestion(pool, "key", "tr", new Set(), round, 4, "normal", {
        kind: "poster",
      });
      expect(q.kind).toBe("poster");
      expect(q.imagePath).toBe(`/textless-${q.correctItem.id}.jpg`);
      expect(q.imagePath).not.toMatch(/titled|default/);
      expect(q.hints).toEqual([]);
      expect(q.options).toHaveLength(4);
      expect(q.options[q.correctIndex].id).toBe(q.correctItem.id);
    }
  });

  test("yazısız afişi olmayan yapımlar atlanır, olan çıkar", async () => {
    const { axios, service } = load();
    const pool = Array.from({ length: 12 }, (_, i) => poolItem(i + 1));
    // Yalnız 3 ve 9'un yazısız afişi var.
    mockImages(axios, (id) => ({
      posters: [titledPoster(`/titled-${id}.jpg`), ...(id === 3 || id === 9 ? [textlessPoster(`/t-${id}.jpg`)] : [])],
      backdrops: [],
    }));

    const seen = new Set();
    for (let round = 1; round <= 10; round += 1) {
      const q = await service.generateQuestion(pool, "key", "tr", new Set(), round, 4, "normal", {
        kind: "poster",
      });
      expect([3, 9]).toContain(q.correctItem.id);
      seen.add(q.correctItem.id);
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  test("hiçbir adayın yazısız afişi yoksa soru ÜRETİLMEZ (başlıklıya düşmez)", async () => {
    const { axios, service } = load();
    const pool = Array.from({ length: 10 }, (_, i) => poolItem(i + 1));
    mockImages(axios, (id) => ({ posters: [titledPoster(`/titled-${id}.jpg`)], backdrops: [] }));

    const q = await service.generateQuestion(pool, "key", "tr", new Set(), 1, 4, "normal", {
      kind: "poster",
    });
    expect(q).toBeNull();
  });

  test("görsel ucu hata verirse soru üretilmez ve fırlatmaz", async () => {
    const { axios, service } = load();
    const pool = Array.from({ length: 8 }, (_, i) => poolItem(i + 1));
    mockImages(axios, () => new Error("ağ yok"));

    await expect(
      service.generateQuestion(pool, "key", "tr", new Set(), 1, 4, "normal", { kind: "poster" }),
    ).resolves.toBeNull();
  });

  test("aynı yapım için görsel ucu bir kez sorulur (önbellek)", async () => {
    const { axios, service } = load();
    const pool = Array.from({ length: 6 }, (_, i) => poolItem(i + 1));
    mockImages(axios, (id) => ({ posters: [textlessPoster(`/t-${id}.jpg`)], backdrops: [] }));

    for (let round = 1; round <= 12; round += 1) {
      await service.generateQuestion(pool, "key", "tr", new Set(), round, 4, "normal", {
        kind: "poster",
      });
    }
    const byUrl = new Map();
    imageCalls(axios).forEach(([url]) => byUrl.set(url, (byUrl.get(url) || 0) + 1));
    expect(byUrl.size).toBeLessThanOrEqual(6);
    byUrl.forEach((count) => expect(count).toBe(1));
  });

  test("hata önbelleğe alınmaz: sonraki denemede yeniden sorulur", async () => {
    const { axios, service } = load();
    const pool = Array.from({ length: 5 }, (_, i) => poolItem(i + 1));
    mockImages(axios, () => new Error("geçici"));
    expect(
      await service.generateQuestion(pool, "key", "tr", new Set(), 1, 4, "normal", { kind: "poster" }),
    ).toBeNull();

    mockImages(axios, (id) => ({ posters: [textlessPoster(`/t-${id}.jpg`)], backdrops: [] }));
    const q = await service.generateQuestion(pool, "key", "tr", new Set(), 2, 4, "normal", {
      kind: "poster",
    });
    expect(q).not.toBeNull();
  });

  test("kullanılmış yapımlar tekrar gelmez", async () => {
    const { axios, service } = load();
    const pool = Array.from({ length: 8 }, (_, i) => poolItem(i + 1));
    mockImages(axios, (id) => ({ posters: [textlessPoster(`/t-${id}.jpg`)], backdrops: [] }));
    const used = new Set(pool.slice(0, 7).map((item) => `${item.type}_${item.id}`));

    const q = await service.generateQuestion(pool, "key", "tr", used, 1, 4, "normal", {
      kind: "poster",
    });
    expect(q.correctItem.id).toBe(8);
  });
});

describe("generateQuestion — bilindik yapımlar öne çıkar", () => {
  const famous = [101, 102, 103].map((id) => poolItem(id, { voteCount: 20000, popularity: 300 }));
  const obscure = Array.from({ length: 20 }, (_, i) =>
    poolItem(i + 1, { voteCount: 20, popularity: 5 }),
  );
  const pool = [...obscure, ...famous];

  const famousRate = async (service, popularityBias, trials) => {
    let hits = 0;
    for (let i = 0; i < trials; i += 1) {
      const q = await service.generateQuestion(pool, "key", "tr", new Set(), 1, 4, "normal", {
        kind: "poster",
        popularityBias,
      });
      if (q.correctItem.id > 100) hits += 1;
    }
    return hits / trials;
  };

  test("popularityBias=1 → bilindik yapımlar belirgin biçimde daha sık doğru cevap", async () => {
    const { axios, service } = load();
    mockImages(axios, (id) => ({ posters: [textlessPoster(`/t-${id}.jpg`)], backdrops: [] }));
    const biased = await famousRate(service, 1, 400);
    const flat = await famousRate(service, 0, 400);
    // Düz rastgelede 3/23 ≈ %13; ağırlıkta ≈ %60.
    expect(biased).toBeGreaterThan(0.45);
    expect(flat).toBeLessThan(0.3);
  });

  test("şıklar da bilindiklere kayar: tek tanıdık başlık ipucu vermez", async () => {
    const { axios, service } = load();
    mockImages(axios, (id) => ({ posters: [textlessPoster(`/t-${id}.jpg`)], backdrops: [] }));
    const countFamousOptions = async (bias) => {
      let total = 0;
      for (let i = 0; i < 200; i += 1) {
        const q = await service.generateQuestion(pool, "key", "tr", new Set(), 1, 4, "normal", {
          kind: "poster",
          popularityBias: bias,
        });
        total += q.options.filter((o) => o.id > 100).length;
      }
      return total;
    };
    expect(await countFamousOptions(1)).toBeGreaterThan(await countFamousOptions(0));
  });
});

describe("generateQuestion — Günlük Meydan Okuma kaymaz", () => {
  test("bias=0 + kararlı kaynak: doğru cevap eski source.shuffle sırasıyla aynı", async () => {
    const { axios, service } = load();
    const pool = Array.from({ length: 30 }, (_, i) =>
      poolItem(i + 1, { voteCount: (i + 1) * 500, popularity: i + 1 }),
    );
    mockImages(axios, (id) => ({
      backdrops: [backdrop(`/a-${id}.jpg`), backdrop(`/b-${id}.jpg`), backdrop(`/c-${id}.jpg`)],
      posters: [],
    }));
    const mk = () => createStableSource("seelogd-daily-2026-10-15");

    for (let round = 1; round <= 5; round += 1) {
      const expected = mk().shuffle(pool, `correct:${round}`)[0];
      const q = await service.generateQuestion(pool, "key", "tr", new Set(), round, 4, "normal", {
        source: mk(),
        kind: "scene",
      });
      expect(q.correctItem.id).toBe(expected.id);

      const again = await service.generateQuestion(pool, "key", "tr", new Set(), round, 4, "normal", {
        source: mk(),
        kind: "scene",
      });
      expect(again.options.map((o) => o.id)).toEqual(q.options.map((o) => o.id));
      expect(again.imagePath).toBe(q.imagePath);
    }
  });
});

describe("generateQuestion — Sahne Tahmini", () => {
  test("hafif /images ucunu kullanır (detay + append_to_response değil)", async () => {
    const { axios, service } = load();
    const pool = Array.from({ length: 8 }, (_, i) => poolItem(i + 1));
    mockImages(axios, (id) => ({
      backdrops: [backdrop(`/a-${id}.jpg`), backdrop(`/b-${id}.jpg`)],
      posters: [],
    }));
    const q = await service.generateQuestion(pool, "key", "tr", new Set(), 1, 4, "normal");
    expect(q.kind).toBe("scene");
    expect(q.imagePath).toMatch(new RegExp(`/(a|b)-${q.correctItem.id}\\.jpg`));
    const [url, config] = imageCalls(axios)[0];
    expect(url).toMatch(/\/movie\/\d+\/images$/);
    expect(config.params).toEqual({ include_image_language: "null" });
    expect(config.params).not.toHaveProperty("append_to_response");
  });

  test("görsel listesi alınamazsa yapımın varsayılan arka planına düşer", async () => {
    const { axios, service } = load();
    const pool = Array.from({ length: 8 }, (_, i) => poolItem(i + 1));
    mockImages(axios, () => new Error("ağ yok"));
    const q = await service.generateQuestion(pool, "key", "tr", new Set(), 1, 4, "normal");
    expect(q.imagePath).toBe(`/bd-${q.correctItem.id}.jpg`);
  });
});

describe("fetchTitlePool", () => {
  const pageResponse = (page) => ({
    results: Array.from({ length: 20 }, (_, i) => ({
      id: page * 1000 + i,
      title: `Film ${page}-${i}`,
      media_type: "movie",
      backdrop_path: `/b-${page}-${i}.jpg`,
      poster_path: `/p-${page}-${i}.jpg`,
      popularity: 50,
      vote_count: 1000,
      genre_ids: [18],
      release_date: "2015-01-01",
    })),
  });

  const mockPages = (axios) => {
    axios.get.mockImplementation(async (_url, config) => ({ data: pageResponse(config.params.page) }));
  };
  const pagesRequested = (axios) => axios.get.mock.calls.map(([, config]) => config.params.page);

  test("ilk sayfalara ağırlıklı, tavanı aşmayan FARKLI sayfalar çeker", async () => {
    const { axios, service } = load();
    mockPages(axios);
    const pool = await service.fetchTitlePool("key", "tr", "popular_movie");
    const pages = pagesRequested(axios);
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(new Set(pages).size).toBe(pages.length);
    pages.forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(1);
      expect(p).toBeLessThanOrEqual(25);
    });
    expect(pool.length).toBeGreaterThanOrEqual(60);
    expect(pool[0]).toEqual(
      expect.objectContaining({ mediaKey: expect.any(String), voteCount: 1000, popularity: 50 }),
    );
  });

  test("yeterince taze yapım varsa ağa hiç çıkmaz", async () => {
    const { axios, service } = load();
    mockPages(axios);
    const first = await service.fetchTitlePool("key", "tr", "popular_movie");
    const callsAfterFirst = axios.get.mock.calls.length;
    const second = await service.fetchTitlePool("key", "tr", "popular_movie", { seen: new Set() });
    expect(axios.get.mock.calls.length).toBe(callsAfterFirst);
    expect(second).toBe(first);
  });

  test("oyuncu havuzun çoğunu görmüşse YENİ sayfalar eklenir, eskiler tekrar çekilmez", async () => {
    const { axios, service } = load();
    mockPages(axios);
    const first = await service.fetchTitlePool("key", "tr", "popular_movie");
    const firstPages = new Set(pagesRequested(axios));
    const seen = new Set(first.map((item) => `${item.type}_${item.id}`));

    axios.get.mockClear();
    mockPages(axios);
    const grown = await service.fetchTitlePool("key", "tr", "popular_movie", { seen });
    const newPages = pagesRequested(axios);

    expect(newPages.length).toBeGreaterThan(0);
    newPages.forEach((p) => expect(firstPages.has(p)).toBe(false));
    expect(grown.length).toBeGreaterThan(first.length);
    // Eski yapımlar korunur (referans kaybolmaz), yinelenen yok.
    expect(new Set(grown.map((item) => item.mediaKey)).size).toBe(grown.length);
    first.forEach((item) => expect(grown).toContain(item));
  });

  test("dil başına ayrı havuz", async () => {
    const { axios, service } = load();
    mockPages(axios);
    await service.fetchTitlePool("key", "tr", "popular_movie");
    const callsAfterTr = axios.get.mock.calls.length;
    await service.fetchTitlePool("key", "en", "popular_movie");
    expect(axios.get.mock.calls.length).toBeGreaterThan(callsAfterTr);
  });

  test("tüm sayfalar başarısızsa ve havuz boşsa boş liste döner, fırlatmaz", async () => {
    const { axios, service } = load();
    axios.get.mockRejectedValue(new Error("ağ yok"));
    await expect(service.fetchTitlePool("key", "tr", "popular_movie")).resolves.toEqual([]);
  });

  test("backdrop'u olmayan kayıtlar havuza girmez", async () => {
    const { axios, service } = load();
    axios.get.mockImplementation(async (_url, config) => {
      const data = pageResponse(config.params.page);
      data.results.forEach((r, i) => {
        if (i % 2) r.backdrop_path = null;
      });
      return { data };
    });
    const pool = await service.fetchTitlePool("key", "tr", "popular_movie");
    expect(pool.every((item) => item.backdropPath)).toBe(true);
    expect(pool.length).toBeGreaterThan(0);
  });
});

describe("normalizeMediaItem'a oy sayısı", () => {
  test("watchlist öğeleri voteCount'suz da çalışır (ağırlık 1 sinyalsiz)", () => {
    const { service } = load();
    const pool = service.buildWatchlistPool(
      [{ id: 5, title: "Kendi Filmim", type: "movie", posterPath: "/p.jpg" }],
      "watchlist",
    );
    expect(pool[0].voteCount).toBe(0);
    expect(pool[0].mediaKey).toBe("movie_5");
  });
});

describe("randomSource ile sabit kaynak aynı arayüzü paylaşır", () => {
  test("ikisinde de float() (0,1) açık aralığında", () => {
    const stable = createStableSource("x");
    for (let i = 0; i < 200; i += 1) {
      const a = randomSource.float();
      const b = stable.float(`s${i}`);
      expect(a).toBeGreaterThan(0);
      expect(a).toBeLessThan(1);
      expect(b).toBeGreaterThan(0);
      expect(b).toBeLessThan(1);
    }
    expect(stable.float("a")).toBe(createStableSource("x").float("a"));
  });
});

describe("fetchDailyFriendRows (günlük tablo, arkadaş satırları)", () => {
  test("sorgu YOK: her uid kendi belgesinden okunur (entries.uid koleksiyon dizini yok); olmayan satır atlanır", async () => {
    const { service } = load();
    const fs = require("firebase/firestore");
    fs.getDocs.mockReset();
    fs.doc.mockImplementation((_db, ...segments) => segments.join("/"));
    fs.getDoc.mockImplementation(async (ref) => {
      const uid = ref.split("/").pop();
      return uid === "ali"
        ? { id: "ali", exists: () => true, data: () => ({ uid: "ali", score: 7450, correctCount: 8 }) }
        : { id: uid, exists: () => false, data: () => undefined };
    });
    const rows = await service.fetchDailyFriendRows("2026-10-27", ["me", "ali", "me", null]);
    expect(fs.getDocs).not.toHaveBeenCalled();
    expect(fs.where).not.toHaveBeenCalled();
    expect(fs.getDoc).toHaveBeenCalledTimes(2); // tekilleştirilir
    expect(fs.doc).toHaveBeenCalledWith({}, "GameLeaderboards", expect.stringContaining("2026-10-27"), "entries", "ali");
    expect(rows).toEqual([expect.objectContaining({ uid: "ali", bestScore: 7450, totalCorrect: 8 })]);
  });
});
