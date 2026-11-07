// __tests__/top100Screen.test.js
//
// Seelogd Top 100'ün BAĞLANTISI: Eğlence kartı + tam ekran + useTop100 kancası, GERÇEK depo (bellek-içi MMKV),
// GERÇEK sıralama çekirdeği ve gerçek chatShare/listShare dönüştürücüleriyle. Ağ (services/top100Service) ve
// görsel parçalar (cam düğme, alt sayfa, ekran kabuğu) taklit edilir; props'ları doğrudan okunup tetiklenir.

import React from "react";
import { act, create } from "react-test-renderer";

// Haftalık Lig bildirimi (services/leagueService → firebase) bu testin konusu değil.
// Afiş köşesi (Ayarlar > Poster görünümü) burada sınanmıyor: taban köşe aynen döner.
jest.mock("../hooks/usePosterCorner", () => () => (base) => base);
jest.mock("../services/leagueService", () => ({
  awardGameXp: jest.fn(),
  awardDailyXp: jest.fn(),
  awardPollVoteXp: jest.fn(),
  awardTop100VoteXp: jest.fn(),
  awardWatchXp: jest.fn(),
}));
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

let mockLimit = 10;
const mockShowUpsell = jest.fn();
jest.mock("../hooks/usePremiumGate", () => ({
  usePremiumGate: (featureId) => ({
    featureId,
    limit: mockLimit,
    allows: (used = 0) => used < mockLimit,
    showUpsell: (...a) => mockShowUpsell(featureId, ...a),
  }),
}));

