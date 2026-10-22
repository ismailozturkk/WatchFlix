// Günlük 1440 dk izleme sınırının emülatör testleri: gerçek servisler + gerçek Firestore
// kuralları (orkestrasyon: services/libraryActions, çekirdek: utils/dailyWatchLimit).
//   • film / tek bölüm sığmazsa DAILY_LIMIT, hiçbir şey yazılmaz, bindirme açık kalmaz
//   • tam sınırda kabul; tekrar izleme de süre harcar
//   • sezon / dizi sığmazsa günlere yayılır: TEK transaction, sayaçlar tutarlı, her gün ≤ 1440
//   • yayılan işlem tek izleme olayıymış gibi tek hamlede silinir
//   • yayılma sınırı aşılırsa hiçbir şey yazılmaz; eşzamanlı iki ekleme son dakikayı paylaşamaz

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
const { createEmulatorEnv, readRoot, readCollection } = require("../helpers/libraryEmulator");
const actions = require("../../services/libraryActions");
const { getLocalList, setLocalList } = require("../../services/listSyncService");
const { getOverlay, EMPTY_OVERLAY, __resetOverlayForTests } = require("../../services/libraryOverlay");
const { dayUsage } = require("../../utils/dailyWatchLimit");

const UID = "alice";
const DAY = "2026-02-10";
let testEnv;

const useUser = (uid) => {
  mockHolder.db = testEnv.authenticatedContext(uid).firestore();
};
const root = () => readRoot(mockHolder.db, UID);
const col = (name) => readCollection(mockHolder.db, UID, name);
const usage = () =>
  dayUsage({
    watchedMovies: getLocalList(UID, "watchedMovies"),
    watchedTv: getLocalList(UID, "watchedTv"),
  });

beforeAll(async () => {
  testEnv = await createEmulatorEnv("seelogd-daily-watch-limit");
});
afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  __resetOverlayForTests();
  axios.get.mockReset();
  useUser(UID);
  ["favorites", "watchList", "watchedMovies", "watchedTv", "customItems"].forEach((key) =>
    setLocalList(UID, key, {}),
  );
});

const movie = (id, minutes) => ({
  id,
  type: "movie",
  name: `Film ${id}`,
  imagePath: "/f.jpg",
  dateAdded: DAY,
  genres: ["Drama"],
  minutes,
  releaseDate: "2010-07-16",
  status: "Released",
});

const watchMovie = (id, minutes, watchDate = DAY) =>
  actions.markMovieWatched({ uid: UID, movie: movie(id, minutes), watchDate });

