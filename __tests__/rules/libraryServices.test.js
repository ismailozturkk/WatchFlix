// Liste + izleme yazma servislerinin emülatör testleri (GERÇEK servis kodu,
// GERÇEK Firestore kuralları). `npm run test:rules` ile çalışır.
//
// Bu dosya iki iş görür:
//   1. KARAKTERİZASYON — kök dokümandaki sayaç / statusIndex / istatistik
//      sözleşmesini sabitler. Servisleri yeniden düzenlerken regresyonu
//      yakalamanın tek yolu bu: mock'lu birim testler aynı hatayı "geçiyor"
//      diye gösteriyordu.
//   2. HATA KANITI — 3 Ekim 2026 denetiminde bulunan yazma hataları (aşağıda
//      "denetim" başlıklı describe'lar) önce kırmızı yazıldı, sonra düzeltildi.

const mockHolder = { db: null };
jest.mock("../../firebase", () => ({
  get db() {
    return mockHolder.db;
  },
}));
jest.mock("../../services/analytics", () =>
  require("../helpers/libraryEmulator").analyticsMock(),
);
jest.mock("../../services/activationAnalytics", () => ({
  trackFirstContentActivation: jest.fn(),
}));
jest.mock("../../services/usageTrackerService", () =>
  require("../helpers/libraryEmulator").usageMock(),
);
jest.mock("../../utils/cacheStore", () =>
  require("../helpers/libraryEmulator").cacheStoreMock(),
);

const { assertFails } = require("@firebase/rules-unit-testing");
const {
  createEmulatorEnv,
  readRoot,
  readCollection,
} = require("../helpers/libraryEmulator");
const {
  addToList,
  addItemsToList,
  ensureListsRoot,
  removeFromList,
  markMovieWatch,
  removeMovieWatchEvent,
  addToCustomRootList,
  removeFromCustomRootList,
  addItemsToCustomRootList,
  renameCustomRootList,
  reorderCustomRootList,
} = require("../../services/listItemsService");
const {
  markEpisodes,
  markSeason,
  markShow,
  removeTvWatchEvent,
  unmarkShow,
  migrateLegacyShow,
  clearLegacyWatchedTv,
} = require("../../services/watchedTvService");
const { getLocalList, setLocalList } = require("../../services/listSyncService");

const UID = "alice";

// `addItemsToCustomRootList` (CineSwipe sepeti → liste) ayrı bir iş kolunda geliyor;
// fonksiyon mevcut değilse ona özgü testler atlanır, diğer testler ona BAĞIMLI DEĞİL.
const testIfBulkCustom = addItemsToCustomRootList ? test : test.skip;

let testEnv;

const useUser = (uid) => {
  mockHolder.db = testEnv.authenticatedContext(uid).firestore();
};

beforeAll(async () => {
  testEnv = await createEmulatorEnv();
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  useUser(UID);
  ["favorites", "watchList", "watchedMovies", "watchedTv", "customItems"].forEach(
    (key) => setLocalList(UID, key, {}),
  );
});

const root = () => readRoot(mockHolder.db, UID);
const col = (name) => readCollection(mockHolder.db, UID, name);

const movie = (over = {}) => ({
  id: 27205,
  type: "movie",
  name: "Inception",
  imagePath: "/inception.jpg",
  dateAdded: "2026-01-01",
  minutes: 148,
  genres: ["Action", "Sci-Fi"],
  releaseDate: "2010-07-16",
  status: "Released",
  ...over,
});

const show = (over = {}) => ({
  id: 1399,
  name: "Game of Thrones",
  showEpisodeCount: 4,
  showSeasonCount: 2,
  imagePath: "/got.jpg",
  genres: ["Drama"],
  ...over,
});

const ep = (n, over = {}) => ({
  episodeNumber: n,
  episodeName: `E${n}`,
  episodeMinutes: 50,
  episodePosterPath: null,
  releaseDate: "2011-04-17",
  ...over,
});

const season = (n, episodes = 2) => ({
  seasonNumber: n,
  seasonPosterPath: `/s${n}.jpg`,
  seasonEpisodes: episodes,
});

