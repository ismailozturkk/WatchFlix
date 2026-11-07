import React from "react";
import { act, create } from "react-test-renderer";
import SharedMediaCollection, {
  compositionLabel,
  computeLayout,
  mediaMetaLabel,
} from "../components/chat/SharedMediaCollection";

// Sohbetteki "#" aramasından gönderilen liste balonu: başlık/dağılım, 6'dan
// fazla öğede "+N" katlama, açma/kapama, dokunuş bağlantısı ve rastgele seçim.

jest.mock("react-native", () => {
  const React = require("react");
  const passthrough = (name) => ({ children, ...rest }) => React.createElement(name, rest, children);
  class Value {
    constructor(v) { this.v = v; }
    setValue(v) { this.v = v; }
    interpolate() { return this; }
    addListener() { return "listener"; }
    removeListener() {}
    stopAnimation() {}
  }
  return {
    View: "View",
    Text: "Text",
    TouchableOpacity: passthrough("TouchableOpacity"),
    ScrollView: passthrough("ScrollView"),
    StyleSheet: { create: (s) => s, absoluteFill: { position: "absolute" }, hairlineWidth: 1 },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    LayoutAnimation: { configureNext: () => {}, Presets: { easeInEaseOut: {} } },
    Platform: { OS: "ios" },
    UIManager: {},
    Easing: { out: (value) => value, cubic: "cubic" },
    Animated: {
      Value,
      View: "AnimatedView",
      spring: () => ({ start: () => {} }),
      timing: () => ({ start: () => {} }),
    },
  };
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../utils/i18nText", () => ({
  i18nText: (_key, fallback, params) =>
    Object.entries(params || {}).reduce(
      (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
      fallback,
    ),
}));
const mockTheme = {
  secondary: "#1b1b1b",
  between: "#222222",
  border: "#333333",
  accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));

const mk = (n, type = "movie") =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    media_type: type,
    title: `Eser ${i + 1}`,
    poster_path: `/p${i + 1}.jpg`,
    release_date: "2020-01-01",
    vote_average: 7.2,
  }));

const textOf = (renderer) =>
  renderer.root
    .findAll((n) => n.type === "Text")
    .map((n) => [].concat(n.props.children).join(""))
    .join(" | ");

const render = (props) => {
  let renderer;
  act(() => {
    renderer = create(<SharedMediaCollection getTmdbUrl={(p) => "https://img.test" + p} {...props} />);
  });
  return renderer;
};

afterEach(() => jest.useRealTimers());

test("başlık ve içerik dağılımı", () => {
  const items = [...mk(2), ...mk(3, "tv").map((it) => ({ ...it, id: it.id + 10 }))];
  const r = render({ items, listTitle: "Bu akşam" });
  const text = textOf(r);
  expect(text).toContain("Bu akşam");
  expect(text).toContain("2 film · 3 dizi");
  expect(text).toContain("2020 · Dizi");
  expect(compositionLabel(mk(4, "person"))).toBe("4 oyuncu");
});

test("başlıksız liste 'Paylaşılan liste' der", () => {
  expect(textOf(render({ items: mk(3) }))).toContain("Paylaşılan liste");
});

test("uzun liste tek satırlı yatay rayda tüm küçük afişleri gösterir", () => {
  const r = render({ items: mk(12) });
  const rail = r.root.findByType("ScrollView");
  expect(rail.props.horizontal).toBe(true);
  expect(rail.props.showsHorizontalScrollIndicator).toBe(false);
  expect(r.root.findAll((n) => n.type === "Image")).toHaveLength(12);
});

test("afişe dokunmak öğeyi açar", () => {
  const onOpenItem = jest.fn();
  const items = mk(3);
  const r = render({ items, onOpenItem });
  const card = r.root.find(
    (n) => n.type === "TouchableOpacity" && n.props.accessibilityLabel === "Eser 2, 2020 · Film",
  );
  act(() => card.props.onPress());
  expect(onOpenItem).toHaveBeenCalledWith(items[1]);
});

test("rastgele seçim yatay listedeki bir öğeyi seçer", () => {
  jest.useFakeTimers();
  const r = render({ items: mk(9) });
  const btn = r.root.find(
    (n) => n.type === "TouchableOpacity" && textOf({ root: n }).includes("Rastgele Seç"),
  );
  act(() => btn.props.onPress());
  expect(r.root.findAll((n) => n.type === "Image")).toHaveLength(9);
  act(() => jest.runAllTimers());
  const banner = r.root.find(
    (n) => n.type === "AnimatedView" && textOf({ root: n }).includes("Seçilen"),
  );
  const picked = banner.findAll((n) => n.type === "Text").pop().props.children;
  expect(picked).toMatch(/^Eser \d$/);
  expect(textOf(r)).toContain("Yeniden seç");
});

test("oyuncu listesinde rastgele seçim yok, bölüm etiketi var", () => {
  const people = mk(3, "person").map((p) => ({ ...p, known_for_department: "Acting" }));
  const text = textOf(render({ items: people }));
  expect(text).not.toContain("Rastgele Seç");
  expect(text).toContain("Oyuncu");
  expect(mediaMetaLabel({ media_type: "person", known_for_department: "Directing" })).toBe("Yönetmen");
});

test("kartlar sabit küçük ölçüdedir ve yatay içerik genişliği doğru hesaplanır", () => {
  for (const n of [2, 3, 4, 5, 6, 12]) {
    const { cols, cardW, gridWidth, contentWidth } = computeLayout(n);
    expect(cardW).toBe(58);
    expect(gridWidth).toBeLessThanOrEqual(288);
    expect(contentWidth).toBe(cardW * cols + 8 * (cols - 1));
  }
});
