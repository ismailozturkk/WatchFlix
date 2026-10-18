// __tests__/externalRatings.test.js
//
// Harici puanlar: saf biçim yardımcıları (utils/externalRatings.js) + callable istemcisi
// (services/externalRatings.js; firebase taklit edilir).
const { formatImdbVotes, mergeEpisodeRatings, pickMainRating } = require("../utils/externalRatings");

const mockCall = jest.fn();
jest.mock("../firebase", () => ({ fns: { name: "fns" } }), { virtual: true });
jest.mock("firebase/functions", () => ({
  httpsCallable: (fns, name) => (payload) => mockCall(name, payload),
}));
const { fetchSeasonRatings, fetchTitleRatings, __resetExternalRatingsCache } = require("../services/externalRatings");

beforeEach(() => {
  mockCall.mockReset();
  __resetExternalRatingsCache();
});

describe("formatImdbVotes", () => {
  it("binlik ayraçlı metin; geçersizde null", () => {
    expect(formatImdbVotes(2345678)).toBe("2,345,678");
    expect(formatImdbVotes(999)).toBe("999");
    expect(formatImdbVotes(1000)).toBe("1,000");
    expect(formatImdbVotes(0)).toBeNull();
    expect(formatImdbVotes(null)).toBeNull();
    expect(formatImdbVotes("x")).toBeNull();
  });
});

describe("pickMainRating", () => {
  const tmdb = { vote_average: 7.4, vote_count: 120 };
  it("IMDb varsa onu kullanır", () => {
    expect(pickMainRating({ found: true, imdbRating: 9.2, imdbVotes: 1500 }, tmdb)).toEqual({ rating: 9.2, votes: "1,500", source: "imdb" });
  });
  it("IMDb oyu yoksa TMDB oy sayısı", () => {
    expect(pickMainRating({ found: true, imdbRating: 9.2, imdbVotes: null }, tmdb)).toEqual({ rating: 9.2, votes: 120, source: "imdb" });
  });
  it("sunucu cevap vermediyse / bulunamadıysa / puan N/A ise TMDB'ye düşer", () => {
    for (const ratings of [null, undefined, { found: false, reason: "quota" }, { found: true, imdbRating: null }]) {
      expect(pickMainRating(ratings, tmdb)).toEqual({ rating: 7.4, votes: 120, source: "tmdb" });
    }
  });
  it("TMDB de yoksa sıfır", () => {
    expect(pickMainRating(null, {})).toEqual({ rating: 0, votes: 0, source: "tmdb" });
    expect(pickMainRating(null, undefined)).toEqual({ rating: 0, votes: 0, source: "tmdb" });
  });
});

describe("mergeEpisodeRatings", () => {
  const tmdb = [
    { episode_number: 1, vote_average: 7, name: "A" },
    { episode_number: 2, vote_average: 6.5, name: "B" },
    { episode_number: 3, vote_average: 8, name: "C" },
  ];
  it("bölüm numarasıyla IMDb puanını işler; yoksa TMDB kalır; diğer alanlar korunur", () => {
    const out = mergeEpisodeRatings(tmdb, [
      { episode: 1, imdbRating: 9.1 },
      { episode: 2, imdbRating: null },
    ]);
    expect(out.map((e) => e.vote_average)).toEqual([9.1, 6.5, 8]);
    expect(out[0].name).toBe("A");
  });
  it("girdiyi değiştirmez; bozuk girdide çökmez", () => {
    mergeEpisodeRatings(tmdb, [{ episode: 1, imdbRating: 1 }]);
    expect(tmdb[0].vote_average).toBe(7);
    expect(mergeEpisodeRatings(tmdb, null)).toEqual(tmdb);
    expect(mergeEpisodeRatings(null, null)).toEqual([]);
  });
});

describe("istemci (callable)", () => {
  it("başlık puanını ister ve oturum içinde önbellekler", async () => {
    mockCall.mockResolvedValue({ data: { found: true, imdbRating: 8.1 } });
    expect(await fetchTitleRatings("tt0944947")).toEqual({ found: true, imdbRating: 8.1 });
    await fetchTitleRatings("tt0944947");
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall).toHaveBeenCalledWith("getExternalRatings", { imdbId: "tt0944947" });
  });

  it("sezon puanı sezon başına ayrı önbelleklenir", async () => {
    mockCall.mockImplementation(async (_n, p) => ({ data: { found: true, episodes: [{ episode: 1, imdbRating: p.season }] } }));
    expect((await fetchSeasonRatings("tt1", 1)).episodes[0].imdbRating).toBe(1);
    expect((await fetchSeasonRatings("tt1", 2)).episodes[0].imdbRating).toBe(2);
    await fetchSeasonRatings("tt1", 1);
    expect(mockCall).toHaveBeenCalledTimes(2);
    expect(mockCall).toHaveBeenCalledWith("getExternalRatings", { imdbId: "tt1", season: 2 });
  });

  it("hata fırlatmaz (null) ve geçici sonuç önbelleğe girmez", async () => {
    mockCall.mockRejectedValueOnce(new Error("ağ"));
    expect(await fetchTitleRatings("tt0944947")).toBeNull();
    mockCall.mockResolvedValueOnce({ data: { found: false, reason: "quota" } });
    expect(await fetchTitleRatings("tt0944947")).toEqual({ found: false, reason: "quota" });
    mockCall.mockResolvedValueOnce({ data: { found: true, imdbRating: 7 } });
    expect(await fetchTitleRatings("tt0944947")).toEqual({ found: true, imdbRating: 7 }); // tekrar soruldu
    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it("'bulunamadı' kesin sonuç olduğundan önbelleğe girer", async () => {
    mockCall.mockResolvedValue({ data: { found: false, reason: "not-found" } });
    await fetchTitleRatings("tt0000001");
    await fetchTitleRatings("tt0000001");
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it("kimlik yoksa ağa çıkmaz", async () => {
    expect(await fetchTitleRatings(null)).toBeNull();
    expect(await fetchSeasonRatings("tt1", 0)).toBeNull();
    expect(mockCall).not.toHaveBeenCalled();
  });
});
