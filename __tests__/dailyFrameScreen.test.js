// __tests__/dailyFrameScreen.test.js
//
// Günün Karesi BAĞLANTISI: kanca (hooks/useDailyFrame) + ekran (screens/game/DailyFrameScreen) + Eğlence kartı
// (components/game/DailyFrameCard) + sohbet kartı (components/chat/SharedFrameMessage), GERÇEK depo (bellek-içi MMKV)
// ve GERÇEK çekirdekle; bulmaca/arama servisi ve görsel parçalar taklit.

import React from "react";
import { act, create } from "react-test-renderer";

// Haftalık Lig bildirimi (services/leagueService → firebase) bu testin konusu değil.
// Afiş köşesi (Ayarlar > Poster görünümü) burada sınanmıyor: taban köşe aynen döner.
// BetaBadge oy denetimi AuthContext + Firestore yükler; ekran testleri rozeti yalnız yer tutucu olarak çizer.
jest.mock("../components/common/BetaBadge", () => ({ __esModule: true, default: "BetaBadge", DevBadge: "DevBadge", BETA_COLOR: "#F59E0B", DEV_COLOR: "#8B5CF6" }));
jest.mock("../hooks/usePosterCorner", () => () => (base) => base);
jest.mock("../services/leagueService", () => ({
  awardGameXp: jest.fn(),
  awardDailyXp: jest.fn(),
  awardPollVoteXp: jest.fn(),
  awardTop100VoteXp: jest.fn(),
  awardWatchXp: jest.fn(),
}));
jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  ActivityIndicator: "Spinner",
  Keyboard: { dismiss: () => {} },
  Share: { share: (...args) => mockShare(...args) },
  AppState: { addEventListener: () => ({ remove: () => {} }) },
  PixelRatio: { get: () => 2 },
  Platform: { OS: "ios", select: (o) => o.ios ?? o.default },
  UIManager: {},
  LayoutAnimation: { configureNext: () => {}, Presets: {}, Types: {}, Properties: {} },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));
const mockHost = (name) => ({ __esModule: true, default: ({ children, ...props }) => require("react").createElement(name, props, children) });
jest.mock("../components/AppIcon", () => mockHost("Icon"));
jest.mock("../components/common/GlassPressable", () => mockHost("GlassPressable"));
jest.mock("../components/common/GlassField", () => mockHost("GlassField"));
jest.mock("../components/common/GlassSurface", () => ({ useGlassScheme: () => "dark" }));
jest.mock("../components/chat/ShareToChatSheet", () => mockHost("ShareToChatSheet"));
jest.mock("../components/game/ui", () => {
  const React = require("react");
  return { PressableScale: ({ children, ...props }) => React.createElement("Scale", props, children) };
});
jest.mock("../screens/game/GameScreenShell", () => {
  const React = require("react");
  return {
    GameScreenShell: ({ title, subtitle, children }) => React.createElement("Shell", { title, subtitle }, children),
    gameSharedStyles: { primaryButton: {}, primaryButtonText: {}, metricRow: {}, metric: {}, metricValue: {}, metricLabel: {}, sectionTitle: {} },
  };
});
jest.mock("../services/hapticsService", () => ({ triggerHaptic: () => {} }));
// Premium kapısı (registry "daily_frame"): `mockLocked` = Free.
let mockLocked = false;
const mockUpsell = jest.fn();
const mockGateIds = [];
jest.mock("../hooks/usePremiumGate", () => ({
  usePremiumGate: (id) => {
    mockGateIds.push(id);
    return { allows: () => !mockLocked, showUpsell: mockUpsell };
  },
}));
jest.mock("../hooks/usePremiumScreenGuard", () => ({
  __esModule: true,
  default: (id) => {
    mockGateIds.push(id);
    return mockLocked;
  },
}));
const mockTrack = jest.fn();
jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: {
    DAILY_FRAME_STARTED: "daily_frame_started",
    DAILY_FRAME_FINISHED: "daily_frame_finished",
    DAILY_FRAME_SHARED: "daily_frame_shared",
  },
  trackEvent: (...args) => mockTrack(...args),
}));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", between: "#222222", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
let mockUser = { uid: "u1", displayName: "Ben" };
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("../context/AppSettingsContext", () => ({ useApiSettings: () => ({ API_KEY: "key" }) }));

const mockShare = jest.fn(() => Promise.resolve());
const mockNavigation = { navigate: jest.fn(), push: jest.fn(), goBack: jest.fn() };
const mockLoad = jest.fn();
const mockSearch = jest.fn();
jest.mock("../services/dailyFrameService", () => ({
  loadDailyFramePuzzle: (...args) => mockLoad(...args),
  searchFrameMovies: (...args) => mockSearch(...args),
}));

