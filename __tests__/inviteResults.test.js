// __tests__/inviteResults.test.js
//
// Kabul edilen davetin SONUCU davetin geldiği sohbete düşer:
//   • günlük düello → kabul eden oyunu bitirince "düello sonucu" kartı (iki skor, izleyicinin gözünden)
//   • CineSwipe odası → ortak eşleşmeler kaydedilebilir liste kartı + cihazdaki "Geçmiş turlar"
// Saf kararlar (utils/importantInvites, utils/dailyDuel, utils/chatShare), sohbete yazım servisi
// (services/chatOutbox — Firestore taklit), sonuç kartı ve sonuç ekranı kancası, CineSwipe geçmiş deposu.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFill: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  ActivityIndicator: "Spinner",
  LayoutAnimation: { configureNext: () => {}, Presets: { easeInEaseOut: {} } },
  Platform: { OS: "ios" },
  UIManager: {},
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
// i18n paketi depoyu okur (aşağıda taklit): metinler Türkçe yedekten, yer tutucular doldurulur.
jest.mock("../utils/i18nText", () => ({
  i18nText: (_key, fallback, params) =>
    Object.entries(params || {}).reduce((text, [name, value]) => text.replace(`{{${name}}}`, String(value)), fallback),
}));
jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return { useFocusEffect: (callback) => React.useEffect(callback, [callback]) };
});

let mockUser = { uid: "guest", displayName: "Ayşe" };
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: { between: "#222", border: "#333", text: { primary: "#fff", secondary: "#bbb", muted: "#888" } } }),
}));
jest.mock("../context/UserProfileContext", () => ({ useUserProfile: () => ({ displayName: "Ayşe Y." }) }));

const mockLoadScores = jest.fn();
const mockNotifyScores = jest.fn();
jest.mock("../services/dailyDuelService", () => ({
  loadDuelScores: (...args) => mockLoadScores(...args),
  notifyDuelScores: (...args) => mockNotifyScores(...args),
}));
const mockPost = jest.fn();
jest.mock("../hooks/useChatOutbox", () => ({ __esModule: true, default: () => mockPost }));

// ── Firestore taklidi (services/chatOutbox) ──
const mockBatches = [];
const mockGroups = new Map();
const mockInbox = new Map(); // Users/me/notifications/{id} → kayıt
jest.mock("firebase/firestore", () => ({
  query: (ref, ...clauses) => ({ ref, clauses }),
  where: (field, op, value) => ({ field, op, value }),
  limit: (n) => ({ limit: n }),
  getDocs: async ({ clauses }) => {
    const { value } = clauses.find((clause) => clause.field === "fromUid");
    const docs = [...mockInbox.entries()]
      .filter(([, data]) => data.fromUid === value)
      .map(([id, data]) => ({ id, data: () => data }));
    return { docs };
  },
  runTransaction: async (_db, fn) =>
    fn({
      get: async (ref) => {
        const id = ref.split("/").pop();
        const data = ref.includes("/notifications/") ? mockInbox.get(id) : { unreadNotifsCount: 1 };
        return { exists: () => !!data, data: () => data };
      },
      update: (ref, patch) => {
        const id = ref.split("/").pop();
        if (ref.includes("/notifications/")) mockInbox.set(id, { ...mockInbox.get(id), ...patch });
      },
    }),
  doc: (first, ...parts) => (typeof first === "string" ? `${first}/auto` : parts.join("/")),
  collection: (_db, ...parts) => parts.join("/"),
  getDoc: async (ref) => ({ exists: () => mockGroups.has(ref), data: () => mockGroups.get(ref) }),
  increment: (n) => ({ increment: n }),
  serverTimestamp: () => "NOW",
  writeBatch: () => {
    const batch = { sets: [], set: (ref, data, opts) => batch.sets.push({ ref, data, opts }), commit: jest.fn(async () => {}) };
    mockBatches.push(batch);
    return batch;
  },
}));
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../services/usageTrackerService", () => ({ trackFirestoreRead: jest.fn() }));
const mockQueueGroupUnread = jest.fn();
jest.mock("../services/groupsService", () => ({ queueGroupUnreadIncrements: (...args) => mockQueueGroupUnread(...args) }));

