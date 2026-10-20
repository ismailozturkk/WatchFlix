// services/listQuickAdd.addMediaToList — liste ekranındaki global arama "hızlı ekle"
// yolu. Gerçek servisler + gerçek Firestore kuralları; yalnız TMDB (axios, olgu
// çekici, fuzzy arama, önbellekli okuma) ve platform bağımlılıkları sahte.

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
jest.mock("../../services/tmdbFacts", () => ({ fetchMediaFacts: jest.fn() }));
jest.mock("../../services/fuzzyMediaSearch", () => ({
  searchMediaWithFuzzyFallback: jest.fn(),
}));
jest.mock("../../utils/cachedRead", () => ({ cachedTmdb: jest.fn() }));
// Ortak liste servisi avatar PNG'lerini require ediyor (node'da yüklenemez); bu yol test dışı.
jest.mock("../../services/sharedListsService", () => ({ addItemToSharedList: jest.fn() }));

const axios = require("axios").default;
const { fetchMediaFacts } = require("../../services/tmdbFacts");
const {
  createEmulatorEnv,
  readRoot,
  readCollection,
} = require("../helpers/libraryEmulator");
const { addMediaToList } = require("../../services/listQuickAdd");
const { setLocalList } = require("../../services/listSyncService");
const { __resetOverlayForTests } = require("../../services/libraryOverlay");

const UID = "alice";
let testEnv;

beforeAll(async () => {
  testEnv = await createEmulatorEnv("seelogd-quick-add");
});
afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  __resetOverlayForTests();
  axios.get.mockReset();
  fetchMediaFacts.mockReset();
  mockHolder.db = testEnv.authenticatedContext(UID).firestore();
  ["favorites", "watchList", "watchedMovies", "watchedTv", "customItems"].forEach((key) =>
    setLocalList(UID, key, {}),
  );
});

const root = () => readRoot(mockHolder.db, UID);
const col = (name) => readCollection(mockHolder.db, UID, name);

const movie = { id: 27205, type: "movie", title: "Inception", poster_path: "/i.jpg" };
const tv = { id: 1399, type: "tv", title: "Game of Thrones", poster_path: "/got.jpg" };

const base = { uid: UID, apiKey: "Bearer t", language: "tr" };

const movieFacts = (over = {}) => ({
  id: 27205,
  type: "movie",
  title: "Inception",
  releaseDate: "2010-07-16",
  status: "Released",
  genres: ["Action"],
  minutes: 148,
  episodeMinutes: null,
  episodeCount: null,
  seasonCount: null,
  ...over,
});

