// __tests__/discoverFilterSheet.test.js
//
// Filtre sayfası (components/home/DiscoverFilterSheet.js): taslak mantığı. Seçimler TASLAKTA yapılır,
// "Sonuçları göster" uygular, kapatmak atar; tür sınırı, medya türüne özgü seçenekler, platform kilidi,
// kayıtlı süzgeçler.

import React from "react";
import { act, create } from "react-test-renderer";

let mockLang = "tr";
jest.mock("react-native", () => ({
  StyleSheet: { create: (styles) => styles },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) => (visible ? children : null),
}));
jest.mock("../components/common/SheetScroll", () => ({ __esModule: true, default: "SheetScroll" }));
jest.mock("../components/SwitchToggle", () => ({ __esModule: true, default: "Switch" }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      accent: "#3388ff",
      primary: "#111111",
      secondary: "#222222",
      border: "#333333",
      text: { primary: "#ffffff", secondary: "#cccccc", muted: "#999999" },
    },
  }),
}));

const DiscoverFilterSheet = require("../components/home/DiscoverFilterSheet").default;
const { DISCOVER_FILTERS_COPY } = require("../screens/shared/discoverFiltersCopy");
const {
  DEFAULT_FILTERS,
  ERAS,
  GENRES,
  LANGUAGES,
  MAX_GENRES,
  QUICK_PRESETS,
  RATINGS,
  RUNTIMES,
  SORTS,
  normalizeFilters,
  resolveQuickPreset,
} = require("../utils/discoverFilters");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let warn;
beforeEach(() => {
  mockLang = "tr";
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

const baseProps = (over = {}) => ({
  visible: true,
  onClose: jest.fn(),
  mediaType: "movie",
  filters: DEFAULT_FILTERS,
  onApply: jest.fn(),
  hasProviders: true,
  presets: [],
  onSavePreset: jest.fn(),
  onDeletePreset: jest.fn(),
  ...over,
});
const render = (props) => act(() => { renderer = create(<DiscoverFilterSheet {...props} />); });
const rerender = (props) => act(() => renderer.update(<DiscoverFilterSheet {...props} />));
// `testID` hem bileşen öğesinde (DiscoverFilterChip) hem içteki yerel öğede olabilir: ilki yeterli.
const find = (testID) => renderer.root.findAllByProps({ testID })[0];
const maybe = (testID) => renderer.root.findAllByProps({ testID }).length > 0;
const press = (testID) => act(() => find(testID).props.onPress());
const lastApplied = (props) => props.onApply.mock.calls.at(-1)[0];
const textsOf = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));

describe("seçenekler", () => {
  test("her seçenek kümesi için çip var (film)", () => {
    render(baseProps());
    GENRES.movie.forEach((id) => expect(maybe(`filter-genre-${id}`)).toBe(true));
    ERAS.forEach((id) => expect(maybe(`filter-era-${id}`)).toBe(true));
    RATINGS.forEach((value) => expect(maybe(`filter-rating-${value}`)).toBe(true));
    RUNTIMES.forEach((id) => expect(maybe(`filter-runtime-${id}`)).toBe(true));
    LANGUAGES.forEach((id) => expect(maybe(`filter-language-${id}`)).toBe(true));
    SORTS.forEach((id) => expect(maybe(`filter-sort-${id}`)).toBe(true));
  });

  test("Dizi: Dizi türleri gösterilir, Film'e özgü olanlar gösterilmez", () => {
    render(baseProps({ mediaType: "tv" }));
    GENRES.tv.forEach((id) => expect(maybe(`filter-genre-${id}`)).toBe(true));
    expect(maybe("filter-genre-28")).toBe(false); // Aksiyon yalnız Film'de
    expect(maybe("filter-genre-10759")).toBe(true);
  });

  test("süre etiketleri medya türüne göre (dizide bölüm süresi + ipucu)", () => {
    render(baseProps({ mediaType: "tv" }));
    const texts = textsOf();
    expect(texts).toContain(DISCOVER_FILTERS_COPY.tr.runtimes.tv.short);
    expect(texts).not.toContain(DISCOVER_FILTERS_COPY.tr.runtimes.movie.short);
    expect(texts).toContain(DISCOVER_FILTERS_COPY.tr.ui.runtimeTvHint);
  });

  test.each(["tr", "en", "es"])("%s: başlık ve düğme metinleri kendi dilinde", (dil) => {
    mockLang = dil;
    render(baseProps());
    const texts = textsOf();
    const ui = DISCOVER_FILTERS_COPY[dil].ui;
    expect(texts).toContain(ui.sheetTitle);
    expect(texts).toContain(ui.reset);
    expect(texts).toContain(ui.apply);
  });
});

