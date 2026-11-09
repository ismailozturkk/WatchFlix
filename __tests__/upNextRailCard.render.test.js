import React from "react";
import { act, create } from "react-test-renderer";

// Kütüphane "Devam Edenler" kartı (9 Kas, kompakt): üstte 2:1 bölüm karesi (yoksa
// bulanık afiş), alt tek satırda sıradaki bölüm + yuvarlak Tarih/İzledim düğmeleri. İzledim iki
// adımlı: göz → (3 sn) tik → işaretle.
// Dört durum: iskelet, sıradaki bölüm yok, yayınlandı, yayınlanmadı.

jest.mock("react-native", () => {
  class Value {
    constructor(v) { this.v = v; }
    setValue(v) { this.v = v; }
    interpolate() { return this; }
  }
  return {
    View: "View",
    Text: "Text",
    Pressable: "Pressable",
    TouchableOpacity: "TouchableOpacity",
    StyleSheet: { create: (s) => s, hairlineWidth: 1, absoluteFill: { position: "absolute" } },
    Animated: { View: "AnimatedView", Value, spring: () => ({ start: () => {} }) },
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("expo-image", () => ({ Image: "ExpoImage" }));
jest.mock("../components/PosterImage", () => ({ __esModule: true, default: "PosterImage" }));
jest.mock("../hooks/usePosterUri", () => ({
  __esModule: true,
  default: () => (type, id, path, size) => `poster:${size}:${path}`,
}));
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => false }));
jest.mock("../context/AppSettingsContext", () => ({
  useImageQualitySettings: () => ({ getTmdbUrl: (path, type, size) => `${type}:${size}:${path}` }),
}));

const UpNextRailCard = require("../components/tv/UpNextRailCard").default;
const { Animated } = require("react-native");

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

const THEME = {
  accent: "#3B82F6",
  secondary: "#222",
  border: "#444",
  shadow: "#000",
  text: { primary: "#fff", muted: "#888" },
};
const SHOW = { id: 7, name: "Dark", imagePath: "/p.jpg" };

async function render(props) {
  const base = {
    show: SHOW,
    theme: THEME,
    language: "tr",
    cardWidth: 320,
    scaleValue: new Animated.Value(1),
    onPressIn: jest.fn(),
    onPressOut: jest.fn(),
    onOpen: jest.fn(),
    onWatched: jest.fn(),
    onChooseDate: jest.fn(),
  };
  const all = { ...base, ...props };
  await act(() => {
    renderer = create(<UpNextRailCard {...all} />);
  });
  return all;
}
const texts = () =>
  renderer.root.findAllByType("Text").map((n) => [n.props.children].flat(Infinity).join(""));
const pressables = () => renderer.root.findAllByType("Pressable");
const flat = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

test("iskelet: dizi adı görünür, düğme yok", async () => {
  await render({ resolved: false });
  expect(texts()).toContain("Dark");
  expect(pressables()).toHaveLength(0);
  // Bölüm karesi yok → bulanık afiş zemini.
  const bg = renderer.root.findByType("ExpoImage");
  expect(bg.props.blurRadius).toBeGreaterThan(0);
  expect(bg.props.source.uri).toBe("poster:92:/p.jpg");
});

