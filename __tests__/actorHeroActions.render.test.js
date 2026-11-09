// Oyuncu / yönetmen sayfası hero'su (screens/actor/ActorViewScreen.js):
//   • fotoğraf film/dizi detayındaki bulanık katmanlı yuvada (DetailHeroStage) — uzun
//     koyulaştırılmış alt şerit + kısa tema geçişi,
//   • "Takip et" / "Avatarım yap" yanında Yapay Zeka ve Sohbete gönder düğmeleri:
//     AI paneli kişi sorusuyla açılır, gönder seçilen sohbete kişi kartını taşır.
// Görsel düzen cihazda görülür; bu test neyin bağlandığını kilitler.

import React from "react";
import { act, create } from "react-test-renderer";

const mockHost = (name) => {
  const React = require("react");
  return ({ children, ...props }) => React.createElement(name, props, children);
};

jest.mock("react-native", () => {
  const React = require("react");
  const host = (name) => ({ children, ...props }) => React.createElement(name, props, children);
  class Value {
    constructor(v) { this.v = v; }
    interpolate() { return this; }
  }
  return {
    View: "View",
    Text: "Text",
    Image: "Image",
    ScrollView: host("ScrollView"),
    TouchableOpacity: host("TouchableOpacity"),
    StatusBar: Object.assign(() => null, { currentHeight: 24 }),
    Platform: { OS: "ios", select: (o) => o.ios },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    StyleSheet: {
      create: (s) => s,
      flatten: (s) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean)),
      absoluteFill: {},
      absoluteFillObject: {},
    },
    FlatList: ({ data, renderItem, keyExtractor }) =>
      React.createElement("FlatList", null, data.map((item) =>
        React.createElement("Item", { key: keyExtractor(item) }, renderItem({ item })))),
    Animated: {
      Value,
      View: host("Animated.View"),
      ScrollView: host("Animated.ScrollView"),
      event: () => () => {},
      spring: () => ({ start: () => {} }),
    },
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 0 }) }));

const mockPerson = {
  id: 287,
  name: "Brad Pitt",
  profile_path: "/brad.jpg",
  known_for_department: "Acting",
  popularity: 40,
  biography: "",
  movie_credits: { cast: [{ id: 550, credit_id: "c1", title: "Fight Club", vote_count: 30000, popularity: 1 }] },
  tv_credits: { cast: [] },
};
jest.mock("axios", () => ({ get: jest.fn(() => Promise.resolve({ data: mockPerson })) }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: {
    primary: "#0E1015", secondary: "#171A22", border: "#2A2F3D", accent: "#8af",
    text: { primary: "#fff", secondary: "#ccc", muted: "#888" },
  } }),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useApiSettings: () => ({ API_KEY: "k" }),
  useImageQualitySettings: () => ({ imageQuality: "high", getTmdbUrl: (p, t, w) => `tmdb:${t}:${w}${p}` }),
  useListLayoutSettings: () => ({ railPosterSize: "normal" }),
}));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/ScreenInsetsContext", () => ({ usePremiumBannerOverlap: () => 0 }));
jest.mock("../utils/i18nText", () => ({
  i18nText: (_key, fallback, vars) =>
    String(fallback).replace(/\{\{(\w+)\}\}/g, (_, k) => (vars?.[k] ?? "")),
}));
jest.mock("../components/common/ScreenSafeAreaView", () => mockHost("SafeAreaView"));
jest.mock("../components/common/GlassIconButton", () => mockHost("GlassIconButton"));
jest.mock("../components/common/GlassTouchable", () => mockHost("GlassTouchable"));
jest.mock("../components/common/GlassPressable", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ style, children, ...rest }) =>
      React.createElement("Pressable", { ...rest, style: typeof style === "function" ? style({ pressed: false }) : style }, children),
  };
});
jest.mock("../components/common/BlurTarget", () => ({
  LocalBlurTarget: mockHost("LocalBlurTarget"),
  useLocalBlurTarget: () => ({ attach: () => {}, target: null }),
}));
jest.mock("../components/Skeleton", () => ({ ActorSkeleton: () => "skeleton" }));
jest.mock("../components/ScreenDecor", () => () => null);
jest.mock("../components/person/FollowPersonButton", () => mockHost("FollowPersonButton"));
jest.mock("../components/person/PersonAvatarButton", () => mockHost("PersonAvatarButton"));
jest.mock("../components/chat/NewConversationSheet", () => mockHost("NewConversationSheet"));
jest.mock("../screens/chat/AIChatScreen", () => mockHost("AIChatScreen"));
jest.mock("../hooks/usePosterUri", () => () => (_t, _id, p) => p);