const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const { dayKeyOf } = require("../utils/dailyChallenge");
const { puzzleNumberOf } = require("../utils/dailyFrame");
const { FRAME_COPY } = require("../utils/dailyFrameCopy");
const DailyFrameScreen = require("../screens/game/DailyFrameScreen").default;
const DailyFrameCard = require("../components/game/DailyFrameCard").default;
const SharedFrameMessage = require("../components/chat/SharedFrameMessage").default;

global.IS_REACT_ACT_ENVIRONMENT = true;
const copy = FRAME_COPY.tr;
const today = dayKeyOf();
const PUZZLE = {
  dayKey: today,
  number: puzzleNumberOf(today),
  answerKey: "movie_603",
  id: 603,
  title: "Matrix",
  year: "1999",
  genreIds: [28, 878],
  posterPath: "/matrix.jpg",
  directors: ["Lana Wachowski", "Lilly Wachowski"],
  frames: ["/f1.jpg", "/f2.jpg", "/f3.jpg", "/f4.jpg", "/f5.jpg", "/f6.jpg"],
};
const RESULTS = [
  { key: "movie_27205", id: 27205, title: "Inception", year: "2010", posterPath: null },
  { key: "movie_603", id: 603, title: "Matrix", year: "1999", posterPath: "/matrix.jpg" },
];

let renderer;
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};
const texts = () => renderer.root.findAll((n) => n.type === "Text").map((n) => [].concat(n.props.children).join(""));
const hasText = (value) => texts().some((t) => t.includes(value));
const pressByLabel = (label) => {
  const node = renderer.root.find((n) => n.type === "GlassPressable" && n.props.accessibilityLabel === label);
  act(() => node.props.onPress());
};

const typeAndPick = async (query, label) => {
  const input = renderer.root.findByType("TextInput");
  act(() => input.props.onChangeText(query));
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  await flush();
  pressByLabel(label);
};

beforeEach(() => {
  jest.useFakeTimers();
  __resetAllMMKV();
  __resetStoreCaches();
  __resetStores();
  mockTrack.mockClear();
  mockShare.mockClear();
  mockLocked = false;
  mockUpsell.mockClear();
  mockGateIds.length = 0;
  mockNavigation.navigate.mockClear();
  mockUser = { uid: "u1", displayName: "Ben" };
  mockLoad.mockReset().mockResolvedValue(PUZZLE);
  mockSearch.mockReset().mockResolvedValue(RESULTS);
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  jest.useRealTimers();
});

const mountScreen = async () => {
  act(() => {
    renderer = create(<DailyFrameScreen navigation={mockNavigation} />);
  });
  await flush();
};

test("yüklenir; 1. kare açık, kalanlar kilitli; cevap ekranda hiçbir yerde yok", async () => {
  await mountScreen();
  const tabs = renderer.root.findAll((n) => n.type === "GlassPressable" && /^Kare \d \/ 6$/.test(n.props.accessibilityLabel || ""));
  expect(tabs).toHaveLength(6);
  expect(tabs.filter((t) => !t.props.disabled)).toHaveLength(1);
  expect(hasText(copy.guessesLeft(6))).toBe(true);
  expect(hasText("Matrix")).toBe(false);
  const labels = renderer.root.findAll((n) => typeof n.props.accessibilityLabel === "string").map((n) => n.props.accessibilityLabel);
  expect(labels.some((l) => l.includes("Matrix"))).toBe(false);
});

test("geç + yanlış + doğru: kayıt, seri, olaylar, sonuç paneli ve paylaşım", async () => {
  await mountScreen();
  pressByLabel(copy.skipA11y);
  expect(hasText(copy.guessesLeft(5))).toBe(true);
  expect(mockTrack).toHaveBeenCalledWith("daily_frame_started", { number: PUZZLE.number });

  await typeAndPick("ince", "Inception, 2010");
  expect(hasText("Inception")).toBe(true);
  expect(hasText(copy.guessesLeft(4))).toBe(true);

  // Aynı film ikinci kez: hak yemez, uyarı.
  await typeAndPick("ince", "Inception, 2010");
  expect(hasText(copy.already)).toBe(true);

  await typeAndPick("matr", "Matrix, 1999");
  expect(hasText(copy.wonTitle)).toBe(true);
  expect(hasText(copy.resultBadgeWon(3))).toBe(true);
  expect(mockTrack).toHaveBeenCalledWith("daily_frame_finished", { number: PUZZLE.number, won: true, guesses: 3 });

  const stored = get(Keys.dailyFrame, { uid: "u1" });
  expect(stored.rounds[today].status).toBe("won");
  expect(stored.stats).toMatchObject({ played: 1, won: 1, streak: 1 });
  expect(stored.stats.dist).toEqual([0, 0, 1, 0, 0, 0]);

  const sheet = renderer.root.findByType("ShareToChatSheet");
  expect(sheet.props.share).toMatchObject({ type: "frame", number: PUZZLE.number, marks: ["skip", "miss", "hit", "empty", "empty", "empty"] });
  expect(JSON.stringify(sheet.props.share)).not.toMatch(/Matrix|603/);

  const shareButton = renderer.root.find((n) => n.type === "GlassPressable" && n.findAll((c) => c.type === "Text" && c.props.children === copy.shareOut).length > 0);
  act(() => shareButton.props.onPress());
  expect(mockShare).toHaveBeenCalledWith({ message: `Seelogd · Günün Karesi #${PUZZLE.number}\n🎬 ⬜ 🟥 🟩 ⬛ ⬛ ⬛` });
});