// ── Öntanımlı listeler: favoriler / izlenecekler ────────────────────────────
describe("addToList / removeFromList", () => {
  test("öğe belgesi, sayaç ve statusIndex yazılır; yinelenen ekleme sayacı artırmaz", async () => {
    await addToList(UID, "favorites", movie());
    await addToList(UID, "favorites", movie());

    const items = await col("favorites");
    expect(Object.keys(items)).toEqual(["movie_27205"]);
    expect(items.movie_27205.name).toBe("Inception");

    const r = await root();
    expect(r.counts.favorites).toBe(1);
    expect(r.statusIndex.movie[27205].inFavorites).toBe(true);
    expect(getLocalList(UID, "favorites").movie_27205).toBeTruthy();
  });

  test("izlenecekler ayrı bayrak ve ayrı sayaç kullanır", async () => {
    await addToList(UID, "watchList", movie());
    const r = await root();
    expect(r.counts.watchList).toBe(1);
    expect(r.statusIndex.movie[27205].inWatchList).toBe(true);
    expect(r.statusIndex.movie[27205].inFavorites).toBeUndefined();
  });

  test("çıkarma belgeyi siler, sayacı düşürür, bayrağı false yapar", async () => {
    await addToList(UID, "favorites", movie());
    await removeFromList(UID, "favorites", "movie", 27205);

    expect(await col("favorites")).toEqual({});
    const r = await root();
    expect(r.counts.favorites).toBe(0);
    expect(r.statusIndex.movie[27205].inFavorites).toBe(false);
    expect(getLocalList(UID, "favorites")).toEqual({});
  });

  test("olmayan öğeyi çıkarmak sayacı eksiye düşürmez", async () => {
    await addToList(UID, "favorites", movie());
    await removeFromList(UID, "favorites", "movie", 99999);
    expect((await root()).counts.favorites).toBe(1);
  });

  test("dizi ve film aynı id ile ayrı öğedir", async () => {
    await addToList(UID, "watchList", movie({ id: 1399 }));
    await addToList(UID, "watchList", { id: 1399, type: "tv", name: "GoT" });
    const items = await col("watchList");
    expect(Object.keys(items).sort()).toEqual(["movie_1399", "tv_1399"]);
    const r = await root();
    expect(r.counts.watchList).toBe(2);
    expect(r.statusIndex.movie[1399].inWatchList).toBe(true);
    expect(r.statusIndex.tv[1399].inWatchList).toBe(true);
  });
});

