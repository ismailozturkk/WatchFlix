// Liquid Glass düğme ailesi: GlassCloseButton (başlık kapat/geri),
// GlassIconButton `flatFallback` ve GlassPillButton (etiketli hap).
//
// Asıl sözleşme: cam ÇİZİLEMİYORSA (Android, iOS 18–25, Efektler: Kapalı) çağıranın
// ESKİ kutusu (boyut, köşe, zemin, çerçeve) aynen çıkar; cam çiziliyorsa
// yuvarlak/hap cam çıkar ve cam yolunda opaklık/gölge YOKTUR (cam kuralları).
// Android buzlu camında şekil camla aynı (daire/hap), yüzey buzlu, basma saydamlığı kalır.
import React from "react";
import { act, create } from "react-test-renderer";
import GlassCloseButton from "../components/common/GlassCloseButton";
import GlassIconButton from "../components/common/GlassIconButton";
import GlassPillButton from "../components/common/GlassPillButton";

global.IS_REACT_ACT_ENVIRONMENT = true;

let mockGlass = false;
const mockTheme = {
  primary: "#111111",
  secondary: "#222222",
  border: "#333333",
  text: { primary: "#EEEEEE", muted: "#888888" },
};

jest.mock("react-native", () => {
  const React = require("react");
  return {
    View: "View",
    Text: "Text",
    ActivityIndicator: "ActivityIndicator",
    Pressable: (props) => React.createElement("Pressable", props, props.children),
    StyleSheet: { create: (styles) => styles, flatten: (style) => style },
  };
});

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

// Derleme eklentisi `Text`i AppText'e çevirir (uygulama fontu); test için düz "Text".
jest.mock("../components/typography/AppText", () => {
  const React = require("react");
  const host = (props) => React.createElement("Text", props, props.children);
  return { __esModule: true, AppText: host, AppTextInput: host, AnimatedAppText: host, ReanimatedAppText: host };
});

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

jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));

const flat = (style) =>
  [].concat(style).flat(Infinity).filter(Boolean).reduce((acc, item) => ({ ...acc, ...item }), {});

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}

// Pressable'ın (pressed durumuna bağlı) stilini düz nesneye çevirir.
const pressableStyle = (tree, pressed = false) => {
  const { style } = tree.root.findByType("Pressable").props;
  return flat(typeof style === "function" ? style({ pressed }) : style);
};

beforeEach(() => {
  mockGlass = false;
});

describe("GlassCloseButton — cam kapalı (eski kutu aynen)", () => {
  it("çağıranın boyutu, köşesi ve zemini korunur; Kapat etiketi gelir", () => {
    const tree = render(
      <GlassCloseButton size={34} fallbackRadius={11} backgroundColor="#abcdef" onPress={() => {}} />,
    );
    const press = tree.root.findByType("Pressable");
    expect(press.props.accessibilityLabel).toBe("Kapat");
    const box = flat(tree.root.findByType("View").props.style);
    expect(box).toMatchObject({ width: 34, height: 34, borderRadius: 11, backgroundColor: "#abcdef" });
  });

  it("varsayılan zemin theme.primary; çerçeve verilirse eklenir", () => {
    const plain = render(<GlassCloseButton onPress={() => {}} />);
    expect(flat(plain.root.findByType("View").props.style).backgroundColor).toBe("#111111");
    expect(flat(plain.root.findByType("View").props.style).borderWidth).toBeUndefined();

    const bordered = render(<GlassCloseButton borderColor="#445566" onPress={() => {}} />);
    expect(flat(bordered.root.findByType("View").props.style)).toMatchObject({
      borderColor: "#445566",
      borderWidth: 1,
    });
  });

  it("geri ikonu 'Geri' etiketi alır", () => {
    const tree = render(<GlassCloseButton icon="chevron-back" onPress={() => {}} />);
    expect(tree.root.findByType("Pressable").props.accessibilityLabel).toBe("Geri");
  });

  it("onImage: blur ÇİZMEZ, eski yarı saydam koyu zemin düz kalır", () => {
    const tree = render(<GlassCloseButton onImage onPress={() => {}} />);
    expect(tree.root.findAllByType("AdaptiveBlurView")).toHaveLength(0);
    expect(flat(tree.root.findByType("View").props.style).backgroundColor).toBe("rgba(0,0,0,0.45)");
  });

  it("basınca eski yolda opaklık düşer", () => {
    const tree = render(<GlassCloseButton onPress={() => {}} />);
    expect(pressableStyle(tree, true).opacity).toBe(0.8);
  });
});

describe("GlassCloseButton — cam açık", () => {
  beforeEach(() => {
    mockGlass = true;
  });

  it("yuvarlak cam (size/2); eski köşe/zemin cama sızmaz; basınca opaklık YOK", () => {
    const tree = render(
      <GlassCloseButton size={34} fallbackRadius={11} backgroundColor="#abcdef" onPress={() => {}} />,
    );
    const glass = tree.root.findByType("GlassView");
    expect(flat(glass.props.style)).toMatchObject({ width: 34, height: 34, borderRadius: 17 });
    expect(flat(glass.props.style).backgroundColor).toBeUndefined();
    expect(glass.props.isInteractive).toBe(true);
    expect(pressableStyle(tree, true).opacity).toBeUndefined();
  });

  it("onImage: temadan bağımsız koyu cam", () => {
    const tree = render(<GlassCloseButton onImage onPress={() => {}} />);
    expect(tree.root.findByType("GlassView").props.colorScheme).toBe("dark");
  });
});

