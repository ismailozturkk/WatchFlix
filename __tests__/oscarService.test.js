jest.mock("axios", () => ({
  get: jest.fn().mockImplementation((url, config) => {
    const match = url.match(/\/movie\/(\d+)/);
    const id = match ? parseInt(match[1], 10) : 100;
    return Promise.resolve({
      data: {
        id,
        title: `Test Movie ${id}`,
        poster_path: `/test_poster_${id}.jpg`,
        vote_average: 8.5,
        vote_count: 1000,
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
  TTL: { OSCAR: 604800 },
}));

import {
  FALLBACK_OSCAR_CONFIG,
  fetchOscarByCategory,
  fetchOscarByYear,
  getOscarConfig,
  isValidOscarConfig,
  OSCAR_CATEGORIES,
  DEFAULT_OSCAR_CATEGORY,
} from "../services/oscarService";
import { getDoc } from "firebase/firestore";

describe("Oscar Ödülleri Servisi (oscarService)", () => {
  it("6 Oscar kategorisi ve varsayılan kategori 'best_picture' tanımlıdır", () => {
    expect(OSCAR_CATEGORIES).toBeDefined();
    expect(OSCAR_CATEGORIES.length).toBe(6);
    expect(DEFAULT_OSCAR_CATEGORY).toBe("best_picture");

    const keys = OSCAR_CATEGORIES.map((c) => c.key);
    expect(keys).toContain("best_picture");
    expect(keys).toContain("best_international_feature");
    expect(keys).toContain("best_animated_feature");
    expect(keys).toContain("best_visual_effects");
    expect(keys).toContain("best_documentary_feature");
    expect(keys).toContain("best_cinematography");
  });

  it("isValidOscarConfig yalnızca geçerli 6 kategorili konfigürasyonu doğrular", () => {
    expect(isValidOscarConfig(FALLBACK_OSCAR_CONFIG)).toBe(true);

    // Eksik veya kategorisiz eski şema geçersiz olmalıdır
    const oldSchema = {
      items: [
        { year: 2026, tmdbId: 1054867, isConfirmed: true },
        { year: 2025, tmdbId: 1064213, isConfirmed: true },
      ],
    };
    expect(isValidOscarConfig(oldSchema)).toBe(false);
    expect(isValidOscarConfig(null)).toBeFalsy();
    expect(isValidOscarConfig({})).toBeFalsy();
  });

  it("getOscarConfig Firestore'da kategorisiz eski veri olduğunda FALLBACK_OSCAR_CONFIG'e düşer", async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        items: new Array(58).fill({ year: 2026, tmdbId: 1054867, isConfirmed: true }),
      }),
    });

    const config = await getOscarConfig({ forceRefresh: true });
    expect(config).toEqual(FALLBACK_OSCAR_CONFIG);
    expect(config.items[1].categories.best_picture).toBeDefined();
  });

  it("FALLBACK_OSCAR_CONFIG 1970 ile 2027 arasındaki tüm 58 yılı 6 kategorili içerir", () => {
    expect(FALLBACK_OSCAR_CONFIG).toBeDefined();
    expect(Array.isArray(FALLBACK_OSCAR_CONFIG.items)).toBe(true);

    const items = FALLBACK_OSCAR_CONFIG.items;
    expect(items.length).toBe(58); // 2027 - 1970 + 1 = 58 yıl

    // En başta 2027 yılı olmalı ve isConfirmed false olmalı
    expect(items[0].year).toBe(2027);
    expect(items[0].isConfirmed).toBe(false);

    // En sonda 1970 yılı olmalı
    expect(items[items.length - 1].year).toBe(1970);
    expect(items[items.length - 1].isConfirmed).toBe(true);
    expect(items[items.length - 1].categories.best_picture).toBeDefined();
  });

  it("fetchOscarByCategory 10'arlı sayfalama yapar ve seçili kategorideki filmleri çeker", async () => {
    const items = FALLBACK_OSCAR_CONFIG.items;

    // Sayfa 0 (İlk 10 film: 2027 - 2018)
    const page0 = await fetchOscarByCategory({
      configItems: items,
      categoryKey: "best_picture",
      page: 0,
      pageSize: 10,
      language: "tr",
      apiKey: "test_key",
    });

    expect(page0.items.length).toBe(10);
    expect(page0.hasMore).toBe(true);
    expect(page0.nextPage).toBe(1);

    // İlk öğe (2027) pending olmalı
    const firstItem = page0.items[0];
    expect(firstItem.year).toBe(2027);
    expect(firstItem.isConfirmed).toBe(false);
    expect(firstItem.isPending).toBe(true);
    expect(firstItem.poster_path).toBeNull();

    // 2. öğe (2026) kesinleşmiş olmalı
    const secondItem = page0.items[1];
    expect(secondItem.year).toBe(2026);
    expect(secondItem.isConfirmed).toBe(true);
    expect(secondItem.poster_path).toBeDefined();
  });

  it("fetchOscarByYear seçilen yılın 6 dalındaki filmlerini getirir", async () => {
    const items = FALLBACK_OSCAR_CONFIG.items;
    const year2024 = await fetchOscarByYear({
      configItems: items,
      year: 2024,
      language: "tr",
      apiKey: "test_key",
    });

    expect(Array.isArray(year2024)).toBe(true);
    expect(year2024.length).toBe(6);
    expect(year2024[0].categoryKey).toBe("best_picture");
    expect(year2024[0].year).toBe(2024);
  });
});
