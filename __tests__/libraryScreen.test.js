// __tests__/libraryScreen.test.js
//
// Kütüphane sekmesi (screens/tabs/LibraryScreen.js): Profil'den taşınan Listeler / Hatırlatmalar /
// Notlar + TV rafının "Sıradaki"si. Bileşenlerin kendisi taklit edilir (tasarımları değişmedi);
// burada yalnız DİZİLİM, görünürlük bağları ve ölçüm yüzeyi doğrulanır.
//
// Ayrıca Ayarlar'ın sekmeden çıkıp Profil'in dişli düğmesine taşındığı kaynak düzeyinde
// sabitlenir: biri sekmeyi geri getirirse ya da düğmeyi koparırsa test kırılır.

import React from "react";
import fs from "fs";
import path from "path";
import { act, create } from "react-test-renderer";

let mockShowOngoing = true;
let mockSections = { isVisible: () => true, allHidden: false };
jest.mock("react-native", () => ({
  StyleSheet: { create: (styles) => styles },
  ScrollView: "ScrollView",
  View: "View",
  Text: "Text",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) }));
jest.mock("../components/ScreenDecor", () => ({ __esModule: true, default: "Decor" }));
jest.mock("../components/home/SectionsHiddenNotice", () => ({ __esModule: true, default: "HiddenNotice" }));
jest.mock("../components/navigation/TabScrollMarker", () => ({ markTabScroll: (component) => component }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ t: { library: "Kütüphane" } }) }));
jest.mock("../context/AppSettingsContext", () => ({
  useOngoingTvShowsSettings: () => ({ showOngoingTvShows: mockShowOngoing }),
}));
jest.mock("../context/TabBarLayoutContext", () => ({ useTabBarLayout: () => ({ contentBottom: 120 }) }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: { primary: "#000000", text: { primary: "#ffffff" } } }),
}));
jest.mock("../hooks/useSectionVisibility", () => ({ __esModule: true, default: () => mockSections }));
jest.mock("../hooks/useTabBarScrollSync", () => ({ __esModule: true, default: () => jest.fn() }));
jest.mock("../screens/tv/TvOngoingSection", () => ({ __esModule: true, default: "NextUp" }));
jest.mock("../screens/tabs/profile/ProfileLists", () => ({ __esModule: true, default: "Lists" }));
jest.mock("../screens/tabs/profile/RemindersPreviewButton", () => ({ __esModule: true, default: "Reminders" }));
jest.mock("../screens/tabs/profile/NotesCard", () => ({ __esModule: true, default: "Notes" }));
jest.mock("../components/hub/HubWrappedModule", () => ({ __esModule: true, default: "Wrapped" }));

const LibraryScreen = require("../screens/tabs/LibraryScreen").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

const KOK = path.join(__dirname, "..");
const oku = (...parcalar) => fs.readFileSync(path.join(KOK, ...parcalar), "utf8");

let renderer;
let warn;
const navigation = { navigate: jest.fn(), push: jest.fn() };
beforeEach(() => {
  mockShowOngoing = true;
  mockSections = { isVisible: () => true, allHidden: false };
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

const render = () => {
  act(() => { renderer = create(<LibraryScreen navigation={navigation} />); });
};
// Ekrandaki bölümlerin sırası (taklit edilen bileşen adlarından).
const order = () =>
  renderer.root
    .findAll((node) => ["NextUp", "Lists", "Reminders", "Notes", "Wrapped", "HiddenNotice"].includes(node.type))
    .map((node) => node.type);

describe("Kütüphane sekmesi", () => {
  test("sıra: Sıradaki → Listeler → Hatırlatmalar → Notlar → Wrapped; sayfa başlığı sekme adıdır", () => {
    render();
    expect(order()).toEqual(["NextUp", "Lists", "Reminders", "Notes", "Wrapped"]);
    const title = renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
    expect(title).toContain("Kütüphane");
  });

  test("her bölüme gezinme verilir; Sıradaki ölçümde 'library' yüzeyi olarak ayrışır", () => {
    render();
    for (const type of ["NextUp", "Lists", "Reminders", "Notes", "Wrapped"]) {
      expect(renderer.root.findByType(type).props.navigation).toBe(navigation);
    }
    expect(renderer.root.findByType("NextUp").props.surface).toBe("library");
  });

  test("Sıradaki, TV rafıyla ORTAK 'Devam eden diziler' ayarına bağlı", () => {
    mockShowOngoing = false;
    render();
    expect(order()).toEqual(["Lists", "Reminders", "Notes", "Wrapped"]);
  });

  test("gizlenen bölüm çizilmez, ötekiler yerinde kalır", () => {
    mockSections = { isVisible: (id) => id !== "lists", allHidden: false };
    render();
    expect(order()).toEqual(["NextUp", "Reminders", "Notes", "Wrapped"]);
  });

  test("saklanan bölümlerin hepsi gizliyse bildirim kartı 'library' sekmesini açar", () => {
    mockSections = { isVisible: () => false, allHidden: true };
    mockShowOngoing = false;
    render();
    expect(order()).toEqual(["HiddenNotice"]);
    expect(renderer.root.findByType("HiddenNotice").props.screen).toBe("library");
  });

  test("arka plan efekti 'lists' grubuna bağlı ve içerik sekme çubuğunun üstünde biter", () => {
    render();
    expect(renderer.root.findByType("Decor").props.scope).toBe("lists");
    expect(renderer.root.findByType("ScrollView").props.contentContainerStyle).toEqual({ paddingBottom: 120 });
  });
});

describe("Ayarlar sekmeden Profil'in dişli düğmesine taşındı (kaynak sabitlemesi)", () => {
  test("sekme navigatörü Kütüphane'yi kurar, Ayarlar'ı kurmaz", () => {
    const kaynak = oku("screens", "navigation", "TabScreenNavigator.js");
    expect(kaynak).toContain('import LibraryScreen from "@screens/tabs/LibraryScreen"');
    expect(kaynak).not.toContain("@screens/tabs/SettingsScreen");
    expect(kaynak).not.toMatch(/<SettingsScreen/);
  });

  test("Ayarlar stack ekranı olarak kayıtlı", () => {
    expect(oku("App.js")).toMatch(/name="SettingsScreen"[\s\S]{0,160}screens\/tabs\/SettingsScreen"\)\.default/);
  });

  test("Profil'in dişli düğmesi SettingsScreen'i açar; Listeler/Hatırlatmalar/Notlar artık Profil'de değil", () => {
    const kaynak = oku("screens", "tabs", "ProfileScreen.js");
    expect(kaynak).toContain('navigate("SettingsScreen")');
    expect(kaynak).toContain("onSettings={goSettings}");
    expect(oku("components", "profile", "ProfileIdentityBlock.js")).toContain(
      "profile-settings-button"
    );
    for (const tasinan of ["ProfileLists", "RemindersPreviewButton", "NotesCard"]) {
      expect(kaynak).not.toContain(`import ${tasinan}`);
    }
  });

  test("Ayarlar ekranı sekme çubuğuna bağımlı değil: ortak alt ekran iskeletini kullanır", () => {
    const kaynak = oku("screens", "tabs", "SettingsScreen.js");
    expect(kaynak).toContain("<SettingsSubScreen");
    for (const sekmeBagi of ["useTabBarLayout", "useTabBarScrollSync", "markTabScroll", "contentBottom"]) {
      expect(kaynak).not.toContain(sekmeBagi);
    }
  });
});