// ── İzlenen filmler ──────────────────────────────────────────────────────────
describe("markMovieWatch / removeMovieWatchEvent", () => {
  test("ilk izleme: olay + sayaçlar + istatistik + tür sayacı", async () => {
    const event = await markMovieWatch(UID, movie(), "2026-02-01");
    expect(event.id).toBeTruthy();

    const items = await col("watchedMovies");
    const stored = items.movie_27205;
    expect(stored.watchEvents).toHaveLength(1);
    expect(stored.watchCount).toBe(1);
    expect(stored.dateAdded).toBe("2026-02-01");

    const r = await root();
    expect(r.counts.watchedMovies).toBe(1);
    expect(r.statusIndex.movie[27205].isWatched).toBe(true);
    expect(r.stats.movies).toMatchObject({
      uniqueCount: 1,
      totalRewatchCount: 1,
      totalMinutes: 148,
    });
    expect(r.stats.totalMinutes).toBe(148);
    expect(r.stats.genreCounts).toMatchObject({ Action: 1, "Sci-Fi": 1 });
  });

  test("tekrar izleme olay ekler; üyelik sayaçları ve tür sayacı aynı kalır", async () => {
    await markMovieWatch(UID, movie(), "2026-02-01");
    await markMovieWatch(UID, movie(), "2026-03-01");

    const stored = (await col("watchedMovies")).movie_27205;
    expect(stored.watchEvents).toHaveLength(2);
    expect(stored.dateAdded).toBe("2026-03-01");

    const r = await root();
    expect(r.counts.watchedMovies).toBe(1);
    expect(r.stats.movies).toMatchObject({
      uniqueCount: 1,
      totalRewatchCount: 2,
      totalMinutes: 296,
    });
    expect(r.stats.genreCounts.Action).toBe(1);
  });

  test("tek olayı silmek kalan olaylar ve süreyle birlikte tutarlı bırakır", async () => {
    const first = await markMovieWatch(UID, movie(), "2026-02-01");
    await markMovieWatch(UID, movie(), "2026-03-01");

    await removeMovieWatchEvent(UID, 27205, first.id);

    const stored = (await col("watchedMovies")).movie_27205;
    expect(stored.watchEvents).toHaveLength(1);
    expect(stored.dateAdded).toBe("2026-03-01");
    const r = await root();
    expect(r.counts.watchedMovies).toBe(1);
    expect(r.stats.movies).toMatchObject({ uniqueCount: 1, totalRewatchCount: 1, totalMinutes: 148 });
  });

  test("son olayı silmek belgeyi ve tüm istatistiği geri alır", async () => {
    const only = await markMovieWatch(UID, movie(), "2026-02-01");
    await removeMovieWatchEvent(UID, 27205, only.id);

    expect(await col("watchedMovies")).toEqual({});
    const r = await root();
    expect(r.counts.watchedMovies).toBe(0);
    expect(r.statusIndex.movie[27205].isWatched).toBe(false);
    expect(r.stats.movies).toMatchObject({ uniqueCount: 0, totalRewatchCount: 0, totalMinutes: 0 });
    expect(r.stats.totalMinutes).toBe(0);
    expect(r.stats.genreCounts).toMatchObject({ Action: 0, "Sci-Fi": 0 });
    expect(getLocalList(UID, "watchedMovies")).toEqual({});
  });

  test("yayınlanmamış film izlendi yazılamaz ve hiçbir şey yazılmaz", async () => {
    await expect(
      markMovieWatch(UID, movie({ releaseDate: "2999-01-01", status: "Planned" }), "2026-02-01"),
    ).rejects.toMatchObject({ code: "unreleased" });
    await expect(
      markMovieWatch(UID, movie({ releaseDate: "", status: "" }), "2026-02-01"),
    ).rejects.toMatchObject({ code: "unknown-release" });
    expect(await col("watchedMovies")).toEqual({});
  });
});

