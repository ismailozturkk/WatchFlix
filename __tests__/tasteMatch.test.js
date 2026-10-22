// __tests__/tasteMatch.test.js
//
// Arkadaşla zevk uyumu + birlikte izleyelim adayları (utils/tasteMatch.js) ve metin tablosu.
const {
  MAX_CANDIDATES,
  MIN_RATED_PAIRS,
  WEIGHTS,
  candidatesToDeckSource,
  computeTasteMatch,
  findTogetherCandidates,
  tierOf,
} = require("../utils/tasteMatch");
const { TASTE_MATCH_COPY, getTasteMatchCopy } = require("../utils/tasteMatchCopy");

const movie = (id, genres = ["Drama"], extra = {}) => ({ id, type: "movie", name: `Film ${id}`, imagePath: `/m${id}.jpg`, genres, ...extra });
const show = (id, genres = ["Drama"]) => ({ id, name: `Dizi ${id}`, imagePath: `/t${id}.jpg`, genres }); // türü yok: liste belirler
const range = (from, to, make) => Array.from({ length: to - from + 1 }, (_, i) => make(from + i));

const side = (over = {}) => ({ watchedMovies: [], watchedShows: [], watchList: [], favorites: [], ratings: {}, ...over });

describe("computeTasteMatch", () => {
  it("özdeş zevk: yüksek puan ve çok ortak izlenen", () => {
    const movies = range(1, 10, (i) => movie(i, i % 2 ? ["Drama"] : ["Komedi"]));
    const ratings = Object.fromEntries(movies.map((m) => [`movie_${m.id}`, 8]));
    const out = computeTasteMatch(side({ watchedMovies: movies, ratings }), side({ watchedMovies: movies, ratings }));
    expect(out.state).toBe("ok");
    expect(out.score).toBe(100);
    expect(out.tier).toBe("veryHigh");
    expect(out.watched.overlap).toHaveLength(10);
    expect(out.ratings).toEqual({ pairs: 10, agreement: 1 });
    expect(out.genres.shared.sort()).toEqual(["Drama", "Komedi"]);
    expect(out.components.sort()).toEqual(["genres", "overlap", "ratings"]);
  });

  it("hiç ortak yok + farklı türler: düşük puan", () => {
    const a = range(1, 8, (i) => movie(i, ["Korku"]));
    const b = range(101, 108, (i) => movie(i, ["Komedi"]));
    const out = computeTasteMatch(side({ watchedMovies: a }), side({ watchedMovies: b }));
    // Ortak tür sözlüğü yok (korku ≠ komedi) → tür bileşeni düşer; ortak izlenen 0 → puan 0.
    expect(out.genres.comparable).toBe(false);
    expect(out.score).toBe(0);
    expect(out.tier).toBe("low");
    expect(out.state).toBe("limited");
  });

  it("tür sözlüğü farklı dilde (Dram / Drama): tür bileşeni HESABA GİRMEZ", () => {
    const tr = range(1, 8, (i) => movie(i, ["Dram", "Komedi"]));
    const en = range(1, 8, (i) => movie(i, ["Drama", "Comedy"]));
    const out = computeTasteMatch(side({ watchedMovies: tr }), side({ watchedMovies: en }));
    expect(out.genres.comparable).toBe(false);
    expect(out.genres.similarity).toBeNull();
    expect(out.components).toEqual(["overlap"]);
    expect(out.watched.overlap).toHaveLength(8); // ortak izlenen yine bulunur
  });

  it("puan uyumu: ortak izlenenlerde fark büyüdükçe düşer; 3'ten az çiftte yok", () => {
    const movies = range(1, 6, (i) => movie(i));
    const mine = Object.fromEntries(movies.map((m) => [`movie_${m.id}`, 9]));
    const far = Object.fromEntries(movies.map((m) => [`movie_${m.id}`, 3]));
    const out = computeTasteMatch(side({ watchedMovies: movies, ratings: mine }), side({ watchedMovies: movies, ratings: far }));
    expect(out.ratings.pairs).toBe(6);
    expect(out.ratings.agreement).toBeCloseTo(1 - 6 / 9, 5);

    const few = computeTasteMatch(
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
    const out = computeTasteMatch(side({ watchedMovies: mineMovies, ratings }), side({ watchedMovies: theirMovies, ratings }));
    expect(out.ratings.pairs).toBe(3);
  });

  it("karşı taraf izlenen listelerini gizliyorsa: no-data, uydurma puan yok", () => {
    const out = computeTasteMatch(
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
    const out = computeTasteMatch(
      side({ watchedMovies: mineMovies, watchedShows: range(50, 60, (i) => show(i)) }),
      { ...side({ watchedMovies: mineMovies }), watchedShows: null },
    );
    expect(out.watched.mine).toBe(6); // 11 dizi sayılmadı
    expect(out.watched.theirs).toBe(6);
  });

  it("çok az veri: no-data", () => {
    const out = computeTasteMatch(side({ watchedMovies: [movie(1)] }), side({ watchedMovies: [movie(1)] }));
    expect(out.state).toBe("no-data");
    expect(out.score).toBeNull();
  });

  it("film ve dizi aynı kimlikte karışmaz", () => {
    const out = computeTasteMatch(
      side({ watchedMovies: range(1, 6, (i) => movie(i)), watchedShows: [] }),
      side({ watchedMovies: [], watchedShows: range(1, 6, (i) => show(i)) }),
    );
    expect(out.watched.overlap).toHaveLength(0);
  });

  it("ortak favoriler yalnız iki taraf da görünürse", () => {
    const both = computeTasteMatch(
      side({ favorites: [movie(1), movie(2)] }),
      side({ favorites: [movie(2), movie(3)] }),
    );
    expect(both.favorites.map((f) => f.id)).toEqual([2]);
    expect(computeTasteMatch(side({ favorites: [movie(1)] }), { ...side(), favorites: null }).favorites).toBeNull();
  });

  it("bozuk girdide çökmez", () => {
    for (const input of [undefined, null, {}, { watchedMovies: "x" }, { watchedMovies: [null, {}, { id: "x" }] }]) {
      expect(() => computeTasteMatch(input, input)).not.toThrow();
    }
    expect(computeTasteMatch(null, null).state).toBe("no-data");
  });

  it("ağırlıklar toplamı 1; kademe sınırları", () => {
    expect(WEIGHTS.genres + WEIGHTS.overlap + WEIGHTS.ratings).toBeCloseTo(1, 5); // çekirdek üçlü; favori göreli bonus
    expect(tierOf(100)).toBe("veryHigh");
    expect(tierOf(75)).toBe("veryHigh");
    expect(tierOf(74)).toBe("high");
    expect(tierOf(55)).toBe("high");
    expect(tierOf(35)).toBe("medium");
    expect(tierOf(34)).toBe("low");
    expect(tierOf(0)).toBe("low");
    expect(tierOf(null)).toBeNull();
  });

  it("eksik bileşenin ağırlığı kalanlara dağıtılır (yalnız ortak izlenen: puan 0-100 aralığında)", () => {
    const a = range(1, 10, (i) => movie(i, []));
    const b = range(6, 15, (i) => movie(i, []));
    const out = computeTasteMatch(side({ watchedMovies: a }), side({ watchedMovies: b }));
    expect(out.components).toEqual(["overlap"]);
    expect(out.score).toBe(Math.round(Math.sqrt(0.5) * 100));
  });
});

describe("computeTasteMatch: bileşen dökümü ve içgörüler", () => {
  const movies = range(1, 10, (i) => movie(i, i % 2 ? ["Drama"] : ["Komedi"]));

  it("döküm her bileşeni 0–100 olarak ve ağırlığıyla verir", () => {
    const ratings = Object.fromEntries(movies.map((m) => [`movie_${m.id}`, 8]));
    const out = computeTasteMatch(side({ watchedMovies: movies, ratings }), side({ watchedMovies: movies, ratings }));
    expect(out.breakdown).toEqual([
      { id: "genres", value: 100, weight: WEIGHTS.genres },
      { id: "overlap", value: 100, weight: WEIGHTS.overlap },
      { id: "ratings", value: 100, weight: WEIGHTS.ratings },
    ]);
  });

  it("ortak favori bonus bileşendir: ≥ 3 favori yoksa düşer ve puanı DEĞİŞTİRMEZ", () => {
    const base = computeTasteMatch(side({ watchedMovies: movies }), side({ watchedMovies: movies }));
    const few = computeTasteMatch(
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
    const high = computeTasteMatch(side({ watchedMovies: movies, favorites: same }), side({ watchedMovies: movies, favorites: same }));
    const low = computeTasteMatch(side({ watchedMovies: movies, favorites: same }), side({ watchedMovies: movies, favorites: other }));
    expect(high.components).toContain("favorites");
    expect(high.breakdown.find((p) => p.id === "favorites").value).toBe(100);
    expect(low.breakdown.find((p) => p.id === "favorites").value).toBe(0);
    expect(low.score).toBeLessThan(high.score);
    expect(high.state).toBe("limited"); // puan uyumu yok → favori bileşeni "ok"u TAMAMLAMAZ (çekirdek üçlü şart)
  });

  it("favori listesi gizliyse bileşen yok (bilinmiyor ≠ sıfır)", () => {
    const out = computeTasteMatch(
      side({ watchedMovies: movies, favorites: [movie(1), movie(2), movie(3)] }),
      { ...side({ watchedMovies: movies }), favorites: null },
    );
    expect(out.components).not.toContain("favorites");
    expect(out.favorites).toBeNull();
  });

  it("birlikte sevilenler ve ayrışılan başlık yalnız ORTAK puanlılardan çıkar", () => {
    const mine = { movie_1: 10, movie_2: 9, movie_3: 2, movie_4: 8, movie_5: 8, movie_9: 10 };
    const theirs = { movie_1: 9, movie_2: 9, movie_3: 9, movie_4: 3, movie_5: 8 };
    const out = computeTasteMatch(
      side({ watchedMovies: movies.slice(0, 6), ratings: mine }), // movie_9 puanı var ama izlenenlerde yok → ortak değil
      side({ watchedMovies: movies.slice(0, 6), ratings: theirs }),
    );
    expect(out.loved.map((l) => l.name)).toEqual(["Film 1", "Film 2", "Film 5"]);
    expect(out.split).toEqual({ name: "Film 3", mine: 2, theirs: 9 });
  });

  it("ayrışma eşiğin altındaysa split yok; puanlı çift yoksa loved boş", () => {
    const r = Object.fromEntries(movies.map((m) => [`movie_${m.id}`, 7]));
    const same = computeTasteMatch(side({ watchedMovies: movies, ratings: r }), side({ watchedMovies: movies, ratings: r }));
    expect(same.split).toBeNull();
    const none = computeTasteMatch(side({ watchedMovies: movies }), side({ watchedMovies: movies }));
    expect(none.loved).toEqual([]);
    expect(none.split).toBeNull();
  });

  it("afiş şeridi: önce iki tarafın da puanladıkları (toplam yüksekten), afişsizler dışarıda, en çok 8", () => {
    const many = range(1, 12, (i) => movie(i));
    const noPoster = { ...movie(99), imagePath: null };
    const a = { movie_3: 9, movie_5: 5 };
    const b = { movie_3: 9, movie_5: 5, movie_7: 10 };
    const out = computeTasteMatch(
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
    const out = computeTasteMatch(side({ watchedMovies: mineList }), side({ watchedMovies: theirList }));
    expect(out.genres.lean).toEqual({ mine: "Korku", theirs: "Komedi" });

    const flat = range(1, 8, (i) => movie(i, ["Drama"]));
    expect(computeTasteMatch(side({ watchedMovies: flat }), side({ watchedMovies: flat })).genres.lean).toEqual({ mine: null, theirs: null });
  });

  it("farklı dilde tür eğilimi üretilmez (karşılaştırılamaz sözlük)", () => {
    const tr = range(1, 8, (i) => movie(i, ["Dram", "Komedi"]));
    const en = range(1, 8, (i) => movie(i, ["Drama", "Comedy"]));
    expect(computeTasteMatch(side({ watchedMovies: tr }), side({ watchedMovies: en })).genres.lean).toEqual({ mine: null, theirs: null });
  });

  it("veri yokken içgörüler boş ve çökmez", () => {
    const out = computeTasteMatch(null, null);
    expect(out).toMatchObject({ highlights: [], loved: [], split: null, breakdown: [] });
  });
});

describe("computeTasteMatch: film / dizi kırılımı", () => {
  const films = range(1, 8, (i) => movie(i, i % 2 ? ["Drama"] : ["Komedi"]));
  const shows = range(1, 8, (i) => show(i, i % 2 ? ["Drama"] : ["Komedi"]));
  const otherShows = range(101, 108, (i) => show(i, i % 2 ? ["Drama"] : ["Komedi"]));

  it("ikisi de açıksa her kategori kendi puanını alır", () => {
    const out = computeTasteMatch(
      side({ watchedMovies: films, watchedShows: shows }),
      side({ watchedMovies: films, watchedShows: otherShows }),
    );
    expect(out.scope).toBe("both");
    expect(out.byType.movie).toMatchObject({ shared: true, overlap: 8, mine: 8, theirs: 8 });
    expect(out.byType.tv).toMatchObject({ shared: true, overlap: 0 });
    expect(out.byType.movie.score).toBeGreaterThan(out.byType.tv.score);
  });

  it("yalnız filmler paylaşılmışsa: dizi 'paylaşılmıyor' (puan YOK), ana puan = film puanı", () => {
    const out = computeTasteMatch(
      side({ watchedMovies: films, watchedShows: shows }),
      { ...side({ watchedMovies: films }), watchedShows: null },
    );
    expect(out.scope).toBe("movies");
    expect(out.byType.tv).toEqual({ shared: false, score: null, overlap: 0, mine: 0, theirs: 0 });
    expect(out.byType.movie.score).toBe(out.score);
  });

  it("yalnız diziler paylaşılmışsa", () => {
    const out = computeTasteMatch(
      side({ watchedMovies: films, watchedShows: shows }),
      { ...side({ watchedShows: shows }), watchedMovies: null },
    );
    expect(out.scope).toBe("shows");
    expect(out.byType.movie.shared).toBe(false);
    expect(out.byType.tv.score).toBe(out.score);
  });

  it("paylaşılan ama kaydı az olan kategori: shared true, puan null", () => {
    const out = computeTasteMatch(
      side({ watchedMovies: films, watchedShows: shows.slice(0, 2) }),
      side({ watchedMovies: films, watchedShows: shows.slice(0, 2) }),
    );
    expect(out.byType.tv).toMatchObject({ shared: true, score: null });
    expect(out.byType.movie.score).not.toBeNull();
  });

  it("hiçbiri paylaşılmıyorsa scope none ve iki kategori de puansız", () => {
    const out = computeTasteMatch(side({ watchedMovies: films }), { watchedMovies: null, watchedShows: null, watchList: null, favorites: null, ratings: {} });
    expect(out.scope).toBe("none");
    expect(out.byType.movie.shared).toBe(false);
    expect(out.byType.tv.shared).toBe(false);
  });

  it("kategori puanı diğer kategorinin puanlarından/ortaklarından etkilenmez", () => {
    const ratings = Object.fromEntries(films.map((m) => [`movie_${m.id}`, 8]));
    const withShows = computeTasteMatch(
      side({ watchedMovies: films, watchedShows: shows, ratings }),
      side({ watchedMovies: films, watchedShows: shows, ratings }),
    );
    const moviesOnly = computeTasteMatch(side({ watchedMovies: films, ratings }), side({ watchedMovies: films, ratings }));
    expect(withShows.byType.movie.score).toBe(moviesOnly.score);
  });

  it("bozuk girdide çökmez", () => {
    const out = computeTasteMatch(null, null); // null yan = hiçbir liste görünmüyor
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
