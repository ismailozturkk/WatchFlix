// __tests__/posterSettingsReminderBadge.test.js
//
// Ayarlar > Poster görünümü ekranında "hatırlatma" (zil) rozeti: ekran gerçekten
// çizilir, rozet satırı görünür, anahtar doğru değeri yazar, önizleme ve özet
// sayacı ona uyar. Gerçek yerleşim (3 sütunlu ızgarada "Hatırlatma" etiketinin
// sığması, önizleme boyutları) cihazda doğrulanır.

import React from "react";
import { act, create } from "react-test-renderer";
import PosterSettingsScreen from "../screens/tabs/settings/PosterSettingsScreen";
import { REMINDER_BADGE } from "../utils/reminderBadge";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockSettings;
const mockChangePosterBadge = jest.fn();
const mockChangePosterBadges = jest.fn();

jest.mock("react-native", () => {
  const React = require("react");
  return {
    View: "View",
    Text: "Text",
    TouchableOpacity: ({ children, ...rest }) => React.createElement("TouchableOpacity", rest, children),
    StyleSheet: { create: (styles) => styles, flatten: (style) => style, hairlineWidth: 1 },
  };
});
// Babel eklentisi (scripts/babel-transform-app-text.js) `Text`'i AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../components/AppIcon", () => {
  const React = require("react");
  return { __esModule: true, default: (props) => React.createElement("Icon", props) };
});
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/AppSettingsContext", () => ({ useListLayoutSettings: () => mockSettings }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
jest.mock("../screens/tabs/settings/settingsUi", () => {
  const React = require("react");
  const colors = new Proxy({}, { get: (_t, name) => `#${String(name)}` });
  return {
    buildUiColors: () => colors,
    SectionLabel: ({ children }) => React.createElement("Text", null, children),
    SettingsSubScreen: ({ children }) => React.createElement("Screen", null, children),
  };
});

function makeSettings(posterBadges = {}) {
  return {
    listsGridColumns: 3,
    changeListsGridColumns: jest.fn(),
    listsPosterRadius: 10,
    changeListsPosterRadius: jest.fn(),
    seeAllGridColumns: 3,
    changeSeeAllGridColumns: jest.fn(),
    seeAllPosterRadius: 10,
    changeSeeAllPosterRadius: jest.fn(),
    railPosterSize: "normal",
    changeRailPosterSize: jest.fn(),
    railPosterRadius: 15,
    changeRailPosterRadius: jest.fn(),
    postListPosterLayout: "spaced",
    changePostListPosterLayout: jest.fn(),
    posterBadges,
    changePosterBadges: mockChangePosterBadges,
    changePosterBadge: mockChangePosterBadge,
  };
}

function render() {
  let tree;
  act(() => {
    tree = create(<PosterSettingsScreen />);
  });
  return tree;
}

const textOf = (node) =>
  node
    .findAllByType("Text")
    .map((n) => [].concat(n.props.children).join(""))
    .join("|");
const findTab = (tree, label) =>
  tree.root.findAll((n) => n.type === "TouchableOpacity" && textOf(n) === label)[0];
const openBadgesTab = (tree) => act(() => findTab(tree, "Poster Rozetleri").props.onPress());
const toggles = (tree) => tree.root.findAll((n) => n.type === "TouchableOpacity" && n.props.accessibilityRole === "checkbox");
const toggleFor = (tree, label) => toggles(tree).find((n) => textOf(n) === label);
const iconCount = (tree, name) => tree.root.findAllByType("Icon").filter((n) => n.props.name === name).length;

beforeEach(() => {
  mockChangePosterBadge.mockClear();
  mockChangePosterBadges.mockClear();
  mockSettings = makeSettings();
});

