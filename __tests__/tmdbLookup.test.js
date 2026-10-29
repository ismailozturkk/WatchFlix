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

describe("geçici TMDB hatası önbelleğe girmez", () => {
  const found = {
    ok: true,
    status: 200,
    json: async () => ({ results: [{ id: 27205, title: "Inception", release_date: "2010-07-15", vote_count: 30000 }] }),
  };
  const lookup = (title) => lookupTitle({ apiKey: "Bearer token", title, mediaType: "movie", language: "en" });

  test("503 / ağ hatası sonrası aynı başlık yeniden aranır", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValue(found);
    expect((await lookup("Inception")).found).toBe(false);
    expect((await lookup("Inception")).found).toBe(false);
    const card = await lookup("Inception");
    expect(card).toMatchObject({ found: true, id: 27205 });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test("kesin 'bulunamadı' (boş sonuç) önbelleğe girer", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [] }) });
    expect((await lookup("Yok Böyle Bir Film")).found).toBe(false);
    expect((await lookup("Yok Böyle Bir Film")).found).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("istek zaman aşımı sinyaliyle gider", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [] }) });
    await lookup("Sinyal Testi");
    expect(global.fetch.mock.calls[0][1].signal).toBeDefined();
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
