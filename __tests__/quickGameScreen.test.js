// __tests__/quickGameScreen.test.js
//
// Hızlı oyunların BAĞLANTISI: durum makinesi (hooks/useQuickGame.js) + ekran (screens/game/QuickGameScreen.js) +
// Eğlence ızgarası (components/game/QuickGamesGrid.js), GERÇEK depo (bellek-içi MMKV) ve GERÇEK çekirdekle;
// havuz kaynağı (TMDB) ve görsel parçalar taklit. Seri-skorlu dört oyun aynı senaryodan geçer; zamanlı Bulanık Afiş
// (puan = kalan süre) kendi senaryosundan.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  ActivityIndicator: "Spinner",
  PixelRatio: { get: () => 2 },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
const mockHost = (name) => ({ __esModule: true, default: ({ children, ...props }) => require("react").createElement(name, props, children) });
jest.mock("../components/AppIcon", () => mockHost("Icon"));
jest.mock("../components/common/GlassPressable", () => mockHost("GlassPressable"));
jest.mock("../components/game/ui", () => {
  const React = require("react");
  return {
    PressableScale: ({ children, ...props }) => React.createElement("Scale", props, children),
    SectionHeader: ({ title }) => React.createElement("Text", { testID: "section-title" }, title),
  };
});
// Netleşen afiş ve sayaç çubuğu Animated kullanır; burada yalnız props'ları görünür (onReady = afiş yüklendi).
jest.mock("../components/game/BlurPoster", () => mockHost("BlurPoster"));
jest.mock("../components/game/GameTimerBar", () => mockHost("TimerBar"));
jest.mock("../screens/game/GameScreenShell", () => {
  const React = require("react");
  return {
    GameScreenShell: ({ title, subtitle, headerRight, children }) => React.createElement("Shell", { title, subtitle }, headerRight, children),
    gameSharedStyles: { primaryButton: {}, primaryButtonText: {} },
  };
});

const mockTrack = jest.fn();
jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: {
    QUICK_GAME_STARTED: "quick_game_started",
    QUICK_GAME_FINISHED: "quick_game_finished",
    OLDER_GAME_STARTED: "older_game_started",
    OLDER_GAME_FINISHED: "older_game_finished",
  },
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

// Liderlik yazımı (Firebase) ve profil kimliği taklit: oyun sonunda rekorun tabloya gönderildiği görülür.
const mockSaveBoard = jest.fn(() => Promise.resolve(true));
jest.mock("../services/gameLeaderboards", () => ({ saveQuickBoardEntry: (...args) => mockSaveBoard(...args) }));
jest.mock("../hooks/useGameIdentity", () => ({ __esModule: true, default: () => ({ displayName: "Ben", avatarIndex: 3, photoURL: null }) }));

let mockPools;
const mockFetchPool = jest.fn((apiKey, language, source) => Promise.resolve(mockPools[source] || []));
// Yazısız afiş: kimliği 3'e bölünen yapımların dilsiz afişi YOK (Bulanık Afiş onları sormamalı).
const mockTextless = jest.fn((apiKey, entry) => Promise.resolve(entry.id % 3 === 0 ? null : `/textless${entry.id}.jpg`));
jest.mock("../services/sceneGameService", () => ({
  fetchTitlePool: (...args) => mockFetchPool(...args),
  getTextlessPoster: (...args) => mockTextless(...args),
}));

const fs = require("fs");
const path = require("path");
const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get, set } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const QuickGameScreen = require("../screens/game/QuickGameScreen").default;
const QuickGamesGrid = require("../components/game/QuickGamesGrid").default;
const { BLUR_ARM_FALLBACK_MS, QUICK_REVEAL_MS } = require("../hooks/useQuickGame");
const { QUICK_COPY, quickOptionLabel } = require("../utils/quickGamesCopy");
const { OLDER_COPY } = require("../utils/olderGameCopy");
const { FILM_CHAIN_COPY } = require("../utils/filmChainCopy");
const { buildTextlessBlurQuestion, BLUR_PROBE_MAX } = require("../services/quickGamePool");
const { BLUR_ROUND_MS, QUICK_GAME_IDS, QUICK_GAME_META, QUICK_GENRES, canonGenresOf, decadeOf } = require("../utils/quickGames");
const STREAK_GAMES = QUICK_GAME_IDS.filter((id) => !QUICK_GAME_META[id].timed);

