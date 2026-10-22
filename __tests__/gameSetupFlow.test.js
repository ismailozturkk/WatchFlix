// __tests__/gameSetupFlow.test.js
//
// Eğlence > Oyunlar sadeleştirmesi (23 Eki): Sahne Tahmin / Poster Bulmaca'ya girmek artık ayrı vitrin + kurulum
// ekranı DEĞİL, karoya dokununca açılan kurulum alt sayfası (components/game/GameSetupSheet.js). Oyun Merkezi
// tek ilerleme ekranı (istatistik + başarımlar içinde). Bu dosya üç şeyi sabitler:
//   1) modül: tek ızgara (2 sahne oyunu + 5 hızlı oyun), karo → sayfa → "Oyunu Başlat" → SceneGamePlayScreen
//      (sayfa KAPANDIKTAN sonra: iOS iki Modal kuralı), kilitli planda sayfa yerine yükseltme
//   2) sayfa: kayıtlı tercih / açık seçim / yetersiz kişisel liste düşüşü, günlük hak bitince oyun açılmaz
//   3) Oyun Merkezi: başarımlar ve mod rekorları aynı ekranda; kaldırılan ekranlara giden rota kalmadı

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  PixelRatio: { get: () => 2 },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }) }));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect) => require("react").useEffect(() => effect(), [effect]),
}));
const mockHost = (name) => ({ __esModule: true, default: ({ children, ...props }) => require("react").createElement(name, props, children) });
jest.mock("../components/AppIcon", () => mockHost("Icon"));
jest.mock("../components/Skeleton", () => mockHost("Skeleton"));
jest.mock("../components/common/GlassPressable", () => mockHost("GlassPressable"));
jest.mock("../components/common/GlassTouchable", () => mockHost("GlassTouchable"));
jest.mock("../components/common/GlassBox", () => mockHost("GlassBox"));
jest.mock("../components/common/GlassCloseButton", () => mockHost("CloseButton"));
jest.mock("../components/common/GlassIconButton", () => mockHost("IconButton"));
jest.mock("../components/common/SheetScroll", () => mockHost("SheetScroll"));
jest.mock("../components/common/UserAvatar", () => mockHost("Avatar"));
jest.mock("../components/badges/AppBadge", () => mockHost("Badge"));
jest.mock("../components/premium/PremiumPill", () => mockHost("PremiumPill"));
jest.mock("../components/game/DailyChallengeCard", () => mockHost("DailyCard"));
jest.mock("../components/game/DuelSendButton", () => mockHost("Duel"));
jest.mock("../components/game/PlayerStrip", () => mockHost("PlayerStrip"));
jest.mock("../components/game/ui", () => {
  const React = require("react");
  return {
    PressableScale: ({ children, ...props }) => React.createElement("Scale", props, children),
    SectionHeader: ({ title, action, onAction }) => React.createElement("Section", { title, action, onAction }),
    MiniProgress: () => null,
  };
});
jest.mock("../screens/game/GameScreenShell", () => {
  const React = require("react");
  return {
    GameScreenShell: ({ title, headerRight, children }) => React.createElement("Shell", { title }, headerRight, children),
    gameSharedStyles: { primaryButton: {}, primaryButtonText: {} },
  };
});
// Gerçek BottomSheetModal'ın sözleşmesi: görünürken çizer; visible true→false olunca (çıkış bitti) onDismissed.
jest.mock("../components/common/BottomSheetModal", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: function MockSheet({ visible, onDismissed, children }) {
      const was = React.useRef(visible);
      React.useEffect(() => {
        if (was.current && !visible) onDismissed?.();
        was.current = visible;
      }, [visible, onDismissed]);
      return visible ? React.createElement("Sheet", null, children) : null;
    },
  };
});
jest.mock("../utils/i18nText", () => ({
  i18nText: (key, fallback, vars) =>
    String(fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(vars?.[name] ?? "")),
}));

