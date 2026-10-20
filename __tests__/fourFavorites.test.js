const {
  MAX_FAVORITES,
  addFavorite,
  buildFavoritesPrompt,
  countFavorites,
  creditsToCandidates,
  describeSources,
  emptyFavorites,
  favoritesEqual,
  hasAnyFavorites,
  hasRecommendationSignal,
  isFavorite,
  isKindFull,
  normalizeEntry,
  normalizeFavorites,
  rankRecommendations,
  readProfileFavorites,
  recommendationSources,
  removeFavorite,
  toFavoriteEntry,
  toggleFavorite,
  toPickerRows,
} = require("../utils/fourFavorites");

const movie = (id, extra = {}) => ({ id, title: `Film ${id}`, image: `/m${id}.jpg`, ...extra });

describe("normalizeEntry", () => {
  it("keeps a valid entry and trims the title", () => {
    expect(normalizeEntry({ id: 27205, title: "  Inception ", image: "/abc.jpg", year: "2010" })).toEqual({
      id: 27205,
      title: "Inception",
      image: "/abc.jpg",
      year: "2010",
    });
  });

  it("rejects entries without a usable id or title", () => {
    expect(normalizeEntry(null)).toBeNull();
    expect(normalizeEntry({ id: 0, title: "x" })).toBeNull();
    expect(normalizeEntry({ id: -3, title: "x" })).toBeNull();
    expect(normalizeEntry({ id: 1.5, title: "x" })).toBeNull();
    expect(normalizeEntry({ id: 5, title: "   " })).toBeNull();
    expect(normalizeEntry({ id: 5 })).toBeNull();
  });

  it("drops an image path that could escape the TMDB image root", () => {
    expect(normalizeEntry({ id: 1, title: "x", image: "https://evil.example/a.jpg" }).image).toBeNull();
    expect(normalizeEntry({ id: 1, title: "x", image: "/../secret" }).image).toBeNull();
    expect(normalizeEntry({ id: 1, title: "x", image: "no-slash.jpg" }).image).toBeNull();
  });

  it("omits a malformed year instead of storing it", () => {
    expect(normalizeEntry({ id: 1, title: "x", year: "20x0" })).not.toHaveProperty("year");
  });

  it("caps an absurdly long title", () => {
    expect(normalizeEntry({ id: 1, title: "a".repeat(500) }).title).toHaveLength(120);
  });
});

