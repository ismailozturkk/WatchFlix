// "Sırayla" (oturumlu) CineSwipe odası: saf kurallar + servis davranışı (kurucu beklemeden oy verir,
// misafir katılınca süre uzar, son oyu veren cihaz `finishedByMe` alır, bildirim alanları süzülür).
jest.mock("../firebase", () => ({ db: {}, app: {} }));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((db, col, id) => ({ path: `${col}/${id}` })),
  setDoc: jest.fn(async () => {}),
  getDoc: jest.fn(),
  deleteDoc: jest.fn(async () => {}),
  collection: jest.fn((db, ...segments) => ({ path: segments.join("/") })),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => args),
  getDocs: jest.fn(async () => ({ empty: true, docs: [] })),
  onSnapshot: jest.fn(() => () => {}),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => "TIMESTAMP"),
  writeBatch: jest.fn(),
  increment: jest.fn((n) => ({ increment: n })),
}));

const firestore = require("firebase/firestore");
const {
  asyncRoomRow,
  asyncRoomStage,
  inviteCardOf,
  nextCardIndex,
  resultChatOf,
  roomModeOf,
  sortAsyncRows,
  timeLeftParts,
} = require("../services/cineswipe/asyncRoom");
const {
  createCineRoom,
  joinCineRoom,
  listMyAsyncRooms,
  loadCineRoom,
  recordSwipe,
} = require("../services/cineswipe/cineswipeService");
const { createSocialNotification } = require("../services/socialNotificationsService");
const { notificationContent, notificationDestination } = require("../utils/notificationInbox");
const { notificationInboxCopy } = require("../utils/notificationInboxCopy");
const { buildCineRoomShare } = require("../utils/chatShare");

const NOW = 1_800_000_000_000;
const deck = [
  { id: 1, title: "A", mediaType: "movie", poster_path: "/a.jpg" },
  { id: 2, title: "B", mediaType: "tv", poster_path: "/b.jpg" },
];
const baseRoom = (patch = {}) => ({
  roomCode: "123456",
  hostUid: "host",
  hostName: "Ayşe",
  guestUid: null,
  guestName: null,
  status: "waiting",
  mode: "async",
  deck,
  swipes: {},
  expiresAt: NOW + 10 * 60 * 60 * 1000,
  ...patch,
});

function mockTransaction(room) {
  const update = jest.fn();
  firestore.runTransaction.mockImplementationOnce(async (db, fn) =>
    fn({ get: async () => ({ exists: () => !!room, data: () => room }), update }),
  );
  return update;
}

