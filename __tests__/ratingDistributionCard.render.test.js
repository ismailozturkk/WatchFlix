import React from "react";
import { act, create } from "react-test-renderer";

// Profil "Puan dağılımı" kartı: 10 sütun çizilir, sütun boyu sayıyla orantılı,
// en sık kademe tam opak; arkadaş profilinde (hideWhenEmpty) puan yoksa kart hiç
// çizilmez, kendi profilde boş hâl metni görünür. Görünüm cihazda doğrulanır;
// bu test yalnız neyin çizildiğini kilitler.

jest.mock("react-native", () => {
  class Value {
    constructor(v) {
      this.v = v;
    }
  }
  return {
    View: "View",
    Text: "Text",
    Pressable: "Pressable",
    StyleSheet: {
      create: (s) => s,
      absoluteFill: { position: "absolute" },
      absoluteFillObject: { position: "absolute" },
    },
    Animated: {
      View: "AnimatedView",
      Value,
      spring: () => ({ start: () => {} }),
      stagger: () => ({ start: () => {} }),
    },
    PanResponder: { create: () => ({ panHandlers: {} }) },
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("../components/common/GlassBox", () => {
  const React = require("react");
  return { __esModule: true, default: ({ children, ...rest }) => React.createElement("GlassBox", rest, children) };
});
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      secondary: "#111111",
      border: "#333333",
      colors: { orange: "#F97316" },
      text: { primary: "#ffffff", muted: "#888888" },
    },
  }),
}));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../services/hapticsService", () => ({ selectionAsync: () => Promise.resolve() }));

const RatingDistributionCard = require("../components/profile/RatingDistributionCard").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let consoleError;
beforeEach(() => {
  const original = console.error;
  consoleError = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
  renderer = null;
  consoleError.mockRestore();
});

async function render(props) {
  await act(() => {
    renderer = create(<RatingDistributionCard {...props} />);
  });
}

const flat = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const bars = () => renderer.root.findAllByType("AnimatedView").map((n) => flat(n.props.style));
const texts = () =>
  renderer.root
    .findAllByType("Text")
    .map((n) => [n.props.children].flat(Infinity).filter((c) => typeof c === "string").join(""))
    .join(" | ");

test("dolu kademeler sayıyla orantılı sütun çizer; en sık kademe tam opak", async () => {
  await render({ ratings: { a: 8.5, b: 8.5, c: 8.5, d: 8.5, e: 6, f: 2, g: null } });
  const drawn = bars();
  // 20 yarım puan kademesinden 2, 6 ve 8,5 dolu → üç sütun
  expect(drawn).toHaveLength(3);
  const heights = drawn.map((s) => s.height);
  expect(Math.max(...heights)).toBe(40);
  expect(heights).toContain(10); // 1/4 oran
  expect(drawn.filter((s) => s.opacity === 1)).toHaveLength(1);
  expect(texts()).toContain("6 puan");
  // Ortalama artık etiketsiz bir hap; adı ekran okuyucuya söylenir.
  expect(renderer.root.findAll((n) => n.props.accessibilityLabel === "ortalama 7,0")).not.toHaveLength(0);
  // (8.5*4 + 6 + 2) / 6 = 7.0 → 10 yıldız ölçeğinde 7,0
  expect(texts()).toContain("7,0");
  // En sık kademe etiketi sayı + yıldız: "8,5"
  expect(texts()).toContain("8,5");
});

test("arkadaş profilinde puan yoksa kart çizilmez", async () => {
  await render({ ratings: {}, hideWhenEmpty: true });
  expect(renderer.toJSON()).toBeNull();
});

test("kendi profilde boş hâl metni ve soluk çan eğrisi görünür", async () => {
  await render({ ratings: null });
  expect(texts()).toContain("Puanladıkça dağılımın burada şekillenir");
  expect(bars()).toHaveLength(20);
  expect(texts()).not.toContain("7,");
});

test("onPress verilince başlık düğme olur", async () => {
  const onPress = jest.fn();
  await render({ ratings: { a: 10 }, onPress });
  const button = renderer.root.findByType("Pressable");
  button.props.onPress();
  expect(onPress).toHaveBeenCalledTimes(1);
});
