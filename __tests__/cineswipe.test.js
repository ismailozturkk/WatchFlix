jest.mock("../firebase", () => ({
  db: {},
  app: {},
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((db, col, id) => ({ path: `${col}/${id}` })),
  setDoc: jest.fn(async () => {}),
  getDoc: jest.fn(async () => ({ exists: () => true, data: () => ({ swipes: {}, matches: [] }) })),
  deleteDoc: jest.fn(async () => {}),
  collection: jest.fn((db, col) => ({ path: col })),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => args),
  getDocs: jest.fn(async () => ({ empty: true, docs: [] })),
  onSnapshot: jest.fn(() => () => {}),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => "TIMESTAMP"),
}));

const {
  generateRoomCode,
  createCineRoom,
  deleteCineRoom,
  SWIPE_CATEGORIES,
  GENRE_OPTIONS,
} = require("../services/cineswipe/cineswipeService");

describe("CineSwipe Room Engine", () => {
  test("6 haneli geçerli oda kodu üretir", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateRoomCode();
      expect(typeof code).toBe("string");
      expect(code.length).toBe(6);
      const num = parseInt(code, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThanOrEqual(999999);
    }
  });

  test("sağa kaydırma (like) ve pas (pass) durumlarında eşleşme kontrolü", () => {
    const user1 = "uid_alice";
    const user2 = "uid_bob";
    const mediaId = 157336;

    const swipes = {};

    swipes[mediaId] = { [user1]: "like" };
    let isMatch = swipes[mediaId][user1] === "like" && swipes[mediaId][user2] === "like";
    expect(isMatch).toBe(false);

    swipes[mediaId][user2] = "like";
    isMatch = swipes[mediaId][user1] === "like" && swipes[mediaId][user2] === "like";
    expect(isMatch).toBe(true);

    const mediaId2 = 999;
    swipes[mediaId2] = { [user1]: "like", [user2]: "pass" };
    const isMatch2 = swipes[mediaId2][user1] === "like" && swipes[mediaId2][user2] === "like";
    expect(isMatch2).toBe(false);
  });

  test("Oda oluşturma ve yapılandırma doğru alanları üretir", async () => {
    const hostUser = { uid: "host123", displayName: "İsmail", photoURL: null };
    const deck = [
      { id: 1, title: "Inception", poster_path: "/inc.jpg" },
      { id: 2, title: "Interstellar", poster_path: "/int.jpg" },
    ];
    const config = { targetCardsCount: 10, category: "top_rated_movie" };

    const { roomId, roomCode } = await createCineRoom(hostUser, deck, config);
    expect(roomId).toContain("room_");
    expect(roomCode.length).toBe(6);
  });

  test("Kategori ve Tür seçenekleri geçerli tanımlara sahip", () => {
    expect(SWIPE_CATEGORIES.length).toBeGreaterThan(3);
    expect(GENRE_OPTIONS.length).toBeGreaterThan(5);
    expect(SWIPE_CATEGORIES.some((c) => c.id === "trending")).toBe(true);
    expect(SWIPE_CATEGORIES.some((c) => c.id === "watchlist")).toBe(true);
  });
});

const firestore = require("firebase/firestore");
const { joinCineRoom, subscribeToCineRoom, recordSwipe, summarizeCineRoom, acknowledgeCineResults } = require("../services/cineswipe/cineswipeService");