describe("asyncRoom kuralları", () => {
  test("mod yalnız 'async' ise sırayla; bilinmeyen değer canlıya düşer", () => {
    expect(roomModeOf("async")).toBe("async");
    expect(roomModeOf(undefined)).toBe("live");
    expect(roomModeOf("x")).toBe("live");
  });

  test("aşama: sıra bende → davet bekleniyor → sıra arkadaşımda → bitti", () => {
    expect(asyncRoomStage(baseRoom(), "host")).toBe("yourTurn");
    const voted = { movie_1: { host: "like" }, tv_2: { host: "pass" } };
    expect(nextCardIndex(baseRoom({ swipes: voted }), "host")).toBe(2);
    expect(asyncRoomStage(baseRoom({ swipes: voted }), "host")).toBe("waitingGuest");
    const joined = baseRoom({ swipes: voted, guestUid: "guest", status: "active" });
    expect(asyncRoomStage(joined, "host")).toBe("partnerTurn");
    expect(asyncRoomStage(joined, "guest")).toBe("yourTurn");
    expect(asyncRoomStage({ ...joined, status: "finished" }, "host")).toBe("finished");
  });

  test("sonuç sohbeti: kayıtlı grup, yoksa iki kişinin 1-1 sohbeti", () => {
    const room = baseRoom({ guestUid: "guest", guestName: "Can" });
    expect(resultChatOf(room, "guest")).toEqual({ friendUid: "host", friendName: "Ayşe" });
    expect(resultChatOf(room, "host")).toEqual({ friendUid: "guest", friendName: "Can" });
    expect(resultChatOf({ ...room, resultChat: { groupId: "g1", groupName: "Film" } }, "host")).toEqual({
      groupId: "g1",
      groupName: "Film",
    });
    expect(resultChatOf(baseRoom(), "host")).toBeNull();
  });

  test("davet kartını tek kişi işaretler: sırayla odada son oyu veren, canlı odada davetle gelen misafir", () => {
    const asyncRoom = baseRoom({ guestUid: "guest", guestName: "Can", status: "finished", inviteMessageId: "msg1" });
    // Sırayla: son oyu veren kurucu da olabilir; sohbet 1-1 (ya da kayıtlı grup), kart odadan.
    expect(inviteCardOf(asyncRoom, "host", { finishedByMe: true })).toEqual({
      chat: { friendUid: "guest", friendName: "Can" },
      messageId: "msg1",
    });
    expect(inviteCardOf({ ...asyncRoom, resultChat: { groupId: "g1" } }, "guest", { finishedByMe: true })).toEqual({
      chat: { groupId: "g1", groupName: "" },
      messageId: "msg1",
    });
    expect(inviteCardOf(asyncRoom, "host", { finishedByMe: false })).toBeNull();
    expect(inviteCardOf({ ...asyncRoom, inviteMessageId: undefined }, "host", { finishedByMe: true })).toBeNull();

    // Canlı: yalnız bu koda davetle katılan misafir; bağlam ekrandan.
    const liveRoom = { ...asyncRoom, mode: "live", inviteMessageId: undefined };
    const invite = { code: "123456", chat: { groupId: "g1", groupName: "Film" }, messageId: "msg2" };
    expect(inviteCardOf(liveRoom, "guest", { invite })).toEqual({ chat: invite.chat, messageId: "msg2" });
    expect(inviteCardOf(liveRoom, "host", { invite })).toBeNull();
    expect(inviteCardOf(liveRoom, "guest", { invite: { ...invite, code: "999999" } })).toBeNull();
    expect(inviteCardOf(liveRoom, "guest", { invite: { ...invite, messageId: null } })).toBeNull();
    expect(inviteCardOf(liveRoom, "guest")).toBeNull();
  });

  test("lobi satırı: canlı, süresi dolmuş ve yabancı oda gösterilmez; sıralama sıra-bende önce", () => {
    expect(asyncRoomRow("r", baseRoom({ mode: "live" }), "host", NOW)).toBeNull();
    expect(asyncRoomRow("r", baseRoom({ expiresAt: NOW - 1 }), "host", NOW)).toBeNull();
    expect(asyncRoomRow("r", baseRoom(), "stranger", NOW)).toBeNull();
    const row = asyncRoomRow("r", baseRoom(), "host", NOW);
    expect(row).toMatchObject({ roomId: "r", isHost: true, stage: "yourTurn", done: 0, total: 2, poster: "/a.jpg" });
    const sorted = sortAsyncRows([
      { roomId: "w", stage: "waitingGuest", timeLeft: 5 },
      { roomId: "y", stage: "yourTurn", timeLeft: 50 },
      { roomId: "f", stage: "finished", timeLeft: 500 },
    ]);
    expect(sorted.map((r) => r.roomId)).toEqual(["f", "y", "w"]);
  });

  test("kalan süre etiketi: dakika ya da yukarı yuvarlanmış saat", () => {
    expect(timeLeftParts(30 * 60 * 1000)).toEqual({ value: 30, unit: "minute" });
    expect(timeLeftParts(90 * 60 * 1000)).toEqual({ value: 2, unit: "hour" });
    expect(timeLeftParts(-5)).toEqual({ value: 0, unit: "minute" });
  });
});

