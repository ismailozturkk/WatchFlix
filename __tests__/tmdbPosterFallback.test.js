// Liste yanıtlarında afiş/arka plan dil önceliği: seçili dil → İngilizce → TMDB varsayılanı.
jest.mock("../utils/cacheStore", () => ({
  getJSON: jest.fn(() => null),
  setJSON: jest.fn(() => true),
}));

import axios from "axios";
import { needsImageLookup, resolveTmdbItemImages } from "../utils/tmdbPosterFallback";
import { installTmdbTitleFallback } from "../utils/tmdbTitleFallback";

const img = (file_path, iso_639_1, vote_average = 5) => ({ file_path, iso_639_1, vote_average });
const imagesResponse = (posters, backdrops = []) => ({ ok: true, json: async () => ({ posters, backdrops }) });

let nextId = 1000;
const korean = (extra = {}) => ({
  id: nextId++, name: "오징어 게임", original_name: "오징어 게임", original_language: "ko",
  poster_path: "/ko.jpg", backdrop_path: "/ko-b.jpg", ...extra,
});

describe("needsImageLookup", () => {
  test("yalnız özgün dili ne uygulama dili ne İngilizce olan yapımlar sorulur", () => {
    expect(needsImageLookup(korean(), "tv", "tr")).toBe(true);
    expect(needsImageLookup(korean({ original_language: "en" }), "tv", "tr")).toBe(false);
    expect(needsImageLookup(korean({ original_language: "tr" }), "tv", "tr")).toBe(false);
    expect(needsImageLookup(korean(), "tv", "en")).toBe(false);
  });

  test("sezon/kişi gibi özgün dili olmayan ya da görseli olmayan kayıtlar sorulmaz", () => {
    expect(needsImageLookup({ id: 1, name: "Season 1", poster_path: "/s.jpg" }, "tv", "tr")).toBe(false);
    expect(needsImageLookup(korean({ poster_path: null, backdrop_path: null }), "tv", "tr")).toBe(false);
    expect(needsImageLookup(korean(), null, "tr")).toBe(false);
  });
});

describe("resolveTmdbItemImages", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test("seçili dilde görsel yoksa İngilizcenin en beğenileni", async () => {
    global.fetch.mockResolvedValue(imagesResponse(
      [img("/en-low.jpg", "en", 3), img("/en-high.jpg", "en", 8)],
      [img("/en-b.jpg", "en")],
    ));
    const out = await resolveTmdbItemImages(korean(), { mediaType: "tv", language: "tr", authorization: "Bearer t" });
    expect(out.poster_path).toBe("/en-high.jpg");
    expect(out.backdrop_path).toBe("/en-b.jpg");
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/tv\/\d+\/images\?include_image_language=tr,en$/);
    expect(init.headers.Authorization).toBe("Bearer t");
  });

  test("seçili dil İngilizceden önce gelir", async () => {
    global.fetch.mockResolvedValue(imagesResponse([img("/en.jpg", "en", 9), img("/tr.jpg", "tr", 1)]));
    const out = await resolveTmdbItemImages(korean(), { mediaType: "tv", language: "tr" });
    expect(out.poster_path).toBe("/tr.jpg");
    expect(out.backdrop_path).toBe("/ko-b.jpg");
  });

  test("hiçbiri yoksa TMDB varsayılanı kalır; sonuç önbelleğe alınır", async () => {
    global.fetch.mockResolvedValue(imagesResponse([]));
    const item = korean();
    expect(await resolveTmdbItemImages(item, { mediaType: "tv", language: "tr" })).toBe(item);
    expect(await resolveTmdbItemImages(item, { mediaType: "tv", language: "tr" })).toBe(item);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("ağ hatasında kayıt değişmez", async () => {
    global.fetch.mockRejectedValue(new Error("offline"));
    const item = korean();
    expect(await resolveTmdbItemImages(item, { mediaType: "tv", language: "tr" })).toBe(item);
  });

  test("yanıttaki images eki varsa ağa çıkmadan seçer", async () => {
    const item = korean({ images: { posters: [img("/en.jpg", "en")], backdrops: [] } });
    const out = await resolveTmdbItemImages(item, { mediaType: "tv", language: "tr" });
    expect(out.poster_path).toBe("/en.jpg");
    expect(out.backdrop_path).toBe("/ko-b.jpg");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("ortak axios katmanı", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test("liste afişlerini sırayı ve sayıyı koruyarak çözer; /images yanıtına dokunmaz", async () => {
    global.fetch.mockImplementation(async (url) =>
      /\/images/.test(url)
        ? imagesResponse([img("/en.jpg", "en")])
        : { ok: true, json: async () => ({ translations: [] }) },
    );
    installTmdbTitleFallback();
    const handlers = axios.interceptors.response.handlers.filter(Boolean);
    const handler = handlers[handlers.length - 1].fulfilled;
    const first = korean();
    const english = { id: 2, name: "Dark", original_name: "Dark", original_language: "en", poster_path: "/dark.jpg" };

    const resolved = await handler({
      config: { url: "https://api.themoviedb.org/3/discover/tv", params: { language: "tr-TR" }, headers: {} },
      data: { page: 1, results: [first, english] },
    });
    expect(resolved.data.results.map((item) => item.id)).toEqual([first.id, 2]);
    expect(resolved.data.results[0].poster_path).toBe("/en.jpg");
    expect(resolved.data.results[0].name).toBe("오징어 게임");
    expect(resolved.data.results[1].poster_path).toBe("/dark.jpg");

    const raw = { posters: [img("/ko.jpg", "ko")] };
    const images = await handler({
      config: { url: `https://api.themoviedb.org/3/tv/${first.id}/images`, headers: {} },
      data: raw,
    });
    expect(images.data).toBe(raw);
  });
});
