import React from "react";
import { act, create } from "react-test-renderer";

// Bölüm grafiği ekranının iki düzeni (9 Kas):
//  - Dikey: [sol ray SÜTUN (geri, paylaş, dikey boyut seçici) | yanında SABİT
//    yükseklikli bilgi kartı (rayla aynı boy, 152)] → altta ızgara.
//  - Yatay (genişlik > yükseklik): sol ray SÜTUN (geri, paylaş, dikey boyut seçici) →
//    yanında ekran boyu bilgi kartı → sağda ızgara.
// Bölüme dokununca kart bölüm bilgisine geçer (tarih rozet satırında), ✕ ile döner.

let mockWindow = { width: 412, height: 915 };

jest.mock("react-native", () => {
  const React = require("react");
  class Value {
    constructor(v) { this.v = v; }
    setValue(v) { this.v = v; }
    stopAnimation() {}
    interpolate() { return this; }
  }
  const anim = { start: (cb) => cb && cb({ finished: true }), stop() {} };
  return {
    View: "View",
    Text: "Text",
    Image: "Image",
    StyleSheet: { create: (s) => s, hairlineWidth: 1, absoluteFill: { position: "absolute" } },
    Animated: {
      View: "AnimatedView",
      Value,
      timing: () => anim,
      loop: () => anim,
      sequence: () => anim,
    },
    useWindowDimensions: () => mockWindow,
    __React: React,
  };
});
jest.mock("../utils/afterInteractions", () => ({ runAfterInteractions: (fn) => { fn(); return { cancel() {} }; } }));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@components/common/ScreenSafeAreaView", () => "SafeAreaView");
jest.mock("../components/BackButton", () => "BackButton");
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("../components/ScreenDecor", () => "ScreenDecor");
jest.mock("../components/tv/TvGraphGrid", () => "TvGraphGrid");
jest.mock("../components/tv/TvGraphShareSheet", () => "TvGraphShareSheet");
jest.mock("../components/chat/ShareToChatSheet", () => "ShareToChatSheet");
jest.mock("../components/common/GlassIconButton", () => "GlassIconButton");
jest.mock("../components/common/GlassTouchable", () => "GlassTouchable");
jest.mock("../components/common/GlassPressable", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ style, children, glass, ...rest }) =>
      React.createElement(
        "Pressable",
        { ...rest, style: typeof style === "function" ? style({ pressed: false }) : style },
        children,
      ),
  };
});
jest.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({
    language: "tr",
    t: {
      tvGraphGrid: { standard: "Standart", compact: "Kompakt", heatmap: "Isı haritası" },
      season: "Sezon",
      episode: "Bölüm",
      minutes: "dk",
      detail: "Detay",
      mistake: "Hata",
      tryAgain: "Tekrar dene",
    },
  }),
}));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      primary: "#000",
      secondary: "#111",
      between: "#222",
      border: "#333",
      accent: "#f80",
      text: { primary: "#fff", secondary: "#aaa" },
    },
  }),
}));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { displayName: "Test Kişi" } }) }));
jest.mock("../context/AppSettingsContext", () => ({
  useApiSettings: () => ({ API_KEY: "k" }),
  useImageQualitySettings: () => ({ getTmdbUrl: (p) => `tmdb:${p}` }),
}));
jest.mock("../context/PosterChoicesContext", () => ({ usePosterResolver: () => (x) => x }));
jest.mock("../hooks/usePosterUri", () => () => (type, id, path) => `poster:${path}`);
jest.mock("../hooks/useBackdropUri", () => () => (type, id, path) => `backdrop:${path}`);
jest.mock("../utils/i18nText", () => ({ i18nText: (key, fallback) => fallback }));
jest.mock("../utils/tvGraphShare", () => ({ buildTvGraphShare: () => ({ poster_path: "/p.jpg" }) }));
jest.mock("../services/externalRatings", () => ({
  fetchTitleRatings: async () => null,
  fetchSeasonRatings: async () => null,
}));
jest.mock("../utils/externalRatings", () => ({
  mergeEpisodeRatings: (episodes) => episodes,
  pickMainRating: () => ({ rating: 8.9, votes: "1.2M" }),
}));
jest.mock("axios", () => {
  const show = {
    id: 1396,
    name: "Breaking Bad",
    poster_path: "/p.jpg",
    backdrop_path: "/b.jpg",
    first_air_date: "2008-01-20",
    last_air_date: "2013-09-29",
    status: "Ended",
    external_ids: { imdb_id: "tt0903747" },
    seasons: [{ season_number: 1, episode_count: 2 }],
  };
  const season = {
    season_number: 1,
    episodes: [
      { episode_number: 1, name: "Pilot", air_date: "2008-01-20", runtime: 58, vote_average: 9, overview: "Walter.", still_path: "/s1.jpg" },
      { episode_number: 2, name: "Cat's in the Bag", air_date: "2008-01-27", runtime: 48, vote_average: 8.6, overview: "", still_path: null },
    ],
  };
  return {
    get: async (url) => ({ data: url.includes("/season/") ? season : show }),
    isCancel: () => false,
  };
});

const TvGraphDetailScreen = require("../screens/tv/TvGraphDetailScreen").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let consoleError;
beforeEach(() => {
  const original = console.error;
  consoleError = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
  renderer = null;
  consoleError.mockRestore();
  mockWindow = { width: 412, height: 915 };
});

