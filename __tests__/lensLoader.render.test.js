// LensLoader'ın GERÇEK bağlantısı: bileşen react-test-renderer ile çizilir, sürücü
// elle `setValue` ile döngüde ilerletilir ve çözülmüş stiller okunur. Taklit düzeneği
// splashLensIntro.render.test.js ile aynı (gerçek Animated düğümleri, kayıt tutan
// zamanlayıcılar).
import React from "react";
import { act, create } from "react-test-renderer";
import { CYCLE_MS, BREATHE_MS, LENS_COLORS, LOADER_SIZES } from "../utils/lensLoaderMotion";

jest.unmock("../components/LensLoader");

jest.mock("react-native/Libraries/TurboModule/TurboModuleRegistry", () => ({
  get: () => null,
  getEnforcing: () => new Proxy({}, { get: () => () => {} }),
}));
jest.mock("react-native/Libraries/Utilities/Platform", () => ({
  __esModule: true,
  default: { OS: "ios", select: (o) => (o.ios !== undefined ? o.ios : o.default), Version: 17 },
}));
jest.mock("react-native", () => {
  const mockReact = require("react");
  const nodes = "react-native/Libraries/Animated/nodes/";
  const AnimatedValue = jest.requireActual(`${nodes}AnimatedValue`).default;
  const AnimatedMultiplication = jest.requireActual(`${nodes}AnimatedMultiplication`).default;
  const registry = [];
  const host = (name) => {
    const Component = (props) => mockReact.createElement(name, props, props.children);
    Component.displayName = name;
    return Component;
  };
  return {
    __registry: registry,
    Animated: {
      Value: AnimatedValue,
      multiply: (a, b) => new AnimatedMultiplication(a, b),
      View: host("AView"),
      timing: (value, config) => {
        const entry = { value, config, loop: false, stopped: false };
        return {
          start: () => registry.push(entry),
          stop: () => {
            entry.stopped = true;
          },
          __entry: entry,
        };
      },
      loop: (inner) => ({
        start: () => {
          inner.__entry.loop = true;
          inner.start();
        },
        stop: () => inner.stop(),
      }),
    },
    View: host("View"),
    useWindowDimensions: () => global.__window || { width: 390, height: 844 },
    Easing: { linear: (x) => x },
    StyleSheet: {
      absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
      create: (s) => s,
    },
  };
});
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => global.__reduced === true }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));

const LensLoader = require("../components/LensLoader").default;
const registry = require("react-native").__registry;
global.IS_REACT_ACT_ENVIRONMENT = true;

const isAnimated = (v) => v && typeof v === "object" && typeof v.__getValue === "function";
const resolve = (v) => (isAnimated(v) ? v.__getValue() : v);
function flatten(style) {
  const out = {};
  (function walk(s) {
    if (Array.isArray(s)) s.forEach(walk);
    else if (s) Object.assign(out, s);
  })(style);
  return out;
}
function find(tree, predicate) {
  const out = [];
  (function walk(n) {
    if (!n || typeof n === "string") return;
    if (predicate(n)) out.push(n);
    (n.children || []).forEach(walk);
  })(tree);
  return out;
}
const byId = (r, id) => find(r.toJSON(), (n) => n.props && n.props.testID === id)[0];
const transformOf = (node) => {
  const out = {};
  for (const entry of flatten(node.props.style).transform || []) {
    const [key, value] = Object.entries(entry)[0];
    out[key] = resolve(value);
  }
  return out;
};
const live = () => registry.filter((e) => !e.stopped);

let renderer;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  registry.length = 0;
  global.__reduced = false;
  global.__window = undefined;
});

function mount(props) {
  act(() => {
    renderer = create(<LensLoader testID="ld" {...props} />);
  });
  return renderer;
}

