// __tests__/useFilteredDiscover.test.js
//
// "Ne izlesem?" sonuç akışı: ilk yükleme, sayfalama, eski cevabı atma, hata/yeniden dene, "izlediklerimi
// gizle" (sorguyu DEĞİŞTİRMEDEN süzme + otomatik doldurma + sınırlar) ve "Şaşırt beni".
// Ağ katmanı (fetchDiscoverPage) taklit; URL/parametre doğruluğu discoverFilters.test.js'te.

import React from "react";
import { act, create } from "react-test-renderer";

let mockProviders = [];
let mockStatusIndex = {};
jest.mock("../context/AppSettingsContext", () => ({
  useApiSettings: () => ({ API_KEY: "token" }),
  useStreamingProviderSettings: () => ({ streamingProviderIds: mockProviders }),
}));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/ListStatusContext", () => ({
  useListStatusContext: () => ({ statusIndex: mockStatusIndex }),
}));
jest.mock("../services/discoverQuery", () => ({ fetchDiscoverPage: jest.fn() }));
jest.mock("../utils/randomPick", () => ({ randomInt: jest.fn(() => 0) }));

const { fetchDiscoverPage } = require("../services/discoverQuery");
const { randomInt } = require("../utils/randomPick");
const { MAX_AUTOFILL_PAGES, MIN_VISIBLE_RESULTS } = require("../utils/discoverFilters");
const useFilteredDiscover = require("../hooks/useFilteredDiscover").default;
const { TOP_UP_LIMIT } = require("../hooks/useFilteredDiscover");

global.IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date(2026, 9, 17, 12);
let renderer;
let latest;
let warn;

function Probe({ mediaType = "movie", filters = {} }) {
  latest = useFilteredDiscover({ mediaType, filters, now: NOW });
  return null;
}
const mount = (props) => {
  act(() => {
    renderer = create(<Probe {...props} />);
  });
};
const update = (props) => act(() => renderer.update(<Probe {...props} />));
const flush = async (times = 6) => {
  for (let i = 0; i < times; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });
  }
};

/** Her sayfa 20 öğe: kimlikler sayfa*100+i. */
const makePage = (page, { total = 5, watchedIds = [] } = {}) => ({
  results: Array.from({ length: 20 }, (_, i) => ({ id: page * 100 + i, poster_path: `/p${page}_${i}`, vote_average: 7 })),
  totalPages: total,
  totalResults: total * 20,
  watchedIds,
});

beforeEach(() => {
  mockProviders = [];
  mockStatusIndex = {};
  fetchDiscoverPage.mockReset();
  randomInt.mockReset().mockReturnValue(0);
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  warn.mockRestore();
});

describe("ilk yükleme ve sayfalama", () => {
  test("yüklenirken 'loading', sonra sonuçlar; istek doğru argümanlarla gider", async () => {
    fetchDiscoverPage.mockResolvedValue(makePage(1));
    mount({ mediaType: "tv", filters: { genres: [35], minRating: 7 } });
    expect(latest.status).toBe("loading");
    expect(latest.items).toEqual([]);
    await flush();
    expect(latest.status).toBe("ready");
    expect(latest.items).toHaveLength(20);
    expect(fetchDiscoverPage).toHaveBeenCalledTimes(1);
    const args = fetchDiscoverPage.mock.calls[0][0];
    expect(args).toMatchObject({
      mediaType: "tv",
      page: 1,
      apiKey: "token",
      language: "tr-TR",
      region: "TR",
      now: NOW,
    });
    expect(args.filters).toMatchObject({ genres: [35], minRating: 7 });
  });

  test("loadMore sonraki sayfayı tekrarsız ekler; son sayfada hasMore düşer", async () => {
    fetchDiscoverPage.mockImplementation(async ({ page }) => makePage(page, { total: 2 }));
    mount({});
    await flush();
    expect(latest.hasMore).toBe(true);
    act(() => latest.loadMore());
    await flush();
    expect(latest.items).toHaveLength(40);
    expect(new Set(latest.items.map((i) => i.id)).size).toBe(40);
    expect(latest.hasMore).toBe(false);
    act(() => latest.loadMore()); // sayfa kalmadı
    await flush();
    expect(fetchDiscoverPage).toHaveBeenCalledTimes(2);
  });

  test("art arda iki loadMore TEK istek üretir (çift tetiklenme yok)", async () => {
    fetchDiscoverPage.mockImplementation(async ({ page }) => makePage(page, { total: 5 }));
    mount({});
    await flush();
    act(() => {
      latest.loadMore();
      latest.loadMore();
    });
    await flush();
    expect(fetchDiscoverPage.mock.calls.filter(([a]) => a.page === 2)).toHaveLength(1);
  });
});

