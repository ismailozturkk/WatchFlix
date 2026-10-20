// __tests__/useDiscoverFilterStore.test.js
//
// "Ne izlesem?" kalıcı durumu GERÇEK depoyla (bellek-içi MMKV taklidi): kayıtlı süzgeçler (kaydet / aynı
// süzgeci taşı / sınır / sil / bozuk kayıt) ve her medya türünün son kullanılan süzgeci.

import React from "react";
import { act, create } from "react-test-renderer";

const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get, getStore, has, physicalKey } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const {
  deleteDiscoverPreset,
  readLastDiscoverFilters,
  saveDiscoverPreset,
  useDiscoverPresets,
  writeLastDiscoverFilters,
} = require("../hooks/useDiscoverFilterStore");
const { DEFAULT_FILTERS, MAX_SAVED_PRESETS } = require("../utils/discoverFilters");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let warn;
let seen;
function Probe() {
  seen = useDiscoverPresets();
  return null;
}
const mount = () => act(() => { renderer = create(<Probe />); });

beforeEach(() => {
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  seen = undefined;
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

const save = (name, filters, mediaType = "movie", now = Date.now()) =>
  saveDiscoverPreset({ name, mediaType, filters }, now, () => Math.random());

describe("kayıtlı süzgeçler", () => {
  test("kayıt yokken boş liste", () => {
    mount();
    expect(seen).toEqual([]);
    expect(has(Keys.discoverPresets)).toBe(false);
  });

  test("kaydetmek AÇIK ekranı anında günceller ve normalize eder", () => {
    mount();
    let result;
    act(() => { result = save("Komedi 7+", { genres: [35, 35], minRating: 7, era: "yok" }); });
    expect(result.ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ name: "Komedi 7+", mediaType: "movie" });
    expect(seen[0].filters).toMatchObject({ genres: [35], minRating: 7, era: "any" });
    expect(seen[0].id).toBe(result.id);
  });

  test("aynı süzgeç yeniden kaydedilince kopya olmaz, başa taşınır ve adı yenilenir", () => {
    mount();
    act(() => { save("A", { minRating: 7 }, "movie", 1000); });
    act(() => { save("B", { minRating: 8 }, "movie", 2000); });
    act(() => { save("A yeni ad", { minRating: 7 }, "movie", 3000); });
    expect(seen.map((p) => p.name)).toEqual(["A yeni ad", "B"]);
  });

  test("Film ve Dizi'de aynı süzgeç AYRI kayıt", () => {
    mount();
    act(() => {
      save("F", { minRating: 7 }, "movie", 1000);
      save("D", { minRating: 7 }, "tv", 2000);
    });
    expect(seen).toHaveLength(2);
  });

  test(`sınır ${MAX_SAVED_PRESETS}: en eski düşer`, () => {
    mount();
    act(() => {
      for (let i = 0; i < MAX_SAVED_PRESETS + 2; i += 1) save(`P${i}`, { genres: [35], language: ["tr", "en", "es", "fr", "de", "it", "ko", "ja", "hi"][i % 9] }, "movie", 1000 + i);
    });
    expect(seen).toHaveLength(MAX_SAVED_PRESETS);
    expect(seen[0].name).toBe(`P${MAX_SAVED_PRESETS + 1}`);
    expect(seen.map((p) => p.name)).not.toContain("P0");
  });

  test("geçersiz kayıt (ad yok / bilinmeyen tür) depoyu DEĞİŞTİRMEZ ve ok:false döner", () => {
    mount();
    let a;
    let b;
    act(() => {
      a = saveDiscoverPreset({ name: "", mediaType: "movie", filters: { minRating: 7 } });
      b = saveDiscoverPreset({ name: "x", mediaType: "podcast", filters: {} });
    });
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    expect(has(Keys.discoverPresets)).toBe(false);
  });

  test("silmek listeyi günceller; son kayıt silinince anahtar kalkar", () => {
    mount();
    let first;
    act(() => {
      first = save("A", { minRating: 7 }, "movie", 1000);
      save("B", { minRating: 8 }, "movie", 2000);
    });
    act(() => { expect(deleteDiscoverPreset(first.id)).toBe(true); });
    expect(seen.map((p) => p.name)).toEqual(["B"]);
    act(() => { deleteDiscoverPreset(seen[0].id); });
    expect(seen).toEqual([]);
    expect(has(Keys.discoverPresets)).toBe(false);
  });

  test("var olmayan kimliği silmek zararsız", () => {
    mount();
    act(() => { save("A", { minRating: 7 }); });
    act(() => { deleteDiscoverPreset("yok"); });
    expect(seen).toHaveLength(1);
  });

  test("liste değişmedikçe hook AYNI diziyi döner", () => {
    mount();
    act(() => { save("A", { minRating: 7 }); });
    const first = seen;
    act(() => renderer.update(<Probe />));
    expect(seen).toBe(first);
  });

  test("bozuk kayıt (JSON değil / dizi değil / içi çöp) ekranı bozmaz", () => {
    const store = getStore(Keys.discoverPresets.store);
    store.set(physicalKey(Keys.discoverPresets), "{bozuk");
    mount();
    expect(seen).toEqual([]);
    act(() => renderer.unmount());
    renderer = null;

    store.set(physicalKey(Keys.discoverPresets), JSON.stringify({ id: "x" }));
    mount();
    expect(seen).toEqual([]);
    act(() => renderer.unmount());
    renderer = null;

    store.set(
      physicalKey(Keys.discoverPresets),
      JSON.stringify([null, 5, { id: "a", name: "İyi", mediaType: "tv", filters: { genres: [28, 35], minRating: 99 } }]),
    );
    mount();
    expect(seen).toHaveLength(1);
    expect(seen[0].filters.genres).toEqual([35]); // 28 Dizi'de geçersiz
    expect(seen[0].filters.minRating).toBe(0);
  });
});

describe("son kullanılan süzgeç", () => {
  test("kayıt yokken her iki tür de varsayılan", () => {
    expect(readLastDiscoverFilters("movie")).toEqual(DEFAULT_FILTERS);
    expect(readLastDiscoverFilters("tv")).toEqual(DEFAULT_FILTERS);
  });

  test("Film ve Dizi ayrı hatırlanır", () => {
    writeLastDiscoverFilters("movie", { genres: [28], minRating: 7 });
    writeLastDiscoverFilters("tv", { genres: [35], era: "d2010" });
    expect(readLastDiscoverFilters("movie")).toMatchObject({ genres: [28], minRating: 7, era: "any" });
    expect(readLastDiscoverFilters("tv")).toMatchObject({ genres: [35], era: "d2010", minRating: 0 });
  });

  test("birini sıfırlamak ötekini korur; ikisi de sıfırlanınca anahtar silinir", () => {
    writeLastDiscoverFilters("movie", { minRating: 7 });
    writeLastDiscoverFilters("tv", { minRating: 8 });
    writeLastDiscoverFilters("movie", DEFAULT_FILTERS);
    expect(readLastDiscoverFilters("tv").minRating).toBe(8);
    expect(has(Keys.discoverFilters)).toBe(true);
    writeLastDiscoverFilters("tv", DEFAULT_FILTERS);
    expect(has(Keys.discoverFilters)).toBe(false);
    expect(get(Keys.discoverFilters)).toBeNull();
  });

  test("geçersiz alanlar yazılırken temizlenir (dizi için film türü düşer)", () => {
    writeLastDiscoverFilters("tv", { genres: [28, 35], minRating: 7 });
    expect(readLastDiscoverFilters("tv").genres).toEqual([35]);
  });

  test("bozuk kayıt varsayılana düşer, yazma yine çalışır", () => {
    getStore(Keys.discoverFilters.store).set(physicalKey(Keys.discoverFilters), "{bozuk");
    expect(readLastDiscoverFilters("movie")).toEqual(DEFAULT_FILTERS);
    writeLastDiscoverFilters("movie", { minRating: 6 });
    expect(readLastDiscoverFilters("movie").minRating).toBe(6);
  });
});
