// __tests__/tasteMatch.test.js
//
// Arkadaşla zevk uyumu + birlikte izleyelim adayları (utils/tasteMatch.js) ve metin tablosu.
const {
  MAX_CANDIDATES,
  MIN_RATED_PAIRS,
  WEIGHTS,
  candidatesToDeckSource,
  computeTasteInsights,
  computeTasteMatch,
  computeTasteV3,
  DEEP_COMPONENTS,
  V3_WEIGHTS,
  findTogetherCandidates,
  tierOf,
} = require("../utils/tasteMatch");
const { TASTE_MATCH_COPY, getTasteMatchCopy } = require("../utils/tasteMatchCopy");

const movie = (id, genres = ["Drama"], extra = {}) => ({ id, type: "movie", name: `Film ${id}`, imagePath: `/m${id}.jpg`, genres, ...extra });
const show = (id, genres = ["Drama"]) => ({ id, name: `Dizi ${id}`, imagePath: `/t${id}.jpg`, genres }); // türü yok: liste belirler
const range = (from, to, make) => Array.from({ length: to - from + 1 }, (_, i) => make(from + i));

const side = (over = {}) => ({ watchedMovies: [], watchedShows: [], watchList: [], favorites: [], ratings: {}, ...over });

describe("computeTasteInsights (eski hesap + içgörüler)", () => {
  it("özdeş zevk: yüksek puan ve çok ortak izlenen", () => {
    const movies = range(1, 10, (i) => movie(i, i % 2 ? ["Drama"] : ["Komedi"]));
    const ratings = Object.fromEntries(movies.map((m) => [`movie_${m.id}`, 8]));
    const out = computeTasteInsights(side({ watchedMovies: movies, ratings }), side({ watchedMovies: movies, ratings }));
    expect(out.state).toBe("ok");
    expect(out.score).toBe(100);
    expect(out.tier).toBe("veryHigh");
    expect(out.watched.overlap).toHaveLength(10);
    expect(out.ratings).toEqual({ pairs: 10, agreement: 1 });
    expect(out.genres.shared.sort()).toEqual(["Drama", "Komedi"]);
    expect(out.components.sort()).toEqual(["genreRatings", "genres", "overlap", "ratings"]);
  });

  it("hiç ortak yok + farklı türler: düşük puan", () => {
    const a = range(1, 8, (i) => movie(i, ["Korku"]));
    const b = range(101, 108, (i) => movie(i, ["Komedi"]));
    const out = computeTasteInsights(side({ watchedMovies: a }), side({ watchedMovies: b }));
    // Ortak tür sözlüğü yok (korku ≠ komedi) → tür bileşeni düşer; ortak izlenen 0 → puan 0.
    expect(out.genres.comparable).toBe(false);
    expect(out.score).toBe(0);
    expect(out.tier).toBe("low");
    expect(out.state).toBe("limited");
  });

  it("tür sözlüğü farklı dilde (Dram / Drama): kanonik türle karşılaştırılır, adlar benim kayıtlarımdan gelir", () => {
    const tr = range(1, 8, (i) => movie(i, ["Dram", "Komedi"]));
    const en = range(1, 8, (i) => movie(i, ["Drama", "Comedy"]));
    const out = computeTasteInsights(side({ watchedMovies: tr }), side({ watchedMovies: en }));
    expect(out.genres.comparable).toBe(true);
    expect(out.genres.similarity).toBeCloseTo(1, 5);
    expect(out.components).toEqual(["genres", "overlap"]);
    expect(out.genres.shared.sort()).toEqual(["Dram", "Komedi"]);
    expect(out.watched.overlap).toHaveLength(8); // ortak izlenen yine bulunur
  });

  it("tanınmayan tür adları (kanonik eşleşmesi yok) farklıysa tür bileşeni yine düşer", () => {
    const a = range(1, 8, (i) => movie(i, ["Xyz"]));
    const b = range(1, 8, (i) => movie(i, ["Qwe"]));
    const out = computeTasteInsights(side({ watchedMovies: a }), side({ watchedMovies: b }));
    expect(out.genres.comparable).toBe(false);
    expect(out.components).toEqual(["overlap"]);
  });

  it("puan uyumu: ortak izlenenlerde fark büyüdükçe düşer; 3'ten az çiftte yok", () => {
    const movies = range(1, 6, (i) => movie(i));
    const mine = Object.fromEntries(movies.map((m) => [`movie_${m.id}`, 9]));
    const far = Object.fromEntries(movies.map((m) => [`movie_${m.id}`, 3]));
    const out = computeTasteInsights(side({ watchedMovies: movies, ratings: mine }), side({ watchedMovies: movies, ratings: far }));
    expect(out.ratings.pairs).toBe(6);
    expect(out.ratings.agreement).toBeCloseTo(1 - 6 / 9, 5);

    const few = computeTasteInsights(
      side({ watchedMovies: movies, ratings: { movie_1: 9, movie_2: 9 } }),
      side({ watchedMovies: movies, ratings: { movie_1: 3, movie_2: 3 } }),
    );
    expect(MIN_RATED_PAIRS).toBe(3);
    expect(few.ratings.agreement).toBeNull();
  });

  it("puanlar yalnız ORTAK izlenen başlıklarda okunur (gizli listeden sızıntı yok)", () => {
    const mineMovies = range(1, 6, (i) => movie(i));
    const theirMovies = range(1, 3, (i) => movie(i)); // 4-6'yı o izlemedi
    const ratings = Object.fromEntries(range(1, 6, (i) => [`movie_${i}`, 8]));
    const out = computeTasteInsights(side({ watchedMovies: mineMovies, ratings }), side({ watchedMovies: theirMovies, ratings }));
    expect(out.ratings.pairs).toBe(3);
  });

  it("karşı taraf izlenen listelerini gizliyorsa: no-data, uydurma puan yok", () => {
    const out = computeTasteInsights(
      side({ watchedMovies: range(1, 10, (i) => movie(i)) }),
      { watchedMovies: null, watchedShows: null, watchList: [movie(1)], favorites: null, ratings: {} },
    );
    expect(out.state).toBe("no-data");
    expect(out.score).toBeNull();
    expect(out.tier).toBeNull();
    expect(out.favorites).toBeNull();
  });

  it("yalnız filmler görünüyorsa karşılaştırma yalnız filmlerde yapılır (diziler benim tarafımdan da çıkarılır)", () => {
    const mineMovies = range(1, 6, (i) => movie(i));
    const out = computeTasteInsights(
      side({ watchedMovies: mineMovies, watchedShows: range(50, 60, (i) => show(i)) }),
      { ...side({ watchedMovies: mineMovies }), watchedShows: null },
    );
    expect(out.watched.mine).toBe(6); // 11 dizi sayılmadı
    expect(out.watched.theirs).toBe(6);
  });

  it("çok az veri: no-data", () => {
    const out = computeTasteInsights(side({ watchedMovies: [movie(1)] }), side({ watchedMovies: [movie(1)] }));
    expect(out.state).toBe("no-data");
    expect(out.score).toBeNull();
  });

  it("film ve dizi aynı kimlikte karışmaz", () => {
    const out = computeTasteInsights(
      side({ watchedMovies: range(1, 6, (i) => movie(i)), watchedShows: [] }),
      side({ watchedMovies: [], watchedShows: range(1, 6, (i) => show(i)) }),
    );
    expect(out.watched.overlap).toHaveLength(0);
  });

  it("ortak favoriler yalnız iki taraf da görünürse", () => {
    const both = computeTasteInsights(
      side({ favorites: [movie(1), movie(2)] }),
      side({ favorites: [movie(2), movie(3)] }),
    );
    expect(both.favorites.map((f) => f.id)).toEqual([2]);
    expect(computeTasteInsights(side({ favorites: [movie(1)] }), { ...side(), favorites: null }).favorites).toBeNull();
  });

  it("bozuk girdide çökmez", () => {
    for (const input of [undefined, null, {}, { watchedMovies: "x" }, { watchedMovies: [null, {}, { id: "x" }] }]) {
      expect(() => computeTasteInsights(input, input)).not.toThrow();
    }
    expect(computeTasteInsights(null, null).state).toBe("no-data");
  });

  it("ağırlıklar toplamı 1; kademe sınırları", () => {
    expect(WEIGHTS.genres + WEIGHTS.overlap + WEIGHTS.ratings).toBeCloseTo(1, 5); // çekirdek üçlü; favori göreli bonus
    expect(tierOf(100)).toBe("veryHigh");
    expect(tierOf(85)).toBe("veryHigh");
    expect(tierOf(84)).toBe("high");
    expect(tierOf(65)).toBe("high");
    expect(tierOf(64)).toBe("medium");
    expect(tierOf(40)).toBe("medium");
    expect(tierOf(39)).toBe("low");
    expect(tierOf(0)).toBe("low");
    expect(tierOf(null)).toBeNull();
  });

  it("eksik bileşenin ağırlığı kalanlara dağıtılır (yalnız ortak izlenen: puan 0-100 aralığında)", () => {
    const a = range(1, 10, (i) => movie(i, []));
    const b = range(6, 15, (i) => movie(i, []));
    const out = computeTasteInsights(side({ watchedMovies: a }), side({ watchedMovies: b }));
    expect(out.components).toEqual(["overlap"]);
    expect(out.score).toBe(Math.round(Math.sqrt(0.5) * 100));
  });
});

