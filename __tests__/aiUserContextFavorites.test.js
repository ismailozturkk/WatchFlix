const { buildLibraryContext } = require("../services/aiUserContext");
const { buildFavoritesPrompt } = require("../utils/fourFavorites");

const ALL_OFF = { watchList: false, favorites: false, custom: false, watched: false };

describe("buildLibraryContext + dört favori", () => {
  const favoritesBlock = buildFavoritesPrompt({
    movies: [{ id: 1, title: "Heat" }],
    shows: [],
    people: [{ id: 2, title: "Tom Hardy" }],
  });

  it("puts the favourites block into the summary, ahead of the user's lists", () => {
    const { librarySummary, hasAny } = buildLibraryContext(
      { watchList: [{ id: 5, name: "Dune", type: "movie", genres: ["Sci-Fi"] }] },
      { ...ALL_OFF, watchList: true },
      { favoritesBlock },
    );
    expect(hasAny).toBe(true);
    expect(librarySummary).toContain("USER'S FOUR FAVORITES");
    expect(librarySummary).toContain("Movies: Heat");
    expect(librarySummary.indexOf("FOUR FAVORITES")).toBeLessThan(librarySummary.indexOf("WATCHLIST"));
  });

  it("works with every list toggle off (favourites alone are enough context)", () => {
    const { librarySummary, hasAny } = buildLibraryContext({}, ALL_OFF, { favoritesBlock });
    expect(hasAny).toBe(true);
    expect(librarySummary).toContain("Actors: Tom Hardy");
  });

  it("adds nothing when the user has no favourites (zero tokens)", () => {
    const { librarySummary, hasAny } = buildLibraryContext({}, ALL_OFF, {
      favoritesBlock: buildFavoritesPrompt(null),
    });
    expect(hasAny).toBe(false);
    expect(librarySummary).toBe("");
  });

  it("ignores a non-string block", () => {
    const { hasAny } = buildLibraryContext({}, ALL_OFF, { favoritesBlock: { oops: true } });
    expect(hasAny).toBe(false);
  });
});
