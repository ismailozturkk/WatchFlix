// __tests__/discoverExploreAction.test.js
//
// Film/Dizi ana ekranının keşfet düğmesi (components/home/DiscoverExploreAction.js): arama düğmesiyle AYNI
// kabukta tek simgeli yuvarlak düğme; "Ne izlesem?" ekranını seçili türle açar.
import fs from "fs";
import path from "path";
import React from "react";
import { act, create } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockGlass = true;
const mockTheme = {
  primary: "#101010",
  secondary: "#202020",
  border: "#333333",
  accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#cccccc", muted: "#888888" },
};

jest.mock("react-native", () => ({ View: "View", StyleSheet: { create: (s) => s } }));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../services/liquidGlass", () => ({ useLiquidGlass: () => mockGlass }));
jest.mock("../components/common/GlassIconButton", () => {
  const React = require("react");
  return { __esModule: true, default: (props) => React.createElement("IconButton", props) };
});
jest.mock("../components/common/GlassField", () => ({ GLASS_FIELD_TINT_ALPHA: 0.55 }));
jest.mock("../components/home/MediaTypeSwitch", () => ({ MEDIA_SWITCH_HEIGHT: 46 }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../context/TabBarLayoutContext", () => ({ useTabBarLayout: () => ({}) }));

const DiscoverExploreAction = require("../components/home/DiscoverExploreAction").default;
const { discoverActionStyle, discoverSearchActionSize } = require("../components/home/DiscoverSearchAction");
const { DISCOVER_FILTERS_ROUTE } = require("../utils/discoverFilters");

let tree;
let warn;
beforeEach(() => {
  mockGlass = true;
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = null;
  warn.mockRestore();
});

const render = (props) => act(() => { tree = create(<DiscoverExploreAction {...props} />); });
const button = () => tree.root.findByType("IconButton");

describe("görünüm", () => {
  test("pusula simgeli, etiketli yuvarlak düğme; testID ile bulunur", () => {
    render({ navigation: { navigate: jest.fn() }, mediaType: "tv", label: "Ne izlesem?" });
    expect(button().props).toMatchObject({
      icon: "compass-outline",
      accessibilityLabel: "Ne izlesem?",
      testID: "discover-explore-button",
    });
  });

  test("boyut arama düğmesiyle AYNI (iki yanda simetrik): cam 46, cam olmayan 48; tam yuvarlak", () => {
    render({ navigation: {}, mediaType: "tv", label: "x" });
    expect(button().props.size).toBe(discoverSearchActionSize(true));
    expect(button().props.fallbackRadius).toBe(23);
    act(() => tree.unmount());
    mockGlass = false;
    render({ navigation: {}, mediaType: "tv", label: "x" });
    expect(button().props.size).toBe(discoverSearchActionSize(false));
    expect(button().props.size).toBe(48);
    expect(button().props.fallbackRadius).toBe(24);
  });

  test("cam tonu ve cam olmayan kutu arama düğmesiyle BİREBİR aynı kaynaktan (discoverActionStyle)", () => {
    render({ navigation: {}, mediaType: "tv", label: "x" });
    const expected = discoverActionStyle(mockTheme);
    expect(button().props.tint).toBe(expected.tint);
    expect(button().props.fallbackStyle).toEqual(expected.fallbackStyle);
    expect(expected.tint).toBe("rgba(32, 32, 32, 0.55)");
    expect(expected.fallbackStyle).toMatchObject({ backgroundColor: "#202020", borderColor: "#333333", borderWidth: 1 });
  });

  test("düğmede opaklık / giriş animasyonu yok (cam kuralı + Reanimated ilk-değer kuralı)", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "components/home/DiscoverExploreAction.js"), "utf8");
    // Yorumlar çıkarılır: yasağı anlatan metin testi kırmasın, gerçek kod kırsın.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/react-native-reanimated|opacity|entering|exiting/);
  });
});

describe("ekranı açma", () => {
  test.each(["tv", "movie"])("dokununca 'Ne izlesem?' ekranını %s türüyle açar", (mediaType) => {
    const navigate = jest.fn();
    render({ navigation: { navigate }, mediaType, label: "x" });
    act(() => button().props.onPress());
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("DiscoverFilters", { mediaType });
    expect(DISCOVER_FILTERS_ROUTE).toBe("DiscoverFilters");
  });

  test("yalnız tür verilir: süzgeç parametresi yok (ekran SON KULLANILANLA açılır)", () => {
    const navigate = jest.fn();
    render({ navigation: { navigate }, mediaType: "movie", label: "x" });
    act(() => button().props.onPress());
    expect(Object.keys(navigate.mock.calls[0][1])).toEqual(["mediaType"]);
  });

  test("tür değişince düğme yeni türle açar", () => {
    const navigate = jest.fn();
    render({ navigation: { navigate }, mediaType: "tv", label: "x" });
    act(() => tree.update(<DiscoverExploreAction navigation={{ navigate }} mediaType="movie" label="x" />));
    act(() => button().props.onPress());
    expect(navigate).toHaveBeenCalledWith("DiscoverFilters", { mediaType: "movie" });
  });

  test("navigation verilmese de dokunmak çökmez", () => {
    render({ mediaType: "tv", label: "x" });
    expect(() => act(() => button().props.onPress())).not.toThrow();
  });

  test("rota adı App.js'te kayıtlı filtre ekranıyla aynı", () => {
    const app = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
    expect(app).toMatch(new RegExp(`name="${DISCOVER_FILTERS_ROUTE}"[\\s\\S]{0,200}DiscoverFiltersScreen`));
  });
});
