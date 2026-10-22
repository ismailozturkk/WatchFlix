// __tests__/sectionVisibilityScreen.test.js
//
// Ayarlar > Kişiselleştirme > Ekran bölümleri sayfası, GERÇEK depo ve GERÇEK kancalarla
// (yalnız RN ana makine bileşenleri ve ağır alt bileşenler taklit). Sınananlar:
// ekran karoları, bölüm satırları, anahtarın depoya yazması, hepsini aç/kapa, onay
// sayfası (arkadaş çubuğu), eski tek anahtarlı "Devam Edenler", sıfırlama, kayıt
// hatasında uyarı ve açılış sekmesi.

import React from "react";
import { act, create } from "react-test-renderer";

let mockLang = "en";
let mockRoute = { params: undefined };
let mockOngoing = true;
const mockChangeOngoing = jest.fn((next) => { mockOngoing = next; });
const mockToastError = jest.fn();
const mockSelection = jest.fn();
let mockFailWrites = false;

jest.mock("react-native", () => {
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    interpolate() { return "100%"; }
  }
  return {
    Animated: { Value, View: "AnimatedView", timing: () => ({ start() {}, stop() {} }) },
    Easing: { out: (fn) => fn, cubic: 1 },
    StyleSheet: { create: (styles) => styles },
    TouchableOpacity: "Touchable",
    View: "View",
    Text: "Text",
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@react-navigation/native", () => ({ useRoute: () => mockRoute }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/SwitchToggle", () => ({ __esModule: true, default: "Switch" }));
jest.mock("../components/common/ConfirmSheet", () => ({ __esModule: true, default: "Confirm" }));
jest.mock("../components/AppToast", () => ({ toast: { error: (...args) => mockToastError(...args) } }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock("../context/AppSettingsContext", () => ({
  useOngoingTvShowsSettings: () => ({ showOngoingTvShows: mockOngoing, changeShowOngoingTvShows: mockChangeOngoing }),
}));
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => true }));
jest.mock("../services/hapticsService", () => ({ selectionAsync: (...args) => mockSelection(...args) }));
jest.mock("../screens/tabs/settings/settingsUi", () => ({
  SettingsSubScreen: "Screen",
  buildUiColors: () => new Proxy({}, { get: () => "#336699" }),
  ui: new Proxy({}, { get: () => ({}) }),
}));
// Depo: gerçek, ama yazımlar isteğe bağlı BAŞARISIZ olabilir (hata yolunu sınamak için).
jest.mock("../services/storage", () => {
  const real = jest.requireActual("../services/storage");
  return {
    ...real,
    set: (...args) => (mockFailWrites ? false : real.set(...args)),
    remove: (...args) => (mockFailWrites ? false : real.remove(...args)),
  };
});

const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const SectionVisibilityScreen = require("../screens/tabs/settings/SectionVisibilityScreen").default;
const { SECTION_VISIBILITY_COPY } = require("../screens/tabs/settings/sectionVisibilityCopy");
const { normalizeSectionVisibility, sectionsOf, storedSectionsOf } = require("../utils/sectionVisibility");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let warn;
const render = () => {
  act(() => { renderer = create(<SectionVisibilityScreen />); });
};
const stored = () => normalizeSectionVisibility(get(Keys.sectionVisibility));
const rowIds = () => renderer.root.findAll((n) => n.type === "Touchable" && String(n.props.testID || "").startsWith("section-row-")).map((n) => n.props.testID.replace("section-row-", ""));
const row = (id) => renderer.root.findByProps({ testID: `section-row-${id}` });
const tile = (id) => renderer.root.findByProps({ testID: `section-screen-${id}` });
const pressRow = (id) => act(() => row(id).props.onPress());
const pressTile = (id) => act(() => tile(id).props.onPress());
const pressAll = () => act(() => renderer.root.findByProps({ testID: "section-toggle-all" }).props.onPress());
const confirm = () => renderer.root.findByType("Confirm");
const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
const copy = () => SECTION_VISIBILITY_COPY[mockLang];

