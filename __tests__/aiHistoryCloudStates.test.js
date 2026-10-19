import React from "react";
import { act, create } from "react-test-renderer";
import { RefreshControl, SectionList } from "react-native";
import AIHistory from "../components/ai/AIHistory";
import { getAiCopy } from "../utils/aiCopy";

// components/ai/AIHistory.js — hesaba yedeklenen geçmişin görünür durumları:
//   • yeni telefonda liste iniyor → "yükleniyor" (boş liste gibi görünmesin)
//   • çevrimdışı yeni telefon → "bağlan"
//   • gerçekten boş → "henüz sohbet yok" + bulut notu
//   • dolu liste → bulut notu altbilgide, aşağı çekince yenileme
// Proje jest'i RN çalıştırmaz (jest.config.js): react-native elle taklit edilir.

jest.mock("react-native", () => {
  const React = require("react");
  const host = (name) => ({ children, ...rest }) => React.createElement(name, rest, children);
  return {
    View: host("View"),
    Text: host("Text"),
    TextInput: host("TextInput"),
    TouchableOpacity: host("TouchableOpacity"),
    ActivityIndicator: host("ActivityIndicator"),
    RefreshControl: host("RefreshControl"),
    // Gerçek ScrollView refreshControl'ü kendi çizer; taklit çocuk olarak koyar.
    ScrollView: ({ children, refreshControl, ...rest }) =>
      React.createElement("ScrollView", rest, refreshControl, children),
    SectionList: ({ sections, renderItem, renderSectionHeader, ListFooterComponent, refreshControl, ...rest }) =>
      React.createElement(
        "SectionList",
        rest,
        refreshControl,
        sections.map((section) =>
          React.createElement(
            "Section",
            { key: section.key },
            renderSectionHeader({ section }),
            section.data.map((item, index) =>
              React.createElement("Row", { key: item.id }, renderItem({ item, index })),
            ),
          ),
        ),
        ListFooterComponent,
      ),
    StyleSheet: { create: (s) => s, hairlineWidth: 1 },
  };
});
// babel eklentisi (scripts/babel-transform-app-text.js) Text/TextInput'u AppText'e çevirir;
// gerçek modül reanimated'i çeker, testte düz host bileşenleri yeter.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("@expo/vector-icons/MaterialIcons", () => ({ __esModule: true, default: "Icon" }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const theme = {
  primary: "#111111",
  secondary: "#222222",
  between: "#333333",
  bold: "#ffffff",
  border: "#444444",
  accent: "#00aaff",
  text: { primary: "#ffffff", secondary: "#cccccc", muted: "#999999" },
  colors: { red: "#ff0000" },
};

const copy = getAiCopy("tr");

const baseProps = (over = {}) => ({
  theme,
  t: { AICineChat: { noConversations: "Henüz kayıtlı sohbet yok", messagesCount: "mesaj" } },
  copy,
  language: "tr",
  conversations: [],
  activeId: null,
  getTmdbUrl: (p) => `https://img${p}`,
  onOpen: jest.fn(),
  onDelete: jest.fn(),
  onClearAll: jest.fn(),
  ...over,
});

const render = (props) => {
  let tree;
  act(() => {
    tree = create(React.createElement(AIHistory, props));
  });
  return tree.root;
};

const textOf = (root) =>
  root
    .findAllByType("Text")
    .map((node) => [].concat(node.props.children).join(""))
    .join("|");

const chat = (id, updatedAt) => ({
  id,
  title: `Sohbet ${id}`,
  messages: [{ id: "u", role: "user", text: "film öner" }],
  createdAt: updatedAt,
  updatedAt,
});

describe("boş liste durumları", () => {
  test("yerel kopya yok + indirme sürüyor → yükleniyor (boş mesajı DEĞİL)", () => {
    const root = render(baseProps({ sync: { ready: false, hydrating: true, waiting: false } }));
    const metin = textOf(root);
    expect(metin).toContain(copy.history.loading);
    expect(metin).not.toContain("Henüz kayıtlı sohbet yok");
    expect(root.findAllByType("ActivityIndicator")).toHaveLength(1);
  });

  test("yerel kopya yok + indirme sürmüyor → bağlantı bekleniyor", () => {
    const root = render(baseProps({ sync: { ready: false, hydrating: false, waiting: true } }));
    const metin = textOf(root);
    expect(metin).toContain(copy.history.waiting);
    expect(metin).not.toContain("Henüz kayıtlı sohbet yok");
    expect(root.findAllByType("ActivityIndicator")).toHaveLength(0);
  });

  test("hazır ve gerçekten boş → 'henüz yok' + bulut notu", () => {
    const root = render(baseProps({ sync: { ready: true, hydrating: false, waiting: false } }));
    const metin = textOf(root);
    expect(metin).toContain("Henüz kayıtlı sohbet yok");
    expect(metin).toContain(copy.history.cloudNote);
  });

  test("sync verilmezse eski davranış: 'henüz yok'", () => {
    expect(textOf(render(baseProps()))).toContain("Henüz kayıtlı sohbet yok");
  });

  test("boş liste de aşağı çekilebilir (ikinci cihazda sohbetleri getirmek için)", () => {
    const onRefresh = jest.fn();
    const root = render(baseProps({ onRefresh, sync: { ready: true, hydrating: false, waiting: false } }));
    root.findByType(RefreshControl).props.onRefresh();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

describe("dolu liste", () => {
  test("bulut notu altbilgide; aşağı çekme yenilemeyi çağırır, refreshing yansır", () => {
    const onRefresh = jest.fn();
    const root = render(
      baseProps({
        conversations: [chat("a", 3), chat("b", 2)],
        onRefresh,
        refreshing: true,
        sync: { ready: true, hydrating: false, waiting: false },
      }),
    );
    const metin = textOf(root);
    expect(metin).toContain("Sohbet a");
    expect(metin).toContain("Sohbet b");
    expect(metin).toContain(copy.history.cloudNote);

    const control = root.findByType(RefreshControl);
    expect(control.props.refreshing).toBe(true);
    control.props.onRefresh();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(root.findAllByType(SectionList)).toHaveLength(1);
  });

  test("onRefresh verilmezse yenileme denetimi yok", () => {
    const root = render(baseProps({ conversations: [chat("a", 3)] }));
    expect(root.findAllByType(RefreshControl)).toHaveLength(0);
  });

  test("dolu listede sync 'bekliyor' olsa bile sohbetler gizlenmez", () => {
    const root = render(
      baseProps({
        conversations: [chat("a", 3)],
        sync: { ready: false, hydrating: true, waiting: false },
      }),
    );
    const metin = textOf(root);
    expect(metin).toContain("Sohbet a");
    expect(metin).not.toContain(copy.history.loading);
  });
});

describe("kopya metinleri", () => {
  test.each(["tr", "en", "es", "pt"])("%s: bulut ve silme metinleri dolu", (lang) => {
    const c = getAiCopy(lang);
    expect(c.history.cloudNote.length).toBeGreaterThan(10);
    expect(c.history.loading.length).toBeGreaterThan(5);
    expect(c.history.waiting.length).toBeGreaterThan(5);
    expect(c.history.clearAllMessage.length).toBeGreaterThan(5);
    expect(c.settings.clearHistoryMessage.length).toBeGreaterThan(5);
    expect(c.settings.historyLimitHint.length).toBeGreaterThan(5);
  });
});
