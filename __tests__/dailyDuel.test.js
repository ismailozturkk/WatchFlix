// __tests__/dailyDuel.test.js
//
// Günlük düello ("Arkadaşa meydan oku"): saf kararlar (utils/dailyDuel.js), sohbet paylaşım türü
// (utils/chatShare.js "challenge"), skor okuma servisi (önbellek / birleştirme), sohbet kartı ve
// "meydan oku" düğmesi — GERÇEK kanca ve çekirdekle, ağ/Firestore/gezinme taklit.
//
// Sabit "bugün": 21 Ekim 2026 12:00 (TR günü 2026-10-21).

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  LayoutAnimation: { configureNext: () => {}, Presets: { easeInEaseOut: {} } },
  Platform: { OS: "ios" },
  UIManager: {},
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
const mockHost = (name) => ({ __esModule: true, default: ({ children, ...props }) => require("react").createElement(name, props, children) });
jest.mock("../components/AppIcon", () => mockHost("Icon"));
jest.mock("../components/common/GlassPressable", () => mockHost("GlassPressable"));
jest.mock("../components/chat/ShareToChatSheet", () => mockHost("Sheet"));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return {
    useNavigation: () => ({ navigate: mockNavigate }),
    // Odaklanma = bağlandığında bir kez çalış (sohbet ekranı açıkken).
    useFocusEffect: (callback) => React.useEffect(callback, [callback]),
  };
});

const mockTrack = jest.fn();
jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: { DUEL_SENT: "duel_sent", DUEL_ACCEPTED: "duel_accepted" },
  trackEvent: (...args) => mockTrack(...args),
}));
const mockHaptic = jest.fn();
jest.mock("../services/hapticsService", () => ({ triggerHaptic: (...args) => mockHaptic(...args) }));

let mockLang = "tr";
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", between: "#222222", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
let mockUser = { uid: "me", displayName: "Ayşe Yılmaz" };
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));

const mockShowUpsell = jest.fn();
let mockGamesAllowed = true;
jest.mock("../hooks/usePremiumGate", () => ({
  usePremiumGate: () => ({ allows: () => mockGamesAllowed, showUpsell: (...args) => mockShowUpsell(...args) }),
}));

const mockFetchRows = jest.fn();
jest.mock("../services/sceneGameService", () => ({ fetchDailyFriendRows: (...args) => mockFetchRows(...args) }));

const fs = require("fs");
const path = require("path");
const {
  compareDayKeys, duelOutcome, duelPayloadFromResult, formatDuelScore, scoresFromRows,
} = require("../utils/dailyDuel");
const { DUEL_COPY, getDuelCopy } = require("../utils/dailyDuelCopy");
const {
  SHARE_KIND, SHARE_TYPE, buildChallengeShare, buildShareMessage, readShare, sanitizeShare, shareMessageText,
  sharePreview, shareThumb,
} = require("../utils/chatShare");
const { loadDuelScores, __resetDuelCache } = require("../services/dailyDuelService");
const SharedChallengeMessage = require("../components/chat/SharedChallengeMessage").default;
const DuelSendButton = require("../components/game/DuelSendButton").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = "2026-10-21";
let renderer;
let warn;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-21T12:00:00+03:00"));
  [mockNavigate, mockTrack, mockHaptic, mockShowUpsell, mockFetchRows].forEach((fn) => fn.mockReset());
  __resetDuelCache();
  mockLang = "tr";
  mockUser = { uid: "me", displayName: "Ayşe Yılmaz" };
  mockGamesAllowed = true;
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