// ── Yerel depo taklidi (CineSwipe geçmişi) ──
const mockStore = new Map();
jest.mock("../services/storage", () => ({
  Keys: { cineLastResult: "last", cineResultHistory: "history" },
  get: (key, { uid }) => mockStore.get(`${key}:${uid}`),
  set: (key, value, { uid }) => {
    mockStore.set(`${key}:${uid}`, value);
    return true;
  },
}));
jest.mock("../services/cineswipe/cineswipeService", () => ({ acknowledgeCineResults: jest.fn() }));

const { buildDuelResultShare, buildListShare, buildShareMessage, readShare, sharePreview } = require("../utils/chatShare");
const {
  chatTargetOf,
  duelContextOf,
  invitationDestination,
  matchingInvitationIds,
} = require("../utils/importantInvites");
const { duelResultView } = require("../utils/dailyDuel");
const { DUEL_COPY } = require("../utils/dailyDuelCopy");
const { directChatId, postShareToChat } = require("../services/chatOutbox");
const { respondMatchingInvitations } = require("../services/notificationsService");
const { readCineHistory, recordCineHistory, MAX_CINE_HISTORY } = require("../services/cineswipe/cineResultsStore");
const SharedDuelResultMessage = require("../components/chat/SharedDuelResultMessage").default;
const useDuelResultReport = require("../hooks/useDuelResultReport").default;
const { __resetDuelReports } = require("../hooks/useDuelResultReport");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const TODAY = "2026-10-24";
const now = new Date("2026-10-24T12:00:00Z").getTime();

beforeEach(() => {
  jest.clearAllMocks();
  mockBatches.length = 0;
  mockGroups.clear();
  mockInbox.clear();
  mockStore.clear();
  mockUser = { uid: "guest", displayName: "Ayşe" };
  __resetDuelReports();
});

describe("davetin sohbeti ve hedefler", () => {
  test("grup daveti gruba, 1-1 davet gönderenle sohbete döner", () => {
    expect(chatTargetOf({ groupId: "g1", groupName: "Sinema", fromUid: "ali" })).toEqual({ groupId: "g1", groupName: "Sinema" });
    expect(chatTargetOf({ fromUid: "ali", fromName: "Ali" })).toEqual({ friendUid: "ali", friendName: "Ali" });
    expect(chatTargetOf({})).toBeNull();
  });

  test("üst bardan kabul: CineSwipe sohbeti, düello bağlamı taşır", () => {
    jest.useFakeTimers().setSystemTime(now);
    expect(invitationDestination({ type: "cineswipe_invite", inviteCode: "123456", fromUid: "ali", fromName: "Ali" }).params).toEqual({
      initialMode: "duo",
      inviteCode: "123456",
      autoJoin: true,
      inviteChat: { friendUid: "ali", friendName: "Ali" },
    });
    expect(invitationDestination({ type: "game_challenge", dayKey: TODAY, fromUid: "ali", fromName: "Ali", groupId: "g1", groupName: "Sinema" }).params.duel).toEqual({
      dayKey: TODAY,
      hostUid: "ali",
      hostName: "Ali",
      chat: { groupId: "g1", groupName: "Sinema" },
    });
    jest.useRealTimers();
  });

  test("bağlam eksikse düello bağlamı yok (oyun yine açılır)", () => {
    expect(duelContextOf({ dayKey: TODAY, hostUid: "ali", chat: null })).toBeNull();
    expect(duelContextOf({ dayKey: TODAY, chat: { friendUid: "ali" } })).toBeNull();
  });

  test("karttan kabul: yalnız aynı gönderen + kod/gün + grubun bekleyen kaydı eşleşir", () => {
    const items = [
      { id: "a", type: "cineswipe_invite", fromUid: "ali", inviteCode: "123456", createdAt: now - 1000 },
      { id: "b", type: "cineswipe_invite", fromUid: "ali", inviteCode: "999999", createdAt: now - 1000 },
      { id: "c", type: "cineswipe_invite", fromUid: "ali", inviteCode: "123456", createdAt: now - 1000, groupId: "g1" },
      { id: "d", type: "cineswipe_invite", fromUid: "ali", inviteCode: "123456", createdAt: now - 1000, response: "declined" },
      { id: "e", type: "game_challenge", fromUid: "ali", dayKey: "2026-10-24" },
    ];
    expect(matchingInvitationIds(items, { type: "cineswipe_invite", fromUid: "ali", inviteCode: "123456" }, now)).toEqual(["a"]);
    expect(matchingInvitationIds(items, { type: "cineswipe_invite", fromUid: "ali", inviteCode: "123456", groupId: "g1" }, now)).toEqual(["c"]);
    expect(matchingInvitationIds(items, { type: "game_challenge", fromUid: "ali", dayKey: "2026-10-24" }, now)).toEqual(["e"]);
    expect(matchingInvitationIds(items, { type: "game_challenge", fromUid: "veli", dayKey: "2026-10-24" }, now)).toEqual([]);
  });

  test("mesaj kimliği taşıyan kayıt yalnız KENDİ kartıyla eşleşir; kimliksiz eski kayıt alanlarla eşleşir", () => {
    const items = [
      { id: "a", type: "game_challenge", fromUid: "ali", dayKey: "2026-10-24", messageId: "m1" },
      { id: "b", type: "game_challenge", fromUid: "ali", dayKey: "2026-10-24", messageId: "m2" },
      { id: "old", type: "game_challenge", fromUid: "ali", dayKey: "2026-10-24" },
    ];
    const match = { type: "game_challenge", fromUid: "ali", dayKey: "2026-10-24" };
    expect(matchingInvitationIds(items, { ...match, messageId: "m1" }, now)).toEqual(["a", "old"]);
    expect(matchingInvitationIds(items, match, now)).toEqual(["a", "b", "old"]);
  });
});

