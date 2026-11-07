import React from "react";
import { act, create } from "react-test-renderer";
import SharedMediaMessage from "../components/chat/SharedMediaMessage";

jest.mock("react-native", () => {
  const React = require("react");
  const passthrough = (name) => ({ children, ...props }) => React.createElement(name, props, children);
  return {
    View: "View",
    Text: "Text",
    TouchableOpacity: passthrough("TouchableOpacity"),
    StyleSheet: {
      create: (styles) => styles,
      absoluteFillObject: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    },
    LayoutAnimation: { configureNext: () => {}, Presets: { easeInEaseOut: {} } },
    Platform: { OS: "ios" },
    UIManager: {},
  };
});
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      secondary: "#20242d",
      between: "#2b303b",
      border: "#3b4250",
      accent: "#6C63FF",
      text: { primary: "#fff", secondary: "#ccd1da", muted: "#9299a6" },
    },
  }),
}));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/AppSettingsContext", () => ({ useApiSettings: () => ({ API_KEY: "test" }) }));
jest.mock("../context/PosterChoicesContext", () => ({
  usePosterResolver: () => (_type, id, fallback) => (id === 12 ? "/chosen-poster.jpg" : fallback),
  useBackdropResolver: () => (_type, id, fallback) => (id === 12 ? "/chosen-backdrop.jpg" : fallback),
}));
let mockFacts = null;
jest.mock("../services/tmdbFacts", () => ({
  peekMediaFacts: () => mockFacts,
  fetchMediaFacts: () => new Promise(() => {}),
  fetchMediaOverview: () => new Promise(() => {}),
}));
jest.mock("../utils/i18nText", () => ({
  i18nText: (_key, fallback, vars) =>
    String(fallback).replace(/{{(\w+)}}/g, (whole, name) => (vars && name in vars ? String(vars[name]) : whole)),
}));

const flatStyle = (style) =>
  (Array.isArray(style) ? style.flat(Infinity) : [style])
    .filter(Boolean)
    .reduce((all, part) => ({ ...all, ...part }), {});

const renderCard = (media) => {
  let renderer;
  act(() => {
    renderer = create(
      <SharedMediaMessage
        item={{ text: media.title || media.name, media }}
        getTmdbUrl={(path, _kind, width) => `https://img.test/w${width}${path}`}
      />,
    );
  });
  return renderer.root;
};

test("movie and TV cards honor selected poster and backdrop choices", () => {
  const root = renderCard({
    id: 12,
    media_type: "movie",
    title: "Arrival",
    poster_path: "/arrival.jpg",
    release_date: "2016-11-11",
  });
  const images = root.findAllByType("Image");
  expect(images[0].props).toMatchObject({
    source: { uri: "https://img.test/w780/chosen-backdrop.jpg" },
    contentFit: "cover",
    blurRadius: 18,
  });
  // Bulanık fon kart sınırından taşar: blur'ün saydam kenarı kırpılır, kenarda boşluk görünmez.
  const bleed = flatStyle(images[0].props.style);
  expect(bleed.position).toBe("absolute");
  for (const side of ["top", "left", "right", "bottom"]) expect(bleed[side]).toBeLessThanOrEqual(-24);
  expect(images).toHaveLength(2); // bulanık fon + öndeki net poster
  expect(images[1].props.source).toEqual({ uri: "https://img.test/w500/chosen-poster.jpg" });
  expect(root.findByType("Gradient").props).toMatchObject({
    colors: ["rgba(5,7,12,0.82)", "rgba(5,7,12,0.58)", "rgba(5,7,12,0.76)"],
    locations: [0, 0.48, 1],
  });
  const views = root.findAllByType("View");
  const shell = flatStyle(views[0].props.style);
  expect(shell).toMatchObject({ overflow: "hidden", borderRadius: 20 });
  // Çerçeve kapta DEĞİL (fonu içeriden kırpar → gri halka); en üstte ayrı katman.
  expect(shell.borderWidth || 0).toBe(0);
  const edge = views[0].props.children.filter(Boolean).at(-1);
  expect(flatStyle(edge.props.style)).toMatchObject({ position: "absolute", borderRadius: 20, borderWidth: 1 });
  expect(edge.props.pointerEvents).toBe("none");
});

test("person cards do not turn the profile photo into a backdrop", () => {
  const root = renderCard({ id: 7, media_type: "person", name: "Amy Adams", profile_path: "/amy.jpg" });
  expect(root.findAllByType("Image")).toHaveLength(1);
  expect(root.findAllByType("Image")[0].props.blurRadius).toBeUndefined();
});

test("a movie without a backdrop keeps a plain dark background instead of enlarging its poster", () => {
  const root = renderCard({
    id: 13,
    media_type: "movie",
    title: "Moon",
    poster_path: "/moon.jpg",
  });
  const images = root.findAllByType("Image");
  expect(images).toHaveLength(1);
  expect(images[0].props.source).toEqual({ uri: "https://img.test/w500/moon.jpg" });
  expect(images[0].props.blurRadius).toBeUndefined();
  expect(root.findAllByType("Gradient")).toHaveLength(0);
});

const texts = (root) =>
  root.findAllByType("Text").map((node) => [].concat(node.props.children).join(""));

describe("side column", () => {
  afterEach(() => {
    mockFacts = null;
  });

  test("movie shows year, runtime and up to two genres in the viewer's language", () => {
    mockFacts = { title: "Geliş", minutes: 116, genres: ["Bilim Kurgu", "Dram", "Gizem"] };
    const root = renderCard({ id: 13, media_type: "movie", title: "Arrival", release_date: "2016-11-11" });
    const all = texts(root);
    expect(all).toContain("Geliş");
    expect(all).toContain("2016");
    expect(all).toContain("1 sa 56 dk");
    expect(all).toContain("Bilim Kurgu · Dram");
    expect(all.join("|")).not.toContain("Gizem");
  });

  test("TV shows the season count instead of a runtime", () => {
    mockFacts = { title: "Dark", seasonCount: 3, genres: ["Dram"] };
    const all = texts(renderCard({ id: 14, media_type: "tv", title: "Dark", first_air_date: "2017-12-01" }));
    expect(all).toContain("3 sezon");
    expect(all.join("|")).not.toContain(" sa ");
  });

  test("without facts the card keeps the year chip and a three-line title", () => {
    const root = renderCard({ id: 13, media_type: "movie", title: "Moon", release_date: "2009-06-12" });
    expect(texts(root)).toContain("2009");
    expect(root.findAllByType("Text").find((n) => n.props.children === "Moon").props.numberOfLines).toBe(3);
  });

  test("person cards get no runtime / genre line", () => {
    mockFacts = { minutes: 120, genres: ["Dram"] };
    const all = texts(renderCard({ id: 7, media_type: "person", name: "Amy Adams", profile_path: "/amy.jpg" }));
    expect(all.join("|")).not.toContain("Dram");
    expect(all.join("|")).not.toContain("2 sa");
  });
});

test("a message carrying only backdrop_url still gets the blurred background", () => {
  const root = renderCard({
    id: 13,
    media_type: "movie",
    title: "Moon",
    poster_path: "/moon.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/w780/moon-bg.jpg",
  });
  const images = root.findAllByType("Image");
  expect(images).toHaveLength(2);
  expect(images[0].props).toMatchObject({
    source: { uri: "https://image.tmdb.org/t/p/w780/moon-bg.jpg" },
    blurRadius: 18,
  });
});