// ── İzlenen diziler ──────────────────────────────────────────────────────────
describe("izlenen diziler", () => {
  test("sezon işaretleme: gömülü sezon, toplamlar, kök özet", async () => {
    await markSeason(UID, show(), season(1), [ep(1), ep(2)], "2026-02-01");

    const stored = (await col("watchedTv")).tv_1399;
    expect(stored.seasons).toHaveLength(1);
    expect(stored.seasons[0].episodes.map((e) => e.episodeNumber)).toEqual([1, 2]);
    expect(stored).toMatchObject({
      watchedSeasonCount: 1,
      watchedEpisodeCount: 2,
      totalMinutes: 100,
      watchCount: 1,
      name: "Game of Thrones",
    });
    expect(stored.watchEvents[0]).toMatchObject({ scope: "season", episodeCount: 2, minutes: 100 });

    const r = await root();
    expect(r.counts.watchedTv).toBe(1);
    expect(r.statusIndex.tv[1399].isWatched).toBe(true);
    expect(r.stats.tv.shows.unique).toBe(1);
    expect(r.stats.tv.episodes.total).toBe(2);
    expect(r.stats.tv.totalMinutes).toBe(100);
    expect(r.stats.totalMinutes).toBe(100);
    expect(r.stats.genreCounts.Drama).toBe(1);
  });

  test("ikinci sezon aynı dokümana eklenir; dizi sayacı artmaz", async () => {
    await markSeason(UID, show(), season(1), [ep(1), ep(2)], "2026-02-01");
    await markEpisodes(UID, show(), season(2), [ep(1)], "2026-02-05");

    const stored = (await col("watchedTv")).tv_1399;
    expect(stored.seasons.map((s) => s.seasonNumber)).toEqual([1, 2]);
    expect(stored.watchedEpisodeCount).toBe(3);
    const r = await root();
    expect(r.counts.watchedTv).toBe(1);
    expect(r.stats.tv.shows.unique).toBe(1);
    expect(r.stats.tv.episodes.total).toBe(3);
    expect(r.stats.genreCounts.Drama).toBe(1);
  });

  test("yayınlanmamış bölümler olaya girmez", async () => {
    await markSeason(
      UID,
      show(),
      season(1, 3),
      [ep(1), ep(2), ep(3, { releaseDate: "2999-01-01" })],
      "2026-02-01",
    );
    const stored = (await col("watchedTv")).tv_1399;
    expect(stored.seasons[0].episodes.map((e) => e.episodeNumber)).toEqual([1, 2]);
  });

  test("hiç yayınlanmış bölüm yoksa çağrı kapıdan döner ve hiçbir şey yazmaz", async () => {
    await expect(
      markEpisodes(UID, show(), season(1, 1), [ep(1, { releaseDate: "2999-01-01" })], "2026-02-01"),
    ).rejects.toMatchObject({ code: "unreleased" });
    expect(await col("watchedTv")).toEqual({});
  });

  test("tüm diziyi işaretle: tek olay, tüm sezonlar", async () => {
    const event = await markShow(
      UID,
      { ...show(), firstAirDate: "2011-04-17", status: "Ended" },
      [
        { ...season(1), episodes: [ep(1), ep(2)] },
        { ...season(2), episodes: [ep(1), ep(2)] },
      ],
      "2026-02-01",
    );
    expect(event.scope).toBe("show");
    expect(event.episodeCount).toBe(4);

    const stored = (await col("watchedTv")).tv_1399;
    expect(stored.watchedEpisodeCount).toBe(4);
    expect(stored.watchEvents).toHaveLength(1);
    const r = await root();
    expect(r.stats.tv.episodes.total).toBe(4);
    expect(r.stats.tv.totalMinutes).toBe(200);
  });

  test("izleme olayını silmek yalnız o olayın bölümlerini geri alır", async () => {
    await markSeason(UID, show(), season(1), [ep(1), ep(2)], "2026-02-01");
    const second = await markEpisodes(UID, show(), season(2), [ep(1)], "2026-02-05");

    await removeTvWatchEvent(UID, 1399, second.id);

    const stored = (await col("watchedTv")).tv_1399;
    expect(stored.seasons.map((s) => s.seasonNumber)).toEqual([1]);
    expect(stored.watchedEpisodeCount).toBe(2);
    expect(stored.watchEvents).toHaveLength(1);
    const r = await root();
    expect(r.counts.watchedTv).toBe(1);
    expect(r.stats.tv.episodes.total).toBe(2);
    expect(r.stats.tv.totalMinutes).toBe(100);
  });

  test("son olayı silmek diziyi tamamen kaldırır", async () => {
    const only = await markSeason(UID, show(), season(1), [ep(1), ep(2)], "2026-02-01");
    await removeTvWatchEvent(UID, 1399, only.id);

    expect(await col("watchedTv")).toEqual({});
    const r = await root();
    expect(r.counts.watchedTv).toBe(0);
    expect(r.statusIndex.tv[1399].isWatched).toBe(false);
    expect(r.stats.tv.shows.unique).toBe(0);
    expect(r.stats.tv.episodes.total).toBe(0);
    expect(r.stats.genreCounts.Drama).toBe(0);
    expect(getLocalList(UID, "watchedTv")).toEqual({});
  });

  test("unmarkShow diziyi ve tüm istatistiğini geri alır", async () => {
    await markSeason(UID, show(), season(1), [ep(1), ep(2)], "2026-02-01");
    await markEpisodes(UID, show(), season(2), [ep(1)], "2026-02-05");

    await unmarkShow(UID, 1399);

    expect(await col("watchedTv")).toEqual({});
    const r = await root();
    expect(r.counts.watchedTv).toBe(0);
    expect(r.statusIndex.tv[1399].isWatched).toBe(false);
    expect(r.stats.tv.shows.unique).toBe(0);
    expect(r.stats.tv.episodes.total).toBe(0);
    expect(r.stats.tv.totalMinutes).toBe(0);
    expect(r.stats.totalMinutes).toBe(0);
    expect(r.stats.genreCounts.Drama).toBe(0);
  });
});

