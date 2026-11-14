// __tests__/letterboxdImportPipeline.test.js
//
// Letterboxd ZIP içeriği → ayrıştırma → TMDB eşleştirme → parçalı Firestore yazımı → profil özeti, uçtan uca.
// Korunan davranışlar:
//  • Letterboxd yalnız film tutar: film bulunamayınca benzer adlı dizinin TAMAMI "izlendi" yazılmaz
//    (dizi süresi şişiyordu); yalnız ad + yıl birebir tutan dizi kabul edilir.
//  • Kayıt parçalı transaction'la yapılır (öğe başına değil), sayaçlar parçada doğru toplanır ve tam
//    yeniden hesaplamayla birebir aynıdır.
//  • İnceleme HTML'i düz metne iner; aynı dosyayı yeniden aktarmak hiçbir şeyi çoğaltmaz.

jest.mock("axios", () => ({ get: jest.fn() }));
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../services/listSyncService", () => ({ updateLocalItem: jest.fn(), deleteLocalItem: jest.fn() }));

jest.mock("firebase/firestore", () => {
  const store = new Map();
  const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
  const mergeInto = (target, patch) => {
    Object.entries(patch || {}).forEach(([key, raw]) => {
      if (raw?.__increment != null) target[key] = (Number(target[key]) || 0) + raw.__increment;
      else if (raw?.__arrayUnion) target[key] = [...new Set([...(target[key] || []), ...raw.__arrayUnion])];
      else if (raw && typeof raw === "object" && !Array.isArray(raw) && !raw.__serverTimestamp) {
        target[key] = Object.keys(raw).length ? mergeInto({ ...(target[key] || {}) }, raw) : {};
      } else target[key] = clone(raw);
    });
    return target;
  };
  const snapshot = (path) => ({ id: path.split("/").pop(), exists: () => store.has(path), data: () => clone(store.get(path)) });
  const applyWrites = (writes) => {
    writes.forEach(({ ref, data, options }) => {
      const next = options?.mergeFields
        ? { ...clone(store.get(ref.path)), ...clone(data) }
        : options?.merge ? mergeInto(clone(store.get(ref.path)) || {}, data) : clone(data);
      store.set(ref.path, next);
    });
  };
  const state = { failPath: null };
  return {
    __store: store,
    __state: state,
    __reset: () => {
      store.clear();
      state.failPath = null;
    },
    doc: jest.fn((db, ...parts) => ({ path: parts.join("/") })),
    collection: jest.fn((db, ...parts) => ({ path: parts.join("/") })),
    increment: jest.fn((amount) => ({ __increment: amount })),
    arrayUnion: jest.fn((...values) => ({ __arrayUnion: values })),
    serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
    getDocs: jest.fn(async (ref) => {
      const prefix = `${ref.path}/`;
      const docs = [...store.keys()]
        .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
        .map(snapshot);
      return { docs, size: docs.length };
    }),
    runTransaction: jest.fn(async (db, callback) => {
      const writes = [];
      const tx = {
        get: jest.fn(async (ref) => snapshot(ref.path)),
        set: jest.fn((ref, data, options) => writes.push({ ref, data, options })),
      };
      const result = await callback(tx);
      // Kalıcı hata benzetimi: bu belgeye yazan transaction'ın tamamı düşer (izin reddi).
      if (state.failPath && writes.some(({ ref }) => ref.path === state.failPath)) {
        throw Object.assign(new Error("denied"), { code: "permission-denied" });
      }
      applyWrites(writes);
      return result;
    }),
  };
});

const axios = require("axios");
const firestore = require("firebase/firestore");
const { parseLetterboxdBundle } = require("../services/import/letterboxdBundleImporter");
const { clearResolveCache, resolveImportItems } = require("../services/import/tmdbResolver");
const {
  ITEM_CHUNK_SIZE,
  rebuildImportedProfileStats,
  writeImportedItems,
} = require("../services/import/importWriter");

const UID = "lb-user";
const FILLERS = 26;

const MOVIES = {
  "parasite|2019": { id: 496243, title: "Parasite", release_date: "2019-05-30", runtime: 132, genres: ["Gerilim"] },
  "dune|2021": { id: 438631, title: "Dune", release_date: "2021-09-15", runtime: 155, genres: ["Bilim Kurgu"] },
};
for (let index = 1; index <= FILLERS; index += 1) {
  MOVIES[`film ${index}|2000`] = { id: 10000 + index, title: `Film ${index}`, release_date: "2000-01-01", runtime: 100, genres: ["Dram"] };
}
const SHOWS = {
  // Ad tutmuyor (film aranırken diziye düşülmemeli)
  "obscure film|2001": { id: 900, name: "Obscure Film Club", first_air_date: "2001-03-01", episodes: 120, runtime: 44 },
  // Ad + yıl birebir: mini dizi kabul edilir
  "chernobyl|2019": { id: 87108, name: "Chernobyl", first_air_date: "2019-05-06", episodes: 5, runtime: 65 },
};
const byId = new Map([...Object.values(MOVIES), ...Object.values(SHOWS)].map((entry) => [entry.id, entry]));

