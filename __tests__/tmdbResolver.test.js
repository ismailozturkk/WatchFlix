// __tests__/tmdbResolver.test.js
// TMDB eşleştirme dayanıklılığı: geçici hatada yeniden deneme, bağlantı kopunca iş durması
// (öğeler sessizce "eşleşmedi" sayılmaz), anahtar hatasında hemen durma, aday puanlama.

jest.mock("axios", () => ({ get: jest.fn() }));

const axios = require("axios");
const {
  clearResolveCache,
  pickBestCandidate,
  resolveImportItems,
  resolveByTitleYear,
  scoreCandidate,
} = require("../services/import/tmdbResolver");

const ok = (data) => Promise.resolve({ data });
const httpError = (status, headers = {}) => Object.assign(new Error(`HTTP ${status}`), { response: { status, headers } });
const networkError = () => Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" });

// Uç noktaya göre cevap: { "/search/movie": fn(params) | data, ... }
function route(table) {
  axios.get.mockImplementation((url, config) => {
    const path = url.replace("https://api.themoviedb.org/3", "");
    const key = Object.keys(table).find((prefix) => path.startsWith(prefix));
    if (!key) return Promise.reject(httpError(404));
    const handler = table[key];
    return typeof handler === "function" ? handler(config?.params || {}, path) : ok(handler);
  });
}

async function settle(promise) {
  // Geri çekilme beklemeleri sahte saatle anında geçer.
  let result;
  let error;
  promise.then((value) => { result = value; }, (err) => { error = err; });
  for (let i = 0; i < 50 && result === undefined && error === undefined; i += 1) {
    await jest.advanceTimersByTimeAsync(10000);
  }
  if (error) throw error;
  return result;
}

beforeEach(() => {
  jest.useFakeTimers();
  axios.get.mockReset();
  clearResolveCache();
});

afterEach(() => {
  jest.useRealTimers();
});

const MOVIE = { id: 27205, title: "Inception", original_title: "Inception", release_date: "2010-07-15", poster_path: "/p.jpg" };
const DETAILS = { id: 27205, title: "Başlangıç", runtime: 148, genres: [{ name: "Bilim Kurgu" }], poster_path: "/tr.jpg" };

describe("aday puanlama", () => {
  test("tam ad + aynı yıl, listede önde duran yeniden çevrimi geçer", () => {
    const remake = { id: 1, title: "Heat", release_date: "1972-01-01" };
    const original = { id: 2, title: "Heat", release_date: "1995-12-15" };
    expect(pickBestCandidate([remake, original], { title: "Heat", year: 1995 })).toBe(original);
  });

  test("yılsız (strict) aramada ad da yıl da tutmuyorsa eşleşme yok", () => {
    const unrelated = { id: 3, title: "Completely Different", release_date: "1980-01-01" };
    expect(pickBestCandidate([unrelated], { title: "Heat", year: 1995 }, { strict: true })).toBeNull();
    expect(scoreCandidate({ title: "Amélie", release_date: "2001-04-25" }, { title: "Amelie", year: 2001 })).toBe(7);
  });
});