// ── Özel listeler (kök dokümandaki dizi modeli) ──────────────────────────────
describe("özel listeler", () => {
  const item = (over = {}) => ({
    id: 550,
    type: "movie",
    name: "Fight Club",
    imagePath: "/fc.jpg",
    dateAdded: "2026-01-01",
    genres: ["Drama"],
    ...over,
  });

  test("ekle / yinelenen / çıkar", async () => {
    expect(await addToCustomRootList(UID, "Cuma", item())).toBe(true);
    expect(await addToCustomRootList(UID, "Cuma", item())).toBe(false);
    let r = await root();
    expect(r.Cuma).toHaveLength(1);
    expect(r.statusIndex.movie[550].isInOtherLists).toBe(true);

    expect(await removeFromCustomRootList(UID, "Cuma", "movie", 550)).toBe(true);
    expect(await removeFromCustomRootList(UID, "Cuma", "movie", 550)).toBe(false);
    r = await root();
    expect(r.Cuma).toEqual([]);
  });

  test("noktalı liste adı iç içe alana dönüşmez", async () => {
    await addToCustomRootList(UID, "S.W.A.T. Favorilerim", item());
    const r = await root();
    expect(Array.isArray(r["S.W.A.T. Favorilerim"])).toBe(true);
    expect(r.S).toBeUndefined();
  });

  testIfBulkCustom("toplu ekleme mevcut öğeleri korur, yalnız yenileri ekler", async () => {
    await addToCustomRootList(UID, "Sepet", item());
    const outcome = await addItemsToCustomRootList(UID, "Sepet", [
      item(),
      item({ id: 603, name: "The Matrix" }),
    ]);
    expect(outcome).toEqual({ added: 1, total: 2, created: false });
    const created = await addItemsToCustomRootList(UID, "Yeni", [item()]);
    expect(created.created).toBe(true);
  });

  testIfBulkCustom("dizi olmayan bir alanla aynı ada toplu ekleme çakışma hatası verir", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = require("firebase/firestore");
      await setDoc(doc(ctx.firestore(), "Lists", UID), { Harita: { a: 1 } });
    });
    await expect(
      addItemsToCustomRootList(UID, "Harita", [item()]),
    ).rejects.toMatchObject({ code: "list-name-conflict" });
  });

  test("yeniden adlandırma: ok / missing / taken", async () => {
    await addToCustomRootList(UID, "Eski", item());
    await addToCustomRootList(UID, "Dolu", item());
    expect(await renameCustomRootList(UID, "Eski", "Yeni")).toBe("ok");
    expect(await renameCustomRootList(UID, "Eski", "Baska")).toBe("missing");
    expect(await renameCustomRootList(UID, "Yeni", "Dolu")).toBe("taken");
    expect(await renameCustomRootList(UID, "Yeni", "favorites")).toBe("taken");
  });
});

