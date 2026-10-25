const mockDocs = new Map();
const mockTransaction = {
  get: jest.fn(async (ref) => ({ exists: () => mockDocs.has(ref), data: () => mockDocs.get(ref) })),
  update: jest.fn((ref, patch) => mockDocs.set(ref, { ...mockDocs.get(ref), ...patch })),
};
const mockGetDocs = jest.fn();
const mockOnSnapshot = jest.fn();
const mockBatches = [];
jest.mock("firebase/firestore", () => ({
  doc: (_db, ...parts) => parts.join("/"), collection: (_db, ...parts) => parts.join("/"),
  query: (...args) => args, orderBy: (...args) => ["orderBy", ...args], limit: (n) => ["limit", n],
  startAfter: (cursor) => ["startAfter", cursor],
  getDocs: (...args) => mockGetDocs(...args), onSnapshot: (...args) => mockOnSnapshot(...args),
  runTransaction: (_db, fn) => fn(mockTransaction),
  where: (...args) => ["where", ...args],
  writeBatch: () => {
    const batch = { updates: [], update: (ref, patch) => batch.updates.push([ref, patch]), commit: jest.fn(async () => {}) };
    mockBatches.push(batch);
    return batch;
  },
}));
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../services/usageTrackerService", () => ({ trackFirestoreRead: jest.fn() }));
const { markNotificationRead, markAllNotificationsRead, respondToInvitation, fetchOlderNotifications, subscribeToNotifications } = require("../services/notificationsService");

beforeEach(() => { jest.clearAllMocks(); mockDocs.clear(); mockBatches.length = 0; });

test("mark-read uses current server state so repeated reads decrement once and never below zero", async () => {
  mockDocs.set("Users/u", { unreadNotifsCount: 2 });
  mockDocs.set("Users/u/notifications/n", { read: false });
  await markNotificationRead("u", "n");
  await markNotificationRead("u", "n");
  expect(mockDocs.get("Users/u").unreadNotifsCount).toBe(1);
  expect(mockTransaction.update).toHaveBeenCalledTimes(2);
  mockDocs.set("Users/u", { unreadNotifsCount: 0 });
  mockDocs.set("Users/u/notifications/n", { read: false });
  await markNotificationRead("u", "n");
  expect(mockDocs.get("Users/u").unreadNotifsCount).toBe(0);
});

test("deleted notification is a no-op", async () => {
  await markNotificationRead("u", "gone");
  expect(mockTransaction.update).not.toHaveBeenCalled();
});

test("invitation response is written once; reading first does not discard the pending action", async () => {
  mockDocs.set("Users/u", { unreadNotifsCount: 1 });
  mockDocs.set("Users/u/notifications/n", { type: "cineswipe_invite", read: false });
  await markNotificationRead("u", "n");
  expect(mockDocs.get("Users/u/notifications/n").response).toBeUndefined();
  expect(await respondToInvitation("u", "n", "accepted")).toBe(true);
  expect(await respondToInvitation("u", "n", "declined")).toBe(false);
  expect(mockDocs.get("Users/u/notifications/n")).toMatchObject({ read: true, response: "accepted" });
  expect(mockDocs.get("Users/u").unreadNotifsCount).toBe(0);
});

test("responding to unread invitation decrements once and rejects other notification types", async () => {
  mockDocs.set("Users/u", { unreadNotifsCount: 1 });
  mockDocs.set("Users/u/notifications/n", { type: "game_challenge", read: false });
  expect(await respondToInvitation("u", "n", "declined")).toBe(true);
  expect(mockDocs.get("Users/u").unreadNotifsCount).toBe(0);
  expect(await respondToInvitation("u", "n", "accepted")).toBe(false);
  mockDocs.set("Users/u/notifications/f", { type: "friend_request", read: false });
  expect(await respondToInvitation("u", "f", "accepted")).toBe(false);
});

test("older page uses document cursor so equal timestamps are not skipped", async () => {
  const cursor = { id: "last-document" };
  const older = { id: "older", data: () => ({ read: false }) };
  mockGetDocs.mockResolvedValue({ docs: [older], size: 1 });
  expect(await fetchOlderNotifications("u", cursor)).toEqual({ items: [{ id: "older", read: false }], cursor: older, hasMore: false });
  expect(mockGetDocs.mock.calls[0][0]).toContainEqual(["startAfter", cursor]);
});

test("listener exposes errors and pagination metadata", () => {
  const next = jest.fn(); const error = jest.fn();
  subscribeToNotifications("u", next, error);
  const [, onNext, onError] = mockOnSnapshot.mock.calls[0];
  onNext({ docs: [], size: 0 });
  expect(next).toHaveBeenCalledWith([], { cursor: null, hasMore: false });
  const failure = new Error("offline");
  onError(failure);
  expect(error).toHaveBeenCalledWith(failure);
});

const unreadDocs = (n, from = 0) => Array.from({ length: n }, (_, i) => ({ ref: `n${from + i}`, id: `n${from + i}` }));

test("mark-all walks every unread chunk and resets the counter only with the final one", async () => {
  mockGetDocs
    .mockResolvedValueOnce({ docs: unreadDocs(400) })
    .mockResolvedValueOnce({ docs: unreadDocs(3, 400) });
  expect(await markAllNotificationsRead("u")).toBe(403);
  expect(mockGetDocs.mock.calls[0][0]).toContainEqual(["where", "read", "==", false]);
  expect(mockBatches).toHaveLength(2);
  expect(mockBatches[0].updates).toHaveLength(400);
  expect(mockBatches[0].updates.some(([ref]) => ref === "Users/u")).toBe(false);
  expect(mockBatches[1].updates).toEqual([
    ["n400", { read: true }], ["n401", { read: true }], ["n402", { read: true }],
    ["Users/u", { unreadNotifsCount: 0 }],
  ]);
  expect(mockBatches.every((batch) => batch.commit.mock.calls.length === 1)).toBe(true);
});

test("mark-all with nothing unread still repairs a drifted counter", async () => {
  mockGetDocs.mockResolvedValueOnce({ docs: [] });
  expect(await markAllNotificationsRead("u")).toBe(0);
  expect(mockBatches[0].updates).toEqual([["Users/u", { unreadNotifsCount: 0 }]]);
});

test("mark-all stops at a failed chunk without resetting the counter", async () => {
  mockGetDocs
    .mockResolvedValueOnce({ docs: unreadDocs(400) })
    .mockRejectedValueOnce(new Error("offline"));
  await expect(markAllNotificationsRead("u")).rejects.toThrow("offline");
  expect(mockBatches[0].commit).toHaveBeenCalledTimes(1);
  expect(mockBatches.flatMap((batch) => batch.updates).some(([ref]) => ref === "Users/u")).toBe(false);
});
