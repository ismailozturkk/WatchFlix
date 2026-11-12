import {
  computeTitleTasteFit,
  tierOf,
  shrink,
  timeOf,
  MIN_WATCHED,
  WEIGHTS,
  COMPONENT_ORDER,
} from "../utils/titleTasteFit";
import { TITLE_TASTE_FIT_COPY, insightText } from "../utils/titleTasteFitCopy";

const NOW = Date.parse("2026-11-12T12:00:00Z");
const daysAgo = (d) => new Date(NOW - d * 864e5).toISOString();
const movie = (id, genres, extra = {}) => ({ id, type: "movie", name: `M${id}`, imagePath: `/p${id}.jpg`, genres, minutes: 110, ...extra });

// Bilim kurgu + gerilim seven, komediye düşük puan veren; 30 kayıt, 30 puan.
function sciFiFan() {
  const watchedMovies = [];
  const ratings = {};
  for (let i = 1; i <= 20; i += 1) {
    watchedMovies.push(movie(i, ["Bilim Kurgu", "Gerilim"], { dateAdded: daysAgo(i * 10) }));
    ratings[`movie_${i}`] = 8 + (i % 3 === 0 ? 1 : 0);
  }
  for (let i = 20 + 1; i <= 30; i += 1) {
    watchedMovies.push(movie(i, ["Komedi"], { dateAdded: daysAgo(i * 10) }));
    ratings[`movie_${i}`] = 3 + (i % 2);
  }
  return {
    watchedMovies,
    watchedShows: [],
    watchList: [],
    favorites: [movie(1, ["Bilim Kurgu"]), movie(2, ["Bilim Kurgu"]), movie(3, ["Gerilim"])],
    ratings,
  };
}
const run = (target, library = sciFiFan()) => computeTitleTasteFit({ target: { type: "movie", id: 999, ...target }, library, now: NOW });

test("az veri: yüzde uydurulmaz", () => {
  const res = run({ genres: [{ name: "Drama" }] }, { watchedMovies: [movie(1, ["Dram"])], ratings: {} });
  expect(res.state).toBe("insufficient");
  expect(res.score).toBeNull();
  expect(res.needed).toBe(MIN_WATCHED);
  expect(res.lowData).toBe(true);
});

test("sevdiği türde, benzerlerini yüksek puanladığı yapım çok yüksek çıkar; dil farkı sorun değil", () => {
  const res = run({
    genres: [{ name: "Science Fiction" }, { name: "Thriller" }],
    runtime: 115,
    voteAverage: 8.1,
    voteCount: 5000,
    similar: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 500 }, { id: 501 }],
  });
  expect(res.state).toBe("ok");
  expect(res.tier).toBe("love");
  expect(res.predictedRating).toBeGreaterThanOrEqual(8);
  expect(res.breakdown.map((b) => b.id)).toEqual(
    expect.arrayContaining(["predicted", "genres", "recent", "genreRate", "combo", "likes", "avoid", "similar", "runtime", "public"]),
  );
  expect(res.insights[0].kind).toBe("predicted");
  expect(res.similarWatched.map((s) => s.id).sort()).toEqual([1, 2, 3]);
  expect(res.lowData).toBe(false);
});

test("sevmediği (düşük puanladığı) türdeki yapım düşük çıkar ve kaçınma içgörüsü verir", () => {
  const res = run({ genres: [{ name: "Comedy" }], runtime: 95, voteAverage: 5.4, voteCount: 800, similar: [{ id: 21 }, { id: 22 }] });
  expect(res.score).toBeLessThan(45);
  expect(["mixed", "skip"]).toContain(res.tier);
  expect(res.predictedRating).toBeLessThan(5);
  expect(res.insights.some((i) => i.kind === "dislikes")).toBe(true);
  expect(res.breakdown.find((b) => b.id === "avoid").score).toBeLessThan(30);
});