global.IS_REACT_ACT_ENVIRONMENT = true;
const LANGS = ["tr", "en", "es", "pt", "de"];

let renderer;
let warn;
let randomSpy;
const INFO = {}; // başlık → havuz öğesi

const item = (id, year, extra = {}) => {
  const entry = {
    mediaKey: `${extra.type || "movie"}_${id}`, id, type: "movie", year: String(year), posterPath: `/p${id}.jpg`,
    title: `Yapım ${id}`, voteCount: 1000, genreIds: [18], ...extra,
  };
  INFO[entry.title] = entry;
  return entry;
};
const buildPools = () => {
  const genres = [[28, 12], [35], [18, 10749], [27, 53], [878, 14], [16, 10751], [80, 9648], [99]];
  mockPools = {
    top_rated_movie: Array.from({ length: 14 }, (_, i) => item(100 + i, 1940 + i * 4, { voteCount: Math.round(80 * Math.pow(2.1, i)), genreIds: genres[i % 8] })),
    popular_movie: Array.from({ length: 14 }, (_, i) => item(200 + i, 2005 + i, { voteCount: Math.round(90 * Math.pow(1.9, i)), genreIds: genres[(i + 3) % 8] })),
    popular_tv: Array.from({ length: 10 }, (_, i) => item(300 + i, 2010 + i, { type: "tv", voteCount: Math.round(70 * Math.pow(2.3, i)), genreIds: [[10759], [10765], [10766], [80]][i % 4] })),
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
  mockTextless.mockClear();
  mockSaveBoard.mockClear();
  mockLang = "tr";
  mockUser = { uid: "u1" };
  mockApiKey = "key";
  buildPools();
  let seed = 4242;
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

const common = () => OLDER_COPY[mockLang];
const quick = () => QUICK_COPY[mockLang];
const mount = async (gameId, extra = {}) => {
  await act(async () => {
    renderer = create(<QuickGameScreen navigation={{ goBack: jest.fn() }} route={{ params: { gameId, source: "hub" } }} {...extra} />);
  });
};
const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
const has = (value) => texts().includes(value);
const scales = () => renderer.root.findAllByType("Scale");
const stored = () => get(Keys.quickGames, { uid: "u1" });
const wait = (ms) => act(async () => { jest.advanceTimersByTime(ms); });

// Ekrandaki soruyu havuz bilgisinden çözüp doğru/yanlış cevap düğmesini bulur.
function currentAnswers(gameId) {
  if (QUICK_GAME_META[gameId].layout === "pair") {
    const posters = scales().filter((n) => /bunu seç$/.test(n.props.accessibilityLabel || ""));
    const infos = posters.map((n) => INFO[n.props.accessibilityLabel.replace(", bunu seç", "")]);
    const higher = infos[0].voteCount > infos[1].voteCount ? 0 : 1;
    return { right: posters[higher], wrong: posters[1 - higher] };
  }
  const poster = scales().find((n) => INFO[n.props.accessibilityLabel]);
  const info = INFO[poster.props.accessibilityLabel];
  const options = scales().filter((n) => !INFO[n.props.accessibilityLabel] && n.props.accessibilityState && "disabled" in n.props.accessibilityState);
  const rightLabel = (() => {
    if (gameId === "kind") return quickOptionLabel(quick(), "kind", info.type === "tv" ? "tv" : "movie");
    if (gameId === "decade") return quickOptionLabel(quick(), "decade", String(decadeOf(Number(info.year))));
    return null;
  })();
  const ownGenreLabels = canonGenresOf(info).map((g) => quick().genres[g]);
  const isRight = (n) => (rightLabel ? n.props.accessibilityLabel === rightLabel : ownGenreLabels.includes(n.props.accessibilityLabel));
  return { right: options.find(isRight), wrong: options.find((n) => !isRight(n)), all: options };
}
const answer = async (gameId, correct) => {
  const { right, wrong } = currentAnswers(gameId);
  await act(async () => { (correct ? right : wrong).props.onPress(); });
  await wait(QUICK_REVEAL_MS);
};

describe.each(STREAK_GAMES)("oyun: %s", (gameId) => {
  test("başlık, soru ve (oyuna göre) afiş / şıklar çizilir; havuz üç kaynaktan çekilir", async () => {
    await mount(gameId);
    expect(renderer.root.findByType("Shell").props.title).toBe(quick().games[gameId].title);
    expect(has(quick().games[gameId].prompt)).toBe(true);
    expect(mockFetchPool).toHaveBeenCalledTimes(3);
    expect(mockTrack).toHaveBeenCalledWith("quick_game_started", { game_id: gameId, source: "hub" });
    const { right, wrong } = currentAnswers(gameId);
    expect(right).toBeDefined();
    expect(wrong).toBeDefined();
    if (QUICK_GAME_META[gameId].layout === "single") {
      const { all } = currentAnswers(gameId);
      expect(all).toHaveLength(gameId === "kind" ? 2 : 4);
    }
  });

  test("doğru cevap: skor artar, can düşmez; yanlış: can gider; üç yanlışta oyun biter ve kayıt yalnız bu oyuna yazılır", async () => {
    await mount(gameId);
    await answer(gameId, true);
    await answer(gameId, true);
    expect(texts()).toContain("2");
    const hearts = () => renderer.root.findAllByType("Icon").filter((n) => n.props.name === "heart");
    expect(hearts()).toHaveLength(3);
    await answer(gameId, false);
    await answer(gameId, false);
    expect(hearts()).toHaveLength(1);
    await answer(gameId, false);
    expect(has(common().endTitle.toUpperCase())).toBe(true);
    expect(has(common().endScore(2))).toBe(true);
    expect(has(common().newBest)).toBe(true);
    expect(stored()).toEqual({ [gameId]: { best: 2, plays: 1, correct: 2, answered: 5 } });
    // Rekor liderlik tablosuna (GameLeaderboards/quick_<oyun>) profil kimliğiyle gönderilir.
    expect(mockSaveBoard).toHaveBeenCalledWith("u1", gameId, { best: 2, plays: 1, correct: 2, answered: 5 }, { displayName: "Ben", avatarIndex: 3, photoURL: null });
    expect(get(Keys.olderGame, { uid: "u1" })).toBeNull(); // "Önce hangisi?" kaydına dokunulmaz
    expect(mockTrack).toHaveBeenCalledWith("quick_game_finished", { game_id: gameId, score: 2, answered: 5, new_best: true, best: 2 });
  });

  test("cevaptan sonra bilgi görünür ve süre dolunca sıradaki soru gelir", async () => {
    await mount(gameId);
    const before = scales().map((n) => n.props.accessibilityLabel).join("|");
    const { right } = currentAnswers(gameId);
    await act(async () => { right.props.onPress(); });
    expect(has(common().correct)).toBe(true);
    if (gameId === "popular") expect(texts().some((t) => /oy$/.test(t))).toBe(true);
    else if (gameId === "genre") expect(texts().some((t) => t.includes(" · ") || QUICK_GENRES.some((g) => t === quick().genres[g]))).toBe(true);
    else expect(texts().some((t) => /^\d{4}$/.test(t))).toBe(true);
    await wait(QUICK_REVEAL_MS);
    expect(has(common().correct)).toBe(false);
    expect(scales().map((n) => n.props.accessibilityLabel).join("|")).not.toBe(before);
  });

  test("tekrar oyna yeni koşu başlatır; ikinci koşu daha düşükse rekor kalır", async () => {
    await mount(gameId);
    await answer(gameId, true);
    await answer(gameId, true);
    await answer(gameId, false);
    await answer(gameId, false);
    await answer(gameId, false);
    const again = scales().find((n) => n.props.accessibilityLabel === common().playAgain);
    await act(async () => { again.props.onPress(); });
    await answer(gameId, true);
    await answer(gameId, false);
    await answer(gameId, false);
    await answer(gameId, false);
    expect(has(common().newBest)).toBe(false);
    expect(has(common().bestIs(2))).toBe(true);
    expect(stored()[gameId]).toEqual({ best: 2, plays: 2, correct: 3, answered: 9 });
  });
});

describe("ortak davranış", () => {
  test("bilinmeyen oyun kimliği 'popular'a düşer, çökmez", async () => {
    await mount("yok");
    expect(renderer.root.findByType("Shell").props.title).toBe(quick().games.popular.title);
  });

  test("havuz çok küçükse hata durumu; 'tekrar dene' yeniden dener", async () => {
    mockPools = { top_rated_movie: [item(1, 2000)], popular_movie: [], popular_tv: [] };
    await mount("kind");
    expect(has(common().errorTitle)).toBe(true);
    buildPools();
    const retry = renderer.root.findAllByType("GlassPressable")[0];
    await act(async () => { retry.props.onPress(); });
    expect(has(quick().games.kind.prompt)).toBe(true);
  });

  test("havuzda yalnız film varsa 'film mi dizi mi' hata verir ama diğer oyunlar çalışır", async () => {
    mockPools = { top_rated_movie: mockPools.top_rated_movie, popular_movie: mockPools.popular_movie, popular_tv: [] };
    await mount("kind");
    expect(has(common().errorTitle)).toBe(true);
    act(() => renderer.unmount());
    renderer = null;
    await mount("decade");
    expect(has(quick().games.decade.prompt)).toBe(true);
  });

  test("API anahtarı yoksa hata, ağ isteği yok", async () => {
    mockApiKey = "";
    await mount("genre");
    expect(has(common().errorTitle)).toBe(true);
    expect(mockFetchPool).not.toHaveBeenCalled();
  });

  test("girişsiz oynanır ama hiçbir şey yazılmaz", async () => {
    mockUser = null;
    await mount("decade");
    for (let i = 0; i < 3; i += 1) await answer("decade", false);
    expect(has(common().endTitle.toUpperCase())).toBe(true);
    expect(get(Keys.quickGames, { uid: "u1" })).toBeNull();
    expect(mockSaveBoard).not.toHaveBeenCalled(); // girişsiz: tabloya da yazılmaz
  });

  test("ekrandan çıkınca bekleyen zamanlayıcı sızmaz", async () => {
    await mount("popular");
    const { right } = currentAnswers("popular");
    await act(async () => { right.props.onPress(); });
    act(() => renderer.unmount());
    renderer = null;
    expect(() => jest.advanceTimersByTime(QUICK_REVEAL_MS * 2)).not.toThrow();
  });

  test("'film mi dizi mi'de 8. doğrudan sonra başlık gizlenir (yalnız afiş)", async () => {
    await mount("kind");
    const posterLabel = () => scales().find((n) => INFO[n.props.accessibilityLabel]).props.accessibilityLabel;
    expect(has(posterLabel())).toBe(true); // başlık görünür
    for (let i = 0; i < 8; i += 1) await answer("kind", true);
    expect(has(posterLabel())).toBe(false);
  });

  test.each(LANGS)("dil %s: soru ve şık metinleri çizilir (anahtar sızıntısı yok)", async (lang) => {
    mockLang = lang;
    for (const gameId of QUICK_GAME_IDS) {
      await mount(gameId);
      expect(has(QUICK_COPY[lang].games[gameId].prompt)).toBe(true);
      expect(texts().some((t) => /undefined|NaN|\[object/.test(t))).toBe(true === false);
      act(() => renderer.unmount());
      renderer = null;
    }
  });
});

describe("Bulanık Afiş (zamanlı)", () => {
  const blur = () => QUICK_COPY[mockLang].blur;
  const poster = () => renderer.root.findByType("BlurPoster");
  const options = () => scales().filter((n) => n.props.accessibilityState && "disabled" in n.props.accessibilityState);
  // Doğru şık: afişin anahtarı (BlurPoster'ın resetKey'i = correctKey).
  const rightOption = () => {
    const key = poster().props.resetKey;
    const title = Object.values(INFO).find((x) => x.mediaKey === key).title;
    return options().find((n) => n.props.accessibilityLabel === title);
  };
  const wrongOption = () => options().find((n) => n !== rightOption());
  const ready = () => act(async () => { poster().props.onReady(); });
  const press = (node) => act(async () => { node.props.onPress(); });

  test("dört başlık şıkkı; afiş yüklenmeden saat işlemez ve cevap alınmaz; etiket başlığı sızdırmaz", async () => {
    await mount("blur");
    expect(renderer.root.findByType("Shell").props.title).toBe(quick().games.blur.title);
    expect(has(quick().games.blur.prompt)).toBe(true);
    expect(has(blur().scoreLabel)).toBe(true); // skor satırı "Puan"
    expect(options()).toHaveLength(4);
    options().forEach((n) => expect(n.props.disabled).toBe(true));
    expect(poster().props.running).toBe(false);
    const holder = renderer.root.findAll((n) => n.props.accessible && n.props.accessibilityLabel === blur().posterA11y);
    expect(holder).toHaveLength(1);
    await press(rightOption()); // yok sayılır
    expect(has(common().correct)).toBe(false);
    await ready();
    expect(poster().props.running).toBe(true);
    expect(renderer.root.findByType("TimerBar").props.running).toBe(true);
    options().forEach((n) => expect(n.props.disabled).toBe(false));
    expect(has(blur().points(100))).toBe(true);
  });

  test("afiş YAZISIZ: doğru cevabın dilsiz afişi kullanılır, dilsiz afişi olmayan yapım sorulmaz", async () => {
    await mount("blur");
    for (let i = 0; i < 6; i += 1) {
      const key = poster().props.resetKey;
      const entry = Object.values(INFO).find((x) => x.mediaKey === key);
      expect(entry.id % 3).not.toBe(0);
      expect(poster().props.uri).toContain(`/textless${entry.id}.jpg`);
      expect(poster().props.uri).not.toContain(entry.posterPath);
      await ready();
      await press(rightOption());
      await wait(QUICK_REVEAL_MS);
    }
  });

  test("kalan süre saniye olarak görünür ve azalır; son 3 sn'de uyarı rengi", async () => {
    await mount("blur");
    expect(has(blur().secondsLeft(10))).toBe(true);
    await ready();
    await wait(2500);
    expect(has(blur().secondsLeft(8))).toBe(true);
    await wait(5000);
    expect(has(blur().secondsLeft(3))).toBe(true);
    expect(renderer.root.findByType("TimerBar").props.color).toBe("#EF4444");
    await press(rightOption());
    await wait(500);
    expect(has(blur().secondsLeft(3))).toBe(true); // cevapta saat donar
  });

  test("erken bilen çok alır: 3 sn'de doğru = 73 puan, canlı puan da iner", async () => {
    await mount("blur");
    await ready();
    await wait(3000);
    expect(has(blur().points(73))).toBe(true);
    await press(rightOption());
    expect(has(common().correct)).toBe(true);
    expect(has(blur().points(73))).toBe(true);
    expect(texts()).toContain("73"); // skor
    expect(poster().props.revealed).toBe(true);
    expect(renderer.root.findAll((n) => n.props.accessible && n.props.accessibilityLabel === blur().posterA11y)).toHaveLength(0);
    await wait(QUICK_REVEAL_MS);
    expect(poster().props.revealed).toBe(false); // yeni soru
    expect(poster().props.running).toBe(false); // yeni afiş yüklenene dek saat durur
  });

  test("süre dolarsa can gider ve 'süre doldu' yazar; üç kayıpta oyun biter, kayıt puan + doğru sayısı", async () => {
    await mount("blur");
    await ready();
    await wait(1000);
    await press(rightOption()); // 91
    await wait(QUICK_REVEAL_MS);
    await ready();
    await wait(BLUR_ROUND_MS);
    expect(has(blur().timeUp)).toBe(true);
    const hearts = () => renderer.root.findAllByType("Icon").filter((n) => n.props.name === "heart");
    expect(hearts()).toHaveLength(2);
    await wait(QUICK_REVEAL_MS);
    await ready();
    await press(wrongOption());
    await wait(QUICK_REVEAL_MS);
    await ready();
    await press(wrongOption());
    await wait(QUICK_REVEAL_MS);
    expect(has(common().endTitle.toUpperCase())).toBe(true);
    expect(has(blur().endScore(91))).toBe(true);
    expect(stored()).toEqual({ blur: { best: 91, plays: 1, correct: 1, answered: 4 } });
    expect(mockSaveBoard).toHaveBeenCalledWith("u1", "blur", { best: 91, plays: 1, correct: 1, answered: 4 }, expect.any(Object));
    expect(mockTrack).toHaveBeenCalledWith("quick_game_finished", { game_id: "blur", score: 91, answered: 4, new_best: true, best: 91 });
  });

  test("afiş hiç yüklenmezse saat yedek süreden sonra kendiliğinden başlar", async () => {
    await mount("blur");
    await wait(BLUR_ARM_FALLBACK_MS - 10);
    expect(poster().props.running).toBe(false);
    await wait(20);
    expect(poster().props.running).toBe(true);
    await ready(); // geç gelen yükleme saati sıfırlamaz
    await wait(BLUR_ROUND_MS - 10);
    expect(has(blur().timeUp)).toBe(true);
  });

  test("ekrandan çıkınca tur saati sızmaz", async () => {
    await mount("blur");
    await ready();
    act(() => renderer.unmount());
    renderer = null;
    expect(() => jest.advanceTimersByTime(BLUR_ROUND_MS * 2)).not.toThrow();
  });
});

describe("yazısız afiş araması (buildTextlessBlurQuestion)", () => {
  const pool = () => [...mockPools.top_rated_movie, ...mockPools.popular_movie, ...mockPools.popular_tv];

  test("dilsiz afişi olmayanlar elenir ve bir daha denenmez; bulunan afiş soruya yazılır", async () => {
    const rejected = new Set();
    const lookup = jest.fn((key, entry) => Promise.resolve(entry.id % 2 === 0 ? null : `/t${entry.id}.jpg`));
    for (let i = 0; i < 10; i += 1) {
      const q = await buildTextlessBlurQuestion("key", pool(), { rejected, lookup });
      expect(q.items[0].id % 2).toBe(1);
      expect(q.items[0].posterPath).toBe(`/t${q.items[0].id}.jpg`);
      expect(q.options.map((o) => o.key)).toContain(q.correctKey);
    }
    const asked = lookup.mock.calls.map(([, entry]) => entry.mediaKey);
    [...rejected].forEach((key) => expect(asked.filter((k) => k === key)).toHaveLength(1));
  });

  test("hiçbirinin dilsiz afişi yoksa (ya da ağ hatası) en çok BLUR_PROBE_MAX deneme, sonra null", async () => {
    const none = jest.fn(() => Promise.resolve(null));
    expect(await buildTextlessBlurQuestion("key", pool(), { lookup: none })).toBeNull();
    expect(none.mock.calls.length).toBeLessThanOrEqual(BLUR_PROBE_MAX);
    const failing = jest.fn(() => Promise.reject(new Error("ağ")));
    expect(await buildTextlessBlurQuestion("key", pool(), { lookup: failing })).toBeNull();
  });

  test("ekranda: hiçbir yapımın dilsiz afişi yoksa hata durumu", async () => {
    mockTextless.mockImplementation(() => Promise.resolve(null));
    await mount("blur");
    expect(has(common().errorTitle)).toBe(true);
    mockTextless.mockImplementation((apiKey, entry) => Promise.resolve(entry.id % 3 === 0 ? null : `/textless${entry.id}.jpg`));
  });
});

describe("Eğlence ızgarası", () => {
  const mountGrid = (onOpen = jest.fn()) => { act(() => { renderer = create(<QuickGamesGrid theme={mockTheme} onOpen={onOpen} />); }); return onOpen; };

  // Film Zinciri rayın başında; kartında rekor yerine günlük durum yazar ("Bugünün zinciri").
  const TILE_COUNT = 1 + QUICK_GAME_IDS.length;
  test("altı kart (Önce hangisi? + beş oyun) tek yatay rayda, başlık ve 'Yeni'; her kartta önizleme", () => {
    mountGrid();
    expect(has(quick().gridTitle)).toBe(true);
    const tiles = scales();
    expect(tiles).toHaveLength(TILE_COUNT + 1);
    expect(tiles.map((t) => t.props.accessibilityLabel)).toEqual([
      FILM_CHAIN_COPY.tr.title, OLDER_COPY.tr.title, ...QUICK_GAME_IDS.map((id) => QUICK_COPY.tr.games[id].title),
    ]);
    expect(texts().filter((t) => t === OLDER_COPY.tr.cardNew)).toHaveLength(TILE_COUNT);
    expect(has(FILM_CHAIN_COPY.tr.cardToday)).toBe(true);
    const [rail] = renderer.root.findAllByType("ScrollView");
    expect(rail.props.horizontal).toBe(true);
    expect(rail.findAll((n) => n.type === "Scale")).toHaveLength(TILE_COUNT + 1);
    // Her kart kendi oyununun önizlemesini taşır (afiş görselleri paketten, ağ yok).
    tiles.forEach((tile) => expect(tile.findAllByType("Image").length).toBeGreaterThan(0));
  });

  test("dokununca kare kimliğiyle açılır: older + beş hızlı oyun", () => {
    const onOpen = mountGrid();
    scales().forEach((tile) => act(() => tile.props.onPress()));
    expect(onOpen.mock.calls.map(([id]) => id)).toEqual(["chain", "older", ...QUICK_GAME_IDS]);
  });

  test("her karede kendi rekoru görünür (Önce hangisi? ayrı anahtardan)", () => {
    set(Keys.olderGame, { best: 12, plays: 3, correct: 20, answered: 30 }, { uid: "u1" });
    set(Keys.quickGames, { kind: { best: 7, plays: 2, correct: 9, answered: 14 }, genre: { best: 4, plays: 1, correct: 4, answered: 7 } }, { uid: "u1" });
    mountGrid();
    expect(texts().filter((t) => t === OLDER_COPY.tr.cardBest(12))).toHaveLength(1);
    expect(has(OLDER_COPY.tr.cardBest(7))).toBe(true);
    expect(has(OLDER_COPY.tr.cardBest(4))).toBe(true);
    expect(texts().filter((t) => t === OLDER_COPY.tr.cardNew)).toHaveLength(3); // popular + decade + blur
  });

  test.each(LANGS)("dil %s: başlıklar o dilde", (lang) => {
    mockLang = lang;
    mountGrid();
    expect(has(QUICK_COPY[lang].gridTitle)).toBe(true);
    QUICK_GAME_IDS.forEach((id) => expect(has(QUICK_COPY[lang].games[id].title)).toBe(true));
  });
});

describe("metin tablosu ve kaynak bekçileri", () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

  test("oy sayısı biçimi: eşikler ve ondalık ayracı dile göre", () => {
    expect(QUICK_COPY.tr.votes(340)).toBe("340 oy");
    expect(QUICK_COPY.tr.votes(12400)).toBe("12,4 bin oy");
    expect(QUICK_COPY.tr.votes(1200000)).toBe("1,2 milyon oy");
    expect(QUICK_COPY.en.votes(12400)).toBe("12.4K votes");
    expect(QUICK_COPY.en.votes(1)).toBe("1 vote");
    expect(QUICK_COPY.es.votes(250000)).toBe("250 mil votos");
    expect(QUICK_COPY.de.votes(1500)).toBe("1,5 Tsd. Stimmen");
    expect(QUICK_COPY.pt.votes(3000000)).toBe("3 mi de votos");
  });

  test("on yıl biçimi ve her oyun için dört yazı alanı dolu", () => {
    expect(QUICK_COPY.tr.decadeLabel(1990)).toBe("1990'lar");
    expect(QUICK_COPY.en.decadeLabel(1990)).toBe("1990s");
    expect(QUICK_COPY.de.decadeLabel(1990)).toBe("1990er");
    for (const lang of LANGS) {
      QUICK_GAME_IDS.forEach((id) => {
        const g = QUICK_COPY[lang].games[id];
        [g.title, g.hint, g.prompt].forEach((t) => expect(t.trim().length).toBeGreaterThan(3));
      });
      QUICK_GENRES.forEach((g) => expect(QUICK_COPY[lang].genres[g]).toBeTruthy());
      expect(QUICK_COPY[lang].kind.movie).not.toBe(QUICK_COPY[lang].kind.tv);
    }
  });

  test("metin tablosundaki her üst düzey anahtar kullanılıyor", () => {
    const used = [read("screens/game/QuickGameScreen.js"), read("components/game/QuickGamesGrid.js"), read("utils/quickGamesCopy.js")].join("\n");
    const unused = Object.keys(QUICK_COPY.tr).filter((key) => !new RegExp(`quick\\.${key}\\b|\\bcopy\\.${key}\\b`).test(used));
    expect(unused).toEqual([]);
  });

  test("rota, ızgara ve Eğlence modülü bağlı; oyun Sahne Tahmin'in skor hattına DOKUNMAZ; premium kapısı yok", () => {
    expect(read("App.js")).toMatch(/name="QuickGameScreen"/);
    expect(read("components/profile/ProfileGamesModule.js")).toMatch(/<QuickGamesGrid[^>]*onOpen=\{openQuickGame\}/);
    expect(read("components/profile/ProfileGamesModule.js")).toMatch(/navigate\("QuickGameScreen"/);
    // Sahne Tahmin skor hattına dokunmaz, Firestore'a doğrudan yazmaz; tabloya tek yol saveQuickBoardEntry (27 Eki).
    expect(read("hooks/useQuickGame.js")).not.toMatch(/saveGameScore|loadGameData|setDoc|updateDoc|firebase\/firestore/);
    expect(read("hooks/useQuickGame.js")).toMatch(/saveQuickBoardEntry\(uid, gameId/);
    expect(read("screens/game/QuickGameScreen.js")).not.toMatch(/usePremium/);
  });

  test("simge adları Ionicons sözlüğünde var", () => {
    const glyphs = JSON.parse(read("node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json"));
    const source = [read("components/game/QuickGameParts.js"), read("components/game/QuickGamesGrid.js"), read("screens/game/QuickGameScreen.js")].join("\n");
    const names = [...source.matchAll(/name=(?:\{[^}]*?)?"([a-z-]+)"/g)].map((m) => m[1]);
    const metaIcons = QUICK_GAME_IDS.map((id) => QUICK_GAME_META[id].icon);
    const gridIcons = ["swap-horizontal"];
    expect(names.length).toBeGreaterThan(5);
    [...names, ...metaIcons, ...gridIcons].forEach((name) => expect(glyphs[name]).toBeDefined());
  });
});