describe("Poster görünümü — hatırlatma rozeti satırı", () => {
  test("rozetler sekmesinde 'Hatırlatma' satırı var; zil simgesi ve ortak renkle", () => {
    const tree = render();
    openBadgesTab(tree);

    const row = toggleFor(tree, "Hatırlatma");
    expect(row).toBeDefined();
    const icons = row.findAllByType("Icon");
    expect(icons.map((n) => n.props.name)).toContain(REMINDER_BADGE.icon);
    // Açıkken simge kutusu rozet renginde dolu.
    const filled = row.findAllByType("View").some((v) => [].concat(v.props.style).flat().some((s) => s?.backgroundColor === REMINDER_BADGE.color));
    expect(filled).toBe(true);
  });

  test("varsayılan: işaretli; basınca 'reminder' anahtarını KAPATIR", () => {
    const tree = render();
    openBadgesTab(tree);

    const row = toggleFor(tree, "Hatırlatma");
    expect(row.props.accessibilityState).toEqual({ checked: true });
    act(() => row.props.onPress());
    expect(mockChangePosterBadge).toHaveBeenCalledWith(REMINDER_BADGE.key, false);
  });

  test("kapalıyken işaretsiz; basınca AÇAR", () => {
    mockSettings = makeSettings({ reminder: false });
    const tree = render();
    openBadgesTab(tree);

    const row = toggleFor(tree, "Hatırlatma");
    expect(row.props.accessibilityState).toEqual({ checked: false });
    act(() => row.props.onPress());
    expect(mockChangePosterBadge).toHaveBeenCalledWith(REMINDER_BADGE.key, true);
  });

  test("satır 'Liste Durumları' grubunda: diğer durum rozetleriyle aynı yerde", () => {
    const tree = render();
    openBadgesTab(tree);
    const labels = toggles(tree).map((n) => textOf(n));
    const status = labels.slice(0, 8);
    expect(status).toEqual(["İzleme listesi", "İzlendi", "Favori", "Diğer listeler", "Ortak", "Hatırlatma", "Benim", "Yorum"]);
    expect(labels.slice(8)).toEqual(["TMDB", "Oy", "Tarih", "Sayaç"]);
  });
});

describe("Poster görünümü — önizleme ve özet", () => {
  test("açıkken canlı önizleme rozet yığınında zil var; kapalıyken yok", () => {
    // Zil: önizleme yığınında 1 + ayar satırında 1.
    let tree = render();
    openBadgesTab(tree);
    expect(iconCount(tree, REMINDER_BADGE.icon)).toBe(2);

    mockSettings = makeSettings({ reminder: false });
    tree = render();
    openBadgesTab(tree);
    expect(iconCount(tree, REMINDER_BADGE.icon)).toBe(1); // yalnız ayar satırı
  });

  test("özet sayacı yeni rozeti sayar: 12/12 → kapalıyken 11/12", () => {
    let tree = render();
    expect(textOf(tree.root)).toContain("12/12");

    mockSettings = makeSettings({ reminder: false });
    tree = render();
    expect(textOf(tree.root)).toContain("11/12");
  });

  test("'Tümünü kapat' (liste durumları) hatırlatmayı da kapatır, diğer ayarları korur", () => {
    mockSettings = makeSettings({ tmdbRating: false });
    const tree = render();
    openBadgesTab(tree);

    // İlk grup başlığının yanındaki toplu düğme: Liste Durumları.
    const bulk = tree.root.findAll((n) => n.type === "TouchableOpacity" && textOf(n) === "Tümünü kapat")[0];
    act(() => bulk.props.onPress());

    expect(mockChangePosterBadges).toHaveBeenCalledTimes(1);
    const patch = mockChangePosterBadges.mock.calls[0][0];
    expect(patch).toMatchObject({
      watchlist: false,
      watched: false,
      favorite: false,
      other: false,
      shared: false,
      reminder: false,
      rated: false,
      commented: false,
      tmdbRating: false, // önceden kapalıydı, korunur
    });
    // Bilgi grubuna dokunulmadı.
    expect(patch).not.toHaveProperty("countdown");
  });
});
