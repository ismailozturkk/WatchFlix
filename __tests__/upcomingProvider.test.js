// __tests__/upcomingProvider.test.js
//
// "Yaklaşan Filmler" süzgecinin bağlam bağlantısı: GERÇEK MovieProvider çalışır, yalnız ağ (axios) ve
// ayar bağlamları taklit edilir. Süzgeç depoya (Keys.upcomingFilters) yazılınca rafın isteği yeni
// parametrelerle yeniden atılmalı — "Tümü" ekranının AYRI MovieProvider örneği de aynı kayda bağlı.

import React from "react";
import { act, create } from "react-test-renderer";
import { clearCachedByPrefix } from "../utils/apiCache";
import { Keys, get, remove } from "../services/storage";
import { writeUpcomingFilters } from "../hooks/useUpcomingFilters";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockCalls = [];

jest.mock("../context/AppSettingsContext", () => ({
  useApiSettings: () => ({ API_KEY: "test-key" }),
  useStreamingProviderSettings: () => ({ streamingProviderIds: [] }),
  useContentSettings: () => ({ adultContent: false }),
  useImageQualitySettings: () => ({ imageQualityLevel: "good" }),
  useListLayoutSettings: () => ({ railPosterSize: "normal", railPosterRadius: 15, posterBadges: {} }),
}));

jest.mock("../context/LanguageContext", () => {
  const deep = new Proxy(() => "x", {
    get: (_hedef, anahtar) => (anahtar === Symbol.toPrimitive ? () => "x" : deep),
  });
  return { useLanguage: () => ({ language: "tr", t: deep }) };
});

jest.mock("../context/ListStatusContext", () => ({
  useListStatusContext: () => ({ watchedTvMap: {}, watchedTvLoaded: true }),
}));

jest.mock("../utils/i18nText", () => ({ i18nText: (_anahtar, varsayilan) => varsayilan }));

jest.mock("../services/oscarService", () => ({
  getOscarConfig: jest.fn(async () => ({ items: [] })),
  fetchOscarByCategory: jest.fn(async () => ({ items: [], hasMore: false, nextPage: 0 })),
  fetchOscarByYear: jest.fn(async () => []),
  OSCAR_CATEGORIES: [],
  DEFAULT_OSCAR_CATEGORY: "best_picture",
}));

// Bölgesel istek (with_release_type) farklı kimlikler döndürür: hangi isteğin ekrana yazıldığı görülsün.
const mockRespond = (url) => {
  const tam = String(url);
  mockCalls.push(tam);
  const regional = tam.includes("with_release_type");
  const base = regional ? 500 : 100;
  return Promise.resolve({
    data: {
      results: [
        { id: base + 1, poster_path: "/a.jpg", adult: false },
        { id: base + 2, poster_path: "/b.jpg", adult: false },
      ],
      total_pages: 2,
    },
  });
};

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    request: (config) => mockRespond(config.url),
    get: (url) => mockRespond(url),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

const { MovieProvider, useMovie } = require("../context/MovieContex");

const VAKIT = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const upcomingCalls = () => mockCalls.filter((u) => u.includes("/discover/movie") && u.includes("release_date"));
const ids = (list) => (list || []).map((item) => item.id);

const latest = {};
function Consumer({ name }) {
  const ctx = useMovie();
  latest[name] = ctx;
  const { activateMovieSection } = ctx;
  React.useEffect(() => {
    activateMovieSection("upcoming");
  }, [activateMovieSection]);
  return null;
}

// Raf + "Tümü" ekranı: iki AYRI MovieProvider örneği.
function App() {
  return (
    <>
      <MovieProvider>
        <Consumer name="rail" />
      </MovieProvider>
      <MovieProvider>
        <Consumer name="seeAll" />
      </MovieProvider>
    </>
  );
}

let root;
let warn;
beforeEach(async () => {
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
  clearCachedByPrefix("");
  remove(Keys.upcomingFilters);
  mockCalls.length = 0;
  await act(async () => { root = create(<App />); });
  await VAKIT();
  await VAKIT();
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  remove(Keys.upcomingFilters);
  warn.mockRestore();
});

test("varsayılan: dünya geneli + popülerlik isteği, sonuçlar rafta", () => {
  const calls = upcomingCalls();
  expect(calls.length).toBeGreaterThan(0);
  expect(calls[0]).toContain("primary_release_date.gte=");
  expect(calls[0]).toContain("sort_by=popularity.desc");
  expect(calls[0]).not.toContain("with_release_type");
  expect(calls[0]).not.toContain("include_adult");
  expect(ids(latest.rail.moviesUpcoming)).toEqual([101, 102]);
  expect(latest.rail.upcomingFilters.range).toBe("7d");
});

test("süzgeç depoya yazılınca İKİ örnek de yeni parametrelerle yeniden çeker", async () => {
  const before = upcomingCalls().length;
  await act(async () => {
    writeUpcomingFilters({ scope: "cinema", sort: "soonest", genres: [27], range: "3m" });
  });
  await VAKIT();
  await VAKIT();

  const fresh = upcomingCalls().slice(before);
  expect(fresh.length).toBeGreaterThan(0);
  fresh.forEach((url) => {
    expect(url).toContain("with_release_type=2%7C3");
    expect(url).toContain("sort_by=release_date.asc");
    expect(url).toContain("with_genres=27");
  });
  expect(ids(latest.rail.moviesUpcoming)).toEqual([501, 502]);
  expect(ids(latest.seeAll.moviesUpcoming)).toEqual([501, 502]);
  expect(latest.seeAll.upcomingFilters).toMatchObject({ scope: "cinema", sort: "soonest", range: "3m" });
  expect(latest.rail.pageUpcoming).toBe(1);
});

test("varsayılana dönünce anahtar silinir ve eski liste geri gelir", async () => {
  await act(async () => { writeUpcomingFilters({ scope: "digital" }); });
  await VAKIT();
  expect(get(Keys.upcomingFilters)).toMatchObject({ scope: "digital" });
  expect(ids(latest.rail.moviesUpcoming)).toEqual([501, 502]);

  await act(async () => { writeUpcomingFilters({}); });
  await VAKIT();
  expect(get(Keys.upcomingFilters)).toBeNull();
  expect(ids(latest.rail.moviesUpcoming)).toEqual([101, 102]);
});

test("sonraki sayfa aynı süzgeçle istenir", async () => {
  await act(async () => { writeUpcomingFilters({ scope: "cinema" }); });
  await VAKIT();
  const before = upcomingCalls().length;
  await act(async () => { latest.rail.loadMoreUpcoming(); });
  await VAKIT();
  const next = upcomingCalls().slice(before);
  expect(next).toHaveLength(1);
  expect(next[0]).toContain("page=2");
  expect(next[0]).toContain("with_release_type=2%7C3");
});
