// __tests__/olderGameScreen.test.js
//
// "Önce hangisi?" oyununun BAĞLANTISI: durum makinesi (hooks/useOlderGame.js) + ekran + Eğlence şeridi, GERÇEK
// depo (bellek-içi MMKV) ve GERÇEK çekirdekle; havuz kaynağı (TMDB) ve görsel parçalar taklit.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ActivityIndicator: "Spinner",
  PixelRatio: { get: () => 2 },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
const mockHost = (name) => ({ __esModule: true, default: ({ children, ...props }) => require("react").createElement(name, props, children) });
jest.mock("../components/AppIcon", () => mockHost("Icon"));
jest.mock("../components/common/GlassPressable", () => mockHost("GlassPressable"));
jest.mock("../components/game/ui", () => {
  const React = require("react");
  return { PressableScale: ({ children, ...props }) => React.createElement("Scale", props, children) };
});
jest.mock("../screens/game/GameScreenShell", () => {
  const React = require("react");
  return {
    GameScreenShell: ({ title, headerRight, children }) => React.createElement("Shell", { title }, headerRight, children),
    gameSharedStyles: { primaryButton: {}, primaryButtonText: {} },
  };
});

const mockTrack = jest.fn();
jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: { OLDER_GAME_STARTED: "older_game_started", OLDER_GAME_FINISHED: "older_game_finished" },
  trackEvent: (...args) => mockTrack(...args),
}));

let mockLang = "tr";
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", between: "#222222", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
let mockUser = { uid: "u1" };
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
let mockApiKey = "key";
jest.mock("../context/AppSettingsContext", () => ({ useApiSettings: () => ({ API_KEY: mockApiKey }) }));

let mockPools;
const mockFetchPool = jest.fn((apiKey, language, source) => Promise.resolve(mockPools[source] || []));
jest.mock("../services/sceneGameService", () => ({ fetchTitlePool: (...args) => mockFetchPool(...args) }));
// Liderlik yazımı (Firebase) ve profil kimliği taklit: oyun sonunda rekorun tabloya gönderildiği görülür.
const mockSaveBoard = jest.fn(() => Promise.resolve(true));
jest.mock("../services/gameLeaderboards", () => ({ saveQuickBoardEntry: (...args) => mockSaveBoard(...args) }));
jest.mock("../hooks/useGameIdentity", () => ({ __esModule: true, default: () => ({ displayName: "Ben", avatarIndex: 3, photoURL: null }) }));


const fs = require("fs");
const path = require("path");
const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const OlderGameScreen = require("../screens/game/OlderGameScreen").default;
const { REVEAL_MS } = require("../hooks/useOlderGame");
const { OLDER_COPY } = require("../utils/olderGameCopy");
const { OLDER_LIVES } = require("../utils/olderGame");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let warn;
let randomSpy;
const YEARS = {}; // başlık → yıl

const item = (id, year, type = "movie") => {
  const title = `Yapım ${id}`;
  YEARS[title] = year;
  return { mediaKey: `${type}_${id}`, id, type, year: String(year), posterPath: `/p${id}.jpg`, title };
};
const buildPools = () => {
  mockPools = {
    top_rated_movie: Array.from({ length: 14 }, (_, i) => item(100 + i, 1940 + i * 3)),
    popular_movie: Array.from({ length: 14 }, (_, i) => item(200 + i, 2005 + i)),
    popular_tv: Array.from({ length: 10 }, (_, i) => item(300 + i, 2010 + i, "tv")),
  };
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-21T12:00:00"));
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  mockTrack.mockClear();
  mockFetchPool.mockClear();
  mockLang = "tr";
  mockUser = { uid: "u1" };
  mockApiKey = "key";
  buildPools();
  // Tekrar edilebilir "rastgele": her koşuda aynı çiftler.
  let seed = 12345;
  randomSpy = jest.spyOn(Math, "random").mockImplementation(() => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  });
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  randomSpy.mockRestore();
  warn.mockRestore();
  jest.useRealTimers();
});

const copy = OLDER_COPY.tr;
const mount = async (props = {}) => {
  await act(async () => {
    renderer = create(<OlderGameScreen navigation={{ goBack: jest.fn() }} route={{ params: { source: "hub" } }} {...props} />);
  });
};
const posters = () => renderer.root.findAllByType("Scale").filter((n) => /bunu seç/.test(n.props.accessibilityLabel || ""));
const titleOf = (node) => node.props.accessibilityLabel.replace(", bunu seç", "");
const olderIndex = () => {
  const [a, b] = posters().map((n) => YEARS[titleOf(n)]);
  return a < b ? 0 : 1;
};
const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
const has = (value) => texts().includes(value);
const pick = (index) => act(() => posters()[index].props.onPress());
const wait = (ms) => act(async () => { jest.advanceTimersByTime(ms); });
const stored = () => get(Keys.olderGame, { uid: "u1" });
const answerRight = async () => { pick(olderIndex()); await wait(REVEAL_MS); };
const answerWrong = async () => { pick(1 - olderIndex()); await wait(REVEAL_MS); };

