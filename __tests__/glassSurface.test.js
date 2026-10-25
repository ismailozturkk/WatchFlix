// components/common/GlassSurface.js — iki çizim yolu:
//   • cam açık  → NativeGlassView, doğru stil/şema/ton/etkileşim propları ile
//   • cam kapalı→ çağıranın ESKİ görünümü (düz yüzey ya da blur)
//   • Android   → buzlu cam (yarı saydam yüzey + kenar ışığı + parlama, blur hedefi)
// Android / iOS 18–25 / "Efektler: Kapalı" kullanıcısının eski görünümde kalması
// bu testin asıl konusu. Gerçek UIGlassEffect çizimi cihazda doğrulanır.
import React from "react";
import { act, create } from "react-test-renderer";
import GlassSurface, { useGlassScheme } from "../components/common/GlassSurface";

global.IS_REACT_ACT_ENVIRONMENT = true;

let mockGlass = true;
let mockTheme = { primary: "#111111" };

jest.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles) => styles, flatten: (style) => style },
}));

jest.mock("../components/common/AdaptiveBlurView", () => {
  const React = require("react");
  return { __esModule: true, default: (props) => React.createElement("AdaptiveBlurView", props) };
});

jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: mockTheme }),
}));

jest.mock("../services/liquidGlass", () => {
  const React = require("react");
  return {
    // mockGlass: true (iOS 26 cam) | "frosted" (Android buzlu cam) | false (eski görünüm)
    useLiquidGlass: () => mockGlass === true,
    useGlassMode: () => (mockGlass === true ? "native" : mockGlass === "frosted" ? "frosted" : "off"),
    useGlassShape: () => mockGlass === true || mockGlass === "frosted",
    NativeGlassView: (props) => React.createElement("GlassView", props),
  };
});

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

// Stil dizisini (iç içe/null içerebilir) tek nesneye indirger.
const flat = (style) =>
  [].concat(style).flat(Infinity).filter(Boolean).reduce((acc, item) => ({ ...acc, ...item }), {});

beforeEach(() => {
  mockGlass = true;
  mockTheme = { primary: "#111111" };
});

describe("GlassSurface — cam açık", () => {
  it("NativeGlassView çizer; köşe yarıçapı stile, şema temadan gelir", () => {
    const tree = render(<GlassSurface radius={24} style={{ height: 48 }} />);
    const glass = tree.root.findByType("GlassView");
    expect(glass.props.glassEffectStyle).toBe("regular");
    expect(glass.props.colorScheme).toBe("dark"); // koyu tema yüzeyi
    expect(glass.props.isInteractive).toBe(false);
    expect(flat(glass.props.style)).toMatchObject({ height: 48, borderRadius: 24 });
  });

  it("açık tema yüzeyinde cam 'light' çizilir (sistemden bağımsız)", () => {
    mockTheme = { primary: "#FFFFFF" };
    const tree = render(<GlassSurface radius={20} />);
    expect(tree.root.findByType("GlassView").props.colorScheme).toBe("light");
  });

  it("scheme açıkça verilirse tema yok sayılır (poster üstü hep koyu)", () => {
    mockTheme = { primary: "#FFFFFF" };
    const tree = render(<GlassSurface radius={20} scheme="dark" />);
    expect(tree.root.findByType("GlassView").props.colorScheme).toBe("dark");
  });

  it("ton, varyant ve etkileşim cama iletilir", () => {
    const tree = render(<GlassSurface radius={20} variant="clear" tint="#FF0000" interactive />);
    const glass = tree.root.findByType("GlassView");
    expect(glass.props.glassEffectStyle).toBe("clear");
    expect(glass.props.tintColor).toBe("#FF0000");
    expect(glass.props.isInteractive).toBe(true);
  });

  it("eski görünüme ait proplar (fallbackStyle/fallbackBlur) cama SIZMAZ", () => {
    const tree = render(
      <GlassSurface
        radius={20}
        fallbackStyle={{ backgroundColor: "red", borderWidth: 1 }}
        fallbackBlur={{ tint: "dark", intensity: 60 }}
        style={{ width: 40 }}
      />,
    );
    const glass = tree.root.findByType("GlassView");
    expect(glass.props.fallbackStyle).toBeUndefined();
    expect(glass.props.fallbackBlur).toBeUndefined();
    expect(flat(glass.props.style).backgroundColor).toBeUndefined();
    expect(flat(glass.props.style).borderWidth).toBeUndefined();
  });

  it("yarıçap verilmezse stile borderRadius eklenmez", () => {
    const tree = render(<GlassSurface />);
    expect(flat(tree.root.findByType("GlassView").props.style).borderRadius).toBeUndefined();
  });
});