let mockLang = "tr";
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", between: "#222222", border: "#333333", accent: "#3388ff", bold: "#2255cc",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1", displayName: "Ada" } }) }));
jest.mock("../context/FriendsContext", () => ({ useFriends: () => ({ friends: [] }) }));
let mockLists = {};
jest.mock("../context/ListStatusContext", () => ({ useListStatusContext: () => ({ combinedLists: mockLists }) }));

let mockStats = null;
jest.mock("../hooks/useGameStats", () => ({ __esModule: true, default: () => ({ ready: true, stats: mockStats }) }));
jest.mock("../hooks/useDailyView", () => ({
  __esModule: true,
  default: () => ({ status: "available", now: Date.now(), dayKey: "2026-10-23", result: null }),
}));
jest.mock("../hooks/usePremiumScreenGuard", () => ({ __esModule: true, default: () => {} }));
let mockLocked = false;
let mockDailyOk = true;
const mockUpsell = jest.fn();
const mockDailyCheck = jest.fn(() => mockDailyOk);
jest.mock("../hooks/usePremiumGate", () => ({
  usePremiumGate: () => ({ allows: () => !mockLocked, showUpsell: mockUpsell }),
  usePremiumDailyGate: () => ({ check: mockDailyCheck, unlimited: true, remaining: 5, limit: 20 }),
}));
jest.mock("../services/sceneGameService", () => ({
  buildWatchlistPool: (list) => list,
  fetchLeaderboard: () => Promise.resolve([]),
}));

const fs = require("fs");
const path = require("path");
const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get, set } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const ProfileGamesModule = require("../components/profile/ProfileGamesModule").default;
const GameSetupSheet = require("../components/game/GameSetupSheet").default;
const GameHubScreen = require("../screens/game/GameHubScreen").default;
const { GAME_REGISTRY, SCENE_ACHIEVEMENTS } = require("../screens/game/gameRegistry");
const { POSTER_GAME_ID, SCENE_GAME_ID } = require("../screens/game/gameConfig");
const { QUICK_GAME_IDS } = require("../utils/quickGames");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let warn;
beforeEach(() => {
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  mockLang = "tr";
  mockLists = {};
  mockStats = null;
  mockLocked = false;
  mockDailyOk = true;
  mockUpsell.mockClear();
  mockDailyCheck.mockClear();
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  warn.mockRestore();
});

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const byLabel = (label) => renderer.root.findAll((n) => n.type === "Scale" && n.props.accessibilityLabel === label);
const press = async (label) => {
  const [node] = byLabel(label);
  if (!node) throw new Error(`düğme yok: ${label}`);
  await act(async () => { await node.props.onPress(); });
  await flush();
};
const sheetOpen = () => renderer.root.findAllByType("Sheet").length > 0;
const selected = (label) => byLabel(label)[0]?.props.accessibilityState?.selected;

const mountModule = async () => {
  const navigation = { navigate: jest.fn() };
  await act(async () => { renderer = create(<ProfileGamesModule navigation={navigation} />); });
  await flush();
  return navigation;
};

