jest.mock("../utils/cacheStore", () => ({
  getJSON: jest.fn(() => null),
  setJSON: jest.fn(),
}));

jest.mock("../utils/dataCacheSettings", () => ({
  shouldPersistInternetData: jest.fn(() => false),
}));

import { lookupTitle } from "../services/tmdbLookup";

describe("TMDB detail hydration", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("uses the real TMDB id and enriches a spotlight card", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 329865,
              title: "Arrival",
              release_date: "2016-11-10",
              poster_path: "/poster.jpg",
              vote_average: 7.6,
              vote_count: 18000,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 329865,
          title: "Arrival",
          overview:
            "A linguist works with the military after alien craft appear.",
          runtime: 116,
          genres: [{ name: "Science Fiction" }, { name: "Drama" }],
          credits: {
            crew: [{ job: "Director", name: "Denis Villeneuve" }],
            cast: [{ name: "Amy Adams" }, { name: "Jeremy Renner" }],
          },
          "watch/providers": {
            results: { TR: { flatrate: [{ provider_name: "Example+" }] } },
          },
          recommendations: {
            results: [
              {
                id: 686,
                title: "Contact",
                release_date: "1997-07-11",
                vote_average: 7.4,
              },
            ],
          },
        }),
      });

    const card = await lookupTitle({
      apiKey: "Bearer token",
      title: "Arrival",
      mediaType: "movie",
      language: "tr",
      includeDetails: true,
    });

    expect(card).toMatchObject({
      id: 329865,
      found: true,
      runtimeMinutes: 116,
      director: "Denis Villeneuve",
      cast: ["Amy Adams", "Jeremy Renner"],
      providers: ["Example+"],
    });
    expect(card.similar[0]).toMatchObject({ id: 686, title: "Contact" });
    expect(global.fetch.mock.calls[1][0]).toContain("movie/329865");
  });
});

describe("pickBestMatch (T3 B9)", () => {
  const { pickBestMatch, splitTitleYear } = require("../services/tmdbLookup");
  const obscure = { id: 1, title: "Knives Out", original_title: "Knives Out", release_date: "2016-05-01", vote_count: 12 };
  const real = {
    id: 546554,
    title: "Knives Out – Mord ist Familiensache",
    original_title: "Knives Out",
    release_date: "2019-11-27",
    vote_count: 15000,
  };

  test("yerel ad farklıyken özgün adla eşleşir, oy sayısı yüksek olan kazanır", () => {
    expect(pickBestMatch([obscure, real], "Knives Out").id).toBe(546554);
  });

  test("AI yıl verdiyse o yılın yapımı önce gelir", () => {
    expect(pickBestMatch([real, obscure], "knives out", "2016").id).toBe(1);
    expect(splitTitleYear("Knives Out (2019)")).toEqual({ title: "Knives Out", year: "2019" });
    expect(splitTitleYear("Se7en")).toEqual({ title: "Se7en", year: "" });
  });

  test("tam eşleşme yoksa en çok oy alan; boşta null", () => {
    expect(pickBestMatch([obscure, real], "Rian Johnson").id).toBe(546554);
    expect(pickBestMatch([], "x")).toBeNull();
  });
});