const navigation = { navigate: jest.fn() };
async function render() {
  await act(async () => {
    renderer = create(<TvGraphDetailScreen route={{ params: { id: 1396 } }} navigation={navigation} />);
  });
  // Veri çekme zinciri (TMDB + puanlar) çözülsün.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
const flat = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const texts = () =>
  renderer.root.findAllByType("Text").map((n) => [n.props.children].flat(Infinity).join(""));
const panel = () =>
  renderer.root.find((n) => n.type === "AnimatedView");
const isAncestor = (ancestor, node) => {
  for (let p = node.parent; p; p = p.parent) if (p === ancestor) return true;
  return false;
};

test("dikey: kartın solunda geri + paylaş + boyut seçici sütunu, kart 152 sabit", async () => {
  await render();
  expect(texts()).toContain("Breaking Bad");
  const card = flat(panel().props.style);
  expect(card.height).toBe(152);
  expect(card.flexDirection).toBe("row");
  // Afiş kartın iç yüksekliğini 2:3 doldurur.
  const poster = renderer.root.findAllByType("Image").find((n) => n.props.source.uri === "poster:/p.jpg");
  expect(flat(poster.props.style)).toMatchObject({ width: 88, height: 132 });
  // Ray: geri, paylaş ve dikey (kompakt) boyut seçici tek sütunda.
  const back = renderer.root.findByType("BackButton");
  expect(back.props.size).toBe(30);
  const rail = back.parent;
  expect(rail.findAllByType("GlassIconButton")).toHaveLength(1);
  expect(rail.findByType("GlassIconButton").props.size).toBe(30);
  const switchView = rail.find((n) => n.type === "View" && flat(n.props.style).borderRadius === 13);
  expect(flat(switchView.props.style)).toMatchObject({ flexDirection: "column", padding: 2 });
  // Ray yüksekliği = kart yüksekliği: 30 + 30 + (3×24 + 2×2 + 2×2 + 2) + 2×5.
  expect(30 + 30 + (3 * 24 + 4 + 4 + 2) + 2 * 5).toBe(card.height);
  // Kart rayın kardeşi (aynı satır); ızgara bu satırın dışında, altta.
  const row = rail.parent;
  expect(flat(row.props.style).flexDirection).toBe("row");
  expect(isAncestor(row, panel())).toBe(true);
  expect(isAncestor(rail, panel())).toBe(false);
  expect(isAncestor(row, renderer.root.findByType("TvGraphGrid"))).toBe(false);
  expect(renderer.root.findAll((n) => n.type === "View" && flat(n.props.style).width === 260)).toHaveLength(0);
});

test("dikey: bölüme dokununca tarih rozet satırında, ✕ ile dizi bilgisine döner", async () => {
  await render();
  const grid = renderer.root.findByType("TvGraphGrid");
  await act(async () => grid.props.onPress(1, 0));
  const all = texts();
  expect(all).toContain("S1 · E1");
  expect(all).toContain("58 dk");
  expect(all).toContain("2008-01-20");
  expect(all).toContain("Pilot");
  expect(flat(panel().props.style).height).toBe(152);
  const still = renderer.root.findAllByType("Image").find((n) => n.props.source.uri === "tmdb:/s1.jpg" && flat(n.props.style).height === 54);
  expect(still).toBeTruthy();
  const overview = renderer.root.findAllByType("Text").find((n) => n.props.children === "Walter.");
  expect(overview.props.numberOfLines).toBe(4);
  // Detay → EpisodeDetails
  const detail = renderer.root.find((n) => n.type === "Pressable" && texts && [n.props.children].flat().some((c) => c?.props?.children?.[0] === "Detay"));
  await act(async () => detail.props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith("EpisodeDetails", expect.objectContaining({ showId: 1396, seasonNumber: 1, episodeNumber: 1 }));
  // Kapat
  const close = renderer.root.find((n) => n.type === "Pressable" && n.props.accessibilityLabel === "Kapat");
  await act(async () => close.props.onPress());
  expect(texts()).not.toContain("Pilot");
  expect(texts()).toContain("Breaking Bad");
});

test("yatay: sol rayda geri + paylaş + dikey boyut seçici, yanında bilgi kartı, sağda ızgara", async () => {
  mockWindow = { width: 915, height: 412 };
  await render();
  const rail = renderer.root.find((n) => n.type === "View" && flat(n.props.style).paddingHorizontal === 10 && flat(n.props.style).gap === 10);
  expect(rail.findAllByType("BackButton")).toHaveLength(1);
  expect(rail.findAllByType("GlassIconButton")).toHaveLength(1);
  const switchView = rail.find((n) => n.type === "View" && flat(n.props.style).borderRadius === 13);
  expect(flat(switchView.props.style).flexDirection).toBe("column");
  // Bilgi kartı rayın kardeşi, 260 genişlikte ve ekran boyu (sabit yükseklik yok).
  const body = rail.parent;
  expect(flat(body.props.style).flexDirection).toBe("row");
  const card = body.find((n) => n.type === "View" && flat(n.props.style).width === 260);
  expect(isAncestor(rail, card)).toBe(false);
  const inner = flat(panel().props.style);
  expect(inner.flexDirection).toBe("column");
  expect(inner.height).toBeUndefined();
  // Izgara kartın değil gövdenin içinde, sağda.
  const grid = renderer.root.findByType("TvGraphGrid");
  expect(isAncestor(body, grid)).toBe(true);
  expect(isAncestor(card, grid)).toBe(false);
  // Üst çubuk yok: geri düğmesi yalnız rayda.
  expect(renderer.root.findAllByType("BackButton")).toHaveLength(1);

  // Bölüm seçimi yatayda geniş görsel + uzun özet.
  await act(async () => grid.props.onPress(1, 0));
  const still = renderer.root.findAllByType("Image").find((n) => n.props.source.uri === "tmdb:/s1.jpg" && flat(n.props.style).aspectRatio === 16 / 9);
  expect(still).toBeTruthy();
  const overview = renderer.root.findAllByType("Text").find((n) => n.props.children === "Walter.");
  expect(overview.props.numberOfLines).toBe(5);
});
