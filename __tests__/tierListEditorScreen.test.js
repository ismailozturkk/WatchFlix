// __tests__/tierListEditorScreen.test.js
//
// Tier list'in BAĞLANTISI: tablolarım ekranı + düzenleyici + useTierLists, GERÇEK depo (bellek-içi MMKV) ve gerçek
// çekirdekle (utils/tierList.js). Dokun-seç / dokun-yerleştir, seçim çubuğu, kademe sayfası, oluşturma ve sohbet
// paylaşımı. Görsel parçalar (cam düğme, alt sayfa, ekran kabuğu) taklit edilip props'ları tetiklenir.

import React from "react";
import { act, create } from "react-test-renderer";

// Afiş köşesi (Ayarlar > Poster görünümü) burada sınanmıyor: taban köşe aynen döner.
jest.mock("../hooks/usePosterCorner", () => () => (base) => base);
jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  ScrollView: "ScrollView",
  ActivityIndicator: "Spinner",
  PixelRatio: { get: () => 3 },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
const mockHost = (name) => ({
  __esModule: true,
  default: ({ children, ...props }) => require("react").createElement(name, props, children),
});
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));
jest.mock("react-native-view-shot", () => ({ captureRef: jest.fn(async () => "/tmp/card.png") }));
jest.mock("../services/storyShare/storyShareService", () => ({
  saveStoryToGallery: jest.fn(async () => {}),
  toShareableUri: (uri) => `file://${uri}`,
}));
jest.mock("../components/AppIcon", () => mockHost("Icon"));
jest.mock("../components/common/GlassTouchable", () => mockHost("Touch"));
jest.mock("../components/common/GlassIconButton", () => mockHost("IconButton"));
jest.mock("../components/common/GlassTextInput", () => mockHost("Input"));
jest.mock("../components/common/GlassPillButton", () => ({
  __esModule: true,
  default: ({ label, ...props }) => require("react").createElement("Pill", { label, ...props }),
}));
jest.mock("../components/common/GlassSegmentedControl", () => mockHost("Segments"));
jest.mock("../components/common/GlassCloseButton", () => mockHost("Close"));
jest.mock("../components/common/SheetScroll", () => mockHost("SheetScroll"));
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children, ...props }) =>
    require("react").createElement("Sheet", { visible, ...props }, visible ? children : null),
}));
jest.mock("../components/chat/ShareToChatSheet", () => mockHost("ChatSheet"));
jest.mock("../components/common/GlassPressable", () => mockHost("Pressable"));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock("../screens/game/GameScreenShell", () => ({
  GameScreenShell: ({ title, children, footer, headerRight }) =>
    require("react").createElement("Shell", { title }, headerRight, children, footer),
}));
jest.mock("../services/hapticsService", () => ({ triggerHaptic: () => {} }));
const mockToast = { success: jest.fn(), info: jest.fn(), error: jest.fn() };
jest.mock("../components/AppToast", () => ({ toast: mockToast }));
jest.mock("../services/top100Service", () => ({ searchTop100: jest.fn(async () => []) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", between: "#222222", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1", displayName: "İsmail Öztürk" } }) }));
jest.mock("../context/AppSettingsContext", () => ({
  useApiSettings: () => ({ API_KEY: "k" }),
  useImageQualitySettings: () => ({ getTmdbUrl: (p) => `img${p}` }),
}));
jest.mock("../context/PosterChoicesContext", () => ({ usePosterResolver: () => (type, id, path) => path }));
jest.mock("../context/ListStatusContext", () => ({
  useListStatusContext: () => ({
    watchedMoviesItems: [{ id: 7, type: "movie", name: "Film 7", imagePath: "/p7.jpg", dateAdded: 5 }],
    watchedTvMap: { 8: { id: 8, name: "Dizi 8", imagePath: "/t8.jpg", dateAdded: 9 } },
    favoritesItems: [],
    watchListItems: [],
  }),
}));

const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get, set } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const TierListEditorScreen = require("../screens/fun/TierListEditorScreen").default;
const TierListsScreen = require("../screens/fun/TierListsScreen").default;
const { addMedia, createTierList, normalizeTierState } = require("../utils/tierList");
const { getTierListCopy, templateLabelsOf } = require("../utils/tierListCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;
const copy = getTierListCopy("tr");
const film = (id) => ({ id, media_type: "movie", title: `Film ${id}`, poster_path: `/p${id}.jpg` });

let renderer;
let errSpy;
beforeEach(() => {
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  Object.values(mockToast).forEach((fn) => fn.mockClear());
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
});

const seed = (n = 3) => {
  const base = createTierList({ id: "tl1", title: "Diziler", template: "classic", labels: templateLabelsOf(copy, "classic"), now: 1 });
  const { list } = addMedia(base, Array.from({ length: n }, (_, i) => film(i + 1)), 2);
  set(Keys.tierLists, { lists: [list] }, { uid: "u1" });
};
const stored = () => normalizeTierState(get(Keys.tierLists, { uid: "u1" })).lists[0];
const navigation = () => ({ navigate: jest.fn(), goBack: jest.fn() });
const flush = async () => {
  for (let i = 0; i < 3; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await Promise.resolve(); });
  }
};
const byTestId = (id) => renderer.root.find((n) => n.props.testID === id && typeof n.type === "string");
const press = (node) => act(() => { node.props.onPress(); });
const sheets = () => renderer.root.findAllByType("Sheet");
const textOf = (n) => [].concat(n.props.children).join("");
const texts = () => renderer.root.findAllByType("Text").map(textOf);

const mountEditor = (nav = navigation()) => {
  act(() => { renderer = create(<TierListEditorScreen navigation={nav} route={{ params: { id: "tl1" } }} />); });
  return nav;
};

test("havuzdan seç → kademeye dokun: sona yerleşir; afişe dokun: önüne girer; kayda yazılır", () => {
  seed(3);
  mountEditor();
  press(byTestId("tier-pool-movie_1"));
  expect(texts()).toContain(copy.selected("Film 1"));
  press(byTestId("tier-row-t0"));
  press(byTestId("tier-pool-movie_2"));
  press(byTestId("tier-row-t0"));
  press(byTestId("tier-pool-movie_3"));
  press(byTestId("tier-item-movie_1"));
  expect(stored().tiers[0].items).toEqual(["movie_3", "movie_1", "movie_2"]);
  expect(stored().pool).toEqual([]);
  expect(texts()).not.toContain(copy.selected("Film 3"));
});

test("havuzda iki afiş: ikinciye dokunmak yalnız seçimi değiştirir; aynı afiş seçimi kaldırır", () => {
  seed(2);
  mountEditor();
  press(byTestId("tier-pool-movie_1"));
  press(byTestId("tier-pool-movie_2"));
  expect(stored().pool).toEqual(["movie_1", "movie_2"]);
  expect(texts()).toContain(copy.selected("Film 2"));
  press(byTestId("tier-pool-movie_2"));
  expect(texts().some((t) => t.startsWith("Seçili:"))).toBe(false);
});

test("seçim çubuğu: havuza al ve tablodan çıkar", () => {
  seed(2);
  mountEditor();
  press(byTestId("tier-pool-movie_1"));
  press(byTestId("tier-row-t2"));
  press(byTestId("tier-item-movie_1"));
  press(byTestId("tier-to-pool"));
  expect(stored().tiers[2].items).toEqual([]);
  expect(stored().pool).toEqual(["movie_2", "movie_1"]);
  press(byTestId("tier-pool-movie_2"));
  press(byTestId("tier-remove"));
  expect(stored().media.movie_2).toBeUndefined();
});

test("kademe sayfası: renk anında, ad Tamam'da yazılır", () => {
  seed(1);
  mountEditor();
  press(byTestId("tier-label-t1"));
  const tierSheet = sheets().find((s) => s.props.visible);
  const swatch = tierSheet.findAll((n) => n.type === "Touch" && n.props.accessibilityLabel === "#7FBFFF")[0];
  press(swatch);
  expect(stored().tiers[1].color).toBe("#7FBFFF");
  act(() => { byTestId("tier-label-input").props.onChangeText("Efsane"); });
  const done = renderer.root.findAll((n) => n.type === "Pill" && n.props.label === copy.done)[0];
  press(done);
  expect(stored().tiers[1].label).toBe("Efsane");
});

test("içerik ekleme: izlediklerimden seçilenler havuza düşer", async () => {
  seed(0);
  mountEditor();
  press(byTestId("tier-add"));
  press(byTestId("tier-pick-tv_8"));
  press(byTestId("tier-pick-movie_7"));
  const add = renderer.root.findAll((n) => n.type === "Pill" && n.props.label === copy.addAction(2))[0];
  press(add);
  await flush();
  expect(stored().pool).toEqual(["tv_8", "movie_7"]);
  expect(mockToast.success).toHaveBeenCalledWith(copy.added(2));
});

test("sohbete gönder: yerleşmiş yapım yoksa uyarır, varsa tierList gövdesi alıcı sayfasına gider", () => {
  seed(2);
  mountEditor();
  const shareButton = renderer.root.findAll((n) => n.type === "IconButton" && n.props.accessibilityLabel === copy.share)[0];
  const choose = (choice) => {
    press(shareButton);
    const shareSheet = sheets().find((s) => s.props.visible);
    press(byTestId(`tier-share-${choice}`));
    act(() => { shareSheet.props.onDismissed(); });
  };
  choose("chat");
  expect(mockToast.info).toHaveBeenCalledWith(copy.shareNothing);
  expect(renderer.root.findByType("ChatSheet").props.visible).toBe(false);

  press(byTestId("tier-pool-movie_1"));
  press(byTestId("tier-row-t0"));
  choose("chat");
  const chat = renderer.root.findByType("ChatSheet");
  expect(chat.props.visible).toBe(true);
  expect(chat.props.share).toMatchObject({ type: "tierList", title: "Diziler", total: 1, host: "İsmail" });
  expect(chat.props.share.tiers[0].items[0]).toMatchObject({ id: 1, media_type: "movie" });
});

test("tablolarım: oluştur → sayfa kapanınca düzenleyici açılır; menüden sil iki adımlı", () => {
  const nav = navigation();
  act(() => { renderer = create(<TierListsScreen navigation={nav} route={{ params: {} }} />); });
  expect(texts()).toContain(copy.empty);
  press(byTestId("tier-create"));
  press(byTestId("tier-template-vibe"));
  act(() => { byTestId("tier-create-title").props.onChangeText("Yıl sonu"); });
  const createSheet = sheets().find((s) => s.props.visible);
  press(renderer.root.findAll((n) => n.type === "Pill" && n.props.label === copy.createAction)[0]);
  act(() => { createSheet.props.onDismissed(); });
  const list = stored();
  expect(list.title).toBe("Yıl sonu");
  expect(list.tiers[0].label).toBe("Zirve");
  expect(nav.navigate).toHaveBeenCalledWith("TierListEditorScreen", { id: list.id });

  press(renderer.root.findAll((n) => n.type === "IconButton" && n.props.accessibilityLabel === copy.more)[0]);
  const del = () => renderer.root.findAll((n) => n.type === "Pill" && (n.props.label === copy.delete || n.props.label === copy.deleteTitle))[0];
  press(del());
  expect(stored()).toBeDefined();
  press(del());
  expect(get(Keys.tierLists, { uid: "u1" })).toBeNull();
});

test("tablolarım '…' menüsü: sohbete gönder ve galeriye kaydet menü KAPANDIKTAN sonra çalışır", async () => {
  const { placeMedia } = require("../utils/tierList");
  const { captureRef } = require("react-native-view-shot");
  const { saveStoryToGallery } = require("../services/storyShare/storyShareService");
  const base = createTierList({ id: "tl1", title: "Diziler", template: "classic", labels: templateLabelsOf(copy, "classic"), now: 1 });
  const ranked = placeMedia(addMedia(base, [film(1), film(2)], 2).list, "movie_1", "t0", null, 3);
  set(Keys.tierLists, { lists: [ranked] }, { uid: "u1" });
  act(() => { renderer = create(<TierListsScreen navigation={navigation()} route={{ params: {} }} />); });

  const menuChoose = (label) => {
    press(renderer.root.findAll((n) => n.type === "IconButton" && n.props.accessibilityLabel === copy.more)[0]);
    const menu = sheets().find((s) => s.props.visible);
    press(renderer.root.findAll((n) => n.type === "Pill" && n.props.label === label)[0]);
    expect(menu.props.visible).toBe(false);
    return menu;
  };

  const chatMenu = menuChoose(copy.shareChat);
  expect(renderer.root.findByType("ChatSheet").props.visible).toBe(false);
  act(() => { chatMenu.props.onDismissed(); });
  const chat = renderer.root.findByType("ChatSheet");
  expect(chat.props.visible).toBe(true);
  expect(chat.props.share).toMatchObject({ type: "tierList", title: "Diziler", total: 1 });
  act(() => { chat.props.onClose(); });

  const galleryMenu = menuChoose(copy.saveImage);
  act(() => { galleryMenu.props.onDismissed(); });
  const card = renderer.root.find((n) => n.type === "View" && n.props.collapsable === false);
  act(() => { card.props.onLayout({ nativeEvent: { layout: { width: 360, height: 480 } } }); });
  card.findAll((n) => n.type === "Image").forEach((img) => act(() => { img.props.onLoad(); }));
  await flush();
  expect(captureRef).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ width: 1080, height: 1440 }));
  expect(saveStoryToGallery).toHaveBeenCalledWith("/tmp/card.png");
  expect(mockToast.success).toHaveBeenCalledWith(copy.saved);
  expect(renderer.root.findAll((n) => n.type === "View" && n.props.collapsable === false)).toHaveLength(0);
});

