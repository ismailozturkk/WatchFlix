// Ayarlar'daki plan simülatörü kartı (components/settings/DevPlanSimulatorCard.js).
// Release'de HİÇ çizilmemeli; geliştirmede 4 seçenek sunmalı ve dokunuş planı
// gerçekten değiştirmeli. Ağ/mağaza yok: yalnız kartın kendi davranışı.
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => ({
  Pressable: "Pressable",
  Text: "Text",
  View: "View",
  StyleSheet: { create: (styles) => styles },
}));

// Derleme eklentisi (scripts/babel-transform-app-text.js) `Text`'i AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));

jest.mock("@components/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));

jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      secondary: "#111111",
      border: "#333333",
      accent: "#22AAFF",
      text: { primary: "#FFFFFF", muted: "#999999" },
      colors: { orange: "#F59E0B" },
    },
  }),
}));

jest.mock("../context/PremiumContext", () => ({
  usePremium: () => ({ plan: "premium", realPlan: "free" }),
}));

function mount({ dev }) {
  jest.resetModules();
  global.__DEV__ = dev;
  // jest.resetModules yeni bir React örneği getirir; kartı ve test renderer'ı
  // aynı örnekle yükle.
  const ReactFresh = require("react");
  const { act: actFresh, create: createFresh } = require("react-test-renderer");
  const Card = require("../components/settings/DevPlanSimulatorCard").default;
  const sim = require("../services/devPlanOverride");
  let tree;
  actFresh(() => {
    tree = createFresh(ReactFresh.createElement(Card));
  });
  return { tree, sim, act: actFresh };
}

const texts = (tree) =>
  tree.root
    .findAllByType("Text")
    .map((node) => [].concat(node.props.children).join(""));

afterEach(() => {
  global.__DEV__ = false;
  jest.resetModules();
});

test("release: kart hiçbir şey çizmez", () => {
  const { tree } = mount({ dev: false });
  expect(tree.toJSON()).toBeNull();
});

test("geliştirme: Gerçek/Free/Premium/Max seçenekleri ve etkin/gerçek plan özeti", () => {
  const { tree } = mount({ dev: true });
  const all = texts(tree);
  for (const label of ["Gerçek", "Free", "Premium", "Max"]) {
    expect(all).toContain(label);
  }
  expect(all.some((line) => line.includes("Etkin:") && line.includes("Gerçek:"))).toBe(true);
});

test("geliştirme: seçeneğe dokunmak simülatör seçimini değiştirir", () => {
  const { tree, sim, act: actFresh } = mount({ dev: true });
  const buttons = tree.root.findAllByType("Pressable");
  expect(buttons).toHaveLength(4);

  actFresh(() => buttons[3].props.onPress()); // Max
  expect(sim.getDevPlanOverride()).toBe("unlimited");

  actFresh(() => buttons[1].props.onPress()); // Free
  expect(sim.getDevPlanOverride()).toBe("free");

  actFresh(() => buttons[0].props.onPress()); // Gerçek
  expect(sim.getDevPlanOverride()).toBe("real");
});

test("geliştirme: seçili seçenek erişilebilirlikte işaretlenir", () => {
  const { tree, sim, act: actFresh } = mount({ dev: true });
  actFresh(() => sim.setDevPlanOverride("premium"));

  const selected = tree.root
    .findAllByType("Pressable")
    .filter((node) => node.props.accessibilityState?.selected)
    .map((node) => node.findByType("Text").props.children);
  expect(selected).toEqual(["Premium"]);
});
