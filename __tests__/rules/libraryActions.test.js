// Orkestrasyon katmanının (services/libraryActions) emülatör testleri: gerçek
// servisler + gerçek Firestore kuralları. Odak: sıra, iyimser durum/bindirme,
// geri alma, hata sınıflaması ve dizi sezonlarının çekilmesi.

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
jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn() } }));

const axios = require("axios").default;
const {
  createEmulatorEnv,
  readRoot,
  readCollection,
} = require("../helpers/libraryEmulator");
const actions = require("../../services/libraryActions");
const { getLocalList, setLocalList } = require("../../services/listSyncService");
const {
  getOverlay,
  EMPTY_OVERLAY,
  __resetOverlayForTests,
} = require("../../services/libraryOverlay");
const { markMovieWatch } = require("../../services/listItemsService");
const { markSeason } = require("../../services/watchedTvService");

const UID = "alice";
let testEnv;

const useUser = (uid) => {
  mockHolder.db = testEnv.authenticatedContext(uid).firestore();
};
const root = () => readRoot(mockHolder.db, UID);
const col = (name) => readCollection(mockHolder.db, UID, name);
const tick = () => new Promise((resolve) => setImmediate(resolve));

beforeAll(async () => {
  testEnv = await createEmulatorEnv("seelogd-library-actions");
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  __resetOverlayForTests();
  axios.get.mockReset();
  useUser(UID);
  ["favorites", "watchList", "watchedMovies", "watchedTv", "customItems"].forEach(
    (key) => setLocalList(UID, key, {}),
  );
});

const item = (over = {}) => ({
  id: 550,
  type: "movie",
  name: "Fight Club",
  imagePath: "/fc.jpg",
  dateAdded: "2026-01-01",
  genres: ["Drama"],
  minutes: 139,
  ...over,
});

const movieForWatch = (over = {}) => ({
  ...item({ id: 27205, name: "Inception", minutes: 148 }),
  releaseDate: "2010-07-16",
  status: "Released",
  ...over,
});