describe("açılış", () => {
  test("havuz kurulana dek 'hazırlanıyor'; sonra iki afiş ve soru", async () => {
    await mount();
    expect(has(copy.prompt)).toBe(true);
    expect(posters()).toHaveLength(2);
    expect(mockFetchPool).toHaveBeenCalledTimes(3); // üç kaynak
    expect(mockTrack).toHaveBeenCalledWith("older_game_started", { source: "hub" });
  });

  test("üç can çizilir; başlangıçta skor 0", async () => {
    await mount();
    const hearts = renderer.root.findAllByType("Icon").filter((n) => /^heart/.test(n.props.name));
    expect(hearts).toHaveLength(OLDER_LIVES);
    expect(hearts.every((n) => n.props.name === "heart")).toBe(true);
  });

  test("anahtar yoksa ya da havuz çok küçükse hata durumu; 'tekrar dene' yeniden dener", async () => {
    mockPools = { top_rated_movie: [item(1, 2000)], popular_movie: [], popular_tv: [] };
    await mount();
    expect(has(copy.errorTitle)).toBe(true);
    expect(posters()).toHaveLength(0);
    buildPools();
    const retry = renderer.root.findAllByType("GlassPressable").find((n) => !n.props.disabled);
    await act(async () => { retry.props.onPress(); });
    expect(has(copy.prompt)).toBe(true);
  });

  test("API anahtarı yoksa hata durumu, ağ isteği yok", async () => {
    mockApiKey = "";
    await mount();
    expect(has(copy.errorTitle)).toBe(true);
    expect(mockFetchPool).not.toHaveBeenCalled();
  });

  test("bir kaynak çökse de diğerleri yeter", async () => {
    mockFetchPool.mockImplementationOnce(() => Promise.reject(new Error("ağ")));
    await mount();
    expect(has(copy.prompt)).toBe(true);
  });
});

