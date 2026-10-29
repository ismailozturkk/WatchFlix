// __tests__/top100Screen.test.js
//
// Seelogd Top 100'ün BAĞLANTISI: Eğlence kartı + tam ekran + useTop100 kancası, GERÇEK depo (bellek-içi MMKV),
// GERÇEK sıralama çekirdeği ve gerçek chatShare/listShare dönüştürücüleriyle. Ağ (services/top100Service) ve
// görsel parçalar (cam düğme, alt sayfa, ekran kabuğu) taklit edilir; props'ları doğrudan okunup tetiklenir.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => {
  const React = require("react");
  const FlatList = ({ data, renderItem, keyExtractor, ListHeaderComponent, ListEmptyComponent, numColumns }) =>
    React.createElement(
      "FlatList",
      { numColumns },
      ListHeaderComponent,
      data.length
        ? data.map((item, index) => React.createElement(React.Fragment, { key: keyExtractor(item) }, renderItem({ item, index })))
        : ListEmptyComponent,
    );
  return {
    StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
    View: "View",
    Text: "Text",
    TextInput: "TextInput",
    ActivityIndicator: "ActivityIndicator",
    FlatList,
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    AppState: { addEventListener: () => ({ remove: () => {} }) },
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
const mockHost = (name) => ({
  __esModule: true,
  default: ({ children, ...props }) => require("react").createElement(name, props, children),
});
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: ({ children }) => require("react").createElement("Gradient", null, children) }));
jest.mock("../components/AppIcon", () => mockHost("Icon"));
jest.mock("../components/common/GlassTouchable", () => mockHost("Touch"));
jest.mock("../components/common/GlassField", () => mockHost("Field"));
jest.mock("../components/common/GlassCloseButton", () => mockHost("Close"));
jest.mock("../components/common/GlassSurface", () => ({ useGlassScheme: () => "dark" }));
// Alt sayfa: yalnız açıkken çocuklarını çizer; onDismissed'ı test elle çağırır.
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children, ...props }) =>
    require("react").createElement("Sheet", { visible, ...props }, visible ? children : null),
}));
jest.mock("../components/chat/ShareToChatSheet", () => mockHost("ShareToChat"));
jest.mock("../components/modals/SaveSharedListModal", () => mockHost("SaveList"));
jest.mock("../components/common/SheetScroll", () => mockHost("SheetScroll"));
jest.mock("../components/hub/HubCard", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children, onPress }) => React.createElement("Card", { onPress }, children),
    GlassPill: ({ text }) => React.createElement("Text", null, text),
    HubArrow: () => null,
  };
});
jest.mock("../screens/game/GameScreenShell", () => ({
  GameScreenShell: ({ title, children }) => require("react").createElement("Shell", { title }, children),
}));

jest.mock("../services/hapticsService", () => ({ triggerHaptic: () => {} }));
const mockToast = jest.fn();
jest.mock("../components/AppToast", () => ({ __esModule: true, default: { show: (...a) => mockToast(...a) } }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
jest.mock("../context/AppSettingsContext", () => ({
  useApiSettings: () => ({ API_KEY: "k" }),
  useImageQualitySettings: () => ({ getTmdbUrl: (p) => `img${p}` }),
}));

let mockPool = [];
let mockCounters = {};
const mockSetHype = jest.fn();
const mockSearch = jest.fn();
const mockMyHype = jest.fn();
jest.mock("../services/top100Service", () => ({
  fetchTop100Pool: () => Promise.resolve(mockPool),
  fetchTop100Counters: () => Promise.resolve(mockCounters),
  fetchTop100Details: () => Promise.resolve([]),
  fetchMyTop100Hype: (...a) => mockMyHype(...a),
  searchTop100: (...a) => mockSearch(...a),
  setTop100Hype: (...a) => mockSetHype(...a),
}));

const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const { __resetTop100Memory } = require("../hooks/useTop100");
const Top100Screen = require("../screens/fun/Top100Screen").default;
const Top100Widget = require("../components/hub/Top100Widget").default;
const { TOP100_COPY } = require("../utils/top100Copy");

global.IS_REACT_ACT_ENVIRONMENT = true;
const copy = TOP100_COPY.tr;

const poolItem = (key, tmdbCount, title = key, tmdbAvg = 7) => {
  const [type, id] = key.split("_");
  return { key, id: Number(id), media_type: type, title, poster_path: `/${key}.jpg`, year: "2001", adult: false, tmdbAvg, tmdbCount };
};

let renderer;
let errSpy;
beforeEach(() => {
  jest.useFakeTimers();
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  __resetTop100Memory();
  mockToast.mockClear();
  mockSetHype.mockReset();
  mockSearch.mockReset();
  mockMyHype.mockReset().mockResolvedValue(false);
  mockCounters = {};
  // 60 yapım: film ve dizi karışık, değerlendirme sayısı azalan (Yapım 1 en çok).
  mockPool = Array.from({ length: 60 }, (_, i) =>
    poolItem(`${i % 2 ? "tv" : "movie"}_${i + 1}`, 30000 - i * 100, `Yapım ${i + 1}`),
  );
  const original = console.error;
  errSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  errSpy.mockRestore();
  jest.useRealTimers();
});

const flush = async () => {
  for (let i = 0; i < 4; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await Promise.resolve(); });
  }
};
const navigation = () => ({ navigate: jest.fn(), goBack: jest.fn() });
const mount = async (element) => {
  act(() => { renderer = create(element); });
  await flush();
};
const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
const touchWithText = (label) =>
  renderer.root.findAllByType("Touch").find((n) => n.findAllByType("Text").some((t) => [].concat(t.props.children).join("") === label));
