// __tests__/libraryRoundTrip.test.js
//
// Kütüphane DIŞA → İÇE aktarma TAM DÖNÜŞÜ: uygulamanın gerçekten yazdığı belge şekilleri
// (watchedTvService kompakt şeması, bölümsüz "dizi izlendi" kaydı, film) dosyaya yazılır, dosyadan
// boş bir hesaba geri yüklenir ve profil istatistikleri (süre, bölüm, izleme sayısı) birebir aynı çıkmalı.

jest.mock("axios", () => ({ get: jest.fn() }));

const axios = require("axios");
const { buildLibrarySnapshot, serializeSnapshot } = require("../utils/libraryExport");
const { buildImportPlan, parseLibraryBackup } = require("../utils/libraryImport");
const {
  calculateImportedProfileSummary,
  mergeBackupTv,
  mergeImportedMovie,
} = require("../services/import/importMerge");
const { resolveImportItem, attachSourceData } = require("../services/import/tmdbResolver");
const { flattenTvEpisodeWatchEntries } = require("../utils/watchHistory");

const NOW = new Date(Date.UTC(2026, 10, 14, 12));

/** watchedTvService'in bugünkü kompakt şeması: bölüm iskeleti + üst düzey olaylar (episodeKeys). */
const compactShow = {
  id: 1399,
  type: "tv",
  name: "Game of Thrones",
  imagePath: "/got.jpg",
  genres: ["Dram"],
  addedShowDate: "2026-01-02",
  dateAdded: "2026-01-02",
  showSeasonCount: 8,
  showEpisodeCount: 73,
  seasons: [
    {
      seasonNumber: 1,
      seasonPosterPath: "/s1.jpg",
      seasonEpisodes: 10,
      addedSeasonDate: "2026-01-02",
      episodes: [
        { episodeNumber: 1, episodeName: "Winter Is Coming", episodeMinutes: 62, episodeRatings: 8, episodePosterPath: null, episodeWatchTime: "2026-01-02" },
        { episodeNumber: 2, episodeName: "The Kingsroad", episodeMinutes: 56, episodeRatings: 0, episodePosterPath: null, episodeWatchTime: "2026-01-03" },
      ],
    },
  ],
  watchEvents: [
    { id: "e1", watchedAt: "2026-01-02", scope: "episode", episodeKeys: ["1:1"], seasonNumbers: [1], minutes: 62 },
    { id: "e2", watchedAt: "2026-01-03", scope: "episode", episodeKeys: ["1:2"], seasonNumbers: [1], minutes: 56 },
    // Aynı bölümü tekrar izleme: süre iki kez sayılır.
    { id: "e3", watchedAt: "2026-02-10", scope: "episode", episodeKeys: ["1:1"], seasonNumbers: [1], minutes: 62 },
  ],
};

/** Letterboxd/IMDb aktarımının yazdığı bölümsüz "dizi izlendi" kaydı (importMerge.mergeImportedTv). */
const seasonlessShow = {
  id: 66732,
  type: "tv",
  name: "Stranger Things",
  imagePath: "/st.jpg",
  genres: ["Gizem"],
  addedShowDate: "2025-12-01",
  dateAdded: "2025-12-01",
  showSeasonCount: 4,
  showEpisodeCount: 34,
  watchedSeasonCount: 4,
  watchedEpisodeCount: 34,
  totalMinutes: 34 * 51,
  seasons: [],
  watchEvents: [
    { id: "import_tv_66732_2025-12-01", watchedAt: "2025-12-01", scope: "show", episodeKeys: [], seasonNumbers: [1, 2, 3, 4], episodeCount: 34, seasonCount: 4, minutes: 34 * 51, source: "letterboxd" },
  ],
};

/** Letterboxd'dan "tüm dizi izlendi" + iki kez tekrar, sonra uygulamada tek bölüm işaretlenmiş dizi. */
const mixedShow = {
  id: 1396,
  type: "tv",
  name: "Breaking Bad",
  imagePath: "/bb.jpg",
  genres: ["Suç"],
  addedShowDate: "2025-06-01",
  showSeasonCount: 5,
  showEpisodeCount: 62,
  seasons: [
    { seasonNumber: 1, seasonEpisodes: 7, addedSeasonDate: "2026-05-05", episodes: [{ episodeNumber: 1, episodeName: "Pilot", episodeMinutes: 45, episodeWatchTime: "2026-05-05" }] },
  ],
  watchEvents: [
    { id: "import_tv_1396_2025-06-01", watchedAt: "2025-06-01", scope: "show", episodeKeys: [], seasonNumbers: [1, 2, 3, 4, 5], episodeCount: 62, seasonCount: 5, minutes: 62 * 51 },
    { id: "import_tv_1396_2025-09-01", watchedAt: "2025-09-01", scope: "show", episodeKeys: [], seasonNumbers: [1, 2, 3, 4, 5], episodeCount: 62, seasonCount: 5, minutes: 62 * 51 },
    { id: "ev_pilot", watchedAt: "2026-05-05", scope: "episode", episodeKeys: ["1:1"], seasonNumbers: [1], minutes: 45 },
  ],
};

