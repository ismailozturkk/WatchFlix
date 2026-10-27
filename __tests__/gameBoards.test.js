// __tests__/gameBoards.test.js
//
// Liderlik tabloları: saf çekirdek (utils/gameBoards.js — tablo kimlikleri, sıra, Genel sıra puanı), okuma/yazma
// servisi (services/gameLeaderboards.js — önbellek, kısmi hata, "yalnız büyükse yaz") ve Liderlik ekranının oyun
// seçicisi (screens/game/GameLeaderboardScreen.js). Firestore ve görsel parçalar taklit.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => {
  const React = require("react");
  return {
    StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
    View: "View",
    Text: "Text",
    TouchableOpacity: "Touchable",
    ActivityIndicator: "Spinner",
    // FlatList: verinin hepsini çizen basit sürüm (başlık + satırlar).
    FlatList: ({ data, renderItem, ListHeaderComponent, keyExtractor }) =>
      React.createElement(
        "List",
        null,
        ListHeaderComponent || null,
        (data || []).map((item, index) => React.createElement(React.Fragment, { key: keyExtractor ? keyExtractor(item, index) : index }, renderItem({ item, index }))),
      ),
    Platform: { OS: "ios", select: (o) => o.ios },
  };
});
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "Safe" }));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
const mockHost = (name) => ({ __esModule: true, default: ({ children, ...props }) => require("react").createElement(name, props, children) });
jest.mock("../components/AppIcon", () => mockHost("Icon"));
jest.mock("../components/common/GlassIconButton", () => mockHost("IconButton"));
jest.mock("../components/common/BottomSheetModal", () => mockHost("Sheet"));
jest.mock("../components/common/UserAvatar", () => mockHost("Avatar"));
jest.mock("../components/common/GlassTouchable", () => mockHost("GlassTouchable"));
jest.mock("../hooks/usePremiumScreenGuard", () => ({ __esModule: true, default: () => {} }));
jest.mock("../screens/game/GameScreenShell", () => {
  const React = require("react");
  return {
    GameScreenShell: ({ title, subtitle, headerRight, children }) => React.createElement("Shell", { title, subtitle }, headerRight, children),
    gameSharedStyles: { primaryButton: {}, primaryButtonText: {} },
  };
});
let mockLang = "tr";
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "me" } }) }));
let mockFriends = [];
jest.mock("../context/FriendsContext", () => ({ useFriends: () => ({ friends: mockFriends }) }));

// ── Firestore taklidi: GameLeaderboards/<tablo>/entries/<uid> bellek içi ──────────────────────────────────────
const mockStore = new Map(); // "board/uid" → data
const mockFail = new Set(); // okunamayan tablolar
const mockReads = [];
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  collection: (db, root, board, sub) => ({ board, sub }),
  doc: (db, root, board, sub, uid) => ({ board, uid }),
  query: (col) => col,
  orderBy: () => null,
  limit: () => null,
  getDocs: async (col) => {
    mockReads.push(col.board);
    if (mockFail.has(col.board)) throw new Error("offline");
    const rows = [...mockStore.entries()]
      .filter(([key]) => key.startsWith(`${col.board}/`))
      .map(([key, data]) => ({ id: key.split("/")[1], data: () => data }))
      .sort((a, b) => b.data().score - a.data().score);
    return { forEach: (fn) => rows.forEach(fn) };
  },
  getDoc: async (ref) => {
    const data = mockStore.get(`${ref.board}/${ref.uid}`);
    return { exists: () => !!data, data: () => data };
  },
  setDoc: jest.fn(async (ref, data) => {
    mockStore.set(`${ref.board}/${ref.uid}`, { ...(mockStore.get(`${ref.board}/${ref.uid}`) || {}), ...data });
  }),
}));
let mockSceneRows = [];
const mockDaily = jest.fn(() => Promise.resolve([]));
jest.mock("../services/sceneGameService", () => ({
  fetchLeaderboard: () => (mockFail.has("scene") ? Promise.reject(new Error("offline")) : Promise.resolve(mockSceneRows)),
  fetchDailyLeaderboard: (...args) => mockDaily(...args),
}));