const touchByLabel = (label) => renderer.root.findAllByType("Touch").find((n) => n.props.accessibilityLabel === label);
const sheets = () => renderer.root.findAllByType("Sheet");
const hypeBtn = (title) => touchByLabel(copy.hypeA11y(title, false)) || touchByLabel(copy.hypeA11y(title, true));

test("4'lü afiş ızgarası: en çok oy alan en üstte; afişte sıra, oy sayısı ve oy düğmesi", async () => {
  const nav = navigation();
  await mount(<Top100Screen navigation={nav} />);
  expect(renderer.root.findByType("FlatList").props.numColumns).toBe(4);
  const all = texts();
  expect(all.indexOf("Yapım 1")).toBeLessThan(all.indexOf("Yapım 2"));
  expect(all).toContain("#1");
  expect(all).toContain("30.000 oy");
  expect(all).toContain("29.900 oy");
  expect(hypeBtn("Yapım 1").findAllByType("Text")[0].props.children).toBe(copy.vote);
  // Afiş genişliği çift tam sayı ve 2:3.
  const poster = touchByLabel(copy.cellA11y(2, "Yapım 2", 29900));
  const [{ width, height }] = poster.props.style.filter((s) => s && s.width);
  expect(width % 2).toBe(0);
  expect(height).toBe(width * 1.5);
  act(() => poster.props.onPress());
  expect(nav.navigate).toHaveBeenCalledWith("TvShowsDetails", { id: 2 });
});

test("puan ortalaması değil oy sayısı: düşük puanlı ama çok değerlendirilen yapım öne geçer", async () => {
  mockPool = [poolItem("movie_1", 1000, "Az ama iyi", 9.6), poolItem("tv_2", 9000, "Çok izlenen", 6.2)];
  await mount(<Top100Screen navigation={navigation()} />);
  const all = texts();
  expect(all.indexOf("Çok izlenen")).toBeLessThan(all.indexOf("Az ama iyi"));
});

test("Seelogd oyları TMDB'yle hibrit sayılır (oy × 100) ve sırayı değiştirir", async () => {
  mockCounters = { tv_60: { count: 70 } }; // 30000 − 5900 + 7000 = 31100 → 1. sıra
  await mount(<Top100Screen navigation={navigation()} />);
  const all = texts();
  expect(all.indexOf("Yapım 60")).toBeLessThan(all.indexOf("Yapım 1"));
  expect(all).toContain("31.100 oy");
});

test("Film/Dizi süzgeci yalnız o türü gösterir", async () => {
  await mount(<Top100Screen navigation={navigation()} />);
  act(() => touchWithText("Dizi").props.onPress());
  expect(texts()).toContain("Yapım 2");
  expect(texts()).not.toContain("Yapım 1");
});

