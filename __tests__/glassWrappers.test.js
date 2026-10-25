// GlassTouchable / GlassPressable / GlassBox / GlassTextInput — "yerine geçen"
// sarmalayıcılar. İki yol kilitlenir:
//   • cam kapalı → ESKİ bileşen (TouchableOpacity / Pressable / View / TextInput)
//     AYNI stil ve prop'larla, araya ek View girmeden
//   • cam açık   → kabuk (dolgu/gölge/opaklık) stilden çıkar, öğenin ARKASINDA tek
//     cam katmanı durur; yerleşim stili ve çocuklar yerinde kalır; iç içe cam yok
//   • Android    → aynı plan buzlu cam katmanıyla; dokunma saydamlığı korunur
// Gerçek UIGlassEffect çizimi cihazda doğrulanır.
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

// jest.setup.js bu dört bileşeni varsayılan olarak eski bileşene eşler; burada
// GERÇEK sarmalayıcılar sınanır.
jest.unmock("../components/common/GlassTouchable");
jest.unmock("../components/common/GlassPressable");
jest.unmock("../components/common/GlassBox");
jest.unmock("../components/common/GlassTextInput");

let mockGlass = true;
const mockTheme = { primary: "#111111", secondary: "#202020", border: "rgba(255, 255, 255, 0.12)" };

jest.mock("react-native", () => {
  const flatten = (style) =>
    [].concat(style).flat(Infinity).filter(Boolean).reduce((acc, item) => ({ ...acc, ...item }), {});
  return {
    View: "View",
    Pressable: "Pressable",
    TouchableOpacity: "TouchableOpacity",
    TextInput: "TextInput",
    StyleSheet: {
      create: (styles) => styles,
      flatten,
      absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
    },
  };
});

