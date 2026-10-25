// Film / Dizi ana ekranının arama düğmesi (components/home/DiscoverSearchAction.js): Film/Dizi
// anahtarının YANINDA duran yuvarlak cam düğme. Eskiden listelerin başında tam genişlikte
// arama hapı (DiscoverSearchHeader) vardı; liste başlığı artık yalnız boşluk
// (DiscoverHeaderSpacer). Gerçek çizim (cam, gölge, açılış geçişi) cihazda doğrulanır; burada
// davranış kilitlenir: arama ekranı doğru tür + konum + köşeyle açılır, iki çizim yolunda boyut
// anahtarla hizalı, liste başlığı bir ELEMENT.
import fs from "fs";
import path from "path";
import React from "react";
import { act, create } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockGlass = true;
let mockInsetsTop = 0;
const mockTheme = {
  primary: "#101010",
  secondary: "#202020",
  border: "#333333",
  accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#cccccc", muted: "#888888" },
};

jest.mock("react-native", () => ({ View: "View", StyleSheet: { create: (s) => s } }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: mockInsetsTop, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("react-native-reanimated", () => ({ useAnimatedScrollHandler: (handler) => handler }));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../services/liquidGlass", () => ({
  useLiquidGlass: () => mockGlass,
  useGlassMode: () => (mockGlass ? "native" : "off"),
  useGlassShape: () => mockGlass,
}));
jest.mock("../components/common/GlassIconButton", () => {
  const React = require("react");
  return { __esModule: true, default: (props) => React.createElement("IconButton", props) };
});
jest.mock("../components/common/GlassField", () => ({ GLASS_FIELD_TINT_ALPHA: 0.55 }));
jest.mock("../components/home/MediaTypeSwitch", () => ({ MEDIA_SWITCH_HEIGHT: 46 }));
jest.mock("../context/TabBarLayoutContext", () => ({
  useTabBarLayout: () => ({ tabBarCollapse: null, tabBarLastScrollY: null }),
}));

const DiscoverSearchAction = require("../components/home/DiscoverSearchAction").default;
const { DISCOVER_SEARCH_ACTION_SIZE, discoverSearchActionSize } = require("../components/home/DiscoverSearchAction");
const DiscoverHeaderSpacer = require("../components/home/DiscoverHeaderSpacer").default;
const { DISCOVER_TOP_MIN, discoverHeaderHeight } = require("../components/home/DiscoverHeaderSpacer");
const usePullToRefresh = require("../hooks/usePullToRefresh").default;

function render(element, options) {
  let tree;
  act(() => {
    tree = create(element, options);
  });
  return tree;
}