// ── Üyelik: favoriler / izlenecekler ─────────────────────────────────────────
describe("setListMembership", () => {
  test("ekleme: yazılır, yerel harita güncellenir, niyet bindirmesi hemen açılır", async () => {
    const pending = actions.setListMembership({
      uid: UID,
      listKey: "favorites",
      item: item(),
      desired: true,
    });

    // Çağrının hemen ardından (sunucu yanıtı beklenmeden) bindirme açık.
    expect(getOverlay(UID).movie[550]).toEqual({ inFavorites: true });
    // Kuyruk görevi başlayınca yerel harita da sunucudan ÖNCE güncellenir.
    await tick();
    expect(getLocalList(UID, "favorites").movie_550).toBeTruthy();

    const result = await pending;
    expect(result.status).toBe("added");
    expect(Object.keys(await col("favorites"))).toEqual(["movie_550"]);
    expect((await root()).statusIndex.movie[550].inFavorites).toBe(true);
  });

  test("çıkarma: belge silinir, yerel harita boşalır", async () => {
    await actions.setListMembership({ uid: UID, listKey: "watchList", item: item(), desired: true });
    const result = await actions.setListMembership({
      uid: UID,
      listKey: "watchList",
      item: { id: 550, type: "movie" },
      desired: false,
    });
    expect(result.status).toBe("removed");
    expect(await col("watchList")).toEqual({});
    expect(getLocalList(UID, "watchList")).toEqual({});
    expect((await root()).counts.watchList).toBe(0);
  });

  test("ekle→çıkar→ekle→çıkar hızlı dokunuş: sonuç SON niyet, sayaç tutarlı", async () => {
    const calls = [true, false, true, false, true].map((desired) =>
      actions.setListMembership({ uid: UID, listKey: "favorites", item: item(), desired }),
    );
    // Son niyet ekle: bindirme bunu göstermeli.
    expect(getOverlay(UID).movie[550]).toEqual({ inFavorites: true });
    await Promise.all(calls);

    expect(Object.keys(await col("favorites"))).toEqual(["movie_550"]);
    const r = await root();
    expect(r.counts.favorites).toBe(1);
    expect(r.statusIndex.movie[550].inFavorites).toBe(true);
    expect(getLocalList(UID, "favorites").movie_550).toBeTruthy();
  });

  test("hızlı ekle→çıkar: sunucu ve yerel önbellek AYNI sonuca varır", async () => {
    const calls = [true, false].map((desired) =>
      actions.setListMembership({ uid: UID, listKey: "watchList", item: item(), desired }),
    );
    await Promise.all(calls);
    expect(await col("watchList")).toEqual({});
    expect(getLocalList(UID, "watchList")).toEqual({});
    expect((await root()).counts.watchList).toBe(0);
  });

  test("yazım düşerse yerel harita ESKİ hâline döner, bindirme hemen kalkar, hata sınıflanır", async () => {
    useUser("bob"); // kurallar: başkasının listesine yazılamaz
    await expect(
      actions.setListMembership({ uid: UID, listKey: "favorites", item: item(), desired: true }),
    ).rejects.toMatchObject({ name: "LibraryError", code: "permission", retryable: false });
    expect(getLocalList(UID, "favorites")).toEqual({});
    expect(getOverlay(UID)).toBe(EMPTY_OVERLAY);
  });

  test("düşen ÇIKARMA yerel haritadaki öğeyi geri koyar", async () => {
    await actions.setListMembership({ uid: UID, listKey: "favorites", item: item(), desired: true });
    const before = getLocalList(UID, "favorites").movie_550;
    useUser("bob");
    await expect(
      actions.setListMembership({
        uid: UID,
        listKey: "favorites",
        item: { id: 550, type: "movie" },
        desired: false,
      }),
    ).rejects.toMatchObject({ code: "permission" });
    expect(getLocalList(UID, "favorites").movie_550).toEqual(before);
  });

  test("film ve dizi aynı id ile birbirine karışmaz", async () => {
    await Promise.all([
      actions.setListMembership({
        uid: UID,
        listKey: "watchList",
        item: item({ id: 1399, type: "movie" }),
        desired: true,
      }),
      actions.setListMembership({
        uid: UID,
        listKey: "watchList",
        item: { id: 1399, type: "tv", name: "GoT" },
        desired: true,
      }),
    ]);
    expect(Object.keys(await col("watchList")).sort()).toEqual(["movie_1399", "tv_1399"]);
    expect(getOverlay(UID).tv[1399]).toEqual({ inWatchList: true });
  });

  test("eksik parametre ve ayrılmış ad: reddedilmiş promise (senkron fırlatma yok)", async () => {
    await expect(
      actions.setListMembership({ uid: "", listKey: "favorites", item: item(), desired: true }),
    ).rejects.toMatchObject({ code: "invalid-request" });
    await expect(
      actions.setListMembership({ uid: UID, listKey: "favorites", item: {}, desired: true }),
    ).rejects.toMatchObject({ code: "invalid-request" });
    await expect(
      actions.setListMembership({ uid: UID, listKey: "counts", item: item(), desired: true }),
    ).rejects.toMatchObject({ code: "list-name-reserved" });
    await expect(
      actions.setListMembership({ uid: UID, listKey: "watchedMovies", item: item(), desired: true }),
    ).rejects.toMatchObject({ code: "list-name-reserved" });
    expect(await root()).toEqual({});
    expect(getOverlay(UID)).toBe(EMPTY_OVERLAY);
  });
});

