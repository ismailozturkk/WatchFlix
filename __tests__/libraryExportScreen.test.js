// __tests__/libraryExportScreen.test.js
//
// Ayarlar > Kütüphaneni Dışa Aktar ekranı: yükleme / boş / dolu durumları, düğmelerin servise bağlanması,
// hata toast'ı. Ayar iskeleti ve dosya servisi taklit edilir; veri gerçek çekirdekten geçer.
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  ActivityIndicator: "Spinner",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@components/AppIcon", () => ({ __esModule: true, default: "Icon" }));

const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock("@components/AppToast", () => ({ toast: mockToast }));
jest.mock("@services/hapticsService", () => ({ selectionAsync: () => Promise.resolve() }));

let mockLang = "tr";
jest.mock("@context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
jest.mock("@context/ThemeContext", () => ({ useTheme: () => ({ theme: {} }) }));
let mockLists;
jest.mock("@context/ListStatusContext", () => ({ useListStatusContext: () => mockLists }));

// Ayar iskeleti: gerçek olanı BackButton / ScreenDecor / güvenli alan bağlar; burada yalnız yapı önemli.
jest.mock("../screens/tabs/settings/settingsUi", () => {
  const React = require("react");
  const host = (name) => ({ children, ...props }) => React.createElement(name, props, children);
  return {
    SettingsSubScreen: host("Screen"),
    SectionLabel: host("Label"),
    SettingRow: host("Row"),
    Chevron: "Chevron",
    ui: new Proxy({}, { get: () => ({}) }),
    buildUiColors: () =>
      new Proxy({}, { get: (_t, key) => (typeof key === "string" ? `#${String(key).length}` : undefined) }),
  };
});

const mockExportJson = jest.fn();
const mockExportZip = jest.fn();
jest.mock("@services/libraryExportFiles", () => ({
  snapshotFromLibrary: (input) => require("../utils/libraryExport").buildLibrarySnapshot(input, {}),
  exportLibraryJson: (...args) => mockExportJson(...args),
  exportLibraryZip: (...args) => mockExportZip(...args),
}));

const LibraryExportScreen = require("../screens/tabs/settings/LibraryExportScreen").default;
const { LIBRARY_EXPORT_COPY } = require("../screens/tabs/settings/libraryExportCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let warn;
const filled = () => ({
  loading: false,
  watchedTvLoaded: true,
  activityIndex: { ratings: { movie_1: 8 } },
  combinedLists: {
    watchedMovies: [{ id: 1, type: "movie", name: "Alfa", watchEvents: [{ id: "a", watchedAt: "2026-01-05", scope: "movie" }] }],
    watchedTv: [],
    watchList: [{ id: 2, type: "movie", name: "Beta" }],
    favorites: [],
  },
});

beforeEach(() => {
  mockLang = "tr";
  mockLists = filled();
  mockExportJson.mockReset().mockResolvedValue({ ok: true, fileName: "x.json" });
  mockExportZip.mockReset().mockResolvedValue({ ok: true, fileName: "x.zip" });
  Object.values(mockToast).forEach((fn) => fn.mockClear());
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  warn.mockRestore();
});

const mount = () => {
  act(() => {
    renderer = create(<LibraryExportScreen />);
  });
};
const texts = () => renderer.root.findAllByType("Text").map((n) => n.props.children);
const rowFor = (title) => renderer.root.findAllByType("Row").find((n) => n.props.title === title);
const tap = async (row) => {
  await act(async () => {
    await row.props.onPress?.();
  });
};
const copy = LIBRARY_EXPORT_COPY.tr;

it("dolu kütüphanede sayıları gösterir; yalnız dolu satırlar", () => {
  mount();
  const t = texts();
  expect(t).toContain(copy.films(1));
  expect(t).toContain(copy.watchList(1));
  expect(t).toContain(copy.ratings(1));
  expect(t).not.toContain(copy.favorites(0));
  expect(t).not.toContain(copy.shows(0, 0)); // dizi satırı yok
});

it("JSON düğmesi servisi çağırır ve başarıda toast gösterir", async () => {
  mount();
  await tap(rowFor(copy.jsonTitle));
  expect(mockExportJson).toHaveBeenCalledTimes(1);
  expect(mockExportJson.mock.calls[0][0].counts.watchedMovies).toBe(1);
  expect(mockExportJson.mock.calls[0][1]).toEqual({ dialogTitle: copy.title });
  expect(mockToast.success).toHaveBeenCalledWith(copy.ready);
  expect(mockExportZip).not.toHaveBeenCalled();
});

it("ZIP düğmesi README'yi kullanıcı dilinde geçirir", async () => {
  mockLang = "en";
  mount();
  await tap(rowFor(LIBRARY_EXPORT_COPY.en.zipTitle));
  expect(mockExportZip).toHaveBeenCalledTimes(1);
  expect(mockExportZip.mock.calls[0][1].readme).toBe(LIBRARY_EXPORT_COPY.en.readme);
});

it("hata kodunu metne çevirip toast gösterir", async () => {
  mockExportJson.mockResolvedValue({ ok: false, error: "sharing-unavailable" });
  mount();
  await tap(rowFor(copy.jsonTitle));
  expect(mockToast.error).toHaveBeenCalledWith(copy.errSharing);
  expect(mockToast.success).not.toHaveBeenCalled();
});

it("listeler yüklenmeden düğmeler çalışmaz, yükleniyor yazar", async () => {
  mockLists = { ...filled(), watchedTvLoaded: false };
  mount();
  expect(texts()).toContain(copy.loading);
  expect(rowFor(copy.jsonTitle).props.onPress).toBeUndefined();
  expect(rowFor(copy.zipTitle).props.onPress).toBeUndefined();
});

it("ListStatusContext yoksa da çökmez", () => {
  mockLists = undefined;
  mount();
  expect(texts()).toContain(copy.loading);
});

it("kütüphane boşken açıklama gösterir, düğmeler kapalı", () => {
  mockLists = { loading: false, watchedTvLoaded: true, combinedLists: { watchedMovies: [], watchedTv: [], watchList: [], favorites: [] } };
  mount();
  expect(texts()).toContain(copy.empty);
  expect(rowFor(copy.jsonTitle).props.onPress).toBeUndefined();
});

it("çalışırken ikinci dokunuş yeni dışa aktarma başlatmaz", async () => {
  let release;
  mockExportJson.mockReturnValue(new Promise((resolve) => (release = resolve)));
  mount();
  const row = rowFor(copy.jsonTitle);
  let first;
  await act(async () => {
    first = row.props.onPress();
  });
  await tap(rowFor(copy.zipTitle));
  expect(mockExportZip).not.toHaveBeenCalled();
  await act(async () => {
    release({ ok: true });
    await first;
  });
  expect(mockExportJson).toHaveBeenCalledTimes(1);
});