describe("oynanış", () => {
  test("doğru cevap: yıllar görünür, skor artar, can düşmez; süre dolunca yeni çift", async () => {
    await mount();
    const before = posters().map(titleOf);
    pick(olderIndex());
    expect(has(copy.correct)).toBe(true);
    const yearTexts = texts().filter((t) => /^\d{4}$/.test(t));
    expect(yearTexts).toHaveLength(2); // iki afişin yılı
    expect(renderer.root.findAllByType("Icon").filter((n) => n.props.name === "heart")).toHaveLength(OLDER_LIVES);
    // Cevaplandıktan sonra afişler kilitlenir (çift sayım olmasın).
    expect(posters().every((n) => n.props.disabled)).toBe(true);
    await wait(REVEAL_MS);
    expect(has(copy.prompt)).toBe(true);
    expect(posters().map(titleOf)).not.toEqual(before);
    expect(texts()).toContain("1"); // skor 1
  });

  test("yanlış cevap: bir can gider, 'Yanlış' görünür", async () => {
    await mount();
    pick(1 - olderIndex());
    expect(has(copy.wrong)).toBe(true);
    expect(renderer.root.findAllByType("Icon").filter((n) => n.props.name === "heart")).toHaveLength(OLDER_LIVES - 1);
  });

  test("bekleme sırasında 'Doğru!' şeridine dokunmak hemen ilerletir", async () => {
    await mount();
    pick(olderIndex());
    const strip = renderer.root.findAllByType("GlassPressable").find((n) => n.props.onPress && n.findAllByType("Text").some((t) => [].concat(t.props.children).join("") === copy.correct));
    await act(async () => { strip.props.onPress(); });
    expect(posters().every((n) => !n.props.disabled)).toBe(true);
  });

  test("üç yanlış: oyun biter, kayıt yazılır ve ölçülür", async () => {
    await mount();
    await answerRight();
    await answerRight();
    await answerWrong();
    await answerWrong();
    expect(has(copy.endTitle.toUpperCase())).toBe(false); // henüz bitmedi (1 can var)
    await answerWrong();
    expect(has(copy.endTitle.toUpperCase())).toBe(true);
    expect(has(copy.endScore(2))).toBe(true);
    expect(has(copy.newBest)).toBe(true);
    expect(stored()).toEqual({ best: 2, plays: 1, correct: 2, answered: 5 });
    expect(mockTrack).toHaveBeenCalledWith("older_game_finished", { score: 2, answered: 5, new_best: true, best: 2 });
  });

  test("ikinci koşu daha düşükse rekor kalır; 'tekrar oyna' yeni koşu başlatır", async () => {
    await mount();
    await answerRight();
    await answerRight();
    await answerWrong();
    await answerWrong();
    await answerWrong();
    expect(stored().best).toBe(2);

    const again = renderer.root.findAllByType("Scale").find((n) => n.props.accessibilityLabel === copy.playAgain);
    await act(async () => { again.props.onPress(); });
    expect(has(copy.prompt)).toBe(true);
    await answerRight();
    await answerWrong();
    await answerWrong();
    await answerWrong();
    expect(has(copy.endTitle.toUpperCase())).toBe(true);
    expect(has(copy.newBest)).toBe(false);
    expect(has(copy.bestIs(2))).toBe(true);
    expect(stored()).toEqual({ best: 2, plays: 2, correct: 3, answered: 9 });
    expect(mockTrack).toHaveBeenLastCalledWith("older_game_finished", { score: 1, answered: 4, new_best: false, best: 2 });
  });

  test("0 puanlı koşu rekor sayılmaz ama oynanan oyun kaydedilir", async () => {
    await mount();
    await answerWrong();
    await answerWrong();
    await answerWrong();
    expect(has(copy.newBest)).toBe(false);
    expect(stored()).toEqual({ best: 0, plays: 1, correct: 0, answered: 3 });
  });

  test("girişsiz (uid yok) oynanır ama hiçbir şey yazılmaz", async () => {
    mockUser = null;
    await mount();
    await answerWrong();
    await answerWrong();
    await answerWrong();
    expect(has(copy.endTitle.toUpperCase())).toBe(true);
    expect(get(Keys.olderGame, { uid: "u1" })).toBeNull();
  });

  test("ekrandan çıkınca bekleyen zamanlayıcı sızmaz", async () => {
    await mount();
    pick(olderIndex());
    act(() => renderer.unmount());
    renderer = null;
    expect(() => jest.advanceTimersByTime(REVEAL_MS * 2)).not.toThrow();
  });

  test("beş dilde metin çizilir", async () => {
    for (const lang of ["tr", "en", "es", "pt", "de"]) {
      mockLang = lang;
      await mount();
      expect(has(OLDER_COPY[lang].prompt)).toBe(true);
      expect(texts().some((t) => /undefined|NaN/.test(t))).toBe(false);
      act(() => renderer.unmount());
      renderer = null;
    }
  });
});

describe("kaynak bekçileri", () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

  test("metin tablosundaki her anahtar kullanılıyor", () => {
    // Ortak metinler components/game/QuickGameParts.js'te, kart metinleri QuickGamesGrid.js'te kullanılır.
    const used = [read("screens/game/OlderGameScreen.js"), read("components/game/QuickGameParts.js"), read("components/game/QuickGamesGrid.js")].join("\n");
    const unused = Object.keys(OLDER_COPY.tr).filter((key) => !new RegExp(`copy\\.${key}\\b`).test(used));
    expect(unused).toEqual([]);
  });

  test("rota ve Eğlence şeridi bağlı; oyun Sahne Tahmin'in skor hattına DOKUNMAZ", () => {
    expect(read("App.js")).toMatch(/name="OlderGameScreen"/);
    expect(read("components/profile/ProfileGamesModule.js")).toMatch(/navigate\("OlderGameScreen"/);
    const hook = read("hooks/useOlderGame.js");
    // Sahne Tahmin skor hattına dokunmaz, Firestore'a doğrudan yazmaz; tabloya tek yol saveQuickBoardEntry (27 Eki).
    expect(hook).not.toMatch(/saveGameScore|loadGameData|setDoc|updateDoc|firebase\/firestore/);
    expect(hook).toMatch(/saveQuickBoardEntry\(uid, "older"/);
    // Premium kapısı yok (bilinçli): kapı eklenirse bu test kararı hatırlatsın.
    expect(read("screens/game/OlderGameScreen.js")).not.toMatch(/usePremium/);
  });

  test("simge adları Ionicons sözlüğünde var", () => {
    const glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, "../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json"), "utf8"));
    const names = [...[read("screens/game/OlderGameScreen.js"), read("components/game/QuickGameParts.js")].join("\n").matchAll(/name=(?:\{[^}]*?)?"([a-z-]+)"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(5);
    names.forEach((name) => expect(glyphs[name]).toBeDefined());
  });
});
