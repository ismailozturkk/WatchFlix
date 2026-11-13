// Zevk eşleşmesi Faz 2: istemci liste → v3 çekirdek köprüsü ve gölge günlüğü.
import { laneItems, shadowCompare, sideToTasteUser, toMillis } from "../utils/tasteMatchV3Adapter";
import { clearTasteShadow, getTasteShadowRows, recordTasteShadow, SHADOW_LOG_MAX } from "../services/tasteShadowLog";

const NOW = Date.UTC(2026, 10, 13);
const DAY = 86400000;
const GENRES = [["Dram"], ["Komedi"], ["Bilim Kurgu", "Aksiyon"], ["Korku"], ["Animasyon", "Aile"], ["Suç", "Gerilim"]];

function side(seed, { n = 60, shift = 0, rateEvery = 2, hide = [] } = {}) {
  const movies = [];
  const ratings = {};
  for (let i = 0; i < n; i += 1) {
    const id = 1000 + ((i * 7 + seed) % 400);
    movies.push({
      id,
      name: `m${id}`,
      genres: GENRES[id % GENRES.length],
      minutes: 90 + (id % 60),
      dateAdded: new Date(NOW - ((id % 90) + 1) * DAY).toISOString(),
      watchEvents: id % 11 === 0 ? [{}, {}] : [{}],
    });
    if (i % rateEvery === 0) ratings[`movie_${id}`] = Math.max(1, Math.min(10, ((id + shift) % 10) + 1));
  }
  const shows = Array.from({ length: 12 }, (_, i) => ({
    id: 5000 + i + seed,
    name: `s${i}`,
    genres: GENRES[i % GENRES.length],
    showEpisodeCount: 20,
    watchedEpisodeCount: i % 3 === 0 ? 20 : 8,
    watchedSeasonCount: i % 4 === 0 ? 2 : 1,
    totalMinutes: 20 * 45,
    addedShowDate: new Date(NOW - (i + 3) * DAY).toISOString(),
  }));
  const out = {
    watchedMovies: movies,
    watchedShows: shows,
    watchList: [],
    favorites: movies.slice(0, 3).map((m) => ({ id: m.id, type: "movie", name: m.name, genres: m.genres })),
    ratings,
  };
  for (const k of hide) out[k] = null;
  return out;
}

describe("sideToTasteUser", () => {
  test("film, dizi, favori ve puanı çekirdek girdisine çevirir", () => {
    const { items } = sideToTasteUser(side(1));
    const movie = items.find((it) => it.key === "movie_1001");
    expect(movie).toMatchObject({ type: "movie", genres: GENRES[1001 % 6], favorite: true });
    expect(typeof movie.addedAt).toBe("number");
    const finished = items.find((it) => it.key === "tv_5001");
    expect(finished.tv).toEqual({ finished: true, nextSeason: true });
    expect(finished.minutes).toBe(45);
    const plain = items.find((it) => it.key === "tv_5002");
    expect(plain.tv).toBeUndefined();
    // undefined alan kalmaz (profil düz JSON)
    for (const it of items) for (const v of Object.values(it)) expect(v).not.toBeUndefined();
  });

  test("gizli liste okunmaz; gizli izlenenin puanı da sızmaz", () => {
    const s = side(1, { hide: ["watchedMovies", "favorites"] });
    s.ratings.movie_1001 = 9;
    const { items } = sideToTasteUser(s);
    expect(items.every((it) => it.type === "tv")).toBe(true);
    expect(items.some((it) => it.key === "movie_1001")).toBe(false);
  });

  test("tekrar izleme = watchEvents sayısı; bırakma sinyali çıkarılmaz", () => {
    const { items } = sideToTasteUser(side(0, { n: 120 }));
    expect(items.some((it) => it.watchCount === 2)).toBe(true);
    expect(items.some((it) => it.tv?.dropped)).toBe(false);
  });

  test("toMillis biçimleri", () => {
    expect(toMillis(1700000000)).toBe(1700000000000);
    expect(toMillis(1700000000000)).toBe(1700000000000);
    expect(toMillis({ seconds: 5 })).toBe(5000);
    expect(toMillis({ toMillis: () => 7 })).toBe(7);
    expect(toMillis("bozuk")).toBe(null);
    expect(toMillis(null)).toBe(null);
  });

  test("kulvar süzgeci", () => {
    const u = sideToTasteUser(side(1));
    expect(laneItems(u, "tv").items.every((it) => it.type === "tv")).toBe(true);
    expect(laneItems(u, "movie").items.every((it) => it.type === "movie")).toBe(true);
    expect(laneItems(u, "all").items.length).toBe(u.items.length);
  });
});

