// Sohbetteki fragman sayfası (TrailerModal) — alt sayfa kabuğu ve çıkış penceresi.
//
// 16 Eki: sayfa düz `Modal animationType="slide"` idi (blur yok, hareket diğer
// alt sayfalardan ayrı). Ortak BottomSheetModal'a geçti: blur yerinde solar, sayfa
// kayar. Bu test iki şeyi sabitler:
//   1. kabuk BottomSheetModal (ham Modal'a dönülürse blur ve hareket kaybolur),
//   2. çağıran `media`yı kapanışta null'a çekse bile sayfa ÇIKIŞ penceresi boyunca
//      son yapımı gösterir (aksi halde başlık ve liste animasyon sırasında boşalır).
import fs from "fs";
import path from "path";
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  StyleSheet: {
    create: (styles) => styles,
    absoluteFill: {},
    absoluteFillObject: {},
    hairlineWidth: 1,
  },
  Platform: { OS: "ios" },
  UIManager: {},
  LayoutAnimation: { configureNext: () => {}, Presets: { easeInEaseOut: {} } },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Ionicons" }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }),
}));
// Modal yok: kabuk çocuğunu doğrudan çizer.
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) =>
    visible ? require("react").createElement("BottomSheetModal", { visible }, children) : null,
}));
jest.mock("../components/common/GlassCloseButton", () => ({
  __esModule: true,
  default: "GlassCloseButton",
}));
jest.mock("../components/video/TrailerSection", () => ({
  __esModule: true,
  default: "TrailerSection",
}));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      secondary: "#222",
      between: "#333",
      border: "#444",
      accent: "#6C63FF",
      text: { primary: "#fff", secondary: "#ccc", muted: "#888" },
    },
  }),
}));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));

const TrailerModal = require("../components/video/TrailerModal").default;

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const getTmdbUrl = (p) => `https://img/${p}`;
const SHOW = {
  media_type: "tv",
  id: 1396,
  name: "Breaking Bad",
  first_air_date: "2008-01-20",
  vote_average: 8.9,
  poster_path: "/bb.jpg",
  original_language: "en",
};
const FILM = {
  media_type: "movie",
  id: 603,
  title: "The Matrix",
  release_date: "1999-03-30",
  vote_average: 0,
  original_language: "en",
};

const flat = (children) => [].concat(children).join("");
const texts = (tree) => tree.root.findAllByType("Text").map((n) => flat(n.props.children));
const section = (tree) => tree.root.findAllByType("TrailerSection")[0];

async function render(props) {
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(TrailerModal, { apiKey: "key", getTmdbUrl, onClose: () => {}, ...props }),
    );
  });
  return tree;
}
const update = (tree, props) =>
  act(async () => {
    tree.update(
      React.createElement(TrailerModal, { apiKey: "key", getTmdbUrl, onClose: () => {}, ...props }),
    );
  });

describe("TrailerModal içeriği", () => {
  test("yapımın adı, türü, yılı ve puanı başlıkta; liste sayfa yerleşiminde", async () => {
    const tree = await render({ visible: true, media: SHOW });
    const all = texts(tree);
    expect(all).toContain("Breaking Bad");
    expect(all).toContain("Dizi");
    expect(all).toContain("2008");
    expect(all).toContain("8.9");

    const props = section(tree).props;
    expect(props.variant).toBe("sheet");
    expect(props.mediaType).toBe("tv");
    expect(props.id).toBe(1396);
    expect(props.originalLanguage).toBe("en");
    expect(props.apiKey).toBe("key");
  });

  test("afiş getTmdbUrl'den gelir; puanı olmayan yapımda yıldız satırı çıkmaz", async () => {
    const withPoster = await render({ visible: true, media: SHOW });
    expect(withPoster.root.findAllByType("Image")[0].props.source.uri).toBe("https://img//bb.jpg");

    const noRating = await render({ visible: true, media: FILM });
    expect(texts(noRating)).toContain("The Matrix");
    expect(texts(noRating)).toContain("Film");
    expect(texts(noRating)).not.toContain("0.0");
    expect(noRating.root.findAllByType("Image")).toHaveLength(0);
  });

  test("ÇIKIŞ PENCERESİ: media null'a çekilince son yapım gösterilmeye devam eder", async () => {
    const tree = await render({ visible: true, media: SHOW });
    // ChatScreen kapanışta `setTrailerMedia(null)` yapar; sayfa ≈260 ms daha çizilir.
    await update(tree, { visible: true, media: null });
    expect(texts(tree)).toContain("Breaking Bad");
    expect(section(tree).props.id).toBe(1396);
  });

  test("başka yapım açılınca başlık ve liste yeni yapıma geçer", async () => {
    const tree = await render({ visible: true, media: SHOW });
    await update(tree, { visible: false, media: null });
    await update(tree, { visible: true, media: FILM });
    expect(texts(tree)).toContain("The Matrix");
    expect(texts(tree)).not.toContain("Breaking Bad");
    expect(section(tree).props.id).toBe(603);
  });

  test("kapalıyken (visible=false) hiçbir şey çizilmez", async () => {
    const tree = await render({ visible: false, media: null });
    expect(tree.toJSON()).toBeNull();
  });
});

describe("fragman alt sayfaları ortak kabuğu kullanıyor", () => {
  test("TrailerModal BottomSheetModal'dır, ham Modal değil", () => {
    const src = read("components/video/TrailerModal.js");
    expect(src).toMatch(/import BottomSheetModal from/);
    expect(src).toMatch(/<BottomSheetModal[\s>]/);
    expect(src).not.toMatch(/<Modal[\s>]/);
    expect(src).not.toMatch(/animationType=/);
  });

  test("dil sayfası da BottomSheetModal (blur + aynı hareket)", () => {
    const src = read("components/video/TrailerSection.js");
    const languageSheet = src.slice(
      src.indexOf("function LanguageSheet"),
      src.indexOf("/* ───────────────────────── Ana bölüm"),
    );
    expect(languageSheet).toMatch(/<BottomSheetModal[\s>]/);
    expect(languageSheet).not.toMatch(/<Modal[\s>]/);
  });
});
