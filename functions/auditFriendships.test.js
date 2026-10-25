"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { classifyFriendEntries } = require("./scripts/auditFriendships");

test("karşılıklı arkadaşlık temiz, karşılıksız kayıt şüpheli olarak listelenir", () => {
  const result = classifyFriendEntries([
    { owner: "a", friend: "b", data: { friendUid: "b", friendName: "B", friendsSince: 1 } },
    { owner: "b", friend: "a", data: { friendUid: "a", friendName: "A", friendsSince: 1 } },
    { owner: "victim", friend: "mallory", data: { friendUid: "mallory" } },
  ]);
  assert.equal(result.total, 3);
  assert.equal(result.mutual, 2);
  assert.deepEqual(result.oneSided, [
    { owner: "victim", friend: "mallory", hasFriendsSince: false, fields: ["friendUid"] },
  ]);
});

test("boş girdi", () => {
  assert.deepEqual(classifyFriendEntries([]), { total: 0, mutual: 0, oneSided: [] });
});