describe("duelOutcome", () => {
  test("bugün + oynamamış → open; geçmiş gün + oynamamış → expired; gelecek gün da expired (oynanamaz)", () => {
    expect(duelOutcome({ dayKey: TODAY, today: TODAY, mine: null, host: 5000 })).toEqual({ phase: "open", verdict: null, diff: 0 });
    expect(duelOutcome({ dayKey: "2026-10-20", today: TODAY, mine: null, host: 5000 }).phase).toBe("expired");
    expect(duelOutcome({ dayKey: "2026-10-23", today: TODAY, mine: null, host: 5000 }).phase).toBe("expired");
  });

  test("oynamış → played; kazan / kaybet / beraberlik ve fark", () => {
    expect(duelOutcome({ dayKey: TODAY, today: TODAY, mine: 8000, host: 7000 })).toEqual({ phase: "played", verdict: "win", diff: 1000 });
    expect(duelOutcome({ dayKey: TODAY, today: TODAY, mine: 6500, host: 7000 })).toEqual({ phase: "played", verdict: "lose", diff: 500 });
    expect(duelOutcome({ dayKey: TODAY, today: TODAY, mine: 7000, host: 7000 })).toEqual({ phase: "played", verdict: "tie", diff: 0 });
  });

  test("geçmiş günü oynamış alıcı karşılaştırmayı yine görür; 0 puan 'oynamadı' DEĞİLDİR", () => {
    expect(duelOutcome({ dayKey: "2026-10-01", today: TODAY, mine: 3000, host: 2000 }).verdict).toBe("win");
    expect(duelOutcome({ dayKey: TODAY, today: TODAY, mine: 0, host: 100 })).toEqual({ phase: "played", verdict: "lose", diff: 100 });
  });

  test("gönderenin skoru bilinmiyorsa karşılaştırma yok ama oynadığı bellidir", () => {
    expect(duelOutcome({ dayKey: TODAY, today: TODAY, mine: 5000, host: null })).toEqual({ phase: "played", verdict: null, diff: 0 });
  });

  test("gün anahtarı sırası ve skor biçimi", () => {
    expect(compareDayKeys("2026-10-20", "2026-10-21")).toBe(-1);
    expect(compareDayKeys("2026-10-21", "2026-10-21")).toBe(0);
    expect(formatDuelScore(7450.6)).toBe("7451");
    expect(formatDuelScore(-5)).toBe("0");
    expect(formatDuelScore("çöp")).toBe("0");
  });
});

describe("scoresFromRows / duelPayloadFromResult", () => {
  test("uid'ye göre eşler; satır yoksa null", () => {
    const rows = [{ uid: "me", bestScore: 4000 }, { uid: "host", bestScore: "5200" }];
    expect(scoresFromRows(rows, { myUid: "me", hostUid: "host" })).toEqual({ mine: 4000, host: 5200 });
    expect(scoresFromRows(rows, { myUid: "me", hostUid: "baska" })).toEqual({ mine: 4000, host: null });
    expect(scoresFromRows([], { myUid: "me", hostUid: "host" })).toEqual({ mine: null, host: null });
    expect(scoresFromRows(null, { myUid: "me" })).toEqual({ mine: null, host: null });
    expect(scoresFromRows([{ uid: "me", bestScore: "x" }], { myUid: "me" }).mine).toBeNull();
  });

  test("sonuçtan kart gövdesi; sonuç ya da gün yoksa null", () => {
    expect(duelPayloadFromResult({ score: 7000, correct: 8, total: 10 }, { dayKey: TODAY, host: "Ayşe" }))
      .toEqual({ dayKey: TODAY, score: 7000, correct: 8, total: 10, host: "Ayşe" });
    expect(duelPayloadFromResult({ score: 7000, totalCorrect: 6, totalWrong: 4 }, { dayKey: TODAY }))
      .toMatchObject({ correct: 6, total: 10 });
    expect(duelPayloadFromResult(null, { dayKey: TODAY })).toBeNull();
    expect(duelPayloadFromResult({ score: 7000 }, {})).toBeNull();
    expect(duelPayloadFromResult({ score: -1 }, { dayKey: TODAY })).toBeNull();
  });
});