function tmdb(url, { params } = {}) {
  const path = url.replace("https://api.themoviedb.org/3", "");
  const search = path.match(/^\/search\/(movie|tv)$/);
  if (search) {
    const year = params.primary_release_year || params.first_air_date_year || null;
    const table = search[1] === "movie" ? MOVIES : SHOWS;
    const wanted = String(params.query).toLowerCase();
    const results = Object.entries(table)
      .filter(([key]) => key.split("|")[0] === wanted || (search[1] === "tv" && key.startsWith(wanted)))
      .filter(([key]) => !year || key.endsWith(`|${year}`))
      .map(([, entry]) => ({ ...entry, genres: undefined, runtime: undefined }));
    return Promise.resolve({ data: { results } });
  }
  const details = path.match(/^\/(movie|tv)\/(\d+)$/);
  if (details) {
    const entry = byId.get(Number(details[2]));
    if (!entry) return Promise.reject(Object.assign(new Error("404"), { response: { status: 404 } }));
    const genres = (entry.genres || []).map((name, index) => ({ id: index, name }));
    if (details[1] === "movie") return Promise.resolve({ data: { ...entry, genres, poster_path: `/${entry.id}.jpg` } });
    return Promise.resolve({
      data: { ...entry, genres, number_of_seasons: 1, number_of_episodes: entry.episodes, episode_run_time: [entry.runtime], poster_path: `/${entry.id}.jpg` },
    });
  }
  return Promise.reject(new Error(`unexpected ${path}`));
}

const csv = (header, rows) => [header, ...rows].join("\n");
const fillerRows = Array.from({ length: FILLERS }, (_, index) => `2024-02-01,Film ${index + 1},2000,https://boxd.it/f${index + 1}`);

const EXPORT = {
  "watched.csv": csv("Date,Name,Year,Letterboxd URI", [
    "2024-01-10,Parasite,2019,https://boxd.it/p",
    "2024-01-11,Obscure Film,2001,https://boxd.it/o",
    "2024-01-12,Chernobyl,2019,https://boxd.it/c",
    ...fillerRows,
  ]),
  "diary.csv": csv("Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date", [
    "2024-01-10,Parasite,2019,https://boxd.it/d1,4.5,,,2024-01-09",
    "2024-06-02,Parasite,2019,https://boxd.it/d2,5,Yes,,2024-06-01",
  ]),
  "ratings.csv": csv("Date,Name,Year,Letterboxd URI,Rating", ["2024-06-02,Parasite,2019,https://boxd.it/p,5"]),
  "reviews.csv": csv("Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date", [
    '2024-06-02,Parasite,2019,https://boxd.it/r1,5,Yes,"<p><i>Masterpiece.</i></p><p>Again &amp; again.<br />Best.</p>",,2024-06-01',
  ]),
  "watchlist.csv": csv("Date,Name,Year,Letterboxd URI", ["2024-03-01,Dune,2021,https://boxd.it/dn"]),
};

async function runLetterboxdImport() {
  const bundle = parseLetterboxdBundle(EXPORT);
  const { resolved, unmatched, failed } = await resolveImportItems([...bundle.watchedItems, ...bundle.watchlistItems], { language: "tr-TR" });
  const stats = await writeImportedItems(UID, resolved, { rebuildStats: false });
  return { bundle, resolved, unmatched, failed, stats };
}

beforeEach(() => {
  firestore.__reset();
  firestore.runTransaction.mockClear();
  clearResolveCache();
  axios.get.mockReset();
  axios.get.mockImplementation(tmdb);
});

