// __tests__/tvUpcomingProvider.test.js
//
// Dizi ana ekranının çipli raflarının bağlam bağlantısı: GERÇEK TvShowProvider çalışır, yalnız ağ (axios)
// ve ayar bağlamları taklit edilir.
//   • "Yaklaşan Diziler": aralık çipi değişince istek yeni pencereyle yeniden atılır, sonraki sayfa aynı
//     pencereyle istenir.
//   • Çip seçimleri (`selectedUpcomingRange`, `selectedAiringRange`) bağlam DEĞERİNE yansır.
//     NOT: değer `useMemo` ile kurulu ama bugün her render'da yeniden hesaplanıyor (bağımlılıktaki
//     `refreshAllTvShows` her render'da yenileniyor); bu yüzden bağımlılık listesinden düşen bir seçimi
//     bu test YAKALAMAZ (29 Eki'de denendi). Seçimler listede yine de açıkça duruyor.

import React from "react";
import { act, create } from "react-test-renderer";
import { clearCachedByPrefix } from "../utils/apiCache";
import { buildTvUpcomingParams } from "../utils/tvUpcoming";

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

jest.mock("../services/emmyService", () => ({
  getEmmyConfig: jest.fn(async () => ({ items: [] })),
  fetchEmmyByCategory: jest.fn(async () => ({ items: [], hasMore: false, nextPage: 0 })),
  fetchEmmyByYear: jest.fn(async () => []),
  EMMY_CATEGORIES: [],
  DEFAULT_EMMY_CATEGORY: "drama",
}));

// Her istek kendi kimliklerini döndürür: hangi isteğin ekrana yazıldığı görülsün.
const mockRespond = (url) => {
  mockCalls.push(String(url));
  const base = mockCalls.length * 10;
  return Promise.resolve({
    data: {
      results: [
        { id: base + 1, poster_path: "/a.jpg", adult: false },
        { id: base + 2, poster_path: "/b.jpg", adult: false },
      ],
      total_pages: 3,
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

const { TvShowProvider, useTvShow } = require("../context/TvShowContex");

const VAKIT = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const upcomingCalls = () => mockCalls.filter((u) => u.includes("/discover/tv") && u.includes("first_air_date.gte"));
const ids = (list) => (list || []).map((item) => item.id);
const lteOf = (range) => buildTvUpcomingParams({ range, language: "tr-TR" })["first_air_date.lte"];

let latest;
function Consumer() {
  const ctx = useTvShow();
  latest = ctx;
  const { activateTvSection } = ctx;
  React.useEffect(() => {
    activateTvSection("upcoming");
  }, [activateTvSection]);
  return null;
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
  mockCalls.length = 0;
  await act(async () => {
    root = create(
      <TvShowProvider>
        <Consumer />
      </TvShowProvider>,
    );
  });
  await VAKIT();
  await VAKIT();
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  warn.mockRestore();
});

test("varsayılan 3 ay: yeni diziler popülerliğe göre, sonuçlar bağlamda", () => {
  const calls = upcomingCalls();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain(`first_air_date.lte=${lteOf("3m")}`);
  expect(calls[0]).toContain("sort_by=popularity.desc");
  expect(calls[0]).not.toContain("include_adult");
  expect(latest.selectedUpcomingRange).toBe("3m");
  expect(latest.seriesUpcoming).toHaveLength(2);
  expect(latest.loadingUpcoming).toBe(false);
});

test("aralık çipi değişince seçim değere yansır ve istek yeni pencereyle atılır", async () => {
  const before = upcomingCalls().length;
  const oldIds = ids(latest.seriesUpcoming);
  await act(async () => { latest.setSelectedUpcomingRange("7d"); });
  await VAKIT();
  await VAKIT();

  expect(latest.selectedUpcomingRange).toBe("7d");
  const fresh = upcomingCalls().slice(before);
  expect(fresh).toHaveLength(1);
  expect(fresh[0]).toContain(`first_air_date.lte=${lteOf("7d")}`);
  expect(ids(latest.seriesUpcoming)).not.toEqual(oldIds);
  expect(latest.pageUpcoming).toBe(1);
});

test("Tümü: üst sınır yok", async () => {
  await act(async () => { latest.setSelectedUpcomingRange("all"); });
  await VAKIT();
  const last = upcomingCalls().at(-1);
  expect(last).toContain("first_air_date.gte=");
  expect(last).not.toContain("first_air_date.lte");
});

test("sonraki sayfa aynı pencereyle istenir ve listeye eklenir", async () => {
  await act(async () => { latest.setSelectedUpcomingRange("1m"); });
  await VAKIT();
  const before = upcomingCalls().length;
  await act(async () => { latest.loadMoreUpcoming(); });
  await VAKIT();
  const next = upcomingCalls().slice(before);
  expect(next).toHaveLength(1);
  expect(next[0]).toContain("page=2");
  expect(next[0]).toContain(`first_air_date.lte=${lteOf("1m")}`);
  expect(latest.seriesUpcoming).toHaveLength(4);
});

test("Yayında rafının çipi (Bugün / Bu hafta) değere yansır", async () => {
  expect(latest.selectedAiringRange).toBe("today");
  await act(async () => { latest.setSelectedAiringRange("week"); });
  expect(latest.selectedAiringRange).toBe("week");
});
