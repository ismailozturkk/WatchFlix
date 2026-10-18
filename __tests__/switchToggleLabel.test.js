// SwitchToggle erişilebilirlik adı: iki uygulama da (iOS sistem anahtarı, Android özel anahtar)
// `accessibilityLabel`ı iletmeli. ESKİ HATA: prop hiç iletilmiyordu; ekran okuyucu anahtarı
// adsız ("anahtar, açık") okurdu — hangi ayarı açtığı belli olmazdı (yıllık hedef sayfasında
// Film hedefi / Dizi hedefi anahtarları).
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: "AnimatedView" },
  useSharedValue: (initial) => ({ value: initial }),
  useAnimatedStyle: (fn) => fn(),
  withSpring: (value) => value,
  interpolateColor: (_p, _r, colors) => colors[0],
}));

function load(os) {
  let SwitchToggle;
  jest.isolateModules(() => {
    // İzole kayıt defteri ikinci bir React kopyası yüklerdi ("Invalid hook call"): testteki React'i ver.
    jest.doMock("react", () => React);
    jest.doMock("react-native", () => ({
      Platform: { OS: os, Version: os === "ios" ? "18.0" : 34 },
      Pressable: "Pressable",
      Switch: "Switch",
      View: "View",
      StyleSheet: { create: (s) => s, absoluteFill: {} },
    }));
    SwitchToggle = require("../components/SwitchToggle").default;
  });
  return SwitchToggle;
}

const render = (Component, props) => {
  let tree;
  act(() => { tree = create(<Component {...props} />); });
  return tree;
};

let warn;
beforeEach(() => {
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => warn.mockRestore());

describe("SwitchToggle accessibilityLabel", () => {
  test("iOS sistem anahtarı etiketi iletir", () => {
    const SwitchToggle = load("ios");
    const tree = render(SwitchToggle, { value: true, onValueChange: () => {}, accessibilityLabel: "Film hedefi" });
    const node = tree.root.findByType("Switch");
    expect(node.props.accessibilityLabel).toBe("Film hedefi");
    expect(node.props.accessibilityRole).toBe("switch");
    expect(node.props.accessibilityState).toEqual({ checked: true, disabled: false });
  });

  test("Android özel anahtarı etiketi iletir", () => {
    const SwitchToggle = load("android");
    const tree = render(SwitchToggle, { value: false, onValueChange: () => {}, accessibilityLabel: "Dizi hedefi" });
    const node = tree.root.findByType("Pressable");
    expect(node.props.accessibilityLabel).toBe("Dizi hedefi");
    expect(node.props.accessibilityRole).toBe("switch");
  });

  test("etiket verilmeyen eski kullanımlar bozulmaz (undefined)", () => {
    const ios = render(load("ios"), { value: false, onValueChange: () => {} });
    expect(ios.root.findByType("Switch").props.accessibilityLabel).toBeUndefined();
    const android = render(load("android"), { value: false, onValueChange: () => {} });
    expect(android.root.findByType("Pressable").props.accessibilityLabel).toBeUndefined();
  });

  test("iOS kilitli anahtarın dokunma katmanı da etiketi taşır", () => {
    const SwitchToggle = load("ios");
    const tree = render(SwitchToggle, {
      value: false, onValueChange: () => {}, locked: true, onLockedPress: () => {}, accessibilityLabel: "Kar",
    });
    expect(tree.root.findByType("Pressable").props.accessibilityLabel).toBe("Kar");
  });
});
