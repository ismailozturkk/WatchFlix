import {
  buildListKeySet,
  foldText,
  GLOBAL_SEARCH_MIN_CHARS,
  LIST_SEARCH_MODE,
  listAcceptedTypes,
  listRequiresWatchDate,
  matchesListQuery,
  mediaKey,
  mergeRankedGroups,
  shouldQueryGlobal,
  toCandidate,
  toCandidates,
} from "../utils/listSearch";

describe("liste tipi kuralları", () => {
  test("izlenenler listeleri tek tip kabul eder", () => {
    expect(listAcceptedTypes("watchedMovies")).toEqual(["movie"]);
    expect(listAcceptedTypes("watchedTv")).toEqual(["tv"]);
  });

  test("favoriler, izlenecekler ve özel listeler karışıktır", () => {
    expect(listAcceptedTypes("favorites")).toEqual(["movie", "tv"]);
    expect(listAcceptedTypes("watchList")).toEqual(["movie", "tv"]);
    expect(listAcceptedTypes("Yaz Filmleri")).toEqual(["movie", "tv"]);
  });

  test("yalnız izlenenler listelerinde tarih sorulur", () => {
    expect(listRequiresWatchDate("watchedMovies")).toBe(true);
    expect(listRequiresWatchDate("watchedTv")).toBe(true);
    expect(listRequiresWatchDate("favorites")).toBe(false);
    expect(listRequiresWatchDate("Yaz Filmleri")).toBe(false);
  });
});

describe("metin katlama ve liste içi eşleşme", () => {
  test("büyük/küçük harf, Türkçe ı/İ ve aksan farkını siler", () => {
    expect(foldText("İyi Adam")).toBe("iyi adam");
    expect(foldText("GENÇ")).toBe("genc");
    expect(foldText("Amélie")).toBe("amelie");
    expect(foldText(null)).toBe("");
  });

  test("boş sorgu hiçbir öğeyi elemez", () => {
    expect(matchesListQuery({ name: "Inception" }, "")).toBe(true);
    expect(matchesListQuery({ name: "Inception" }, "   ")).toBe(true);
  });

  test("aksan/harf farkına rağmen eşleşir, alakasız sorguda elenir", () => {
    expect(matchesListQuery({ name: "Genç Pisi" }, "genc")).toBe(true);
    expect(matchesListQuery({ name: "İstanbul" }, "istanbul")).toBe(true);
    expect(matchesListQuery({ title: "Dune" }, "dune")).toBe(true);
    expect(matchesListQuery({ name: "Inception" }, "matrix")).toBe(false);
    expect(matchesListQuery(null, "matrix")).toBe(false);
  });
});

describe("liste anahtar kümesi", () => {
  test("aynı id'li film ve dizi ayrı anahtar alır", () => {
    expect(mediaKey("movie", 5)).toBe("movie_5");
    expect(mediaKey("tv", 5)).toBe("tv_5");
    expect(mediaKey(undefined, 5)).toBe("movie_5");
  });

  test("tipi olmayan watchedTv kaydı fallback tiple anahtarlanır", () => {
    const set = buildListKeySet(
      [{ id: 1399 }, { id: 66732, type: "tv" }, null, { type: "tv" }],
      { fallbackType: "tv" },
    );
    expect(set.has("tv_1399")).toBe(true);
    expect(set.has("tv_66732")).toBe(true);
    expect(set.size).toBe(2);
  });
});

