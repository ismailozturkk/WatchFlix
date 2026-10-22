// __tests__/sectionsHiddenNotice.test.js
//
// Bir ekranın tüm bölümleri gizlenince çıkan kart (components/home/SectionsHiddenNotice.js):
// boş ekran yerine nedenini söyler ve ayar sayfasını DOĞRU ekran sekmesinde açar.

import React from "react";
import { act, create } from "react-test-renderer";

let mockLang = "tr";
jest.mock("react-native", () => ({
  StyleSheet: { create: (styles) => styles },
  TouchableOpacity: "Touchable",
  View: "View",
  Text: "Text",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: { accent: "#3388ff", text: { primary: "#ffffff", muted: "#999999" } } }),
}));

const SectionsHiddenNotice = require("../components/home/SectionsHiddenNotice").default;
const { SECTION_VISIBILITY_COPY } = require("../screens/tabs/settings/sectionVisibilityCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let warn;
beforeEach(() => {
  mockLang = "tr";
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

const render = (props) => {
  act(() => { renderer = create(<SectionsHiddenNotice {...props} />); });
};
const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));

test.each(["tr", "en", "es", "pt"])("%s: başlık, açıklama ve düğme metni gösterilir", (dil) => {
  mockLang = dil;
  render({ navigation: { navigate: jest.fn() }, screen: "hub" });
  const ui = SECTION_VISIBILITY_COPY[dil].ui;
  expect(texts()).toEqual([ui.emptyTitle, ui.emptyText, ui.emptyAction]);
});

test.each(["tv", "movie", "hub", "library", "profile"])("düğme ayar sayfasını '%s' sekmesinde açar", (screen) => {
  const navigate = jest.fn();
  render({ navigation: { navigate }, screen });
  act(() => renderer.root.findByProps({ testID: "sections-hidden-action" }).props.onPress());
  expect(navigate).toHaveBeenCalledWith("SectionVisibilityScreen", { initialScreen: screen });
});

test("navigation verilmese de düğmeye basmak çökmez", () => {
  render({ screen: "tv" });
  expect(() => act(() => renderer.root.findByProps({ testID: "sections-hidden-action" }).props.onPress())).not.toThrow();
});

test("düğme erişilebilir bir 'button'", () => {
  render({ navigation: { navigate: jest.fn() }, screen: "tv" });
  expect(renderer.root.findByProps({ testID: "sections-hidden-action" }).props.accessibilityRole).toBe("button");
});
