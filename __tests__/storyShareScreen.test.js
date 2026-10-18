// Story tasarım ekranı (StoryShareScreen) — modal DEĞİL, tam ekran sayfa.
//
// 15 Eki: ekran `presentation: "modal"` ile açılıyordu; iOS'ta sayfa sheet'i
// ekranı kısaltıyor, aşağı çekerek kapatma jesti blok sürüklemeyle ve ayar
// sayfasındaki kaydırmalarla çakışıyordu. Bu dosya (1) rota kaydının sayfa olarak
// kaldığını, (2) ekranın yeni geri davranışını (ayar sayfası açıkken geri tuşu
// önce onu kapatır, klavye açık kalmaz, sekme değişince kaydırma başa döner)
// sabitler. Görsel parçalar ana makine bileşenleri olarak taklit edilir.
import fs from "fs";
import path from "path";
import React from "react";
import { act, create } from "react-test-renderer";
import StoryShareScreen from "../screens/story/StoryShareScreen";

global.IS_REACT_ACT_ENVIRONMENT = true;

const mockScrollTo = jest.fn();

jest.mock("react-native", () => {
  const React = require("react");
  const host = (tag) => (props) => React.createElement(tag, props, props.children);
  class Value {
    constructor(v) { this.v = v; }
    setValue(v) { this.v = v; }
    interpolate() { return this; }
    stopAnimation(cb) { if (cb) cb(this.v); }
  }
  class ValueXY {
    constructor() { this.x = new Value(0); this.y = new Value(0); }
    setValue() {}
    stopAnimation(cb) { if (cb) cb({ x: 0, y: 0 }); }
    getLayout() { return { left: 0, top: 0 }; }
  }
  // Animasyonlar anında biter: kapanış tamamlanınca ayar sayfası söküldü sayılır.
  const run = () => ({ start: (cb) => { if (cb) cb({ finished: true }); } });
  const ScrollView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
    return React.createElement("ScrollView", props, props.children);
  });
  return {
    View: host("View"),
    Image: host("Image"),
    TouchableOpacity: host("Touchable"),
    ScrollView,
    FlatList: "FlatList",
    ActivityIndicator: "Spinner",
    StatusBar: Object.assign(host("StatusBar"), { currentHeight: 24 }),
    Platform: { OS: "ios", select: (o) => o.ios },
    StyleSheet: { create: (s) => s, absoluteFill: { position: "absolute" }, hairlineWidth: 1 },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    Keyboard: { addListener: jest.fn(() => ({ remove: jest.fn() })), dismiss: jest.fn() },
    BackHandler: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
    PanResponder: { create: () => ({ panHandlers: {} }) },
    Animated: {
      Value,
      ValueXY,
      View: host("AnimatedView"),
      spring: run,
      timing: run,
    },
  };
});
jest.mock("../components/typography/AppText", () => ({
  AppText: "Text",
  AppTextInput: "TextInput",
}));
jest.mock("react-native-view-shot", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: React.forwardRef((props, _ref) => React.createElement("ViewShot", props, props.children)),
    captureRef: jest.fn(async () => "file:///tmp/story.png"),
  };
});
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn() }));
jest.mock("expo-media-library", () => ({ requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })) }));
jest.mock("expo-media-library/legacy", () => ({ saveToLibraryAsync: jest.fn() }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn(() => Promise.reject(new Error("offline"))) } }));
jest.mock("../components/AppToast", () => {
  const mockApi = {
    show: jest.fn(), hide: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn(),
    info: jest.fn(), loading: jest.fn(), badge: jest.fn(), premium: jest.fn(), undo: jest.fn(),
    update: jest.fn(), promise: jest.fn(), clear: jest.fn(),
  };
  return { __esModule: true, default: mockApi, toast: mockApi, showToast: mockApi.show };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return { useFocusEffect: (effect) => React.useEffect(effect, [effect]) };
});