describe("Eğlence > Oyunlar modülü", () => {
  test("tek ızgara: önce iki sahne oyunu, sonra beş hızlı oyun; ayrı oyun bölümü/başlığı yok", async () => {
    await mountModule();
    const grid = renderer.root.findAll((n) => n.type === "Scale" && typeof n.props.accessibilityLabel === "string");
    expect(grid.map((n) => n.props.accessibilityLabel).slice(0, 2)).toEqual(GAME_REGISTRY.map((g) => g.id));
    expect(grid).toHaveLength(2 + 1 + QUICK_GAME_IDS.length);
    const titles = renderer.root.findAllByType("Section").map((n) => n.props.title);
    expect(titles).toEqual(["Oyunlar"]); // "Hızlı oyunlar" ve "Oyun Merkezi" kısayolu kalktı
  });

  test("Sahne Tahmin: karo → kurulum sayfası → Başlat → sayfa kapanınca oyun (kayıtlı tercihle)", async () => {
    set(Keys.sceneGamePreferences, { modeId: "survival", difficultyId: "hard", sourceId: "top_rated_tv" }, { uid: "u1" });
    const navigation = await mountModule();
    expect(sheetOpen()).toBe(false);

    await press(SCENE_GAME_ID);
    expect(sheetOpen()).toBe(true);
    expect(navigation.navigate).not.toHaveBeenCalled(); // ara ekran yok
    expect(selected("Hayatta Kalma")).toBe(true);
    expect(selected("Zor")).toBe(true);
    expect(selected("En İyi Diziler")).toBe(true);

    await press("Normal");
    await press("Oyunu Başlat");
    expect(sheetOpen()).toBe(false);
    expect(mockDailyCheck).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith("SceneGamePlayScreen", {
      gameId: SCENE_GAME_ID, modeId: "survival", difficultyId: "normal", sourceId: "top_rated_tv",
    });
    // Seçim bir sonraki açılış için saklandı.
    expect(get(Keys.sceneGamePreferences, { uid: "u1" })).toMatchObject({ modeId: "survival", difficultyId: "normal" });
  });

  test("Poster Bulmaca aynı sayfayı kendi oyun kimliğiyle açar", async () => {
    const navigation = await mountModule();
    await press(POSTER_GAME_ID);
    await press("Oyunu Başlat");
    expect(navigation.navigate).toHaveBeenCalledWith("SceneGamePlayScreen", expect.objectContaining({ gameId: POSTER_GAME_ID }));
  });

  test("dışarı dokunup kapatmak oyunu BAŞLATMAZ", async () => {
    const navigation = await mountModule();
    await press(SCENE_GAME_ID);
    const close = renderer.root.findByType("CloseButton");
    await act(async () => close.props.onPress());
    await flush();
    expect(sheetOpen()).toBe(false);
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(mockDailyCheck).not.toHaveBeenCalled();
  });

  test("günlük hak bittiyse sayfa kapanır, oyun açılmaz (uyarı kapıda)", async () => {
    mockDailyOk = false;
    const navigation = await mountModule();
    await press(SCENE_GAME_ID);
    await press("Oyunu Başlat");
    expect(mockDailyCheck).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  test("kilitli plan: sahne karoları 'Premium' der, dokununca sayfa değil yükseltme; hızlı oyunlar açık", async () => {
    mockLocked = true;
    const navigation = await mountModule();
    const texts = renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
    expect(texts.filter((t) => t === "Premium")).toHaveLength(2);

    await press(SCENE_GAME_ID);
    expect(mockUpsell).toHaveBeenCalledTimes(1);
    expect(sheetOpen()).toBe(false);

    const quickTiles = renderer.root.findAll((n) => n.type === "Scale" && typeof n.props.accessibilityLabel === "string").slice(2);
    await act(async () => quickTiles[0].props.onPress());
    await act(async () => quickTiles[1].props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("OlderGameScreen", { source: "hub" });
    expect(navigation.navigate).toHaveBeenCalledWith("QuickGameScreen", { gameId: QUICK_GAME_IDS[0], source: "hub" });
  });

  test("oyuncu şeridi Oyun Merkezi'ne gider", async () => {
    const navigation = await mountModule();
    const strip = renderer.root.findByType("PlayerStrip");
    act(() => strip.props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("GameHubScreen");
  });
});

describe("Kurulum sayfası seçim kuralları", () => {
  const mountSheet = async (props = {}) => {
    const onStart = jest.fn();
    const onClose = jest.fn();
    await act(async () => {
      renderer = create(<GameSetupSheet visible gameId={SCENE_GAME_ID} onClose={onClose} onStart={onStart} {...props} />);
    });
    await flush();
    return { onStart, onClose };
  };

  test("açık seçim (sonuç ekranının son oyunu) kayıtlı tercihi ezer", async () => {
    set(Keys.sceneGamePreferences, { modeId: "survival", difficultyId: "hard", sourceId: "popular" }, { uid: "u1" });
    await mountSheet({ initial: { modeId: "time_attack", difficultyId: "easy", sourceId: "popular_movie" } });
    expect(selected("Zamana Karşı")).toBe(true);
    expect(selected("Kolay")).toBe(true);
    expect(selected("Popüler Filmler")).toBe(true);
  });

  test("tercih yoksa son oyunun ayarları; o da yoksa Klasik · Normal · Popüler", async () => {
    await mountSheet({ stats: { lastModeId: "survival", lastDifficultyId: "easy", lastSourceId: "top_rated_movie" } });
    expect(selected("Hayatta Kalma")).toBe(true);
    expect(selected("En İyi Filmler")).toBe(true);
    act(() => renderer.unmount());
    renderer = null;

    await mountSheet();
    expect(selected("Klasik Mod")).toBe(true);
    expect(selected("Normal")).toBe(true);
    expect(selected("Popüler")).toBe(true);
  });

  test("4'ten az yapımlı kişisel liste pasif; kayıtlı tercih oysa Popüler'e düşer", async () => {
    mockLists = { favorites: [1, 2, 3], watchList: [1, 2, 3, 4, 5] };
    set(Keys.sceneGamePreferences, { modeId: "classic", difficultyId: "normal", sourceId: "favorites" }, { uid: "u1" });
    await mountSheet();
    expect(selected("Popüler")).toBe(true);
    expect(byLabel("Favoriler")[0].props.disabled).toBe(true);
    expect(byLabel("İzleme Listem")[0].props.disabled).toBe(false);
    expect(byLabel("Popüler")[0].props.disabled).toBe(false);
  });

  test("günlük mod ve günlük havuz sayfada seçilemez", async () => {
    await mountSheet();
    expect(byLabel("Günlük Meydan Okuma")).toHaveLength(0);
  });
});

describe("Oyun Merkezi (tek ilerleme ekranı)", () => {
  test("başarımların tamamı ve mod rekorları aynı ekranda; başlık düğmesi liderlik tablosu", async () => {
    mockStats = {
      totalPlayed: 6, totalCorrect: 40, totalWrong: 10, bestScore: 900, bestStreak: 12, totalXp: 500,
      bestScoresByMode: { classic_normal: 900, poster_classic_hard: 450 },
    };
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    await act(async () => { renderer = create(<GameHubScreen navigation={navigation} />); });
    await flush();

    expect(renderer.root.findAllByType("Badge")).toHaveLength(SCENE_ACHIEVEMENTS.length);
    const sections = renderer.root.findAllByType("Section").map((n) => n.props.title);
    expect(sections).toEqual(["Arkadaş Sıralaması", "Başarımlar", "Mod rekorları"]);
    const texts = renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
    expect(texts).toContain("80%"); // 40 / 50
    expect(texts).toContain("900");
    expect(texts).toContain("450");

    act(() => renderer.root.findByType("IconButton").props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("GameLeaderboardScreen", { gameId: SCENE_GAME_ID, scope: "global" });
    // Eğlence'de zaten olan günlük kart ve oyun kartları burada tekrar edilmez.
    expect(renderer.root.findAllByType("DailyCard")).toHaveLength(0);
  });
});

describe("kaldırılan ara ekranlar", () => {
  const ROOT = path.join(__dirname, "..");
  const GONE = ["SceneGameDetailScreen", "SceneGameSetupScreen", "GameStatsScreen", "GameAchievementsScreen"];
  const sources = () => {
    const out = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (["node_modules", "dist", "__tests__", "android", "ios", "functions", "website", "docs", "scripts"].includes(entry.name) || entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".js")) out.push(full);
      }
    };
    walk(ROOT);
    return out;
  };

  test("hiçbir kaynak dosyası kaldırılan rotalara gitmez, App.js onları kaydetmez", () => {
    const offenders = [];
    for (const file of sources()) {
      const text = fs.readFileSync(file, "utf8");
      GONE.forEach((name) => { if (text.includes(`"${name}"`)) offenders.push(`${path.relative(ROOT, file)} → ${name}`); });
    }
    expect(offenders).toEqual([]);
  });

  test("sonuç ekranı kapanınca oyunun açıldığı yere döner (Oyun Merkezi'ne popTo yok)", () => {
    const text = fs.readFileSync(path.join(ROOT, "screens/game/SceneGameResultScreen.js"), "utf8");
    expect(text).not.toMatch(/popTo\(/);
    expect(text).toMatch(/<GameSetupSheet/);
  });
});