describe("taslak", () => {
  test("açılışta uygulanmış süzgeç seçili gelir", () => {
    render(baseProps({ filters: normalizeFilters({ genres: [35], era: "d2010", minRating: 7 }, "movie") }));
    expect(find("filter-genre-35").props.selected).toBe(true);
    expect(find("filter-genre-28").props.selected).toBe(false);
    expect(find("filter-era-d2010").props.selected).toBe(true);
    expect(find("filter-rating-7").props.selected).toBe(true);
  });

  test("seçimler taslakta kalır; 'Sonuçları göster' uygular ve prop'u DEĞİŞTİRMEZ", () => {
    const filters = normalizeFilters({ genres: [35] }, "movie");
    const props = baseProps({ filters });
    render(props);
    press("filter-genre-18");
    press("filter-era-d2020");
    press("filter-rating-8");
    press("filter-runtime-short");
    press("filter-language-ko");
    press("filter-sort-rating");
    expect(props.onApply).not.toHaveBeenCalled();
    press("filter-sheet-apply");
    expect(lastApplied(props)).toMatchObject({
      genres: [18, 35],
      era: "d2020",
      minRating: 8,
      runtime: "short",
      language: "ko",
      sort: "rating",
    });
    expect(filters.genres).toEqual([35]);
  });

  test("seçili çipe tekrar basmak kaldırır (tür) / 'Hepsi' ile temizler (diğerleri)", () => {
    const props = baseProps({ filters: normalizeFilters({ genres: [35], era: "d2010" }, "movie") });
    render(props);
    press("filter-genre-35");
    press("filter-era-any");
    press("filter-sheet-apply");
    expect(lastApplied(props)).toMatchObject({ genres: [], era: "any" });
  });

  test(`tür sınırı ${MAX_GENRES}: dolunca seçili olmayan çipler devre dışı, seçililer açık kalır`, () => {
    const full = normalizeFilters({ genres: [28, 12, 16, 35] }, "movie");
    render(baseProps({ filters: full }));
    expect(find("filter-genre-28").props.disabled).toBe(false);
    expect(find("filter-genre-80").props.disabled).toBe(true);
    press("filter-genre-28"); // birini kaldır
    expect(find("filter-genre-80").props.disabled).toBe(false);
  });

  test("Sıfırla taslağı varsayılana çeker; özelleştirme yoksa devre dışı", () => {
    render(baseProps());
    expect(find("filter-sheet-reset").props.disabled).toBe(true);
    act(() => renderer.unmount());
    const props = baseProps({ filters: normalizeFilters({ genres: [35], minRating: 7 }, "movie") });
    render(props);
    expect(find("filter-sheet-reset").props.disabled).toBe(false);
    press("filter-sheet-reset");
    press("filter-sheet-apply");
    expect(lastApplied(props)).toEqual(normalizeFilters(DEFAULT_FILTERS, "movie"));
  });

  test("kapatıp yeniden açınca taslak GÜNCEL süzgeçten yeniden kurulur (yarım kalan seçim atılır)", () => {
    const filters = normalizeFilters({ genres: [35] }, "movie");
    const props = baseProps({ filters });
    render(props);
    press("filter-genre-18");
    rerender({ ...props, visible: false });
    rerender({ ...props, visible: true });
    expect(find("filter-genre-18").props.selected).toBe(false);
    expect(find("filter-genre-35").props.selected).toBe(true);
  });

  test("'Sonuçları göster' etkin süzgeç sayısını yazar", () => {
    render(baseProps());
    const label = () => find("filter-sheet-apply").findAllByType("Text")[0].props.children;
    expect(label()).toBe(DISCOVER_FILTERS_COPY.tr.ui.apply);
    press("filter-genre-35");
    press("filter-rating-7");
    expect(label()).toBe(`${DISCOVER_FILTERS_COPY.tr.ui.apply} (2)`);
  });
});

describe("seçenek anahtarları", () => {
  test("platform yoksa anahtar kilitli ve açıklama yönlendirir; platform varsa açılır", () => {
    render(baseProps({ hasProviders: false }));
    const sw = find("filter-toggle-platforms").findByType("Switch");
    expect(sw.props.disabled).toBe(true);
    expect(sw.props.value).toBe(false);
    expect(textsOf()).toContain(DISCOVER_FILTERS_COPY.tr.ui.onMyPlatformsNone);

    act(() => renderer.unmount());
    const props = baseProps({ hasProviders: true });
    render(props);
    const on = find("filter-toggle-platforms").findByType("Switch");
    expect(on.props.disabled).toBe(false);
    act(() => on.props.onValueChange(true));
    press("filter-sheet-apply");
    expect(lastApplied(props).onMyPlatforms).toBe(true);
  });

  test("kayıtlı süzgeçte 'platformlarımda' açık ama platform yoksa anahtar KAPALI gösterilir", () => {
    render(baseProps({ hasProviders: false, filters: normalizeFilters({ onMyPlatforms: true }, "movie") }));
    expect(find("filter-toggle-platforms").findByType("Switch").props.value).toBe(false);
  });

  test("izlediklerimi gizle", () => {
    const props = baseProps();
    render(props);
    act(() => find("filter-toggle-watched").findByType("Switch").props.onValueChange(true));
    press("filter-sheet-apply");
    expect(lastApplied(props).hideWatched).toBe(true);
  });
});