describe("normalizeFavorites", () => {
  it("always returns the three lists, even for garbage", () => {
    for (const bad of [null, undefined, "x", 4, [], { movies: "no" }]) {
      expect(normalizeFavorites(bad)).toEqual(emptyFavorites());
    }
  });

  it("de-duplicates, drops invalid rows and caps each list at four", () => {
    const raw = {
      movies: [movie(1), movie(1), { id: "x" }, movie(2), movie(3), movie(4), movie(5), movie(6)],
      shows: [],
      people: [{ id: 9, title: "Tom Hardy", image: "/p.jpg" }],
    };
    const out = normalizeFavorites(raw);
    expect(out.movies.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(out.people).toHaveLength(1);
    expect(MAX_FAVORITES).toBe(4);
  });

  it("ignores unknown keys such as a stale updatedAt", () => {
    const out = normalizeFavorites({ movies: [movie(1)], updatedAt: 123, books: [movie(2)] });
    expect(Object.keys(out).sort()).toEqual(["movies", "people", "shows"]);
  });

  it("reads a profile document with no field as empty", () => {
    expect(readProfileFavorites({})).toEqual(emptyFavorites());
    expect(readProfileFavorites(null)).toEqual(emptyFavorites());
  });
});

describe("toFavoriteEntry", () => {
  it("maps each kind from its own TMDB fields", () => {
    expect(
      toFavoriteEntry("movies", { id: 1, title: "Heat", poster_path: "/h.jpg", release_date: "1995-12-15" }),
    ).toEqual({ id: 1, title: "Heat", image: "/h.jpg", year: "1995" });
    expect(
      toFavoriteEntry("shows", { id: 2, name: "Dark", poster_path: "/d.jpg", first_air_date: "2017-12-01" }),
    ).toEqual({ id: 2, title: "Dark", image: "/d.jpg", year: "2017" });
    expect(toFavoriteEntry("people", { id: 3, name: "Cillian Murphy", profile_path: "/c.jpg" })).toEqual({
      id: 3,
      title: "Cillian Murphy",
      image: "/c.jpg",
    });
  });

  it("falls back to the original title and tolerates a missing image", () => {
    expect(toFavoriteEntry("movies", { id: 4, original_title: "Parasite" })).toEqual({
      id: 4,
      title: "Parasite",
      image: null,
    });
  });

  it("rejects an unknown kind or a person row read as a movie", () => {
    expect(toFavoriteEntry("books", { id: 1, title: "x" })).toBeNull();
    // Kişi kaydında `title` yok → film olarak okununca başlıksız, reddedilir.
    expect(toFavoriteEntry("movies", { id: 3, name: "Cillian Murphy" })).toBeNull();
  });
});

describe("toPickerRows", () => {
  it("builds rows with a year for titles and known-for works for people", () => {
    const films = toPickerRows("movies", [
      { id: 1, title: "Heat", poster_path: "/h.jpg", release_date: "1995-12-15" },
    ]);
    expect(films).toEqual([
      { key: "movies-1", entry: { id: 1, title: "Heat", image: "/h.jpg", year: "1995" }, subtitle: "1995" },
    ]);
    const people = toPickerRows("people", [
      {
        id: 9,
        name: "Tom Hardy",
        profile_path: "/t.jpg",
        known_for: [{ title: "Inception" }, { name: "Peaky Blinders" }, { title: "Venom" }],
      },
    ]);
    expect(people[0].subtitle).toBe("Inception • Peaky Blinders");
  });

  it("drops duplicates, invalid rows, adult rows and excluded ids, keeping relevance order", () => {
    const rows = toPickerRows(
      "shows",
      [
        { id: 3, name: "C", poster_path: "/c.jpg" },
        { id: 1, name: "A", poster_path: "/a.jpg" },
        { id: 1, name: "A again", poster_path: "/a.jpg" },
        { id: 2, name: "B", poster_path: "/b.jpg", adult: true },
        { id: 4 },
        { id: 5, name: "E", poster_path: "/e.jpg" },
      ],
      { exclude: [5] },
    );
    expect(rows.map((r) => r.entry.id)).toEqual([3, 1]);
  });

  it("respects the limit and tolerates junk input", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, title: `T${i + 1}` }));
    expect(toPickerRows("movies", many, { limit: 5 })).toHaveLength(5);
    expect(toPickerRows("movies", null)).toEqual([]);
    expect(toPickerRows("books", many)).toEqual([]);
  });
});

