// __tests__/discoverScreen.test.js
//
// Film + Dizi TEK sekme (screens/tabs/DiscoverScreen.js): hangi bölümün kurulduğu,
// geçişte sayfaların sökülmeden gizlenmesi, saklanan tercih ve alt çubuğun kaydırma
// durumunun sıfırlanması, keşfet ve arama düğmelerinin anahtarın iki yanında SİMETRİK durması ve dar
// ekranda anahtarın daralması. Listelerin kendisi
// (TvShowScreen/MovieScreen) taklit edilir; onların başlığı için bkz. discoverSearchAction.test.js.
import React from "react";
import { act, create } from "react-test-renderer";
import DiscoverScreen, { DISCOVER_HEADER_OFFSET, WARM_OTHER_MEDIA_MS } from "../screens/tabs/DiscoverScreen";
import { TabBarLayoutContext } from "../context/TabBarLayoutContext";
import { TAB_BAR_SCROLL_UNSET } from "../utils/tabBarCollapse";
import { DEFAULT_MEDIA_TYPE, MEDIA_TYPES, normalizeMediaType } from "../utils/discoverMedia";

let mockStored = "tv";
let mockWidth = 390;
let mockGlass = true;
const mockSet = jest.fn();
jest.mock("react-native", () => ({
  View: "View",
  useWindowDimensions: () => ({ width: mockWidth, height: 800 }),
  StyleSheet: { create: (s) => s, absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 } },
  InteractionManager: { runAfterInteractions: (fn) => { fn(); return { cancel: jest.fn() }; } },
}));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) }));
jest.mock("react-native-reanimated", () => ({ withTiming: (value) => value }));
jest.mock("../services/storage", () => ({
  Keys: { homeMediaType: "homeMediaType" },
  get: () => mockStored,
  set: (...args) => mockSet(...args),
}));
jest.mock("../services/liquidGlass", () => ({
  useLiquidGlass: () => mockGlass,
  useGlassMode: () => (mockGlass ? "native" : "off"),
  useGlassShape: () => mockGlass,
}));
jest.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({
    language: "tr",
    t: { tvShows: "Diziler", movies: "Filmler", SearchScreen: { searchTvShows: "Dizi Ara", searchMovies: "Film Ara" } },
  }),
}));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: { primary: "#101010" } }) }));
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => false }));
jest.mock("../context/MovieContex", () => ({ MovieProvider: ({ children }) => children }));
jest.mock("../screens/tabs/TvShowScreen", () => ({ __esModule: true, default: "TvPage" }));
jest.mock("../screens/tabs/MovieScreen", () => ({ __esModule: true, default: "MoviePage" }));
jest.mock("../components/home/MediaTypeSwitch", () => ({ __esModule: true, default: "Switch", MEDIA_SWITCH_HEIGHT: 46 }));
jest.mock("../components/home/DiscoverSearchAction", () => ({
  __esModule: true,
  default: "SearchAction",
  discoverSearchActionSize: (glass) => (glass ? 46 : 48),
}));
jest.mock("../components/home/DiscoverExploreAction", () => ({ __esModule: true, default: "ExploreAction" }));
jest.mock("../components/home/DiscoverHeaderSpacer", () => ({ DISCOVER_TOP_MIN: 50 }));

global.IS_REACT_ACT_ENVIRONMENT = true;

const navigation = { navigate: jest.fn() };
let renderer;
let layout;

function render() {
  layout = { tabBarCollapse: { value: 0.7 }, tabBarLastScrollY: { value: 120 }, contentBottom: 110 };
  act(() => {
    renderer = create(
      <TabBarLayoutContext.Provider value={layout}>
        <DiscoverScreen navigation={navigation} />
      </TabBarLayoutContext.Provider>,
    );
  });
}
const pageOf = (type) => renderer.root.findAll((node) => node.props.testID === `discover-page-${type}` && node.type === "View");
const isHidden = (type) => pageOf(type)[0].props.style.display === "none";
const select = (type) => act(() => renderer.root.findByType("Switch").props.onChange(type));

let warn;
beforeEach(() => {
  jest.useFakeTimers();
  mockStored = "tv";
  mockWidth = 390;
  mockGlass = true;
  mockSet.mockClear();
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
  jest.useRealTimers();
});