describe("sohbet paylaşım türü: challenge", () => {
  const share = (over = {}) => buildChallengeShare({ dayKey: TODAY, score: 7450, correct: 8, total: 10, host: "Ali", ...over });

  test("geçerli gövde: alanlar temizlenir ve kind eşleşir", () => {
    expect(share()).toEqual({ v: 1, type: "challenge", dayKey: TODAY, score: 7450, correct: 8, total: 10, host: "Ali" });
    const message = buildShareMessage(share());
    expect(message.kind).toBe(SHARE_KIND.CHALLENGE);
    expect(message.kind).toBe("challengeShare");
    expect(readShare({ kind: message.kind, share: message.share })).toEqual(share());
  });

  test("geçersiz gün ya da skor → null (uydurma kart gitmez)", () => {
    expect(share({ dayKey: "21-10-2026" })).toBeNull();
    expect(share({ dayKey: "2026-13-01" })).toBeNull();
    expect(share({ dayKey: undefined })).toBeNull();
    expect(share({ score: -1 })).toBeNull();
    expect(share({ score: "çöp" })).toBeNull();
    expect(share({ score: undefined })).toBeNull();
    expect(sanitizeShare({ type: "challenge" })).toBeNull();
  });

  test("sınırlar: skor tavanı, doğru ≤ toplam, toplam 1–50, ad kırpılır", () => {
    expect(share({ score: 9e9 }).score).toBe(100000);
    expect(share({ correct: 99, total: 10 }).correct).toBe(10);
    expect(share({ total: 0 }).total).toBe(10); // 0 → varsayılan 10
    expect(share({ total: 500 }).total).toBe(50);
    expect(share({ correct: -4 }).correct).toBe(0);
    expect(share({ host: "  ".padEnd(100, "x") }).host.length).toBeLessThanOrEqual(40);
    expect("host" in share({ host: "   " })).toBe(false);
    expect(share({ score: 7450.6 }).score).toBe(7451);
  });

  test("kind ile gövde türü tutarsızsa gösterilmez", () => {
    expect(readShare({ kind: "tasteMatchShare", share: share() })).toBeNull();
    expect(readShare({ kind: "challengeShare", share: { ...share(), type: "tasteMatch" } })).toBeNull();
  });

  test("önizleme, mesaj metni ve alıntı küçük resmi", () => {
    // Dil, testte i18n ortamından gelir; burada puanın yer tutucuyla basıldığı ve simge önekinin eklendiği sınanır.
    expect(sharePreview(share())).toMatch(/7450/);
    expect(sharePreview(share())).not.toMatch(/\{\{n\}\}/);
    expect(shareMessageText(share())).toBe(`⚔️ ${sharePreview(share())}`);
    expect(shareThumb(share())).toBeNull();
    expect(SHARE_TYPE.CHALLENGE).toBe("challenge");
  });

  test("çeviri anahtarı beş dilde var ve {{n}} taşıyor", () => {
    for (const lang of ["tr", "en", "es", "pt", "de"]) {
      const json = JSON.parse(fs.readFileSync(path.join(__dirname, `../translations/${lang}.json`), "utf8"));
      expect(json.autoI18n.paylas_meydan_onizleme).toContain("{{n}}");
    }
  });
});

