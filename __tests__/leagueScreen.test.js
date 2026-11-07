// __tests__/leagueScreen.test.js
//
// Haftalık Lig BAĞLANTISI: servis (services/leagueService) + kanca (hooks/useLeague) + Eğlence kartı
// (components/hub/LeagueWidget) + ekran (screens/fun/LeagueScreen), GERÇEK kurallar ve metinlerle;
// Firestore okumaları ve callable taklit. Saf kurallar: __tests__/leagueRules.test.js.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  ActivityIndicator: "Spinner",
  Platform: { OS: "ios", select: (o) => o.ios ?? o.default },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
const mockHost = (name) => ({ __esModule: true, default: ({ children, ...props }) => require("react").createElement(name, props, children) });
jest.mock("../components/AppIcon", () => mockHost("Icon"));
jest.mock("../components/common/GlassTouchable", () => mockHost("GlassTouchable"));
jest.mock("../components/common/UserAvatar", () => mockHost("Avatar"));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: ({ children }) => require("react").createElement("Gradient", null, children) }));
jest.mock("../components/hub/HubCard", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children, onPress, accessibilityLabel }) => React.createElement("HubCard", { onPress, accessibilityLabel }, children),
    GlassPill: ({ text }) => React.createElement("Pill", null, text),
    HubArrow: () => null,
  };
});
jest.mock("../screens/game/GameScreenShell", () => {
  const React = require("react");
  return { GameScreenShell: ({ title, subtitle, children }) => React.createElement("Shell", { title, subtitle }, children) };
});
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect) => require("react").useEffect(effect, [effect]),
}));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      primary: "#111", secondary: "#1b1b1b", border: "#333", accent: "#3388ff",
      text: { primary: "#fff", secondary: "#bbb", muted: "#888" },
    },
  }),
}));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "me" } }) }));

// Firestore: yol → belge / koleksiyon satırları.
const mockStore = { docs: {}, cols: {}, reads: [] };
const mockCall = jest.fn();
jest.mock("../firebase", () => ({ auth: { currentUser: { uid: "me" } }, db: {}, fns: {} }));
jest.mock("firebase/firestore", () => ({
  doc: (_db, ...parts) => ({ path: parts.join("/") }),
  collection: (_db, ...parts) => ({ path: parts.join("/") }),
  query: (ref) => ref,
  orderBy: () => null,
  limit: () => null,
  getDoc: async (ref) => {
    mockStore.reads.push(ref.path);
    const data = mockStore.docs[ref.path];
    return { exists: () => !!data, data: () => data };
  },
  getDocs: async (ref) => {
    mockStore.reads.push(ref.path);
    const rows = mockStore.cols[ref.path] || [];
    return { forEach: (fn) => rows.forEach((row) => fn({ id: row.uid, data: () => row })) };
  },
}));
jest.mock("firebase/functions", () => ({ httpsCallable: () => (payload) => mockCall(payload) }));

const {
  __resetLeagueMemory,
  awardGameXp,
  awardLeagueXp,
  awardWatchXp,
  fetchLeague,
  isRecentWatch,
  peekLeague,
} = require("../services/leagueService");
const LeagueWidget = require("../components/hub/LeagueWidget").default;
const LeagueScreen = require("../screens/fun/LeagueScreen").default;

const FRI = Date.parse("2026-10-30T12:00:00Z"); // hafta 2026-10-26, pazar gece yarısına 2 gün 9 saat
const GROUP = "LeagueWeeks/2026-10-26/groups/gold-1/leagueMembers";
const members = () =>
  [
    { uid: "a", xp: 300, xpAt: 1, displayNameSnapshot: "Ayşe" },
    { uid: "me", xp: 120, xpAt: 5 },
    { uid: "b", xp: 120, xpAt: 2, displayNameSnapshot: "Bora" },
    { uid: "c", xp: 60, xpAt: 1 },
    { uid: "d", xp: 30, xpAt: 1, displayNameSnapshot: "Deniz" },
    { uid: "e", xp: 15, xpAt: 1, displayNameSnapshot: "Ece" },
  ];

const textOf = (tree) => JSON.stringify(tree.toJSON());
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};
async function render(element) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  await flush();
  return tree;
}

let nowSpy;
beforeEach(() => {
  __resetLeagueMemory();
  mockStore.docs = {};
  mockStore.cols = {};
  mockStore.reads = [];
  mockCall.mockReset();
  nowSpy = jest.spyOn(Date, "now").mockReturnValue(FRI);
});
afterEach(() => nowSpy.mockRestore());