describe("Film/Dizi bölüm değerleri", () => {
  it("iki bölüm var ve varsayılan Dizi (eskiden ilk sekme Diziydi)", () => {
    expect(MEDIA_TYPES).toEqual(["tv", "movie"]);
    expect(DEFAULT_MEDIA_TYPE).toBe("tv");
  });
  it.each([undefined, null, "", "series", "movies", 3, {}])("bozuk saklanan değer %p varsayılana düşer", (value) => {
    expect(normalizeMediaType(value)).toBe("tv");
  });
  it.each(["tv", "movie"])("geçerli değer %s korunur", (value) => {
    expect(normalizeMediaType(value)).toBe(value);
  });
});

describe("DiscoverScreen", () => {
  it("açılışta YALNIZ görünen bölümü kurar (Dizi)", () => {
    render();
    expect(pageOf("tv")).toHaveLength(1);
    expect(pageOf("movie")).toHaveLength(0);
    expect(isHidden("tv")).toBe(false);
  });

  it("son seçilen bölümle açılır (Film saklıysa Dizi hiç kurulmaz)", () => {
    mockStored = "movie";
    render();
    expect(pageOf("movie")).toHaveLength(1);
    expect(pageOf("tv")).toHaveLength(0);
    expect(isHidden("movie")).toBe(false);
  });

  it("bozuk saklanan değerle Dizi'ye düşer", () => {
    mockStored = "garip";
    render();
    expect(pageOf("tv")).toHaveLength(1);
    expect(pageOf("movie")).toHaveLength(0);
  });

  it("geçiş öteki bölümü kurar, öncekini SÖKMEDEN gizler ve seçimi saklar", () => {
    render();
    const tvPage = renderer.root.findByType("TvPage");
    select("movie");
    expect(pageOf("movie")).toHaveLength(1);
    expect(isHidden("movie")).toBe(false);
    expect(isHidden("tv")).toBe(true);
    // Dizi sayfası aynı örnek: kaydırma konumu ve raflar korunur.
    expect(renderer.root.findByType("TvPage")).toBe(tvPage);
    expect(mockSet).toHaveBeenCalledWith("homeMediaType", "movie");
    select("tv");
    expect(isHidden("tv")).toBe(false);
    expect(isHidden("movie")).toBe(true);
    expect(mockSet).toHaveBeenLastCalledWith("homeMediaType", "tv");
  });

  it("bozuk bir geçiş değeri Dizi'ye çekilir, sayfa durumu bozulmaz", () => {
    render();
    select("garip");
    expect(isHidden("tv")).toBe(false);
    expect(mockSet).toHaveBeenCalledWith("homeMediaType", "tv");
  });

  it("geçişte alt çubuğun kaydırma taban çizgisi sıfırlanır ve çubuk açılır", () => {
    render();
    select("movie");
    expect(layout.tabBarLastScrollY.value).toBe(TAB_BAR_SCROLL_UNSET);
    expect(layout.tabBarCollapse.value).toBe(0);
  });

  it("öteki bölüm bir süre sonra arka planda ısıtılır (ilk geçişte boş sayfa görünmez)", () => {
    render();
    expect(pageOf("movie")).toHaveLength(0);
    act(() => { jest.advanceTimersByTime(WARM_OTHER_MEDIA_MS - 1); });
    expect(pageOf("movie")).toHaveLength(0);
    act(() => { jest.advanceTimersByTime(2); });
    expect(pageOf("movie")).toHaveLength(1);
    // Isıtılan sayfa görünmez kalır.
    expect(isHidden("movie")).toBe(true);
    expect(isHidden("tv")).toBe(false);
  });

  it("ilk raf yüzen satırın (anahtar + arama düğmesi) altından başlasın diye iki listeye de yer payı verilir", () => {
    render();
    act(() => { jest.advanceTimersByTime(WARM_OTHER_MEDIA_MS + 1); });
    expect(renderer.root.findByType("TvPage").props.headerTopOffset).toBe(DISCOVER_HEADER_OFFSET);
    expect(renderer.root.findByType("MoviePage").props.headerTopOffset).toBe(DISCOVER_HEADER_OFFSET);
    expect(DISCOVER_HEADER_OFFSET).toBeGreaterThan(46);
  });

  it("anahtar çevrilmiş etiketlerle ve güvenli alana bağlı üst boşlukla çizilir", () => {
    render();
    const sw = renderer.root.findByType("Switch");
    expect(sw.props.labels).toEqual({ tv: "Diziler", movie: "Filmler" });
    expect(sw.props.value).toBe("tv");
    // Üst boşluk: güvenli alan (47) + 16 = 63; sabit 50 tabanının altına inmez.
    const layer = sw.parent;
    expect(layer.props.style[1].top).toBe(63);
    expect(layer.props.pointerEvents).toBe("box-none");
  });

  it("keşfet ve arama düğmeleri anahtarla AYNI yüzen satırda, iki yanında SİMETRİK durur", () => {
    render();
    const sw = renderer.root.findByType("Switch");
    const search = renderer.root.findByType("SearchAction");
    const explore = renderer.root.findByType("ExploreAction");
    expect(search.parent).toBe(sw.parent);
    expect(explore.parent).toBe(sw.parent);
    // Soldan sağa: keşfet, anahtar, arama — satır olarak ortalanır.
    const siblings = sw.parent.children.map((child) => child.type);
    expect(siblings).toEqual(["ExploreAction", "Switch", "SearchAction"]);
    expect(sw.parent.props.style[0]).toMatchObject({ flexDirection: "row", justifyContent: "center", alignItems: "center" });
    expect(sw.parent.props.style[0].gap).toBeGreaterThan(0);
  });

  it("keşfet düğmesi seçili bölümün türüyle ve 'Ne izlesem?' etiketiyle açılır; geçişte güncellenir", () => {
    render();
    const props = () => renderer.root.findByType("ExploreAction").props;
    expect(props()).toMatchObject({ navigation, mediaType: "tv", label: "Ne izlesem?" });
    select("movie");
    expect(props()).toMatchObject({ navigation, mediaType: "movie", label: "Ne izlesem?" });
  });

  it("iki sayfada ayrı keşfet düğmesi yok: tek", () => {
    render();
    act(() => { jest.advanceTimersByTime(WARM_OTHER_MEDIA_MS + 1); });
    expect(renderer.root.findAllByType("ExploreAction")).toHaveLength(1);
  });

  it.each([
    [412, 112],
    [390, 112],
    [375, 112],
    [360, 108],
    [320, 88],
  ])("ekran %s pt: anahtarın bölme genişliği %s (üç öğe birden sığar)", (width, segment) => {
    mockWidth = width;
    render();
    expect(renderer.root.findByType("Switch").props.segmentWidth).toBe(segment);
  });

  it("cam olmayan yolda (düğmeler 48) bölme biraz daha dar", () => {
    mockWidth = 360;
    mockGlass = false;
    render();
    expect(renderer.root.findByType("Switch").props.segmentWidth).toBe(105);
  });

  it("ekran döndürülünce / genişlik değişince bölme genişliği yeniden hesaplanır", () => {
    mockWidth = 320;
    render();
    expect(renderer.root.findByType("Switch").props.segmentWidth).toBe(88);
    mockWidth = 412;
    act(() => {
      renderer.update(
        <TabBarLayoutContext.Provider value={layout}>
          <DiscoverScreen navigation={navigation} />
        </TabBarLayoutContext.Provider>,
      );
    });
    expect(renderer.root.findByType("Switch").props.segmentWidth).toBe(112);
  });

  it("arama düğmesi seçili bölümün türüyle ve etiketiyle açılır; geçişte güncellenir", () => {
    render();
    const props = () => renderer.root.findByType("SearchAction").props;
    expect(props()).toMatchObject({ navigation, mediaType: "tv", label: "Dizi Ara" });
    select("movie");
    expect(props()).toMatchObject({ navigation, mediaType: "movie", label: "Film Ara" });
    select("tv");
    expect(props()).toMatchObject({ mediaType: "tv", label: "Dizi Ara" });
  });

  it("arama düğmesi tek: iki sayfada ayrı arama başlığı yok (listelerin başlığı yalnız boşluk)", () => {
    render();
    act(() => { jest.advanceTimersByTime(WARM_OTHER_MEDIA_MS + 1); });
    expect(renderer.root.findAllByType("SearchAction")).toHaveLength(1);
  });

  it("liste sayfaları ekranı kaplar ve gizli olan düzen kaplamaz (display none)", () => {
    render();
    act(() => { jest.advanceTimersByTime(WARM_OTHER_MEDIA_MS + 1); });
    expect(pageOf("tv")[0].props.style.position).toBe("absolute");
    expect(pageOf("movie")[0].props.style).toMatchObject({ position: "absolute", display: "none" });
  });
});