describe("setListMembership: özel listeler", () => {
  test("ekle / yinelenen / çıkar durumları", async () => {
    const add = () =>
      actions.setListMembership({ uid: UID, listKey: "Cuma", item: item(), desired: true });
    expect((await add()).status).toBe("added");
    expect((await add()).status).toBe("unchanged");
    expect((await root()).Cuma).toHaveLength(1);

    const remove = () =>
      actions.setListMembership({
        uid: UID,
        listKey: "Cuma",
        item: { id: 550, type: "movie" },
        desired: false,
      });
    expect((await remove()).status).toBe("removed");
    expect((await remove()).status).toBe("unchanged");
  });

  test("aynı anda iki farklı özel listeye ekleme: ikisi de yazılır", async () => {
    await Promise.all([
      actions.setListMembership({ uid: UID, listKey: "A.listesi", item: item(), desired: true }),
      actions.setListMembership({ uid: UID, listKey: "B listesi", item: item(), desired: true }),
      actions.setListMembership({
        uid: UID,
        listKey: "B listesi",
        item: item({ id: 603, name: "The Matrix" }),
        desired: true,
      }),
    ]);
    const r = await root();
    expect(r["A.listesi"]).toHaveLength(1);
    expect(r["B listesi"]).toHaveLength(2);
    expect(r.A).toBeUndefined();
  });

  test("reorderCustomList sıralamayı yazar", async () => {
    await actions.setListMembership({ uid: UID, listKey: "Sıra", item: item({ id: 1, name: "A" }), desired: true });
    await actions.setListMembership({ uid: UID, listKey: "Sıra", item: item({ id: 2, name: "B" }), desired: true });
    await actions.reorderCustomList({
      uid: UID,
      listName: "Sıra",
      orderedItems: [{ id: 2, type: "movie" }, { id: 1, type: "movie" }],
    });
    expect((await root()).Sıra.map((entry) => entry.name)).toEqual(["B", "A"]);
  });
});

describe("addManyToMembership", () => {
  const items = [
    { id: 1, type: "movie", name: "A" },
    { id: 2, type: "tv", name: "B" },
  ];

  test("tek işlemde yazılır; bindirme hemen açılır, mevcutlar sayılmaz", async () => {
    await actions.setListMembership({ uid: UID, listKey: "watchList", item: items[0], desired: true });
    const pending = actions.addManyToMembership({ uid: UID, listKey: "watchList", items });
    expect(getOverlay(UID).movie[1]).toEqual({ inWatchList: true });
    expect(getOverlay(UID).tv[2]).toEqual({ inWatchList: true });
    await expect(pending).resolves.toEqual({ added: 1, existing: 1 });
    expect((await root()).counts.watchList).toBe(2);
    expect(Object.keys(getLocalList(UID, "watchList")).sort()).toEqual(["movie_1", "tv_2"]);
  });

  test("yazım düşerse tüm bindirmeler hemen kalkar", async () => {
    useUser("bob");
    await expect(
      actions.addManyToMembership({ uid: UID, listKey: "favorites", items }),
    ).rejects.toMatchObject({ code: "permission" });
    expect(getOverlay(UID)).toBe(EMPTY_OVERLAY);
  });

  test("geçersiz liste reddedilir", async () => {
    await expect(
      actions.addManyToMembership({ uid: UID, listKey: "watchedMovies", items }),
    ).rejects.toMatchObject({ code: "invalid-request" });
    await expect(
      actions.addManyToMembership({ uid: UID, listKey: "favorites", items: [] }),
    ).resolves.toEqual({ added: 0, existing: 0 });
  });
});