describe("adding, removing and toggling", () => {
  it("adds up to four and then refuses (same reference)", () => {
    let favs = emptyFavorites();
    for (const id of [1, 2, 3, 4]) favs = addFavorite(favs, "movies", movie(id));
    expect(countFavorites(favs, "movies")).toBe(4);
    expect(isKindFull(favs, "movies")).toBe(true);
    const after = addFavorite(favs, "movies", movie(5));
    expect(after).toBe(favs);
  });

  it("limits are per kind: a full movie list does not block shows", () => {
    let favs = emptyFavorites();
    for (const id of [1, 2, 3, 4]) favs = addFavorite(favs, "movies", movie(id));
    const next = addFavorite(favs, "shows", movie(10));
    expect(next.shows).toHaveLength(1);
  });

  it("returns the same reference for a duplicate or an invalid entry", () => {
    const favs = addFavorite(emptyFavorites(), "movies", movie(1));
    expect(addFavorite(favs, "movies", movie(1))).toBe(favs);
    expect(addFavorite(favs, "movies", { id: "x" })).toBe(favs);
    expect(addFavorite(favs, "unknown", movie(2))).toBe(favs);
  });

  it("keeps insertion order and removes by id", () => {
    let favs = emptyFavorites();
    for (const id of [3, 1, 2]) favs = addFavorite(favs, "movies", movie(id));
    expect(favs.movies.map((m) => m.id)).toEqual([3, 1, 2]);
    favs = removeFavorite(favs, "movies", 1);
    expect(favs.movies.map((m) => m.id)).toEqual([3, 2]);
    expect(removeFavorite(favs, "movies", 99)).toBe(favs);
  });

  it("accepts a string id when checking membership (route params arrive as strings)", () => {
    const favs = addFavorite(emptyFavorites(), "people", { id: 7, title: "P" });
    expect(isFavorite(favs, "people", "7")).toBe(true);
    expect(isFavorite(favs, "people", 8)).toBe(false);
  });

  it("toggle adds, then removes; on a full list it will not add", () => {
    let favs = toggleFavorite(emptyFavorites(), "shows", movie(5));
    expect(isFavorite(favs, "shows", 5)).toBe(true);
    favs = toggleFavorite(favs, "shows", movie(5));
    expect(isFavorite(favs, "shows", 5)).toBe(false);

    let full = emptyFavorites();
    for (const id of [1, 2, 3, 4]) full = addFavorite(full, "shows", movie(id));
    expect(toggleFavorite(full, "shows", movie(9))).toBe(full);
    // …ama dolu listeden seçili olanı çıkarmak yine mümkün.
    expect(toggleFavorite(full, "shows", movie(2)).shows).toHaveLength(3);
  });
});

describe("counting and equality", () => {
  it("counts per kind and in total; zero favourites is a valid state", () => {
    let favs = emptyFavorites();
    expect(hasAnyFavorites(favs)).toBe(false);
    favs = addFavorite(favs, "movies", movie(1));
    favs = addFavorite(favs, "people", { id: 2, title: "P" });
    expect(countFavorites(favs)).toBe(2);
    expect(countFavorites(favs, "movies")).toBe(1);
    expect(hasAnyFavorites(favs)).toBe(true);
  });

  it("equality is order-sensitive and ignores noise outside the id", () => {
    const a = { movies: [movie(1), movie(2)], shows: [], people: [] };
    const b = { movies: [movie(2), movie(1)], shows: [], people: [] };
    expect(favoritesEqual(a, a)).toBe(true);
    expect(favoritesEqual(a, b)).toBe(false);
    expect(favoritesEqual(a, { ...a, movies: [movie(1, { title: "Renamed" }), movie(2)] })).toBe(true);
    expect(favoritesEqual(null, emptyFavorites())).toBe(true);
  });
});

describe("recommendation sources", () => {
  const favs = {
    movies: [movie(10), movie(11)],
    shows: [{ id: 20, title: "Dizi", image: "/d.jpg" }],
    people: [{ id: 30, title: "Aktör", image: "/a.jpg" }],
  };

  it("movie rail uses movies and actors, never shows", () => {
    const paths = recommendationSources(favs, "movie").map((s) => s.path);
    expect(paths).toEqual(["/movie/10/recommendations", "/movie/11/recommendations", "/person/30/combined_credits"]);
  });

  it("tv rail uses shows and actors, never movies", () => {
    const paths = recommendationSources(favs, "tv").map((s) => s.path);
    expect(paths).toEqual(["/tv/20/recommendations", "/person/30/combined_credits"]);
  });

  it("has no signal without a matching favourite", () => {
    expect(hasRecommendationSignal(emptyFavorites(), "movie")).toBe(false);
    expect(hasRecommendationSignal({ movies: [movie(1)], shows: [], people: [] }, "tv")).toBe(false);
    expect(hasRecommendationSignal({ movies: [], shows: [], people: [{ id: 1, title: "P" }] }, "tv")).toBe(true);
  });
});