describe("addMediaToList", () => {
  test("favoriler / izlenecekler: süre olgusuyla zenginleşmiş öğe yazılır", async () => {
    fetchMediaFacts.mockResolvedValue(movieFacts());
    const result = await addMediaToList({ ...base, listName: "favorites", media: movie });
    expect(result.status).toBe("added");
    const stored = (await col("favorites")).movie_27205;
    expect(stored).toMatchObject({ name: "Inception", minutes: 148, genres: ["Action"] });
    expect((await root()).statusIndex.movie[27205].inFavorites).toBe(true);
  });

  test("olgu çekilemese de ekleme yapılır (süresiz öğe hiç eklenmemişten iyidir)", async () => {
    fetchMediaFacts.mockResolvedValue(null);
    const result = await addMediaToList({ ...base, listName: "watchList", media: movie });
    expect(result.status).toBe("added");
    expect((await col("watchList")).movie_27205.minutes).toBeUndefined();
  });

  test("izlenen film: yayınlanmışsa olay yazılır", async () => {
    fetchMediaFacts.mockResolvedValue(movieFacts());
    const result = await addMediaToList({
      ...base,
      listName: "watchedMovies",
      media: movie,
      watchDate: "2026-02-01",
    });
    expect(result.status).toBe("added");
    const stored = (await col("watchedMovies")).movie_27205;
    expect(stored.watchEvents).toHaveLength(1);
    expect(stored.dateAdded).toBe("2026-02-01");
    expect((await root()).stats.movies.totalMinutes).toBe(148);
  });

  test("izlenen film: yayınlanmamış / tarihi bilinmeyen → durum döner, yazım yok", async () => {
    fetchMediaFacts.mockResolvedValue(movieFacts({ releaseDate: "2999-01-01", status: "Planned" }));
    expect(
      (await addMediaToList({ ...base, listName: "watchedMovies", media: movie, watchDate: "2026-02-01" }))
        .status,
    ).toBe("unreleased");
    fetchMediaFacts.mockResolvedValue(movieFacts({ releaseDate: "", status: "" }));
    expect(
      (await addMediaToList({ ...base, listName: "watchedMovies", media: movie, watchDate: "2026-02-01" }))
        .status,
    ).toBe("unknown-release");
    expect(await col("watchedMovies")).toEqual({});
  });

  test("izlenen film: yayın bilgisi alınamazsa HATA (sessiz engelleme değil)", async () => {
    fetchMediaFacts.mockResolvedValue(null);
    await expect(
      addMediaToList({ ...base, listName: "watchedMovies", media: movie, watchDate: "2026-02-01" }),
    ).rejects.toMatchObject({ name: "LibraryError", code: "unknown" });
  });

  test("özel liste: ekle → ikinci kez 'duplicate'", async () => {
    fetchMediaFacts.mockResolvedValue(movieFacts());
    const first = await addMediaToList({ ...base, listName: "Cuma", media: movie });
    const second = await addMediaToList({ ...base, listName: "Cuma", media: movie });
    expect(first.status).toBe("added");
    expect(second.status).toBe("duplicate");
    expect((await root()).Cuma).toHaveLength(1);
  });

  test("ayrılmış liste adı reddedilir", async () => {
    fetchMediaFacts.mockResolvedValue(movieFacts());
    await expect(
      addMediaToList({ ...base, listName: "counts", media: movie }),
    ).rejects.toMatchObject({ code: "list-name-reserved" });
  });

  describe("izlenen diziler", () => {
    const details = {
      id: 1399,
      name: "Game of Thrones",
      poster_path: "/got.jpg",
      first_air_date: "2011-04-17",
      status: "Ended",
      number_of_episodes: 3,
      number_of_seasons: 1,
      genres: [{ id: 18, name: "Drama" }],
      seasons: [{ season_number: 1, episode_count: 3, poster_path: "/s1.jpg" }],
    };
    const episodes = (air = "2011-04-17") => ({
      data: {
        episodes: [1, 2, 3].map((n) => ({
          episode_number: n,
          name: `E${n}`,
          runtime: 60,
          air_date: air,
        })),
      },
    });
    const route = (detailsBody, seasonBody) =>
      axios.get.mockImplementation(async (url) => {
        if (/\/season\/\d+$/.test(url)) {
          if (seasonBody instanceof Error) throw seasonBody;
          return seasonBody;
        }
        if (detailsBody instanceof Error) throw detailsBody;
        return { data: detailsBody };
      });

    test("tüm sezonlar tek olay olarak yazılır", async () => {
      route(details, episodes());
      const result = await addMediaToList({
        ...base,
        listName: "watchedTv",
        media: tv,
        watchDate: "2026-02-01",
      });
      expect(result).toEqual({ status: "added", item: null });
      const stored = (await col("watchedTv")).tv_1399;
      expect(stored.watchedEpisodeCount).toBe(3);
      expect(stored.watchEvents).toHaveLength(1);
      expect((await root()).stats.tv.totalMinutes).toBe(180);
    });

    test("yayınlanmamış dizi: durum döner, sezonlar çekilmez", async () => {
      route({ ...details, first_air_date: "2999-01-01", status: "Planned" }, episodes());
      const result = await addMediaToList({
        ...base,
        listName: "watchedTv",
        media: tv,
        watchDate: "2026-02-01",
      });
      expect(result.status).toBe("unreleased");
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    test("bölüm bilgisi yok / hiç bölüm yayınlanmamış → 'empty-show', yazım yok", async () => {
      route({ ...details, seasons: [{ season_number: 0, episode_count: 2 }] }, episodes());
      expect(
        (await addMediaToList({ ...base, listName: "watchedTv", media: tv, watchDate: "2026-02-01" }))
          .status,
      ).toBe("empty-show");
      route(details, { data: { episodes: [{ episode_number: 1, name: "E1", air_date: null }] } });
      expect(
        (await addMediaToList({ ...base, listName: "watchedTv", media: tv, watchDate: "2026-02-01" }))
          .status,
      ).toBe("empty-show");
      expect(await col("watchedTv")).toEqual({});
    });

    test("detay isteği ağ yüzünden düşerse 'offline' LibraryError", async () => {
      route(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }), episodes());
      await expect(
        addMediaToList({ ...base, listName: "watchedTv", media: tv, watchDate: "2026-02-01" }),
      ).rejects.toMatchObject({ name: "LibraryError", code: "offline" });
    });

    test("sezon isteği düşerse hiçbir şey yazılmaz (eksik veriyle 'izlendi' yok)", async () => {
      route(details, Object.assign(new Error("boom"), { code: "ERR_BAD_RESPONSE" }));
      await expect(
        addMediaToList({ ...base, listName: "watchedTv", media: tv, watchDate: "2026-02-01" }),
      ).rejects.toMatchObject({ code: "seasons-incomplete" });
      expect(await col("watchedTv")).toEqual({});
    });
  });
});