test("Letterboxd paketi: yanlış dizi eşleşmesi yok, parçalı yazım, sayaçlar tam yeniden hesapla aynı", async () => {
  const { bundle, resolved, unmatched, failed, stats } = await runLetterboxdImport();

  expect(bundle.watchedItems).toHaveLength(3 + FILLERS);
  expect(failed).toEqual([]);
  // Ad tutmayan dizi eşleşmedi; ad + yıl birebir mini dizi eşleşti.
  expect(unmatched.map((item) => item.title)).toEqual(["Obscure Film"]);
  expect(firestore.__store.has(`Lists/${UID}/watchedTv/tv_900`)).toBe(false);
  expect(resolved.find((item) => item.id === 87108)).toMatchObject({ mediaType: "tv", episodeMinutes: 65, episodeCount: 5 });
  // TV araması yılsız yapılmadı (diziye gevşek düşüş yok).
  const tvSearches = axios.get.mock.calls.filter(([url]) => url.endsWith("/search/tv"));
  expect(tvSearches.every(([, options]) => options.params.first_air_date_year)).toBe(true);

  // Parasite: iki günlük kaydı = iki izleme, güncel puan 10, inceleme düz metin.
  const parasite = firestore.__store.get(`Lists/${UID}/watchedMovies/movie_496243`);
  expect(parasite.watchEvents.map((event) => event.watchedAt).sort()).toEqual(["2024-01-09", "2024-06-01"]);
  expect(parasite).toMatchObject({ minutes: 132, importedFrom: "letterboxd" });
  expect(firestore.__store.get(`Users/${UID}/myRatings/movie_496243`)).toMatchObject({ rating: 10, importedFrom: "letterboxd" });
  const review = [...firestore.__store.entries()].find(([path]) => path.startsWith("MovieComment/496243/comments/"))[1];
  expect(review.text).toBe("Masterpiece.\n\nAgain & again.\nBest.");
  expect(firestore.__store.get(`Users/${UID}`).mediaCommentCount).toBe(1);

  // Parçalı yazım: 30 öğe öğe başına transaction değil (1 kök şekil + ⌈30/12⌉ parça).
  expect(stats).toMatchObject({ count: resolved.length, watchedCount: resolved.length - 1, watchlistCount: 1, failedCount: 0, ratingsCount: 1, reviewsCount: 1 });
  expect(firestore.runTransaction).toHaveBeenCalledTimes(1 + Math.ceil(resolved.length / ITEM_CHUNK_SIZE));

  // Parçada toplanan sayaçlar = belgelerden tam yeniden hesap.
  const incremental = JSON.parse(JSON.stringify(firestore.__store.get(`Lists/${UID}`)));
  const rebuilt = await rebuildImportedProfileStats(UID);
  expect(incremental.stats.movies).toEqual({ uniqueCount: 1 + FILLERS, totalRewatchCount: 2 + FILLERS, totalMinutes: 132 * 2 + 100 * FILLERS });
  expect(rebuilt.movies).toMatchObject(incremental.stats.movies);
  expect(incremental.stats.tv.totalMinutes).toBe(5 * 65);
  expect(rebuilt.tv.totalMinutes).toBe(incremental.stats.tv.totalMinutes);
  expect(incremental.stats.totalMinutes).toBe(rebuilt.totalMinutes);
  expect(incremental.counts).toMatchObject({ watchedMovies: 1 + FILLERS, watchedTv: 1, watchList: 1 });
  expect(incremental.stats.genreCounts.Dram).toBe(FILLERS);
  expect(incremental.statusIndex.movie[438631].inWatchList).toBe(true);
  expect(incremental.activityIndex.ratings.movie_496243).toBe(10);
});

test("aynı Letterboxd dosyasını yeniden aktarmak hiçbir şeyi çoğaltmaz", async () => {
  await runLetterboxdImport();
  const before = JSON.parse(JSON.stringify(firestore.__store.get(`Lists/${UID}`)));
  const { stats } = await runLetterboxdImport();
  const after = firestore.__store.get(`Lists/${UID}`);

  expect(stats).toMatchObject({ addedWatchEventsCount: 0, ratingsCount: 0, reviewsCount: 0, unchangedCount: stats.count });
  expect(after.stats).toEqual(before.stats);
  expect(after.counts).toEqual(before.counts);
  expect(firestore.__store.get(`Users/${UID}`).mediaCommentCount).toBe(1);
  expect(firestore.__store.get("Ratings/movie_496243")).toMatchObject({ count: 1, sum: 10 });
});

test("parçada kalıcı hata: yalnız hatalı öğe düşer, diğerleri yazılır", async () => {
  firestore.__state.failPath = `Lists/${UID}/watchedMovies/movie_10003`;
  const { resolved, stats } = await runLetterboxdImport();

  expect(stats.failedCount).toBe(1);
  expect(stats.failedItems[0]).toMatchObject({ id: 10003, code: "permission-denied" });
  expect(stats.count).toBe(resolved.length - 1);
  expect(firestore.__store.has(`Lists/${UID}/watchedMovies/movie_10002`)).toBe(true);
  expect(firestore.__store.has(`Lists/${UID}/watchedMovies/movie_10004`)).toBe(true);
  expect(firestore.__store.get(`Lists/${UID}`).counts.watchedMovies).toBe(FILLERS); // Parasite + 26 dolgu − 1
});

test("aynı medya tek parçada iki kez bulunmaz (izlenen + aynı filmin ikinci kaydı)", async () => {
  const film = { id: 7, mediaType: "movie", title: "Twice", minutes: 90, targetList: "watchedMovies", importSource: "letterboxd" };
  const stats = await writeImportedItems(UID, [
    { ...film, watchDates: ["2024-01-01"] },
    { ...film, watchDates: ["2024-02-01"] },
  ], { rebuildStats: false });

  const doc = firestore.__store.get(`Lists/${UID}/watchedMovies/movie_7`);
  expect(doc.watchEvents.map((event) => event.watchedAt).sort()).toEqual(["2024-01-01", "2024-02-01"]);
  expect(stats.addedWatchEventsCount).toBe(2);
  expect(firestore.__store.get(`Lists/${UID}`).stats.movies).toEqual({ uniqueCount: 1, totalRewatchCount: 2, totalMinutes: 180 });
});
