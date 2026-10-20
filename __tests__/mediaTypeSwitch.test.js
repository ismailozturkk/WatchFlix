// __tests__/mediaTypeSwitch.test.js
//
// Film/Dizi geçiş anahtarı (components/home/MediaTypeSwitch.js): seçim, erişilebilirlik,
// vurgu hapının konumu (LTR/RTL) ve hareket azaltma.
import React from "react";
import { act, create } from "react-test-renderer";
import MediaTypeSwitch, { MEDIA_SWITCH_HEIGHT, MEDIA_SWITCH_WIDTH } from "../components/home/MediaTypeSwitch";

let mockRtl = false;
let mockReduceMotion = false;
const mockSelection = jest.fn(() => Promise.resolve());
const mockSpringStart = jest.fn();
const mockSpringStop = jest.fn();
const mockSpring = jest.fn(() => ({ start: mockSpringStart, stop: mockSpringStop }));

jest.mock("react-native", () => {
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    interpolate(config) { return { __interpolated: true, config, from: this }; }
  }
  return {
    Animated: {
      Value,
      View: "AnimatedView",
      spring: (...args) => mockSpring(...args),
    },
    I18nManager: { get isRTL() { return mockRtl; } },
    Pressable: "Pressable",
    Text: "Text",
    View: "View",
    StyleSheet: { create: (s) => s, absoluteFill: {}, hairlineWidth: 1 },
  };
});
// Babel eklentisi (scripts/babel-transform-app-text.js) `Text` içe aktarmasını AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/common/GlassField", () => ({ __esModule: true, default: "Field" }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: { accent: "#3388ff", secondary: "#222222", border: "#333333", text: { primary: "#ffffff", secondary: "#aaaaaa", muted: "#777777" } },
  }),
}));
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => mockReduceMotion }));
jest.mock("../services/hapticsService", () => ({ selectionAsync: (...args) => mockSelection(...args) }));

global.IS_REACT_ACT_ENVIRONMENT = true;

const labels = { tv: "Diziler", movie: "Filmler" };
let renderer;
let warn;

function render(props = {}) {
  const onChange = props.onChange ?? jest.fn();
  act(() => {
    renderer = create(<MediaTypeSwitch value="tv" labels={labels} {...props} onChange={onChange} />);
  });
  return onChange;
}
const segment = (type) => renderer.root.findByProps({ testID: `media-switch-${type}` });
const thumb = () => renderer.root.findByType("AnimatedView");