describe("creditsToCandidates", () => {
  const credit = (id, extra = {}) => ({
    id,
    media_type: "movie",
    poster_path: `/p${id}.jpg`,
    vote_count: 1000,
    character: "Hero",
    genre_ids: [18],
    ...extra,
  });

  it("keeps scripted, well-known, matching-type credits, most voted first", () => {
    const out = creditsToCandidates(
      { cast: [credit(1, { vote_count: 300 }), credit(2, { vote_count: 5000 }), credit(3, { media_type: "tv" })] },
      "movie",
    );
    expect(out.map((c) => c.id)).toEqual([2, 1]);
  });

  it("drops self appearances, talk/news/doc genres, adult and obscure titles", () => {
    const out = creditsToCandidates(
      {
        cast: [
          credit(1, { character: "Himself" }),
          credit(2, { genre_ids: [10767] }),
          credit(3, { genre_ids: [99] }),
          credit(4, { adult: true }),
          credit(5, { vote_count: 12 }),
          credit(6, { poster_path: null }),
          credit(7),
        ],
      },
      "movie",
    );
    expect(out.map((c) => c.id)).toEqual([7]);
  });

  it("survives a missing or malformed response", () => {
    expect(creditsToCandidates(null, "movie")).toEqual([]);
    expect(creditsToCandidates({ cast: "x" }, "tv")).toEqual([]);
  });
});

describe("rankRecommendations", () => {
  const item = (id, extra = {}) => ({ id, poster_path: `/p${id}.jpg`, vote_count: 100, ...extra });
  const src = (title) => ({ key: title, title, kind: "similar" });

  it("puts a title recommended by two favourites ahead of single hits", () => {
    const out = rankRecommendations([
      { source: src("A"), items: [item(1), item(2), item(3)] },
      { source: src("B"), items: [item(4), item(3)] },
    ]);
    expect(out[0].id).toBe(3);
    expect(out[0].becauseOf.sort()).toEqual(["A", "B"]);
  });

  it("interleaves sources instead of letting the first one dominate", () => {
    const out = rankRecommendations([
      { source: src("A"), items: [item(1), item(2), item(3)] },
      { source: src("B"), items: [item(10), item(11), item(12)] },
    ]);
    expect(out.slice(0, 2).map((i) => i.id).sort((a, b) => a - b)).toEqual([1, 10]);
  });

  it("excludes the favourites themselves, posterless and adult items", () => {
    const out = rankRecommendations(
      [{ source: src("A"), items: [item(1), item(2), item(3, { poster_path: null }), item(4, { adult: true })] }],
      { exclude: [1] },
    );
    expect(out.map((i) => i.id)).toEqual([2]);
  });

  it("treats string and number ids as the same title when excluding", () => {
    const out = rankRecommendations([{ source: src("A"), items: [item(7)] }], { exclude: ["7"] });
    expect(out).toEqual([]);
  });

  it("respects the limit and tolerates empty input", () => {
    const items = Array.from({ length: 10 }, (_, i) => item(i + 1));
    expect(rankRecommendations([{ source: src("A"), items }], { limit: 3 })).toHaveLength(3);
    expect(rankRecommendations(null)).toEqual([]);
    expect(rankRecommendations([{ source: null, items }])).toEqual([]);
  });
});

describe("describeSources", () => {
  it("lists up to the limit and summarises the rest", () => {
    const sources = ["A", "B", "C", "D"].map((title) => ({ title }));
    expect(describeSources(sources)).toBe("A, B +2");
    expect(describeSources(sources.slice(0, 2))).toBe("A, B");
    expect(describeSources([])).toBe("");
  });

  it("does not repeat a title shared by two sources", () => {
    expect(describeSources([{ title: "A" }, { title: "A" }])).toBe("A");
  });
});

describe("buildFavoritesPrompt", () => {
  it("is empty when there are no favourites (costs zero tokens)", () => {
    expect(buildFavoritesPrompt(emptyFavorites())).toBe("");
    expect(buildFavoritesPrompt(null)).toBe("");
  });

  it("lists only the categories that have entries and forbids repeating them", () => {
    const text = buildFavoritesPrompt({
      movies: [movie(1), movie(2)],
      shows: [],
      people: [{ id: 3, title: "Tom Hardy" }],
    });
    expect(text).toContain("Movies: Film 1, Film 2");
    expect(text).toContain("Actors: Tom Hardy");
    expect(text).not.toContain("TV shows");
    expect(text).toContain("do NOT recommend these exact titles");
  });
});
