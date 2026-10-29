// __tests__/top100Screen.test.js
//
// Seelogd Top 100'ün BAĞLANTISI: Eğlence kartı + tam ekran + useTop100 kancası, GERÇEK depo (bellek-içi MMKV),
// GERÇEK sıralama çekirdeği ve gerçek chatShare/listShare dönüştürücüleriyle. Ağ (services/top100Service) ve
// görsel parçalar (cam düğme, alt sayfa, ekran kabuğu) taklit edilir; props'ları doğrudan okunup tetiklenir.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => {
  const React = require("react");
  const FlatList = ({ data, renderItem, keyExtractor, ListHeaderComponent, ListEmptyComponent }) =>
    React.createElement(
      "FlatList",
      null,
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
const mockCast = jest.fn();
const mockSearch = jest.fn();
jest.mock("../services/top100Service", () => ({
  fetchTop100Pool: () => Promise.resolve(mockPool),
  fetchTop100Counters: () => Promise.resolve(mockCounters),
  fetchTop100Details: () => Promise.resolve([]),
  fetchMyTop100Vote: () => Promise.resolve(null),
  searchTop100: (...a) => mockSearch(...a),
  castTop100Vote: (...a) => mockCast(...a),
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

const poolItem = (key, tmdbAvg, title = key) => {
  const [type, id] = key.split("_");
  return {
    key, id: Number(id), media_type: type, title, poster_path: `/${key}.jpg`, year: "2001",
    adult: false, tmdbAvg, tmdbCount: 8000,
  };
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
  mockCast.mockReset();
  mockSearch.mockReset();
  mockCounters = {};
  // 60 yapım: film ve dizi karışık, puan azalan.
  mockPool = Array.from({ length: 60 }, (_, i) =>
    poolItem(`${i % 2 ? "tv" : "movie"}_${i + 1}`, 9 - i * 0.03, `Yapım ${i + 1}`),
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
const sheets = () => renderer.root.findAllByType("Sheet");

test("varsayılan liste film+dizi karışık, puan sırasıyla; satıra dokununca detaya gider", async () => {
  const nav = navigation();
  await mount(<Top100Screen navigation={nav} />);
  const all = texts();
  expect(all).toContain("Yapım 1");
  expect(all).toContain("Yapım 2");
  expect(all.indexOf("Yapım 1")).toBeLessThan(all.indexOf("Yapım 2"));
  const rows = renderer.root.findAllByType("Touch").filter((n) => n.props.accessibilityLabel?.startsWith("2. "));
  act(() => rows[0].props.onPress());
  expect(nav.navigate).toHaveBeenCalledWith("TvShowsDetails", { id: 2 });
});

test("Film/Dizi süzgeci yalnız o türü gösterir", async () => {
  await mount(<Top100Screen navigation={navigation()} />);
  act(() => touchWithText("Dizi").props.onPress());
  const all = texts();
  expect(all).toContain("Yapım 2");
  expect(all).not.toContain("Yapım 1");
});

test("oy ver → 1–10 sayfası → kaydet: sunucuya yazılır, yerelde saklanır, sıra toast'ta", async () => {
  mockCast.mockResolvedValue({ counter: { sum: 10, count: 1 }, previous: null, score: 10 });
  await mount(<Top100Screen navigation={navigation()} />);
  const voteBtn = renderer.root.findAllByType("Touch").find((n) => n.props.accessibilityLabel === copy.vote);
  act(() => voteBtn.props.onPress());
  expect(sheets()[0].props.visible).toBe(true);

  act(() => renderer.root.findAllByType("Touch").find((n) => n.props.accessibilityLabel === "10, Başyapıt").props.onPress());
  await act(async () => { await touchWithText(copy.saveVote).props.onPress(); });
  await flush();

  expect(mockCast).toHaveBeenCalledWith({ uid: "u1", type: "movie", id: 1, score: 10 });
  expect(get(Keys.top100Votes, { uid: "u1" })).toEqual({ movie_1: 10 });
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", text2: expect.stringContaining("#1") }));
  expect(sheets()[0].props.visible).toBe(false);
  // Satırda artık "senin oyun" rozeti var.
  expect(renderer.root.findAllByType("Touch").some((n) => n.props.accessibilityLabel === `${copy.yourVote} 10`)).toBe(true);
});

test("oy yazılamazsa yerel kayıt geri alınır ve hata toast'ı çıkar", async () => {
  mockCast.mockRejectedValue(new Error("permission-denied"));
  await mount(<Top100Screen navigation={navigation()} />);
  act(() => renderer.root.findAllByType("Touch").find((n) => n.props.accessibilityLabel === copy.vote).props.onPress());
  act(() => renderer.root.findAllByType("Touch").find((n) => n.props.accessibilityLabel === "7, İyi").props.onPress());
  await act(async () => { await touchWithText(copy.saveVote).props.onPress(); });
  await flush();
  expect(get(Keys.top100Votes, { uid: "u1" })).toEqual({});
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", text1: copy.voteFailed }));
});

test("liste olarak kaydet: 20/50/70/100 seçimi, 60'lık listede 70 ve 100 pasif; İlk 50 kayıt modalına gider", async () => {
  await mount(<Top100Screen navigation={navigation()} />);
  act(() => touchWithText(copy.saveList).props.onPress());
  // Satırların sıra numarası da "20" yazar: çipi sayım sayfasının içinde ara.
  const chip = (n) =>
    sheets()[1].findAllByType("Touch").find((t) => t.findAllByType("Text").some((x) => x.props.children === n));
  expect(chip(70).props.disabled).toBe(true);
  expect(chip(100).props.disabled).toBe(true);
  expect(chip(20).props.disabled).toBe(false);
  act(() => chip(50).props.onPress());
  act(() => touchWithText(`${copy.saveList} · 50`).props.onPress());
  const countSheet = sheets()[1];
  expect(countSheet.props.visible).toBe(false);
  act(() => countSheet.props.onDismissed());

  const save = renderer.root.findByType("SaveList");
  expect(save.props.visible).toBe(true);
  expect(save.props.post.title).toBe("Seelogd Top 50");
  expect(save.props.post.mediaList).toHaveLength(50);
  expect(save.props.post.mediaList[0]).toMatchObject({ id: 1, media_type: "movie", title: "Yapım 1" });
});

test("sohbete gönder: İlk 20 → listShare gövdesi alıcı sayfasına gider", async () => {
  await mount(<Top100Screen navigation={navigation()} />);
  act(() => touchWithText(copy.sendChat).props.onPress());
  act(() => touchWithText(`${copy.sendChat} · 20`).props.onPress());
  act(() => sheets()[1].props.onDismissed());
  const chat = renderer.root.findByType("ShareToChat");
  expect(chat.props.visible).toBe(true);
  expect(chat.props.share).toMatchObject({ type: "list", title: "Seelogd Top 20", total: 20 });
  expect(chat.props.share.items.map((m) => `${m.media_type}_${m.id}`).slice(0, 3)).toEqual(["movie_1", "tv_2", "movie_3"]);
});

test("arama: sonuç Top 100 dışındaysa öyle işaretlenir; oy verilince sıralamaya girer", async () => {
  const outsider = { ...poolItem("movie_999", 6.0, "Bilinmeyen"), tmdbCount: 400 };
  mockSearch.mockResolvedValue([outsider]);
  mockCast.mockResolvedValue({ counter: { sum: 10, count: 1 }, previous: null, score: 10 });
  await mount(<Top100Screen navigation={navigation()} />);
  act(() => renderer.root.findByType("TextInput").props.onChangeText("bilin"));
  await act(async () => { jest.advanceTimersByTime(400); });
  await flush();
  expect(mockSearch).toHaveBeenCalledWith("k", "tr", "bilin");
  expect(texts()).toContain("Bilinmeyen");
  expect(texts()).toContain(copy.outside);

  act(() => renderer.root.findAllByType("Touch").find((n) => n.props.accessibilityLabel === copy.vote).props.onPress());
  act(() => renderer.root.findAllByType("Touch").find((n) => n.props.accessibilityLabel === "10, Başyapıt").props.onPress());
  await act(async () => { await touchWithText(copy.saveVote).props.onPress(); });
  await flush();
  expect(mockCast).toHaveBeenCalledWith({ uid: "u1", type: "movie", id: 999, score: 10 });
  // Aramayı temizle: tam liste 60 + 1 öğeyle kurulur (yeni yapım havuza eklendi).
  act(() => renderer.root.findByType("TextInput").props.onChangeText(""));
  await flush();
  expect(texts()).toContain("Bilinmeyen");
});

test("Eğlence kartı ilk üçü gösterir ve ekrana gider", async () => {
  const nav = navigation();
  await mount(<Top100Widget navigation={nav} />);
  expect(renderer.root.findAllByType("Image").map((n) => n.props.source.uri)).toEqual(
    expect.arrayContaining(["img/movie_1.jpg", "img/tv_2.jpg", "img/movie_3.jpg"]),
  );
  act(() => renderer.root.findByType("Card").props.onPress());
  expect(nav.navigate).toHaveBeenCalledWith("Top100Screen");
});