describe("shadowCompare", () => {
  test("üç kulvar özeti; ham liste/anahtar içermez; simetrik", () => {
    const a = side(1);
    const b = side(1, { shift: 0, rateEvery: 3 });
    const ab = shadowCompare(a, b, { now: NOW });
    const ba = shadowCompare(b, a, { now: NOW });
    for (const lane of ["movie", "tv", "all"]) {
      expect(ab.lanes[lane].score).toBe(ba.lanes[lane].score);
      expect(ab.lanes[lane].display).toBeGreaterThanOrEqual(0);
      expect(ab.lanes[lane].display).toBeLessThanOrEqual(100);
    }
    expect(JSON.stringify(ab)).not.toMatch(/movie_|tv_/);
  });

  test("aynı zevk farklı zevkten yüksek", () => {
    const me = side(1);
    const same = side(1, { rateEvery: 2 });
    const opposite = side(1, { shift: 5 });
    const s1 = shadowCompare(me, same, { now: NOW }).lanes.movie.score;
    const s2 = shadowCompare(me, opposite, { now: NOW }).lanes.movie.score;
    expect(s1).toBeGreaterThan(s2);
  });

  test("arkadaşın gizli kategorisi benim tarafımda da kapanır (kartla aynı)", () => {
    const friend = { ...side(1), watchedMovies: null };
    const withMine = shadowCompare(side(1), friend, { now: NOW }).lanes.all;
    const noMine = shadowCompare({ ...side(1), watchedMovies: [] }, friend, { now: NOW }).lanes.all;
    expect(withMine.score).toBe(noMine.score);
    expect(withMine.nA).toBe(noMine.nA);
  });

  test("bir taraf boşsa skor yok", () => {
    const r = shadowCompare(side(1), { watchedMovies: null, watchedShows: null, favorites: null, ratings: {} }, { now: NOW });
    expect(r.lanes.all.score).toBe(null);
    expect(r.lanes.all.nB).toBe(0);
  });
});

describe("tasteShadowLog (__DEV__)", () => {
  let prevDev;
  beforeAll(() => {
    prevDev = global.__DEV__;
    global.__DEV__ = true;
  });
  afterAll(() => {
    global.__DEV__ = prevDev;
  });
  afterEach(() => clearTasteShadow());

  test("en yeni üstte, aynı arkadaş tekilleşir, sınır uygulanır", () => {
    recordTasteShadow({ uid: "a", name: "A", oldScore: 70, lanes: {} });
    recordTasteShadow({ uid: "b", name: "B", oldScore: 50, lanes: {} });
    recordTasteShadow({ uid: "a", name: "A", oldScore: 71, lanes: {} });
    const rows = getTasteShadowRows();
    expect(rows.map((r) => r.uid)).toEqual(["a", "b"]);
    expect(rows[0].oldScore).toBe(71);
    for (let i = 0; i < SHADOW_LOG_MAX + 5; i += 1) recordTasteShadow({ uid: `u${i}`, lanes: {} });
    expect(getTasteShadowRows()).toHaveLength(SHADOW_LOG_MAX);
  });

  test("release'de yazmaz ve okumaz", () => {
    const prev = global.__DEV__;
    global.__DEV__ = false;
    try {
      recordTasteShadow({ uid: "x", lanes: {} });
      expect(getTasteShadowRows()).toEqual([]);
    } finally {
      global.__DEV__ = prev;
    }
    expect(getTasteShadowRows()).toEqual([]);
  });
});
