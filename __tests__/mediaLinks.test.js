// __tests__/mediaLinks.test.js
//
// TMDB / IMDb bağlantısı tanıma (utils/mediaLinks.js) + IMDb → TMDB çözümleme (services/mediaLinkResolver.js).
const { looksLikeMediaLink, parseMediaLink } = require("../utils/mediaLinks");
const { MEDIA_LINK_COPY } = require("../utils/mediaLinkCopy");

const mockReadTmdb = jest.fn();
jest.mock("../services/favoriteRecommendations", () => ({ readTmdb: (...args) => mockReadTmdb(...args) }));
const { resolveMediaLink } = require("../services/mediaLinkResolver");

beforeEach(() => mockReadTmdb.mockReset());

describe("parseMediaLink", () => {
  it("TMDB film ve dizi bağlantıları (slug ve yerel önekle)", () => {
    expect(parseMediaLink("https://www.themoviedb.org/movie/603-the-matrix")).toEqual({ source: "tmdb", type: "movie", id: 603 });
    expect(parseMediaLink("https://www.themoviedb.org/tv/1399-game-of-thrones")).toEqual({ source: "tmdb", type: "tv", id: 1399 });
    expect(parseMediaLink("https://www.themoviedb.org/tr-TR/movie/27205")).toEqual({ source: "tmdb", type: "movie", id: 27205 });
    expect(parseMediaLink("https://www.themoviedb.org/en/tv/1399?language=tr")).toEqual({ source: "tmdb", type: "tv", id: 1399 });
    expect(parseMediaLink("themoviedb.org/MOVIE/603")).toEqual({ source: "tmdb", type: "movie", id: 603 });
  });

  it("IMDb bağlantıları (mobil, yerel önek, izleme parametreleri)", () => {
    expect(parseMediaLink("https://www.imdb.com/title/tt0133093/?ref_=nv_sr_1")).toEqual({ source: "imdb", imdbId: "tt0133093" });
    expect(parseMediaLink("https://m.imdb.com/title/tt0944947/")).toEqual({ source: "imdb", imdbId: "tt0944947" });
    expect(parseMediaLink("https://www.imdb.com/tr/title/tt1375666")).toEqual({ source: "imdb", imdbId: "tt1375666" });
    expect(parseMediaLink("HTTPS://IMDB.COM/TITLE/TT0133093")).toEqual({ source: "imdb", imdbId: "tt0133093" });
  });

  it("metnin içindeki bağlantıyı yakalar", () => {
    expect(parseMediaLink("Şuna bak! https://www.imdb.com/title/tt0133093/ harika")).toEqual({ source: "imdb", imdbId: "tt0133093" });
  });

  it("ikisi de varsa metinde önce geçen kazanır", () => {
    const tmdbFirst = "https://www.themoviedb.org/movie/603 ve https://www.imdb.com/title/tt0133093/";
    const imdbFirst = "https://www.imdb.com/title/tt0133093/ ve https://www.themoviedb.org/movie/603";
    expect(parseMediaLink(tmdbFirst).source).toBe("tmdb");
    expect(parseMediaLink(imdbFirst).source).toBe("imdb");
  });

  it("tanınmayan bağlantılar ve normal aramalar null", () => {
    for (const text of [
      "matrix",
      "https://letterboxd.com/film/the-matrix/",
      "https://www.netflix.com/title/80057281",
      "https://www.imdb.com/name/nm0000206/", // kişi sayfası
      "https://www.themoviedb.org/person/6384",
      "https://www.themoviedb.org/movie/abc",
      "https://www.imdb.com/title/tt12/", // kimlik çok kısa
      "",
      null,
      undefined,
      42,
    ]) {
      expect(parseMediaLink(text)).toBeNull();
    }
  });

  it("çok uzun metni reddeder (gürültü / kötüye kullanım)", () => {
    expect(parseMediaLink(`https://www.imdb.com/title/tt0133093/ ${"x".repeat(700)}`)).toBeNull();
  });

  it("looksLikeMediaLink yalnız gerçek bağlantıda true", () => {
    expect(looksLikeMediaLink("https://www.imdb.com/title/tt0133093/")).toBe(true);
    expect(looksLikeMediaLink("imdb hakkında konuşalım")).toBe(false);
    expect(looksLikeMediaLink("themoviedb.org/person/1")).toBe(false);
    expect(looksLikeMediaLink(null)).toBe(false);
  });
});

describe("resolveMediaLink", () => {
  it("TMDB bağlantısı ağsız çözülür", async () => {
    expect(await resolveMediaLink({ source: "tmdb", type: "tv", id: 1399 }, {})).toEqual({ type: "tv", id: 1399 });
    expect(mockReadTmdb).not.toHaveBeenCalled();
  });

  it("IMDb: film sonucu önce, sonra dizi, sonra bölümün dizisi", async () => {
    const link = { source: "imdb", imdbId: "tt0133093" };
    mockReadTmdb.mockResolvedValueOnce({ movie_results: [{ id: 603 }], tv_results: [{ id: 9 }] });
    expect(await resolveMediaLink(link, { apiKey: "k", language: "tr" })).toEqual({ type: "movie", id: 603 });
    expect(mockReadTmdb).toHaveBeenCalledWith(
      "/find/tt0133093",
      expect.objectContaining({ apiKey: "k", language: "tr", query: "external_source=imdb_id" }),
    );

    mockReadTmdb.mockResolvedValueOnce({ movie_results: [], tv_results: [{ id: 1399 }] });
    expect(await resolveMediaLink(link, { apiKey: "k" })).toEqual({ type: "tv", id: 1399 });

    mockReadTmdb.mockResolvedValueOnce({ movie_results: [], tv_results: [], tv_episode_results: [{ show_id: 1399 }] });
    expect(await resolveMediaLink(link, { apiKey: "k" })).toEqual({ type: "tv", id: 1399 });
  });

  it("sonuç yok, ağ hatası ya da anahtar yoksa null (fırlatmaz)", async () => {
    const link = { source: "imdb", imdbId: "tt0133093" };
    mockReadTmdb.mockResolvedValueOnce({ movie_results: [], tv_results: [], tv_episode_results: [] });
    expect(await resolveMediaLink(link, { apiKey: "k" })).toBeNull();
    mockReadTmdb.mockRejectedValueOnce(new Error("ağ"));
    expect(await resolveMediaLink(link, { apiKey: "k" })).toBeNull();
    expect(await resolveMediaLink(link, { apiKey: "" })).toBeNull();
    expect(await resolveMediaLink(null, { apiKey: "k" })).toBeNull();
    expect(await resolveMediaLink({ source: "x" }, { apiKey: "k" })).toBeNull();
  });
});

describe("metin tablosu", () => {
  it("üç dilde aynı anahtarlar dolu", () => {
    const keys = Object.keys(MEDIA_LINK_COPY.tr).sort();
    for (const lang of ["en", "es"]) {
      expect(Object.keys(MEDIA_LINK_COPY[lang]).sort()).toEqual(keys);
      keys.forEach((key) => expect(MEDIA_LINK_COPY[lang][key].trim().length).toBeGreaterThan(0));
    }
  });
});