let warn;
beforeEach(() => {
  mockGlass = true;
  mockInsetsTop = 0;
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => warn.mockRestore());

const makeNavigation = () => ({ navigate: jest.fn() });
const button = (tree) => tree.root.findByType("IconButton");

describe("DiscoverSearchAction — görünüm", () => {
  it("arama simgeli, etiketli yuvarlak düğme; testID ile bulunur", () => {
    const tree = render(<DiscoverSearchAction navigation={makeNavigation()} mediaType="movie" label="Film Ara" />);
    expect(button(tree).props).toMatchObject({
      icon: "search",
      accessibilityLabel: "Film Ara",
      testID: "discover-search-button",
    });
  });

  it("cam açık: çap anahtarın yüksekliği (46) ve tam yuvarlak; cam tonu GlassField ile aynı", () => {
    const props = button(render(<DiscoverSearchAction navigation={makeNavigation()} mediaType="tv" label="Dizi Ara" />)).props;
    expect(DISCOVER_SEARCH_ACTION_SIZE).toBe(46);
    expect(props.size).toBe(46);
    expect(props.fallbackRadius).toBe(23);
    // Ton: tema yüzeyi, GlassField'ın dinlenme opaklığıyla (0.55) — anahtarla aynı cam.
    expect(props.tint).toBe("rgba(32, 32, 32, 0.55)");
  });

  it("cam kapalı (Android / iOS 18–25): anahtarın 1 px çerçevesi 2 px eklediği için daire 2 px büyük", () => {
    mockGlass = false;
    const props = button(render(<DiscoverSearchAction navigation={makeNavigation()} mediaType="tv" label="Dizi Ara" />)).props;
    expect(props.size).toBe(48);
    expect(props.fallbackRadius).toBe(24);
    expect(props.fallbackStyle).toMatchObject({
      backgroundColor: mockTheme.secondary,
      borderColor: mockTheme.border,
      borderWidth: 1,
    });
    expect(props.fallbackStyle.shadowOpacity).toBeGreaterThan(0);
  });

  it("çap hesabı iki yolu da kapsar", () => {
    expect(discoverSearchActionSize(true)).toBe(46);
    expect(discoverSearchActionSize(false)).toBe(48);
  });

  it("düğmede opaklık / giriş animasyonu yok (cam kuralı + Reanimated ilk-değer kuralı)", () => {
    const tree = render(<DiscoverSearchAction navigation={makeNavigation()} mediaType="tv" label="Dizi Ara" />);
    const src = fs.readFileSync(path.join(__dirname, "..", "components/home/DiscoverSearchAction.js"), "utf8");
    expect(src).not.toMatch(/react-native-reanimated|opacity|entering|exiting/);
    expect(tree.root.findAllByType("View")).toHaveLength(1); // yalnız ölçülebilir kabuk
    expect(tree.root.findByType("View").props.collapsable).toBe(false);
  });
});

describe("DiscoverSearchAction — arama ekranını açma", () => {
  const measured = (cb) => ({ createNodeMock: () => ({ measureInWindow: cb }) });

  it("dokununca düğmenin konumunu ve yuvarlak köşesini taşıyarak seçili türle açar", () => {
    const navigation = makeNavigation();
    const tree = render(
      <DiscoverSearchAction navigation={navigation} mediaType="tv" label="Dizi Ara" />,
      measured((cb) => cb(251, 59, 46, 46)),
    );
    act(() => button(tree).props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("UnifiedSearch", {
      initialType: "tv",
      autoFocus: true,
      searchOrigin: { x: 251, y: 59, width: 46, height: 46, radius: 23 },
    });
  });

  it("cam kapalıyken köşe yarıçapı 24 (daire 48)", () => {
    mockGlass = false;
    const navigation = makeNavigation();
    const tree = render(
      <DiscoverSearchAction navigation={navigation} mediaType="movie" label="Film Ara" />,
      measured((cb) => cb(250, 58, 48, 48)),
    );
    act(() => button(tree).props.onPress());
    expect(navigation.navigate.mock.calls[0][1].searchOrigin).toEqual({ x: 250, y: 58, width: 48, height: 48, radius: 24 });
  });

  it("tür değişince arama o türle açılır (anahtar Film'e geçti)", () => {
    const navigation = makeNavigation();
    const tree = render(
      <DiscoverSearchAction navigation={navigation} mediaType="tv" label="Dizi Ara" />,
      measured((cb) => cb(0, 0, 46, 46)),
    );
    act(() => {
      tree.update(<DiscoverSearchAction navigation={navigation} mediaType="movie" label="Film Ara" />);
    });
    act(() => button(tree).props.onPress());
    expect(navigation.navigate.mock.calls[0][1].initialType).toBe("movie");
    expect(button(tree).props.accessibilityLabel).toBe("Film Ara");
  });

  it("ölçüm yoksa yine açar (geçişsiz)", () => {
    const navigation = makeNavigation();
    const tree = render(<DiscoverSearchAction navigation={navigation} mediaType="movie" label="Film Ara" />);
    act(() => button(tree).props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("UnifiedSearch", {
      initialType: "movie",
      autoFocus: true,
      searchOrigin: undefined,
    });
  });
});

describe("DiscoverHeaderSpacer", () => {
  it("yükseklik = güvenli alana bağlı üst boşluk + yüzen satırın payı; alan 0 olsa da 50'nin altına inmez", () => {
    expect(DISCOVER_TOP_MIN).toBe(50);
    expect(discoverHeaderHeight(0, 58)).toBe(50 + 58);
    expect(discoverHeaderHeight(59, 58)).toBe(75 + 58); // Dynamic Island: 59 + 16
    expect(discoverHeaderHeight(undefined)).toBe(50);
    expect(discoverHeaderHeight(-4, 0)).toBe(50);
  });

  it("boş, dokunuş geçiren bir kap çizer (listeyle yarışmaz)", () => {
    mockInsetsTop = 47;
    const tree = render(<DiscoverHeaderSpacer topOffset={58} />);
    const view = tree.root.findByType("View");
    expect(view.props.pointerEvents).toBe("none");
    expect(view.props.style).toEqual({ height: 63 + 58 });
    expect(view.children).toHaveLength(0);
  });

  it("yeniden çizimde (üst boşluk değişince) kap SÖKÜLMEZ, yerinde güncellenir", () => {
    const tree = render(<DiscoverHeaderSpacer topOffset={58} />);
    const before = tree.root.findByType("View");
    mockInsetsTop = 59;
    act(() => {
      tree.update(<DiscoverHeaderSpacer topOffset={58} />);
    });
    expect(tree.root.findByType("View")).toBe(before);
    expect(before.props.style).toEqual({ height: 75 + 58 });
  });
});

describe("Film / Dizi liste ekranları", () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

  test.each(["screens/tabs/MovieScreen.js", "screens/tabs/TvShowScreen.js"])("%s", (file) => {
    const source = read(file);
    // Başlık ELEMENT olarak verilir: geri çağrı FlatList'te bileşen tipi sayılır, kimliği
    // değişince başlık sökülüp yeniden kurulurdu.
    expect(source).toContain("ListHeaderComponent={listHeader}");
    expect(source).toMatch(/const listHeader = useMemo\(/);
    expect(source).toContain("<DiscoverHeaderSpacer topOffset={headerTopOffset} />");
    expect(source).not.toMatch(/ListHeaderComponent=\{renderHeader\}/);
    // Arama hapı listelerden kalktı (anahtarın yanındaki tek düğme açıyor).
    expect(source).not.toMatch(/DiscoverSearchHeader|DiscoverSearchButton|animatedSearchStyle|searchHeader/);
    // Eski kopyalanmış mantık geri gelmesin.
    expect(source).not.toMatch(/searchInputRef|SEARCH_TOP_PADDING_MIN|fakeSearchContainer/);
  });

  it("eski arama hapı bileşenleri silindi (ölü kod kalmasın)", () => {
    ["components/home/DiscoverSearchButton.js", "components/home/DiscoverSearchHeader.js"].forEach((file) => {
      expect(fs.existsSync(path.join(__dirname, "..", file))).toBe(false);
    });
  });
});

describe("usePullToRefresh", () => {
  function Probe({ onValue }) {
    onValue(usePullToRefresh(() => Promise.resolve()));
    return null;
  }

  it("yenileme durumunu ve kaydırma işleyicisini verir; arama çubuğu ölçeği artık yok", () => {
    let hook;
    render(<Probe onValue={(value) => (hook = value)} />);
    expect(Object.keys(hook).sort()).toEqual(["handleRefresh", "onScroll", "refreshing"]);
    expect(hook.refreshing).toBe(false);
  });

  it("aşağı çekmek (negatif kaydırma) işleyicide hata vermez", () => {
    let hook;
    render(<Probe onValue={(value) => (hook = value)} />);
    expect(() => hook.onScroll({ contentOffset: { y: -80 } })).not.toThrow();
    expect(() => hook.onScroll({ contentOffset: { y: 240 } })).not.toThrow();
  });

  it("handleRefresh yenileme işlevini çağırır ve bitince durumu kapatır", async () => {
    const onRefresh = jest.fn(() => Promise.resolve());
    let hook;
    function Local() {
      hook = usePullToRefresh(onRefresh);
      return null;
    }
    render(<Local />);
    await act(async () => {
      await hook.handleRefresh();
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(hook.refreshing).toBe(false);
  });
});
