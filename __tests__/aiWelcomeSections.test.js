import React from "react";
import { act, create } from "react-test-renderer";
import AIWelcome, { splitChipLabel } from "../components/ai/AIWelcome";
import { getAiCopy } from "../utils/aiCopy";

// CineMatch boş ekranı: hazır istek bölümleri kapalı başlar (yalnız emoji
// önizlemesi), basınca açılıp kapanır, aynı anda tek bölüm açıktır; açık
// bölümdeki önizleme kartı AI'a giden metni gösterir ve basınca onu gönderir.

jest.mock("react-native", () => {
  const React = require("react");
  const passthrough = (name) => ({ children, ...rest }) => React.createElement(name, rest, children);
  return {
    View: "View",
    Text: "Text",
    ScrollView: passthrough("ScrollView"),
    TouchableOpacity: passthrough("TouchableOpacity"),
    Pressable: ({ children, ...rest }) =>
      React.createElement("Pressable", rest, typeof children === "function" ? children({ pressed: false }) : children),
    StyleSheet: { create: (s) => s, hairlineWidth: 1 },
  };
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../components/common/GlassTouchable", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children, activeOpacity, ...rest }) => React.createElement("Touchable", rest, children),
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../components/common/GlassBox", () => {
  const React = require("react");
  return { __esModule: true, default: ({ children, role, ...rest }) => React.createElement("GlassBox", rest, children) };
});
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("lottie-react-native", () => "Lottie");
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("@lottie/gemini.json", () => ({}), { virtual: true });

const theme = {
  primary: "#111111",
  secondary: "#1b1b1b",
  border: "#333333",
  accent: "#3388ff",
  bold: "#224488",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
const copy = getAiCopy("tr");
const t = {
  AICineChat: {
    tabs: { explore: "Keşfet", plan: "Karşılaştır & Planla", lists: "Listeler" },
    tabHints: { explore: "Sana uygun yapımlar", plan: "Karar ver", lists: "Seçkiler" },
  },
};
const chipsByTab = {
  explore: [
    { label: "🍿 Film öner", prompt: "Bana film öner" },
    { label: "📺 Dizi öner", prompt: "Bana dizi öner" },
    { label: "🔥 Bu akşam?", prompt: "Bu akşam ne?" },
    { label: "⏱️ Kısa", prompt: "Kısa film" },
    { label: "💎 Cevher", prompt: "Gizli cevher" },
    { label: copy.vibe.surprise, prompt: copy.vibe.surprisePrompt, preview: copy.vibe.surpriseHint },
  ],
  plan: [{ label: "🆚 Karşılaştır", prompt: "A ile B'yi karşılaştır" }],
  lists: [{ label: "Uzay", prompt: "Uzay listesi" }],
};

const render = (props = {}) => {
  let tree;
  act(() => {
    tree = create(
      <AIWelcome
        theme={theme}
        t={t}
        copy={copy}
        tabs={["explore", "plan", "lists"]}
        tabIcons={{ explore: "compass-outline", plan: "git-compare-outline", lists: "albums-outline" }}
        chipsByTab={chipsByTab}
        onOpenFilters={jest.fn()}
        onSendChip={jest.fn()}
        onVibe={jest.fn()}
        {...props}
      />,
    );
  });
  return tree.root;
};
const sectionHead = (root, title) =>
  root.find((node) => node.type === "Touchable" && node.props.accessibilityState && node.props.accessibilityLabel?.startsWith(title));
const texts = (root) => root.findAll((node) => node.type === "Text").map((node) => [].concat(node.props.children).join(""));
const cards = (root) => root.findAll((node) => node.type === "Pressable");

describe("splitChipLabel", () => {
  it("baştaki emojiyi ayırır, emojisiz etiketi olduğu gibi bırakır", () => {
    expect(splitChipLabel("🍿 Film öner")).toEqual({ emoji: "🍿", text: "Film öner" });
    expect(splitChipLabel("👨‍👩‍👧 Ailece izlenecekler")).toEqual({ emoji: "👨‍👩‍👧", text: "Ailece izlenecekler" });
    expect(splitChipLabel("Uzay filmleri")).toEqual({ emoji: null, text: "Uzay filmleri" });
    expect(splitChipLabel("Çok iyi")).toEqual({ emoji: null, text: "Çok iyi" });
  });
});

describe("AIWelcome hazır istek bölümleri", () => {
  it("önizleme kartı etkileşimsiz cam (GlassBox): basınca esneyip kaydırıcıda kesilmez", () => {
    const root = render();
    act(() => sectionHead(root, "Keşfet").props.onPress());
    const card = cards(root)[0];
    expect(card.findAll((node) => node.type === "GlassBox")).toHaveLength(1);
    expect(card.findAll((node) => node.type === "Touchable")).toHaveLength(0);
  });

  it("hepsi kapalı başlar; kapalı bölüm emoji önizlemesi ve +N gösterir", () => {
    const root = render();
    expect(cards(root)).toHaveLength(0);
    expect(sectionHead(root, "Keşfet").props.accessibilityState).toEqual({ expanded: false });
    const all = texts(root);
    expect(all).toEqual(expect.arrayContaining(["🍿", "📺", "🔥", "⏱️", "+2", "Film öner · Dizi öner · Bu akşam?"]));
  });

  it("basınca açılır, başka bölüm açılınca öncekini kapatır, yeniden basınca kapanır", () => {
    const root = render();
    act(() => sectionHead(root, "Keşfet").props.onPress());
    expect(sectionHead(root, "Keşfet").props.accessibilityState).toEqual({ expanded: true });
    expect(cards(root)).toHaveLength(6);

    act(() => sectionHead(root, "Karşılaştır").props.onPress());
    expect(sectionHead(root, "Keşfet").props.accessibilityState).toEqual({ expanded: false });
    expect(cards(root)).toHaveLength(1);

    act(() => sectionHead(root, "Karşılaştır").props.onPress());
    expect(cards(root)).toHaveLength(0);
  });

  it("kart AI metnini (ya da preview'ı) önizler ve basınca istemi gönderir", () => {
    const onSendChip = jest.fn();
    const root = render({ onSendChip });
    act(() => sectionHead(root, "Keşfet").props.onPress());
    const surprise = cards(root)[5];
    expect(surprise.props.accessibilityHint).toBe(copy.vibe.surpriseHint);
    expect(texts(root)).toContain(`“${copy.vibe.surpriseHint}”`);
    act(() => surprise.props.onPress());
    expect(onSendChip).toHaveBeenCalledWith(copy.vibe.surprisePrompt);
  });
});