describe("computeTasteInsights (eski hesap + içgörüler): bileşen dökümü ve içgörüler", () => {
  const movies = range(1, 10, (i) => movie(i, i % 2 ? ["Drama"] : ["Komedi"]));

  it("döküm her bileşeni 0–100 olarak ve ağırlığıyla verir", () => {
    const ratings = Object.fromEntries(movies.map((m) => [`movie_${m.id}`, 8]));
    const out = computeTasteInsights(side({ watchedMovies: movies, ratings }), side({ watchedMovies: movies, ratings }));
    expect(out.breakdown).toEqual([
      { id: "genres", value: 100, weight: WEIGHTS.genres },
      { id: "overlap", value: 100, weight: WEIGHTS.overlap },
      { id: "ratings", value: 100, weight: WEIGHTS.ratings },
      { id: "genreRatings", value: 100, weight: WEIGHTS.genreRatings },
    ]);
  });

  it("ortak favori bonus bileşendir: ≥ 3 favori yoksa düşer ve puanı DEĞİŞTİRMEZ", () => {
    const base = computeTasteInsights(side({ watchedMovies: movies }), side({ watchedMovies: movies }));
    const few = computeTasteInsights(
      side({ watchedMovies: movies, favorites: [movie(1), movie(2)] }),
      side({ watchedMovies: movies, favorites: [movie(1), movie(2)] }),
    );
    expect(few.score).toBe(base.score);
    expect(few.components).not.toContain("favorites");
    expect(few.favorites).toHaveLength(2); // ortak favori satırı yine bilinir
  });

  it("ortak favori bileşeni ≥ 3 favoride girer; hiç ortak yoksa puanı düşürür", () => {
    const same = [movie(1), movie(2), movie(3)];
    const other = [movie(21), movie(22), movie(23)];
    const high = computeTasteInsights(side({ watchedMovies: movies, favorites: same }), side({ watchedMovies: movies, favorites: same }));
    const low = computeTasteInsights(side({ watchedMovies: movies, favorites: same }), side({ watchedMovies: movies, favorites: other }));
    expect(high.components).toContain("favorites");
    expect(high.breakdown.find((p) => p.id === "favorites").value).toBe(100);
    expect(low.breakdown.find((p) => p.id === "favorites").value).toBe(0);
    expect(low.score).toBeLessThan(high.score);
    expect(high.state).toBe("limited"); // puan uyumu yok → favori bileşeni "ok"u TAMAMLAMAZ (çekirdek üçlü şart)
  });

  it("favori listesi gizliyse bileşen yok (bilinmiyor ≠ sıfır)", () => {
    const out = computeTasteInsights(
      side({ watchedMovies: movies, favorites: [movie(1), movie(2), movie(3)] }),
      { ...side({ watchedMovies: movies }), favorites: null },
    );
    expect(out.components).not.toContain("favorites");
    expect(out.favorites).toBeNull();
  });

  it("birlikte sevilenler ve ayrışılan başlık yalnız ORTAK puanlılardan çıkar", () => {
    const mine = { movie_1: 10, movie_2: 9, movie_3: 2, movie_4: 8, movie_5: 8, movie_9: 10 };
    const theirs = { movie_1: 9, movie_2: 9, movie_3: 9, movie_4: 3, movie_5: 8 };
    const out = computeTasteInsights(
      side({ watchedMovies: movies.slice(0, 6), ratings: mine }), // movie_9 puanı var ama izlenenlerde yok → ortak değil
      side({ watchedMovies: movies.slice(0, 6), ratings: theirs }),
    );
    expect(out.loved.map((l) => l.name)).toEqual(["Film 1", "Film 2", "Film 5"]);
    expect(out.split).toEqual({ name: "Film 3", mine: 2, theirs: 9 });
  });

  it("ayrışma eşiğin altındaysa split yok; puanlı çift yoksa loved boş", () => {
    const r = Object.fromEntries(movies.map((m) => [`movie_${m.id}`, 7]));
    const same = computeTasteInsights(side({ watchedMovies: movies, ratings: r }), side({ watchedMovies: movies, ratings: r }));
    expect(same.split).toBeNull();
    const none = computeTasteInsights(side({ watchedMovies: movies }), side({ watchedMovies: movies }));
    expect(none.loved).toEqual([]);
    expect(none.split).toBeNull();
  });

  it("afiş şeridi: önce iki tarafın da puanladıkları (toplam yüksekten), afişsizler dışarıda, en çok 8", () => {
    const many = range(1, 12, (i) => movie(i));
    const noPoster = { ...movie(99), imagePath: null };
    const a = { movie_3: 9, movie_5: 5 };
    const b = { movie_3: 9, movie_5: 5, movie_7: 10 };
    const out = computeTasteInsights(
      side({ watchedMovies: [...many, noPoster], ratings: a }),
      side({ watchedMovies: [...many, noPoster], ratings: b }),
    );
    expect(out.highlights).toHaveLength(8);
    expect(out.highlights.map((h) => h.id).slice(0, 3)).toEqual([3, 5, 7]);
    expect(out.highlights[0]).toMatchObject({ mine: 9, theirs: 9 });
    expect(out.highlights[2]).toMatchObject({ mine: null, theirs: 10 });
    expect(out.highlights.some((h) => h.id === 99)).toBe(false);
  });

  it("tür eğilimi: kimin hangi türe daha çok yattığı; benzer dağılımda boş", () => {
    const mineList = [...range(1, 6, (i) => movie(i, ["Drama", "Korku"])), ...range(7, 8, (i) => movie(i, ["Drama", "Komedi"]))];
    const theirList = [...range(1, 2, (i) => movie(i, ["Drama", "Korku"])), ...range(9, 14, (i) => movie(i, ["Drama", "Komedi"]))];
    const out = computeTasteInsights(side({ watchedMovies: mineList }), side({ watchedMovies: theirList }));
    expect(out.genres.lean).toEqual({ mine: "Korku", theirs: "Komedi" });

    const flat = range(1, 8, (i) => movie(i, ["Drama"]));
    expect(computeTasteInsights(side({ watchedMovies: flat }), side({ watchedMovies: flat })).genres.lean).toEqual({ mine: null, theirs: null });
  });

  it("aynı dağılım farklı dilde yazılmışsa tür eğilimi üretilmez (kanonik türler eşit)", () => {
    const tr = range(1, 8, (i) => movie(i, ["Dram", "Komedi"]));
    const en = range(1, 8, (i) => movie(i, ["Drama", "Comedy"]));
    expect(computeTasteInsights(side({ watchedMovies: tr }), side({ watchedMovies: en })).genres.lean).toEqual({ mine: null, theirs: null });
  });

  it("derin analiz: sert/cömert puanlayan ama aynı sıralamayı yapan iki kişi yüksek eğilim uyumu alır", () => {
    const list = range(1, 12, (i) => movie(i, i <= 6 ? ["Dram"] : ["Korku"]));
    const mine = Object.fromEntries(list.map((m) => [`movie_${m.id}`, m.id <= 6 ? 9 : 5]));
    const theirs = Object.fromEntries(list.map((m) => [`movie_${m.id}`, m.id <= 6 ? 7 : 3])); // hep 2 eksik
    const out = computeTasteInsights(side({ watchedMovies: list, ratings: mine }), side({ watchedMovies: list, ratings: theirs }));
    expect(out.deep.correlation).toBeCloseTo(1, 5);
    expect(out.components).toEqual(expect.arrayContaining(["ratingTrend", "genreRatings"]));
    expect(out.breakdown.find((p) => p.id === "genreRatings").value).toBe(100); // göreli tür tercihi aynı
    expect(out.deep.generous).toEqual({ who: "mine", gap: 2 });
    expect(out.breakdown.find((p) => p.id === "ratingTrend").value).toBeGreaterThan(80);
  });

  it("derin analiz: bir türde ayrışma ve ortak sevilen tür", () => {
    const list = range(1, 12, (i) => movie(i, i <= 6 ? ["Dram"] : ["Korku"]));
    const mine = Object.fromEntries(list.map((m) => [`movie_${m.id}`, m.id <= 6 ? 9 : 9]));
    const theirs = Object.fromEntries(list.map((m) => [`movie_${m.id}`, m.id <= 6 ? 9 : 3]));
    const out = computeTasteInsights(side({ watchedMovies: list, ratings: mine }), side({ watchedMovies: list, ratings: theirs }));
    expect(out.deep.genreSplit).toEqual({ genre: "Korku", mine: 9, theirs: 3 });
    expect(out.deep.genreAgree).toMatchObject({ genre: "Dram" });
    expect(out.breakdown.find((p) => p.id === "genreRatings").value).toBeLessThan(50);
  });

  it("izleme listesi zevk uyumunu ETKİLEMEZ (boş, gizli ya da dolu olması fark etmez)", () => {
    const list = range(1, 10, (i) => movie(i, i % 2 ? ["Dram"] : ["Komedi"]));
    const ratings = Object.fromEntries(list.map((m) => [`movie_${m.id}`, 5 + (m.id % 4)]));
    const base = computeTasteInsights(side({ watchedMovies: list, ratings }), side({ watchedMovies: list, ratings }));
    const wl = range(200, 220, (i) => movie(i));
    const withLists = computeTasteInsights(
      side({ watchedMovies: list, ratings, watchList: wl }),
      side({ watchedMovies: list, ratings, watchList: wl.slice(0, 5) }),
    );
    const hidden = computeTasteInsights(side({ watchedMovies: list, ratings }), { ...side({ watchedMovies: list, ratings }), watchList: null });
    expect(withLists.score).toBe(base.score);
    expect(hidden.score).toBe(base.score);
    expect(withLists.components).not.toContain("watchlist");
    expect(WEIGHTS.watchlist).toBeUndefined();
  });

  it("çok türlü içerik profili şişirmez; ana tür (ilk sıradaki) yan türden ağır sayılır", () => {
    const single = range(1, 10, (i) => movie(i, ["Dram"]));
    const leadDrama = range(101, 110, (i) => movie(i, ["Dram", "Aksiyon", "Macera", "Bilim Kurgu"]));
    const tailDrama = range(201, 210, (i) => movie(i, ["Aksiyon", "Macera", "Bilim Kurgu", "Dram"]));
    const sim = (x, y) => computeTasteInsights(side({ watchedMovies: x }), side({ watchedMovies: y })).genres.similarity;
    expect(sim(single, leadDrama)).toBeGreaterThan(0.7);
    expect(sim(single, tailDrama)).toBeLessThan(0.3);
    expect(sim(single, single)).toBeCloseTo(1, 5);
  });

  it("tür tablosu: en az 5 tür (varsa), en çok 8; paylar ve ortalama puanlar", () => {
    const G = ["Dram", "Komedi", "Korku", "Aksiyon", "Gerilim", "Romantik", "Animasyon", "Belgesel", "Western", "Müzik"];
    const mineList = range(1, 40, (i) => movie(i, [G[i % 10], G[(i + 3) % 10]]));
    const theirList = range(1, 40, (i) => movie(i, [G[(i + 1) % 10]]));
    const ratings = Object.fromEntries(mineList.map((m) => [`movie_${m.id}`, 7]));
    const out = computeTasteInsights(side({ watchedMovies: mineList, ratings }), side({ watchedMovies: theirList, ratings }));
    expect(out.genres.table.length).toBeGreaterThanOrEqual(5);
    expect(out.genres.table.length).toBeLessThanOrEqual(8);
    const row = out.genres.table[0];
    expect(row).toEqual(expect.objectContaining({ genre: expect.any(String), mine: expect.any(Number), theirs: expect.any(Number) }));
    expect(out.genres.table.some((r) => r.mineAvg === 7)).toBe(true);
    // Azsa hepsi: yalnız 2 tür varsa tablo 2 satır.
    const two = range(1, 6, (i) => movie(i, i % 2 ? ["Dram"] : ["Komedi"]));
    expect(computeTasteInsights(side({ watchedMovies: two }), side({ watchedMovies: two })).genres.table).toHaveLength(2);
  });

  it("az veri: lowData kalkar; bol veride iner", () => {
    const few = range(1, 6, (i) => movie(i));
    const small = computeTasteInsights(side({ watchedMovies: few }), side({ watchedMovies: few }));
    expect(small.lowData).toBe(true);
    expect(small.confidence).toBe("low");

    const many = range(1, 60, (i) => movie(i, i % 3 ? ["Dram"] : ["Komedi", "Dram"]));
    const r = Object.fromEntries(many.map((m) => [`movie_${m.id}`, 4 + (m.id % 6)]));
    const big = computeTasteInsights(side({ watchedMovies: many, ratings: r }), side({ watchedMovies: many, ratings: r }));
    expect(big.lowData).toBe(false);
    expect(big.confidence).toBe("high");

    expect(computeTasteInsights(null, null).lowData).toBe(false); // veri hiç yoksa uyarı değil "no-data"
  });

  it("tür puan profili arkadaşın yalnız GÖRÜNÜR izlenenlerinden okunur", () => {
    const visible = range(1, 6, (i) => movie(i, ["Dram"]));
    const theirRatings = { ...Object.fromEntries(visible.map((m) => [`movie_${m.id}`, 8])) };
    // Arkadaşın listede görünmeyen 50 Korku puanı hesaba girmemeli.
    for (let i = 100; i < 150; i += 1) theirRatings[`movie_${i}`] = 1;
    const out = computeTasteInsights(
      side({ watchedMovies: visible, ratings: Object.fromEntries(visible.map((m) => [`movie_${m.id}`, 8])) }),
      side({ watchedMovies: visible, ratings: theirRatings }),
    );
    expect(out.deep.ratedTheirs).toBe(6);
  });

  it("veri yokken içgörüler boş ve çökmez", () => {
    const out = computeTasteInsights(null, null);
    expect(out).toMatchObject({ highlights: [], loved: [], split: null, breakdown: [] });
  });
});

