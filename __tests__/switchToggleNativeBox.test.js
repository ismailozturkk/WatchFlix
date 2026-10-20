// iOS'ta SwitchToggle: dış kutu sistem anahtarının GERÇEK (ölçekli) boyunu
// bildirmeli ve anahtar kutuda ortalanmalı. ESKİ HATA: kutu sabit size×1.61,
// ölçek yalnız yükseklikten; iOS 26'nın geniş anahtarı kutudan yanlara taşıyor,
// ayrıca RN'nin `alignSelf:flex-start`ı yüzünden sola kayıyordu.
import React from "react";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => {
  const React = require("react");
  return {
    Platform: { OS: "ios", Version: "26.0" },
    Pressable: ({ children }) => <>{children}</>,
    StyleSheet: { create: (styles) => styles, absoluteFill: {} },
    View: ({ children, style }) => React.createElement("View", { style }, children),
    Switch: (props) => React.createElement("Switch", props),
  };
});

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: ({ children }) => children },
  useSharedValue: (initial) => ({ value: initial }),
  useAnimatedStyle: (fn) => fn(),
  withSpring: (value) => value,
  interpolateColor: (_p, _r, colors) => colors[0],
}));

const flat = (style) => Object.assign({}, ...[].concat(style).filter(Boolean));

function render(props) {
  // Her test modül düzeyindeki ölçüm önbelleğinden bağımsız başlasın. React ve
  // renderer de AYNI yalıtılmış kayıttan gelmeli (iki React kopyası hook'u bozar).
  let SwitchToggle;
  let renderer;
  jest.isolateModules(() => {
    SwitchToggle = require("../components/SwitchToggle").default;
    renderer = require("react-test-renderer");
  });
  const { act, create } = renderer;
  let tree;
  act(() => {
    tree = create(<SwitchToggle {...props} />);
  });
  const box = () => flat(tree.root.findByType("View").props.style);
  const sw = () => tree.root.findByType("Switch");
  const measure = (width, height) =>
    act(() => sw().props.onLayout({ nativeEvent: { layout: { width, height } } }));
  return { box, sw, measure };
}

describe("SwitchToggle (iOS) yerleşim kutusu", () => {
  test("ilk karede iOS 26 tahminiyle başlar: kutu genişliği size×1.75'i aşmaz", () => {
    const { box } = render({ size: 36 });
    expect(box().width).toBeLessThanOrEqual(36 * 1.75 + 1e-6);
    expect(box().height).toBe(36);
  });

  test("anahtar kutuda ortalanır (RN'nin flex-start varsayılanı ezilir)", () => {
    const { sw } = render({ size: 36 });
    const style = flat(sw().props.style);
    expect(style.alignSelf).toBe("center");
    expect(style.transform[0].scale).toBeGreaterThan(0);
  });

  test("onLayout gerçek ölçüyü verince kutu ve ölçek ona göre yeniden kurulur", () => {
    const { box, sw, measure } = render({ size: 36 });
    // Klasik 51×31 (+2): eski görünüm, yükseklik 36'ya oturur.
    measure(53, 31);
    expect(flat(sw().props.style).transform[0].scale).toBeCloseTo(36 / 31, 5);
    expect(box().width).toBeCloseTo(53 * (36 / 31), 5);
    // Geniş anahtar: genişlik bütçesine kısılır.
    measure(80, 28);
    expect(box().width).toBeCloseTo(36 * 1.75, 5);
  });

  test("küçük size'larda da anahtar kutudan taşmaz", () => {
    const { box, sw, measure } = render({ size: 20 });
    measure(65, 28);
    const scale = flat(sw().props.style).transform[0].scale;
    expect(65 * scale).toBeCloseTo(box().width, 5);
    expect(box().width).toBeLessThanOrEqual(20 * 1.75 + 1e-6);
  });

  test("kutu küçülmez: sıkışan satırda metin daralır, anahtar değil", () => {
    const { box } = render({ size: 36 });
    expect(box().flexShrink).toBe(0);
  });
});