describe("kayıtlı süzgeçler", () => {
  const saved = [
    { id: "p1", name: "Komedi 7+", mediaType: "movie", filters: normalizeFilters({ genres: [35], minRating: 7 }, "movie") },
    { id: "p2", name: "Klasik", mediaType: "movie", filters: normalizeFilters({ era: "classic" }, "movie") },
  ];

  test("liste yoksa bölüm hiç çizilmez", () => {
    render(baseProps());
    expect(maybe("filter-saved-p1")).toBe(false);
  });

  test("kayıtlıya basmak taslağa yükler (uygulamaz), sil düğmesi kimliği bildirir", () => {
    const props = baseProps({ presets: saved });
    render(props);
    press("filter-saved-p1");
    expect(find("filter-genre-35").props.selected).toBe(true);
    expect(props.onApply).not.toHaveBeenCalled();
    press("filter-sheet-apply");
    expect(lastApplied(props)).toMatchObject({ genres: [35], minRating: 7 });
    press("filter-saved-remove-p2");
    expect(props.onDeletePreset).toHaveBeenCalledWith("p2");
  });

  test("kaydet düğmesi yalnız özelleştirilmiş taslakta görünür ve TASLAĞI iletir", () => {
    const props = baseProps();
    render(props);
    expect(maybe("filter-sheet-save")).toBe(false);
    press("filter-rating-7");
    expect(maybe("filter-sheet-save")).toBe(true);
    press("filter-sheet-save");
    expect(props.onSavePreset).toHaveBeenCalledWith(expect.objectContaining({ minRating: 7 }));
  });

  test("yalnız sıralama değişse de kaydedilebilir (özelleştirilmiş sayılır)", () => {
    render(baseProps());
    press("filter-sort-newest");
    expect(maybe("filter-sheet-save")).toBe(true);
  });
});

describe("hazır filtreler", () => {
  test("her hazır süzgeç için çip var; başlık üç dilde", () => {
    for (const dil of ["tr", "en", "es"]) {
      mockLang = dil;
      render(baseProps());
      QUICK_PRESETS.forEach((preset) => expect(maybe(`filter-quick-${preset.id}`)).toBe(true));
      expect(textsOf()).toContain(DISCOVER_FILTERS_COPY[dil].ui.quickTitle);
      act(() => renderer.unmount());
      renderer = null;
    }
  });

  test("basmak taslağa yükler (uygulamaz); 'Sonuçları göster' uygular", () => {
    const props = baseProps({ mediaType: "movie" });
    render(props);
    press("filter-quick-classics");
    expect(props.onApply).not.toHaveBeenCalled();
    expect(find("filter-era-classic").props.selected).toBe(true);
    expect(find("filter-rating-8").props.selected).toBe(true);
    press("filter-sheet-apply");
    expect(lastApplied(props)).toEqual(resolveQuickPreset("classics", "movie", { hasProviders: true }));
  });

  test("Dizi'de hazır süzgeç Dizi'ye göre çözülür (tür kimlikleri / süre bandı)", () => {
    const props = baseProps({ mediaType: "tv" });
    render(props);
    press("filter-quick-family");
    press("filter-sheet-apply");
    expect(lastApplied(props)).toEqual(resolveQuickPreset("family", "tv", { hasProviders: true }));
  });

  test("'Bu akşam' platform yoksa platform süzgecini açmaz, varsa açar", () => {
    const withProviders = baseProps({ hasProviders: true });
    render(withProviders);
    press("filter-quick-tonight");
    press("filter-sheet-apply");
    expect(lastApplied(withProviders).onMyPlatforms).toBe(true);
    act(() => renderer.unmount());
    const without = baseProps({ hasProviders: false });
    render(without);
    press("filter-quick-tonight");
    press("filter-sheet-apply");
    expect(lastApplied(without).onMyPlatforms).toBe(false);
  });

  test("hazır çip mevcut taslağı DEĞİŞTİRİR (üstüne eklemez)", () => {
    const props = baseProps({ filters: normalizeFilters({ genres: [35], language: "ko" }, "movie") });
    render(props);
    press("filter-quick-quick");
    press("filter-sheet-apply");
    expect(lastApplied(props)).toEqual(resolveQuickPreset("quick", "movie", { hasProviders: true }));
    expect(lastApplied(props).genres).toEqual([]);
  });
});