describe("computeTasteInsights (eski hesap + içgörüler): film / dizi kırılımı", () => {
  const films = range(1, 8, (i) => movie(i, i % 2 ? ["Drama"] : ["Komedi"]));
  const shows = range(1, 8, (i) => show(i, i % 2 ? ["Drama"] : ["Komedi"]));
  const otherShows = range(101, 108, (i) => show(i, i % 2 ? ["Drama"] : ["Komedi"]));

  it("ikisi de açıksa her kategori kendi puanını alır", () => {
    const out = computeTasteInsights(
      side({ watchedMovies: films, watchedShows: shows }),
      side({ watchedMovies: films, watchedShows: otherShows }),
    );
    expect(out.scope).toBe("both");
    expect(out.byType.movie).toMatchObject({ shared: true, overlap: 8, mine: 8, theirs: 8 });
    expect(out.byType.tv).toMatchObject({ shared: true, overlap: 0 });
    expect(out.byType.movie.score).toBeGreaterThan(out.byType.tv.score);
  });

  it("yalnız filmler paylaşılmışsa: dizi 'paylaşılmıyor' (puan YOK), ana puan = film puanı", () => {
    const out = computeTasteInsights(
      side({ watchedMovies: films, watchedShows: shows }),
      { ...side({ watchedMovies: films }), watchedShows: null },
    );
    expect(out.scope).toBe("movies");
    expect(out.byType.tv).toEqual({ shared: false, score: null, overlap: 0, mine: 0, theirs: 0 });
    expect(out.byType.movie.score).toBe(out.score);
  });

  it("yalnız diziler paylaşılmışsa", () => {
    const out = computeTasteInsights(
      side({ watchedMovies: films, watchedShows: shows }),
      { ...side({ watchedShows: shows }), watchedMovies: null },
    );
    expect(out.scope).toBe("shows");
    expect(out.byType.movie.shared).toBe(false);
    expect(out.byType.tv.score).toBe(out.score);
  });

  it("paylaşılan ama kaydı az olan kategori: shared true, puan null", () => {
    const out = computeTasteInsights(
      side({ watchedMovies: films, watchedShows: shows.slice(0, 2) }),
      side({ watchedMovies: films, watchedShows: shows.slice(0, 2) }),
    );
    expect(out.byType.tv).toMatchObject({ shared: true, score: null });
    expect(out.byType.movie.score).not.toBeNull();
  });

  it("hiçbiri paylaşılmıyorsa scope none ve iki kategori de puansız", () => {
    const out = computeTasteInsights(side({ watchedMovies: films }), { watchedMovies: null, watchedShows: null, watchList: null, favorites: null, ratings: {} });
    expect(out.scope).toBe("none");
    expect(out.byType.movie.shared).toBe(false);
    expect(out.byType.tv.shared).toBe(false);
  });

  it("kategori puanı diğer kategorinin puanlarından/ortaklarından etkilenmez", () => {
    const ratings = Object.fromEntries(films.map((m) => [`movie_${m.id}`, 8]));
    const withShows = computeTasteInsights(
      side({ watchedMovies: films, watchedShows: shows, ratings }),
      side({ watchedMovies: films, watchedShows: shows, ratings }),
    );
    const moviesOnly = computeTasteInsights(side({ watchedMovies: films, ratings }), side({ watchedMovies: films, ratings }));
    expect(withShows.byType.movie.score).toBe(moviesOnly.score);
  });

  it("bozuk girdide çökmez", () => {
    const out = computeTasteInsights(null, null); // null yan = hiçbir liste görünmüyor
    expect(out.scope).toBe("none");
    expect(out.byType.movie).toMatchObject({ shared: false, score: null });
  });
});