test("yarıda kalan oyun yeniden açılınca kaldığı kareden sürer; kart 'Devam et' der", async () => {
  await mountScreen();
  pressByLabel(copy.skipA11y);
  pressByLabel(copy.skipA11y);
  act(() => renderer.unmount());
  renderer = null;
  await mountScreen();
  expect(hasText(copy.guessesLeft(4))).toBe(true);
  act(() => renderer.unmount());

  act(() => {
    renderer = create(<DailyFrameCard onPlay={() => {}} />);
  });
  expect(hasText(copy.resume)).toBe(true);
  expect(hasText(copy.guessesLeft(4))).toBe(true);
});

test("ipucu çipleri sırayla: 3. kare tür, 4. yıl, 5. yönetmen, 6. baş harf", async () => {
  await mountScreen();
  const labels = [copy.hintGenres, copy.hintYear, copy.hintDirector, copy.hintInitial];
  const chipLabels = () => texts().filter((t) => labels.includes(t));
  pressByLabel(copy.skipA11y);
  expect(chipLabels()).toEqual([]);
  pressByLabel(copy.skipA11y);
  expect(chipLabels()).toEqual([copy.hintGenres]);
  expect(hasText("Aksiyon · Bilim kurgu")).toBe(true);
  pressByLabel(copy.skipA11y);
  expect(chipLabels()).toEqual([copy.hintGenres, copy.hintYear]);
  expect(hasText("1999")).toBe(true);
  expect(hasText("Lana Wachowski")).toBe(false);
  pressByLabel(copy.skipA11y);
  expect(chipLabels()).toEqual([copy.hintGenres, copy.hintYear, copy.hintDirector]);
  expect(hasText("Lana Wachowski, Lilly Wachowski")).toBe(true);
  expect(hasText("M…")).toBe(false);
  pressByLabel(copy.skipA11y);
  expect(chipLabels()).toEqual(labels);
  expect(hasText("M…")).toBe(true);
});

test("sonuç ekranı: adım adım her karede ne seçildiği ve açılan ipucu; satıra dokununca kare büyür", async () => {
  await mountScreen();
  pressByLabel(copy.skipA11y);
  await typeAndPick("ince", "Inception, 2010");
  await typeAndPick("matr", "Matrix, 1999");

  expect(hasText(copy.stepsTitle)).toBe(true);
  expect(hasText(copy.resultBadgeWon(3))).toBe(true);
  expect(hasText("1999 · Lana Wachowski, Lilly Wachowski")).toBe(true);
  // Adım satırları: 1 geçildi, 2 yanlış (afiş + yıl), 3 doğru, 4–6 kullanılmadı.
  const stepLabels = renderer.root
    .findAll((n) => n.type === "GlassPressable" && typeof n.props.accessibilityHint === "string")
    .map((n) => n.props.accessibilityLabel);
  expect(stepLabels).toEqual([
    `${copy.stepFrame(1)}. ${copy.stepSkipped}`,
    `${copy.stepFrame(2)}. Inception, ${copy.stepWrong}`,
    `${copy.stepFrame(3)}. Matrix, ${copy.stepRight}`,
    `${copy.stepFrame(4)}. ${copy.stepUnused}`,
    `${copy.stepFrame(5)}. ${copy.stepUnused}`,
    `${copy.stepFrame(6)}. ${copy.stepUnused}`,
  ]);
  expect(hasText("Inception · 2010")).toBe(true);
  expect(hasText(copy.stepHint(copy.hintGenres))).toBe(true);
  expect(hasText(copy.stepHint(copy.hintInitial))).toBe(true);

  // Büyük kare bilinen kareyle (3.) açılır; 1. adıma dokununca 1. kare.
  const heroImage = () => renderer.root.findAll((n) => n.type === "Image" && /\/f\d\.jpg/.test(n.props.source?.uri || ""))[0];
  expect(heroImage().props.source.uri).toContain("/f3.jpg");
  pressByLabel(`${copy.stepFrame(1)}. ${copy.stepSkipped}`);
  expect(heroImage().props.source.uri).toContain("/f1.jpg");
  expect(hasText(copy.stepFrame(1))).toBe(true);
});