describe("karttan yanıt → bildirim kaydı (services/notificationsService)", () => {
  test("yalnız eşleşen bekleyen davet 'accepted' olur", async () => {
    const created = Date.now() - 1000;
    mockInbox.set("a", { type: "cineswipe_invite", fromUid: "ali", inviteCode: "123456", createdAt: created, read: true });
    mockInbox.set("b", { type: "cineswipe_invite", fromUid: "ali", inviteCode: "654321", createdAt: created, read: true });
    mockInbox.set("c", { type: "cineswipe_invite", fromUid: "veli", inviteCode: "123456", createdAt: created, read: true });
    await expect(
      respondMatchingInvitations("me", { type: "cineswipe_invite", fromUid: "ali", inviteCode: "123456" }, "accepted"),
    ).resolves.toBe(1);
    expect(mockInbox.get("a").response).toBe("accepted");
    expect(mockInbox.get("b").response).toBeUndefined();
    expect(mockInbox.get("c").response).toBeUndefined();
    // İkinci yanıt bir şey değiştirmez (kayıt bir kez yanıtlanır).
    await expect(
      respondMatchingInvitations("me", { type: "cineswipe_invite", fromUid: "ali", inviteCode: "123456" }, "declined"),
    ).resolves.toBe(0);
    expect(mockInbox.get("a").response).toBe("accepted");
  });

  test("karttan ret kaydı 'declined' yapar (Profil çubuğu artık sormaz); geçersiz yanıt yazılmaz", async () => {
    mockInbox.set("d", { type: "game_challenge", fromUid: "ali", dayKey: TODAY, read: false });
    jest.useFakeTimers().setSystemTime(now);
    try {
      await expect(
        respondMatchingInvitations("me", { type: "game_challenge", fromUid: "ali", dayKey: TODAY }, "maybe"),
      ).resolves.toBe(0);
      await expect(
        respondMatchingInvitations("me", { type: "game_challenge", fromUid: "ali", dayKey: TODAY }, "declined"),
      ).resolves.toBe(1);
    } finally {
      jest.useRealTimers();
    }
    expect(mockInbox.get("d")).toMatchObject({ response: "declined", read: true });
  });
});