test("mini önizleme: en çok 6 kademe, satıra sığan en çok 12 afiş ve kalan için +N", () => {
  const TierMiniPreview = require("../components/tierList/TierMiniPreview").default;
  const { fitPosterCount } = require("../components/tierList/TierMiniPreview");
  expect(fitPosterCount(5, 0, 12)).toBe(5);
  expect(fitPosterCount(30, 0, 12)).toBe(12);
  expect(fitPosterCount(5, 400, 12)).toBe(5);
  expect(fitPosterCount(30, 400, 12)).toBe(12);
  // 21 px/afiş: 150 px'e 7 sığar; taşan varsa "+N" için yer → 6.
  expect(fitPosterCount(7, 150, 12)).toBe(7);
  expect(fitPosterCount(8, 150, 12)).toBe(6);

  const tiers = Array.from({ length: 8 }, (_, i) => ({ label: `K${i}`, color: "#FF7F7F", items: Array.from({ length: 20 }, (__, j) => film(i * 100 + j)) }));
  act(() => { renderer = create(<TierMiniPreview tiers={tiers} posterUriOf={(m) => m.poster_path} moreLabel={(n) => `+${n} kademe`} />); });
  expect(renderer.root.findAllByType("Image")).toHaveLength(6 * 12);
  expect(texts()).toContain("+2 kademe");
  const wrap = renderer.root.find((n) => n.type === "View" && typeof n.props.onLayout === "function");
  act(() => { wrap.props.onLayout({ nativeEvent: { layout: { width: 54 + 6 + 4 + 150 } } }); });
  expect(renderer.root.findAllByType("Image")).toHaveLength(6 * 6);
  expect(texts()).toContain("+14");
});