describe("GlassIconButton — flatFallback", () => {
  it("blur varyantı cam yokken normalde AdaptiveBlurView çizer", () => {
    const tree = render(<GlassIconButton variant="blur" icon="close" onPress={() => {}} />);
    expect(tree.root.findAllByType("AdaptiveBlurView")).toHaveLength(1);
  });

  it("flatFallback ile blur yerine düz zemin kullanılır", () => {
    const tree = render(
      <GlassIconButton
        variant="blur"
        flatFallback
        icon="close"
        fallbackStyle={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        onPress={() => {}}
      />,
    );
    expect(tree.root.findAllByType("AdaptiveBlurView")).toHaveLength(0);
    expect(flat(tree.root.findByType("View").props.style).backgroundColor).toBe("rgba(0,0,0,0.5)");
  });
});

describe("GlassPillButton", () => {
  const base = { label: "Oluştur", icon: "checkmark-circle", onPress: () => {} };

  it("cam kapalı: eski kutu + köşe; basınca hafif opaklık", () => {
    const tree = render(
      <GlassPillButton {...base} height={52} fallbackRadius={18} fallbackStyle={{ backgroundColor: "#ff0000" }} />,
    );
    expect(flat(tree.root.findByType("View").props.style)).toMatchObject({
      height: 52,
      borderRadius: 18,
      backgroundColor: "#ff0000",
    });
    expect(pressableStyle(tree, true).opacity).toBe(0.85);
  });

  it("cam kapalı + devre dışı: opaklık 0.4 ve onPress çalışmaz", () => {
    const onPress = jest.fn();
    const tree = render(<GlassPillButton {...base} onPress={onPress} disabled />);
    expect(pressableStyle(tree).opacity).toBe(0.4);
    expect(tree.root.findByType("Pressable").props.onPress).toBeUndefined();
  });

  it("cam açık: hap (yükseklik/2), ton iletilir, opaklık YOK", () => {
    mockGlass = true;
    const tree = render(<GlassPillButton {...base} height={52} tint="#00ff00" />);
    const glass = tree.root.findByType("GlassView");
    expect(flat(glass.props.style)).toMatchObject({ height: 52, borderRadius: 26 });
    expect(glass.props.tintColor).toBe("#00ff00");
    expect(glass.props.isInteractive).toBe(true);
    expect(pressableStyle(tree, true).opacity).toBeUndefined();
  });

  it("cam açık + devre dışı: ton kalkar, etkileşim kapanır, içerik soluk, opaklık YOK", () => {
    mockGlass = true;
    const tree = render(<GlassPillButton {...base} tint="#00ff00" color="#ffffff" disabled />);
    const glass = tree.root.findByType("GlassView");
    expect(glass.props.tintColor).toBeUndefined();
    expect(glass.props.isInteractive).toBe(false);
    expect(tree.root.findByType("Text").props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: "#888888" })]),
    );
    expect(pressableStyle(tree).opacity).toBeUndefined();
  });

  it("yükleniyorken etiket yerine spinner, dokunma kapalı", () => {
    const tree = render(<GlassPillButton {...base} loading />);
    expect(tree.root.findAllByType("ActivityIndicator")).toHaveLength(1);
    expect(tree.root.findAllByType("Text")).toHaveLength(0);
    expect(tree.root.findByType("Pressable").props.onPress).toBeUndefined();
    expect(tree.root.findByType("Pressable").props.accessibilityState).toMatchObject({ busy: true });
  });
});

describe("Android buzlu cam", () => {
  beforeEach(() => {
    mockGlass = "frosted";
  });

  it("GlassCloseButton: cam şekli (size/2), yüzey eski zeminin buzlu hâli, basınca opaklık VAR", () => {
    const tree = render(
      <GlassCloseButton size={34} fallbackRadius={11} backgroundColor="#abcdef" onPress={() => {}} />,
    );
    expect(tree.root.findAllByType("GlassView")).toHaveLength(0);
    const box = flat(tree.root.findAllByType("View")[0].props.style);
    expect(box).toMatchObject({ width: 34, height: 34, borderRadius: 17 });
    expect(box.backgroundColor).toBe("rgba(171, 205, 239, 0.94)");
    expect(pressableStyle(tree, true).opacity).toBe(0.8);
  });

  it("GlassIconButton plain: Android'de de çıplak ikon değil, yuvarlak buzlu düğme", () => {
    const tree = render(<GlassIconButton variant="plain" icon="add" size={40} onPress={() => {}} />);
    const box = flat(tree.root.findAllByType("View")[0].props.style);
    expect(box.borderRadius).toBe(20);
    expect(box.backgroundColor).toBe("rgba(34, 34, 34, 0.8)");
  });

  it("GlassIconButton blur: blur hedefi AdaptiveBlurView'a iletilir (gerçek blur)", () => {
    const target = { current: {} };
    const tree = render(<GlassIconButton variant="blur" icon="close" size={38} blurTarget={target} onPress={() => {}} />);
    const blur = tree.root.findByType("AdaptiveBlurView");
    expect(blur.props.blurTarget).toBe(target);
    expect(flat(blur.props.style).borderRadius).toBe(19);
  });

  it("GlassPillButton: hap (yükseklik/2); devre dışı eski yoldaki gibi opaklıkla", () => {
    const tree = render(
      <GlassPillButton label="Kaydet" height={48} fallbackRadius={18} disabled fallbackStyle={{ backgroundColor: "#3B82F6" }} />,
    );
    expect(flat(tree.root.findAllByType("View")[0].props.style).borderRadius).toBe(24);
    expect(pressableStyle(tree).opacity).toBe(0.4);
  });
});