const firestore = require("firebase/firestore");
const {
  BOARD_GAME_IDS, QUICK_BOARD_IDS, RANKED_GAME_IDS, RANK_POINTS_MAX, boardIdOf, buildOverallRows, rankPoints, rankRows,
} = require("../utils/gameBoards");
const { QUICK_GAME_IDS } = require("../utils/quickGames");
const { GAME_BOARDS_COPY } = require("../utils/gameBoardsCopy");
const { BOARD_TTL_MS, __clearBoardCache, fetchGameBoard, fetchOverallBoard, saveQuickBoardEntry } = require("../services/gameLeaderboards");
const GameLeaderboardScreen = require("../screens/game/GameLeaderboardScreen").default;

global.IS_REACT_ACT_ENVIRONMENT = true;
global.__DEV__ = false;

const row = (uid, bestScore, extra = {}) => ({ uid, displayName: uid, bestScore, totalCorrect: 0, bestStreak: 0, ...extra });
const put = (gameId, uid, score, extra = {}) =>
  mockStore.set(`${boardIdOf(gameId)}/${uid}`, { uid, score, displayNameSnapshot: uid, correctCount: 0, ...extra });

let renderer;
let warn;
beforeEach(() => {
  mockStore.clear();
  mockFail.clear();
  mockReads.length = 0;
  mockSceneRows = [];
  mockFriends = [];
  mockLang = "tr";
  firestore.setDoc.mockClear();
  __clearBoardCache();
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
  jest.useRealTimers();
});

describe("çekirdek (utils/gameBoards)", () => {
  test("her oyunun tablosu: Sahne eski koleksiyonda, Poster mevcut tabloda, hızlı oyunlar quick_<oyun>", () => {
    expect(RANKED_GAME_IDS).toEqual(["scene_guess", "poster_puzzle", "older", ...QUICK_GAME_IDS]);
    expect(BOARD_GAME_IDS[0]).toBe("overall");
    expect(boardIdOf("scene_guess")).toBeNull();
    expect(boardIdOf("poster_puzzle")).toBe("poster_classic_normal"); // saveGameScore'un yazdığı tablo
    expect(boardIdOf("blur")).toBe("quick_blur");
    expect(QUICK_BOARD_IDS).toEqual(["quick_older", ...QUICK_GAME_IDS.map((id) => `quick_${id}`)]);
  });

  test("sıra: eşit skor eşit sıra (1-1-3), skoru 0 olan sıralamaya girmez; sıra puanı 50 → 1", () => {
    const ranked = rankRows([row("a", 10), row("b", 30), row("c", 30), row("d", 0), row("e", 5)]);
    expect(ranked.map((r) => [r.uid, r.rank])).toEqual([["b", 1], ["c", 1], ["a", 3], ["e", 4]]);
    expect(rankPoints(1)).toBe(RANK_POINTS_MAX);
    expect(rankPoints(2)).toBe(RANK_POINTS_MAX - 1);
    expect(rankPoints(RANK_POINTS_MAX)).toBe(1);
    expect(rankPoints(RANK_POINTS_MAX + 1)).toBe(0);
  });

  test("Genel: ham skorlar değil SIRA puanları toplanır; uçuk skor yalnız kendi oyununun 1.liğini alır", () => {
    const rows = buildOverallRows({
      scene_guess: [row("ada", 1200), row("can", 900)],
      blur: [row("can", 999999), row("ada", 300)], // uçuk skor
      older: [row("ada", 14), row("deniz", 14)], // eşitlik
      nope: [row("x", 5)], // bilinmeyen oyun sayılmaz
    });
    expect(rows.map((r) => [r.uid, r.bestScore, r.games, r.firsts])).toEqual([
      ["ada", 50 + 49 + 50, 3, 2],
      ["can", 49 + 50, 2, 1],
      ["deniz", 50, 1, 1],
    ]);
    expect(rows[0].perGame.blur).toEqual({ rank: 2, points: 49 });
  });

  test("Genel eşitliği: daha çok birincilik, sonra daha çok oyun", () => {
    const rows = buildOverallRows({
      scene_guess: [row("a", 10), row("b", 9)],
      poster_puzzle: [row("b", 10), row("a", 9)],
      older: [row("c", 10)],
      blur: [row("c", 1), row("x", 2)],
    });
    // a: 50+49=99 (1 birincilik), b: 49+50=99 (1), c: 50+49=99 (1) → oyun sayısı eşit (2) → kararlı sıra
    expect(rows.slice(0, 3).map((r) => r.bestScore)).toEqual([99, 99, 99]);
    expect(rows.find((r) => r.uid === "x").bestScore).toBe(50);
  });
});

