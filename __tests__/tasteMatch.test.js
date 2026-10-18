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
    expect(WEIGHTS.genres + WEIGHTS.overlap + WEIGHTS.ratings).toBeCloseTo(1, 5);
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
