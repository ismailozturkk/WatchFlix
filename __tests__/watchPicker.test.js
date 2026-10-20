// __tests__/watchPicker.test.js
// "Ne izlesem?" saf çekirdeği: havuz, tekrarsız seçim, karıştırma kareleri, gerekçe, süre biçimi.

const {
  PICK_TYPES,
  countsOf,
  daysInList,
  defaultTypeFor,
  factParts,
  formatMinutes,
  frameDelays,
  keyOf,
  pickNext,
  poolFor,
  reasonOf,
  releaseInfoOf,
  shuffleFrames,
} = require("../utils/watchPicker");
const { WATCH_PICKER_COPY, fillPickerCopy, reasonText } = require("../utils/watchPickerCopy");

const movie = (id, extra = {}) => ({ id, type: "movie", name: `M${id}`, ...extra });
const show = (id, extra = {}) => ({ id, type: "tv", name: `S${id}`, ...extra });
const NOW = new Date("2026-10-19T12:00:00Z").getTime();
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

// Deterministik "rastgele": sırayla verilen değerleri (mod n) döner.
const seq = (...values) => {
  let i = 0;
  return (n) => values[i++ % values.length] % n;
};

describe("havuz", () => {
  const items = [movie(1), show(2), movie(3), { id: null, type: "movie" }, { id: 9, type: "game" }, null];

  it("tanınmayan / kimliksiz kayıtlar elenir, tür havuzu daraltır", () => {
    expect(poolFor(items, "mixed").map(keyOf)).toEqual(["movie:1", "tv:2", "movie:3"]);
    expect(poolFor(items, "movie")).toHaveLength(2);
    expect(poolFor(items, "tv")).toHaveLength(1);
    expect(poolFor(undefined)).toEqual([]);
  });

  it("sayılar ve varsayılan tür", () => {
    expect(countsOf(items)).toEqual({ mixed: 3, movie: 2, tv: 1 });
    expect(defaultTypeFor(countsOf(items))).toBe("mixed");
    expect(defaultTypeFor(countsOf([movie(1)]))).toBe("movie");
    expect(defaultTypeFor(countsOf([show(1)]))).toBe("tv");
    expect(defaultTypeFor(countsOf([]))).toBe("mixed");
    expect(PICK_TYPES).toEqual(["mixed", "movie", "tv"]);
  });

  it("aynı id'li film ve dizi AYRI anahtardır", () => {
    expect(keyOf(movie(5))).not.toBe(keyOf(show(5)));
  });
});

describe("pickNext", () => {
  const pool = [movie(1), movie(2), movie(3)];

  it("boş havuz → null", () => {
    expect(pickNext({ pool: [] })).toEqual({ item: null, seen: [], cycled: false });
  });

  it("görülenleri eler; sonuç seen'e eklenir", () => {
    const { item, seen } = pickNext({ pool, seen: ["movie:1", "movie:2"], rand: seq(0) });
    expect(item.id).toBe(3);
    expect(seen).toEqual(["movie:1", "movie:2", "movie:3"]);
  });

  it("art arda hiç tekrar yok: havuz boyu kadar çekimde herkes tam bir kez çıkar", () => {
    let seen = [];
    const got = [];
    for (let i = 0; i < pool.length; i += 1) {
      const r = pickNext({ pool, seen, rand: seq(0, 1, 2) });
      got.push(r.item.id);
      seen = r.seen;
      expect(r.cycled).toBe(false);
    }
    expect(new Set(got).size).toBe(pool.length);
  });

  it("hepsi görülünce baştan başlar ama az önce çıkanı hemen vermez", () => {
    const current = movie(3);
    for (let r = 0; r < 3; r += 1) {
      const out = pickNext({ pool, seen: ["movie:1", "movie:2", "movie:3"], current, rand: seq(r) });
      expect(out.cycled).toBe(true);
      expect(out.item.id).not.toBe(3);
      expect(out.seen).toEqual([keyOf(out.item)]);
    }
  });

  it("tek yapımlı havuz: döngü bildirilmez, aynı yapım döner", () => {
    const one = [movie(7)];
    const out = pickNext({ pool: one, seen: ["movie:7"], current: one[0] });
    expect(out.item.id).toBe(7);
    expect(out.cycled).toBe(false);
  });
});