global.IS_REACT_ACT_ENVIRONMENT = true;

const ActorViewScreen = require("../screens/actor/ActorViewScreen").default;

let renderer;
let consoleError;
const navigation = { navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => {
  navigation.navigate.mockClear();
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

async function renderScreen() {
  await act(async () => {
    renderer = create(<ActorViewScreen route={{ params: { personId: 287 } }} navigation={navigation} />);
  });
}

const byLabel = (label) =>
  renderer.root.find((n) => n.type === "Pressable" && n.props.accessibilityLabel === label);

describe("ActorViewScreen hero", () => {
  it("fotoğraf bulanık katmanlı ortak yuvada; ad ve haplar uzun alt şeritte", async () => {
    await renderScreen();
    const stage = renderer.root.find((n) => n.props?.testID === "detail-hero-stage");
    const bottomSlot = stage.find((n) => n.props?.testID === "detail-hero-ambient-bottom");
    expect(Object.assign({}, ...[bottomSlot.props.style].flat()).height).toBe(136);
    expect(stage.findAll((n) => n.props?.testID === "detail-hero-bottom-tint")).toHaveLength(1);
    // Net orta fotoğraf ekran genişliğinde istenir (eski 200 bulanık kalırdı).
    const photo = stage.find((n) => n.props?.testID === "detail-hero-backdrop-image");
    expect(photo.props.source.uri).toBe("tmdb:profile:390/brad.jpg");
    expect(photo.props.blurRadius).toBeUndefined();
    // Ad + eylemler yuvanın çocuğu (alt şeridin üstünde).
    expect(stage.findAll((n) => n.type === "Text" && n.props.children === "Brad Pitt")).toHaveLength(1);
  });

  it("Takip et ve Avatarım yap'ın yanında Yapay Zeka ve Sohbete gönder", async () => {
    await renderScreen();
    // Eylem satırı = hero içindeki sarmalı yatay satır; host düğümlerini sırasıyla oku.
    const row = renderer.root.find(
      (n) => n.type === "View" && n.props.style?.flexWrap === "wrap" && n.props.style?.flexDirection === "row",
    );
    const kinds = row
      .findAll((n) => ["FollowPersonButton", "PersonAvatarButton", "Pressable"].includes(n.type))
      .map((n) => (n.type === "Pressable" ? n.props.accessibilityLabel : n.type));
    expect(kinds).toEqual(["FollowPersonButton", "PersonAvatarButton", "Yapay Zeka", "Sohbete gönder"]);
  });

  it("Yapay Zeka paneli kişi sorusuyla ilk dokunuşta kurulur ve açılır", async () => {
    await renderScreen();
    expect(renderer.root.findAllByType("AIChatScreen")).toHaveLength(0);
    await act(async () => byLabel("Yapay Zeka").props.onPress());
    const ai = renderer.root.findByType("AIChatScreen");
    expect(ai.props.visible).toBe(true);
    expect(ai.props.initialPrompt).toContain("Brad Pitt (Fight Club)");
    expect(ai.props.initialDisplay).toBe("Brad Pitt hakkında bilgi verir misin?");
    await act(async () => ai.props.onClose());
    expect(renderer.root.findByType("AIChatScreen").props.visible).toBe(false);
  });

  it("Sohbete gönder: seçilen arkadaş/grup sohbeti kişi kartıyla açılır", async () => {
    await renderScreen();
    expect(renderer.root.findByType("NewConversationSheet").props.visible).toBe(false);
    await act(async () => byLabel("Sohbete gönder").props.onPress());
    const sheet = renderer.root.findByType("NewConversationSheet");
    expect(sheet.props.visible).toBe(true);
    expect(sheet.props.includeGroups).toBe(true);

    await act(async () => sheet.props.onSelect({ recipientType: "friend", uid: "f1", name: "Ali", avatarIndex: 3 }));
    const [route, params] = navigation.navigate.mock.calls[0];
    expect(route).toBe("ChatScreen");
    expect(params).toMatchObject({ friendUid: "f1", friendName: "Ali", friendAvatarIndex: 3 });
    expect(params.initialMedia).toMatchObject({ id: 287, media_type: "person", title: "Brad Pitt", poster_path: "/brad.jpg" });
    expect(params.initialMediaKey).toMatch(/^person-287-\d+$/);

    await act(async () => sheet.props.onSelect({ recipientType: "group", id: "g1", name: "Ekip", avatarIndex: 1 }));
    expect(navigation.navigate.mock.calls[1][1]).toMatchObject({ groupId: "g1", groupName: "Ekip" });
  });
});
