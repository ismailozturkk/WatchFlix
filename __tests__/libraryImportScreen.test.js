// __tests__/libraryImportScreen.test.js
//
// Ayarlar > Kütüphaneni İçe Aktar ekranı: giriş → dosya seç → önizleme (bölüm seçimi) → çalışıyor → bitti;
// dosya hatası, iptal/kesinti → sürdür. Hareketli parçalar (RestoreVisuals) ve servisler taklit edilir;
// yedek gerçek çekirdekten (utils/libraryExport → utils/libraryImport) geçer.
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
}));
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const chain = () => new Proxy(() => chain(), { get: () => () => chain() });
  return {
    __esModule: true,
    default: { View: ({ children, entering: _e, ...props }) => React.createElement("AView", props, children) },
    FadeIn: chain(),
    FadeInDown: chain(),
    FadeInUp: chain(),
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));
jest.mock("@components/AppIcon", () => ({ __esModule: true, default: "Icon" }));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("@components/AppToast", () => ({ toast: mockToast }));
jest.mock("@services/hapticsService", () => ({
  selectionAsync: () => Promise.resolve(),
  notificationAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("@context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1", displayName: "Ad" } }) }));
jest.mock("@context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("@context/ThemeContext", () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock("@context/UserProfileContext", () => ({ useUserProfile: () => ({ username: "ad" }) }));
const mockRefreshList = jest.fn(() => Promise.resolve());
jest.mock("@context/ListStatusContext", () => ({ useListStatusContext: () => ({ refreshList: mockRefreshList }) }));
jest.mock("../components/common/GlassBox", () => ({ __esModule: true, default: "GlassBox" }));
jest.mock("../components/common/GlassTouchable", () => ({ __esModule: true, default: "Touch" }));
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => true }));
jest.mock("../screens/tabs/settings/BackupKit", () => ({ SectionHead: "SectionHead" }));
jest.mock("../screens/tabs/settings/settingsUi", () => {
  const React = require("react");
  return {
    SettingsSubScreen: ({ children, ...props }) => React.createElement("Screen", props, children),
    ui: new Proxy({}, { get: () => ({}) }),
    buildUiColors: () => new Proxy({}, { get: (_t, key) => (typeof key === "string" ? `#${key}` : undefined) }),
  };
});
jest.mock("../components/libraryImport/RestoreVisuals", () => {
  const React = require("react");
  const host = (name) => (props) => React.createElement(name, props);
  return {
    RestoreOrb: host("Orb"),
    StageList: host("Stages"),
    PosterFan: host("PosterFan"),
    SummaryTiles: host("Tiles"),
    SectionToggle: host("Toggle"),
  };
});

const mockPick = jest.fn();
const mockRun = jest.fn();
const mockCreate = jest.fn();
jest.mock("../services/libraryImportService", () => ({
  pickLibraryBackup: (...a) => mockPick(...a),
  createLibraryRestoreJob: (...a) => mockCreate(...a),
  runLibraryRestore: (...a) => mockRun(...a),
  restoreSummary: () => ({ titles: 1, watchEvents: 0, ratings: 0, lists: 0, comments: 0, posters: [] }),
}));
jest.mock("../services/import/importRetry", () => ({
  createImportSignal: () => ({ cancelled: false, cancel: jest.fn() }),
}));