describe("LensLoader", () => {
  test("ActivityIndicator gibi: style dış kaba, içerik ortada; erişilebilirlik", () => {
    mount({ size: "large", style: { flex: 1, marginTop: 8 } });
    const root = byId(renderer, "ld");
    const outer = flatten(root.props.style);
    // Dış kap sabit px DEĞİL: sütunda yayılır, göstergeyi ortalar (kenara yapışma hatası).
    expect(outer).toMatchObject({ alignItems: "center", justifyContent: "center", flex: 1, marginTop: 8 });
    expect(outer.width).toBeUndefined();
    expect(flatten(byId(renderer, "ld-box").props.style)).toMatchObject({
      width: LOADER_SIZES.large,
      height: LOADER_SIZES.large,
    });
    expect(root.props.accessibilityRole).toBe("progressbar");
    expect(root.props.accessibilityLabel).toBe("Yükleniyor...");
    expect(root.props.pointerEvents).toBe("none");
  });

  test("boy verilmezse: brand medium, mono small", () => {
    mount({});
    expect(flatten(byId(renderer, "ld-box").props.style).width).toBe(LOADER_SIZES.medium);
    act(() => renderer.unmount());
    mount({ tone: "mono", color: "#fff" });
    expect(flatten(byId(renderer, "ld-box").props.style).width).toBe(LOADER_SIZES.small);
  });

  test("kademeler ekranla ölçeklenir; small düğmede küçülmez", () => {
    global.__window = { width: 820, height: 1180 }; // tablet: kısa kenar 820 → ×1,5
    mount({ size: "large" });
    expect(flatten(byId(renderer, "ld-box").props.style).width).toBe(Math.round(LOADER_SIZES.large * 1.5));
    act(() => renderer.unmount());
    global.__window = { width: 320, height: 568 }; // küçük telefon → ×0,9 (small hariç)
    mount({ size: "small" });
    expect(flatten(byId(renderer, "ld-box").props.style).width).toBe(LOADER_SIZES.small);
    act(() => renderer.unmount());
    mount({ size: 30 });
    expect(flatten(byId(renderer, "ld-box").props.style).width).toBe(30);
  });

  test("fill: kabını doldurur, ölçünce kısa kenara göre büyür", () => {
    mount({ size: "fill" });
    const root = () => byId(renderer, "ld");
    expect(flatten(root().props.style)).toMatchObject({ flex: 1, alignSelf: "stretch" });
    expect(flatten(byId(renderer, "ld-box").props.style).width).toBe(LOADER_SIZES.medium);
    act(() => root().props.onLayout({ nativeEvent: { layout: { width: 200, height: 300 } } }));
    expect(flatten(byId(renderer, "ld-box").props.style).width).toBe(60);
    // Kap çok küçükse medium'a döner.
    act(() => root().props.onLayout({ nativeEvent: { layout: { width: 30, height: 30 } } }));
    expect(flatten(byId(renderer, "ld-box").props.style).width).toBe(LOADER_SIZES.medium);
  });

  test("tek native döngü kurar, sökülünce durur", () => {
    mount({});
    expect(live()).toHaveLength(1);
    expect(live()[0].loop).toBe(true);
    expect(live()[0].config).toMatchObject({ duration: CYCLE_MS, useNativeDriver: true, isInteraction: false });
    act(() => renderer.unmount());
    renderer = null;
    expect(live()).toHaveLength(0);
  });

  test("karadelikler yaklaşır, iç içe geçer, öbür tarafa uzaklaşır", () => {
    mount({ size: 40 });
    const driver = live()[0].value;
    const cyan = () => transformOf(byId(renderer, "ld-cyan"));
    const red = () => transformOf(byId(renderer, "ld-red"));
    act(() => driver.setValue(0));
    const start = cyan().translateX;
    expect(start).toBeGreaterThan(0);
    expect(red().translateX).toBeCloseTo(-start, 5);
    act(() => driver.setValue(0.5));
    expect(Math.abs(cyan().translateX)).toBeLessThan(start * 0.1);
    expect(cyan().scaleX).toBeGreaterThan(1.1); // gelgit gerilmesi
    act(() => driver.setValue(1));
    expect(cyan().translateX).toBeCloseTo(-start, 3);
  });

  test("brand: marka renkleri + koyu çekirdek, color yok sayılır; mono: halka + renkli çekirdek", () => {
    mount({ color: "#123456" });
    expect(flatten(byId(renderer, "ld-cyan").props.style).backgroundColor).toBe(LENS_COLORS.cyan);
    expect(flatten(byId(renderer, "ld-red").props.style).backgroundColor).toBe(LENS_COLORS.red);
    expect(flatten(byId(renderer, "ld-cyan-core").props.style).backgroundColor).toBe(LENS_COLORS.ink);
    expect(find(renderer.toJSON(), (n) => JSON.stringify(n.props?.style || "").includes("#123456"))).toHaveLength(0);
    act(() => renderer.unmount());

    mount({ color: "#FFFFFF", tone: "mono" });
    const ring = flatten(byId(renderer, "ld-cyan").props.style);
    expect(ring.borderColor).toBe("#FFFFFF");
    expect(ring.backgroundColor).toBeUndefined();
    expect(flatten(byId(renderer, "ld-red-core").props.style).backgroundColor).toBe("#FFFFFF");
  });

  test("animating=false: döngü yok, yer tutucu kutu kalır", () => {
    mount({ animating: false, size: "small" });
    expect(live()).toHaveLength(0);
    const root = byId(renderer, "ld");
    expect(root.children).toHaveLength(1);
    expect(flatten(root.children[0].props.style)).toMatchObject({ width: LOADER_SIZES.small, height: LOADER_SIZES.small });
  });

  test("Hareketi Azalt: sabit pozda durur, yalnız saydamlık nefes alır", () => {
    global.__reduced = true;
    mount({ size: "large" });
    expect(live()).toHaveLength(1);
    expect(live()[0].config.duration).toBe(BREATHE_MS);
    const driver = live()[0].value;
    const box = () => byId(renderer, "ld-box");
    act(() => driver.setValue(0.5));
    expect(resolve(flatten(box().props.style).opacity)).toBeLessThan(0.6);
    expect(box().props.needsOffscreenAlphaCompositing).toBe(true);
    const cyan = transformOf(byId(renderer, "ld-cyan"));
    expect(isAnimated(cyan.translateX)).toBe(false);
    expect(cyan.scaleX).toBeUndefined();
    expect(byId(renderer, "ld-wave")).toBeUndefined();
  });
});