test("yayınlanmış bölüm: kare, rozet, İzledim ve tarih seç", async () => {
  const item = {
    id: "7:2:3",
    showName: "Dark",
    seasonNumber: 2,
    episodeNumber: 3,
    episodeName: "Geçmiş ve Gelecek",
    episodePosterPath: "/s.jpg",
    airDate: "2026-11-03",
    isAired: true,
  };
  const props = await render({ resolved: true, item });
  const all = texts();
  expect(all).toEqual(expect.arrayContaining(["Dark", "Geçmiş ve Gelecek", "S2 · B3", "S2 · B3 · 3 Kas"]));
  const still = renderer.root.findByType("ExpoImage");
  expect(still.props.source.uri).toBe("still:300:/s.jpg");
  expect(still.props.blurRadius).toBeUndefined();
  expect(all).not.toContain("0"); // ilerleme bilinmiyorsa sayı rozeti çizilmez

  // Kahraman alanı 2:1 (kompakt).
  const hero = renderer.root.find((n) => n.type === "View" && flat(n.props.style).height === 160);
  expect(hero).toBeTruthy();

  const stop = jest.fn();
  const watchBtn = () => pressables()[1];
  const watchIcon = () => watchBtn().findByType("Ionicons").props.name;
  const [date] = pressables();
  act(() => date.props.onPress({ stopPropagation: stop }));
  expect(props.onChooseDate).toHaveBeenCalledWith(item);

  // İki adımlı onay: göz → tik → işaretle.
  expect(watchIcon()).toBe("eye-outline");
  expect(watchBtn().props.accessibilityLabel).toBe("Watched");
  act(() => watchBtn().props.onPress({ stopPropagation: stop }));
  expect(props.onWatched).not.toHaveBeenCalled();
  expect(watchIcon()).toBe("checkmark");
  expect(watchBtn().props.accessibilityLabel).toBe("Confirm");
  act(() => watchBtn().props.onPress({ stopPropagation: stop }));
  expect(props.onWatched).toHaveBeenCalledWith(item);
  expect(props.onWatched).toHaveBeenCalledTimes(1);
  expect(watchIcon()).toBe("eye-outline");
  expect(stop).toHaveBeenCalledTimes(3);

  act(() => renderer.root.findByType("TouchableOpacity").props.onPress());
  expect(props.onOpen).toHaveBeenCalledWith(SHOW);
});

test("onay 3 sn içinde verilmezse göze döner", async () => {
  jest.useFakeTimers();
  try {
    const item = { id: "7:2:3", seasonNumber: 2, episodeNumber: 3, isAired: true };
    const props = await render({ resolved: true, item });
    const watchBtn = () => pressables()[1];
    const icon = () => watchBtn().findByType("Ionicons").props.name;
    act(() => watchBtn().props.onPress({}));
    expect(icon()).toBe("checkmark");
    act(() => jest.advanceTimersByTime(2900));
    expect(icon()).toBe("checkmark");
    act(() => jest.advanceTimersByTime(200));
    expect(icon()).toBe("eye-outline");
    // Süre dolduktan sonraki dokunuş yeniden yalnız kurar, işaretlemez.
    act(() => watchBtn().props.onPress({}));
    expect(props.onWatched).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test("bölüm değişince bekleyen onay sıfırlanır", async () => {
  const a = { id: "7:2:3", seasonNumber: 2, episodeNumber: 3, isAired: true };
  const props = await render({ resolved: true, item: a });
  const watchBtn = () => pressables()[1];
  act(() => watchBtn().props.onPress({}));
  expect(watchBtn().findByType("Ionicons").props.name).toBe("checkmark");
  const b = { ...a, id: "7:2:4", episodeNumber: 4 };
  await act(() => renderer.update(<UpNextRailCard {...props} resolved item={b} />));
  expect(watchBtn().findByType("Ionicons").props.name).toBe("eye-outline");
});

test("yayınlanmamış bölüm: tarih çipi, düğme yok", async () => {
  await render({
    resolved: true,
    item: { id: "7:2:4", seasonNumber: 2, episodeNumber: 4, isAired: false, airDate: "2026-12-01" },
  });
  const all = texts();
  expect(all).toContain("S2 · B4");
  expect(all.some((t) => /Ara/.test(t))).toBe(true);
  expect(pressables()).toHaveLength(0);
});

test("sıradaki bölüm yok: sezon bekleniyor", async () => {
  await render({ resolved: true, item: null });
  expect(texts()).toEqual(expect.arrayContaining(["No new episode", "Awaiting season"]));
  expect(pressables()).toHaveLength(0);
});