describe("film", () => {
  test("tam sınıra kadar kabul; 1 dk fazlası DAILY_LIMIT ve HİÇBİR ŞEY yazılmaz", async () => {
    for (let id = 1; id <= 9; id += 1) await watchMovie(id, 160); // 1440 → tam dolu
    expect(usage().get(DAY)).toBe(1440);

    await expect(watchMovie(10, 1)).rejects.toMatchObject({
      code: "daily-watch-limit",
      retryable: false,
      details: { reason: "full", day: DAY, used: 1440, remaining: 0, requested: 1 },
    });
    expect(Object.keys(await col("watchedMovies"))).toHaveLength(9);
    expect((await root()).stats.movies.totalMinutes).toBe(1440);
    // Reddedilen filmin niyet bindirmesi geri alınır (öncekiler yazıldığı için bayrakları kalır).
    expect(getOverlay(UID).movie[10]).toBeUndefined();
  });

  test("kalan dakikadan kısa olan sığar, uzun olan sığmaz", async () => {
    await watchMovie(1, 1300);
    await expect(watchMovie(2, 141)).rejects.toMatchObject({
      code: "daily-watch-limit",
      details: { remaining: 140, requested: 141 },
    });
    await expect(watchMovie(3, 140)).resolves.toBeTruthy();
    expect(usage().get(DAY)).toBe(1440);
  });

  test("başka bir gün serbest; tekrar izleme de süre harcar", async () => {
    await watchMovie(1, 900);
    await expect(watchMovie(1, 900)).rejects.toMatchObject({ code: "daily-watch-limit" });
    await expect(watchMovie(1, 900, "2026-02-09")).resolves.toBeTruthy();
    expect(usage().get("2026-02-09")).toBe(900);
  });

  test("EŞZAMANLI iki ekleme son dakikayı paylaşamaz (biri geçer, biri reddedilir)", async () => {
    const results = await Promise.allSettled([watchMovie(1, 800), watchMovie(2, 800)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected.reason).toMatchObject({ code: "daily-watch-limit" });
    expect(usage().get(DAY)).toBe(800);
  });
});

describe("dizi", () => {
  const showMeta = { id: 1399, name: "Uzun Dizi", showEpisodeCount: 200, showSeasonCount: 2, imagePath: "/g.jpg", genres: ["Drama"] };
  const seasonMeta = { seasonNumber: 1, seasonPosterPath: null, seasonEpisodes: 200 };
  const episode = (n, minutes) => ({ episodeNumber: n, episodeName: `E${n}`, episodeMinutes: minutes, releaseDate: "2011-04-17" });

  const tmdbShow = (seasonSizes) => ({
    id: 1399,
    name: "Uzun Dizi",
    poster_path: "/g.jpg",
    first_air_date: "2011-04-17",
    status: "Ended",
    number_of_episodes: seasonSizes.reduce((a, b) => a + b, 0),
    number_of_seasons: seasonSizes.length,
    genres: [{ id: 18, name: "Drama" }],
    seasons: seasonSizes.map((count, i) => ({ season_number: i + 1, episode_count: count, poster_path: null })),
  });
  const mockSeasons = (sizes, runtime = 45) =>
    axios.get.mockImplementation(async (url) => {
      const n = Number(/season\/(\d+)$/.exec(url)[1]);
      return {
        data: {
          episodes: Array.from({ length: sizes[n - 1] }, (_, i) => ({
            episode_number: i + 1,
            name: `S${n}E${i + 1}`,
            runtime,
            vote_average: 7,
            still_path: null,
            air_date: "2011-04-17",
          })),
        },
      };
    });
  const showArgs = (sizes, over = {}) => ({
    uid: UID,
    details: tmdbShow(sizes),
    watchDate: DAY,
    apiKey: "Bearer test",
    language: "tr",
    ...over,
  });

  test("tek bölüm sığmazsa DAILY_LIMIT; sığıyorsa yazılır", async () => {
    await watchMovie(1, 1430);
    await expect(
      actions.markEpisodeWatched({ uid: UID, showMeta, seasonMeta, episode: episode(1, 45), watchDate: DAY }),
    ).rejects.toMatchObject({ code: "daily-watch-limit", details: { remaining: 10, requested: 45 } });
    expect(await col("watchedTv")).toEqual({});
    await expect(
      actions.markEpisodeWatched({ uid: UID, showMeta, seasonMeta, episode: episode(1, 10), watchDate: DAY }),
    ).resolves.toMatchObject({ status: "added" });
  });

  test("sığan dizi: tek olay, yayılma yok", async () => {
    mockSeasons([10, 10]); // 900 dk
    const result = await actions.markShowWatched(showArgs([10, 10]));
    expect(result).toMatchObject({ status: "added", spread: null });
    const stored = (await col("watchedTv")).tv_1399;
    expect(stored.watchEvents).toHaveLength(1);
  });

  test("büyük dizi günlere yayılır: tek transaction, sayaçlar tutarlı, her gün ≤ 1440, sıra korunur", async () => {
    const sizes = [40, 40, 40]; // 120 bölüm × 45 = 5400 dk → 4 gün
    mockSeasons(sizes);
    const result = await actions.markShowWatched(showArgs(sizes));

    expect(result.status).toBe("added");
    expect(result.spread).toEqual({ days: 4, startDate: "2026-02-07", endDate: DAY });

    const stored = (await col("watchedTv")).tv_1399;
    expect(stored.watchedEpisodeCount).toBe(120);
    expect(stored.watchEvents).toHaveLength(4);
    // Asıl kapsam (show) seçilen günün olayında; öncekiler 'episode' ve AYNI batchId.
    const byDate = [...stored.watchEvents].sort((a, b) => a.watchedAt.localeCompare(b.watchedAt));
    expect(byDate.map((e) => e.scope)).toEqual(["episode", "episode", "episode", "show"]);
    expect(new Set(byDate.map((e) => e.batchId)).size).toBe(1);
    expect(byDate.map((e) => e.part)).toEqual([1, 2, 3, 4]);
    expect(byDate.reduce((s, e) => s + e.episodeCount, 0)).toBe(120);
    byDate.forEach((e) => expect(e.minutes).toBeLessThanOrEqual(1440));
    // Sıra: en eski gün sezon 1'in başı, son gün dizinin sonu.
    expect(byDate[0].episodeKeys[0]).toBe("1:1");
    expect(byDate[3].episodeKeys).toContain("3:40");

    // Kök özet: yayılma sayacı ŞİŞİRMEZ — 1 dizi, 120 bölüm, 5400 dk.
    const r = await root();
    expect(r.counts.watchedTv).toBe(1);
    expect(r.stats.tv.shows.unique).toBe(1);
    expect(r.stats.tv.episodes.total).toBe(120);
    expect(r.stats.tv.totalMinutes).toBe(5400);
    expect(r.stats.totalMinutes).toBe(5400);

    // Yerel kullanım haritası da her günü sınır altında görür.
    Object.values(Object.fromEntries(usage())).forEach((minutes) => expect(minutes).toBeLessThanOrEqual(1440));
    expect([...usage().values()].reduce((a, b) => a + b, 0)).toBe(5400);
  });

  test("yayılan dizi 'show' olayı silinince TÜM parçalar ve sayaçlar geri alınır", async () => {
    const sizes = [40, 40, 40];
    mockSeasons(sizes);
    const { event } = await actions.markShowWatched(showArgs(sizes));
    await actions.removeTvWatch({ uid: UID, showId: 1399, eventId: event.id });
    expect(await col("watchedTv")).toEqual({});
    const r = await root();
    expect(r.counts.watchedTv).toBe(0);
    expect(r.stats.tv.episodes.total).toBe(0);
    expect(r.stats.tv.totalMinutes).toBe(0);
    expect(usage().size).toBe(0);
  });

  test("o gün zaten dolu: yayılma ÖNCEKİ günlerin boş kısmını kullanır, dolu günü ezmez", async () => {
    await watchMovie(1, 1440); // seçilen gün tam dolu
    const sizes = [40]; // 40 × 45 = 1800 dk
    mockSeasons(sizes);
    const result = await actions.markSeasonWatched({
      uid: UID,
      details: tmdbShow(sizes),
      season: tmdbShow(sizes).seasons[0],
      watchDate: DAY,
      apiKey: "Bearer test",
      language: "tr",
    });
    expect(result.spread).toEqual({ days: 2, startDate: "2026-02-08", endDate: "2026-02-09" });
    expect(usage().get(DAY)).toBe(1440);
    expect(usage().get("2026-02-09")).toBe(1440);
    expect(usage().get("2026-02-08")).toBe(360);
  });

  test("yayılma sınırını aşan içerik: HİÇBİR ŞEY yazılmaz, bindirme açık kalmaz", async () => {
    const sizes = [15000]; // 675.000 dk ≈ 469 gün > 366
    mockSeasons(sizes);
    await expect(actions.markShowWatched(showArgs(sizes))).rejects.toMatchObject({
      code: "daily-watch-limit",
      details: { reason: "span", days: 366 },
    });
    expect(await col("watchedTv")).toEqual({});
    expect(getOverlay(UID)).toBe(EMPTY_OVERLAY);
  });
});
