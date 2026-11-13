// Zevk Çemberleri Faz 4: kulvar başına eşleşme gücü (utils/matchStrength.js).
import {
  MIN_SPREAD_DAYS,
  WATCH_PATH,
  computeMatchStrength,
  laneStrength,
  nextStep,
  ratingDiversity,
  reachableScore,
} from "../utils/matchStrength";

const NOW = Date.UTC(2026, 10, 13);
const DAY = 86400000;
const iso = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();

/** n film; tarihler 0..(spread-1) gün önceye yayılır (en yenisi bugün). */
const movies = (n, { spread = 60, from = 1 } = {}) =>
  Array.from({ length: n }, (_, i) => ({ id: from + i, dateAdded: iso(i % spread), watchEvents: [{ watchedAt: iso(i % spread) }] }));
const rate = (list, count, value = (i) => (i % 9) + 1) => Object.fromEntries(list.slice(0, count).map((m, i) => [`movie_${m.id}`, value(i)]));
const comments = (list, count) => list.slice(0, count).map((m) => `movie_${m.id}`);

const lane = (over = {}) => {
  const items = over.items ?? movies(over.n ?? 40);
  return laneStrength({
    lane: "movie",
    items,
    ratings: over.ratings ?? rate(items, over.rated ?? 25),
    commentKeys: over.commentKeys ?? comments(items, over.comments ?? 5),
    fourFavorites: over.favorites ?? 3,
    now: NOW,
  });
};

describe("havuza giriş sınırları (puan yolu)", () => {
  test("29 izleme girmez, 30 girer", () => {
    expect(lane({ n: 29, rated: 25 }).eligible).toBe(false);
    expect(lane({ n: 29, rated: 25 }).next).toEqual({ id: "watch", need: 1 });
    const ok = lane({ n: 30, rated: 25, comments: 20 });
    expect(ok.eligible).toBe(true);
    expect(ok.path).toBe("rating");
  });

  test("19 puan girmez, 20 girer", () => {
    expect(lane({ n: 40, rated: 19, comments: 20 }).eligible).toBe(false);
    expect(lane({ n: 40, rated: 19, comments: 20 }).next).toEqual({ id: "rate", need: 1 });
    expect(lane({ n: 40, rated: 20, comments: 20 }).eligible).toBe(true);
  });

  test("yorum ve dört favori asgarisi", () => {
    expect(lane({ comments: 2 }).next).toEqual({ id: "comment", need: 1 });
    expect(lane({ favorites: 1 }).next).toEqual({ id: "favorites", need: 1 });
  });

  test("güç 0.45 altındaysa asgariler yetmez", () => {
    const low = lane({ n: 30, rated: 20, comments: 3, favorites: 2 });
    expect(low.strength).toBeLessThan(45);
    expect(low.eligible).toBe(false);
    expect(low.next.id).toBe("rate");
    expect(low.next.need).toBeGreaterThan(0);
  });
});

describe("puan çeşitliliği kapısı", () => {
  test("hep 10 veren puan yolundan giremez ve uyarılır", () => {
    const items = movies(40);
    const out = lane({ items, ratings: rate(items, 30, () => 10), comments: 20 });
    expect(out.diversity.ok).toBe(false);
    expect(out.eligible).toBe(false);
    expect(out.next).toEqual({ id: "diversify" });
  });

  test("kademe ve sapma", () => {
    expect(ratingDiversity([10, 10, 10]).ok).toBe(false);
    expect(ratingDiversity([7, 8, 7, 8, 7.5, 8]).ok).toBe(false); // 3 kademe, dar
    expect(ratingDiversity([2, 5, 7, 9, 10, 4]).ok).toBe(true);
    expect(ratingDiversity([])).toEqual({ levels: 0, std: 0, ok: false });
  });
});