beforeEach(() => {
  mockRtl = false;
  mockReduceMotion = false;
  mockSelection.mockClear();
  mockSpring.mockClear();
  mockSpringStart.mockClear();
  mockSpringStop.mockClear();
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

describe("MediaTypeSwitch", () => {
  it("iki bölme çizer: erişilebilir sekme rolü, çevrilmiş etiket, seçili durum", () => {
    render({ value: "movie" });
    expect(segment("tv").props.accessibilityRole).toBe("tab");
    expect(segment("tv").props.accessibilityLabel).toBe("Diziler");
    expect(segment("tv").props.accessibilityState).toEqual({ selected: false });
    expect(segment("movie").props.accessibilityLabel).toBe("Filmler");
    expect(segment("movie").props.accessibilityState).toEqual({ selected: true });
  });

  it("seçili bölme dolu simge + vurgu rengi, öteki çerçeveli simge + soluk renk", () => {
    render({ value: "tv" });
    const icon = (type) => segment(type).findByType("Icon").props;
    expect(icon("tv")).toMatchObject({ name: "tv", color: "#3388ff" });
    expect(icon("movie")).toMatchObject({ name: "videocam-outline", color: "#777777" });
  });

  it("yazı kalınlığı seçimle değişmez (genişlik titremesin) ve uzun çeviri küçülür", () => {
    render({ value: "tv" });
    const style = (type) => segment(type).findByType("Text").props;
    expect(style("tv").style[0].fontWeight).toBe(style("movie").style[0].fontWeight);
    expect(style("tv").adjustsFontSizeToFit).toBe(true);
    expect(style("tv").numberOfLines).toBe(1);
  });

  it("öteki bölmeye dokunmak onChange'i o anahtarla çağırır ve hafif titreşim verir", () => {
    const onChange = render({ value: "tv" });
    act(() => segment("movie").props.onPress());
    expect(onChange).toHaveBeenCalledWith("movie");
    expect(mockSelection).toHaveBeenCalledTimes(1);
  });

  it("zaten seçili bölmeye dokunmak hiçbir şey yapmaz", () => {
    const onChange = render({ value: "tv" });
    act(() => segment("tv").props.onPress());
    expect(onChange).not.toHaveBeenCalled();
    expect(mockSelection).not.toHaveBeenCalled();
  });

  it("vurgu hapı dokunuşa karşı kapalı ve seçili bölmeye yaylanarak kayar", () => {
    render({ value: "tv" });
    expect(thumb().props.pointerEvents).toBe("none");
    // İlk çizimde animasyon hedefi 0 (Dizi).
    expect(mockSpring.mock.calls.at(-1)[1]).toMatchObject({ toValue: 0, useNativeDriver: true });
    act(() => renderer.update(<MediaTypeSwitch value="movie" labels={labels} onChange={jest.fn()} />));
    expect(mockSpring.mock.calls.at(-1)[1]).toMatchObject({ toValue: 1, useNativeDriver: true });
    expect(mockSpringStart).toHaveBeenCalled();
  });

  it("hap, bölmenin genişliği kadar yol alır (LTR: sağa)", () => {
    render({ value: "tv" });
    const { config } = thumb().props.style.find((s) => s && s.transform).transform[0].translateX;
    expect(config.inputRange).toEqual([0, 1]);
    expect(config.outputRange[0]).toBe(0);
    expect(config.outputRange[1]).toBeGreaterThan(0);
    expect(config.outputRange[1] * 2 + 8).toBe(MEDIA_SWITCH_WIDTH);
  });

  it("RTL'de hap sağdan başlar ve sola kayar", () => {
    mockRtl = true;
    render({ value: "tv" });
    const style = thumb().props.style;
    expect(style).toEqual(expect.arrayContaining([expect.objectContaining({ right: 0 })]));
    const { config } = style.find((s) => s && s.transform).transform[0].translateX;
    expect(config.outputRange[1]).toBeLessThan(0);
  });

  it("Hareketi Azalt açıkken yaylanma yok, hap anında konumlanır", () => {
    mockReduceMotion = true;
    render({ value: "tv" });
    act(() => renderer.update(<MediaTypeSwitch value="movie" labels={labels} onChange={jest.fn()} />));
    expect(mockSpring).not.toHaveBeenCalled();
  });

  it("anahtar yüksekliği arama düğmesinden ince ve sabit", () => {
    expect(MEDIA_SWITCH_HEIGHT).toBe(46);
    render();
    expect(renderer.root.findByType("Field").props.height).toBe(MEDIA_SWITCH_HEIGHT);
  });
});

describe("MediaTypeSwitch — dar ekran (segmentWidth)", () => {
  const innerOf = () => renderer.root.findByProps({ accessibilityRole: "tablist" });
  const widthsOf = (node) => [].concat(node.props.style).flat(Infinity).filter(Boolean).map((st) => st.width).filter((w) => w != null);

  it("varsayılan 112: iki bölme + iç boşluk (MEDIA_SWITCH_WIDTH), simgeler görünür", () => {
    render({ value: "tv" });
    expect(widthsOf(segment("tv"))).toContain(112);
    expect(widthsOf(innerOf())).toContain(224);
    expect(segment("tv").findAllByType("Icon")).toHaveLength(1);
  });

  it("daraltılmış bölme (≥100) genişliği uygular ve simgeleri korur", () => {
    render({ value: "tv", segmentWidth: 108 });
    expect(widthsOf(segment("tv"))).toContain(108);
    expect(widthsOf(segment("movie"))).toContain(108);
    expect(widthsOf(innerOf())).toContain(216);
    expect(segment("tv").findAllByType("Icon")).toHaveLength(1);
    expect(segment("movie").findAllByType("Icon")).toHaveLength(1);
  });

  it("vurgu hapı yeni bölme genişliği kadar yol alır ve o genişlikte olur", () => {
    render({ value: "tv", segmentWidth: 88 });
    expect(widthsOf(thumb())).toContain(88);
    const { config } = thumb().props.style.find((s) => s && s.transform).transform[0].translateX;
    expect(config.outputRange).toEqual([0, 88]);
  });

  it("RTL'de dar bölmede de hap sola kayar", () => {
    mockRtl = true;
    render({ value: "tv", segmentWidth: 88 });
    const { config } = thumb().props.style.find((s) => s && s.transform).transform[0].translateX;
    expect(config.outputRange).toEqual([0, -88]);
  });

  it("kompakt kip (<100): simgeler kalkar, yazı ve erişilebilirlik korunur", () => {
    render({ value: "movie", segmentWidth: 88 });
    expect(segment("tv").findAllByType("Icon")).toHaveLength(0);
    expect(segment("movie").findAllByType("Icon")).toHaveLength(0);
    expect(segment("tv").findByType("Text").props.children).toBe("Diziler");
    expect(segment("movie").props.accessibilityState).toEqual({ selected: true });
    expect(segment("tv").props.accessibilityRole).toBe("tab");
  });

  it("eşik tam 100: simge görünür; 99: kompakt", () => {
    render({ value: "tv", segmentWidth: 100 });
    expect(segment("tv").findAllByType("Icon")).toHaveLength(1);
    act(() => renderer.update(<MediaTypeSwitch value="tv" labels={labels} onChange={jest.fn()} segmentWidth={99} />));
    expect(segment("tv").findAllByType("Icon")).toHaveLength(0);
  });

  it("kompakt kipte de seçim çalışır ve titreşim verir", () => {
    const onChange = render({ value: "tv", segmentWidth: 88 });
    act(() => segment("movie").props.onPress());
    expect(onChange).toHaveBeenCalledWith("movie");
    expect(mockSelection).toHaveBeenCalledTimes(1);
  });

  it("genişlik canlı değişince (döndürme) hap yolu ve bölmeler güncellenir", () => {
    render({ value: "tv", segmentWidth: 88 });
    act(() => renderer.update(<MediaTypeSwitch value="tv" labels={labels} onChange={jest.fn()} segmentWidth={112} />));
    const { config } = thumb().props.style.find((s) => s && s.transform).transform[0].translateX;
    expect(config.outputRange).toEqual([0, 112]);
    expect(segment("tv").findAllByType("Icon")).toHaveLength(1);
  });
});
