jest.mock("../utils/cacheStore", () => ({
  getJSON: jest.fn(() => null),
  setJSON: jest.fn(() => true),
}));

import {
  applyPreferredTmdbTitle,
  containsJapaneseOrChineseScript,
  installTmdbTitleFallback,
  preferredTmdbTitle,
  resolveTmdbItems,
} from "../utils/tmdbTitleFallback";
import axios from "axios";

const movieTranslations = [
  {
    iso_639_1: "en",
    iso_3166_1: "US",
    data: { title: "Spirited Away" },
  },
  {
    iso_639_1: "tr",
    iso_3166_1: "TR",
    data: { title: "Ruhların Kaçışı" },
  },
];

describe("TMDB title fallback", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test("uygulama dilini Ingilizceden once secer", () => {
    const item = {
      id: 129,
      title: "千と千尋の神隠し",
      original_title: "千と千尋の神隠し",
      translations: { translations: movieTranslations },
    };

    expect(preferredTmdbTitle(item, "movie", "tr")).toBe("Ruhların Kaçışı");
    expect(applyPreferredTmdbTitle(item, "movie", "tr").title).toBe(
      "Ruhların Kaçışı",
    );
  });

  test("uygulama dili yoksa Ingilizceyi secer", () => {
    const item = {
      id: 129,
      title: "千と千尋の神隠し",
      original_title: "千と千尋の神隠し",
      translations: {
        translations: movieTranslations.filter((row) => row.iso_639_1 === "en"),
      },
    };

    expect(preferredTmdbTitle(item, "movie", "tr")).toBe("Spirited Away");
  });

  test("hic ceviri yoksa ozgun basligi korur", () => {
    const item = {
      id: 999,
      title: "未知作品",
      original_title: "未知作品",
      translations: { translations: [] },
    };

    expect(preferredTmdbTitle(item, "movie", "tr")).toBe("未知作品");
    expect(containsJapaneseOrChineseScript(item.title)).toBe(true);
  });

  test("liste sirasini ve tum sonuclari koruyarak yalniz basligi cozer", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        translations: [
          {
            iso_639_1: "en",
            iso_3166_1: "US",
            data: { name: "The Long Season" },
          },
        ],
      }),
    });
    const items = [
      {
        id: 1,
        name: "漫长的季节",
        original_name: "漫长的季节",
        original_language: "zh",
      },
      {
        id: 2,
        name: "Dark",
        original_name: "Dark",
        original_language: "en",
      },
    ];

    const resolved = await resolveTmdbItems(items, {
      mediaType: "tv",
      language: "tr",
      authorization: "Bearer test",
    });

    expect(resolved).toHaveLength(2);
    expect(resolved.map((item) => item.id)).toEqual([1, 2]);
    expect(resolved[0].name).toBe("The Long Season");
    expect(resolved[1].name).toBe("Dark");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("ortak axios katmani TMDB arama sonucunu filtrelemeden uygular", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        translations: [
          {
            iso_639_1: "en",
            iso_3166_1: "US",
            data: { title: "Hero" },
          },
        ],
      }),
    });
    installTmdbTitleFallback();
    const handlers = axios.interceptors.response.handlers.filter(Boolean);
    const responseHandler = handlers[handlers.length - 1].fulfilled;
    const response = {
      config: {
        url: "https://api.themoviedb.org/3/search/movie",
        params: { language: "tr-TR" },
        headers: { Authorization: "Bearer test" },
      },
      data: {
        page: 1,
        results: [
          {
            id: 300,
            title: "英雄",
            original_title: "英雄",
            original_language: "zh",
          },
          {
            id: 301,
            title: "Arrival",
            original_title: "Arrival",
            original_language: "en",
          },
        ],
      },
    };

    const resolved = await responseHandler(response);
    expect(resolved.data.results).toHaveLength(2);
    expect(resolved.data.results.map((item) => item.id)).toEqual([300, 301]);
    expect(resolved.data.results[0].title).toBe("Hero");
    expect(resolved.data.results[1].title).toBe("Arrival");
  });
});