describe("dailyDuelService", () => {
  test("tek sorguyla iki uid; skorlar eşlenir", async () => {
    mockFetchRows.mockResolvedValue([{ uid: "me", bestScore: 4000 }, { uid: "host", bestScore: 5000 }]);
    await expect(loadDuelScores({ dayKey: TODAY, myUid: "me", hostUid: "host" })).resolves.toEqual({ mine: 4000, host: 5000 });
    expect(mockFetchRows).toHaveBeenCalledTimes(1);
    expect(mockFetchRows).toHaveBeenCalledWith(TODAY, ["me", "host"]);
  });

  test("eşzamanlı istekler birleşir; kısa süre önbellekten; force atlar", async () => {
    mockFetchRows.mockResolvedValue([]);
    await Promise.all([
      loadDuelScores({ dayKey: TODAY, myUid: "me", hostUid: "host" }),
      loadDuelScores({ dayKey: TODAY, myUid: "me", hostUid: "host" }),
    ]);
    expect(mockFetchRows).toHaveBeenCalledTimes(1);
    await loadDuelScores({ dayKey: TODAY, myUid: "me", hostUid: "host" });
    expect(mockFetchRows).toHaveBeenCalledTimes(1); // önbellek
    await loadDuelScores({ dayKey: TODAY, myUid: "me", hostUid: "host", force: true });
    expect(mockFetchRows).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(16000);
    await loadDuelScores({ dayKey: TODAY, myUid: "me", hostUid: "host" });
    expect(mockFetchRows).toHaveBeenCalledTimes(3); // süre doldu
  });

  test("hata önbelleğe alınmaz ve yukarı fırlar", async () => {
    mockFetchRows.mockRejectedValueOnce(new Error("ağ")).mockResolvedValueOnce([{ uid: "me", bestScore: 1 }]);
    await expect(loadDuelScores({ dayKey: TODAY, myUid: "me", hostUid: "host" })).rejects.toThrow("ağ");
    await expect(loadDuelScores({ dayKey: TODAY, myUid: "me", hostUid: "host" })).resolves.toEqual({ mine: 1, host: null });
  });

  test("uid ya da gün yoksa sorgu atılmaz", async () => {
    await expect(loadDuelScores({ dayKey: TODAY, myUid: null, hostUid: "host" })).resolves.toEqual({ mine: null, host: null });
    await expect(loadDuelScores({ dayKey: null, myUid: "me" })).resolves.toEqual({ mine: null, host: null });
    expect(mockFetchRows).not.toHaveBeenCalled();
  });
});