// ── İzlenen filmler ──────────────────────────────────────────────────────────
describe("markMovieWatched / removeMovieWatch", () => {
  test("izlendi yazılır; bindirme açılır", async () => {
    const pending = actions.markMovieWatched({
      uid: UID,
      movie: movieForWatch(),
      watchDate: "2026-02-01",
    });
    expect(getOverlay(UID).movie[27205]).toEqual({ isWatched: true });
    const { event } = await pending;
    expect(event.id).toBeTruthy();
    expect((await col("watchedMovies")).movie_27205.watchEvents).toHaveLength(1);
  });

  test("yayınlanmamış film: ağa/yazıma çıkmadan reddedilir, bindirme HİÇ açılmaz", async () => {
    const pending = actions.markMovieWatched({
      uid: UID,
      movie: movieForWatch({ releaseDate: "2999-01-01", status: "Planned" }),
      watchDate: "2026-02-01",
    });
    expect(getOverlay(UID)).toBe(EMPTY_OVERLAY);
    await expect(pending).rejects.toMatchObject({ code: "unreleased", retryable: false });
    await expect(
      actions.markMovieWatched({
        uid: UID,
        movie: movieForWatch({ releaseDate: "", status: "" }),
        watchDate: "2026-02-01",
      }),
    ).rejects.toMatchObject({ code: "unknown-release" });
    await expect(
      actions.markMovieWatched({ uid: UID, movie: movieForWatch(), watchDate: null }),
    ).rejects.toMatchObject({ code: "invalid-request" });
    expect(await col("watchedMovies")).toEqual({});
  });

  test("art arda iki izleme: iki ayrı olay, üyelik sayacı 1", async () => {
    await Promise.all([
      actions.markMovieWatched({ uid: UID, movie: movieForWatch(), watchDate: "2026-02-01" }),
      actions.markMovieWatched({ uid: UID, movie: movieForWatch(), watchDate: "2026-02-02" }),
    ]);
    const stored = (await col("watchedMovies")).movie_27205;
    expect(stored.watchEvents).toHaveLength(2);
    const r = await root();
    expect(r.counts.watchedMovies).toBe(1);
    expect(r.stats.movies.totalRewatchCount).toBe(2);
  });

  test("olay silme", async () => {
    const { event } = await actions.markMovieWatched({
      uid: UID,
      movie: movieForWatch(),
      watchDate: "2026-02-01",
    });
    await actions.removeMovieWatch({ uid: UID, movieId: 27205, eventId: event.id });
    expect(await col("watchedMovies")).toEqual({});
  });

  test("yazım düşerse bindirme hemen kalkar", async () => {
    useUser("bob");
    await expect(
      actions.markMovieWatched({ uid: UID, movie: movieForWatch(), watchDate: "2026-02-01" }),
    ).rejects.toMatchObject({ code: "permission" });
    expect(getOverlay(UID)).toBe(EMPTY_OVERLAY);
  });
});