describe("düello sonucu paylaşım türü", () => {
  const share = (over = {}) =>
    buildDuelResultShare({ dayKey: TODAY, hostUid: "ali", host: "Ali", hostScore: 7450, guest: "Ayşe", guestScore: 8200, correct: 8, total: 10, ...over });

  test("geçerli gövde; kind eşleşir; önizleme iki skoru taşır", () => {
    expect(share()).toEqual({
      v: 1, type: "duelResult", dayKey: TODAY, hostUid: "ali", host: "Ali", hostScore: 7450, guest: "Ayşe", guestScore: 8200, correct: 8, total: 10,
    });
    const message = buildShareMessage(share());
    expect(message.kind).toBe("duelResultShare");
    expect(readShare(message)).toEqual(share());
    expect(sharePreview(share())).toMatch(/8200.*7450/);
  });

  test("meydan okuyan ya da kabul edenin skoru yoksa kart yazılmaz; rakip skoru isteğe bağlı", () => {
    expect(share({ hostUid: "" })).toBeNull();
    expect(share({ hostUid: "a/b" })).toBeNull();
    expect(share({ guestScore: undefined })).toBeNull();
    expect(share({ dayKey: "24-10-2026" })).toBeNull();
    expect("hostScore" in share({ hostScore: null })).toBe(false);
    expect(sharePreview(share({ hostScore: null }))).toMatch(/\?/);
  });

  test("izleyicinin gözünden düzen", () => {
    const base = { guestUid: "guest", hostUid: "ali", guestScore: 8200, hostScore: 7450 };
    expect(duelResultView({ ...base, viewerUid: "guest" })).toMatchObject({ role: "guest", verdict: "win", diff: 750, left: { side: "guest" } });
    expect(duelResultView({ ...base, viewerUid: "ali" })).toMatchObject({ role: "host", verdict: "lose", left: { side: "host" } });
    expect(duelResultView({ ...base, viewerUid: "veli" })).toMatchObject({ role: "other", verdict: "decided", winner: "guest" });
    expect(duelResultView({ ...base, viewerUid: "veli", hostScore: 8200 })).toMatchObject({ verdict: "tie", winner: null });
    expect(duelResultView({ ...base, viewerUid: "guest", hostScore: null })).toMatchObject({ verdict: null });
  });
});

describe("SharedDuelResultMessage", () => {
  const share = buildDuelResultShare({ dayKey: TODAY, hostUid: "ali", host: "Ali", hostScore: 9999, guest: "Ayşe", guestScore: 8200, correct: 8, total: 10 });
  let renderer;
  const mount = async (props = {}) => {
    await act(async () => {
      renderer = create(<SharedDuelResultMessage share={share} senderUid="guest" {...props} />);
    });
  };
  const has = (value) => renderer.root.findAllByType("Text").some((n) => [].concat(n.props.children).join("") === value);
  afterEach(() => act(() => renderer?.unmount()));

  test("meydan okuyan görür: başlık, SOLDA kendi skoru, doğrulanmış skor karttakini ezer", async () => {
    mockUser = { uid: "ali" };
    mockLoadScores.mockResolvedValue({ mine: 8200, host: 7450 });
    await mount();
    expect(mockLoadScores).toHaveBeenCalledWith({ dayKey: TODAY, myUid: "guest", hostUid: "ali" });
    expect(has(DUEL_COPY.tr.resultTitleHost("Ayşe"))).toBe(true);
    expect(has("7450")).toBe(true);
    expect(has("9999")).toBe(false);
    expect(has(DUEL_COPY.tr.lose("750"))).toBe(true);
    expect(has(DUEL_COPY.tr.statusDone)).toBe(true);
    // Aynı günün meydan okuma kartları tazelensin diye bir kez duyurulur.
    expect(mockNotifyScores).toHaveBeenCalledWith(TODAY);
  });

  test("tablo okunamazsa kart skorları kalır; grupta üçüncü kişi kazananı görür", async () => {
    mockUser = { uid: "veli" };
    mockLoadScores.mockRejectedValue(new Error("ağ"));
    await mount();
    expect(has(DUEL_COPY.tr.resultTitleOther("Ayşe", "Ali"))).toBe(true);
    expect(has("9999")).toBe(true);
    expect(has(DUEL_COPY.tr.leads("Ali", "1799"))).toBe(true);
  });
});