describe("servis (services/gameLeaderboards)", () => {
  test("oyun tablosu okunur ve kısa süre önbellekte kalır; 'fresh' önbelleği atlar", async () => {
    jest.useFakeTimers();
    put("blur", "ada", 300, { correctCount: 7 });
    const first = await fetchGameBoard("blur");
    expect(first).toEqual([expect.objectContaining({ uid: "ada", bestScore: 300, totalCorrect: 7 })]);
    await fetchGameBoard("blur");
    expect(mockReads).toEqual(["quick_blur"]);
    await fetchGameBoard("blur", { fresh: true });
    expect(mockReads).toHaveLength(2);
    jest.advanceTimersByTime(BOARD_TTL_MS + 1);
    await fetchGameBoard("blur");
    expect(mockReads).toHaveLength(3);
  });

  test("Genel: bir tablo okunamazsa o oyun boş sayılır ve bildirilir; hiçbiri okunamazsa hata", async () => {
    mockSceneRows = [row("ada", 900)];
    put("older", "can", 12);
    mockFail.add("quick_blur");
    const { rows, failed } = await fetchOverallBoard();
    expect(failed).toEqual(["blur"]);
    expect(rows.map((r) => r.uid)).toEqual(["ada", "can"]);
    __clearBoardCache();
    mockFail.add("scene");
    ["poster_classic_normal", ...QUICK_BOARD_IDS].forEach((id) => mockFail.add(id));
    await expect(fetchOverallBoard()).rejects.toThrow("boards_unavailable");
  });

  test("hızlı oyun rekoru yalnız tablodakinden BÜYÜKSE yazılır (iki cihaz) ve kimlik anlık kopyası taşınır", async () => {
    const identity = { displayName: "Ada", avatarIndex: 4, photoURL: null };
    expect(await saveQuickBoardEntry("ada", "blur", { best: 300, correct: 5 }, identity)).toBe(true);
    expect(mockStore.get("quick_blur/ada")).toMatchObject({ uid: "ada", score: 300, correctCount: 5, displayNameSnapshot: "Ada", avatarIndexSnapshot: 4, verified: false });
    expect(await saveQuickBoardEntry("ada", "blur", { best: 250, correct: 9 }, identity)).toBe(false); // düşük cihaz
    expect(await saveQuickBoardEntry("ada", "blur", { best: 300, correct: 9 }, identity)).toBe(false); // eşit
    expect(mockStore.get("quick_blur/ada").score).toBe(300);
    expect(await saveQuickBoardEntry("ada", "older", { best: 15, correct: 40 }, null)).toBe(true);
    expect(firestore.setDoc).toHaveBeenCalledTimes(2);
  });

  test("yazılmayanlar: girişsiz, sıfır skor, sıralamasız oyun; hata oyunu bozmaz", async () => {
    expect(await saveQuickBoardEntry(null, "blur", { best: 10 })).toBe(false);
    expect(await saveQuickBoardEntry("ada", "blur", { best: 0 })).toBe(false);
    expect(await saveQuickBoardEntry("ada", "scene_guess", { best: 10 })).toBe(false);
    firestore.setDoc.mockImplementationOnce(async () => { throw new Error("permission"); });
    expect(await saveQuickBoardEntry("ada", "kind", { best: 3 })).toBe(false);
  });

  test("yazınca o oyunun önbelleği düşer (kendi skorun hemen görünür)", async () => {
    await fetchGameBoard("genre");
    await saveQuickBoardEntry("me", "genre", { best: 8, correct: 8 }, null);
    const rows = await fetchGameBoard("genre");
    expect(rows.map((r) => r.uid)).toEqual(["me"]);
  });
});

