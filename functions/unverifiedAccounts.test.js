const test = require("node:test");
const assert = require("node:assert/strict");
const {
  STALE_UNVERIFIED_DAYS,
  isAccountVerified,
  isReplaceableUnverified,
  isStaleUnverified,
  verifiedUidSet,
} = require("./unverifiedAccounts");

const NOW = Date.UTC(2026, 10, 30);
const DAY = 24 * 60 * 60 * 1000;
const rec = (over = {}) => ({
  uid: "u1",
  emailVerified: false,
  disabled: false,
  providerData: [{ providerId: "password" }],
  metadata: { creationTime: new Date(NOW - 10 * DAY).toUTCString() },
  ...over,
});

test("doğrulanmış: e-posta doğrulandı ya da Google/Apple bağlı", () => {
  assert.equal(isAccountVerified(rec({ emailVerified: true })), true);
  assert.equal(isAccountVerified(rec({ providerData: [{ providerId: "password" }, { providerId: "google.com" }] })), true);
  assert.equal(isAccountVerified(rec({ providerData: [{ providerId: "apple.com" }] })), true);
  assert.equal(isAccountVerified(rec()), false);
  assert.equal(isAccountVerified(null), false);
});

test("silinebilir: YALNIZ şifreli, doğrulanmamış, devre dışı değil", () => {
  assert.equal(isReplaceableUnverified(rec()), true);
  assert.equal(isReplaceableUnverified(rec({ emailVerified: true })), false);
  assert.equal(isReplaceableUnverified(rec({ disabled: true })), false);
  assert.equal(isReplaceableUnverified(rec({ providerData: [{ providerId: "password" }, { providerId: "google.com" }] })), false);
  assert.equal(isReplaceableUnverified(rec({ providerData: [{ providerId: "phone" }] })), false);
  assert.equal(isReplaceableUnverified(rec({ providerData: [] })), false);
});

test(`bayat: ${STALE_UNVERIFIED_DAYS} günden eski doğrulanmamış hesap; yeni kayıt korunur`, () => {
  assert.equal(isStaleUnverified(rec(), NOW), true);
  const fresh = rec({ metadata: { creationTime: new Date(NOW - 2 * DAY).toUTCString() } });
  assert.equal(isStaleUnverified(fresh, NOW), false);
  assert.equal(isStaleUnverified(rec({ emailVerified: true }), NOW), false);
  assert.equal(isStaleUnverified(rec({ metadata: {} }), NOW), false);
});

test("verifiedUidSet: 100'lük parçalarla sorar, yalnız doğrulanmışları döner, kayıtsız uid düşer", async () => {
  const uids = Array.from({ length: 205 }, (_, i) => `u${i}`);
  const calls = [];
  const auth = {
    async getUsers(ids) {
      calls.push(ids.length);
      return {
        users: ids
          .filter(({ uid }) => uid !== "u3") // u3: Auth'ta yok
          .map(({ uid }) => rec({ uid, emailVerified: Number(uid.slice(1)) % 2 === 0 })),
      };
    },
  };
  const set = await verifiedUidSet(auth, [...uids, "u0", null]);
  assert.deepEqual(calls, [100, 100, 5]);
  assert.equal(set.has("u0"), true);
  assert.equal(set.has("u1"), false);
  assert.equal(set.has("u3"), false);
  assert.equal(set.size, 103);
});

test("verifiedUidSet: boş liste Auth'a gitmez", async () => {
  const auth = { getUsers: () => { throw new Error("çağrılmamalı"); } };
  assert.equal((await verifiedUidSet(auth, [])).size, 0);
});

test("kapıdan ÖNCE açılmış eski hesaplar silinmez/değiştirilmez (verisi olabilir)", () => {
  const legacy = rec({ metadata: { creationTime: new Date(Date.UTC(2026, 9, 1)).toUTCString() } });
  assert.equal(isReplaceableUnverified(legacy), false);
  assert.equal(isStaleUnverified(legacy, NOW), false);
  assert.equal(isReplaceableUnverified(rec({ metadata: {} })), false);
});
