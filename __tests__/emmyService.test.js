jest.mock("axios", () => ({
  get: jest.fn().mockImplementation((url, config) => {
    const match = url.match(/\/tv\/(\d+)/);
    const id = match ? parseInt(match[1], 10) : 100;
    return Promise.resolve({
      data: {
        id,
        name: `Test TV Show ${id}`,
        poster_path: `/test_poster_${id}.jpg`,
        vote_average: 8.7,
        vote_count: 2000,
      },
    });
  }),
}));

jest.mock("../firebase", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock("../utils/apiCache", () => ({
  getCachedValue: jest.fn().mockResolvedValue(null),
  setCachedValue: jest.fn(),
  TTL: { EMMY: 604800 },
}));

import {
  FALLBACK_EMMY_CONFIG,
  fetchEmmyByCategory,
  fetchEmmyByYear,
  getEmmyConfig,
  isValidEmmyConfig,
  EMMY_CATEGORIES,
  DEFAULT_EMMY_CATEGORY,
} from "../services/emmyService";
import { getDoc } from "firebase/firestore";

describe("Emmy Ödülleri Servisi (emmyService)", () => {
  it("6 Emmy kategorisi ve varsayılan kategori 'drama_series' tanımlıdır", () => {
    expect(EMMY_CATEGORIES).toBeDefined();
    expect(EMMY_CATEGORIES.length).toBe(6);
    expect(DEFAULT_EMMY_CATEGORY).toBe("drama_series");

    const keys = EMMY_CATEGORIES.map((c) => c.key);
    expect(keys).toContain("drama_series");
    expect(keys).toContain("comedy_series");
    expect(keys).toContain("limited_series");
    expect(keys).toContain("animated_program");
    expect(keys).toContain("documentary_series");
    expect(keys).toContain("international_emmy");
  });

  it("isValidEmmyConfig yalnızca geçerli 6 kategorili konfigürasyonu doğrular", () => {
    expect(isValidEmmyConfig(FALLBACK_EMMY_CONFIG)).toBe(true);

    const invalid = {
      items: [
        { year: 2026, tmdbId: 126308, isConfirmed: true },
      ],
    };
    expect(isValidEmmyConfig(invalid)).toBe(false);
    expect(isValidEmmyConfig(null)).toBeFalsy();
    expect(isValidEmmyConfig({})).toBeFalsy();
  });

  it("getEmmyConfig Firestore'da geçersiz veri olduğunda FALLBACK_EMMY_CONFIG'e düşer", async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        items: new Array(58).fill({ year: 2026, tmdbId: 126308, isConfirmed: true }),
      }),
    });

    const config = await getEmmyConfig({ forceRefresh: true });
    expect(config).toEqual(FALLBACK_EMMY_CONFIG);
    expect(config.items[1].categories.drama_series).toBeDefined();
  });

  it("FALLBACK_EMMY_CONFIG 1970 ile 2027 arasındaki tüm 58 yılı 6 kategorili içerir", () => {
    expect(FALLBACK_EMMY_CONFIG).toBeDefined();
    expect(Array.isArray(FALLBACK_EMMY_CONFIG.items)).toBe(true);

    const items = FALLBACK_EMMY_CONFIG.items;
    expect(items.length).toBe(58);

    expect(items[0].year).toBe(2027);
    expect(items[0].isConfirmed).toBe(false);

    expect(items[items.length - 1].year).toBe(1970);
    expect(items[items.length - 1].isConfirmed).toBe(true);
    expect(items[items.length - 1].categories.drama_series).toBeDefined();
  });

  it("fetchEmmyByCategory 10'arlı sayfalama yapar ve seçili kategorideki dizileri çeker", async () => {
    const items = FALLBACK_EMMY_CONFIG.items;

    const page0 = await fetchEmmyByCategory({
      configItems: items,
      categoryKey: "drama_series",
      page: 0,
      pageSize: 10,
      language: "tr",
      apiKey: "test_key",
    });

    expect(page0.items.length).toBe(10);
    expect(page0.hasMore).toBe(true);
    expect(page0.nextPage).toBe(1);

    const firstItem = page0.items[0];
    expect(firstItem.year).toBe(2027);
    expect(firstItem.isConfirmed).toBe(false);
    expect(firstItem.isPending).toBe(true);
    expect(firstItem.poster_path).toBeNull();

    const secondItem = page0.items[1];
    expect(secondItem.year).toBe(2026);
    expect(secondItem.isConfirmed).toBe(true);
    expect(secondItem.poster_path).toBeDefined();
  });

  it("fetchEmmyByYear seçilen yılın 6 dalındaki dizilerini getirir", async () => {
    const items = FALLBACK_EMMY_CONFIG.items;
    const year2024 = await fetchEmmyByYear({
      configItems: items,
      year: 2024,
      language: "tr",
      apiKey: "test_key",
    });

    expect(Array.isArray(year2024)).toBe(true);
    expect(year2024.length).toBe(6);
    expect(year2024[0].categoryKey).toBe("drama_series");
    expect(year2024[0].year).toBe(2024);
  });
});