const movie = {
  id: 550,
  type: "movie",
  name: "Fight Club",
  imagePath: "/fc.jpg",
  genres: ["Dram"],
  minutes: 139,
  dateAdded: "2026-03-01",
  watchEvents: [
    { id: "m1", watchedAt: "2026-03-01", scope: "movie" },
    { id: "m2", watchedAt: "2026-04-01", scope: "movie" },
  ],
};

const statsOf = (movies, shows) => {
  const summary = calculateImportedProfileSummary(movies, shows, []);
  return {
    movieMinutes: summary.movieMinutes,
    tvMinutes: summary.tvMinutes,
    movieWatches: summary.movieCounts.total,
    tvEpisodesTotal: summary.tvCounts.episodes.total,
    tvEpisodesUnique: summary.tvCounts.episodes.unique,
    tvShowsUnique: summary.tvCounts.shows.unique,
  };
};

/** Dosyayı boş hesaba geri yükler (importWriter'ın yaptığı birleştirme, Firestore'suz). */
async function restore(text) {
  const parsed = parseLibraryBackup(text, { now: NOW });
  expect(parsed.ok).toBe(true);
  const plan = buildImportPlan(parsed.backup);
  const movies = [];
  const shows = [];
  for (const item of plan.items) {
    const media = await resolveImportItem(item);
    const resolved = attachSourceData(media, item);
    if (resolved.mediaType === "tv") {
      shows.push(mergeBackupTv({}, resolved, { now: NOW.toISOString(), fallbackDate: "2026-11-14" }).document);
    } else {
      movies.push(mergeImportedMovie({}, resolved, { now: NOW.toISOString(), fallbackDate: "2026-11-14" }).document);
    }
  }
  return { movies, shows };
}

beforeEach(() => axios.get.mockReset());

test("dışa → içe aktarma sonrası film ve dizi istatistikleri birebir aynı (TMDB'ye gidilmeden)", async () => {
  const before = statsOf([movie], [compactShow, seasonlessShow, mixedShow]);
  // Karışık dizide uygulama bugün "tüm dizi" olaylarının süresini saymıyor (bölüm iskeleti varken süre
  // bölümlerden türetilir); dönüş bu davranışı korumalı, çoğaltmamalı ya da sıfırlamamalı.
  expect(before.tvMinutes).toBe(62 + 56 + 62 + 34 * 51 + 45);
  expect(before.tvShowsUnique).toBe(3);

  const snapshot = buildLibrarySnapshot({ lists: { watchedMovies: [movie], watchedTv: [compactShow, seasonlessShow, mixedShow] } }, { now: NOW });
  const { movies, shows } = await restore(serializeSnapshot(snapshot));

  expect(axios.get).not.toHaveBeenCalled();
  expect(statsOf(movies, shows)).toEqual(before);
  // Profil ekranı süreyi bölüm kayıtlarından da türetir (ProfileStatsContext): bölümlü dizide aynı olmalı.
  const episodeMinutes = flattenTvEpisodeWatchEntries([shows[0]]).reduce((sum, e) => sum + (Number(e.episodeMinutes) || 0), 0);
  expect(episodeMinutes).toBe(62 + 56 + 62);
});

test("aynı dosya ikinci kez aktarılınca süre ve izleme sayısı çoğalmaz", async () => {
  const snapshot = buildLibrarySnapshot({ lists: { watchedTv: [compactShow, seasonlessShow, mixedShow] } }, { now: NOW });
  const text = serializeSnapshot(snapshot);
  const first = await restore(text);
  const parsed = parseLibraryBackup(text, { now: NOW });
  const plan = buildImportPlan(parsed.backup);
  const again = [];
  for (const [index, item] of plan.items.entries()) {
    const resolved = attachSourceData(await resolveImportItem(item), item);
    const existing = first.shows[index];
    const merged = mergeBackupTv(existing, resolved, { now: NOW.toISOString(), fallbackDate: "2026-11-14" });
    expect(merged.addedMinutes).toBe(0);
    again.push(merged.document);
  }
  expect(statsOf([], again)).toEqual(statsOf([], first.shows));
});

