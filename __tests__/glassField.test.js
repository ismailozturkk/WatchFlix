// components/common/GlassField.js — arama / yazı alanı kabuğu, iki çizim yolu:
//   • cam açık  → çocukların ARKASINDA TEK katman: tema yüzeyiyle tonlanmış Liquid Glass
//                 (altında ayrı bir dolgulu yüzey YOK; ton camın kendi tintColor'ından)
//   • cam kapalı→ çağıranın ESKİ kutusu, kendi köşe yarıçapıyla (hap yarıçapı ezmez)
//   • Android   → cam yerleşimi (sabit yükseklik, hap) + buzlu katman; odak = kenar ışığı
// Gerçek UIGlassEffect çizimi cihazda doğrulanır; burada kilitlenen şey katman
// sırası, yarıçap/yükseklik ve Android / iOS 18–25 kullanıcısının eski görünümü.
import React from "react";
import { act, create } from "react-test-renderer";
import GlassField, {
  GLASS_FIELD_FOCUS_TINT_ALPHA,
  GLASS_FIELD_TINT_ALPHA,
} from "../components/common/GlassField";

global.IS_REACT_ACT_ENVIRONMENT = true;

let mockGlass = true;
let mockTheme = { primary: "#111111", secondary: "#202020" };

jest.mock("react-native", () => ({
  View: "View",
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => style,
    absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  },
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

function Child() {
  return React.createElement("Child");
}

beforeEach(() => {
  mockGlass = true;
  mockTheme = { primary: "#111111", secondary: "#202020" };
});

describe("GlassField — cam açık", () => {
  it("kök sabit yükseklikte; yerleşim stili (padding, satır düzeni) kökte kalır", () => {
    const tree = render(
      <GlassField height={48} style={{ flexDirection: "row", paddingHorizontal: 14, flex: 1 }}>
        <Child />
      </GlassField>,
    );
    const root = tree.root.findAllByType("View")[0];
    expect(flat(root.props.style)).toMatchObject({ height: 48, flexDirection: "row", paddingHorizontal: 14, flex: 1 });
  });

  it("camın ARKASINDA ikinci bir dolgulu yüzey yok: tek katman, ton camın kendisinde", () => {
    const tree = render(<GlassField height={48} />);
    // Hiçbir View arka plan rengi taşımaz (eskiden altta ayrı bir gövde hapı vardı).
    tree.root.findAllByType("View").forEach((v) => {
      expect(flat(v.props.style).backgroundColor).toBeUndefined();
    });
    expect(tree.root.findAllByType("GlassView")).toHaveLength(1);
  });

  it("dinlenme tonu tema yüzeyini izler (düz zeminde alan sayfadan ayrışsın)", () => {
    const dark = render(<GlassField />);
    expect(dark.root.findByType("GlassView").props.tintColor).toBe(
      `rgba(32, 32, 32, ${GLASS_FIELD_TINT_ALPHA})`,
    );

    mockTheme = { primary: "#FFFFFF", secondary: "#F0F0F5" };
    const light = render(<GlassField />);
    expect(light.root.findByType("GlassView").props.tintColor).toBe(
      `rgba(240, 240, 245, ${GLASS_FIELD_TINT_ALPHA})`,
    );
  });

  it("katman sırası: cam çocukların ALTINDA; katman dokunuşu yutmaz", () => {
    const tree = render(
      <GlassField height={46}>
        <Child />
      </GlassField>,
    );
    const root = tree.root.findAllByType("View")[0];
    const [plate, child] = root.children;
    // Katman: mutlak, dokunuş almaz, içinde yalnız cam.
    expect(plate.props.pointerEvents).toBe("none");
    expect(flat(plate.props.style)).toMatchObject({ position: "absolute" });
    expect(plate.children).toHaveLength(1);
    expect(plate.findByType("GlassView")).toBeDefined();
    // Çocuk katmandan SONRA gelir (üstte çizilir) ve camın içinde değildir.
    expect(child.type).toBe(Child);
    expect(tree.root.findByType("GlassView").findAllByType(Child)).toHaveLength(0);
  });

  it("cam hap köşeli ve mutlak dolgulu", () => {
    const tree = render(<GlassField height={40} accent="#FF0000" />);
    const glass = tree.root.findByType("GlassView");
    expect(flat(glass.props.style)).toMatchObject({ position: "absolute", borderRadius: 20 });
  });

  it("odaktayken cam vurgu renginde tonlanır; vurgu yoksa dinlenme tonu kalır", () => {
    const focused = render(<GlassField focused accent="#FF0000" />);
    expect(focused.root.findByType("GlassView").props.tintColor).toBe(
      `rgba(255, 0, 0, ${GLASS_FIELD_FOCUS_TINT_ALPHA})`,
    );

    const noAccent = render(<GlassField focused />);
    expect(noAccent.root.findByType("GlassView").props.tintColor).toBe(
      `rgba(32, 32, 32, ${GLASS_FIELD_TINT_ALPHA})`,
    );
  });

  it("eski görünüme ait fallbackStyle cam yoluna SIZMAZ", () => {
    const tree = render(
      <GlassField fallbackStyle={{ backgroundColor: "red", borderWidth: 1.5, borderRadius: 16 }} />,
    );
    const views = tree.root.findAllByType("View");
    views.forEach((v) => {
      expect(flat(v.props.style).borderWidth).toBeUndefined();
      expect(flat(v.props.style).backgroundColor).not.toBe("red");
    });
    expect(flat(tree.root.findByType("GlassView").props.style).borderWidth).toBeUndefined();
  });

  it("çocuklar çizilir", () => {
    const tree = render(
      <GlassField>
        <Child />
      </GlassField>,
    );
    expect(tree.root.findAllByType(Child)).toHaveLength(1);
  });
});

describe("GlassField — cam kapalı (eski görünüm)", () => {
  beforeEach(() => {
    mockGlass = false;
  });

  it("cam ve gövde çizilmez; yalnız çağıranın kutusu", () => {
    const tree = render(
      <GlassField height={48} fallbackStyle={{ backgroundColor: "#222", borderRadius: 16 }} style={{ paddingHorizontal: 14 }}>
        <Child />
      </GlassField>,
    );
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
    const views = tree.root.findAllByType("View");
    expect(views).toHaveLength(1);
    expect(flat(views[0].props.style)).toMatchObject({ paddingHorizontal: 14, backgroundColor: "#222" });
  });

  it("çağıranın köşesi aynen kalır: hap yarıçapı onu ezmez", () => {
    const tree = render(<GlassField height={48} fallbackStyle={{ borderRadius: 16 }} />);
    expect(flat(tree.root.findByType("View").props.style).borderRadius).toBe(16);
  });

  it("yükseklik ESNEK (minHeight): cam yolundaki sabit height kutuya uygulanmaz", () => {
    const tree = render(<GlassField height={46} />);
    const style = flat(tree.root.findByType("View").props.style);
    expect(style.minHeight).toBe(46);
    expect(style.height).toBeUndefined();
  });

  it("çocuklar çizilir", () => {
    const tree = render(
      <GlassField>
        <Child />
      </GlassField>,
    );
    expect(tree.root.findAllByType(Child)).toHaveLength(1);
  });
});

describe("GlassField — Android buzlu cam", () => {
  beforeEach(() => {
    mockGlass = "frosted";
  });

  it("cam yerleşimi (sabit yükseklik) + hap buzlu katman; zemin eski kutudan", () => {
    const tree = render(
      <GlassField height={46} fallbackStyle={{ backgroundColor: "#202020", borderRadius: 16, borderWidth: 1 }}>
        <Child />
      </GlassField>,
    );
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
    const root = tree.root.findAllByType("View")[0];
    expect(flat(root.props.style).height).toBe(46);
    expect(flat(root.props.style).minHeight).toBeUndefined();
    const surface = tree.root.findAllByType("View").find((v) => flat(v.props.style).borderRadius === 23);
    expect(flat(surface.props.style).backgroundColor).toBe("rgba(32, 32, 32, 0.8)");
  });

  it("odakta yüzey değişmez, kenar ışığı vurgu rengine döner", () => {
    const tree = render(<GlassField height={46} focused accent="#00FF88" fallbackStyle={{ backgroundColor: "#202020" }} />);
    const views = tree.root.findAllByType("View");
    expect(views.some((v) => flat(v.props.style).borderColor === "#00FF88")).toBe(true);
  });
});