// ── 3 Ekim 2026 denetimi: bulunan yazma hataları ─────────────────────────────
describe("denetim: izlenen filmi listeden çıkarmak", () => {
  // ListsScreen "izlenen filmler" listesinde bir öğeyi kaldırırken
  // removeFromList(uid, "watchedMovies", …) çağırıyordu. O fonksiyon yalnız
  // favoriler/izlenecekler için yazılmıştı: yanlış bayrağı (inWatchList) false
  // yapıyor, isWatched'ı true bırakıyor, istatistikleri hiç geri almıyordu.
  // Sonuç: film listeden kayboluyor ama detay ekranı hâlâ "izlendi" gösteriyordu.
  test("tüm izleme kaydı, istatistik ve izlendi bayrağı geri alınır", async () => {
    await markMovieWatch(UID, movie(), "2026-02-01");
    await markMovieWatch(UID, movie(), "2026-03-01");

    await removeFromList(UID, "watchedMovies", "movie", 27205);

    expect(await col("watchedMovies")).toEqual({});
    const r = await root();
    expect(r.statusIndex.movie[27205].isWatched).toBe(false);
    expect(r.counts.watchedMovies).toBe(0);
    expect(r.stats.movies).toMatchObject({ uniqueCount: 0, totalRewatchCount: 0, totalMinutes: 0 });
    expect(r.stats.totalMinutes).toBe(0);
    expect(r.stats.genreCounts).toMatchObject({ Action: 0, "Sci-Fi": 0 });
    expect(getLocalList(UID, "watchedMovies")).toEqual({});
  });

  test("izlenen listeden çıkarmak izlenecekler bayrağına DOKUNMAZ", async () => {
    await addToList(UID, "watchList", movie());
    await markMovieWatch(UID, movie(), "2026-02-01");
    await removeFromList(UID, "watchedMovies", "movie", 27205);
    const r = await root();
    expect(r.statusIndex.movie[27205].inWatchList).toBe(true);
    expect(r.counts.watchList).toBe(1);
  });

  test("izlenmemiş filmi çıkarmak hiçbir şeyi bozmaz", async () => {
    await removeFromList(UID, "watchedMovies", "movie", 27205);
    expect(await root()).toEqual({});
  });
});

describe("denetim: geçersiz izleme tarihi sessizce 'başarılı' dönmez", () => {
  // Servisler tarih çözülemeyince hiçbir şey yazmadan null dönüyordu; ekranlar
  // dönüş değerine bakmadan "izlendi olarak işaretlendi" toast'ı gösteriyordu.
  test.each([null, undefined, "", "yarın"])(
    "film: %p reddedilir ve hiçbir şey yazılmaz",
    async (bad) => {
      await expect(markMovieWatch(UID, movie(), bad)).rejects.toMatchObject({
        code: "invalid-request",
      });
      expect(await col("watchedMovies")).toEqual({});
    },
  );

  test("dizi: bölüm / sezon / tüm dizi reddedilir ve hiçbir şey yazılmaz", async () => {
    await expect(
      markEpisodes(UID, show(), season(1), [ep(1)], null),
    ).rejects.toMatchObject({ code: "invalid-request" });
    await expect(
      markSeason(UID, show(), season(1), [ep(1), ep(2)], "yarın"),
    ).rejects.toMatchObject({ code: "invalid-request" });
    await expect(
      markShow(
        UID,
        { ...show(), firstAirDate: "2011-04-17", status: "Ended" },
        [{ ...season(1), episodes: [ep(1)] }],
        "",
      ),
    ).rejects.toMatchObject({ code: "invalid-request" });
    expect(await col("watchedTv")).toEqual({});
  });
});

describe("denetim: eski kök watchedTv[] göçü yeni modeli EZMEZ", () => {
  // migrateLegacyShow merge'siz setDoc yapıyordu ve göç sonrası kök dizi hiç
  // silinmiyordu: eski kökten gelen hesaplarda ListStatusContext HER açılışta
  // diziyi eski verisiyle yeniden yazıp sonradan işaretlenen bölümleri/olayları siliyordu.
  const legacyShow = {
    id: 1399,
    name: "Game of Thrones (eski)",
    showEpisodeCount: 4,
    showSeasonCount: 2,
    addedShowDate: "2020-01-01",
    genres: ["Drama"],
    seasons: [
      {
        seasonNumber: 1,
        episodes: [{ episodeNumber: 1, episodeMinutes: 50, episodeWatchTime: "2020-01-01" }],
      },
    ],
  };

  const seedLegacyRoot = () =>
    testEnv.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = require("firebase/firestore");
      await setDoc(doc(ctx.firestore(), "Lists", UID), {
        watchedTv: [legacyShow],
        favorites: [],
        watchList: [],
        watchedMovies: [],
      });
    });

  test("belge yoksa eski veri taşınır", async () => {
    await seedLegacyRoot();
    expect(await migrateLegacyShow(UID, legacyShow)).toBe(true);
    const stored = (await col("watchedTv")).tv_1399;
    expect(stored.seasons[0].episodes).toHaveLength(1);
  });

  test("belge ZATEN varsa (yeni model) dokunulmaz — sonradan işaretlenenler kaybolmaz", async () => {
    await seedLegacyRoot();
    await migrateLegacyShow(UID, legacyShow);
    // Kullanıcı sonradan 2. sezonu işaretledi.
    await markEpisodes(
      UID,
      show(),
      season(2),
      [ep(1), ep(2)],
      "2026-02-01",
    );
    expect(await migrateLegacyShow(UID, legacyShow)).toBe(false);

    const stored = (await col("watchedTv")).tv_1399;
    expect(stored.seasons.map((entry) => entry.seasonNumber)).toEqual([1, 2]);
    expect(stored.watchEvents.length).toBeGreaterThan(0);
    expect(stored.watchedEpisodeCount).toBe(3);
  });

  test("göçten sonra kök dizi silinir; ikinci çağrı zararsız", async () => {
    await seedLegacyRoot();
    await migrateLegacyShow(UID, legacyShow);
    expect(await clearLegacyWatchedTv(UID)).toBe(true);
    expect(Array.isArray((await root()).watchedTv)).toBe(false);
    expect(await clearLegacyWatchedTv(UID)).toBe(false);
    // Diğer boş eski diziler (App.js'in yazdığı) bu fonksiyonun işi değil.
    expect((await root()).favorites).toEqual([]);
  });
});