test("oy ver tek dokunuş: sunucuya yazılır, sayı +100 artar, yerelde saklanır; tekrar dokunuş geri alır", async () => {
  mockSetHype.mockImplementation(({ hyped }) => Promise.resolve({ counter: { count: hyped ? 1 : 0 }, hyped }));
  await mount(<Top100Screen navigation={navigation()} />);

  await act(async () => { await hypeBtn("Yapım 3").props.onPress(); });
  await flush();
  expect(mockSetHype).toHaveBeenLastCalledWith({ uid: "u1", type: "movie", id: 3, hyped: true });
  expect(get(Keys.top100Hype, { uid: "u1" })).toEqual({ movie_3: true });
  // 29800 + 100 = 29900: Yapım 2 ile eşit, eşitlikte Seelogd oyu kazanır → 2. sıraya çıkar.
  expect(touchByLabel(copy.cellA11y(2, "Yapım 3", 29900))).toBeTruthy();
  expect(hypeBtn("Yapım 3").findAllByType("Text")[0].props.children).toBe(copy.voted);
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", text1: copy.voteAdded }));
  expect(texts()).toContain(copy.myVotes(1));

  mockToast.mockClear();
  await act(async () => { await hypeBtn("Yapım 3").props.onPress(); });
  await flush();
  expect(mockSetHype).toHaveBeenLastCalledWith({ uid: "u1", type: "movie", id: 3, hyped: false });
  expect(get(Keys.top100Hype, { uid: "u1" })).toEqual({});
  expect(hypeBtn("Yapım 3").findAllByType("Text")[0].props.children).toBe(copy.vote);
  expect(mockToast).not.toHaveBeenCalled(); // geri almada toast yok
});

test("oy yazılamazsa yerel kayıt ve sayı geri alınır, hata toast'ı çıkar", async () => {
  mockSetHype.mockRejectedValue(new Error("permission-denied"));
  await mount(<Top100Screen navigation={navigation()} />);
  await act(async () => { await hypeBtn("Yapım 3").props.onPress(); });
  await flush();
  expect(get(Keys.top100Hype, { uid: "u1" })).toEqual({});
  expect(texts()).toContain("29.800 oy");
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", text1: copy.voteFailed }));
});

test("ünlem düğmesi ayrıntılı açıklamayı açar; kartta kaydet/gönder durur", async () => {
  await mount(<Top100Screen navigation={navigation()} />);
  expect(touchWithText(copy.saveList)).toBeTruthy();
  expect(touchWithText(copy.sendChat)).toBeTruthy();
  const info = touchByLabel(copy.infoA11y);
  expect(info.findByType("Icon").props.name).toBe("alert-circle-outline");
  act(() => info.props.onPress());
  expect(sheets()[0].props.visible).toBe(true);
  const shown = texts();
  copy.infoSections.forEach((section) => {
    expect(shown).toContain(section.title);
    expect(shown).toContain(section.body);
  });
  expect(shown.some((t) => t.includes("100 TMDB değerlendirmesi"))).toBe(true);
  act(() => touchWithText(copy.gotIt).props.onPress());
  expect(sheets()[0].props.visible).toBe(false);
});

test("liste olarak kaydet: 20/50/70/100, 60'lık listede 70 ve 100 pasif; İlk 50 kayıt modalına gider", async () => {
  await mount(<Top100Screen navigation={navigation()} />);
  act(() => touchWithText(copy.saveList).props.onPress());
  const chip = (n) =>
    sheets()[1].findAllByType("Touch").find((t) => t.findAllByType("Text").some((x) => x.props.children === n));
  expect(chip(70).props.disabled).toBe(true);
  expect(chip(100).props.disabled).toBe(true);
  expect(chip(20).props.disabled).toBe(false);
  act(() => chip(50).props.onPress());
  act(() => touchWithText(`${copy.saveList} · 50`).props.onPress());
  expect(sheets()[1].props.visible).toBe(false);
  act(() => sheets()[1].props.onDismissed());
  const save = renderer.root.findByType("SaveList");
  expect(save.props.post.title).toBe("Seelogd Top 50");
  expect(save.props.post.mediaList).toHaveLength(50);
  expect(save.props.post.mediaList[0]).toMatchObject({ id: 1, media_type: "movie", title: "Yapım 1" });
});