const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", border: "#333333", accent: "#3388ff",
  text: { primary: "#fff", secondary: "#bbb", muted: "#888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/AppSettingsContext", () => ({
  useApiSettings: () => ({ API_KEY: "" }),
  useImageQualitySettings: () => ({ getTmdbUrl: (p) => `https://img${p}` }),
}));
jest.mock("../hooks/useAppLogo", () => ({ __esModule: true, default: () => ({ logo: 1 }) }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
jest.mock("../utils/ratingColors", () => ({ getRatingColors: () => ({ bg: "#0a0", text: "#fff" }) }));
jest.mock("../utils/colorUtils", () => ({ isLightSurface: () => false }));
jest.mock("../services/StoryDraftService", () => ({
  StoryDraftService: { getDraftById: jest.fn(async () => null), saveDraft: jest.fn(), updateDraft: jest.fn() },
}));
jest.mock("../components/common/GlassCloseButton", () => ({ __esModule: true, default: "GlassClose" }));
jest.mock("../components/storyShare/StoryHeader", () => ({ StoryHeader: "StoryHeader" }));
jest.mock("../components/storyShare/StoryTabs", () => ({ StoryTabs: "StoryTabs" }));
jest.mock("../components/storyShare/StoryActionBar", () => ({ StoryActionBar: "ActionBar" }));
jest.mock("../components/storyShare/SaveDraftModal", () => ({ SaveDraftModal: "SaveDraft" }));
jest.mock("../components/storyShare/StorySlider", () => ({ __esModule: true, default: "Slider" }));

const { Keyboard, BackHandler } = require("react-native");

const PARAMS = {
  id: 27205, type: "movie", title: "Inception", year: "2010", rating: 8.3,
  genres: ["Bilim Kurgu"], backdrop_path: "/b.jpg", poster_path: "/p.jpg",
};

let renderer;
let navigation;
let consoleError;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  navigation = { goBack: jest.fn(), navigate: jest.fn() };
  const original = console.error;
  consoleError = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
  renderer = null;
  jest.useRealTimers();
  consoleError.mockRestore();
});

async function render() {
  await act(() => {
    renderer = create(<StoryShareScreen route={{ params: PARAMS }} navigation={navigation} />);
  });
}
const one = (type) => renderer.root.findByType(type);
const backHandler = () => BackHandler.addEventListener.mock.calls.find(([evt]) => evt === "hardwareBackPress")[1];
const pressBack = () => {
  let handled;
  act(() => { handled = backHandler()(); });
  return handled;
};

describe("StoryShareScreen rotası", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
  const block = appSource.match(/name="StoryShareScreen"[\s\S]*?\/>/)[0];
  // Açıklama satırları sayılmaz: yorumlar eski modal ayarını anlatıyor.
  const code = block.replace(/\/\/.*$/gm, "");

  it("modal değil sayfa olarak kayıtlı", () => {
    expect(code).not.toMatch(/presentation\s*:/);
    expect(code).not.toMatch(/slide_from_bottom/);
    expect(code).toMatch(/animation:\s*"slide_from_right"/);
  });

  it("kenar geri jesti kapalı (tuval sürüklemesiyle çakışır)", () => {
    expect(code).toMatch(/gestureEnabled:\s*false/);
    expect(code).toMatch(/fullScreenGestureEnabled:\s*false/);
  });
});

describe("StoryShareScreen davranışı", () => {
  it("başlıktaki geri oku sayfadan çıkar", async () => {
    await render();
    act(() => one("StoryHeader").props.onBack());
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it("taslaklar açılırken klavye kapanır", async () => {
    await render();
    act(() => one("StoryHeader").props.onOpenDrafts());
    expect(Keyboard.dismiss).toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith("StoryDraftsScreen");
  });

  it("Android geri tuşu: ayar sayfası kapalıyken ekranı geçirir, açıkken önce onu kapatır", async () => {
    await render();
    expect(BackHandler.addEventListener).toHaveBeenCalledWith("hardwareBackPress", expect.any(Function));

    // Kapalı: dinleyici yutmaz → varsayılan geri (sayfadan çık) çalışır.
    expect(pressBack()).toBe(false);
    expect(Keyboard.dismiss).not.toHaveBeenCalled();

    // Açık: geri tuşu ekranı kapatmaz, ayar sayfasını kapatır ve klavyeyi indirir.
    act(() => one("ActionBar").props.onOpenSettings());
    expect(pressBack()).toBe(true);
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);

    // Sayfa kapandıktan sonra geri tuşu yine ekrandan çıkarır.
    expect(pressBack()).toBe(false);
  });

  it("ayar sayfasının kapat düğmesi de klavyeyi indirir", async () => {
    await render();
    act(() => one("ActionBar").props.onOpenSettings());
    act(() => one("GlassClose").props.onPress());
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  });

  it("sekme değişince ayar sayfası en üste döner", async () => {
    await render();
    mockScrollTo.mockClear();
    act(() => one("StoryTabs").props.onChangeTab("poster"));
    expect(mockScrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
  });

  it("geri dinleyicisi ekran sökülünce kaldırılır", async () => {
    await render();
    const sub = BackHandler.addEventListener.mock.results[0].value;
    await act(() => renderer.unmount());
    renderer = null;
    expect(sub.remove).toHaveBeenCalled();
  });
});