describe("findTogetherCandidates", () => {
  const mineBase = (over = {}) => side({ watchedMovies: [], watchedShows: [], watchList: [], ...over });

  it("iki listede de olan ve ikisinin de izlemediği önce gelir", () => {
    const out = findTogetherCandidates(
      mineBase({ watchList: [movie(1), movie(2), movie(3)] }),
      mineBase({ watchList: [movie(2), movie(4)] }),
    );
    expect(out.candidates[0]).toMatchObject({ id: 2, source: "both" });
    expect(out.counts).toEqual({ both: 1, mine: 2, theirs: 1 });
    expect(out.candidates.map((c) => c.id).sort()).toEqual([1, 2, 3, 4]);
  });

  it("birinin izlediği aday olmaz (iki yönde)", () => {
    const out = findTogetherCandidates(
      mineBase({ watchList: [movie(1), movie(2)], watchedMovies: [movie(9)] }),
      mineBase({ watchList: [movie(9), movie(3)], watchedMovies: [movie(1)] }),
    );
    // 1: onun izlediği; 9: benim izlediğim → ikisi de elenir
    expect(out.candidates.map((c) => c.id).sort()).toEqual([2, 3]);
  });

  it("ortak aday ama arkadaş izlemişse elenir", () => {
    const out = findTogetherCandidates(
      mineBase({ watchList: [movie(1)] }),
      mineBase({ watchList: [movie(1)], watchedMovies: [movie(1)] }),
    );
    expect(out.candidates).toHaveLength(0);
  });

  it("arkadaşın izlenenleri gizliyse: benim listemdeki aday ÖNERİLMEZ (izlediği bilinmiyor); onun kendi izleme listesindekiler kalır", () => {
    const out = findTogetherCandidates(
      mineBase({ watchList: [movie(1), movie(2)] }),
      { watchedMovies: null, watchedShows: null, watchList: [movie(1), movie(3)], favorites: null, ratings: {} },
    );
    // 2 benim listemde ama onun izleyip izlemediği bilinmiyor → yok. 3 onun izleme listesinde (izlemediğine işaret) → var.
    expect(out.candidates.map((c) => c.id)).toEqual([1, 3]);
    expect(out.counts).toEqual({ both: 1, mine: 0, theirs: 1 });
  });

  it("arkadaşın izleme listesi gizliyse yalnız benim listemden (onun izlemediği bilinenler)", () => {
    const out = findTogetherCandidates(
      mineBase({ watchList: [movie(1), movie(2)] }),
      { watchedMovies: [movie(1)], watchedShows: [], watchList: null, favorites: null, ratings: {} },
    );
    expect(out.candidates.map((c) => ({ id: c.id, source: c.source }))).toEqual([{ id: 2, source: "mine" }]);
  });

  it("iki liste de gizli/boşsa aday yok", () => {
    expect(findTogetherCandidates({ watchList: null }, { watchList: null }).candidates).toEqual([]);
    expect(findTogetherCandidates(mineBase(), mineBase()).candidates).toEqual([]);
  });

  it("film ve dizi kimliği karışmaz", () => {
    const out = findTogetherCandidates(
      mineBase({ watchList: [{ id: 5, type: "tv", name: "D", imagePath: "/d.jpg" }] }),
      mineBase({ watchList: [{ id: 5, type: "movie", name: "F", imagePath: "/f.jpg" }] }),
    );
    expect(out.counts.both).toBe(0);
    expect(out.candidates).toHaveLength(2);
  });

  it("dönüşümlü sıralama ve üst sınır", () => {
    const mine = range(1, 30, (i) => movie(i));
    const theirs = range(101, 130, (i) => movie(i));
    const out = findTogetherCandidates(mineBase({ watchList: mine }), mineBase({ watchList: theirs }));
    expect(out.candidates).toHaveLength(MAX_CANDIDATES);
    expect(out.candidates.slice(0, 4).map((c) => c.source)).toEqual(["mine", "theirs", "mine", "theirs"]);
    expect(findTogetherCandidates(mineBase({ watchList: mine }), mineBase({ watchList: theirs }), { limit: 3 }).candidates).toHaveLength(3);
  });

  it("tekrarlı öğeler tek sayılır", () => {
    const out = findTogetherCandidates(mineBase({ watchList: [movie(1), movie(1)] }), mineBase({ watchList: [movie(1)] }));
    expect(out.candidates).toHaveLength(1);
  });

  it("deste kaynağı: posteri/adı olmayan atılır", () => {
    const source = candidatesToDeckSource([
      { id: 1, type: "movie", name: "A", imagePath: "/a.jpg", source: "both" },
      { id: 2, type: "movie", name: "B", imagePath: null },
      { id: 3, type: "tv", name: "", imagePath: "/c.jpg" },
      null,
    ]);
    expect(source).toEqual([{ id: 1, type: "movie", name: "A", imagePath: "/a.jpg" }]);
    expect(candidatesToDeckSource(undefined)).toEqual([]);
  });
});