describe("eski cevabı atma", () => {
  test("süzgeç değişince eski isteğin geç cevabı yeni listeyi EZMEZ", async () => {
    let resolveOld;
    fetchDiscoverPage.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    mount({ filters: { genres: [35] } });
    fetchDiscoverPage.mockResolvedValueOnce({ ...makePage(7), results: [{ id: 777, poster_path: "/new" }] });
    update({ filters: { genres: [18] } });
    await flush();
    expect(latest.items.map((i) => i.id)).toEqual([777]);
    await act(async () => {
      resolveOld({ ...makePage(1), results: [{ id: 111, poster_path: "/old" }] });
      await Promise.resolve();
    });
    await flush();
    expect(latest.items.map((i) => i.id)).toEqual([777]);
  });

  test("ekran kapanınca uçuştaki cevap state'e yazılmaz (hata/uyarı yok)", async () => {
    let resolve;
    fetchDiscoverPage.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    mount({});
    act(() => renderer.unmount());
    renderer = null;
    await act(async () => {
      resolve(makePage(1));
      await Promise.resolve();
    });
    expect(warn.mock.calls.filter(([m]) => !String(m).includes("deprecated"))).toEqual([]);
  });

  test("'hideWatched' sorguyu DEĞİŞTİRMEZ: açıp kapamak yeniden yüklemez", async () => {
    fetchDiscoverPage.mockResolvedValue(makePage(1));
    mount({ filters: { hideWatched: false } });
    await flush();
    const calls = fetchDiscoverPage.mock.calls.length;
    update({ filters: { hideWatched: true } });
    await flush();
    update({ filters: { hideWatched: false } });
    await flush();
    expect(fetchDiscoverPage).toHaveBeenCalledTimes(calls);
  });

  test("platform süzgeci AÇIKKEN platform değişimi yeniden yükler; kapalıyken yüklemez", async () => {
    fetchDiscoverPage.mockResolvedValue(makePage(1));
    mockProviders = [8];
    mount({ filters: { onMyPlatforms: true } });
    await flush();
    expect(fetchDiscoverPage.mock.calls[0][0].providerIds).toEqual([8]);
    const calls = fetchDiscoverPage.mock.calls.length;
    mockProviders = [8, 337];
    update({ filters: { onMyPlatforms: true } });
    await flush();
    expect(fetchDiscoverPage.mock.calls.length).toBeGreaterThan(calls);

    const before = fetchDiscoverPage.mock.calls.length;
    update({ filters: { onMyPlatforms: false } });
    await flush();
    const afterToggle = fetchDiscoverPage.mock.calls.length;
    mockProviders = [8, 337, 119];
    update({ filters: { onMyPlatforms: false } });
    await flush();
    expect(afterToggle).toBeGreaterThan(before); // kapatmak sorguyu değiştirir
    expect(fetchDiscoverPage.mock.calls.length).toBe(afterToggle); // ama kapalıyken platform yok sayılır
  });
});

describe("hata ve yeniden deneme", () => {
  test("ilk sayfa hatası 'error'; reload() başarılı olunca sonuçlar gelir", async () => {
    fetchDiscoverPage.mockRejectedValueOnce(new Error("ağ yok"));
    mount({});
    await flush();
    expect(latest.status).toBe("error");
    expect(latest.items).toEqual([]);
    fetchDiscoverPage.mockResolvedValue(makePage(1));
    act(() => latest.reload());
    await flush();
    expect(latest.status).toBe("ready");
    expect(latest.items).toHaveLength(20);
  });

  test("sonraki sayfa hatasında eldekiler KORUNUR ve tekrar denenebilir", async () => {
    fetchDiscoverPage.mockResolvedValueOnce(makePage(1, { total: 3 }));
    mount({});
    await flush();
    fetchDiscoverPage.mockRejectedValueOnce(new Error("kesildi"));
    act(() => latest.loadMore());
    await flush();
    expect(latest.status).toBe("ready");
    expect(latest.items).toHaveLength(20);
    expect(latest.loadingMore).toBe(false);
    fetchDiscoverPage.mockResolvedValueOnce(makePage(2, { total: 3 }));
    act(() => latest.loadMore());
    await flush();
    expect(latest.items).toHaveLength(40);
  });
});

