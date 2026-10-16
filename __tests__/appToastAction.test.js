// Toast kartındaki eylem düğmesi ("Geri Al"): Toast.show({ props: { action } }).
//
// Kart ThemeContext/LinearGradient/rozet bileşenlerine bağlı; hepsi sahte. Doğrulanan:
// eylem varken düğme çıkar ve çarpının yerini alır, basınca toast kapanıp eylem çalışır,
// eylem yokken eski görünüm (çarpı) değişmez.
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles) => styles, absoluteFill: {} },
  Text: "Text",
  View: "View",
}));
// Derleme eklentisi (scripts/babel-transform-app-text.js) `Text`'i AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Ionicons" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
}));
jest.mock("@context/ThemeContext", () => ({
  useTheme: () => ({
    theme: { secondary: "#s", text: { primary: "#t1", secondary: "#t2" } },
  }),
}));
jest.mock("@components/badges/AppBadge", () => ({ __esModule: true, default: "AppBadge" }));
jest.mock("@theme/badgeTokens", () => ({
  kademeRengi: jest.fn(),
  kademeSekli: jest.fn(),
  rarityStyle: jest.fn(),
}));

const Toast = require("react-native-toast-message").default;
const { toastConfig } = require("../components/AppToast");

const render = (props) => {
  let tree;
  act(() => {
    tree = create(toastConfig.info({ text1: "Telefonun takvimine eklendi", ...props }));
  });
  return tree;
};
const pressables = (tree) => tree.root.findAllByType("Pressable");
const byLabel = (tree, label) =>
  pressables(tree).find((n) => n.props.accessibilityLabel === label);

beforeEach(() => jest.clearAllMocks());

describe("AppToast eylem düğmesi", () => {
  it("eylem varken etiketli düğme çıkar; basınca toast kapanır ve eylem çalışır", () => {
    const onPress = jest.fn();
    const tree = render({ props: { action: { label: "Geri Al", onPress } } });

    const btn = byLabel(tree, "Geri Al");
    expect(btn).toBeDefined();
    expect(btn.findByType("Text").props.children).toBe("Geri Al");

    act(() => btn.props.onPress());

    expect(Toast.hide).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("eylem düğmesi kapat çarpısının yerini alır", () => {
    const withAction = render({ props: { action: { label: "Geri Al", onPress: jest.fn() } } });
    const names = (tree) => tree.root.findAllByType("Ionicons").map((n) => n.props.name);

    expect(names(withAction)).toContain("arrow-undo");
    expect(names(withAction)).not.toContain("close");
  });

  it("eylem yokken eski görünüm: çarpı var, düğme yok", () => {
    const tree = render({});
    const names = tree.root.findAllByType("Ionicons").map((n) => n.props.name);

    expect(names).toContain("close");
    expect(names).not.toContain("arrow-undo");
    // Tek Pressable: kartın kendisi.
    expect(pressables(tree)).toHaveLength(1);
  });

  it("kartın kendisine dokunmak yine yalnız kapatır (eylemi çalıştırmaz)", () => {
    const onPress = jest.fn();
    const tree = render({ props: { action: { label: "Geri Al", onPress } } });

    act(() => pressables(tree)[0].props.onPress());

    expect(Toast.hide).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
