const test = require("node:test");
const assert = require("node:assert/strict");
const { resultsDelivered, deleteDeliveredRoom, deleteExpiredRooms } = require("./cineRoomCleanup");

const finished = { status: "finished", hostUid: "host", guestUid: "guest" };
function fakeDb(records, queryIds = Object.keys(records)) {
  const deleted = [];
  const refs = queryIds.map((id) => ({ id, ref: { id } }));
  const query = { where: () => query, limit: () => query, get: async () => ({ docs: refs }) };
  return {
    deleted,
    collection: () => query,
    runTransaction: async (callback) => callback({
      get: async (ref) => ({ exists: !!records[ref.id], data: () => records[ref.id] }),
      delete: (ref) => { deleted.push(ref.id); delete records[ref.id]; },
    }),
  };
}

test("both participants must receive the final result before deletion", () => {
  assert.ok(!resultsDelivered({ ...finished, resultsReceived: ["host"] }));
  assert.ok(!resultsDelivered({ ...finished, resultsReceived: ["guest"] }));
  assert.ok(!resultsDelivered({ ...finished, resultsReceived: ["host", "outsider"] }));
  assert.ok(resultsDelivered({ ...finished, resultsReceived: ["host", "guest"] }));
  assert.ok(!resultsDelivered({ ...finished, status: "active", resultsReceived: ["host", "guest"] }));
});

test("acknowledged room is deleted exactly once and lists remain untouched", async () => {
  const records = { room: { ...finished, resultsReceived: ["host", "guest"] }, sharedList: { items: [1] } };
  const db = fakeDb(records);
  assert.equal(await deleteDeliveredRoom(db, { id: "room" }), true);
  assert.equal(await deleteDeliveredRoom(db, { id: "room" }), false);
  assert.deepEqual(db.deleted, ["room"]);
  assert.deepEqual(records.sharedList, { items: [1] });
});

test("one offline participant prevents immediate cleanup", async () => {
  const db = fakeDb({ room: { ...finished, resultsReceived: ["host"] } });
  assert.equal(await deleteDeliveredRoom(db, { id: "room" }), false);
  assert.deepEqual(db.deleted, []);
});

test("scheduled cleanup covers expired, abandoned and legacy rooms", async () => {
  const now = 1000000000;
  const db = fakeDb({
    expired: { ...finished, expiresAt: now - 1 },
    abandoned: { status: "active", expiresAt: now - 1 },
    legacy: { createdAt: { toMillis: () => now - 25 * 60 * 60 * 1000 } },
    extended: { ...finished, expiresAt: now + 60 * 60 * 1000 },
    recent: { createdAt: { toMillis: () => now } },
  });
  assert.equal(await deleteExpiredRooms(db, { fromMillis: (ms) => ms }, now), 3);
  assert.deepEqual(db.deleted.sort(), ["abandoned", "expired", "legacy"]);
});

test("a room removed after the query is harmless", async () => {
  const db = fakeDb({}, ["gone"]);
  assert.equal(await deleteExpiredRooms(db, { fromMillis: (ms) => ms }, 100), 0);
});