test("izleme listesindeki dizi/film süre ve boyut bilgisi korunur (uydurma '1 sezon' yazılmaz)", async () => {
  const { mergeImportedWatchlist } = require("../services/import/importMerge");
  const watchList = [
    { id: 1396, type: "tv", name: "Breaking Bad", imagePath: "/bb.jpg", genres: [], dateAdded: "2026-01-01", episodeMinutes: 47, episodeCount: 62, seasonCount: 5, totalMinutes: 2914 },
    { id: 27205, type: "movie", name: "Inception", imagePath: "/inc.jpg", genres: [], dateAdded: "2026-01-02", minutes: 148 },
    // Bilgisi olmayan eski kayıt: sayı uydurulmaz.
    { id: 94605, type: "tv", name: "Arcane", imagePath: "/arc.jpg", genres: [], dateAdded: "2026-01-03" },
  ];
  const text = serializeSnapshot(buildLibrarySnapshot({ lists: { watchList } }, { now: NOW }));
  const parsed = parseLibraryBackup(text, { now: NOW });
  const docs = [];
  for (const item of buildImportPlan(parsed.backup).items) {
    const resolved = attachSourceData(await resolveImportItem(item), item);
    docs.push(mergeImportedWatchlist({}, resolved, "2026-11-14"));
  }
  expect(axios.get).not.toHaveBeenCalled();
  expect(docs[0]).toMatchObject({ episodeMinutes: 47, episodeCount: 62, seasonCount: 5, totalMinutes: 2914 });
  expect(docs[1]).toMatchObject({ minutes: 148 });
  expect(docs[2].seasonCount ?? null).toBeNull();
  expect(docs[2].episodeCount ?? null).toBeNull();
});

test("eski yedek (süre alanı yok): bölümsüz dizinin süresi TMDB'den alınır; 0 dk yazılmış kayıt yeniden aktarımda onarılır", async () => {
  // 14 Kas öncesi dosya: dizide episodeMinutes / showWatchedDates yok.
  const oldFile = {
    app: "seelogd", kind: "library-export", version: 2, exportedAt: "2026-11-01T10:00:00.000Z",
    watchedShows: [{ tmdbId: 66732, type: "tv", title: "Stranger Things", poster: "/st.jpg", genres: [], addedAt: "2025-12-01", seasonCount: 4, episodeCount: 34, episodesWatched: 0, episodes: [] }],
  };
  axios.get.mockImplementation((url) =>
    url.includes("/tv/66732")
      ? Promise.resolve({ data: { id: 66732, name: "Stranger Things", number_of_seasons: 4, number_of_episodes: 34, episode_run_time: [51] } })
      : Promise.reject(Object.assign(new Error("404"), { response: { status: 404, headers: {} } })),
  );
  const parsed = parseLibraryBackup(JSON.stringify(oldFile), { now: NOW });
  const [item] = buildImportPlan(parsed.backup).items;
  const resolved = attachSourceData(await resolveImportItem(item), item);
  expect(resolved).toMatchObject({ title: "Stranger Things", poster_path: "/st.jpg", episodeMinutes: 51 });

  // Hesapta düzeltmeden önce yazılmış 0 dakikalık kayıt:
  const broken = mergeBackupTv({}, { ...resolved, episodeMinutes: null }, { now: NOW.toISOString(), fallbackDate: "2026-11-14" }).document;
  expect(statsOf([], [broken]).tvMinutes).toBe(0);
  const repaired = mergeBackupTv(broken, resolved, { now: NOW.toISOString(), fallbackDate: "2026-11-14" });
  expect(repaired.addedEvents).toBe(0); // izleme çoğalmaz
  expect(repaired.repairedMinutes).toBe(34 * 51);
  expect(statsOf([], [repaired.document]).tvMinutes).toBe(34 * 51);
  expect(repaired.document.totalMinutes).toBe(34 * 51);
});

test("TMDB'ye ulaşılamazsa eski yedekteki dizi yine dosyadaki bilgiyle geri yüklenir", async () => {
  axios.get.mockRejectedValue(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }));
  const item = { tmdbId: 5, mediaType: "tv", title: "X", poster_path: "/x.jpg", targetList: "watchedTv", episodes: [], seasonCount: 2, episodeCount: 10 };
  const media = await resolveImportItem(item);
  expect(media).toMatchObject({ id: 5, title: "X", seasonCount: 2, episodeCount: 10, episodeMinutes: null });
});
