// "Verileri indir" ana anahtarı + veri türü seçiminin saf mantığı.
// AsyncStorage mock'lanır (RN modülü); geri kalan her şey saf JS.

jest.mock("@react-native-async-storage/async-storage", () => ({
  multiGet: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AUTO_DATA_CACHE_KEY,
  DATA_CACHE_CATEGORIES,
  DATA_TYPES_KEY,
  DEFAULT_DATA_TYPES,
  categoryForCacheKey,
  categoryForNamespace,
  categoryForTmdbUrl,
  getAutoDataCacheEnabled,
  getDataTypes,
  hydrateAutoDataCacheSetting,
  isDataTypeEnabled,
  normalizeDataTypes,
  setAutoDataCacheEnabled,
  setDataTypes,
  shouldPersistInternetData,
} from "../utils/dataCacheSettings";

const mockStorage = (enabled, types) =>
  AsyncStorage.multiGet.mockResolvedValueOnce([
    [AUTO_DATA_CACHE_KEY, enabled],
    [DATA_TYPES_KEY, types],
  ]);

beforeEach(() => {
  AsyncStorage.multiGet.mockReset();
  setAutoDataCacheEnabled(false);
  setDataTypes(null);
});

describe("ana anahtar", () => {
  test("kapalıyken hiçbir veri diske yazılmaz", () => {
    setAutoDataCacheEnabled(false);
    expect(shouldPersistInternetData()).toBe(false);
    for (const category of DATA_CACHE_CATEGORIES) {
      expect(shouldPersistInternetData({ category })).toBe(false);
      expect(isDataTypeEnabled(category)).toBe(false);
    }
  });

  test("kapalıyken force bile yazdıramaz", () => {
    setAutoDataCacheEnabled(false);
    expect(shouldPersistInternetData({ force: true })).toBe(false);
    expect(
      shouldPersistInternetData({ force: true, category: "movieContent" }),
    ).toBe(false);
  });

  test("açık + tüm türler açık → hepsi yazılır", () => {
    setAutoDataCacheEnabled(true);
    expect(shouldPersistInternetData()).toBe(true);
    for (const category of DATA_CACHE_CATEGORIES) {
      expect(shouldPersistInternetData({ category })).toBe(true);
    }
  });
});

describe("veri türü seçimi", () => {
  test("kapalı tür yazılmaz, diğerleri etkilenmez", () => {
    setAutoDataCacheEnabled(true);
    setDataTypes({ ...DEFAULT_DATA_TYPES, images: false, posts: false });

    expect(shouldPersistInternetData({ category: "images" })).toBe(false);
    expect(shouldPersistInternetData({ category: "posts" })).toBe(false);
    expect(shouldPersistInternetData({ category: "lists" })).toBe(true);
    expect(shouldPersistInternetData({ category: "movieContent" })).toBe(true);
    // Kategorisiz çağrı (eşleşmeyen genel cache) ana anahtara tabidir.
    expect(shouldPersistInternetData()).toBe(true);
  });

  test("force tür filtresini atlar (indirici adımları için)", () => {
    setAutoDataCacheEnabled(true);
    setDataTypes({ ...DEFAULT_DATA_TYPES, movieContent: false });
    expect(shouldPersistInternetData({ category: "movieContent" })).toBe(false);
    expect(
      shouldPersistInternetData({ category: "movieContent", force: true }),
    ).toBe(true);
  });

  test("normalizeDataTypes: bilinmeyen elenir, eksik açık sayılır", () => {
    const out = normalizeDataTypes({ notes: false, uydurma: true });
    expect(out.notes).toBe(false);
    expect(out.uydurma).toBeUndefined();
    expect(Object.keys(out).sort()).toEqual([...DATA_CACHE_CATEGORIES].sort());
    expect(out.lists).toBe(true);
  });

  test("normalizeDataTypes: null/bozuk girdi → hepsi açık", () => {
    expect(normalizeDataTypes(null)).toEqual({ ...DEFAULT_DATA_TYPES });
    expect(normalizeDataTypes("bozuk")).toEqual({ ...DEFAULT_DATA_TYPES });
  });
});

describe("hydrate", () => {
  test("kayıtlı değerleri okur", async () => {
    mockStorage("true", JSON.stringify({ images: false }));
    await hydrateAutoDataCacheSetting();

    expect(getAutoDataCacheEnabled()).toBe(true);
    expect(getDataTypes().images).toBe(false);
    expect(getDataTypes().lists).toBe(true);
  });

  test("kayıt yoksa: ana anahtar kapalı, türler açık", async () => {
    mockStorage(null, null);
    await hydrateAutoDataCacheSetting();

    expect(getAutoDataCacheEnabled()).toBe(false);
    expect(getDataTypes()).toEqual({ ...DEFAULT_DATA_TYPES });
  });

  test("bozuk tür kaydı varsayılana düşer, ana anahtarı bozmaz", async () => {
    mockStorage("true", "{bozuk-json");
    await hydrateAutoDataCacheSetting();

    expect(getAutoDataCacheEnabled()).toBe(true);
    expect(getDataTypes()).toEqual({ ...DEFAULT_DATA_TYPES });
  });

  test("storage hatası güvenli tarafa düşer (kapalı)", async () => {
    AsyncStorage.multiGet.mockRejectedValueOnce(new Error("bozuk depo"));
    setAutoDataCacheEnabled(true);
    await hydrateAutoDataCacheSetting();

    expect(getAutoDataCacheEnabled()).toBe(false);
  });
});

describe("kategori eşleyiciler", () => {
  test("apicache anahtar öneki", () => {
    expect(categoryForCacheKey("movie_bests_tr-TR_p1")).toBe("movieContent");
    expect(categoryForCacheKey("tv_trends_tr-TR_week")).toBe("tvContent");
    expect(categoryForCacheKey("providers_tr")).toBeNull();
    expect(categoryForCacheKey(undefined)).toBeNull();
  });

  test("TMDB URL", () => {
    const base = "https://api.themoviedb.org/3/";
    expect(categoryForTmdbUrl(`${base}movie/550`)).toBe("movieContent");
    expect(categoryForTmdbUrl(`${base}discover/movie?page=1`)).toBe("movieContent");
    expect(categoryForTmdbUrl(`${base}trending/tv/week`)).toBe("tvContent");
    expect(categoryForTmdbUrl(`${base}genre/tv/list`)).toBe("tvContent");
    expect(categoryForTmdbUrl(`${base}person/123`)).toBeNull();
    expect(categoryForTmdbUrl("https://baska-site.com/movie/1")).toBeNull();
    expect(categoryForTmdbUrl(null)).toBeNull();
  });

  test("cacheStore namespace", () => {
    expect(categoryForNamespace("lists")).toBe("lists");
    expect(categoryForNamespace("notes")).toBe("notes");
    expect(categoryForNamespace("tmdb")).toBeNull();
    expect(categoryForNamespace("network")).toBeNull();
  });
});