describe("ensureListsRoot", () => {
  test("yoksa oluşturur; varsa DOKUNMAZ (sayaç/istatistik silinmez)", async () => {
    expect(await ensureListsRoot(UID)).toBe(true);
    expect(await root()).toMatchObject({ favorites: [], watchList: [], watchedMovies: [], watchedTv: [] });

    await addToList(UID, "favorites", movie());
    expect(await ensureListsRoot(UID)).toBe(false);
    const r = await root();
    expect(r.counts.favorites).toBe(1);
    expect(r.statusIndex.movie[27205].inFavorites).toBe(true);
  });

  test("başkasının kök dokümanını oluşturamaz (kurallar)", async () => {
    useUser("bob");
    await assertFails(ensureListsRoot(UID));
  });
});

describe("toplu ekleme (addItemsToList)", () => {
  const many = (count, start = 1000) =>
    Array.from({ length: count }, (_, i) => ({
      id: start + i,
      type: i % 2 ? "tv" : "movie",
      name: `Eser ${start + i}`,
      imagePath: null,
    }));

  test("yinelenenler tekilleşir, sayaç yalnız yeni öğeler için artar, yerel harita tek seferde dolar", async () => {
    const items = many(3);
    const result = await addItemsToList(UID, "watchList", [...items, items[0]]);
    expect(result).toEqual({ added: 3, existing: 0 });
    expect(Object.keys(await col("watchList")).sort()).toEqual([
      "movie_1000",
      "movie_1002",
      "tv_1001",
    ]);
    const r = await root();
    expect(r.counts.watchList).toBe(3);
    expect(r.statusIndex.movie[1000].inWatchList).toBe(true);
    expect(r.statusIndex.tv[1001].inWatchList).toBe(true);
    expect(Object.keys(getLocalList(UID, "watchList"))).toHaveLength(3);

    const again = await addItemsToList(UID, "watchList", [...items, ...many(1, 2000)]);
    expect(again).toEqual({ added: 1, existing: 3 });
    expect((await root()).counts.watchList).toBe(4);
  });

  test("100'den büyük liste parçalara bölünür ve sayaç tutarlı kalır", async () => {
    const result = await addItemsToList(UID, "favorites", many(230));
    expect(result).toEqual({ added: 230, existing: 0 });
    expect(Object.keys(await col("favorites"))).toHaveLength(230);
    expect((await root()).counts.favorites).toBe(230);
    expect(Object.keys(getLocalList(UID, "favorites"))).toHaveLength(230);
  });

  test("boş girdi ve geçersiz liste", async () => {
    expect(await addItemsToList(UID, "watchList", [])).toEqual({ added: 0, existing: 0 });
    expect(await addItemsToList(UID, "watchList", [{ id: null, type: "movie" }])).toEqual({
      added: 0,
      existing: 0,
    });
    await expect(addItemsToList(UID, "watchedMovies", many(1))).rejects.toMatchObject({
      code: "invalid-request",
    });
  });
});