// ── İzlenen diziler ──────────────────────────────────────────────────────────
describe("izlenen diziler", () => {
  const tmdbShow = (over = {}) => ({
    id: 1399,
    name: "Game of Thrones",
    poster_path: "/got.jpg",
    first_air_date: "2011-04-17",
    status: "Ended",
    number_of_episodes: 5,
    number_of_seasons: 2,
    genres: [{ id: 18, name: "Drama" }],
    seasons: [
      { season_number: 0, episode_count: 2, poster_path: null },
      { season_number: 1, episode_count: 3, poster_path: "/s1.jpg" },
      { season_number: 2, episode_count: 2, poster_path: "/s2.jpg" },
    ],
    ...over,
  });

  const tmdbSeason = (n, count) => ({
    data: {
      episodes: Array.from({ length: count }, (_, i) => ({
        episode_number: i + 1,
        name: `S${n}E${i + 1}`,
        runtime: 50,
        vote_average: 8.1,
        still_path: null,
        air_date: "2011-04-17",
      })),
    },
  });

  const mockSeasons = () =>
    axios.get.mockImplementation(async (url) => {
      const match = /season\/(\d+)$/.exec(url);
      const n = Number(match[1]);
      return tmdbSeason(n, n === 1 ? 3 : 2);
    });

  const showArgs = (over = {}) => ({
    uid: UID,
    details: tmdbShow(),
    watchDate: "2026-02-01",
    apiKey: "Bearer test",
    language: "tr",
    ...over,
  });

  test("tüm diziyi işaretle: özel bölümler atlanır, tek olay yazılır", async () => {
    mockSeasons();
    const result = await actions.markShowWatched(showArgs());
    expect(result.status).toBe("added");
    // 0. sezon çekilmez.
    expect(axios.get.mock.calls.map(([url]) => url).sort()).toEqual([
      "https://api.themoviedb.org/3/tv/1399/season/1",
      "https://api.themoviedb.org/3/tv/1399/season/2",
    ]);
    const stored = (await col("watchedTv")).tv_1399;
    expect(stored.watchedEpisodeCount).toBe(5);
    expect(stored.watchEvents).toHaveLength(1);
    expect((await root()).stats.tv.episodes.total).toBe(5);
  });

  test("BİR sezon düşerse hiçbir şey yazılmaz, bindirme açılmaz, hata sınıflanır", async () => {
    axios.get.mockImplementation(async (url) => {
      if (url.endsWith("season/2")) {
        throw Object.assign(new Error("Request failed with status code 500"), {
          code: "ERR_BAD_RESPONSE",
        });
      }
      return tmdbSeason(1, 3);
    });
    await expect(actions.markShowWatched(showArgs())).rejects.toMatchObject({
      code: "seasons-incomplete",
      retryable: true,
    });
    expect(await col("watchedTv")).toEqual({});
    expect(getOverlay(UID)).toBe(EMPTY_OVERLAY);
  });

  test("ağ yoksa hata 'offline' olarak sınıflanır", async () => {
    axios.get.mockRejectedValue(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }));
    await expect(actions.markShowWatched(showArgs())).rejects.toMatchObject({
      code: "offline",
      retryable: true,
    });
  });

  test("yayınlanmamış dizi: sezonlar HİÇ çekilmez", async () => {
    await expect(
      actions.markShowWatched(
        showArgs({ details: tmdbShow({ first_air_date: "2999-01-01", status: "Planned" }) }),
      ),
    ).rejects.toMatchObject({ code: "unreleased" });
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("hiç işaretlenebilir sezon yok: empty-show, yazım yok", async () => {
    const result = await actions.markShowWatched(
      showArgs({ details: tmdbShow({ seasons: [{ season_number: 0, episode_count: 3 }] }) }),
    );
    expect(result).toEqual({ status: "empty-show", event: null });
    expect(await col("watchedTv")).toEqual({});
  });

  test("hiçbir bölümü yayınlanmamış dizi: empty-show (sessizce 'eklendi' DEĞİL)", async () => {
    axios.get.mockImplementation(async () => ({
      data: {
        episodes: [{ episode_number: 1, name: "E1", runtime: 40, air_date: null }],
      },
    }));
    const result = await actions.markShowWatched(
      showArgs({
        details: tmdbShow({ seasons: [{ season_number: 1, episode_count: 1, poster_path: null }] }),
      }),
    );
    expect(result.status).toBe("empty-show");
    expect(await col("watchedTv")).toEqual({});
  });

  test("sezon işaretle: yalnız o sezon çekilir ve yazılır", async () => {
    mockSeasons();
    const result = await actions.markSeasonWatched({
      uid: UID,
      details: tmdbShow(),
      season: tmdbShow().seasons[1],
      watchDate: "2026-02-01",
      apiKey: "Bearer test",
      language: "en",
    });
    expect(result.status).toBe("added");
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][1].params.language).toBe("en-US");
    const stored = (await col("watchedTv")).tv_1399;
    expect(stored.seasons.map((s) => s.seasonNumber)).toEqual([1]);
    expect(stored.watchedEpisodeCount).toBe(3);
  });

  test("ARDIŞIK bölüm işaretleme (Sıradaki kuyruğu): hepsi kaydolur, sayaçlar tutarlı", async () => {
    const showMeta = {
      id: 1399,
      name: "Game of Thrones",
      showEpisodeCount: 5,
      showSeasonCount: 2,
      imagePath: "/got.jpg",
      genres: ["Drama"],
    };
    const seasonMeta = { seasonNumber: 1, seasonPosterPath: "/s1.jpg", seasonEpisodes: 6 };
    const results = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((n) =>
        actions.markEpisodeWatched({
          uid: UID,
          showMeta,
          seasonMeta,
          episode: {
            episodeNumber: n,
            episodeName: `E${n}`,
            episodeMinutes: 50,
            releaseDate: "2011-04-17",
          },
          watchDate: "2026-02-01",
          source: "up_next",
        }),
      ),
    );
    expect(results.every((r) => r.status === "added")).toBe(true);
    const stored = (await col("watchedTv")).tv_1399;
    expect(stored.watchedEpisodeCount).toBe(6);
    expect(stored.watchEvents).toHaveLength(6);
    const r = await root();
    expect(r.counts.watchedTv).toBe(1);
    expect(r.stats.tv.shows.unique).toBe(1);
    expect(r.stats.tv.episodes.total).toBe(6);
    expect(r.stats.tv.totalMinutes).toBe(300);
    expect(r.stats.genreCounts.Drama).toBe(1);
  });

  test("yayınlanmamış bölüm: yazım yok, 'empty-episode' DEĞİL hata (kapı kapalı)", async () => {
    await expect(
      actions.markEpisodeWatched({
        uid: UID,
        showMeta: { id: 1, name: "X", genres: [] },
        seasonMeta: { seasonNumber: 1 },
        episode: { episodeNumber: 1, releaseDate: "2999-01-01" },
        watchDate: "2026-02-01",
      }),
    ).rejects.toMatchObject({ code: "unreleased" });
    expect(await col("watchedTv")).toEqual({});
    expect(getOverlay(UID)).toBe(EMPTY_OVERLAY);
  });

  test("izleme olayı silme", async () => {
    mockSeasons();
    const { event } = await actions.markShowWatched(showArgs());
    await actions.removeTvWatch({ uid: UID, showId: 1399, eventId: event.id });
    expect(await col("watchedTv")).toEqual({});
    expect((await root()).counts.watchedTv).toBe(0);
  });
});

