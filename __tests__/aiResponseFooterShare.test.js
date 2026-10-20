import React from "react";
import { act, create } from "react-test-renderer";
import AIResponseFooter from "../components/ai/AIResponseFooter";
import { getAiCopy } from "../utils/aiCopy";
import { posterKey } from "../services/aiCineService";

// CineMatch cevabının altındaki eylem şeridi: "Sohbete gönder" düğmesinin NE
// ZAMAN çıktığı (gönderilecek içerik varken, yalnız ekran işleyici verdiyse) ve
// mevcut "Hepsini ekle" / "Paylaş" düğmelerinin cevap türüne göre davranışı.

jest.mock("react-native", () => {
  const passthrough = (name) => {
    const React = require("react");
    return ({ children, ...rest }) => React.createElement(name, rest, children);
  };
  return {
    View: "View",
    Text: "Text",
    TouchableOpacity: passthrough("TouchableOpacity"),
    StyleSheet: { create: (s) => s },
    Share: { share: jest.fn(() => Promise.resolve()) },
  };
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "me" } }) }));
jest.mock("../context/ListStatusContext", () => ({ useListStatusContext: () => ({ statusIndex: {} }) }));
jest.mock("../services/libraryActions", () => ({ addManyToMembership: jest.fn() }));
jest.mock("../utils/libraryErrorText", () => ({ libraryErrorMessage: () => "hata" }));

const mockTheme = {
  primary: "#111111",
  secondary: "#1b1b1b",
  border: "#333333",
  accent: "#3388ff",
  bold: "#224488",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
  colors: { green: "#29b864", red: "#e33", orange: "#ff6400" },
};
const copy = getAiCopy("tr");

const render = (element) => {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree.root;
};
const labels = (root) =>
  root
    // Sahte TouchableOpacity hem sarmalayıcı hem ana düğüm olarak eşleşir: yalnız ana düğüm.
    .findAll(
      (node) =>
        typeof node.type === "string" &&
        typeof node.props.onPress === "function" &&
        node.props.accessibilityLabel,
    )
    .map((node) => node.props.accessibilityLabel);
const textOf = (root) =>
  root
    .findAllByType("Text")
    .map((node) => [].concat(node.props.children).join(""))
    .join("|");

const found = (mediaType, title, id) => ({
  [posterKey(mediaType, title)]: { found: true, id, mediaType, title, posterPath: `/${id}.jpg`, year: "2016" },
});
const posterMap = { ...found("movie", "Arrival", 1), ...found("movie", "Dune", 2) };
const makeCtx = (map = posterMap) => ({ theme: mockTheme, copy, posterMap: map, language: "tr" });

const recommendations = {
  type: "recommendations",
  items: [
    { title: "Arrival", mediaType: "movie" },
    { title: "Dune", mediaType: "movie" },
  ],
};

const footer = (props) =>
  render(<AIResponseFooter response={recommendations} ctx={makeCtx()} showBulk {...props} />);

describe("AIResponseFooter · sohbete gönder", () => {
  test("offers add-all, share and send-to-chat for a found-title answer", () => {
    const root = footer({ onShare: () => {} });
    expect(labels(root)).toEqual(expect.arrayContaining([copy.actions.share, copy.actions.sendToChat]));
    expect(textOf(root)).toContain("Hepsini izleme listeme ekle (2)");
  });

  test("pressing send-to-chat calls the screen handler", () => {
    const onShare = jest.fn();
    const root = footer({ onShare });
    root
      .findAll((node) => node.props.accessibilityLabel === copy.actions.sendToChat)[0]
      .props.onPress();
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  test("no handler, no button — existing footers are unchanged", () => {
    const root = footer({});
    expect(labels(root)).toContain(copy.actions.share);
    expect(labels(root)).not.toContain(copy.actions.sendToChat);
  });

  test("a title-detail answer (no bulk add) still gets send-to-chat but no add/share", () => {
    const spotlight = { type: "title_spotlight", title: "Dune", mediaType: "movie", take: "Görsel şölen" };
    const root = render(
      <AIResponseFooter response={spotlight} ctx={makeCtx()} showBulk={false} onShare={() => {}} />,
    );
    expect(labels(root)).toEqual([copy.actions.sendToChat]);
    expect(textOf(root)).not.toContain("Hepsini izleme listeme ekle");
  });

  test("a text-only general answer can be sent but has nothing to add or share", () => {
    const general = { type: "general", content: "Merhaba!" };
    const root = render(
      <AIResponseFooter response={general} ctx={makeCtx({})} showBulk onShare={() => {}} />,
    );
    expect(labels(root)).toEqual([copy.actions.sendToChat]);
  });

  test("an empty answer shows no send button even with a handler", () => {
    const empty = { type: "recommendations", items: [] };
    const root = render(
      <AIResponseFooter response={empty} ctx={makeCtx({})} showBulk onShare={() => {}} />,
    );
    expect(labels(root)).toEqual([]);
  });
});