describe("lig ekranı ve kartı", () => {
  test("bu hafta katılan: lig adı, sıra (eşit XP'de önce ulaşan önde), bölgeler, Sen", async () => {
    mockStore.docs["LeagueUsers/me"] = { tier: 2, week: "2026-10-26", groupId: "gold-1", xp: 120 };
    mockStore.cols[GROUP] = members();
    const screen = await render(<LeagueScreen navigation={{ goBack: () => {} }} />);
    const text = textOf(screen);
    expect(text).toContain("Altın Lig");
    expect(text).toContain("6 kişide 3."); // b aynı 120 XP'ye önce ulaştı
    expect(text).toContain("2 gün kaldı");
    expect(text).toContain("Yükselme bölgesi");
    expect(text).toContain("Düşme bölgesi");
    expect(text).toContain("Sen");
    expect(text).toContain("Seelogd oyuncusu"); // adı olmayan satır
    expect(text).toContain("Yükselmek için en az 100 XP gerekir");
    expect(text).toContain("+40 XP · günde en çok 3 kez");

    const navigate = jest.fn();
    const widget = await render(<LeagueWidget navigation={{ navigate }} />);
    expect(textOf(widget)).toContain("6 kişide 3. · 120 XP");
    await act(async () => widget.root.findByType("HubCard").props.onPress());
    expect(navigate).toHaveBeenCalledWith("LeagueScreen");
  });

  test("bu hafta katılmamış: katılma çağrısı + geçen haftanın sonucu, tablo okunmaz", async () => {
    mockStore.docs["LeagueUsers/me"] = {
      tier: 3,
      week: "2026-10-19",
      groupId: "gold-2",
      lastResult: { week: "2026-10-19", fromTier: 2, toTier: 3, outcome: "up", rank: 1, size: 20, xp: 540 },
    };
    const widget = await render(<LeagueWidget navigation={{ navigate: () => {} }} />);
    expect(textOf(widget)).toContain("Yükseldin: Elmas Lig");
    const screen = await render(<LeagueScreen navigation={{ goBack: () => {} }} />);
    const text = textOf(screen);
    expect(text).toContain("Bu haftanın ligi seni bekliyor");
    expect(text).toContain("20 kişide 1. oldun · 540 XP");
    expect(text).not.toContain("Bu haftanın grubu");
    expect(mockStore.reads.filter((p) => p.includes("leagueMembers"))).toEqual([]);
  });

  test("geçen hafta henüz sonuçlanmadıysa 'hesaplanıyor'", async () => {
    mockStore.docs["LeagueUsers/me"] = { tier: 1, week: "2026-10-19", groupId: "silver-4", xp: 200 };
    const widget = await render(<LeagueWidget navigation={{ navigate: () => {} }} />);
    expect(textOf(widget)).toContain("Geçen haftanın sonuçları hesaplanıyor");
  });

  test("hiç kaydı olmayan kullanıcı Bronz'da başlar", async () => {
    const widget = await render(<LeagueWidget navigation={{ navigate: () => {} }} />);
    expect(textOf(widget)).toContain("Bronz Lig");
    expect(textOf(widget)).toContain("ilk XP");
  });
});

describe("XP bildirimi", () => {
  test("aynı olay bir kez gönderilir; yanıt önbellekte kendi satırımı günceller ve yeniden sıralar", async () => {
    mockStore.docs["LeagueUsers/me"] = { tier: 2, week: "2026-10-26", groupId: "gold-1", xp: 120 };
    mockStore.cols[GROUP] = members();
    await fetchLeague("me");
    mockCall.mockResolvedValue({ data: { awarded: 40, xp: 310, tier: 2, groupId: "gold-1", week: "2026-10-26" } });
    await awardLeagueXp("daily", "frame:2026-10-30");
    await awardLeagueXp("daily", "frame:2026-10-30");
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall).toHaveBeenCalledWith({ source: "daily", ref: "frame:2026-10-30" });
    const data = peekLeague("me");
    expect(data.user.xp).toBe(310);
    expect(data.members[0]).toMatchObject({ uid: "me", xp: 310, rank: 1 });
  });

  test("ağ hatası olayı yeniden denenebilir bırakır, oyunu bozmaz", async () => {
    mockCall.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: { awarded: 15 } });
    await expect(awardLeagueXp("game", "quick_older:1")).resolves.toBeNull();
    await expect(awardLeagueXp("game", "quick_older:1")).resolves.toMatchObject({ awarded: 15 });
  });

  test("izleme: yalnız bugün/dün, bölüm ref'i; oyun ref'i temizlenir", async () => {
    mockCall.mockResolvedValue({ data: { awarded: 10 } });
    expect(isRecentWatch("2026-10-30", FRI)).toBe(true);
    expect(isRecentWatch("2026-10-29", FRI)).toBe(true);
    expect(isRecentWatch("2026-10-27", FRI)).toBe(false);
    await awardWatchXp({ type: "tv", id: 1399, season: 1, episode: 3 }, "2026-10-30");
    await awardWatchXp({ type: "movie", id: 550 }, "2020-01-01");
    await awardGameXp("quick_popular", "a/b c");
    expect(mockCall.mock.calls.map(([p]) => p)).toEqual([
      { source: "watch", ref: "tv:1399:s1:e3" },
      { source: "game", ref: "quick_popular:a_b_c" },
    ]);
  });
});
