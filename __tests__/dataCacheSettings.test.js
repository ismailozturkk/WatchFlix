// "Verileri indir" ana anahtarı + veri türü seçiminin saf mantığı.
//
// MMKV GEÇİŞİ: modül artık ayarı SENKRON okuyor. Eskiden açılışta asenkron bir
// `hydrateAutoDataCacheSetting()` adımı vardı ve hidrasyon bitmeden yapılan her
// cache yazması ayarı `false` görüyordu — "Verileri indir" açık olan kullanıcıda
// bile açılıştaki ilk istekler diske yazılmıyordu. O adım ve testleri kalktı;
// yerine "depodan doğrudan okur" testleri geldi.

import { Keys, get, getStore } from "../services/storage";
import {
  DATA_CACHE_CATEGORIES,
  DEFAULT_DATA_TYPES,
  categoryForCacheKey,
  categoryForNamespace,
  categoryForTmdbUrl,
  getAutoDataCacheEnabled,
  getDataTypes,
  isDataTypeEnabled,
  normalizeDataTypes,
  setAutoDataCacheEnabled,
  setDataTypes,
  shouldPersistInternetData,
} from "../utils/dataCacheSettings";

beforeEach(() => {
  getStore("settings").clearAll();
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

describe("kalıcılık", () => {
  test("yazılan değer diske iner ve senkron geri okunur", () => {
    setAutoDataCacheEnabled(true);
    setDataTypes({ ...DEFAULT_DATA_TYPES, images: false });

    expect(get(Keys.autoDataCache)).toBe(true);
    expect(getAutoDataCacheEnabled()).toBe(true);
    expect(getDataTypes().images).toBe(false);
    expect(getDataTypes().lists).toBe(true);
  });

  test("kayıt yoksa: ana anahtar kapalı, türler açık", () => {
    getStore("settings").clearAll();
    expect(getAutoDataCacheEnabled()).toBe(false);
    expect(getDataTypes()).toEqual({ ...DEFAULT_DATA_TYPES });
  });

  test("bozuk tür kaydı varsayılana düşer, ana anahtarı bozmaz", () => {
    setAutoDataCacheEnabled(true);
    // Registry dışından bozuk veri enjekte et.
    getStore("settings").set(Keys.dataCacheTypes.key, "{bozuk-json");

    expect(getAutoDataCacheEnabled()).toBe(true);
    expect(getDataTypes()).toEqual({ ...DEFAULT_DATA_TYPES });
  });

  test("anahtar BAŞKA bir yerden değişirse ayna tazelenir", () => {
    // AppSettingsContext ayarı değiştirince bu modülün senkron aynası da
    // güncel olmalı; abonelik bunu sağlıyor.
    expect(getAutoDataCacheEnabled()).toBe(false);
    require("../services/storage").set(Keys.autoDataCache, true);
    expect(getAutoDataCacheEnabled()).toBe(true);
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
