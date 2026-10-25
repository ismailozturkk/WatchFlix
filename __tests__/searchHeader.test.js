// __tests__/searchHeader.test.js
//
// Film / dizi / oyuncu aramasının üst kısmı (screens/tabs/SearchScreen.js) ve ortak
// keşif çipleri (components/search/DiscoverCategoryChips.js). Gerçek ekran, gerçek cam
// bileşenleri (GlassField / GlassIconButton / GlassSegmentedControl / GlassTouchable);
// RN ana makine bileşenleri, bağlamlar ve alt arama ekranları taklit. Sınananlar: tür
// anahtarı doğru alt ekranı ve alan ipucunu getirir, alan içi eylem (bağlantı ↔
// temizle), görünüm anahtarının adı ve kaydı, odakta vurgu, beş dilde etiketler, cam
// açık/kapalı iki yolda çizim; çiplerde seçim, aynı çipe basmanın yok sayılması.

import React from "react";
import { act, create } from "react-test-renderer";

let mockLang = "en";
let mockGlass = "off";
const mockSet = jest.fn();
const mockSelection = jest.fn(() => Promise.resolve());
const mockTheme = {
  primary: "#101014",
  secondary: "#1C1C22",
  border: "#2A2A33",
  accent: "#4F8CFF",
  text: { primary: "#FFFFFF", secondary: "#B8B8C0", muted: "#7A7A85" },
};

jest.mock("react-native", () => {
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    interpolate() { return 0; }
  }
  const run = () => ({ start(cb) { if (cb) cb({ finished: true }); }, stop() {} });
  return {
    Animated: { Value, View: "AnimatedView", spring: run, timing: run, parallel: run },
    Easing: { out: (fn) => fn, cubic: 1 },
    I18nManager: { isRTL: false },
    Keyboard: { dismiss: () => {} },
    Platform: { OS: "ios", select: (o) => o.ios },
    Pressable: "Pressable",
    ScrollView: "ScrollView",
    StyleSheet: {
      create: (styles) => styles,
      flatten: (style) => [].concat(style).flat(Infinity).filter(Boolean).reduce((a, s) => ({ ...a, ...s }), {}),
      absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
      hairlineWidth: 0.5,
    },
    Text: "Text",
    TextInput: "TextInput",
    TouchableOpacity: "Touchable",
    View: "View",
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});
jest.mock("../components/typography/AppText", () => ({
  AppText: "Text",
  AppTextInput: "TextInput",
  AnimatedAppText: "Text",
  ReanimatedAppText: "Text",
}));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Ionicons" }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("../components/common/AdaptiveBlurView", () => ({ __esModule: true, default: "Blur" }));
jest.mock("../components/ScreenDecor", () => ({ __esModule: true, default: () => null }));
jest.mock("../components/toast/ScreenToastHost", () => ({ __esModule: true, default: () => null }));
jest.mock("../components/AppToast", () => ({ toast: { info: jest.fn() } }));
jest.mock("../screens/search/MovieSearch", () => ({ __esModule: true, default: "MovieSearch" }));
jest.mock("../screens/search/TvShowSearch", () => ({ __esModule: true, default: "TvShowSearch" }));
jest.mock("../screens/search/ActorSearch", () => ({ __esModule: true, default: "ActorSearch" }));
jest.mock("expo-clipboard", () => ({ getStringAsync: () => Promise.resolve("") }));
jest.mock("../services/mediaLinkResolver", () => ({ resolveMediaLink: () => Promise.resolve(null) }));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang, t: {} }) }));
jest.mock("../context/AppSettingsContext", () => ({ useApiSettings: () => ({ API_KEY: "k" }) }));
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => true }));
jest.mock("../services/hapticsService", () => ({ selectionAsync: (...args) => mockSelection(...args) }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
jest.mock("../services/storage", () => ({
  Keys: { searchResultsViewMode: "searchResultsViewMode" },
  get: () => "row",
  set: (...args) => mockSet(...args),
}));
jest.mock("react-native-safe-area-context", () => ({
  initialWindowMetrics: { insets: { top: 47 } },
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ canGoBack: () => true, goBack: () => {}, addListener: () => () => {} }),
}));
jest.mock("../services/liquidGlass", () => {
  const React = require("react");
  return {
    liquidGlassSupported: false,
    useLiquidGlass: () => mockGlass === "native",
    useGlassMode: () => mockGlass,
    useGlassShape: () => mockGlass !== "off",
    NativeGlassView: (props) => React.createElement("GlassView", props),
  };
});