describe("shuffleFrames / frameDelays", () => {
  const pool = [movie(1), movie(2), movie(3), show(4)];

  it("son kare kazanan, ardışık kareler farklı, uzunluk sabit", () => {
    for (const start of [0, 1, 2, 3]) {
      const frames = shuffleFrames({ pool, winner: pool[2], count: 9, rand: seq(start, start, start, 1, 2) });
      expect(frames).toHaveLength(9);
      expect(keyOf(frames[8])).toBe(keyOf(pool[2]));
      for (let i = 1; i < frames.length; i += 1) {
        expect(keyOf(frames[i])).not.toBe(keyOf(frames[i - 1]));
      }
    }
  });

  it("tek yapım ya da kazanan yok → animasyonsuz", () => {
    expect(shuffleFrames({ pool: [movie(1)], winner: movie(1) })).toHaveLength(1);
    expect(shuffleFrames({ pool, winner: null })).toEqual([]);
  });

  it("gerçek rastgelelikte de kazanan son karedir", () => {
    for (let i = 0; i < 30; i += 1) {
      const winner = pool[i % pool.length];
      const frames = shuffleFrames({ pool, winner });
      expect(keyOf(frames[frames.length - 1])).toBe(keyOf(winner));
    }
  });

  it("gecikmeler yavaşlar ve toplam yaklaşık 1 sn", () => {
    const delays = frameDelays(9);
    expect(delays).toHaveLength(9);
    for (let i = 1; i < delays.length; i += 1) expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
    const total = delays.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(500);
    expect(total).toBeLessThan(1500);
    expect(frameDelays(1)).toEqual([0]);
  });
});

describe("reasonOf", () => {
  it("uzun süredir bekleyen: ay / gün, yeni eklenen", () => {
    expect(reasonOf(movie(1, { dateAdded: daysAgo(100) }), NOW)).toEqual({ kind: "waitingMonths", value: 3 });
    expect(reasonOf(movie(1, { dateAdded: daysAgo(20) }), NOW)).toEqual({ kind: "waitingDays", value: 20 });
    expect(reasonOf(movie(1, { dateAdded: daysAgo(1) }), NOW)).toEqual({ kind: "fresh" });
  });

  it("süre ve sezon özellikleri (tarih yoksa)", () => {
    expect(reasonOf(movie(1, { minutes: 92 }), NOW)).toEqual({ kind: "shortFilm", value: 92 });
    expect(reasonOf(movie(1, { minutes: 170 }), NOW)).toEqual({ kind: "longFilm", value: 170 });
    expect(reasonOf(movie(1, { minutes: 120 }), NOW)).toBeNull();
    expect(reasonOf(show(1, { seasonCount: 1 }), NOW)).toEqual({ kind: "oneSeason" });
    expect(reasonOf(show(1, { seasonCount: 7 }), NOW)).toEqual({ kind: "longRun", value: 7 });
    expect(reasonOf(show(1, { seasonCount: 3 }), NOW)).toBeNull();
    expect(reasonOf(null)).toBeNull();
  });

  it("geçersiz / gelecek tarih bekleme sayılmaz", () => {
    expect(daysInList(movie(1, { dateAdded: "bozuk" }), NOW)).toBeNull();
    expect(daysInList(movie(1, { dateAdded: daysAgo(-5) }), NOW)).toBeNull();
    expect(daysInList(movie(1), NOW)).toBeNull();
  });
});