test("sert puanlayan kullanıcı: 6'lar onun için 'iyi' sayılır (z-skor)", () => {
  const lib = sciFiFan();
  // Herkese 2–4 veren biri; bilim kurguya 6 veriyor (onun için yüksek).
  for (let i = 1; i <= 20; i += 1) lib.ratings[`movie_${i}`] = 6;
  for (let i = 21; i <= 30; i += 1) lib.ratings[`movie_${i}`] = 2;
  const res = run({ genres: ["Bilim Kurgu"] }, lib);
  // Tahmin kendi ölçeğinde: ortalamasının (≈4.7) üstünde.
  expect(res.predictedRating).toBeGreaterThan(5.5);
  expect(res.insights.find((i) => i.kind === "genreRating").tone).toBe("pos");
  expect(res.breakdown.find((b) => b.id === "genreRate").score).toBeGreaterThan(55);
});

test("küçültme: az örnekli bileşen nötre çekilir", () => {
  expect(shrink(1, 2, 6)).toBeCloseTo(0.625, 5);
  expect(shrink(1, 60, 6)).toBeGreaterThan(0.9);
  expect(shrink(0.5, 1, 1)).toBe(0.5);
});

test("son dönem: son izlenenlerde tür payı artmışsa trendUp", () => {
  const lib = sciFiFan();
  // Son 10 kayıt (en yeni) korku olsun.
  for (let i = 101; i <= 110; i += 1) lib.watchedMovies.push(movie(i, ["Korku"], { dateAdded: daysAgo(i - 100) }));
  const res = run({ genres: ["Korku"] }, lib);
  expect(res.insights.some((i) => i.kind === "trendUp")).toBe(true);
  expect(res.breakdown.find((b) => b.id === "recent").score).toBeGreaterThan(60);
});

test("az ama yeterli veri: sonuç var, lowData uyarısı kalkar, güven düşük/orta", () => {
  const lib = { watchedMovies: sciFiFan().watchedMovies.slice(0, 8), ratings: { movie_1: 8, movie_2: 9 } };
  const res = run({ genres: ["Bilim Kurgu"] }, lib);
  expect(res.state).toBe("ok");
  expect(res.lowData).toBe(true);
  expect(["low", "medium"]).toContain(res.confidence);
});

test("kendi puanı sonucu kendine çeker; hedefin kendisi zevk ölçümünde kullanılmaz", () => {
  const lib = sciFiFan();
  lib.watchedMovies.push(movie(999, ["Bilim Kurgu"]));
  lib.ratings.movie_999 = 3;
  const res = run({ genres: ["Bilim Kurgu"] }, lib);
  expect(res.own).toEqual({ watched: true, rating: 3 });
  expect(res.score).toBeLessThan(60);
  expect(res.insights[0].kind).toBe("ownRating");
});

test("izleme listesindeyse bonus ve içgörü", () => {
  const lib = sciFiFan();
  const base = run({ genres: ["Komedi"] }, lib);
  lib.watchList = [{ id: 999, type: "movie", genres: ["Komedi"] }];
  const listed = run({ genres: ["Komedi"] }, lib);
  expect(listed.inWatchlist).toBe(true);
  expect(listed.score).toBeGreaterThan(base.score);
  expect(listed.insights.some((i) => i.kind === "inWatchlist")).toBe(true);
});

test("dizi hedefi: süre bileşeni yok; çoğunlukla film izleyen için biçim içgörüsü", () => {
  const res = computeTitleTasteFit({ target: { type: "tv", id: 5, genres: ["Bilim Kurgu & Fantazi"], runtime: 50 }, library: sciFiFan(), now: NOW });
  expect(res.breakdown.some((b) => b.id === "runtime")).toBe(false);
  expect(res.insights.some((i) => i.kind === "formatRare")).toBe(true);
});

test("tarih çözümleme: ISO, sn/ms, Firestore Timestamp", () => {
  expect(timeOf("2026-01-01")).toBe(Date.parse("2026-01-01"));
  expect(timeOf(1_700_000_000)).toBe(1_700_000_000_000);
  expect(timeOf({ seconds: 10 })).toBe(10_000);
  expect(timeOf({ toMillis: () => 42 })).toBe(42);
  expect(timeOf(null)).toBeNull();
});

test("sabitler ve kademeler kilitli", () => {
  expect(COMPONENT_ORDER.every((id) => WEIGHTS[id] > 0)).toBe(true);
  expect(Object.keys(WEIGHTS).sort()).toEqual([...COMPONENT_ORDER].sort());
  expect(tierOf(90)).toBe("love");
  expect(tierOf(70)).toBe("like");
  expect(tierOf(55)).toBe("maybe");
  expect(tierOf(40)).toBe("mixed");
  expect(tierOf(10)).toBe("skip");
  expect(tierOf(null)).toBeNull();
});

