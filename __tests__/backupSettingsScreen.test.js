// Ayarlar > Ayarları Yedekle: içerik seçimi dışa aktarmaya ve içe aktarma planına yansır,
// bilgi metni ünlem düğmesinin arkasında. Dosya/pano servisi ve iskelet taklit; plan gerçek çekirdekten geçer.
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => ({
  ActivityIndicator: "Spinner",
  LayoutAnimation: { configureNext: () => {}, Presets: {} },
  Platform: { OS: "ios" },
  StyleSheet: { create: (s) => s, hairlineWidth: 1 },
  Text: "Text",
  TouchableOpacity: "Touch",
  View: "View",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@components/AppIcon", () => ({ __esModule: true, default: "Icon" }));
jest.mock("@components/AppAlert", () => ({ appAlert: jest.fn() }));
jest.mock("@components/common/GlassIconButton", () => ({ __esModule: true, default: "GlassIconButton" }));
jest.mock("@components/common/SheetScroll", () => ({ __esModule: true, default: "SheetScroll" }));
jest.mock("@components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) => (visible ? children : null),
}));
jest.mock("../components/common/GlassBox", () => ({ __esModule: true, default: "GlassBox" }));
jest.mock("../components/common/GlassTouchable", () => ({ __esModule: true, default: "GlassTouchable" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeArea" }));

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("@components/AppToast", () => ({ toast: mockToast }));
jest.mock("@services/hapticsService", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("@context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("@context/ThemeContext", () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock("@services/appReload", () => ({ reloadApp: jest.fn(async () => true) }));

jest.mock("../screens/tabs/settings/settingsUi", () => {
  const React = require("react");
  const host = (name) => ({ children, ...props }) => React.createElement(name, props, children);
  return {
    SettingsSubScreen: host("Screen"),
    SettingRow: host("Row"),
    Chevron: "Chevron",
    ui: new Proxy({}, { get: () => ({}) }),
    buildUiColors: () =>
      new Proxy({}, { get: (_t, key) => (typeof key === "string" ? `#${String(key).length}` : undefined) }),
  };
});

const mockBackup = () => {
  const { buildBackup } = jest.requireActual("../utils/settingsBackup");
  return buildBackup((key) => (key === "theme" ? "dark" : key === "haptics" ? true : null));
};
const mockExportFile = jest.fn(async () => ({ ok: true }));
const mockPick = jest.fn();
const mockApply = jest.fn(async () => ({ applied: 1, failed: 0 }));
jest.mock("@services/settingsBackupFiles", () => ({
  exportToFile: (...args) => mockExportFile(...args),
  exportToClipboard: jest.fn(async () => ({ ok: true })),
  pickBackupFile: (...args) => mockPick(...args),
  readClipboardBackup: jest.fn(),
}));
jest.mock("@services/settingsBackupService", () => ({
  collectCurrentBackup: () => mockBackup(),
  getRestorePoint: () => null,
  previewImport: (backup) => {
    const { annotatePlanChanges, planImport } = jest.requireActual("../utils/settingsBackup");
    return annotatePlanChanges(planImport(backup), (key) => (key === "haptics" ? true : null));
  },
  applyImport: (...args) => mockApply(...args),
  restoreFromRestorePoint: jest.fn(),
}));

const BackupSettingsScreen = require("../screens/tabs/settings/BackupSettingsScreen").default;
const { BACKUP_COPY } = require("../screens/tabs/settings/backupCopy");

const copy = BACKUP_COPY.tr;
let renderer;
let spy;

beforeEach(() => {
  jest.clearAllMocks();
  const original = console.error;
  spy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  spy.mockRestore();
});

const mount = () => {
  act(() => {
    renderer = create(<BackupSettingsScreen />);
  });
};
const flat = (children) => [].concat(children).join("");
const texts = () => renderer.root.findAllByType("Text").map((n) => flat(n.props.children));
const row = (title) => renderer.root.findAllByType("Row").find((n) => n.props.title === title);
const checkbox = (title, index = 0) =>
  renderer.root.findAll(
    (n) => n.props.accessibilityRole === "checkbox" && String(n.props.accessibilityLabel).startsWith(title),
  )[index];
const press = (node) => act(async () => { await node.props.onPress(); });

it("varsayılan olarak tüm içerikler seçili, dışa aktarım gruplarla çağrılır", async () => {
  mount();
  await press(row(copy.exportFile));
  const groups = mockExportFile.mock.calls[0][0].groups;
  expect(groups).toContain("appearance");
  expect(groups).toHaveLength(7);
});

it("seçimi kaldırılan grup dışa aktarıma girmez; hiçbiri seçili değilse uyarır", async () => {
  mount();
  await press(checkbox(copy.groupNotifications));
  await press(row(copy.exportFile));
  expect(mockExportFile.mock.calls[0][0].groups).not.toContain("notifications");

  mockExportFile.mockClear();
  // Eksik seçimde ilk basış hepsini seçer, ikincisi temizler.
  const selectAll = () => renderer.root.findAll((n) => n.type === "Touch" && n.props.accessibilityRole === "button")[0];
  await press(selectAll());
  await press(selectAll());
  await press(row(copy.exportFile));
  expect(mockExportFile).not.toHaveBeenCalled();
  expect(mockToast.info).toHaveBeenCalledWith(copy.noneSelected);
});

it("bilgi metni ünlem düğmesine basılana kadar kapalı", async () => {
  mount();
  expect(texts()).not.toContain(copy.notIncluded);
  await press(renderer.root.findAllByType("GlassIconButton")[0]);
  expect(texts()).toContain(copy.notIncluded);
});

it("geri yüklerken istatistik gösterir, yalnız işaretli gruplar uygulanır", async () => {
  mockPick.mockResolvedValue({ ok: true, backup: mockBackup(), fileName: "y.json" });
  mount();
  await press(row(copy.importFile));
  expect(texts()).toContain(copy.statChanged);
  expect(texts()).toContain(copy.statSame);

  // Aynı adlı ilk satır ekrandaki dışa aktarma listesi, ikincisi önizleme sayfasındaki.
  await press(checkbox(copy.groupNotifications, 1));
  const confirm = renderer.root
    .findAllByType("GlassTouchable")
    .find((n) => n.props.onPress && flat(n.findAllByType("Text")[0].props.children) === copy.confirm);
  await press(confirm);
  const applied = mockApply.mock.calls[0][0].writes.map((w) => w.id);
  expect(applied).toContain("theme");
  expect(applied).not.toContain("haptics");
});