describe("izleme yolu (puan vermeyenler)", () => {
  test("60 izleme + 2 favori + yakın etkinlik → girer, güç en çok %70", () => {
    const items = movies(150);
    const out = laneStrength({ lane: "movie", items, ratings: {}, commentKeys: comments(items, 20), fourFavorites: 4, now: NOW });
    expect(out.path).toBe("watch");
    expect(out.strength).toBeLessThanOrEqual(WATCH_PATH.maxStrength * 100);
  });

  test("59 izleme girmez; puansız kullanıcıya önce yakın yol söylenir", () => {
    const out = laneStrength({ lane: "movie", items: movies(59), ratings: {}, fourFavorites: 2, now: NOW });
    expect(out.eligible).toBe(false);
    expect(out.next).toEqual({ id: "watch", need: 1 });
    const far = laneStrength({ lane: "movie", items: movies(35), ratings: {}, fourFavorites: 2, now: NOW });
    expect(far.next).toEqual({ id: "rate", need: 20 }); // 25 izlemek yerine 20 puan daha kısa
  });

  test("son 30 günde etkinlik yoksa girmez", () => {
    const old = Array.from({ length: 70 }, (_, i) => ({ id: i + 1, dateAdded: iso(40 + i) }));
    const out = laneStrength({ lane: "movie", items: old, fourFavorites: 2, now: NOW });
    expect(out.recent).toBe(0);
    expect(out.eligible).toBe(false);
    expect(out.next).toEqual({ id: "recent", need: 1 });
  });
});

describe("yayılım (kopya / toplu giriş)", () => {
  test("hepsi aynı gün eklendiyse 14 güne yayılana kadar girmez", () => {
    const sameDay = movies(80, { spread: 1 });
    const out = lane({ items: sameDay, comments: 20 });
    expect(out.spreadDays).toBe(1);
    expect(out.eligible).toBe(false);
    expect(out.next).toEqual({ id: "spread", need: MIN_SPREAD_DAYS - 1 });
  });

  test("tarihli kayıt yarıdan azsa yargılanmaz", () => {
    const undated = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, dateAdded: i < 10 ? iso(0) : null }));
    const out = lane({ items: undated, comments: 20 });
    expect(out.spreadOk).toBe(true);
  });
});

test("havuzdayken sonraki adım ikiz hazırlığı", () => {
  expect(lane({ n: 60, rated: 30, comments: 20 }).next).toEqual({ id: "twinWatch", need: 40 });
  expect(nextStep({ path: "rating", watched: 120, rated: 10 })).toEqual({ id: "twinRate", need: 15 });
  expect(nextStep({ path: "rating", watched: 120, rated: 30 })).toEqual({ id: "ready" });
});

test("ulaşılabilir en yüksek skor (algoritma §7)", () => {
  expect(reachableScore(0)).toBe(0);
  expect(reachableScore(40)).toBe(75);
  expect(reachableScore(80)).toBe(89);
  expect(reachableScore(100)).toBe(92);
  expect(reachableScore(500)).toBe(98);
});

test("computeMatchStrength: kulvarlar ayrı, yorumlar kulvara göre, dört favori kulvardan", () => {
  const ms = movies(40);
  const shows = Array.from({ length: 10 }, (_, i) => ({ id: 900 + i, addedShowDate: iso(i) }));
  const out = computeMatchStrength({
    side: { watchedMovies: ms, watchedShows: shows, ratings: { ...rate(ms, 25), tv_900: 8 } },
    commentKeys: [...comments(ms, 4), "tv_900", "movie_99999"],
    fourFavorites: { movies: [{}, {}, {}], shows: [{}] },
    now: NOW,
  });
  expect(out.movie).toMatchObject({ watched: 40, rated: 25, comments: 4, favorites: 3 });
  expect(out.tv).toMatchObject({ watched: 10, rated: 1, comments: 1, favorites: 1, eligible: false });
});

test("bozuk girdide çökmez", () => {
  for (const side of [undefined, null, {}, { watchedMovies: "x" }, { watchedMovies: [null, { id: "a" }] }]) {
    expect(() => computeMatchStrength({ side, now: NOW })).not.toThrow();
  }
  expect(computeMatchStrength({}).movie).toMatchObject({ watched: 0, eligible: false, next: { id: "watch", need: 30 } });
});