describe("izlediklerimi gizle", () => {
  const watchedPage = (page) => {
    const index = { movie: {} };
    makePage(page).results.forEach((item) => { index.movie[item.id] = { isWatched: true }; });
    return index;
  };

  test("izlenenler anında süzülür; kapatınca geri gelir (istek yok)", async () => {
    fetchDiscoverPage.mockResolvedValue(makePage(1));
    mockStatusIndex = { movie: { 100: { isWatched: true }, 101: { isWatched: true } } };
    mount({ filters: { hideWatched: false } });
    await flush();
    expect(latest.items).toHaveLength(20);
    update({ filters: { hideWatched: true } });
    expect(latest.items).toHaveLength(18);
    expect(latest.items.map((i) => i.id)).not.toContain(100);
    update({ filters: { hideWatched: false } });
    expect(latest.items).toHaveLength(20);
  });

  test("sayfa tamamen izlenmişse hedef dolana dek sonraki sayfa kendiliğinden çekilir", async () => {
    mockStatusIndex = { movie: { ...watchedPage(1).movie } };
    fetchDiscoverPage.mockImplementation(async ({ page }) => makePage(page, { total: 10 }));
    mount({ filters: { hideWatched: true } });
    await flush(10);
    expect(latest.status).toBe("ready");
    // 1. sayfa tamamen izlenmiş → 2. sayfa çekilir (20 görünür ≥ hedef) ve orada durur
    expect(fetchDiscoverPage.mock.calls.map(([a]) => a.page)).toEqual([1, 2]);
    expect(latest.items).toHaveLength(20);
    expect(latest.items.length).toBeGreaterThanOrEqual(MIN_VISIBLE_RESULTS);
    expect(latest.loadingMore).toBe(false);
  });

  test("HER ŞEY izlenmişse bile çekilen sayfa sayısı SINIRLI kalır (sonsuz döngü yok)", async () => {
    const everything = new Proxy({}, { get: () => ({ isWatched: true }) });
    mockStatusIndex = { movie: everything };
    fetchDiscoverPage.mockImplementation(async ({ page }) => makePage(page, { total: 500 }));
    mount({ filters: { hideWatched: true } });
    await flush(40);
    expect(fetchDiscoverPage.mock.calls.length).toBeLessThanOrEqual(MAX_AUTOFILL_PAGES * (1 + TOP_UP_LIMIT));
    expect(latest.items).toEqual([]);
    expect(latest.loadingMore).toBe(false);
    expect(latest.status).toBe("ready");
  });

  test("kütüphane durumu GEÇ gelirse görünür sayı düşer ve doldurma bir kez daha çalışır", async () => {
    fetchDiscoverPage.mockImplementation(async ({ page }) => makePage(page, { total: 10 }));
    mockStatusIndex = {};
    mount({ filters: { hideWatched: true } });
    await flush();
    const before = fetchDiscoverPage.mock.calls.length;
    const index = { movie: {} };
    makePage(1).results.slice(0, 10).forEach((item) => { index.movie[item.id] = { isWatched: true }; });
    mockStatusIndex = index;
    update({ filters: { hideWatched: true } });
    await flush();
    expect(latest.items.length).toBeGreaterThanOrEqual(10);
    expect(fetchDiscoverPage.mock.calls.length).toBeGreaterThan(before);
  });
});

describe("Şaşırt beni", () => {
  test("rastgele sayfayı çekip afişli bir sonucu döner", async () => {
    fetchDiscoverPage.mockImplementation(async ({ page }) => makePage(page, { total: 50 }));
    mount({});
    await flush();
    randomInt.mockReturnValueOnce(3).mockReturnValueOnce(2); // sayfa 4, öğe indeksi 2
    const pick = await latest.surprise();
    expect(fetchDiscoverPage.mock.calls.at(-1)[0].page).toBe(4);
    expect(pick.id).toBe(402);
  });

  test("toplam sayfa penceresi 8 ile sınırlı", async () => {
    fetchDiscoverPage.mockImplementation(async ({ page }) => makePage(page, { total: 500 }));
    mount({});
    await flush();
    await latest.surprise();
    expect(randomInt.mock.calls[0][0]).toBe(8);
  });

  test("izlenenleri seçmez; hepsi izlenmişse null", async () => {
    mockStatusIndex = { movie: new Proxy({}, { get: () => ({ isWatched: true }) }) };
    fetchDiscoverPage.mockImplementation(async ({ page }) => makePage(page, { total: 5 }));
    mount({ filters: { hideWatched: true } });
    await flush(20);
    expect(await latest.surprise()).toBeNull();
  });

  test("ağ hatasında FIRLATIR (ekran kullanıcıya söyler)", async () => {
    fetchDiscoverPage.mockResolvedValueOnce(makePage(1));
    mount({});
    await flush();
    fetchDiscoverPage.mockRejectedValueOnce(new Error("ağ yok"));
    await expect(latest.surprise()).rejects.toThrow("ağ yok");
  });
});