test("bulmaca yüklenemezse hata + tekrar dene", async () => {
  mockLoad.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "frame_unavailable" }));
  await mountScreen();
  expect(hasText(copy.error)).toBe(true);
  const retry = renderer.root.find((n) => n.type === "GlassPressable" && n.findAll((c) => c.type === "Text" && c.props.children === copy.retry).length > 0);
  act(() => retry.props.onPress());
  await flush();
  expect(hasText(copy.guessesLeft(6))).toBe(true);
});

test("sohbet kartı: alıcı oynamadıysa mesajda doğrudan 'Oyna', geçmiş günde kapandı, gönderende eylem yok", () => {
  const share = { v: 1, type: "frame", dayKey: today, number: PUZZLE.number, marks: ["miss", "hit", "empty", "empty", "empty", "empty"], host: "Ali" };
  act(() => {
    renderer = create(<SharedFrameMessage share={share} />);
  });
  expect(hasText(copy.chatPlay)).toBe(true);
  expect(copy.chatPlay).toBe("Oyna");
  expect(hasText(copy.chatNotPlayed)).toBe(true);
  expect(hasText("2/6")).toBe(true);
  expect(hasText(copy.chatWonBy(2))).toBe(true);
  const play = renderer.root.find((n) => n.type === "GlassPressable");
  act(() => play.props.onPress());
  expect(mockNavigation.navigate).toHaveBeenCalledWith("DailyFrameScreen");

  act(() => renderer.update(<SharedFrameMessage share={{ ...share, dayKey: "2026-10-30" === today ? "2026-10-29" : "2026-10-30" }} />));
  expect(hasText(copy.chatExpired)).toBe(true);

  act(() => renderer.update(<SharedFrameMessage share={share} isOutgoing />));
  expect(renderer.root.findAll((n) => n.type === "GlassPressable")).toHaveLength(0);
});

test("sohbet kartı: yarıda bırakan 'Devam et' görür, bitiren kendi skorunu yan yana görür", async () => {
  const share = { v: 1, type: "frame", dayKey: today, number: PUZZLE.number, marks: ["hit", "empty", "empty", "empty", "empty", "empty"] };
  await mountScreen();
  pressByLabel(copy.skipA11y);
  act(() => renderer.unmount());
  act(() => {
    renderer = create(<SharedFrameMessage share={share} />);
  });
  expect(hasText(copy.chatResume)).toBe(true);
  expect(hasText(copy.chatInProgress)).toBe(true);
  act(() => renderer.unmount());

  await mountScreen();
  await typeAndPick("matr", "Matrix, 1999");
  act(() => renderer.unmount());
  act(() => {
    renderer = create(<SharedFrameMessage share={share} />);
  });
  expect(hasText(copy.chatYou)).toBe(true);
  expect(hasText("1/6")).toBe(true);
  expect(hasText("2/6")).toBe(true);
  expect(renderer.root.findAll((n) => n.type === "GlassPressable")).toHaveLength(0);
});

describe("Premium kapısı (daily_frame)", () => {
  test("kilitliyken ekran bulmacayı hiç yüklemez, yalnız kabuk çizer", async () => {
    mockLocked = true;
    await mountScreen();
    expect(mockLoad).not.toHaveBeenCalled();
    expect(renderer.root.findAll((n) => n.type === "TextInput")).toHaveLength(0);
    expect(mockGateIds).toContain("daily_frame");
  });

  test("kilitli kart 'Premium' der; açıkken oyna metni", () => {
    act(() => {
      renderer = create(<DailyFrameCard locked onPlay={() => {}} />);
    });
    expect(hasText("Premium")).toBe(true);
    expect(hasText(copy.play)).toBe(false);
    act(() => renderer.update(<DailyFrameCard onPlay={() => {}} />));
    expect(hasText(copy.play)).toBe(true);
  });

  test("sohbet kartında Free alıcı 'Oyna'ya basınca yükseltme açılır, ekrana gidilmez", () => {
    mockLocked = true;
    const share = { v: 1, type: "frame", dayKey: today, number: PUZZLE.number, marks: ["hit", "empty", "empty", "empty", "empty", "empty"] };
    act(() => {
      renderer = create(<SharedFrameMessage share={share} />);
    });
    expect(hasText(copy.chatPlay)).toBe(true);
    act(() => renderer.root.find((n) => n.type === "GlassPressable").props.onPress());
    expect(mockUpsell).toHaveBeenCalledTimes(1);
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(mockGateIds).toContain("daily_frame");
  });
});
