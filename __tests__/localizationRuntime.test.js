import React from "react";
import { act, create } from "react-test-renderer";
import i18n from "../translations";
import { TestLanguageProvider } from "../context/LanguageContext";
import { StoryTabs } from "../components/storyShare/StoryTabs";
import { SUPPORTED_LANGUAGE_CODES } from "../utils/appLanguages";
import { WATCH_BADGE_BY_ID, evaluateWatchBadges, gruplaAileler, badgeAd, badgeAciklama } from "../components/badges/watchBadgeCatalog";
import { muhurleriHesapla, muhurBasligi } from "../components/badges/seasonSeals";
import { getImportCopy, importErrorText, withPickLabel } from "../components/import/importCopy";
import { ImportError } from "../services/import/importErrors";

jest.mock("../translations", () => ({ __esModule: true, default: require("i18next").createInstance() }));
jest.mock("react-native", () => ({ View: "View", Text: "Text", TouchableOpacity: "Button", StyleSheet: { create: (s) => s } }));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Icon");
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: { border: "#333333", accent: "#8888ff", text: { muted: "#aaaaaa" } } }) }));
jest.mock("../context/LanguageContext", () => {
  const React = require("react");
  const context = React.createContext();
  return { TestLanguageProvider: context.Provider, useLanguage: () => React.useContext(context) };
});

global.IS_REACT_ACT_ENVIRONMENT = true;

test("mounted memoized story tabs translate all labels after every language switch", async () => {
  await i18n.init({ lng: "tr", fallbackLng: "en", resources: Object.fromEntries(
    SUPPORTED_LANGUAGE_CODES.map((code) => [code, { translation: require(`../translations/${code}.json`) }]),
  ) });
  const original = console.error;
  const warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (!String(message).includes("react-test-renderer is deprecated")) original(message, ...args);
  });
  let renderer;
  // Preserve the exact child element; only a context update can refresh memoized tabs.
  const tabs = <StoryTabs activeTab="poster" onChangeTab={() => {}} />;
  try {
    for (const language of ["tr", "en", "es", "pt", "de", "tr"]) {
      await act(async () => {
        await i18n.changeLanguage(language);
        const tree = <TestLanguageProvider value={{ language }}>{tabs}</TestLanguageProvider>;
        if (renderer) renderer.update(tree);
        else renderer = create(tree);
      });
      expect(renderer.root.findAllByType("Text").map((node) => node.props.children)).toEqual(
        ["arka_plan", "profil_story_ogr_poster", "icerik", "stil"].map((key) => i18n.t(`autoI18n.${key}`)),
      );
    }
  } finally {
    act(() => renderer?.unmount());
    warn.mockRestore();
  }
});

test.each(SUPPORTED_LANGUAGE_CODES)("%s survives badge grouping and seasonal-card construction", (language) => {
  const cards = gruplaAileler(evaluateWatchBadges({}, []));
  const targets = cards.map((card) => card.sonrakiHedef).filter(Boolean);
  expect(targets.length).toBeGreaterThan(0);
  const desc = `desc${language[0].toUpperCase()}${language.slice(1)}`;
  for (const target of targets) {
    const source = WATCH_BADGE_BY_ID[target.id];
    expect(target[language]).toBe(source[language]);
    expect(target[desc]).toBe(source[desc]);
    expect(badgeAd(target, language)).toBe(source[language]);
    expect(badgeAciklama(target, language)).toBe(source[desc]);
  }
  const [seal] = muhurleriHesapla(["2026-10-01"], { simdi: Date.UTC(2026, 9, 22, 12) });
  expect(badgeAd(seal, language)).toBe(muhurBasligi(language, 2026, "sonbahar"));
  expect(seal[desc]).toContain("8");
  expect(badgeAciklama(seal, language)).toBe(seal[desc]);
});

test.each(SUPPORTED_LANGUAGE_CODES)("%s import errors and help placeholders use the selected language", (language) => {
  const copy = getImportCopy(language);
  expect(Object.keys(copy).sort()).toEqual(Object.keys(getImportCopy("en")).sort());
  expect(Object.keys(copy.errors).sort()).toEqual(Object.keys(getImportCopy("en").errors).sort());
  for (const [code, message] of Object.entries(copy.errors)) {
    expect(typeof message).toBe("string");
    expect(message.trim()).not.toBe("");
    expect(importErrorText(new ImportError(code), copy)).toBe(message);
  }
  expect(importErrorText(new Error("raw service error"), copy)).toBe(copy.unexpected);
  expect(withPickLabel("{{pick}} / {{pick}}", copy)).toBe(`${copy.pickBtn} / ${copy.pickBtn}`);
  expect(copy.run.counter(2, 5)).toContain("2 / 5");
});