const mockNavigation = { goBack: jest.fn() };
const { buildLibrarySnapshot } = require("../utils/libraryExport");
const { parseLibraryBackup } = require("../utils/libraryImport");
const LibraryImportScreen = require("../screens/tabs/settings/LibraryImportScreen").default;
const { LIBRARY_IMPORT_COPY } = require("../screens/tabs/settings/libraryImportCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;
const copy = LIBRARY_IMPORT_COPY.tr;

const backupFile = () => {
  const snap = buildLibrarySnapshot(
    {
      lists: {
        watchedMovies: [{ id: 1, type: "movie", name: "Alfa", watchEvents: [{ id: "a", watchedAt: "2026-01-05", scope: "movie" }] }],
        watchList: [{ id: 2, type: "movie", name: "Beta" }],
      },
      ratings: { movie_1: 8 },
      comments: [{ id: "c1", kind: "movie", targetId: 1, text: "Güzel", createdAt: "2026-01-05T10:00:00.000Z" }],
    },
    { now: new Date(Date.UTC(2026, 10, 1)), appVersion: "1.5.0", platform: "ios" },
  );
  return { ...parseLibraryBackup(JSON.stringify(snap), { now: new Date(Date.UTC(2026, 10, 13)) }), fileName: "seelogd.json" };
};

let renderer;
let errorSpy;
beforeEach(() => {
  mockPick.mockReset();
  mockRun.mockReset();
  mockRefreshList.mockClear();
  mockCreate.mockReset().mockImplementation((input) => ({ input, plan: { items: [1], comments: [1], totals: { lists: 0 } } }));
  mockNavigation.goBack.mockReset();
  Object.values(mockToast).forEach((fn) => fn.mockClear());
  const original = console.error;
  errorSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  errorSpy.mockRestore();
});

const mount = () => act(() => {
  renderer = create(<LibraryImportScreen />);
});
const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
const button = (label) => renderer.root.findAll((n) => n.type === "Touch" && n.props.accessibilityLabel === label)[0];
const press = async (node) => {
  await act(async () => {
    await node.props.onPress();
  });
};

it("giriş: başlık, adımlar ve dosya seç düğmesi", () => {
  mount();
  const t = texts();
  expect(t).toContain(copy.heroTitle);
  copy.how.forEach((line) => expect(t).toContain(line));
  expect(button(copy.pickButton)).toBeTruthy();
});

it("dosya hatası metne çevrilir ve ekranda kalır", async () => {
  mockPick.mockResolvedValue({ ok: false, error: "zip" });
  mount();
  await press(button(copy.pickButton));
  expect(mockToast.error).toHaveBeenCalledWith(copy.fileErrors.zip);
  expect(texts()).toContain(copy.fileErrors.zip);
});

it("vazgeçilen seçim sessiz kalır", async () => {
  mockPick.mockResolvedValue({ ok: false, cancelled: true });
  mount();
  await press(button(copy.pickButton));
  expect(mockToast.error).not.toHaveBeenCalled();
  expect(texts()).toContain(copy.heroTitle);
});

it("önizleme: yalnız dolu bölümler; seçimden çıkarılan bölüm işe gitmez; bitişte özet", async () => {
  mockPick.mockResolvedValue(backupFile());
  mockRun.mockImplementation(async (_job, { onEvent }) => {
    onEvent({ type: "stage", stage: "matching", total: 2, done: 0 });
    onEvent({ type: "stage", stage: "done" });
    return { titles: 2, watchEvents: 1, ratings: 1, lists: 0, comments: 1, commentsKept: 0, preservedRatings: 0, skippedRatings: 0, failed: 0, posters: [] };
  });
  mount();
  await press(button(copy.pickButton));

  const toggles = renderer.root.findAllByType("Toggle");
  expect(toggles.map((n) => n.props.title)).toEqual([copy.films(1, 1), copy.watchList(1), copy.ratings(1), copy.comments(1)]);
  expect(texts()).toContain(copy.sectionsSelected(4, 4));

  // Yorumları çıkar.
  act(() => toggles[3].props.onToggle());
  expect(texts()).toContain(copy.sectionsSelected(3, 4));

  await press(button(copy.startButton));
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate.mock.calls[0][0]).toMatchObject({ uid: "u1", sections: ["films", "watchList", "ratings"] });
  expect(mockCreate.mock.calls[0][0].userProfile).toMatchObject({ displayName: "Ad", username: "ad" });

  expect(texts()).toContain(copy.doneTitle);
  const tiles = renderer.root.findByType("Tiles").props.items;
  expect(tiles.map((tile) => tile.id)).toEqual(["titles", "watches", "ratings", "comments"]);
  await press(button(copy.finish));
  expect(mockNavigation.goBack).toHaveBeenCalled();
});

it("hiç bölüm seçili değilse başlatmaz", async () => {
  mockPick.mockResolvedValue(backupFile());
  mount();
  await press(button(copy.pickButton));
  const selectNone = renderer.root.findAll((n) => n.type === "Touch" && !n.props.accessibilityLabel)[0];
  await press(selectNone);
  expect(texts()).toContain(copy.sectionsSelected(0, 4));
  expect(button(copy.startButton).props.disabled).toBe(true);
});

it("bağlantı kesilirse sürdür düğmesi aynı işi devam ettirir", async () => {
  mockPick.mockResolvedValue(backupFile());
  mockRun.mockRejectedValueOnce(Object.assign(new Error("net"), { code: "network" }));
  mount();
  await press(button(copy.pickButton));
  await press(button(copy.startButton));
  expect(texts()).toContain(copy.runErrors.network);
  const job = mockRun.mock.calls[0][0];

  mockRun.mockResolvedValueOnce({ titles: 1, watchEvents: 0, ratings: 0, lists: 0, comments: 0, posters: [] });
  await press(button(copy.resume));
  expect(mockRun).toHaveBeenCalledTimes(2);
  expect(mockRun.mock.calls[1][0]).toBe(job);
  // Yarıda kalan ve biten geri yüklemenin ikisinde de liste önbelleği yenilenir.
  expect(mockRefreshList).toHaveBeenCalledTimes(2);
  expect(mockRefreshList).toHaveBeenCalledWith("all");
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(texts()).toContain(copy.doneTitle);
});