test("sohbet balonu: gelen tablo tam görünümde açılır, kopyası kaydedilir ve sayfa kapanınca düzenleyiciye gidilir", () => {
  const SharedTierListMessage = require("../components/chat/SharedTierListMessage").default;
  const { buildTierListShare } = require("../utils/chatShare");
  const share = buildTierListShare({
    title: "Arkadaşın listesi",
    host: "Ayşe",
    tiers: [
      { label: "Zirve", color: "#FF7F7F", items: [film(11), film(12)] },
      { label: "Çöp", color: "#7FBFFF", items: [] },
    ],
  });
  mockNavigate.mockClear();
  act(() => { renderer = create(<SharedTierListMessage share={share} isOutgoing={false} />); });
  expect(texts()).toContain("Arkadaşın listesi");
  press(byTestId("tier-share-bubble"));
  const preview = sheets().find((s) => s.props.visible);
  press(renderer.root.findAll((n) => n.type === "Pill" && n.props.label === copy.previewCopy)[0]);
  const list = stored();
  expect(list.title).toBe("Arkadaşın listesi");
  expect(list.tiers.map((t) => t.label)).toEqual(["Zirve", "Çöp"]);
  expect(list.tiers[0].items).toEqual(["movie_11", "movie_12"]);
  expect(mockNavigate).not.toHaveBeenCalled();
  act(() => { preview.props.onDismissed(); });
  expect(mockNavigate).toHaveBeenCalledWith("TierListEditorScreen", { id: list.id });
});

test("sohbet balonu: kendi gönderdiğin tabloda kopyala düğmesi yok", () => {
  const SharedTierListMessage = require("../components/chat/SharedTierListMessage").default;
  const { buildTierListShare } = require("../utils/chatShare");
  const share = buildTierListShare({ title: "Benim", tiers: [{ label: "S", color: "#FF7F7F", items: [film(1)] }, { label: "A", color: "#FFBF7F", items: [] }] });
  act(() => { renderer = create(<SharedTierListMessage share={share} isOutgoing />); });
  press(byTestId("tier-share-bubble"));
  expect(renderer.root.findAll((n) => n.type === "Pill" && n.props.label === copy.previewCopy)).toHaveLength(0);
});