// Derleme eklentisi (scripts/babel-transform-app-text.js) TextInput'u AppTextInput'a
// çevirir; gerçek AppText reanimated'ı çeker — testte yalın TextInput yeter.
jest.mock("../components/typography/AppText", () => ({
  AppTextInput: "TextInput",
  AppText: "Text",
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

import GlassTouchable from "../components/common/GlassTouchable";
import GlassPressable from "../components/common/GlassPressable";
import GlassBox from "../components/common/GlassBox";
import GlassTextInput from "../components/common/GlassTextInput";

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

const flat = (style) =>
  [].concat(style).flat(Infinity).filter(Boolean).reduce((acc, item) => ({ ...acc, ...item }), {});

const BTN = {
  backgroundColor: "#E50914", borderRadius: 14, height: 48, paddingHorizontal: 16,
  alignItems: "center", shadowColor: "#000", shadowOpacity: 0.3, elevation: 4,
};

function Child() {
  return React.createElement("Child");
}

beforeEach(() => {
  mockGlass = true;
});

describe("GlassTouchable", () => {
  it("cam kapalı: birebir TouchableOpacity, stil ve activeOpacity aynen", () => {
    mockGlass = false;
    const onPress = jest.fn();
    const tree = render(
      <GlassTouchable style={BTN} activeOpacity={0.7} onPress={onPress} testID="btn">
        <Child />
      </GlassTouchable>,
    );
    const node = tree.root.findByType("TouchableOpacity");
    expect(node.props.style).toBe(BTN);
    expect(node.props.activeOpacity).toBe(0.7);
    expect(node.props.onPress).toBe(onPress);
    expect(node.props.testID).toBe("btn");
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
    expect(tree.root.findAllByType("Pressable")).toHaveLength(0);
  });

  it("cam açık: Pressable, kabuk stilden çıkar, cam katmanı çocukların ARKASINDA", () => {
    const tree = render(
      <GlassTouchable style={BTN} activeOpacity={0.7}>
        <Child />
      </GlassTouchable>,
    );
    expect(tree.root.findAllByType("TouchableOpacity")).toHaveLength(0);
    const pressable = tree.root.findByType("Pressable");
    const style = flat(pressable.props.style);
    expect(style).toMatchObject({ borderRadius: 14, height: 48, paddingHorizontal: 16, alignItems: "center" });
    ["backgroundColor", "shadowColor", "shadowOpacity", "elevation"].forEach((key) =>
      expect(style[key]).toBeUndefined(),
    );
    expect(pressable.props.activeOpacity).toBeUndefined();
    expect(pressable.props.accessibilityRole).toBe("button");

    // Sağlayıcı altında: cam katmanı ilk, çocuk sonra.
    const [layerNode, childNode] = pressable.children;
    expect(layerNode.findAllByType("GlassView")).toHaveLength(1);
    expect(childNode.findAllByType("Child")).toHaveLength(1);
    const glass = tree.root.findByType("GlassView");
    expect(glass.props.tintColor).toBe("rgba(229, 9, 20, 0.9)");
    expect(glass.props.isInteractive).toBe(true);
    expect(flat(glass.props.style)).toMatchObject({ position: "absolute", borderRadius: 14 });
  });

  it("cam açık ama stil cama uygun değil (dolgu/çerçeve yok): eski TouchableOpacity", () => {
    const tree = render(
      <GlassTouchable style={{ padding: 8 }}>
        <Child />
      </GlassTouchable>,
    );
    expect(tree.root.findAllByType("TouchableOpacity")).toHaveLength(1);
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
  });

  it("glass={false} bilinçli istisna: cam yolu kapanır", () => {
    const tree = render(
      <GlassTouchable style={BTN} glass={false}>
        <Child />
      </GlassTouchable>,
    );
    expect(tree.root.findAllByType("TouchableOpacity")).toHaveLength(1);
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
  });

  it("cam içinde cam yok: GlassBox içindeki düğme eski görünümde kalır", () => {
    const tree = render(
      <GlassBox style={{ backgroundColor: "#202020", borderRadius: 20, height: 46 }}>
        <GlassTouchable style={BTN}>
          <Child />
        </GlassTouchable>
      </GlassBox>,
    );
    expect(tree.root.findAllByType("GlassView")).toHaveLength(1);
    expect(tree.root.findAllByType("TouchableOpacity")).toHaveLength(1);
  });

  it("kullanıcının onLayout'u cam yolunda da çalışır", () => {
    const onLayout = jest.fn();
    const tree = render(
      <GlassTouchable style={BTN} onLayout={onLayout}>
        <Child />
      </GlassTouchable>,
    );
    const event = { nativeEvent: { layout: { width: 200, height: 48 } } };
    act(() => tree.root.findByType("Pressable").props.onLayout(event));
    expect(onLayout).toHaveBeenCalledWith(event);
  });

  it("hap (borderRadius 999): ölçülünce cam köşesi boyutun yarısına iner", () => {
    const tree = render(
      <GlassTouchable style={{ ...BTN, borderRadius: 999 }}>
        <Child />
      </GlassTouchable>,
    );
    expect(flat(tree.root.findByType("GlassView").props.style).borderRadius).toBe(999);
    act(() =>
      tree.root.findByType("Pressable").props.onLayout({ nativeEvent: { layout: { width: 200, height: 48 } } }),
    );
    expect(flat(tree.root.findByType("GlassView").props.style).borderRadius).toBe(24);
  });
});

describe("uç durumlar (cam açık)", () => {
  it("stilsiz / boş çocuklu sarmalayıcılar çökmeden eski bileşene düşer", () => {
    const tree = render(
      <>
        <GlassTouchable />
        <GlassPressable />
        <GlassBox />
        <GlassTextInput />
      </>,
    );
    expect(tree.root.findAllByType("TouchableOpacity")).toHaveLength(1);
    expect(tree.root.findAllByType("Pressable")).toHaveLength(1);
    expect(tree.root.findAllByType("View")).toHaveLength(1);
    expect(tree.root.findAllByType("TextInput")).toHaveLength(1);
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
  });

  it("falsy elemanlı stil dizisi ve fonksiyon stil null dönerse eski bileşen", () => {
    const tree = render(
      <>
        <GlassTouchable style={[null, false, undefined]} />
        <GlassPressable style={() => null} />
      </>,
    );
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
  });

  it("animasyonlu (nesne) renk ve Reanimated stili cama çevrilmez", () => {
    const tree = render(
      <>
        <GlassTouchable style={{ borderRadius: 12, backgroundColor: { __getValue: () => "#fff" } }} />
        <GlassTouchable style={[BTN, { viewDescriptors: {}, initial: {} }]} />
      </>,
    );
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
    expect(tree.root.findAllByType("TouchableOpacity")).toHaveLength(2);
  });

  it("kısık (devre dışı) düğme eski görünümde kalır, etkinleşince cama döner", () => {
    const Toggle = ({ disabled }) => (
      <GlassTouchable disabled={disabled} style={{ ...BTN, opacity: disabled ? 0.4 : 1 }}>
        <Child />
      </GlassTouchable>
    );
    const tree = render(<Toggle disabled />);
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
    act(() => tree.update(<Toggle disabled={false} />));
    expect(tree.root.findAllByType("GlassView")).toHaveLength(1);
  });
});

describe("GlassPressable", () => {
  it("cam kapalı: birebir Pressable; fonksiyon stil/çocuk aynen geçer", () => {
    mockGlass = false;
    const style = ({ pressed }) => [BTN, pressed && { opacity: 0.8 }];
    const tree = render(<GlassPressable style={style}>{() => <Child />}</GlassPressable>);
    const node = tree.root.findByType("Pressable");
    expect(node.props.style).toBe(style);
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
  });

  it("cam açık: fonksiyon stilden kabuk ve basılı-durum opaklığı çıkar", () => {
    const style = ({ pressed }) => [BTN, pressed && { opacity: 0.8 }];
    const tree = render(<GlassPressable style={style}>{() => <Child />}</GlassPressable>);
    const node = tree.root.findByType("Pressable");
    const pressedStyle = flat(node.props.style({ pressed: true }));
    expect(pressedStyle.opacity).toBeUndefined();
    expect(pressedStyle.backgroundColor).toBeUndefined();
    expect(pressedStyle.height).toBe(48);
    const content = node.props.children({ pressed: false });
    expect(content.props.children[0].props.radius).toBe(14);
  });

  it("cam açık: düz çocuklar da cam katmanını önde taşır", () => {
    const tree = render(
      <GlassPressable style={BTN}>
        <Child />
      </GlassPressable>,
    );
    const [layerNode, childNode] = tree.root.findByType("Pressable").children;
    expect(layerNode.findAllByType("GlassView")).toHaveLength(1);
    expect(childNode.findAllByType("Child")).toHaveLength(1);
  });
});

describe("GlassBox", () => {
  const FIELD = {
    flexDirection: "row", alignItems: "center", height: 46, borderRadius: 14, borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)", backgroundColor: "#202020", paddingHorizontal: 12,
  };

  it("cam kapalı: birebir View", () => {
    mockGlass = false;
    const tree = render(
      <GlassBox role="field" style={FIELD}>
        <Child />
      </GlassBox>,
    );
    expect(tree.root.findByType("View").props.style).toBe(FIELD);
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
  });

  it("cam açık: yerleşim kalır, nötr çerçeve saydamlaşır (kalınlık korunur), cam çerçeve kalınlığı kadar taşar", () => {
    const tree = render(
      <GlassBox role="field" style={FIELD}>
        <Child />
      </GlassBox>,
    );
    const style = flat(tree.root.findByType("View").props.style);
    expect(style).toMatchObject({
      flexDirection: "row", height: 46, borderWidth: 1.5, borderColor: "transparent", paddingHorizontal: 12,
    });
    expect(style.backgroundColor).toBeUndefined();
    const glass = tree.root.findByType("GlassView");
    expect(flat(glass.props.style)).toMatchObject({ top: -1.5, left: -1.5, right: -1.5, bottom: -1.5 });
    expect(glass.props.pointerEvents).toBe("none");
    expect(glass.props.tintColor).toBe("rgba(32, 32, 32, 0.55)");
  });

  it("odaktaki alan cam tonunu vurgu rengine çevirir", () => {
    const tree = render(
      <GlassBox role="field" style={FIELD} focused accent="#E50914">
        <Child />
      </GlassBox>,
    );
    expect(tree.root.findByType("GlassView").props.tintColor).toBe("rgba(229, 9, 20, 0.22)");
  });
});

describe("GlassTextInput", () => {
  const INPUT = {
    backgroundColor: "#202020", borderColor: "rgba(255, 255, 255, 0.12)", borderWidth: 1, borderRadius: 14,
    height: 48, marginBottom: 12, color: "#FFFFFF", fontSize: 15, paddingHorizontal: 14,
  };

  it("cam kapalı: birebir TextInput, tüm stil tek yerde", () => {
    mockGlass = false;
    const tree = render(<GlassTextInput style={INPUT} placeholder="Ara" />);
    const node = tree.root.findByType("TextInput");
    expect(node.props.style).toBe(INPUT);
    expect(node.props.placeholder).toBe("Ara");
    expect(tree.root.findAllByType("View")).toHaveLength(0);
  });

  it("cam açık: kutu cam sarmalayıcıda, yazı + iç dolgu TextInput'ta; sabit yükseklikte alan kutuyu doldurur", () => {
    const tree = render(<GlassTextInput style={INPUT} placeholder="Ara" />);
    const wrapper = flat(tree.root.findByType("View").props.style);
    expect(wrapper).toMatchObject({ height: 48, marginBottom: 12, borderRadius: 14 });
    expect(wrapper.color).toBeUndefined();
    const input = tree.root.findByType("TextInput");
    const inputStyle = flat(input.props.style);
    expect(inputStyle).toMatchObject({ color: "#FFFFFF", fontSize: 15, paddingHorizontal: 14, flexGrow: 1 });
    expect(inputStyle.backgroundColor).toBeUndefined();
    expect(input.props.placeholder).toBe("Ara");
    expect(tree.root.findAllByType("GlassView")).toHaveLength(1);
  });

  it("otomatik yükseklikli kutuda iç alan flexGrow almaz (taban 0 çöküşü olmasın)", () => {
    const { height, ...auto } = INPUT;
    const tree = render(<GlassTextInput style={auto} />);
    expect(flat(tree.root.findByType("TextInput").props.style).flexGrow).toBeUndefined();
  });

  it("kutusu olmayan stil (dolgu/çerçeve yok): eski tek TextInput", () => {
    const tree = render(<GlassTextInput style={{ color: "#fff", fontSize: 15 }} />);
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
    expect(tree.root.findAllByType("View")).toHaveLength(0);
  });
});

describe("Android buzlu cam", () => {
  beforeEach(() => {
    mockGlass = "frosted";
  });

  it("GlassTouchable: TouchableOpacity KALIR (activeOpacity), kabuk buzlu katmana geçer", () => {
    const tree = render(
      <GlassTouchable style={BTN} activeOpacity={0.7}>
        <Child />
      </GlassTouchable>,
    );
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
    expect(tree.root.findAllByType("Pressable")).toHaveLength(0);
    const touchable = tree.root.findByType("TouchableOpacity");
    expect(touchable.props.activeOpacity).toBe(0.7);
    const style = flat(touchable.props.style);
    expect(style.backgroundColor).toBeUndefined();
    expect(style.elevation).toBeUndefined();
    // Katman: vurgu dolgusu buzlu yüzey olur, dokunuş almaz, çocukların arkasında.
    const [layerNode, childNode] = touchable.children;
    const layer = layerNode.findAllByType("View")[0];
    expect(layer.props.pointerEvents).toBe("none");
    expect(flat(layer.props.style)).toMatchObject({ position: "absolute", borderRadius: 14 });
    expect(flat(layer.props.style).backgroundColor).toBe("rgba(229, 9, 20, 0.9)");
    expect(childNode.findAllByType("Child")).toHaveLength(1);
  });

  it("GlassPressable: fonksiyon stilindeki basılı-durum saydamlığı korunur", () => {
    const tree = render(
      <GlassPressable style={({ pressed }) => [BTN, { opacity: pressed ? 0.6 : 1 }]}>
        <Child />
      </GlassPressable>,
    );
    const pressable = tree.root.findByType("Pressable");
    expect(flat(pressable.props.style({ pressed: true })).opacity).toBe(0.6);
    expect(flat(pressable.props.style({ pressed: false })).backgroundColor).toBeUndefined();
  });

  it("seçili çipin vurgu çerçevesi kenar ışığı olur, kendi çerçeve rengi saydamlaşır", () => {
    const tree = render(
      <GlassBox style={{ borderRadius: 18, backgroundColor: "#202020", borderWidth: 1, borderColor: "#3B82F6" }}>
        <Child />
      </GlassBox>,
    );
    const outer = tree.root.findAllByType("View")[0];
    expect(flat(outer.props.style).borderColor).toBe("transparent");
    const rimLayer = tree.root.findAllByType("View").find(
      (node) => flat(node.props.style).borderColor === "rgba(59, 130, 246, 1)",
    );
    expect(rimLayer).toBeTruthy();
  });

  it("GlassBox odak: yüzey aynı kalır, kenar ışığı vurgu rengine döner", () => {
    const tree = render(
      <GlassBox role="field" focused accent="#00FF88" style={{ borderRadius: 12, backgroundColor: "#202020" }} />,
    );
    const views = tree.root.findAllByType("View");
    expect(views.some((node) => flat(node.props.style).borderColor === "#00FF88")).toBe(true);
    expect(views.some((node) => flat(node.props.style).backgroundColor === "rgba(32, 32, 32, 0.8)")).toBe(true);
  });

  it("GlassTextInput: kutu buzlu cama geçer, yazı iç TextInput'ta", () => {
    const tree = render(
      <GlassTextInput style={{ borderRadius: 12, backgroundColor: "#202020", height: 44, color: "#fff" }} />,
    );
    const input = tree.root.findByType("TextInput");
    expect(flat(input.props.style).color).toBe("#fff");
    expect(flat(input.props.style).backgroundColor).toBeUndefined();
  });
});