beforeEach(() => {
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  mockLang = "en";
  mockRoute = { params: undefined };
  mockOngoing = true;
  mockFailWrites = false;
  mockChangeOngoing.mockClear();
  mockToastError.mockClear();
  mockSelection.mockClear();
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

describe("ilk görünüm", () => {
  test("beş ekran karosu (sekme sırası), Diziler seçili; satırlar ekrandaki sırayla", () => {
    render();
    for (const id of ["tv", "movie", "hub", "library", "profile"]) expect(tile(id)).toBeDefined();
    expect(tile("tv").props.accessibilityState).toEqual({ selected: true });
    expect(tile("movie").props.accessibilityState).toEqual({ selected: false });
    expect(rowIds()).toEqual(sectionsOf("tv").map((s) => s.id));
  });

  test("hepsi açıkken özet 'N of N' der ve sıfırlama düğmesi yoktur", () => {
    render();
    const total = sectionsOf("tv").length;
    expect(texts()).toContain(`${total} of ${total} sections visible`);
    expect(renderer.root.findAllByProps({ testID: "section-reset" })).toHaveLength(0);
    for (const item of sectionsOf("tv")) {
      expect(row(item.id).props.accessibilityState).toEqual({ checked: true });
    }
  });

  test("route.params.initialScreen sekmeyi açar; geçersizse Diziler", () => {
    mockRoute = { params: { initialScreen: "movie" } };
    render();
    expect(tile("movie").props.accessibilityState).toEqual({ selected: true });
    expect(rowIds()).toEqual(sectionsOf("movie").map((s) => s.id));
    act(() => renderer.unmount());
    mockRoute = { params: { initialScreen: "yok" } };
    render();
    expect(tile("tv").props.accessibilityState).toEqual({ selected: true });
  });

  test("ekran karosuna basınca o ekranın satırları gelir", () => {
    render();
    pressTile("profile");
    expect(rowIds()).toEqual(["goal", "badges", "friends", "stats", "activity"]);
    expect(tile("profile").props.accessibilityState).toEqual({ selected: true });
    pressTile("library");
    expect(rowIds()).toEqual(["nextUp", "lists", "reminders", "notes", "wrapped"]);
    pressTile("hub");
    expect(rowIds()).toEqual(["feed", "cineswipe", "bingo", "poll", "tournament", "games"]);
  });

  test("her dilde ekran adı ve bölüm başlığı gösterilir", () => {
    for (const dil of ["tr", "en", "es", "pt"]) {
      mockLang = dil;
      render();
      const metinler = texts();
      expect(metinler).toContain(copy().screens.tv.name);
      expect(metinler).toContain(copy().sections.tv.worldTour[0]);
      act(() => renderer.unmount());
      renderer = null;
    }
  });
});

describe("bölüm satırı anahtarı", () => {
  test("satıra basmak bölümü gizler ve DEPOYA yazar; ekran güncellenir", () => {
    render();
    pressRow("worldTour");
    expect(stored().tv).toEqual(["worldTour"]);
    expect(row("worldTour").props.accessibilityState).toEqual({ checked: false });
    expect(row("genres").props.accessibilityState).toEqual({ checked: true });
    const total = sectionsOf("tv").length;
    expect(texts()).toContain(`${total - 1} of ${total} sections visible`);
    expect(mockSelection).toHaveBeenCalled();
  });

  test("anahtarın kendi onValueChange'i de aynı işi yapar", () => {
    render();
    const anahtar = row("genres").findByType("Switch");
    act(() => anahtar.props.onValueChange(false));
    expect(stored().tv).toEqual(["genres"]);
    act(() => row("genres").findByType("Switch").props.onValueChange(true));
    expect(stored().tv).toEqual([]);
  });

  test("tekrar basınca geri açılır ve kayıt silinir", () => {
    render();
    pressRow("trends");
    pressRow("trends");
    expect(stored()).toEqual({ tv: [], movie: [], hub: [], library: [], profile: [] });
    expect(get(Keys.sectionVisibility)).toBeNull();
  });

  test("Film ve Dizi'nin aynı adlı rafı bağımsız", () => {
    render();
    pressRow("trends");
    expect(stored().tv).toEqual(["trends"]);
    pressTile("movie");
    expect(row("trends").props.accessibilityState).toEqual({ checked: true });
    pressRow("trends");
    expect(stored()).toMatchObject({ tv: ["trends"], movie: ["trends"] });
  });

  test("gizlenen sayısı karoda rozet olarak görünür", () => {
    render();
    pressRow("worldTour");
    pressRow("genres");
    const rozet = tile("tv").findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
    expect(rozet).toContain("2");
    expect(rozet).toContain(`${sectionsOf("tv").length - 2}/${sectionsOf("tv").length}`);
  });

  test("kayıt başarısız olursa kullanıcıya uyarı çıkar", () => {
    render();
    mockFailWrites = true;
    pressRow("worldTour");
    expect(mockToastError).toHaveBeenCalledWith(SECTION_VISIBILITY_COPY.en.ui.saveFailed);
    expect(stored().tv).toEqual([]);
  });
});

describe("Tümünü gizle / göster", () => {
  test("Filmler: hepsini gizler, düğme 'Show all'a döner, tekrar basınca hepsini açar", () => {
    render();
    pressTile("movie");
    expect(texts()).toContain(copy().ui.hideAll);
    pressAll();
    expect(stored().movie).toEqual(storedSectionsOf("movie").map((s) => s.id));
    expect(stored().tv).toEqual([]);
    expect(texts()).toContain(copy().ui.showAll);
    pressAll();
    expect(stored().movie).toEqual([]);
    expect(texts()).toContain(copy().ui.hideAll);
  });

  test("bir kısmı gizliyken düğme 'Show all' der ve hepsini açar", () => {
    render();
    pressTile("hub");
    pressRow("games");
    expect(texts()).toContain(copy().ui.showAll);
    pressAll();
    expect(stored().hub).toEqual([]);
  });
});

describe("arkadaş çubuğu onayı (başka giriş yok)", () => {
  test("gizlemeden önce onay sayfası açılır, kayıt henüz değişmez", () => {
    render();
    pressTile("profile");
    expect(confirm().props.visible).toBe(false);
    pressRow("friends");
    expect(confirm().props.visible).toBe(true);
    expect(confirm().props.title).toBe(copy().ui.confirmTitle);
    expect(stored().profile).toEqual([]);
  });

  test("onaylayınca gizlenir ve sayfa kapanır", () => {
    render();
    pressTile("profile");
    pressRow("friends");
    act(() => confirm().props.onConfirm());
    expect(stored().profile).toEqual(["friends"]);
    expect(confirm().props.visible).toBe(false);
  });

  test("vazgeçince hiçbir şey değişmez", () => {
    render();
    pressTile("profile");
    pressRow("friends");
    act(() => confirm().props.onClose());
    expect(stored().profile).toEqual([]);
    expect(confirm().props.visible).toBe(false);
  });

  test("zaten gizli çubuğu GÖSTERMEK onay istemez", () => {
    render();
    pressTile("profile");
    pressRow("friends");
    act(() => confirm().props.onConfirm());
    pressRow("friends");
    expect(confirm().props.visible).toBe(false);
    expect(stored().profile).toEqual([]);
  });

  test("Profil'de 'Tümünü gizle' de onay ister; onaylanınca hepsi gizlenir", () => {
    render();
    pressTile("profile");
    pressAll();
    expect(confirm().props.visible).toBe(true);
    expect(stored().profile).toEqual([]);
    act(() => confirm().props.onConfirm());
    expect(stored().profile).toHaveLength(storedSectionsOf("profile").length);
  });

  test("çubuk zaten gizliyse 'Tümünü gizle' onay sormaz", () => {
    render();
    pressTile("profile");
    pressRow("friends");
    act(() => confirm().props.onConfirm());
    pressRow("activity");
    pressAll(); // kısmen gizli → 'Show all'
    expect(stored().profile).toEqual([]);
  });

  test("onay gerektirmeyen ekranlarda sayfa hiç açılmaz", () => {
    render();
    pressAll();
    expect(confirm().props.visible).toBe(false);
    expect(stored().tv).toHaveLength(storedSectionsOf("tv").length);
  });
});

describe("eski tek anahtarlı bölüm: Kütüphane > Sıradaki (showOngoingTvShows)", () => {
  test("Diziler ekranında devam eden diziler satırı YOK (raf Kütüphane'ye taşındı)", () => {
    render();
    expect(rowIds()).not.toContain("ongoing");
  });

  test("Kütüphane'de satır VAR, 'Shared setting' etiketi taşır", () => {
    render();
    pressTile("library");
    expect(rowIds()).toContain("nextUp");
    expect(texts()).toContain(copy().ui.linkedTag);
  });

  test("anahtar mevcut ayarı yazar; bu modülün kaydına DOKUNMAZ", () => {
    render();
    pressTile("library");
    pressRow("nextUp");
    expect(mockChangeOngoing).toHaveBeenCalledWith(false);
    expect(get(Keys.sectionVisibility)).toBeNull();
  });

  test("ayar kapalıyken satır kapalı çizilir ve özet bunu sayar", () => {
    mockOngoing = false;
    render();
    pressTile("library");
    expect(row("nextUp").props.accessibilityState).toEqual({ checked: false });
    const total = sectionsOf("library").length;
    expect(texts()).toContain(`${total - 1} of ${total} sections visible`);
    expect(renderer.root.findAllByProps({ testID: "section-reset" })).toHaveLength(1);
  });

  test("'Tümünü gizle' Sıradaki ayarını da kapatır", () => {
    render();
    pressTile("library");
    pressAll();
    expect(mockChangeOngoing).toHaveBeenCalledWith(false);
    expect(stored().library).toHaveLength(storedSectionsOf("library").length);
  });

  test("sıfırla: kapalı Sıradaki ayarını da açar", () => {
    mockOngoing = false;
    render();
    act(() => renderer.root.findByProps({ testID: "section-reset" }).props.onPress());
    expect(mockChangeOngoing).toHaveBeenCalledWith(true);
  });
});

describe("sıfırlama", () => {
  test("özelleştirme varken görünür; basınca her ekran geri açılır", () => {
    render();
    pressRow("worldTour");
    pressTile("hub");
    pressRow("games");
    expect(renderer.root.findAllByProps({ testID: "section-reset" })).toHaveLength(1);
    act(() => renderer.root.findByProps({ testID: "section-reset" }).props.onPress());
    expect(stored()).toEqual({ tv: [], movie: [], hub: [], library: [], profile: [] });
    expect(renderer.root.findAllByProps({ testID: "section-reset" })).toHaveLength(0);
    // Sıradaki zaten açıktı: ayarına dokunulmaz.
    expect(mockChangeOngoing).not.toHaveBeenCalled();
  });
});

describe("açıklama notu", () => {
  test("koşullu raf notu yalnız Dizi ve Film'de görünür", () => {
    render();
    expect(texts()).toContain(copy().ui.conditionalNote);
    pressTile("movie");
    expect(texts()).toContain(copy().ui.conditionalNote);
    pressTile("hub");
    expect(texts()).not.toContain(copy().ui.conditionalNote);
    pressTile("profile");
    expect(texts()).not.toContain(copy().ui.conditionalNote);
  });
});
