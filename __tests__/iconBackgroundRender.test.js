// IconBacground: paylaşımlı modda desen tohumdan bir kez kurulur ve iki ekran
// AYNI element ağacını kullanır; öğe başına sarmalayıcı View yok; yoğunluk
// ayarı öğe sayısını değiştirir; tohum değişince desen yenilenir.
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

const mockSettings = {
  showIconBackground: true,
  iconBackgroundMode: "shared",
  iconBackgroundOpacity: 1,
  iconBackgroundDensity: "auto",
};
let mockSeed = 111;

jest.mock("react-native", () => ({
  View: ({ children }) => <div>{children}</div>,
  StyleSheet: { create: (s) => s },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
}));
jest.mock("expo-image", () => ({
  Image: (props) => <img data-src={String(props.source)} style={props.style} />,
}));
jest.mock("../components/iconBackgroundSources", () => ({
  __esModule: true,
  default: Array.from({ length: 174 }, (_, i) => i + 1),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useIconBackgroundSettings: () => mockSettings,
}));
jest.mock("../services/effectSettings", () => ({
  useEffectPreset: () => require("../utils/deviceTier").getEffectPreset("full"),
}));
jest.mock("../services/decorSeed", () => ({
  useDecorSeed: () => mockSeed,
}));

const IconBacground = require("../components/IconBacground").default;

function render(opacity = 0.5) {
  let tree;
  act(() => {
    tree = create(<IconBacground opacity={opacity} />);
  });
  return tree;
}
const images = (tree) => tree.root.findAll((n) => n.type === "img");
const layoutOf = (tree) => images(tree).map((n) => [n.props.style.top, n.props.style.left, n.props["data-src"]]);

test("auto + Tam mod → 4x7 = 28 görsel, sarmalayıcı yok", () => {
  const tree = render();
  expect(images(tree)).toHaveLength(28);
  // Kök div + 28 img; öğe başına div yok.
  expect(tree.root.findAll((n) => n.type === "div")).toHaveLength(1);
  expect(images(tree)[0].props.style.opacity).toBe(0.5);
});

test("iki ekran aynı tohumla birebir aynı deseni (aynı ağaç referansı) çizer", () => {
  const a = render();
  const b = render();
  expect(layoutOf(a)).toEqual(layoutOf(b));
  expect(a.toJSON()).toEqual(b.toJSON());
});

test("yoğunluk 'high' → 45, 'low' → 15", () => {
  mockSettings.iconBackgroundDensity = "high";
  expect(images(render())).toHaveLength(45);
  mockSettings.iconBackgroundDensity = "low";
  expect(images(render())).toHaveLength(15);
  mockSettings.iconBackgroundDensity = "auto";
});

test("tohum değişince desen değişir", () => {
  const before = layoutOf(render());
  mockSeed = 222;
  const after = layoutOf(render());
  expect(after).not.toEqual(before);
  mockSeed = 111;
  expect(layoutOf(render())).toEqual(before);
});

test("kapalıyken hiçbir şey çizilmez", () => {
  mockSettings.showIconBackground = false;
  expect(render().toJSON()).toBeNull();
  mockSettings.showIconBackground = true;
});
