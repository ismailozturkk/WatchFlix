import React from "react";
import { act, create } from "react-test-renderer";

// Dizi detayındaki bölüm grafiği kartı: afiş + sezon/bölüm özeti + başlık, sezon başına
// bir önizleme sütunu (renk grafik ekranıyla aynı ölçekten), "+N", afiş üstünde en iyi
// sezon rozeti; dokununca onPress. Sezon yoksa hiç çizilmez. API isteği atmaz (veri
// yalnız `seasons` prop'u).

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  StyleSheet: { create: (s) => s, hairlineWidth: 1, absoluteFill: { position: "absolute" } },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("expo-image", () => ({ Image: "ExpoImage" }));
jest.mock("../components/PosterImage", () => ({ __esModule: true, default: "PosterImage" }));
jest.mock("../components/common/GlassPressable", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ style, children, ...rest }) =>
      React.createElement("Pressable", { ...rest, style: style({ pressed: false }) }, children),
  };
});
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));

const EpisodeGraphButton = require("../components/tv/EpisodeGraphButton").default;
const { getRatingColors } = require("../utils/ratingColors");

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
});

async function render(props) {
  await act(() => {
    renderer = create(<EpisodeGraphButton {...props} />);
  });
}
const texts = () =>
  renderer.root.findAllByType("Text").map((n) => [n.props.children].flat(Infinity).join(""));
const flat = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

const SEASONS = [
  { season_number: 0, episode_count: 2, vote_average: 9 },
  { season_number: 1, episode_count: 10, vote_average: 8.3 },
  { season_number: 2, episode_count: 8, vote_average: 9.1 },
];

test("afiş, özet, başlık, sezon sütunları, en iyi sezon rozeti ve dokunma", async () => {
  const onPress = jest.fn();
  await render({ seasons: SEASONS, posterPath: "/p.jpg", mediaId: 7, backdropUri: "https://x/b.jpg", onPress });
  const all = texts();
  expect(all).toContain("2 sezon · 18 bölüm");
  expect(all).toContain("Bölüm puanları grafiği");
  expect(all).toContain("Grafiği aç");
  expect(all).toEqual(expect.arrayContaining(["1", "2"]));
  expect(all).not.toContain("0");
  expect(all).toContain("S2 ★ 9.1");
  const poster = renderer.root.findByType("PosterImage");
  expect(poster.props).toMatchObject({ path: "/p.jpg", type: "tv", mediaId: 7 });
  expect(renderer.root.findByType("ExpoImage").props.source).toEqual({ uri: "https://x/b.jpg" });
  const fills = renderer.root
    .findAll((n) => n.type === "View" && flat(n.props.style).height === 6)
    .map((n) => flat(n.props.style).backgroundColor);
  expect(fills).toContain(getRatingColors(8.3).bg);
  expect(fills).toContain(getRatingColors(9.1).bg);
  renderer.root.findByType("Pressable").props.onPress();
  expect(onPress).toHaveBeenCalledTimes(1);
});

test("arka plan görseli yoksa yalnız örtü çizilir; tek sezonda rozet yok", async () => {
  await render({ seasons: [{ season_number: 1, episode_count: 8, vote_average: 6.4 }] });
  expect(renderer.root.findAllByType("ExpoImage")).toHaveLength(0);
  expect(texts().some((t) => t.includes("★"))).toBe(false);
  expect(texts()).toContain("1 sezon · 8 bölüm");
});

test("sezon yoksa kart çizilmez", async () => {
  await render({ seasons: [{ season_number: 0, episode_count: 3, vote_average: 7 }] });
  expect(renderer.toJSON()).toBeNull();
});