describe("GlassSurface — cam kapalı (eski görünüm)", () => {
  beforeEach(() => {
    mockGlass = false;
  });

  it("düz yüzey: fallbackStyle ve yarıçap uygulanır, cam çizilmez", () => {
    const tree = render(
      <GlassSurface radius={12} fallbackStyle={{ backgroundColor: "#222", borderWidth: 1 }} style={{ width: 40 }} />,
    );
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
    const view = tree.root.findByType("View");
    expect(flat(view.props.style)).toMatchObject({ width: 40, backgroundColor: "#222", borderWidth: 1, borderRadius: 12 });
  });

  it("fallbackBlur verilirse AdaptiveBlurView çizilir (kırpılmış yuvarlak köşe)", () => {
    const tree = render(
      <GlassSurface radius={12} fallbackBlur={{ tint: "dark", intensity: 60 }} style={{ width: 40 }} />,
    );
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
    const blur = tree.root.findByType("AdaptiveBlurView");
    expect(blur.props.tint).toBe("dark");
    expect(blur.props.intensity).toBe(60);
    expect(flat(blur.props.style)).toMatchObject({ width: 40, borderRadius: 12, overflow: "hidden" });
  });

  it("çocuklar iki yolda da çizilir", () => {
    const tree = render(
      <GlassSurface radius={12}>
        <Child />
      </GlassSurface>,
    );
    expect(tree.root.findAllByType(Child)).toHaveLength(1);
  });
});

describe("GlassSurface — Android buzlu cam", () => {
  beforeEach(() => {
    mockGlass = "frosted";
  });

  const sheenOf = (tree) => tree.root.findByType("LinearGradient");

  it("cam çizilmez; yüzey eski zeminin buzlu opaklığında, çerçeve RENGİ çizilmez", () => {
    const tree = render(
      <GlassSurface
        radius={20}
        fallbackStyle={{ backgroundColor: "#222222", borderColor: "#333333", borderWidth: 1 }}
        style={{ width: 40 }}
      />,
    );
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
    const surface = tree.root.findAllByType("View")[0];
    expect(flat(surface.props.style)).toMatchObject({
      width: 40,
      borderRadius: 20,
      backgroundColor: "rgba(34, 34, 34, 0.8)",
      borderWidth: 1,
      borderColor: "transparent",
    });
    // Kenar ışığı + parlama: içeriğin arkasında, dokunuş almaz.
    expect(sheenOf(tree).props.colors).toHaveLength(2);
  });

  it("eski kutunun durum çerçevesi (canlı renk) kenar ışığı olur", () => {
    const tree = render(
      <GlassSurface radius={21} fallbackStyle={{ backgroundColor: "#222222", borderColor: "#3B82F6", borderWidth: 1 }} />,
    );
    const rimLayer = tree.root.findAllByType("View")[1];
    expect(rimLayer.props.pointerEvents).toBe("none");
    expect(flat(rimLayer.props.style).borderColor).toBe("rgba(59, 130, 246, 1)");
  });

  it("açık `rim` her şeyi ezer; zemin yoksa ton, o da yoksa tema yüzeyi", () => {
    mockTheme = { primary: "#111111", secondary: "#1C1C1E" };
    const tree = render(<GlassSurface radius={20} rim="#FF0000" />);
    expect(flat(tree.root.findAllByType("View")[0].props.style).backgroundColor).toBe("rgba(28, 28, 30, 0.8)");
    expect(flat(tree.root.findAllByType("View")[1].props.style).borderColor).toBe("#FF0000");
  });

  it("fallbackBlur: blur hedefiyle AdaptiveBlurView (gerçek blur) + parlama, eski çerçeve yok", () => {
    const target = { current: {} };
    const tree = render(
      <GlassSurface
        radius={19}
        fallbackBlur={{ tint: "dark", intensity: 60 }}
        blurTarget={target}
        fallbackStyle={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" }}
      />,
    );
    const blur = tree.root.findByType("AdaptiveBlurView");
    expect(blur.props.blurTarget).toBe(target);
    expect(flat(blur.props.style).borderWidth).toBeUndefined();
    expect(sheenOf(tree)).toBeTruthy();
  });
});

describe("useGlassScheme", () => {
  function Probe({ override }) {
    return React.createElement("Probe", { value: useGlassScheme(override) });
  }

  it("override yoksa tema yüzeyinden türetir", () => {
    mockTheme = { primary: "#F5F5F5" };
    expect(render(<Probe />).root.findByType("Probe").props.value).toBe("light");
    mockTheme = { primary: "#0B0B0F" };
    expect(render(<Probe />).root.findByType("Probe").props.value).toBe("dark");
  });

  it("geçersiz override yok sayılır", () => {
    mockTheme = { primary: "#0B0B0F" };
    expect(render(<Probe override="auto" />).root.findByType("Probe").props.value).toBe("dark");
  });
});

function Child() {
  return React.createElement("Child");
}
