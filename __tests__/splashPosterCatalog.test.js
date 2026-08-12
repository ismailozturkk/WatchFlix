import { SPLASH_POSTER_CATALOG } from "../data/splashPosterCatalog";

describe("local splash poster catalog", () => {
  test("ships an equally sized movie and TV pool", () => {
    const movies = SPLASH_POSTER_CATALOG.filter((item) => item.mediaType === "movie");
    const shows = SPLASH_POSTER_CATALOG.filter((item) => item.mediaType === "tv");
    expect(movies).toHaveLength(12);
    expect(shows).toHaveLength(12);
  });

  test("contains unique ids, local sources and vote-count ordering per type", () => {
    const keys = SPLASH_POSTER_CATALOG.map((item) => `${item.mediaType}:${item.id}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(SPLASH_POSTER_CATALOG.every((item) => item.source)).toBe(true);

    for (const type of ["movie", "tv"]) {
      const counts = SPLASH_POSTER_CATALOG
        .filter((item) => item.mediaType === type)
        .map((item) => item.voteCount);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
    }
  });
});