describe("CineSwipe join recovery", () => {
  let data;
  let transaction;
  beforeEach(() => {
    jest.clearAllMocks();
    data = { hostUid: "host", guestUid: null, status: "waiting", deck: [{ id: 1 }] };
    firestore.getDocs.mockResolvedValue({ empty: false, docs: [{ id: "room", data: () => data }] });
    transaction = { get: jest.fn(async () => ({ exists: () => true, data: () => data })), update: jest.fn() };
    firestore.runTransaction.mockImplementation(async (_, callback) => callback(transaction));
  });
  test.each(["", "12345", "abcdef", null, "1234567"])("rejects invalid code %s before querying", async code => {
    await expect(joinCineRoom(code, { uid: "guest" })).rejects.toMatchObject({ code: "invalid-code" });
    expect(firestore.getDocs).not.toHaveBeenCalled();
  });
  test("requires authentication", async () => {
    await expect(joinCineRoom("123456", null)).rejects.toMatchObject({ code: "unauthenticated" });
  });
  test("missing code", async () => {
    firestore.getDocs.mockResolvedValue({ empty: true });
    await expect(joinCineRoom("123456", { uid: "guest" })).rejects.toMatchObject({ code: "room-not-found" });
  });
  test("deleted between query and transaction never recreates room", async () => {
    transaction.get.mockResolvedValue({ exists: () => false });
    await expect(joinCineRoom("123456", { uid: "guest" })).rejects.toMatchObject({ code: "room-deleted" });
    expect(transaction.update).not.toHaveBeenCalled();
  });
  test.each([
    [{ status: "active", guestUid: "other" }, "room-full"],
    [{ status: "finished" }, "room-expired"],
    [{ expiresAt: { toMillis: () => 1 } }, "room-expired"],
  ])("rejects unavailable rooms", async (patch, code) => {
    Object.assign(data, patch);
    await expect(joinCineRoom("123456", { uid: "guest" })).rejects.toMatchObject({ code });
    expect(transaction.update).not.toHaveBeenCalled();
  });
  test("second concurrent guest cannot overwrite the first", async () => {
    transaction.update.mockImplementation((_, payload) => Object.assign(data, payload));
    await joinCineRoom("123456", { uid: "first" });
    await expect(joinCineRoom("123456", { uid: "second" })).rejects.toMatchObject({ code: "room-full" });
    expect(data.guestUid).toBe("first");
  });
  test("host reentry keeps waiting room; guest joins with existing deck", async () => {
    expect((await joinCineRoom("123456", { uid: "host" })).roomData.status).toBe("waiting");
    expect(transaction.update).not.toHaveBeenCalled();
    const result = await joinCineRoom(" 123456 ", { uid: "guest" });
    expect(result.roomData).toMatchObject({ status: "active", guestUid: "guest", deck: data.deck });
  });
  test.each(["query", "transaction"])("preserves permission failure from %s", async stage => {
    firestore[stage === "query" ? "getDocs" : "runTransaction"].mockRejectedValueOnce({ code: "permission-denied" });
    await expect(joinCineRoom("123456", { uid: "guest" })).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("listener reports deletion and permission failures", () => {
    const onUpdate = jest.fn(), onError = jest.fn();
    subscribeToCineRoom("room", onUpdate, onError);
    const [, next, error] = firestore.onSnapshot.mock.calls[0];
    next({ exists: () => false });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "room-deleted" }));
    error({ code: "permission-denied" });
    expect(onError).toHaveBeenLastCalledWith({ code: "permission-denied" });
    expect(onUpdate).not.toHaveBeenCalled();
  });
  test("both likes produce the final match and finish atomically", async () => {
    Object.assign(data, { status: "active", guestUid: "guest", swipes: { movie_1: { host: "like" } } });
    const result = await recordSwipe("room", "guest", { id: 1 }, "like");
    expect(result.roomData).toMatchObject({ status: "finished", matches: [{ id: 1 }] });
    expect(transaction.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "finished", finishedAt: "TIMESTAMP" }));
  });
  test("first participant finishing does not finish the room", async () => {
    Object.assign(data, { status: "active", guestUid: "guest" });
    const result = await recordSwipe("room", "host", { id: 1 }, "like");
    expect(result.roomData.status).toBe("active");
    expect(summarizeCineRoom(result.roomData)).toMatchObject({ complete: false, host: { reviewed: 1 }, guest: { reviewed: 0 } });
  });
  test("no matches still produces complete final statistics", async () => {
    Object.assign(data, { status: "active", guestUid: "guest", swipes: { movie_1: { host: "like" } } });
    const result = await recordSwipe("room", "guest", { id: 1 }, "pass");
    expect(summarizeCineRoom(result.roomData)).toEqual({
      total: 1, matches: [], host: { reviewed: 1, likes: 1, passes: 0 },
      guest: { reviewed: 1, likes: 0, passes: 1 }, matchRate: 0, complete: true,
    });
  });
  test("movie and TV with the same numeric id have separate votes", () => {
    const room = { hostUid: "host", guestUid: "guest", deck: [{ id: 1, mediaType: "movie" }, { id: 1, mediaType: "tv" }],
      swipes: { movie_1: { host: "like", guest: "like" }, tv_1: { host: "pass", guest: "like" } } };
    expect(summarizeCineRoom(room)).toMatchObject({ total: 2, complete: true, matchRate: 50, matches: [{ id: 1, mediaType: "movie" }] });
  });
  test("legacy numeric vote keys remain readable", () => {
    expect(summarizeCineRoom({ ...data, guestUid: "guest", swipes: { 1: { host: "like", guest: "like" } } }).complete).toBe(true);
  });
  test("committed duplicate choice never overwrites or double-counts", async () => {
    Object.assign(data, { status: "active", guestUid: "guest", swipes: { movie_1: { host: "like" } } });
    await recordSwipe("room", "host", { id: 1 }, "pass");
    expect(transaction.update).not.toHaveBeenCalled();
  });
  test("transaction uses latest other participant vote instead of query data", async () => {
    const fresh = { ...data, status: "active", guestUid: "guest", swipes: { movie_1: { guest: "like" } } };
    transaction.get.mockResolvedValue({ exists: () => true, data: () => fresh });
    const result = await recordSwipe("room", "host", { id: 1 }, "like");
    expect(result.roomData.status).toBe("finished");
    expect(result.roomData.matches).toHaveLength(1);
  });
  test("deleted room cannot be recreated by a delayed swipe", async () => {
    transaction.get.mockResolvedValue({ exists: () => false });
    await expect(recordSwipe("room", "host", { id: 1 })).rejects.toMatchObject({ code: "room-deleted" });
    expect(transaction.update).not.toHaveBeenCalled();
  });
  test("rejects outsider votes and cards outside the shared deck", async () => {
    Object.assign(data, { status: "active", guestUid: "guest" });
    await expect(recordSwipe("room", "outsider", { id: 1 })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(recordSwipe("room", "host", { id: 99 })).rejects.toMatchObject({ code: "invalid-vote" });
  });
  test("each participant acknowledges only after finish, preserving the other receipt", async () => {
    await expect(acknowledgeCineResults("room", "host")).rejects.toMatchObject({ code: "room-not-finished" });
    Object.assign(data, { status: "finished", guestUid: "guest", resultsReceived: ["host"] });
    await acknowledgeCineResults("room", "guest");
    expect(transaction.update).toHaveBeenLastCalledWith(expect.anything(), { resultsReceived: ["host", "guest"] });
    await expect(acknowledgeCineResults("room", "outsider")).rejects.toMatchObject({ code: "permission-denied" });
  });
  test("receipt retry after deletion is harmless", async () => {
    transaction.get.mockResolvedValue({ exists: () => false });
    await expect(acknowledgeCineResults("room", "host")).resolves.toBeUndefined();
    expect(transaction.update).not.toHaveBeenCalled();
  });
  test("participants can reopen finished results; outsiders cannot join", async () => {
    Object.assign(data, { status: "finished", guestUid: "guest" });
    expect((await joinCineRoom("123456", { uid: "guest" })).roomData.status).toBe("finished");
    await expect(joinCineRoom("123456", { uid: "outsider" })).rejects.toMatchObject({ code: "room-expired" });
  });
  test("empty decks are not created", async () => {
    await expect(createCineRoom({ uid: "host" }, [])).rejects.toMatchObject({ code: "empty-deck" });
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });
  test("TR and EN provide all recovery messages and actions", () => {
    const tr = require("../translations/tr.json").cineRoomJoin;
    const en = require("../translations/en.json").cineRoomJoin;
    const resultTr = require("../translations/tr.json").cineRoomResults;
    const resultEn = require("../translations/en.json").cineRoomResults;
    expect(Object.keys(resultTr).sort()).toEqual(Object.keys(resultEn).sort());
    expect(Object.keys(tr).sort()).toEqual(Object.keys(en).sort());
    Object.values(tr).concat(Object.values(en)).forEach(value => expect(value.length).toBeGreaterThan(0));
  });
});