describe("TMDB sonucundan aday üretimi", () => {
  const rawMovie = {
    id: 27205,
    media_type: "movie",
    title: "Inception",
    release_date: "2010-07-15",
    poster_path: "/inception.jpg",
    genre_ids: [28, 878],
    vote_average: 8.367,
    vote_count: 36000,
    popularity: 120.5,
    overview: "Rüya içinde rüya.",
  };

  test("film sonucu TMDB alan adlarını koruyarak normalleşir", () => {
    expect(toCandidate(rawMovie)).toEqual({
      id: 27205,
      key: "movie_27205",
      media_type: "movie",
      type: "movie",
      title: "Inception",
      name: "Inception",
      poster_path: "/inception.jpg",
      backdrop_path: null,
      genre_ids: [28, 878],
      overview: "Rüya içinde rüya.",
      year: "2010",
      rating: 8.4,
      voteCount: 36000,
      popularity: 120.5,
    });
  });

  test("dizi sonucunda name/first_air_date okunur", () => {
    const candidate = toCandidate(
      { id: 1399, name: "Game of Thrones", first_air_date: "2011-04-17" },
      { fallbackType: "tv" },
    );
    expect(candidate.type).toBe("tv");
    expect(candidate.title).toBe("Game of Thrones");
    expect(candidate.year).toBe("2011");
    expect(candidate.key).toBe("tv_1399");
  });

  test("bozuk girdi ve eksik alanlar çökertmez", () => {
    expect(toCandidate(null)).toBeNull();
    expect(toCandidate({ title: "id yok" })).toBeNull();
    const bare = toCandidate({ id: 7 });
    expect(bare.title).toBe("");
    expect(bare.year).toBe("");
    expect(bare.rating).toBe(0);
    expect(bare.genre_ids).toEqual([]);
  });

  test("kabul edilmeyen tip elenir, tekrar eden eser tekilleşir", () => {
    const list = toCandidates(
      [
        rawMovie,
        { ...rawMovie },
        { id: 1399, media_type: "tv", name: "GoT" },
        { id: 3, media_type: "person", name: "Kişi" },
      ],
      { acceptedTypes: ["movie"] },
    );
    expect(list.map((c) => c.key)).toEqual(["movie_27205"]);
  });

  test("limit kaynak sırasını bozmadan uygulanır", () => {
    const raw = [1, 2, 3, 4].map((id) => ({ id, media_type: "movie", title: `F${id}` }));
    expect(toCandidates(raw, { limit: 2 }).map((c) => c.id)).toEqual([1, 2]);
    expect(toCandidates(undefined)).toEqual([]);
  });
});

describe("film + dizi sonuçlarının birleşmesi", () => {
  const movie = (id, popularity) => ({
    id,
    key: `movie_${id}`,
    type: "movie",
    popularity,
    voteCount: 0,
  });
  const show = (id, popularity) => ({
    id,
    key: `tv_${id}`,
    type: "tv",
    popularity,
    voteCount: 0,
  });

  test("her grubun ilk sonucu diğer grubun ikincisinden önce gelir", () => {
    const merged = mergeRankedGroups([
      [movie(1, 10), movie(2, 9)],
      [show(1, 8), show(2, 7)],
    ]);
    expect(merged.map((c) => c.key)).toEqual([
      "movie_1",
      "tv_1",
      "movie_2",
      "tv_2",
    ]);
  });

  test("aynı sıradakiler popülerliğe göre dizilir", () => {
    const merged = mergeRankedGroups([[movie(1, 5)], [show(9, 50)]]);
    expect(merged.map((c) => c.key)).toEqual(["tv_9", "movie_1"]);
  });

  test("tek tipli listede grup sırası aynen korunur", () => {
    const merged = mergeRankedGroups([[movie(1, 1), movie(2, 99)]]);
    expect(merged.map((c) => c.id)).toEqual([1, 2]);
  });

  test("boş/bozuk gruplar ve limit güvenli işlenir", () => {
    expect(mergeRankedGroups(undefined)).toEqual([]);
    expect(mergeRankedGroups([null, [movie(1, 1), null]])).toHaveLength(1);
    expect(mergeRankedGroups([[movie(1, 1), movie(2, 1)]], { limit: 1 })).toHaveLength(1);
  });

  test("iki grupta da geçen eser bir kez döner", () => {
    const merged = mergeRankedGroups([[movie(4, 1)], [movie(4, 1)]]);
    expect(merged).toHaveLength(1);
  });
});

describe("global aramaya çıkma kararı", () => {
  test("yalnız global kipte ve eşik karakterden sonra ağa çıkılır", () => {
    expect(shouldQueryGlobal(LIST_SEARCH_MODE.GLOBAL, "in")).toBe(true);
    expect(shouldQueryGlobal(LIST_SEARCH_MODE.GLOBAL, " i ")).toBe(false);
    expect(shouldQueryGlobal(LIST_SEARCH_MODE.IN_LIST, "inception")).toBe(false);
    expect(shouldQueryGlobal(LIST_SEARCH_MODE.GLOBAL, undefined)).toBe(false);
    expect(GLOBAL_SEARCH_MIN_CHARS).toBe(2);
  });
});
