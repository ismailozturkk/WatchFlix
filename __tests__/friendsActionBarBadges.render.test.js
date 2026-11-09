import React from "react";
import { act, create } from "react-test-renderer";
import FriendsActionBar from "../components/profile/FriendsActionBar";

// Profil şeridi (7 Kas kullanıcı kararı): "Mesajlar" tekil + grup okunmamış
// toplamını TEK rozette taşır (iki ayrı köşe rozeti denendi, kalabalık durdu);
// "Arkadaşlar" karosunda sayı değil her zaman ikon durur. Renk/yerleşim cihazda
// görülür; bu test yalnız neyin çizildiğini kilitler.

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  StyleSheet: { create: (s) => s, hairlineWidth: 1 },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("../components/common/GlassPressable", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ style, children, ...rest }) =>
      React.createElement("Pressable", { ...rest, style: style({ pressed: false }) }, children),
  };
});
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));

global.IS_REACT_ACT_ENVIRONMENT = true;

const theme = {
  accent: "#3388ff",
  secondary: "#111111",
  border: "#333333",
  text: { primary: "#ffffff" },
};

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

async function renderBar(props) {
  await act(() => {
    renderer = create(<FriendsActionBar theme={theme} incomingRequests={0} {...props} />);
  });
}

const flat = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const item = (label) =>
  renderer.root.findAll((n) => n.type === "Pressable" && n.props.accessibilityLabel.startsWith(label))[0];
// Rozet = konumu mutlak olan View; metni içindeki Text.
const badgesOf = (node) =>
  node
    .findAll((n) => n.type === "View" && flat(n.props.style).position === "absolute")
    .map((n) => n.findByType("Text").props.children);

describe("FriendsActionBar", () => {
  it("Mesajlar toplam okunmamışı tek rozette gösterir", async () => {
    await renderBar({ unreadMessages: 8 });
    expect(badgesOf(item("Mesajlar"))).toEqual(["8"]);
    expect(item("Mesajlar").props.accessibilityLabel).toBe("Mesajlar, 8");
  });

  it("okunmamış yoksa rozet yok, 99 üstü kısaltılır", async () => {
    await renderBar({ unreadMessages: 0 });
    expect(badgesOf(item("Mesajlar"))).toEqual([]);
    await act(() => renderer.unmount());
    await renderBar({ unreadMessages: 150 });
    expect(badgesOf(item("Mesajlar"))).toEqual(["99+"]);
  });

  it("dört hücre tek satırda, her birinin kendine has rengi var", async () => {
    await renderBar({});
    const items = renderer.root.findAll((n) => n.type === "Pressable");
    expect(items).toHaveLength(4);
    // Kök = yatay satır; dört hücre onun doğrudan çocukları.
    const root = renderer.toJSON();
    expect(flat(root.props.style).flexDirection).toBe("row");
    expect(root.children.map((c) => c.type)).toEqual(Array(4).fill("Pressable"));
    const iconColors = items.map((n) => n.findByType("AppIcon").props.color);
    expect(new Set(iconColors).size).toBe(4);
    const borders = items.map((n) => flat(n.props.style).borderColor);
    expect(new Set(borders).size).toBe(4);
  });

  it("Arkadaşlar karosunda sayı yerine ikon durur", async () => {
    await renderBar({ friendCount: 24 });
    const friends = item("Arkadaşlar");
    expect(friends.findAllByType("AppIcon").map((n) => n.props.name)).toEqual(["people"]);
    expect(friends.findAllByType("Text").map((n) => n.props.children)).toEqual(["Arkadaşlar"]);
    expect(friends.props.accessibilityLabel).toBe("Arkadaşlar");
  });
});