test("bozuk girdide çökmez", () => {
  for (const library of [undefined, null, {}, { watchedMovies: "x", ratings: 5 }, { watchedMovies: [null, {}, { id: "x" }] }]) {
    expect(() => computeTitleTasteFit({ target: { type: "movie", id: 1, genres: null }, library })).not.toThrow();
  }
  expect(() => computeTitleTasteFit()).not.toThrow();
});

test("beş dilin metin tablosu aynı şekilde; her bileşen ve içgörü metne dönüşür", () => {
  const shape = (obj) =>
    Object.keys(obj)
      .sort()
      .map((k) => (obj[k] && typeof obj[k] === "object" && !Array.isArray(obj[k]) ? `${k}{${shape(obj[k])}}` : k))
      .join(",");
  const tr = shape(TITLE_TASTE_FIT_COPY.tr);
  for (const lang of ["en", "es", "pt", "de"]) {
    expect(shape(TITLE_TASTE_FIT_COPY[lang])).toBe(tr);
    expect(TITLE_TASTE_FIT_COPY[lang].loading).toHaveLength(TITLE_TASTE_FIT_COPY.tr.loading.length);
  }
  for (const id of COMPONENT_ORDER) expect(TITLE_TASTE_FIT_COPY.tr.parts[id]).toBeTruthy();

  const kinds = new Set();
  const targets = [
    { genres: ["Bilim Kurgu", "Western"], runtime: 200, similar: [{ id: 1 }] },
    { genres: ["Komedi"], runtime: 60, voteAverage: 5, voteCount: 100 },
    { genres: ["Gerilim"], voteAverage: 8, voteCount: 100 },
  ];
  for (const target of targets) {
    const res = run(target);
    for (const lang of Object.keys(TITLE_TASTE_FIT_COPY)) {
      for (const ins of res.insights) {
        kinds.add(ins.kind);
        expect(insightText(TITLE_TASTE_FIT_COPY[lang], ins, (g) => g)).toMatch(/\S/);
      }
    }
  }
  expect(kinds.size).toBeGreaterThanOrEqual(8);
});

test("çok türlü yapım: ana türüne uymak yan türüne uymaktan değerli", () => {
  const lib = sciFiFan();
  const lead = run({ genres: ["Bilim Kurgu", "Komedi", "Aile", "Müzik"] }, lib);
  const tail = run({ genres: ["Aile", "Müzik", "Komedi", "Bilim Kurgu"] }, lib);
  expect(lead.score).toBeGreaterThan(tail.score + 5);
});

test("tek türlü hedef, o türü içeren çok türlü içerikleri komşu sayar", () => {
  const watchedMovies = [];
  const ratings = {};
  for (let i = 1; i <= 12; i += 1) {
    watchedMovies.push(movie(i, ["Dram", "Romantik", "Komedi"]));
    ratings[`movie_${i}`] = 9;
  }
  for (let i = 13; i <= 24; i += 1) {
    watchedMovies.push(movie(i, ["Korku"]));
    ratings[`movie_${i}`] = 4;
  }
  const res = run({ genres: ["Dram"] }, { watchedMovies, ratings });
  expect(res.predictedRating).toBeGreaterThan(7.5);
  expect(res.insights.find((i) => i.kind === "predicted").neighbors).toBe(12);
});

// Komediyi yalnız aksiyon-macera-komedilerin YAN türü olarak seven biri vs saf komedi seven biri.
function comedyLib(kind) {
  const watchedMovies = [];
  const ratings = {};
  for (let i = 1; i <= 14; i += 1) {
    watchedMovies.push(movie(i, kind === "pure" ? ["Komedi"] : ["Aksiyon", "Macera", "Komedi"]));
    ratings[`movie_${i}`] = 9;
  }
  for (let i = 15; i <= 26; i += 1) {
    watchedMovies.push(movie(i, ["Dram"]));
    ratings[`movie_${i}`] = 6;
  }
  return { watchedMovies, ratings };
}