describe("useDuelResultReport (sonuç ekranı)", () => {
  const duel = { dayKey: TODAY, hostUid: "ali", hostName: "Ali", chat: { friendUid: "ali", friendName: "Ali" } };
  const result = { dailyKey: TODAY, score: 8000, correct: 8, total: 10 };
  let latest;
  function Probe(props) {
    latest = useDuelResultReport(props);
    return null;
  }
  const mount = async (props) => {
    let renderer;
    await act(async () => {
      renderer = create(<Probe {...props} />);
    });
    return renderer;
  };

  test("bir kez yazar: rakip skoru tablodan, kendi skorum tablodaki en iyiyle", async () => {
    mockLoadScores.mockResolvedValue({ mine: 8200, host: 7450 });
    mockPost.mockResolvedValue({ chatId: "x" });
    const first = await mount({ duel, sessionId: "s1", result });
    expect(mockLoadScores).toHaveBeenCalledWith(expect.objectContaining({ dayKey: TODAY, myUid: "guest", hostUid: "ali", force: true }));
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [chat, share] = mockPost.mock.calls[0];
    expect(chat).toEqual(duel.chat);
    expect(share).toMatchObject({ type: "duelResult", hostUid: "ali", host: "Ali", hostScore: 7450, guest: "Ayşe Y.", guestScore: 8200 });
    expect(latest.status).toBe("sent");
    act(() => first.unmount());
    // Ekran yeniden bağlansa da aynı oturum ikinci kez yazılmaz.
    await mount({ duel, sessionId: "s1", result });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(latest.status).toBe("sent");
  });

  test("hata → 'failed'; yeniden dene yazar", async () => {
    mockLoadScores.mockResolvedValue({ mine: null, host: null });
    mockPost.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ chatId: "x" });
    await mount({ duel, sessionId: "s2", result });
    expect(latest.status).toBe("failed");
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty("hostScore");
    await act(async () => latest.retry());
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(latest.status).toBe("sent");
  });

  test("düello yok / başka gün / kendi meydan okumam → hiçbir şey yazılmaz", async () => {
    await mount({ duel: null, sessionId: "s3", result });
    expect(latest.status).toBe("off");
    await mount({ duel, sessionId: "s4", result: { ...result, dailyKey: "2026-10-23" } });
    expect(latest.status).toBe("off");
    mockUser = { uid: "ali" };
    await mount({ duel, sessionId: "s5", result });
    expect(latest.status).toBe("off");
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe("services/chatOutbox", () => {
  const sender = { uid: "me", displayName: "Ayşe", username: "ayse", avatarIndex: 3, photoURL: null };
  const share = buildDuelResultShare({ dayKey: TODAY, hostUid: "ali", guestScore: 8200 });

  test("1-1: mesaj + iki tarafın gelen kutusu tek batch'te; sunucu push işareti", async () => {
    await expect(postShareToChat({ sender, chat: { friendUid: "ali", friendName: "Ali" }, share })).resolves.toEqual({ chatId: directChatId("me", "ali") });
    expect(directChatId("me", "ali")).toBe("me_ali");
    const [batch] = mockBatches;
    expect(batch.commit).toHaveBeenCalledTimes(1);
    const byRef = Object.fromEntries(batch.sets.map((entry) => [entry.ref, entry]));
    expect(byRef["chats/me_ali/messages/auto"].data).toMatchObject({ kind: "duelResultShare", senderId: "me", push: "server", status: "sent" });
    expect(byRef["Users/me/conversations/ali"].data).toMatchObject({ withUid: "ali", withName: "Ali", lastTime: "NOW" });
    expect(byRef["Users/me/conversations/ali"].data).not.toHaveProperty("unreadCount");
    expect(byRef["Users/ali/conversations/me"].data).toMatchObject({ withUid: "me", withName: "Ayşe", withAvatarIndex: 3, unreadCount: { increment: 1 } });
  });

  test("grup: üye değilse yazmaz; üyeyse özet + sayaçlar", async () => {
    await expect(postShareToChat({ sender, chat: { groupId: "g1" }, share })).rejects.toThrow("not-a-member");
    expect(mockBatches[0].commit).not.toHaveBeenCalled();
    mockGroups.set("groups/g1", { members: ["me", "ali", "veli"] });
    await postShareToChat({ sender, chat: { groupId: "g1" }, share });
    const batch = mockBatches[1];
    const byRef = Object.fromEntries(batch.sets.map((entry) => [entry.ref, entry]));
    expect(byRef["groups/g1/messages/auto"].data).toMatchObject({ senderName: "Ayşe", senderAvatarIndex: 3, push: "server" });
    // Firestore `undefined` alanı reddeder: tanımsız gönderen alanı yazılmaz.
    expect(Object.values(byRef["groups/g1/messages/auto"].data)).not.toContain(undefined);
    expect(byRef["groups/g1"].data.lastMessage).toMatchObject({ senderId: "me", senderUsername: "ayse" });
    expect(mockQueueGroupUnread).toHaveBeenCalledWith(batch, "g1", ["me", "ali", "veli"], "me");
  });

  test("geçersiz paylaşım ya da hedef yok → yazım yok", async () => {
    await expect(postShareToChat({ sender, chat: { friendUid: "ali" }, share: null })).rejects.toThrow("invalid-share");
    await expect(postShareToChat({ sender, chat: {}, share })).rejects.toThrow("no-chat");
    expect(mockBatches.every((batch) => batch.commit.mock.calls.length === 0)).toBe(true);
  });
});

describe("CineSwipe: sohbete eşleşme listesi + geçmiş", () => {
  const match = (id) => ({ id, title: `Film ${id}`, mediaType: id % 2 ? "movie" : "tv", poster_path: `/${id}.jpg`, overview: "x".repeat(900) });
  const result = (roomId, matches = [match(1), match(2)]) => ({
    roomId,
    room: { hostUid: "ali", guestUid: "me", hostName: "Ali", guestName: "Ayşe" },
    summary: { complete: true, total: 20, matches, host: {}, guest: {}, matchRate: 10 },
  });

  test("eşleşmeler 'cineswipe' kaynaklı liste olur; dizi türü korunur, boş liste yazılmaz", () => {
    const share = buildListShare({
      title: "Ali & Ayşe",
      items: [match(1), match(2)].map((media) => ({ ...media, media_type: media.mediaType })),
      source: "cineswipe",
    });
    expect(share).toMatchObject({ type: "list", source: "cineswipe", title: "Ali & Ayşe", total: 2 });
    expect(share.items.map((item) => item.media_type)).toEqual(["movie", "tv"]);
    expect(buildListShare({ title: "x", items: [], source: "cineswipe" })).toBeNull();
    expect(readShare(buildShareMessage(share)).source).toBe("cineswipe");
  });

  test("tur bir kez, en yeni başta, uzun özet kırpılarak saklanır", () => {
    expect(recordCineHistory(result("r1"), "me", 1000)).toBe(true);
    expect(recordCineHistory(result("r2"), "me", 2000)).toBe(true);
    expect(recordCineHistory(result("r1"), "me", 3000)).toBe(true); // aynı oda tekrar eklenmez
    const history = readCineHistory("me");
    expect(history.map((entry) => entry.roomId)).toEqual(["r2", "r1"]);
    expect(history[0]).toMatchObject({ finishedAt: 2000, room: { hostName: "Ali" } });
    expect(history[0].summary.matches[0].overview.length).toBeLessThanOrEqual(280);
    expect(readCineHistory("other")).toEqual([]);
  });

  test("geçmiş tavanı ve eski 'son sonuç' kaydının devri", () => {
    mockStore.set("last:me", { ...result("old"), receiptPending: true });
    expect(readCineHistory("me").map((entry) => entry.roomId)).toEqual(["old"]);
    expect(readCineHistory("me")[0]).not.toHaveProperty("receiptPending");
    for (let i = 0; i < MAX_CINE_HISTORY + 3; i += 1) recordCineHistory(result(`n${i}`), "me", i);
    const history = readCineHistory("me");
    expect(history).toHaveLength(MAX_CINE_HISTORY);
    expect(history[0].roomId).toBe(`n${MAX_CINE_HISTORY + 2}`);
    expect(recordCineHistory({ ...result("bad"), summary: { complete: false, matches: [] } }, "me")).toBe(false);
  });
});
