import fs from "fs";
import path from "path";
import React from "react";
import { act, create } from "react-test-renderer";
import DiscoverSearchButton, {
  DISCOVER_SEARCH_HEIGHT,
  DISCOVER_SEARCH_RADIUS,
} from "../components/home/DiscoverSearchButton";
import DiscoverSearchHeader from "../components/home/DiscoverSearchHeader";
import usePullToRefresh, { PULL_MAX_SCALE } from "../hooks/usePullToRefresh";

// Film / Dizi ana ekranlarındaki arama düğmesi BAZEN HİÇ görünmüyordu. Kök neden
// (ayrıntı: components/home/DiscoverSearchButton.js başındaki not): Reanimated 4.5,
// animasyonlu stilin İLK değerini her React render'ında görünümün JS stiline geri
// yazıyor; eski düğmenin ilk değeri `opacity: 0` (giriş animasyonu) olduğu için,
// gerçek değeri geri getiren yerel kayıt boşalınca düğme yok kalıyordu.
//
// Burada kilitlenen şey o sınıfın tamamı:
//   • bu düğmedeki HER animasyonlu stilin ilk/dinlenme değeri görünür durumdur,
//   • bir görünüm en fazla bir animasyonlu stil taşır (transform anahtarı çakışmaz),
//   • başlık FlatList'e ELEMENT olarak verilir (kimliği değişince sökülmez).
// Gerçek çizim (cam, gölge, geçiş) cihazda doğrulanır.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockGlass = true;
let mockInsetsTop = 0;
const mockUseAnimatedStyle = jest.fn((updater) => updater());
const mockWithSpring = jest.fn((value) => value);
const mockTheme = {
  primary: "#111111",
  secondary: "#202020",
  border: "#333333",
  accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#cccccc", muted: "#888888" },
};

jest.mock("react-native", () => {
  const React = require("react");
  const resolve = (style, state) => (typeof style === "function" ? style(state) : style);
  return {
    View: "View",
    Text: "Text",
    Pressable: ({ style, children, ...rest }) =>
      React.createElement("Pressable", { ...rest, style: resolve(style, { pressed: false }) }, children),
    StyleSheet: {
      create: (styles) => styles,
      flatten: (style) => style,
      absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
    },
  };
});

// Babel eklentisi (scripts/babel-transform-app-text.js) `Text`'i AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const AnimatedView = React.forwardRef(({ children, ...rest }, ref) =>
    React.createElement("AnimatedView", { ...rest, ref }, children),
  );
  return {
    __esModule: true,
    default: { View: AnimatedView },
    useAnimatedStyle: (...args) => mockUseAnimatedStyle(...args),
    useSharedValue: (value) => ({ value }),
    withSpring: (...args) => mockWithSpring(...args),
    useAnimatedScrollHandler: (handler) => handler,
    Extrapolation: { CLAMP: "clamp" },
    interpolate: (value, [inMin, inMax], [outMin, outMax]) => {
      const t = Math.min(1, Math.max(0, (value - inMin) / (inMax - inMin)));
      return outMin + (outMax - outMin) * t;
    },
  };
});

jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("../components/AppIcon", () => {
  const React = require("react");
  return { __esModule: true, default: (props) => React.createElement("Icon", props) };
});
jest.mock("../components/common/AdaptiveBlurView", () => {
  const React = require("react");
  return { __esModule: true, default: (props) => React.createElement("AdaptiveBlurView", props) };
});
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../services/liquidGlass", () => {
  const React = require("react");
  return {
    useLiquidGlass: () => mockGlass,
    NativeGlassView: (props) => React.createElement("GlassView", props),
  };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: mockInsetsTop, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../context/TabBarLayoutContext", () => ({
  useTabBarLayout: () => ({ tabBarCollapse: null, tabBarLastScrollY: null }),
}));