describe("denetim: yanlış liste anahtarı sessizce yanlış yere yazmaz", () => {
  test("addToList yalnız favoriler/izlenecekler için çalışır", async () => {
    // watchedMovies'a addToList ile yazmak izleme olayı üretmeden belge
    // yaratıyor ve yanlış bayrağı (inWatchList) açıyordu.
    await expect(addToList(UID, "watchedMovies", movie())).rejects.toMatchObject({
      code: "invalid-request",
    });
    await expect(addToList(UID, "watchedTv", movie())).rejects.toMatchObject({
      code: "invalid-request",
    });
    expect(await root()).toEqual({});
  });
});

describe("denetim: özel liste adı ayrılmış alanla çakışamaz", () => {
  // Kök doküman sayaçları (`counts`, `stats`, `statusIndex`…) harita alanıdır.
  // Aynı adla dizi yazmak, doküman henüz o alanı içermiyorsa çakışma kontrolünden
  // geçip alanı DİZİYE çeviriyor; sonraki her `increment` yazımı bozuluyordu.
  const item = { id: 550, type: "movie", name: "Fight Club" };

  test.each(["counts", "stats", "statusIndex", "activityIndex", "customLists", "favorites"])(
    "%s adıyla ekleme reddedilir ve hiçbir şey yazılmaz",
    async (name) => {
      await expect(addToCustomRootList(UID, name, item)).rejects.toMatchObject({
        code: "list-name-reserved",
      });
      if (addItemsToCustomRootList) {
        await expect(addItemsToCustomRootList(UID, name, [item])).rejects.toMatchObject({
          code: "list-name-reserved",
        });
      }
      expect(await root()).toEqual({});
    },
  );

  test("ayrılmış adda çıkarma sessizce false döner", async () => {
    expect(await removeFromCustomRootList(UID, "counts", "movie", 550)).toBe(false);
  });
});

describe("denetim: özel listeyi yeniden sıralama", () => {
  const seedCustomList = async (name, entries) => {
    for (const entry of entries) {
      // eslint-disable-next-line no-await-in-loop
      await addToCustomRootList(UID, name, entry);
    }
  };
  const items = [
    { id: 1, type: "movie", name: "A" },
    { id: 2, type: "movie", name: "B" },
    { id: 3, type: "tv", name: "C" },
    { id: 2, type: "tv", name: "D" }, // film 2 ile aynı id, ayrı eser
  ];

  test("sıra uygulanır; aynı id'li film/dizi karışmaz; noktalı ad bozulmaz", async () => {
    await seedCustomList("S.W.A.T. Listem", items);
    await reorderCustomRootList(UID, "S.W.A.T. Listem", [
      { id: 2, type: "tv" },
      { id: 3, type: "tv" },
      { id: 1, type: "movie" },
      { id: 2, type: "movie" },
    ]);
    const r = await root();
    expect(r["S.W.A.T. Listem"].map((entry) => entry.name)).toEqual(["D", "C", "A", "B"]);
    expect(r.S).toBeUndefined();
  });

  test("istemcinin görmediği (başka cihazda eklenen) öğe KAYBOLMAZ", async () => {
    await seedCustomList("Liste", items);
    await reorderCustomRootList(UID, "Liste", [
      { id: 2, type: "movie" },
      { id: 1, type: "movie" },
    ]);
    const names = (await root()).Liste.map((entry) => entry.name);
    expect(names.slice(0, 2)).toEqual(["B", "A"]);
    expect(names.sort()).toEqual(["A", "B", "C", "D"]);
  });

  test("olmayan liste sessizce false döner", async () => {
    expect(await reorderCustomRootList(UID, "Yok", [{ id: 1, type: "movie" }])).toBe(false);
  });
});

// ── Kurallar: başkası yazamaz ────────────────────────────────────────────────
describe("güvenlik kuralları", () => {
  test("başka kullanıcının listesine yazılamaz", async () => {
    useUser("bob");
    await assertFails(addToList(UID, "favorites", movie()));
  });
});