describe("Liderlik ekranı", () => {
  const flush = () => act(async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); });
  const mount = async (params = {}) => {
    await act(async () => { renderer = create(<GameLeaderboardScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() }} route={{ params }} />); });
    await flush();
  };
  const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
  const chip = (label) => renderer.root.findAll((n) => n.type === "Touchable" && n.props.accessibilityLabel === label)[0];
  const seed = () => {
    mockSceneRows = [row("ada", 1200, { totalCorrect: 40, totalWrong: 10 }), row("can", 900)];
    put("blur", "can", 340, { correctCount: 6 });
    put("blur", "me", 200, { correctCount: 3 });
    put("older", "me", 14, { correctCount: 30 });
    put("blur", "x1", 100, { correctCount: 2 });
    put("blur", "x2", 50, { correctCount: 1 }); // blur'da 4. sıra → podyum dışı satır
  };

  test("varsayılan GENEL: tüm oyunlar sıra puanıyla; oyun seçicide Genel + her oyun", async () => {
    seed();
    await mount();
    const shell = renderer.root.findByType("Shell");
    expect(shell.props.subtitle).toBe(GAME_BOARDS_COPY.tr.overallSubtitle);
    const gameChips = renderer.root.findAll((n) => n.type === "Touchable" && n.props.accessibilityLabel);
    expect(gameChips).toHaveLength(BOARD_GAME_IDS.length);
    expect(gameChips[0].props.accessibilityLabel).toBe("Genel");
    expect(gameChips.map((c) => c.props.accessibilityLabel)).toEqual(expect.arrayContaining(["Bulanık Afiş", "Önce hangisi?"]));
    // can: sahne 2. (49) + blur 1. (50) = 99; me: blur 2. (49) + older 1. (50) = 99; ada: 50; x1 48; x2 47
    expect(texts()).toEqual(expect.arrayContaining(["99", "50", "48", "47", GAME_BOARDS_COPY.tr.overallMeta(1, 0)]));
    expect(mockReads).toEqual(expect.arrayContaining(["poster_classic_normal", ...QUICK_BOARD_IDS]));
  });

  test("oyun seçilince o oyunun tablosu ve skoru; sonuç ekranından gelen gameId o tabloyu açar", async () => {
    seed();
    await mount();
    await act(async () => { chip("Bulanık Afiş").props.onPress(); });
    await flush();
    expect(renderer.root.findByType("Shell").props.subtitle).toBe(GAME_BOARDS_COPY.tr.gameSubtitle("Bulanık Afiş"));
    expect(texts()).toEqual(expect.arrayContaining(["340", "200", "100", "50", GAME_BOARDS_COPY.tr.correctMeta(1)]));
    act(() => renderer.unmount());
    renderer = null;
    await mount({ gameId: "scene_guess" });
    expect(texts()).toEqual(expect.arrayContaining(["1200", "900"]));
    expect(texts()).not.toContain("340");
  });

  test("Arkadaşlar kapsamı seçili tabloyu süzer; Günlük'te oyun seçici gizlenir", async () => {
    seed();
    mockFriends = [{ friendUid: "can" }];
    await mount({ scope: "friends" });
    expect(texts()).toContain("99");
    expect(texts()).not.toContain("ada"); // arkadaş değil
    act(() => renderer.unmount());
    renderer = null;
    await mount({ scope: "daily" });
    expect(renderer.root.findAll((n) => n.type === "Touchable" && n.props.accessibilityLabel === "Genel")).toHaveLength(0);
    expect(mockDaily).toHaveBeenCalled();
  });

  test("bazı tablolar okunamazsa Genel yine çizilir ve uyarı görünür", async () => {
    seed();
    mockFail.add("quick_older");
    await mount();
    expect(texts()).toContain(GAME_BOARDS_COPY.tr.partial);
  });
});

describe("metinler", () => {
  test("beş dil aynı anahtarlar; kurallar dört madde", () => {
    const keys = Object.keys(GAME_BOARDS_COPY.tr).sort();
    Object.values(GAME_BOARDS_COPY).forEach((copy) => {
      expect(Object.keys(copy).sort()).toEqual(keys);
      expect(copy.overallRules).toHaveLength(4);
      expect(copy.overallMeta(3, 1)).not.toMatch(/undefined|NaN/);
    });
  });
});