describe("metin tablosu", () => {
  it("bilinmeyen dil İngilizce; cümleler ad ve sayı alır", () => {
    expect(getTasteMatchCopy("xx")).toBe(TASTE_MATCH_COPY.en);
    const tr = TASTE_MATCH_COPY.tr;
    expect(tr.together.action("Ada")).toContain("Ada");
    expect(tr.rows.overlap(1)).toBe("1 ortak izlenen");
    expect(tr.rows.overlap(5)).toBe("5 ortak izlenen");
    expect(TASTE_MATCH_COPY.en.rows.overlap(1)).toBe("1 title you both watched");
    for (const id of ["veryHigh", "high", "medium", "low"]) expect(tr.tiers[id]).toBeTruthy();
  });
});

// ── v3 (13 Kas): kartın yüzdesi yeni çekirdekten ────────────────────────────────
describe("computeTasteMatch (v3 yüzde)", () => {
  const NOW = Date.UTC(2026, 10, 13);
  const G = [["Dram"], ["Komedi"], ["Bilim Kurgu", "Aksiyon"], ["Korku"], ["Animasyon", "Aile"], ["Suç", "Gerilim"]];
  const ids = (from, n) => Array.from({ length: n }, (_, i) => from + i);
  const up = (id) => (id % 10) + 1;
  const down = (id) => 10 - (id % 10);
  const lib = (list, rate, shows = 0) => {
    const watchedMovies = list.map((id) => ({
      id,
      name: `m${id}`,
      imagePath: `/m${id}.jpg`,
      genres: G[id % 6],
      minutes: 90 + (id % 50),
      dateAdded: new Date(NOW - (id % 200) * 864e5).toISOString(),
      watchEvents: [{}],
    }));
    const ratings = {};
    list.forEach((id, i) => {
      if (i % 2 === 0) ratings[`movie_${id}`] = rate(id);
    });
    const watchedShows = Array.from({ length: shows }, (_, i) => ({
      id: 7000 + i,
      name: `s${i}`,
      genres: G[i % 6],
      showEpisodeCount: 10,
      watchedEpisodeCount: 10,
      watchedSeasonCount: 1,
      totalMinutes: 450,
      addedShowDate: new Date(NOW - i * 864e5).toISOString(),
    }));
    return { watchedMovies, watchedShows, watchList: [], favorites: [], ratings };
  };
  const run = (a, b) => computeTasteMatch(a, b, { now: NOW });

  it("yüzde, kademe ve kulvarlar v3'ten; eski skor yalnız legacy alanında", () => {
    const a = lib(ids(1, 200), up, 20);
    const out = run(a, lib(ids(1, 200), up, 20));
    const v3 = computeTasteV3(a, lib(ids(1, 200), up, 20), { now: NOW });
    expect(out.score).toBe(v3.all.display);
    expect(out.tier).toBe(tierOf(out.score));
    expect(out.byType.movie.score).toBe(v3.movie.display);
    expect(out.byType.tv.score).toBe(v3.tv.display);
    expect(out.legacy).toEqual({ score: computeTasteInsights(a, lib(ids(1, 200), up, 20)).score, tier: expect.any(String) });
    expect(out.score).toBeGreaterThanOrEqual(85);
    expect(out.lowData).toBe(false);
  });

  it("aynı yapımlara ters görüş: eski hesap yüksek derdi, yenisi düşük", () => {
    const out = run(lib(ids(1, 200), up), lib(ids(1, 200), down));
    expect(out.legacy.score).toBeGreaterThan(60);
    expect(out.score).toBeLessThan(40);
    expect(out.tier).toBe("low");
  });

  it("boyut adaleti: 1000 içindeki 100 yapım ikiz düzeyine çıkmaz", () => {
    const out = run(lib(ids(1, 1000), up), lib(ids(1, 100), up));
    expect(out.score).toBeLessThan(90);
    expect(out.v3.flags.binding).toBe("experience");
  });

  it("aynı zevk farklı kütüphaneden yüksek", () => {
    const me = lib(ids(1, 200), up);
    expect(run(me, lib(ids(1, 200), up)).score).toBeGreaterThan(run(me, lib(ids(5001, 200), up)).score);
  });

  it("arkadaşın gizli kategorisi benim tarafımda da sayılmaz", () => {
    const friend = { ...lib(ids(1, 200), up, 20), watchedMovies: null };
    const withMyMovies = run(lib(ids(1, 200), up, 20), friend);
    const noMyMovies = run(lib([], up, 20), friend);
    expect(withMyMovies.score).toBe(noMyMovies.score);
    expect(withMyMovies.byType.movie).toMatchObject({ shared: false, score: null });
    expect(withMyMovies.scope).toBe("shows");
  });

  it("karşı taraf hiçbir şey paylaşmıyorsa no-data", () => {
    const out = run(lib(ids(1, 50), up), { watchedMovies: null, watchedShows: null, watchList: null, favorites: null, ratings: {} });
    expect(out).toMatchObject({ state: "no-data", score: null, tier: null, lowData: false, v3: null });
  });

  it("döküm v3 parçalarını 0–100 ve ağırlığıyla taşır; v3 özeti yapım anahtarı içermez", () => {
    const out = run(lib(ids(1, 200), up), lib(ids(1, 200), up));
    for (const id of DEEP_COMPONENTS) {
      const part = out.breakdown.find((p) => p.id === id);
      expect(part.value).toBeGreaterThanOrEqual(0);
      expect(part.value).toBeLessThanOrEqual(100);
      expect(part.weight).toBe(V3_WEIGHTS[id]);
    }
    expect(V3_WEIGHTS.opinion + V3_WEIGHTS.selection + V3_WEIGHTS.content).toBeCloseTo(1, 5);
    expect(JSON.stringify(out.v3)).not.toMatch(/movie_|tv_/);
  });

  it("bozuk girdide çökmez", () => {
    for (const input of [undefined, null, {}, { watchedMovies: "x" }, { watchedMovies: [null, {}, { id: "x" }] }]) {
      expect(() => computeTasteMatch(input, input)).not.toThrow();
    }
    expect(computeTasteMatch(null, null).state).toBe("no-data");
  });
});