describe("sırayla oda servisi", () => {
  beforeEach(() => jest.clearAllMocks());

  test("oda modu belgeye yazılır", async () => {
    await createCineRoom({ uid: "host" }, deck, { mode: "async" });
    expect(firestore.setDoc.mock.calls[0][1]).toMatchObject({ mode: "async", status: "waiting" });
    await createCineRoom({ uid: "host" }, deck, {});
    expect(firestore.setDoc.mock.calls[1][1]).toMatchObject({ mode: "live" });
  });

  test("kurucu misafir yokken oy verebilir; canlı odada veremez", async () => {
    const update = mockTransaction(baseRoom({ expiresAt: Date.now() + 1000000 }));
    const result = await recordSwipe("r", "host", deck[0], "like");
    expect(update).toHaveBeenCalled();
    expect(result.finishedByMe).toBe(false);

    mockTransaction(baseRoom({ mode: "live", expiresAt: Date.now() + 1000000 }));
    await expect(recordSwipe("r", "host", deck[0], "like")).rejects.toMatchObject({ code: "room-expired" });
  });

  test("son oy odayı bitirir, finishedByMe döner ve sonuç bir gün saklanır", async () => {
    const room = baseRoom({
      status: "active",
      guestUid: "guest",
      expiresAt: Date.now() + 1000000,
      swipes: { movie_1: { host: "like", guest: "like" }, tv_2: { host: "like" } },
    });
    const update = mockTransaction(room);
    const result = await recordSwipe("r", "guest", deck[1], "pass");
    expect(result.finishedByMe).toBe(true);
    const patch = update.mock.calls[0][1];
    expect(patch.status).toBe("finished");
    expect(patch.expiresAt - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
  });

  test("misafir katılınca süre uzar ve grup daveti sonuç sohbeti olarak kaydedilir", async () => {
    firestore.getDocs.mockResolvedValueOnce({ empty: false, docs: [{ id: "r", data: () => ({ createdAt: null }) }] });
    const update = mockTransaction(baseRoom({ expiresAt: Date.now() + 1000 }));
    await joinCineRoom("123456", { uid: "guest", displayName: "Can" }, {
      resultChat: { groupId: "g1", groupName: "Film" },
      inviteMessageId: "msg1",
    });
    const patch = update.mock.calls[0][1];
    expect(patch).toMatchObject({
      guestUid: "guest",
      status: "active",
      resultChat: { groupId: "g1", groupName: "Film" },
      inviteMessageId: "msg1",
    });
    expect(patch.expiresAt - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
  });

  test("davet kartının kimliği yalnız geçerliyse ve yalnız sırayla odada odaya yazılır", async () => {
    firestore.getDocs.mockResolvedValueOnce({ empty: false, docs: [{ id: "r", data: () => ({ createdAt: null }) }] });
    let update = mockTransaction(baseRoom({ expiresAt: Date.now() + 1000 }));
    await joinCineRoom("123456", { uid: "guest" }, { inviteMessageId: "../x" });
    expect(update.mock.calls[0][1]).not.toHaveProperty("inviteMessageId");
    firestore.getDocs.mockResolvedValueOnce({ empty: false, docs: [{ id: "r", data: () => ({ createdAt: null }) }] });
    update = mockTransaction(baseRoom({ mode: "live", expiresAt: Date.now() + 1000 }));
    await joinCineRoom("123456", { uid: "guest" }, { inviteMessageId: "msg1" });
    expect(update.mock.calls[0][1]).not.toHaveProperty("inviteMessageId");
  });

  test("odaya dönüş yalnız katılımcıya; silinmiş oda hatası", async () => {
    firestore.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => baseRoom({ expiresAt: Date.now() + 1000 }) });
    await expect(loadCineRoom("r", "stranger")).rejects.toMatchObject({ code: "permission-denied" });
    firestore.getDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(loadCineRoom("r", "host")).rejects.toMatchObject({ code: "room-deleted" });
  });

  test("lobi listesi kurduğum ve katıldığım sırayla odaları birleştirir", async () => {
    const future = Date.now() + 1000000;
    firestore.getDocs
      .mockResolvedValueOnce({ docs: [{ id: "a", data: () => baseRoom({ expiresAt: future }) }, { id: "l", data: () => baseRoom({ mode: "live", expiresAt: future }) }] })
      .mockResolvedValueOnce({ docs: [{ id: "b", data: () => baseRoom({ hostUid: "x", guestUid: "host", status: "active", expiresAt: future }) }] });
    const rows = await listMyAsyncRooms("host");
    expect(rows.map((row) => row.roomId).sort()).toEqual(["a", "b"]);
  });
});

describe("sonuç bildirimi", () => {
  test("cineswipe_result alanları süzülür", async () => {
    const set = jest.fn();
    firestore.writeBatch.mockReturnValue({ set, update: jest.fn(), commit: jest.fn(async () => {}) });
    await createSocialNotification({
      toUid: "host",
      fromUid: "guest",
      type: "cineswipe_result",
      roomId: "room_123456_1",
      matchCount: 3,
      chatPosted: true,
    });
    expect(set.mock.calls[0][1]).toMatchObject({ type: "cineswipe_result", roomId: "room_123456_1", matchCount: 3, chatPosted: true });
    await createSocialNotification({ toUid: "host", fromUid: "guest", type: "cineswipe_result", roomId: "../x", matchCount: -1 });
    expect(set.mock.calls[1][1].roomId).toBeUndefined();
    expect(set.mock.calls[1][1].matchCount).toBeUndefined();
  });

  test("gelen kutusu metni ve hedefi", () => {
    const copy = notificationInboxCopy("tr");
    const item = { type: "cineswipe_result", fromName: "Can", roomId: "r1", matchCount: 2 };
    expect(notificationContent(item, {}, copy)).toMatchObject({ title: "Can", action: copy.cineResult, detail: "2 ortak eşleşme" });
    expect(notificationContent({ ...item, matchCount: 0 }, {}, copy).detail).toBe("Ortak eşleşme çıkmadı");
    expect(notificationDestination(item)).toEqual({
      name: "CineSwipeScreen",
      params: { initialMode: "duo", resumeRoomId: "r1" },
    });
  });

  test("davet kartı sırayla işaretini taşır", () => {
    expect(buildCineRoomShare({ code: "123456", async: true })).toMatchObject({ async: true });
    expect(buildCineRoomShare({ code: "123456" }).async).toBeUndefined();
  });
});