test("tek türlü komedi: yan tür komedi sevgisi saf komedi sevgisi kadar sayılmaz", () => {
  const pure = run({ genres: ["Komedi"] }, comedyLib("pure"));
  const side = run({ genres: ["Komedi"] }, comedyLib("side"));
  expect(pure.score).toBeGreaterThan(side.score + 8);
  expect(side.insights.some((i) => i.kind === "sideGenre" && i.side === 14)).toBe(true);
  expect(pure.insights.some((i) => i.kind === "sideGenre")).toBe(false);
});

test("ana tür puanı yan türden düşükse primaryLower içgörüsü", () => {
  const lib = comedyLib("side");
  for (let i = 40; i <= 43; i += 1) {
    lib.watchedMovies.push(movie(i, ["Komedi", "Romantik"]));
    lib.ratings[`movie_${i}`] = 4;
  }
  const res = run({ genres: ["Komedi"] }, lib);
  const ins = res.insights.find((i) => i.kind === "primaryLower");
  expect(ins).toMatchObject({ genre: "comedy", primaryAvg: 4, sideAvg: 9 });
});

test("dizinin 'Aksiyon & Macera' türü film Maceraya da eşleşir", () => {
  const watchedShows = [];
  const ratings = {};
  for (let i = 1; i <= 12; i += 1) {
    watchedShows.push({ id: i, name: `S${i}`, genres: ["Action & Adventure"] });
    ratings[`tv_${i}`] = 9;
  }
  for (let i = 13; i <= 24; i += 1) {
    watchedShows.push({ id: i, name: `S${i}`, genres: ["Belgesel"] });
    ratings[`tv_${i}`] = 5;
  }
  const res = run({ genres: ["Macera"] }, { watchedShows, ratings });
  expect(res.predictedRating).toBeGreaterThan(7);
  expect(res.stats).toMatchObject({ sameType: 0, otherType: 24, crossWeight: 0.85 });
  expect(res.insights.find((i) => i.kind === "typeBasis")).toMatchObject({ borrowed: true });
});

test("dizide olmayan Gerilim, film hedefte dizilerin Suç/Gizem türünden köprüyle beslenir", () => {
  const watchedShows = [];
  const ratings = {};
  for (let i = 1; i <= 12; i += 1) {
    watchedShows.push({ id: i, name: `S${i}`, genres: ["Suç", "Gizem"] });
    ratings[`tv_${i}`] = 9;
  }
  for (let i = 13; i <= 24; i += 1) {
    watchedShows.push({ id: i, name: `S${i}`, genres: ["Komedi"] });
    ratings[`tv_${i}`] = 5;
  }
  const thriller = run({ genres: ["Gerilim"] }, { watchedShows, ratings });
  const western = run({ genres: ["Western"] }, { watchedShows, ratings });
  expect(thriller.score).toBeGreaterThan(western.score + 10);
  // Aynı biçimde bu köprü kurulmaz: bir film izleyicisinin Suç filmleri Gerilim'e sayılmaz.
  const watchedMovies = watchedShows.map((s) => movie(s.id, s.genres));
  const movieRatings = Object.fromEntries(Object.entries(ratings).map(([k, v]) => [k.replace("tv_", "movie_"), v]));
  const same = run({ genres: ["Gerilim"] }, { watchedMovies, ratings: movieRatings });
  expect(same.predictedRating).toBeNull();
});

test("hedefin biçimi ağır basar: film hedefinde filmler, dizi hedefinde diziler", () => {
  const watchedMovies = [];
  const watchedShows = [];
  const ratings = {};
  for (let i = 1; i <= 40; i += 1) {
    watchedMovies.push(movie(i, ["Komedi"]));
    ratings[`movie_${i}`] = 9;
    watchedShows.push({ id: i, name: `S${i}`, genres: ["Komedi"] });
    ratings[`tv_${i}`] = 4;
  }
  const lib = { watchedMovies, watchedShows, ratings };
  const asMovie = computeTitleTasteFit({ target: { type: "movie", id: 999, genres: ["Komedi"] }, library: lib, now: NOW });
  const asTv = computeTitleTasteFit({ target: { type: "tv", id: 999, genres: ["Komedi"] }, library: lib, now: NOW });
  expect(asMovie.predictedRating).toBeGreaterThan(asTv.predictedRating + 2);
  expect(asMovie.stats.crossWeight).toBe(0.35);
  expect(asMovie.insights.find((i) => i.kind === "typeBasis")).toMatchObject({ borrowed: false, sameType: 40 });
});