describe("biçimler", () => {
  it("formatMinutes", () => {
    expect(formatMinutes(112)).toBe("1 sa 52 dk");
    expect(formatMinutes(45)).toBe("45 dk");
    expect(formatMinutes(120)).toBe("2 sa");
    expect(formatMinutes(0)).toBeNull();
    expect(formatMinutes("x")).toBeNull();
    expect(formatMinutes(90, { hour: "h", minute: "min" })).toBe("1 h 30 min");
  });

  it("factParts: film süre, dizi sezon + bölüm; veri yoksa boş", () => {
    expect(factParts(movie(1, { minutes: 100 }))).toEqual(["1 sa 40 dk"]);
    expect(factParts(show(1, { seasonCount: 3, episodeCount: 28 }))).toEqual(["3 sezon", "28 bölüm"]);
    expect(factParts(show(1))).toEqual([]);
    expect(factParts(movie(1))).toEqual([]);
    expect(factParts(null)).toEqual([]);
  });
});

describe("releaseInfoOf", () => {
  it("yıl, puan, özet; yeterli oy yoksa puan yok", () => {
    const info = releaseInfoOf(
      { release_date: "2019-05-30", vote_average: 7.84, vote_count: 900, overview: " Özet. ", status: "Released" },
      "movie",
      NOW,
    );
    expect(info).toMatchObject({ year: 2019, rating: 7.8, overview: "Özet.", unreleased: false });
    expect(releaseInfoOf({ release_date: "2019-01-01", vote_average: 9, vote_count: 2 }, "movie", NOW).rating).toBeNull();
  });

  it("gelecek tarih ya da film durumu Released değilse yayınlanmadı", () => {
    expect(releaseInfoOf({ release_date: "2027-01-01" }, "movie", NOW).unreleased).toBe(true);
    expect(releaseInfoOf({ release_date: "2020-01-01", status: "Post Production" }, "movie", NOW).unreleased).toBe(true);
    expect(releaseInfoOf({ first_air_date: "2030-01-01" }, "tv", NOW).unreleased).toBe(true);
    // Dizi durumu ("Ended"/"Returning Series") yayınlanmama anlamına gelmez.
    expect(releaseInfoOf({ first_air_date: "2015-01-01", status: "Ended" }, "tv", NOW).unreleased).toBe(false);
  });

  it("bozuk / boş cevap boş nesne", () => {
    expect(releaseInfoOf(null, "movie")).toEqual({});
    expect(releaseInfoOf("x", "tv")).toEqual({});
  });
});

describe("metinler", () => {
  it("her dilde tüm gerekçe türleri ve yer tutucu var", () => {
    const kinds = ["waitingMonths", "waitingDays", "fresh", "shortFilm", "longFilm", "oneSeason", "longRun"];
    for (const copy of Object.values(WATCH_PICKER_COPY)) {
      for (const kind of kinds) expect(typeof copy.reasons[kind]).toBe("string");
      // Giriş satırı: zar + Film + Dizi düğmesi metinleri dolu ve kısa (320 pt'te sığar).
      for (const key of ["title", "movie", "tv", "empty", "filteredNote", "a11yRandom", "a11yMovie", "a11yTv"]) {
        expect(typeof copy.entry[key]).toBe("string");
        expect(copy.entry[key].length).toBeGreaterThan(0);
      }
      expect(copy.entry.title.length).toBeLessThanOrEqual(14);
      expect(copy.entry.movie.length).toBeLessThanOrEqual(7);
      expect(copy.entry.tv.length).toBeLessThanOrEqual(7);
      expect(copy.sheet.pool).toContain("{n}");
    }
  });

  it("reasonText doldurur, bilinmeyen gerekçe null", () => {
    const tr = WATCH_PICKER_COPY.tr;
    expect(reasonText(tr, { kind: "waitingMonths", value: 3 })).toBe("3 aydır listende bekliyor");
    expect(reasonText(tr, { kind: "fresh" })).toBe("Yeni eklendi");
    expect(reasonText(tr, { kind: "yok" })).toBeNull();
    expect(reasonText(tr, null)).toBeNull();
    expect(fillPickerCopy("{n} yapım", 12)).toBe("12 yapım");
  });
});
