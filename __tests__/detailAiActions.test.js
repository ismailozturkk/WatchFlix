import React from "react";
import { act, create } from "react-test-renderer";
import i18n from "../translations";
import { buildDetailAiRequest, detailAiKeywords, DETAIL_AI_ACTION } from "../utils/detailAiRequest";
import { resolveAiMediaContext } from "../utils/aiMessageMediaContext";
import DetailAiActionSheet from "../components/detail/DetailAiActionSheet";

jest.mock("../translations", () => ({ __esModule: true, default: require("i18next").createInstance() }));
jest.mock("react-native", () => ({
  StyleSheet: { create: (styles) => styles },
  Text: "Text",
  View: "View",
}));
jest.mock("@expo/vector-icons/Ionicons", () => "Icon");
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: {
    primary: "#111", secondary: "#222", border: "#333", accent: "#8af",
    text: { primary: "#fff", muted: "#aaa" },
  } }),
}));
jest.mock("../components/common/BottomSheetModal", () => "BottomSheetModal");
jest.mock("../components/common/GlassCloseButton", () => "GlassCloseButton");
jest.mock("../components/common/GlassTouchable", () => "GlassTouchable");

global.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(async () => {
  await i18n.init({
    lng: "tr",
    fallbackLng: "tr",
    resources: Object.fromEntries(
      ["tr", "en", "es", "pt", "de"].map((code) => [code, { translation: require(`../translations/${code}.json`) }]),
    ),
  });
});

test("film and show actions send distinct localized prompts with the correct title", async () => {
  for (const language of ["tr", "en", "es", "pt", "de"]) {
    await i18n.changeLanguage(language);
    for (const [type, title, date, prefix] of [
      ["movie", "Arrival", "2016-11-11", "film"],
      ["tv", "Dark", "2017-12-01", "dizi"],
    ]) {
      const namedTitle = `${title} (${date.slice(0, 4)})`;
      const info = buildDetailAiRequest(type, title, date, DETAIL_AI_ACTION.INFO);
      const similar = buildDetailAiRequest(type, title, date, DETAIL_AI_ACTION.SIMILAR);
      expect(info.prompt).toBe(i18n.t(`autoI18n.${prefix}_ai_prompt`, { title: namedTitle }));
      expect(similar.prompt).toBe(i18n.t(`autoI18n.${prefix}_ai_similar_prompt`, { title: namedTitle }));
      expect(info.display).toBe(i18n.t(`autoI18n.${prefix}_ai_display`));
      expect(similar.display).toBe(i18n.t(`autoI18n.${prefix}_ai_similar_display`));
      expect(similar.prompt).not.toBe(info.prompt);
      expect(similar.prompt).toContain(namedTitle);
      expect(similar.prompt).not.toContain("{{title}}");
    }
  }
  expect(buildDetailAiRequest("movie", "", "", DETAIL_AI_ACTION.SIMILAR)).toEqual({ prompt: "", display: "" });
});

test("a recommendation card supplies context without forcing a title spotlight", () => {
  const media = { title: "Arrival", mediaType: "movie", id: 329865 };
  const info = { role: "user", attachment: media };
  const similar = { role: "user", attachment: { ...media, referenceOnly: true } };
  expect(resolveAiMediaContext([info], info)).toEqual({ targetMedia: media, focusMedia: null, similarityRequest: false });
  expect(resolveAiMediaContext([similar], similar)).toEqual({ targetMedia: null, focusMedia: similar.attachment, similarityRequest: true });
  expect(resolveAiMediaContext([similar, { role: "user", text: "And another?" }], { role: "user" }))
    .toEqual({ targetMedia: null, focusMedia: similar.attachment, similarityRequest: false });
});

test("film and show TMDB keyword payloads preserve story-specific terms", () => {
  expect(detailAiKeywords({ keywords: { keywords: [{ name: "bank robbery" }, { name: "heist" }] } }))
    .toEqual(["bank robbery", "heist"]);
  expect(detailAiKeywords({ keywords: { results: [{ name: "time travel" }, { name: "missing child" }] } }))
    .toEqual(["time travel", "missing child"]);
  expect(detailAiKeywords({ keywords: null })).toEqual([]);
});

test("the two options open AI only after the action sheet is dismissed", () => {
  const onClose = jest.fn();
  const onSelect = jest.fn();
  let tree;
  act(() => {
    tree = create(<DetailAiActionSheet visible onClose={onClose} onSelect={onSelect} />);
  });
  const options = tree.root.findAllByType("GlassTouchable");
  expect(options).toHaveLength(2);
  expect(options.map((item) => item.props.accessibilityLabel)).toEqual([
    i18n.t("autoI18n.bilgi_al"),
    i18n.t("autoI18n.buna_benzer_oneri_ver"),
  ]);
  act(() => options[1].props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSelect).not.toHaveBeenCalled();
  act(() => tree.root.findByType("BottomSheetModal").props.onDismissed());
  expect(onSelect).toHaveBeenCalledWith(DETAIL_AI_ACTION.SIMILAR);
  act(() => tree.unmount());
});