const flat = (style) =>
  [].concat(style).flat(Infinity).filter(Boolean).reduce((acc, item) => ({ ...acc, ...item }), {});

function render(element, options) {
  let tree;
  act(() => {
    tree = create(element, options);
  });
  return tree;
}

const textOf = (root) =>
  root
    .findAllByType("Text")
    .map((node) => [].concat(node.props.children).join(""))
    .join("|");

beforeEach(() => {
  mockGlass = true;
  mockInsetsTop = 0;
  mockUseAnimatedStyle.mockClear();
  mockWithSpring.mockClear();
});

describe("DiscoverSearchButton — kaybolmama değişmezleri", () => {
  it("hiçbir animasyonlu görünümde opaklık yok; dinlenme ölçeği 1 (ilk değer görünür)", () => {
    const pull = { transform: [{ scale: 1 }] };
    const tree = render(<DiscoverSearchButton placeholder="Film Ara" onPress={() => {}} animatedStyle={pull} />);

    const animated = tree.root.findAllByType("AnimatedView");
    expect(animated.length).toBeGreaterThan(0);
    animated.forEach((node) => {
      const style = flat(node.props.style);
      expect(style).not.toHaveProperty("opacity");
      (style.transform ?? []).forEach((entry) => {
        Object.values(entry).forEach((value) => expect(value).toBe(1));
      });
    });
  });

  it("giriş / çıkış / yerleşim animasyonu (entering, exiting, layout) kullanılmaz", () => {
    const tree = render(<DiscoverSearchButton placeholder="Film Ara" onPress={() => {}} />);
    tree.root.findAllByType("AnimatedView").forEach((node) => {
      expect(node.props.entering).toBeUndefined();
      expect(node.props.exiting).toBeUndefined();
      expect(node.props.layout).toBeUndefined();
    });
  });

  it("düğme kendi içinde TEK animasyonlu stil tanımlar (kabuktaki ölçek dışarıdan gelir)", () => {
    render(<DiscoverSearchButton placeholder="Film Ara" onPress={() => {}} />);
    expect(mockUseAnimatedStyle).toHaveBeenCalledTimes(1);
  });

  it("kabuk YALNIZ dışarıdan gelen çekerek-yenile stilini taşır; basma stili iç kapta", () => {
    const pull = { transform: [{ scale: 1 }], marker: "pull" };
    const tree = render(<DiscoverSearchButton placeholder="Film Ara" onPress={() => {}} animatedStyle={pull} />);
    const [shell, inner] = tree.root.findAllByType("AnimatedView");
    expect(shell.props.style).toBe(pull);
    expect(inner.props.style).toEqual({ transform: [{ scale: 1 }] });
    expect(inner.props.style).not.toBe(pull);
  });

  it("kabuk ölçülebilir kalır (arama ekranı geçişi measureInWindow ister)", () => {
    const tree = render(<DiscoverSearchButton placeholder="Film Ara" onPress={() => {}} />);
    expect(tree.root.findAllByType("AnimatedView")[0].props.collapsable).toBe(false);
  });
});