describe("eşleştirme", () => {
  test("başlık İngilizce aranır, görünen ad/afiş kullanıcının dilinden gelir; include_adult yazılmaz", async () => {
    route({ "/search/movie": { results: [MOVIE] }, "/movie/27205": DETAILS });
    const media = await settle(resolveByTitleYear("Inception", 2010, "tr-TR"));
    expect(media).toMatchObject({ id: 27205, title: "Başlangıç", poster_path: "/tr.jpg", minutes: 148, genres: ["Bilim Kurgu"] });
    const searchCall = axios.get.mock.calls.find(([url]) => url.includes("/search/movie"));
    expect(searchCall[1].params).toMatchObject({ query: "Inception", language: "en-US", year: 2010 });
    expect(searchCall[1].params).not.toHaveProperty("include_adult");
  });

  test("503 ve 429 geri çekilerek yeniden denenir", async () => {
    let calls = 0;
    route({
      "/search/movie": () => {
        calls += 1;
        if (calls === 1) return Promise.reject(httpError(503));
        if (calls === 2) return Promise.reject(httpError(429, { "retry-after": "1" }));
        return ok({ results: [MOVIE] });
      },
      "/movie/27205": DETAILS,
    });
    const media = await settle(resolveByTitleYear("Inception", 2010, "tr-TR"));
    expect(media?.id).toBe(27205);
    expect(calls).toBe(3);
  });

  test("bulunamayan öğe 'eşleşmedi', ağ hatası 'başarısız' sayılır ve önbelleğe girmez", async () => {
    let fail = true;
    route({
      "/search/movie": (params) => {
        if (params.query === "Offline Film" && fail) return Promise.reject(networkError());
        if (params.query === "Inception") return ok({ results: [MOVIE] });
        return ok({ results: [] });
      },
      "/search/tv": { results: [] },
      "/movie/27205": DETAILS,
    });
    const items = [
      { title: "Inception", year: 2010 },
      { title: "Yok Böyle Film", year: 2000 },
      { title: "Offline Film", year: 2001 },
    ];
    const result = await settle(resolveImportItems(items, { concurrency: 1 }));
    expect(result.resolved.map((media) => media.id)).toEqual([27205]);
    expect(result.unmatched.map((item) => item.title)).toEqual(["Yok Böyle Film"]);
    expect(result.failed.map((item) => item.title)).toEqual(["Offline Film"]);

    // Bağlantı gelince aynı oturumda yeniden denemek işe yarar (hata önbelleğe yazılmadı).
    fail = false;
    route({ "/search/movie": () => ok({ results: [{ ...MOVIE, id: 9, title: "Offline Film", release_date: "2001-01-01" }] }), "/movie/9": { id: 9, title: "Offline Film" } });
    const retry = await settle(resolveImportItems([items[2]], { concurrency: 1 }));
    expect(retry.resolved[0]).toMatchObject({ id: 9, sourceTitle: "Offline Film" });
  });

  test("art arda başarısızlık = bağlantı yok: iş 'network' ile durur, yarım sonuç taşır", async () => {
    route({ "/search/movie": () => Promise.reject(networkError()) });
    const items = Array.from({ length: 10 }, (_, index) => ({ title: `Film ${index}`, year: 2000 }));
    await expect(settle(resolveImportItems(items, { concurrency: 1, maxConsecutiveFailures: 3 }))).rejects.toMatchObject({
      code: "network",
      partial: expect.objectContaining({ processed: 3 }),
    });
  });

  test("401 (anahtar sorunu) hemen 'tmdbUnavailable' ile durur", async () => {
    route({ "/search/movie": () => Promise.reject(httpError(401)) });
    await expect(settle(resolveImportItems([{ title: "X" }, { title: "Y" }], { concurrency: 1 }))).rejects.toMatchObject({
      code: "tmdbUnavailable",
    });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test("durdurma sinyali bir sonraki öğede işi keser", async () => {
    route({ "/search/movie": { results: [MOVIE] }, "/movie/27205": DETAILS });
    const signal = { cancelled: false };
    const onProgress = jest.fn(() => {
      signal.cancelled = true;
    });
    await expect(
      settle(resolveImportItems([{ title: "Inception", year: 2010 }, { title: "Other" }], { concurrency: 1, signal, onProgress })),
    ).rejects.toMatchObject({ code: "cancelled" });
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  test("sonuçlar girdi sırasındadır ve kaynak verisi eklenir", async () => {
    route({
      "/find/tt1": { movie_results: [{ id: 1, title: "A", release_date: "2000-01-01" }] },
      "/find/tt2": { tv_results: [{ id: 2, name: "B", first_air_date: "2001-01-01" }] },
      "/movie/1": { id: 1, title: "A", runtime: 100 },
      "/tv/2": { id: 2, name: "B", number_of_seasons: 3, number_of_episodes: 30, episode_run_time: [45] },
    });
    const result = await settle(resolveImportItems([
      { imdbId: "tt2", title: "B", rating: 8, importSource: "imdb", targetList: "watchedMovies" },
      { imdbId: "tt1", title: "A", rating: 6, importSource: "imdb", watchedDate: "2024-01-01" },
    ], { concurrency: 2 }));
    expect(result.resolved.map((media) => media.id)).toEqual([2, 1]);
    expect(result.resolved[0]).toMatchObject({ mediaType: "tv", seasonCount: 3, episodeMinutes: 45, userRating: 8, importSource: "imdb" });
    expect(result.resolved[1]).toMatchObject({ mediaType: "movie", minutes: 100, watchedDate: "2024-01-01" });
  });
});