let mockPool = [];
let mockCounters = {};
const mockSetHype = jest.fn();
const mockSearch = jest.fn();
const mockMyHype = jest.fn();
const mockUsage = jest.fn();
jest.mock("../services/top100Service", () => ({
  fetchTop100Pool: () => Promise.resolve(mockPool),
  fetchTop100Counters: () => Promise.resolve(mockCounters),
  fetchTop100Details: () => Promise.resolve([]),
  fetchMyTop100Hype: (...a) => mockMyHype(...a),
  fetchMyTop100Usage: (...a) => mockUsage(...a),
  TOP100_LIMIT_ERROR: "top100_limit",
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
  mockLimit = 10;
  mockUsage.mockReset().mockResolvedValue(0);
  mockShowUpsell.mockClear();
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
// Izgara afişi: ad yazılmıyor; afiş, seçenek sayfası ipucuyla (menuA11y) bulunur.
const posters = () => renderer.root.findAllByType("Touch").filter((n) => typeof n.props.accessibilityHint === "string");
const posterOf = (title) => posters().find((n) => n.props.accessibilityHint === copy.menuA11y(title));
const footTextsOf = (title) => posterOf(title).children[1].findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
const order = () => posters().map((n) => n.props.accessibilityHint.slice(0, -", seçenekler".length));
const cellLabel = (title) => posterOf(title).props.accessibilityLabel;
// Seçenek sayfası (Bilgi · Seçim yap · İptal et): bilgi ve uzunluk sayfalarından sonra üçüncü sayfa.
const menu = () => sheets()[2];
const openMenu = (title) => act(() => posterOf(title).props.onPress());
const voteRow = (title) =>
  menu().findAllByType("Touch").find((n) => [copy.hypeA11y(title, false), copy.hypeA11y(title, true)].includes(n.props.accessibilityLabel));
const closeMenu = () => {
  act(() => menu().props.onClose());
  act(() => menu().props.onDismissed());
};
// Afişe dokun → "Seçim yap"; iş sayfa kapandıktan sonra (onDismissed) çalışır.
const pressVote = async (title) => {
  openMenu(title);
  act(() => voteRow(title).props.onPress());
  expect(menu().props.visible).toBe(false);
  await act(async () => { menu().props.onDismissed(); });
  await flush();
};
// Menüdeki oy satırı: başlık ("Seçim yap" / "Seçimi geri al") ve simge; sayfa sonra kapatılır.
const voteState = (title) => {
  openMenu(title);
  const row = voteRow(title);
  const state = { label: row.findAllByType("Text")[0].props.children, icon: row.findAllByType("Icon")[0].props.name };
  closeMenu();
  return state;
};

test("4'lü afiş ızgarası: en çok oy alan en üstte; afişin altında sıra numarası ve oy sayısı var, ad ve düğme yok", async () => {
  await mount(<Top100Screen navigation={navigation()} />);
  expect(renderer.root.findByType("FlatList").props.numColumns).toBe(4);
  expect(order().slice(0, 3)).toEqual(["Yapım 1", "Yapım 2", "Yapım 3"]);
  const all = texts();
  expect(all).toContain("1");
  expect(all).toContain("30.000");
  expect(all).not.toContain("Yapım 1");
  expect(all).not.toContain(copy.vote);
  expect(cellLabel("Yapım 1")).toBe(copy.cellA11y(1, "Yapım 1", 30000));
  // Afiş genişliği çift tam sayı ve 2:3; hemen altındaki satırda sıra numarası ve oy sayısı yan yana.
  const cell = posterOf("Yapım 2");
  const posterBox = cell.children[0];
  const [{ width, height }] = posterBox.props.style.filter((s) => s && s.width);
  expect(width % 2).toBe(0);
  expect(height).toBe(width * 1.5);
  expect(posterBox.findAllByType("Text")).toHaveLength(0);
  expect(footTextsOf("Yapım 2")).toEqual(["2", "29.900"]);
});

test("afişe dokunuş seçenek sayfasını açar: künye + Bilgi / Seçim yap / İptal et", async () => {
  const nav = navigation();
  await mount(<Top100Screen navigation={nav} />);
  expect(menu().props.visible).toBe(false);
  openMenu("Yapım 2");
  expect(menu().props.visible).toBe(true);
  const shown = menu().findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
  expect(shown).toEqual(expect.arrayContaining(["Yapım 2", "29.900 oy", copy.menuInfo, copy.menuVote, copy.menuCancel]));
  expect(nav.navigate).not.toHaveBeenCalled();

  // İptal et: hiçbir şey olmaz.
  act(() => touchWithText(copy.menuCancel).props.onPress());
  expect(menu().props.visible).toBe(false);
  act(() => menu().props.onDismissed());
  expect(nav.navigate).not.toHaveBeenCalled();
  expect(mockSetHype).not.toHaveBeenCalled();

  // Bilgi: sayfa kapanınca yapımın detayına gider.
  openMenu("Yapım 2");
  act(() => touchByLabel(copy.menuInfo).props.onPress());
  expect(nav.navigate).not.toHaveBeenCalled();
  act(() => menu().props.onDismissed());
  expect(nav.navigate).toHaveBeenCalledWith("TvShowsDetails", { id: 2 });
});

test("puan ortalaması değil oy sayısı: düşük puanlı ama çok değerlendirilen yapım öne geçer", async () => {
  mockPool = [poolItem("movie_1", 1000, "Az ama iyi", 9.6), poolItem("tv_2", 9000, "Çok izlenen", 6.2)];
  await mount(<Top100Screen navigation={navigation()} />);
  expect(order()).toEqual(["Çok izlenen", "Az ama iyi"]);
});

test("Seelogd oyları TMDB'yle hibrit sayılır (oy × 100) ve sırayı değiştirir", async () => {
  mockCounters = { tv_60: { count: 70 } }; // 30000 − 5900 + 7000 = 31100 → 1. sıra
  await mount(<Top100Screen navigation={navigation()} />);
  expect(order()[0]).toBe("Yapım 60");
  expect(cellLabel("Yapım 60")).toBe(copy.cellA11y(1, "Yapım 60", 31100));
});

test("Film/Dizi süzgeci yalnız o türü gösterir", async () => {
  await mount(<Top100Screen navigation={navigation()} />);
  act(() => touchWithText("Dizi").props.onPress());
  expect(order()).toContain("Yapım 2");
  expect(order()).not.toContain("Yapım 1");
});

test("Seçim yap: sunucuya yazılır, sayı +100 artar, yerelde saklanır; Seçimi geri al geri alır", async () => {
  mockSetHype.mockImplementation(({ hyped }) => Promise.resolve({ counter: { count: hyped ? 1 : 0 }, hyped, used: hyped ? 1 : 0 }));
  await mount(<Top100Screen navigation={navigation()} />);

  expect(posterOf("Yapım 3").props.accessibilityState).toEqual({ selected: false });
  await pressVote("Yapım 3");
  expect(mockSetHype).toHaveBeenLastCalledWith({ uid: "u1", type: "movie", id: 3, hyped: true, limit: 10 });
  expect(get(Keys.top100Hype, { uid: "u1" })).toEqual({ movie_3: true });
  // Seçilen afiş turuncu çerçeve alır; alt satırdaki sıra ve oy sayısı güncellenir.
  const votedPoster = posterOf("Yapım 3");
  expect(votedPoster.props.accessibilityState).toEqual({ selected: true });
  const borderRing = votedPoster.findAllByType("View").find((v) => {
    const st = Object.assign({}, ...[].concat(v.props.style).filter(Boolean));
    return st.borderWidth === 2 && st.borderColor === "#F97316";
  });
  expect(borderRing).toBeTruthy();
  expect(footTextsOf("Yapım 3")).toEqual(["2", "29.900"]);
  // 29800 + 100 = 29900: Yapım 2 ile eşit, eşitlikte Seelogd oyu kazanır → 2. sıraya çıkar.
  expect(cellLabel("Yapım 3")).toBe(copy.cellA11y(2, "Yapım 3", 29900));
  expect(voteState("Yapım 3").label).toBe(copy.menuUnvote);
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", text1: copy.voteAdded }));
  expect(texts()).toContain(copy.budget(1, 10));

  mockToast.mockClear();
  await pressVote("Yapım 3");
  expect(mockSetHype).toHaveBeenLastCalledWith({ uid: "u1", type: "movie", id: 3, hyped: false, limit: 10 });
  expect(get(Keys.top100Hype, { uid: "u1" })).toEqual({});
  expect(posterOf("Yapım 3").props.accessibilityState).toEqual({ selected: false });
  expect(voteState("Yapım 3").label).toBe(copy.menuVote);
  expect(mockToast).not.toHaveBeenCalled(); // geri almada toast yok
  expect(texts()).toContain(copy.budget(0, 10)); // hak geri geldi
});

test("Premium hak doluyken (10/10): seçim kilitli, dokunuş yazmaz, kullanım göstergeli yükseltme sayfası açılır", async () => {
  mockUsage.mockResolvedValue(10);
  await mount(<Top100Screen navigation={navigation()} />);
  expect(texts()).toContain(copy.budget(10, 10));
  expect(voteState("Yapım 3").icon).toBe("lock-closed");
  await pressVote("Yapım 3");
  expect(mockSetHype).not.toHaveBeenCalled();
  expect(mockShowUpsell).toHaveBeenCalledWith("top100_vote", expect.objectContaining({ used: 10 }));
});

test("başka cihazda hak dolmuşsa sunucunun hata sayısıyla yükseltme sayfası açılır, oy geri alınır", async () => {
  const limitError = Object.assign(new Error("top100_limit"), { code: "top100_limit", used: 10 });
  mockSetHype.mockRejectedValue(limitError);
  await mount(<Top100Screen navigation={navigation()} />);
  await pressVote("Yapım 3");
  expect(mockShowUpsell).toHaveBeenCalledWith("top100_vote", expect.objectContaining({ used: 10 }));
  expect(mockToast).not.toHaveBeenCalled();
  expect(get(Keys.top100Hype, { uid: "u1" })).toEqual({});
  expect(texts()).toContain(copy.budget(10, 10));
});

test("oy yazılamazsa yerel kayıt ve sayı geri alınır, hata toast'ı çıkar", async () => {
  mockSetHype.mockRejectedValue(new Error("permission-denied"));
  await mount(<Top100Screen navigation={navigation()} />);
  await pressVote("Yapım 3");
  expect(get(Keys.top100Hype, { uid: "u1" })).toEqual({});
  expect(cellLabel("Yapım 3")).toBe(copy.cellA11y(3, "Yapım 3", 29800));
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", text1: copy.voteFailed }));
});

test("Free: seçim kilitli; dokunuş yazmaz, yapımın önizlemesiyle yükseltme sayfasını açar", async () => {
  mockLimit = 0;
  await mount(<Top100Screen navigation={navigation()} />);
  expect(voteState("Yapım 3").icon).toBe("lock-closed");
  await pressVote("Yapım 3");
  expect(mockSetHype).not.toHaveBeenCalled();
  expect(get(Keys.top100Hype, { uid: "u1" })).toBeNull();
  expect(mockShowUpsell).toHaveBeenCalledWith("top100_vote", {
    used: 0,
    preview: { kind: "vote", title: "Yapım 3", posterUri: "img/movie_3.jpg", rank: 3, votes: 29800 },
  });
  expect(texts().some((t) => t.includes("Oy hakkın"))).toBe(false); // Free'de hak çubuğu yok
  // Liste olarak kaydet ve sohbete gönder Free'de de açık.
  expect(touchWithText(copy.saveList).props.disabled).toBe(false);
  expect(touchWithText(copy.sendChat).props.disabled).toBe(false);
});

test("Free: daha önce verilmiş oy görünür ve geri alınabilir (geri almak kapılı değil)", async () => {
  mockLimit = 0;
  mockUsage.mockResolvedValue(1);
  const { set } = require("../services/storage");
  set(Keys.top100Hype, { movie_3: true }, { uid: "u1" });
  mockSetHype.mockResolvedValue({ counter: { count: 0 }, hyped: false, used: 0 });
  await mount(<Top100Screen navigation={navigation()} />);
  expect(voteState("Yapım 3")).toEqual({ label: copy.menuUnvote, icon: "flame" });
  await pressVote("Yapım 3");
  expect(mockShowUpsell).not.toHaveBeenCalled();
  expect(mockSetHype).toHaveBeenCalledWith({ uid: "u1", type: "movie", id: 3, hyped: false, limit: 0 });
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
  mockSetHype.mockResolvedValue({ counter: { count: 1 }, hyped: true, used: 1 });
  await mount(<Top100Screen navigation={navigation()} />);
  act(() => renderer.root.findByType("TextInput").props.onChangeText("bilin"));
  await act(async () => { jest.advanceTimersByTime(400); });
  await flush();
  expect(mockSearch).toHaveBeenCalledWith("k", "tr", "bilin");
  expect(mockMyHype).toHaveBeenCalledWith("u1", "movie_999");
  expect(order()).toEqual(["Bilinmeyen"]);
  expect(texts()).toContain("–"); // sıra rozeti yok
  await pressVote("Bilinmeyen");
  expect(mockSetHype).toHaveBeenCalledWith({ uid: "u1", type: "movie", id: 999, hyped: true, limit: 10 });
  act(() => renderer.root.findByType("TextInput").props.onChangeText(""));
  await flush();
  expect(order()).toContain("Bilinmeyen");
  expect(cellLabel("Bilinmeyen")).toContain("150 oy"); // 50 + 1 × 100
});

test("başka cihazdan verilmiş oy aramada yerel kayda gelir", async () => {
  mockSearch.mockResolvedValue([poolItem("tv_77", 400, "Uzak")]);
  mockMyHype.mockResolvedValue(true);
  await mount(<Top100Screen navigation={navigation()} />);
  act(() => renderer.root.findByType("TextInput").props.onChangeText("uzak"));
  await act(async () => { jest.advanceTimersByTime(400); });
  await flush();
  expect(get(Keys.top100Hype, { uid: "u1" })).toEqual({ tv_77: true });
  expect(voteState("Uzak").label).toBe(copy.menuUnvote);
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
