// Zevk eşleşmesi Faz 3: "Zevk uyumunu değerlendir" geri test aracı (utils/titleFitBacktest.js).
import { WEIGHTS } from "../utils/titleTasteFit";
import { exportToLibrary, rescore, runTitleFitBacktest, spearman, summarizeSamples } from "../utils/titleFitBacktest";

const NOW = Date.UTC(2026, 10, 13);
const LOVED = ["Bilim-Kurgu", "Gerilim"];
const DISLIKED = ["Romantik", "Komedi"];

function library() {
  const watchedMovies = [];
  const ratings = {};
  for (let i = 1; i <= 60; i += 1) {
    const loved = i % 2 === 0;
    watchedMovies.push({ id: i, name: `m${i}`, genres: loved ? LOVED : DISLIKED, minutes: 110, dateAdded: new Date(NOW - i * 864e5).toISOString() });
    ratings[`movie_${i}`] = loved ? 8 + (i % 3) : 3 + (i % 3);
  }
  return { watchedMovies, watchedShows: [], watchList: [], favorites: watchedMovies.filter((m) => m.id % 2 === 0).slice(0, 4), ratings };
}

test("spearman: tam uyum, ters, bağlar", () => {
  expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
  expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
  expect(spearman([1, 1, 2, 2], [1, 1, 2, 2])).toBeCloseTo(1);
  expect(spearman([1, 2], [1, 2])).toBe(null);
});

test("rescore varsayılan ağırlıkla bileşenlerden skoru yeniden üretir", () => {
  const breakdown = [{ id: "genres", score: 80 }, { id: "predicted", score: 60 }];
  const expected = Math.round(5 + ((WEIGHTS.genres * 0.8 + WEIGHTS.predicted * 0.6) / (WEIGHTS.genres + WEIGHTS.predicted)) * 93);
  expect(rescore(breakdown)).toBe(expected);
  expect(rescore(breakdown, { genres: 1 })).toBe(Math.round(5 + 0.8 * 93));
  expect(rescore([], WEIGHTS)).toBe(null);
});

test("bant tablosu ve kesintisiz artış denetimi", () => {
  const up = [...Array(10)].flatMap((_, i) => [{ score: 30, rating: 3 }, { score: 60, rating: 6 }, { score: 90, rating: 9 + (i % 2) * 0 }]);
  const s = summarizeSamples(up);
  expect(s.monotonic).toBe(true);
  expect(s.bands.find((b) => b.id === "85+").meanRating).toBe(9);
  const down = up.map((x) => ({ ...x, rating: 12 - x.rating }));
  expect(summarizeSamples(down).monotonic).toBe(false);
});

test("geri test: türe bağlı zevki yakalar, hedefin kendi puanı sızmaz", () => {
  const res = runTitleFitBacktest(library(), { now: NOW, weights: { ...WEIGHTS, genres: 0.3 }, keepSamples: true });
  expect(res.n).toBe(60);
  expect(res.spearman).toBeGreaterThan(0.5);
  expect(res.monotonic).toBe(true);
  expect(res.disabled).toEqual(["similar", "public"]);
  expect(res.alt.n).toBe(60);
  expect(res.components.find((c) => c.id === "genres").n).toBe(60);
  // Sızıntı yok: hedefin puanı silinmeseydi skor %60 o puana çekilirdi ve rescore(döküm) ≠ skor olurdu.
  // (Bonus/kendi puanı yokken skor = döküm formülü.)
  for (const s of res.samples) expect(rescore(s.breakdown)).toBe(s.score);
});

test("dışa aktarım JSON'u → kütüphane", () => {
  const lib = exportToLibrary({
    watchedMovies: [{ tmdbId: 5, type: "movie", title: "A", genres: ["Dram"], addedAt: "2026-01-01", minutes: 100, rating: 8 }],
    watchedShows: [{ tmdbId: 9, type: "tv", title: "B", genres: ["Suç"], addedAt: null, episodes: [] }],
    favorites: [{ tmdbId: 5, type: "movie", title: "A", genres: ["Dram"] }],
    watchList: [{ tmdbId: 0, title: "bozuk" }],
    ratings: [{ type: "movie", tmdbId: 5, rating: 8 }, { type: "tv", tmdbId: 9, rating: 0 }],
  });
  expect(lib.watchedMovies[0]).toMatchObject({ id: 5, type: "movie", genres: ["Dram"], minutes: 100, dateAdded: "2026-01-01" });
  expect(lib.watchedShows[0].type).toBe("tv");
  expect(lib.watchList).toEqual([]);
  expect(lib.ratings).toEqual({ movie_5: 8 });
});