test("sohbete gönder: İlk 20 → listShare gövdesi sıralı gider", async () => {
  await mount(<Top100Screen navigation={navigation()} />);
  act(() => touchWithText(copy.sendChat).props.onPress());
  act(() => touchWithText(`${copy.sendChat} · 20`).props.onPress());
  act(() => sheets()[1].props.onDismissed());
  const chat = renderer.root.findByType("ShareToChat");
  expect(chat.props.share).toMatchObject({ type: "list", title: "Seelogd Top 20", total: 20 });
  expect(chat.props.share.items.map((m) => `${m.media_type}_${m.id}`).slice(0, 3)).toEqual(["movie_1", "tv_2", "movie_3"]);
});

test("arama: Top 100 dışındaki yapım sırasız görünür; oy verilince sıralamaya girer", async () => {
  mockPool = mockPool.slice(0, 2);
  const outsider = poolItem("movie_999", 50, "Bilinmeyen");
  mockSearch.mockResolvedValue([outsider]);
  mockMyHype.mockResolvedValue(false);
  mockSetHype.mockResolvedValue({ counter: { count: 1 }, hyped: true });
  await mount(<Top100Screen navigation={navigation()} />);
  act(() => renderer.root.findByType("TextInput").props.onChangeText("bilin"));
  await act(async () => { jest.advanceTimersByTime(400); });
  await flush();
  expect(mockSearch).toHaveBeenCalledWith("k", "tr", "bilin");
  expect(mockMyHype).toHaveBeenCalledWith("u1", "movie_999");
  expect(texts()).toContain("Bilinmeyen");
  expect(texts()).toContain("–"); // sıra rozeti yok
  await act(async () => { await hypeBtn("Bilinmeyen").props.onPress(); });
  await flush();
  expect(mockSetHype).toHaveBeenCalledWith({ uid: "u1", type: "movie", id: 999, hyped: true });
  act(() => renderer.root.findByType("TextInput").props.onChangeText(""));
  await flush();
  expect(texts()).toContain("Bilinmeyen");
  expect(texts()).toContain("150 oy"); // 50 + 1 × 100
});

test("başka cihazdan verilmiş oy aramada yerel kayda gelir", async () => {
  mockSearch.mockResolvedValue([poolItem("tv_77", 400, "Uzak")]);
  mockMyHype.mockResolvedValue(true);
  await mount(<Top100Screen navigation={navigation()} />);
  act(() => renderer.root.findByType("TextInput").props.onChangeText("uzak"));
  await act(async () => { jest.advanceTimersByTime(400); });
  await flush();
  expect(get(Keys.top100Hype, { uid: "u1" })).toEqual({ tv_77: true });
  expect(hypeBtn("Uzak").findAllByType("Text")[0].props.children).toBe(copy.voted);
});

test("toplam Seelogd oyu 100'ün altındaysa gösterilmez, 100 ve üstünde gösterilir", async () => {
  mockCounters = { movie_1: { count: 99 } };
  await mount(<Top100Screen navigation={navigation()} />);
  expect(texts()).not.toContain(copy.totalVotes(99));
  act(() => renderer.unmount());

  __resetTop100Memory();
  mockCounters = { movie_1: { count: 100 } };
  await mount(<Top100Screen navigation={navigation()} />);
  expect(texts()).toContain(copy.totalVotes(100));
  act(() => renderer.unmount());

  __resetTop100Memory();
  mockCounters = { movie_1: { count: 99 } };
  await mount(<Top100Widget navigation={navigation()} />);
  expect(texts()).not.toContain(copy.totalVotes(99));
});

test("Eğlence kartı en çok oy alan ilk üçü oy sayılarıyla gösterir ve ekrana gider", async () => {
  const nav = navigation();
  await mount(<Top100Widget navigation={nav} />);
  expect(renderer.root.findAllByType("Image").map((n) => n.props.source.uri)).toEqual(
    expect.arrayContaining(["img/movie_1.jpg", "img/tv_2.jpg", "img/movie_3.jpg"]),
  );
  expect(texts()).toEqual(expect.arrayContaining(["30.000", "29.900", "29.800"]));
  act(() => renderer.root.findByType("Card").props.onPress());
  expect(nav.navigate).toHaveBeenCalledWith("Top100Screen");
});