const SearchScreen = require("../screens/tabs/SearchScreen").default;
const DiscoverCategoryChips = require("../components/search/DiscoverCategoryChips").default;
const { SEARCH_HEADER_COPY, CATEGORY_ICONS } = require("../components/search/searchHeaderCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let errorSpy;
let errors;
const copy = () => SEARCH_HEADER_COPY[mockLang];
const render = (element = <SearchScreen navigation={{ navigate: jest.fn() }} route={{ params: {} }} />) => {
  act(() => { renderer = create(element); });
};
const byId = (testID) => renderer.root.find((n) => n.props.testID === testID && typeof n.type === "string");
const all = (testID) => renderer.root.findAll((n) => n.props.testID === testID && typeof n.type === "string");
const input = () => renderer.root.findByType("TextInput");
const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
const subScreen = () =>
  renderer.root.findAll((n) => ["MovieSearch", "TvShowSearch", "ActorSearch"].includes(n.type)).map((n) => n.type);

beforeEach(() => {
  mockLang = "en";
  mockGlass = "off";
  mockSet.mockClear();
  mockSelection.mockClear();
  // React uyarıları (anahtar, geçersiz prop, act dışı güncelleme) test hatasıdır.
  errors = [];
  errorSpy = jest.spyOn(console, "error").mockImplementation((message) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    errors.push(String(message));
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  errorSpy.mockRestore();
  expect(errors).toEqual([]);
});

describe("tür anahtarı (Film · Dizi · Oyuncu)", () => {
  test("üç bölme kısa etiketlerle; başta Film seçili ve film araması çizili", () => {
    render();
    for (const id of ["movie", "tv", "actor"]) expect(byId(`search-type-${id}`)).toBeDefined();
    expect(byId("search-type-movie").props.accessibilityState).toEqual({ selected: true });
    expect(texts()).toEqual(expect.arrayContaining([copy().tabs.movie, copy().tabs.tv, copy().tabs.actor]));
    expect(subScreen()).toEqual(["MovieSearch"]);
    expect(input().props.placeholder).toBe(copy().placeholder.movie);
  });

  test("Dizi'ye basınca dizi araması ve ipucu gelir, seçim kayar; aynı bölme yok sayılır", () => {
    render();
    act(() => byId("search-type-tv").props.onPress());
    expect(subScreen()).toEqual(["TvShowSearch"]);
    expect(input().props.placeholder).toBe(copy().placeholder.tv);
    expect(byId("search-type-tv").props.accessibilityState).toEqual({ selected: true });
    expect(byId("search-type-movie").props.accessibilityState).toEqual({ selected: false });
    expect(mockSelection).toHaveBeenCalledTimes(1);
    act(() => byId("search-type-tv").props.onPress());
    expect(mockSelection).toHaveBeenCalledTimes(1);
    act(() => byId("search-type-actor").props.onPress());
    expect(subScreen()).toEqual(["ActorSearch"]);
    expect(input().props.placeholder).toBe(copy().placeholder.actor);
  });

  test("vurgu hapı genişlik ölçülünce çizilir (ilk karede yanlış yerde durmaz)", () => {
    render();
    const tablist = renderer.root.find((n) => n.props.accessibilityRole === "tablist" && n.type === "View");
    expect(tablist.findAllByType("LinearGradient")).toHaveLength(0);
    act(() => tablist.props.onLayout({ nativeEvent: { layout: { width: 350, height: 34 } } }));
    expect(tablist.findAllByType("LinearGradient")).toHaveLength(1);
    expect(tablist.props.accessibilityLabel).toBe(copy().typeLabel);
  });
});

describe("arama alanı", () => {
  test("boşken 'bağlantıdan aç', yazınca 'temizle'; temizle alanı boşaltır", () => {
    render();
    expect(all("search-paste-link")).toHaveLength(1);
    expect(all("search-clear")).toHaveLength(0);
    act(() => input().props.onChangeText("Dune"));
    expect(all("search-paste-link")).toHaveLength(0);
    expect(byId("search-clear").props.accessibilityLabel).toBe(copy().clear);
    expect(renderer.root.findByType("MovieSearch").props.unifiedQuery).toBe("Dune");
    act(() => byId("search-clear").props.onPress());
    expect(input().props.value).toBe("");
    expect(renderer.root.findByType("MovieSearch").props.unifiedQuery).toBe("");
  });

  test("odakta arama simgesi vurgu rengine döner", () => {
    render();
    const icon = () => renderer.root.findAll((n) => n.type === "AppIcon" && n.props.name === "search")[0];
    expect(icon().props.color).toBe(mockTheme.text.muted);
    act(() => input().props.onFocus());
    expect(icon().props.color).toBe(mockTheme.accent);
    act(() => input().props.onBlur());
    expect(icon().props.color).toBe(mockTheme.text.muted);
  });
});

describe("görünüm anahtarı", () => {
  test("adı yapacağı işi söyler ve seçim kaydedilir", () => {
    render();
    const toggle = () => byId("search-layout-toggle");
    expect(toggle().props.accessibilityLabel).toBe(copy().gridView);
    act(() => toggle().props.onPress());
    expect(mockSet).toHaveBeenCalledWith("searchResultsViewMode", "grid");
    expect(toggle().props.accessibilityLabel).toBe(copy().listView);
    expect(renderer.root.findByType("MovieSearch").props.unifiedViewMode).toBe("grid");
  });
});

describe("diller ve cam yolları", () => {
  test.each(["tr", "en", "es", "pt", "de"])("%s: bölme etiketleri ve ipucu çizilir", (dil) => {
    mockLang = dil;
    render();
    expect(texts()).toEqual(expect.arrayContaining(Object.values(copy().tabs)));
    expect(input().props.placeholder).toBe(copy().placeholder.movie);
  });

  test.each(["native", "frosted"])("cam (%s) yolunda da çizilir ve çalışır", (mod) => {
    mockGlass = mod;
    render();
    act(() => byId("search-type-actor").props.onPress());
    expect(subScreen()).toEqual(["ActorSearch"]);
  });
});

describe("keşif çipleri", () => {
  const renderChips = (props = {}) => {
    const onChange = jest.fn();
    render(
      <DiscoverCategoryChips
        categories={["popular", "upcoming", "topRated"]}
        labels={SEARCH_HEADER_COPY.en.categories}
        activeIndex={0}
        onChange={onChange}
        accessibilityLabel="Discover"
        {...props}
      />,
    );
    return onChange;
  };
  const chip = (id) => renderer.root.find((n) => n.props.testID === `discover-category-${id}` && n.props.onPress);

  test("seçili çip işaretli ve dolu simgeli; diğerleri çizgi simgeli", () => {
    renderChips();
    expect(chip("popular").props.accessibilityState).toEqual({ selected: true });
    expect(chip("upcoming").props.accessibilityState).toEqual({ selected: false });
    const icons = renderer.root.findAllByType("Ionicons").map((n) => n.props.name);
    expect(icons).toEqual(["flame", "calendar-outline", "star-outline"]);
    expect(texts()).toEqual(["Popular", "Upcoming", "Top rated"]);
  });

  test("başka çipe basmak sırasını bildirir; seçili çipe basmak yok sayılır", () => {
    const onChange = renderChips();
    act(() => chip("topRated").props.onPress());
    expect(onChange).toHaveBeenCalledWith(2);
    expect(mockSelection).toHaveBeenCalledTimes(1);
    act(() => chip("popular").props.onPress());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test("her kategori kimliğinin simgesi ve beş dilde etiketi var", () => {
    for (const dil of Object.keys(SEARCH_HEADER_COPY)) {
      expect(Object.keys(SEARCH_HEADER_COPY[dil].categories).sort()).toEqual(Object.keys(CATEGORY_ICONS).sort());
    }
  });
});