describe("sohbet kartı", () => {
  const card = (over = {}) => buildChallengeShare({ dayKey: TODAY, score: 7450, correct: 8, total: 10, host: "Ali", ...over });
  const mount = async (props = {}) => {
    await act(async () => {
      renderer = create(<SharedChallengeMessage share={card()} senderUid="host" {...props} />);
    });
  };
  const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
  const has = (value) => texts().includes(value);
  const accept = () => renderer.root.findAllByType("GlassPressable").find((n) => n.props.accessibilityLabel === DUEL_COPY.tr.accept);

  test("bugün + oynamamış: gönderenin skoru, 'kabul et' düğmesi; basınca günlük oyun açılır", async () => {
    mockFetchRows.mockResolvedValue([{ uid: "host", bestScore: 7450 }]);
    await mount();
    expect(has(DUEL_COPY.tr.titleIn("Ali"))).toBe(true);
    expect(has("7450")).toBe(true);
    expect(has(DUEL_COPY.tr.correct(8, 10))).toBe(true);
    expect(accept()).toBeDefined();
    act(() => accept().props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith("SceneGamePlayScreen", {
      gameId: "scene_guess", modeId: "daily", difficultyId: "normal", sourceId: "daily",
    });
    expect(mockTrack).toHaveBeenCalledWith("duel_accepted", { locked: false });
  });

  test("sohbetten kabul: oyun düello bağlamıyla açılır, bildirim kaydı da kabul edilir", async () => {
    mockFetchRows.mockResolvedValue([{ uid: "host", bestScore: 7450 }]);
    const onAccepted = jest.fn();
    const chatTarget = { friendUid: "host", friendName: "Ali" };
    await mount({ chatTarget, onAccepted });
    act(() => accept().props.onPress());
    expect(onAccepted).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("SceneGamePlayScreen", {
      gameId: "scene_guess",
      modeId: "daily",
      difficultyId: "normal",
      sourceId: "daily",
      duel: { dayKey: TODAY, hostUid: "host", hostName: "Ali", chat: chatTarget },
    });
  });

  test("planda oyun yoksa 'kabul et' yükseltme sayfasını açar, oyunu açmaz", async () => {
    mockGamesAllowed = false;
    mockFetchRows.mockResolvedValue([]);
    await mount();
    act(() => accept().props.onPress());
    expect(mockShowUpsell).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith("duel_accepted", { locked: true });
  });

  test("oynamış alıcı: iki skor yan yana, DOĞRULANMIŞ skor karttakini ezer; kazandın", async () => {
    // Kart 9999 diyor ama tablo gönderenin 7000 yaptığını söylüyor.
    mockFetchRows.mockResolvedValue([{ uid: "me", bestScore: 8200 }, { uid: "host", bestScore: 7000 }]);
    await mount({ share: card({ score: 9999 }) });
    expect(has("8200")).toBe(true);
    expect(has("7000")).toBe(true);
    expect(has("9999")).toBe(false);
    expect(has(DUEL_COPY.tr.win("1200"))).toBe(true);
    expect(accept()).toBeUndefined(); // oynadı → kabul düğmesi yok
  });

  test("geride kaldın ve berabere", async () => {
    mockFetchRows.mockResolvedValue([{ uid: "me", bestScore: 5000 }, { uid: "host", bestScore: 7000 }]);
    await mount();
    expect(has(DUEL_COPY.tr.lose("2000"))).toBe(true);
    act(() => renderer.unmount());
    renderer = null;
    __resetDuelCache();
    mockFetchRows.mockResolvedValue([{ uid: "me", bestScore: 7000 }, { uid: "host", bestScore: 7000 }]);
    await mount();
    expect(has(DUEL_COPY.tr.tie)).toBe(true);
  });

  test("gün geçmiş + oynamamış: 'artık oynanamıyor', düğme yok; gönderenin skoru görünür", async () => {
    mockFetchRows.mockResolvedValue([]);
    await mount({ share: card({ dayKey: "2026-10-20" }) });
    expect(has(DUEL_COPY.tr.expired)).toBe(true);
    expect(has("7450")).toBe(true);
    expect(accept()).toBeUndefined();
  });

  test("tablo okunamadı: karttaki skor ve 'kabul et' yine de görünür, karşılaştırma yok", async () => {
    mockFetchRows.mockRejectedValue(new Error("izin"));
    await mount();
    expect(has("7450")).toBe(true);
    expect(accept()).toBeDefined();
    expect(texts().some((t) => t.includes("VS"))).toBe(false);
  });

  test("kontrol sürerken 'kontrol ediliyor' görünür ve düğme beklenir", async () => {
    let resolve;
    mockFetchRows.mockReturnValue(new Promise((r) => { resolve = r; }));
    await act(async () => { renderer = create(<SharedChallengeMessage share={card()} senderUid="host" />); });
    expect(has(DUEL_COPY.tr.checking)).toBe(true);
    expect(accept()).toBeUndefined();
    await act(async () => { resolve([]); });
    expect(has(DUEL_COPY.tr.checking)).toBe(false);
    expect(accept()).toBeDefined();
  });

  test("gönderenin kendi kartı: sorgu YOK, düğme YOK, 'meydan okudun' başlığı", async () => {
    await mount({ isOutgoing: true });
    expect(mockFetchRows).not.toHaveBeenCalled();
    expect(has(DUEL_COPY.tr.titleOut)).toBe(true);
    expect(has("7450")).toBe(true);
    expect(accept()).toBeUndefined();
  });

  test("adsız kart: anonim başlık; beş dilde metin çizilir", async () => {
    mockFetchRows.mockResolvedValue([]);
    for (const lang of ["tr", "en", "es", "pt", "de"]) {
      mockLang = lang;
      __resetDuelCache();
      await mount({ share: card({ host: undefined }) });
      expect(has(DUEL_COPY[lang].titleInAnon)).toBe(true);
      expect(texts().some((t) => /undefined|NaN/.test(t))).toBe(false);
      act(() => renderer.unmount());
      renderer = null;
    }
  });
});

describe("meydan oku düğmesi", () => {
  const payload = { dayKey: TODAY, score: 7450, correct: 8, total: 10 };
  const mount = (props = {}) => { act(() => { renderer = create(<DuelSendButton payload={payload} theme={mockTheme} {...props} />); }); };

  test("sonuç yoksa hiçbir şey çizilmez", () => {
    mount({ payload: null });
    expect(renderer.toJSON()).toBeNull();
    act(() => renderer.unmount());
    mount({ payload: { ...payload, dayKey: "bozuk" } });
    expect(renderer.toJSON()).toBeNull();
  });

  test("basınca alıcı seçimi açılır; kart gönderenin adıyla kurulur", () => {
    mount({ source: "hub" });
    expect(renderer.root.findByType("Sheet").props.visible).toBe(false);
    const button = renderer.root.findByType("GlassPressable");
    act(() => button.props.onPress());
    const sheet = renderer.root.findByType("Sheet");
    expect(sheet.props.visible).toBe(true);
    expect(sheet.props.share).toMatchObject({ type: "challenge", dayKey: TODAY, score: 7450, host: "Ayşe Yılmaz" });
    expect(mockHaptic).toHaveBeenCalledWith("impact");
  });

  test("alıcı seçilip sayfa kapanınca ölçülür; kapatma sayfayı kapatır", () => {
    mount({ source: "result" });
    act(() => renderer.root.findByType("GlassPressable").props.onPress());
    act(() => renderer.root.findByType("Sheet").props.onSent());
    expect(mockTrack).toHaveBeenCalledWith("duel_sent", { source: "result", score: 7450 });
    act(() => renderer.root.findByType("Sheet").props.onClose());
    expect(renderer.root.findByType("Sheet").props.visible).toBe(false);
  });

  test("beş dilde etiket çizilir", () => {
    for (const lang of ["tr", "en", "es", "pt", "de"]) {
      mockLang = lang;
      mount();
      const texts = renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
      expect(texts).toContain(DUEL_COPY[lang].send);
      act(() => renderer.unmount());
      renderer = null;
    }
  });
});

describe("metin tablosu ve kaynak bekçileri", () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

  test("metin tablosundaki her anahtar bir yerde kullanılıyor", () => {
    const used = [
      read("components/chat/SharedChallengeMessage.js"),
      read("components/chat/SharedDuelResultMessage.js"),
      read("components/game/DuelSendButton.js"),
      read("components/game/DuelReportStatus.js"),
    ].join("\n");
    const unused = Object.keys(DUEL_COPY.tr).filter((key) => !new RegExp(`copy\\.${key}\\b`).test(used));
    expect(unused).toEqual([]);
    expect(getDuelCopy("zz")).toBe(DUEL_COPY.en); // bilinmeyen dil → İngilizce
  });

  test("düğme sonuç ekranına ve Oyunlar modülüne, kart sohbet balonuna bağlı", () => {
    expect(read("screens/game/SceneGameResultScreen.js")).toMatch(/<DuelSendButton[^>]*source="result"/);
    expect(read("components/profile/ProfileGamesModule.js")).toMatch(/<DuelSendButton[^>]*source="hub"/);
    expect(read("components/chat/MessageBubble.js")).toMatch(/<SharedChallengeMessage[^>]*senderUid=\{item\.senderId\}/);
    expect(read("utils/chatReply.js")).toMatch(/"challenge"/);
  });

  test("düello oyun motoruna ve günlük tabloya YAZMAZ (yalnız okur)", () => {
    const service = read("services/dailyDuelService.js");
    expect(service).not.toMatch(/setDoc|addDoc|updateDoc|runTransaction|saveGameScore/);
    expect(read("hooks/useDuelStatus.js")).not.toMatch(/setDoc|addDoc|updateDoc|runTransaction|saveGameScore/);
  });
});