describe("DiscoverSearchButton — içerik ve etkileşim", () => {
  it("etiketi, arama simgesini ve türe göre rozet simgesini çizer", () => {
    const movie = render(<DiscoverSearchButton placeholder="Film Ara" mediaType="movie" onPress={() => {}} />);
    expect(textOf(movie.root)).toBe("Film Ara");
    const movieIcons = movie.root.findAllByType("Icon").map((n) => `${n.props.family}:${n.props.name}`);
    expect(movieIcons).toEqual(["Ionicons:search", "MaterialCommunityIcons:movie-outline"]);

    const tv = render(<DiscoverSearchButton placeholder="Dizi Ara" mediaType="tv" onPress={() => {}} />);
    expect(textOf(tv.root)).toBe("Dizi Ara");
    const tvIcons = tv.root.findAllByType("Icon").map((n) => `${n.props.family}:${n.props.name}`);
    expect(tvIcons).toEqual(["Ionicons:search", "Feather:tv"]);
  });

  it("rozet simgesi vurgu üstünde BEYAZ", () => {
    const tree = render(<DiscoverSearchButton placeholder="Film Ara" onPress={() => {}} />);
    const badgeIcon = tree.root.findAllByType("Icon")[1];
    expect(badgeIcon.props.color).toBe("#FFFFFF");
  });

  it("dokunuş ve erişilebilirlik: etiketli düğme, onPress iletilir", () => {
    const onPress = jest.fn();
    const tree = render(<DiscoverSearchButton placeholder="Dizi Ara" onPress={onPress} />);
    const pressable = tree.root.findByType("Pressable");
    expect(pressable.props.accessibilityRole).toBe("button");
    expect(pressable.props.accessibilityLabel).toBe("Dizi Ara");
    pressable.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("basınca yaylanarak küçülür, bırakınca 1'e döner", () => {
    const tree = render(<DiscoverSearchButton placeholder="Film Ara" onPress={() => {}} />);
    const pressable = tree.root.findByType("Pressable");
    act(() => pressable.props.onPressIn());
    expect(mockWithSpring).toHaveBeenLastCalledWith(0.975, expect.any(Object));
    act(() => pressable.props.onPressOut());
    expect(mockWithSpring).toHaveBeenLastCalledWith(1, expect.any(Object));
  });
});

describe("DiscoverSearchButton — iki çizim yolu", () => {
  it("cam açık: tek cam katmanı, hap köşeli, sabit yükseklik, RN gölgesi/çerçevesi yok", () => {
    const tree = render(<DiscoverSearchButton placeholder="Film Ara" onPress={() => {}} />);
    const glass = tree.root.findAllByType("GlassView");
    expect(glass).toHaveLength(1);
    const glassStyle = flat(glass[0].props.style);
    expect(glassStyle.borderRadius).toBe(DISCOVER_SEARCH_RADIUS);
    expect(DISCOVER_SEARCH_RADIUS).toBe(DISCOVER_SEARCH_HEIGHT / 2);
    expect(glassStyle).not.toHaveProperty("shadowOpacity");
    expect(glassStyle).not.toHaveProperty("elevation");

    // GlassField kökü cam yolunda SABİT yükseklikte (esnek minHeight yalnız eski yolda).
    const field = tree.root
      .findAllByType("View")
      .map((node) => flat(node.props.style))
      .find((style) => style.height === DISCOVER_SEARCH_HEIGHT);
    expect(field).toBeDefined();
    expect(field).toMatchObject({ flexDirection: "row", alignItems: "center" });
  });

  it("cam kapalı (Android / iOS 18–25): tema yüzeyli, çerçeveli, gölgeli hap", () => {
    mockGlass = false;
    const tree = render(<DiscoverSearchButton placeholder="Film Ara" onPress={() => {}} />);
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);

    const box = tree.root
      .findAllByType("View")
      .map((node) => flat(node.props.style))
      .find((style) => style.backgroundColor === mockTheme.secondary);
    expect(box).toBeDefined();
    expect(box).toMatchObject({
      borderColor: mockTheme.border,
      borderWidth: 1,
      borderRadius: DISCOVER_SEARCH_RADIUS,
      minHeight: DISCOVER_SEARCH_HEIGHT,
    });
    expect(box.shadowOpacity).toBeGreaterThan(0);
  });
});

describe("DiscoverSearchHeader", () => {
  const makeNavigation = () => ({ navigate: jest.fn() });

  it("üst boşluk güvenli alana bağlı; alan 0 olsa da eski 50'nin altına inmez", () => {
    mockInsetsTop = 0;
    let tree = render(<DiscoverSearchHeader navigation={makeNavigation()} mediaType="movie" placeholder="Film Ara" />);
    expect(flat(tree.root.findAllByType("View")[0].props.style).paddingTop).toBe(50);

    mockInsetsTop = 59; // Dynamic Island
    tree = render(<DiscoverSearchHeader navigation={makeNavigation()} mediaType="movie" placeholder="Film Ara" />);
    expect(flat(tree.root.findAllByType("View")[0].props.style).paddingTop).toBe(75);
  });

  it("dokununca düğmenin konumunu ve köşesini taşıyarak arama ekranını açar", () => {
    const navigation = makeNavigation();
    const tree = render(
      <DiscoverSearchHeader navigation={navigation} mediaType="tv" placeholder="Dizi Ara" />,
      { createNodeMock: () => ({ measureInWindow: (cb) => cb(15, 96, 345, 52) }) },
    );
    act(() => tree.root.findByType("Pressable").props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("UnifiedSearch", {
      initialType: "tv",
      autoFocus: true,
      searchOrigin: { x: 15, y: 96, width: 345, height: 52, radius: DISCOVER_SEARCH_RADIUS },
    });
  });

  it("ölçüm yoksa yine açar (geçişsiz)", () => {
    const navigation = makeNavigation();
    const tree = render(<DiscoverSearchHeader navigation={navigation} mediaType="movie" placeholder="Film Ara" />);
    act(() => tree.root.findByType("Pressable").props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("UnifiedSearch", {
      initialType: "movie",
      autoFocus: true,
      searchOrigin: undefined,
    });
  });

  it("yeniden çizimde (üst boşluk / yer tutucu değişince) düğme SÖKÜLMEZ, yerinde güncellenir", () => {
    const navigation = makeNavigation();
    const tree = render(<DiscoverSearchHeader navigation={navigation} mediaType="movie" placeholder="Film Ara" />);
    const before = tree.root.findByType("Pressable");
    mockInsetsTop = 47;
    act(() => {
      tree.update(<DiscoverSearchHeader navigation={navigation} mediaType="movie" placeholder="Search Movies" />);
    });
    expect(tree.root.findByType("Pressable")).toBe(before);
    expect(textOf(tree.root)).toBe("Search Movies");
  });
});

describe("usePullToRefresh — arama çubuğu stili", () => {
  function Probe({ onValue }) {
    onValue(usePullToRefresh(() => Promise.resolve()));
    return null;
  }

  it("dinlenmede kimlik: tek eşit yönlü scale 1, opaklık / köşe animasyonu yok", () => {
    let hook;
    render(<Probe onValue={(value) => (hook = value)} />);
    expect(hook.animatedSearchStyle).toEqual({ transform: [{ scale: 1 }] });
  });

  it("tam çekilince eşit yönlü büyür (metin / simge dikeyde ezilmez)", () => {
    expect(PULL_MAX_SCALE).toBeGreaterThan(1);
    expect(PULL_MAX_SCALE).toBeLessThan(1.1);
  });
});

describe("Film / Dizi ekranları — başlık ELEMENT olarak verilir", () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

  test.each([
    ["screens/tabs/MovieScreen.js", "movie"],
    ["screens/tabs/TvShowScreen.js", "tv"],
  ])("%s", (file, mediaType) => {
    const source = read(file);
    // Geri çağrı (`() => <… />`) FlatList'te bileşen tipi sayılır: kimliği
    // değişince başlık söküp yeniden kurulur ve düğme sıfırdan başlar.
    expect(source).toContain("ListHeaderComponent={searchHeader}");
    expect(source).not.toMatch(/ListHeaderComponent=\{renderHeader\}/);
    expect(source).not.toMatch(/const renderHeader/);
    expect(source).toMatch(/const searchHeader = useMemo\(/);
    expect(source).toContain(`mediaType="${mediaType}"`);
    // Eski kopyalanmış mantık geri gelmesin.
    expect(source).not.toMatch(/searchInputRef|SEARCH_TOP_PADDING_MIN|fakeSearchContainer/);
  });
});