// ── Liste ekranından kaldırma ────────────────────────────────────────────────
describe("removeFromListAny", () => {
  test("izlenen film: tüm kayıt + istatistik + izlendi bayrağı geri alınır", async () => {
    await markMovieWatch(UID, movieForWatch(), "2026-02-01");
    await markMovieWatch(UID, movieForWatch(), "2026-03-01");
    await actions.removeFromListAny({ uid: UID, listName: "watchedMovies", type: "movie", id: 27205 });
    expect(await col("watchedMovies")).toEqual({});
    const r = await root();
    expect(r.statusIndex.movie[27205].isWatched).toBe(false);
    expect(r.stats.movies.totalRewatchCount).toBe(0);
    expect(r.stats.totalMinutes).toBe(0);
  });

  test("izlenen dizi: tüm kayıt geri alınır", async () => {
    await markSeason(
      UID,
      { id: 1399, name: "GoT", showEpisodeCount: 2, showSeasonCount: 1, genres: ["Drama"] },
      { seasonNumber: 1, seasonEpisodes: 2 },
      [
        { episodeNumber: 1, episodeMinutes: 50, releaseDate: "2011-04-17" },
        { episodeNumber: 2, episodeMinutes: 50, releaseDate: "2011-04-24" },
      ],
      "2026-02-01",
    );
    await actions.removeFromListAny({ uid: UID, listName: "watchedTv", type: "tv", id: 1399 });
    expect(await col("watchedTv")).toEqual({});
    const r = await root();
    expect(r.statusIndex.tv[1399].isWatched).toBe(false);
    expect(r.stats.tv.episodes.total).toBe(0);
  });

  test("favori / özel liste", async () => {
    await actions.setListMembership({ uid: UID, listKey: "favorites", item: item(), desired: true });
    await actions.setListMembership({ uid: UID, listKey: "Cuma", item: item(), desired: true });
    await actions.removeFromListAny({ uid: UID, listName: "favorites", type: "movie", id: 550 });
    await actions.removeFromListAny({ uid: UID, listName: "Cuma", type: "movie", id: 550 });
    expect(await col("favorites")).toEqual({});
    expect((await root()).Cuma).toEqual([]);
  });
});
