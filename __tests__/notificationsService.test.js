const mockDocs = new Map();
const mockTransaction = {
  get: jest.fn(async (ref) => ({ exists: () => mockDocs.has(ref), data: () => mockDocs.get(ref) })),
  update: jest.fn((ref, patch) => mockDocs.set(ref, { ...mockDocs.get(ref), ...patch })),
};
const mockGetDocs = jest.fn();
const mockOnSnapshot = jest.fn();
jest.mock("firebase/firestore", () => ({
  doc: (_db, ...parts) => parts.join("/"), collection: (_db, ...parts) => parts.join("/"),
  query: (...args) => args, orderBy: (...args) => ["orderBy", ...args], limit: (n) => ["limit", n],
  startAfter: (cursor) => ["startAfter", cursor],
  getDocs: (...args) => mockGetDocs(...args), onSnapshot: (...args) => mockOnSnapshot(...args),
  runTransaction: (_db, fn) => fn(mockTransaction),
}));
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../services/usageTrackerService", () => ({ trackFirestoreRead: jest.fn() }));
const { markNotificationRead, respondToInvitation, fetchOlderNotifications, subscribeToNotifications } = require("../services/notificationsService");

beforeEach(() => { jest.clearAllMocks(); mockDocs.clear(); });

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
