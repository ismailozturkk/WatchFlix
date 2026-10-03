"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { connIdFromFlag, isRecipientViewingChat } = require("./chatPresence");

// Yol → değer haritasından sahte RTDB.
function fakeRtdb(data) {
  return {
    reads: [],
    ref(path) {
      const self = this;
      return {
        async get() {
          self.reads.push(path);
          const value = data[path];
          return { val: () => (value === undefined ? null : value), exists: () => value !== undefined };
        },
      };
    },
  };
}

test("connIdFromFlag: yalnız makul uzunlukta, güvenli karakterli string kabul edilir", () => {
  assert.equal(connIdFromFlag("-OabcXYZ_1"), "-OabcXYZ_1");
  assert.equal(connIdFromFlag(true), null); // eski istemci boolean'ı
  assert.equal(connIdFromFlag(false), null);
  assert.equal(connIdFromFlag(null), null);
  assert.equal(connIdFromFlag(""), null);
  assert.equal(connIdFromFlag("a".repeat(65)), null);
  assert.equal(connIdFromFlag("a/b"), null); // yol enjeksiyonu
  assert.equal(connIdFromFlag("a.b"), null);
});

test("alıcının bağlantısı canlıysa push susturulur", async () => {
  const rtdb = fakeRtdb({
    "chatMeta/a_b/inChat/me": "conn1",
    "presence/me/conns/conn1": 1700000000000,
  });
  assert.equal(await isRecipientViewingChat(rtdb, "a_b", "me"), true);
});

test("KÖK HATA: bayrak takılı ama bağlantı kaydı yoksa (uygulama kapandı) push GİDER", async () => {
  const rtdb = fakeRtdb({ "chatMeta/a_b/inChat/me": "conn1" });
  assert.equal(await isRecipientViewingChat(rtdb, "a_b", "me"), false);
});

test("bayrak başka (eski) bir bağlantıya aitse push gider", async () => {
  const rtdb = fakeRtdb({
    "chatMeta/a_b/inChat/me": "conn-old",
    "presence/me/conns/conn-new": 1,
  });
  assert.equal(await isRecipientViewingChat(rtdb, "a_b", "me"), false);
});

test("bayrak yoksa ya da eski boolean ise presence okunmaz, push gider", async () => {
  const none = fakeRtdb({});
  assert.equal(await isRecipientViewingChat(none, "a_b", "me"), false);
  assert.deepEqual(none.reads, ["chatMeta/a_b/inChat/me"]);

  const legacy = fakeRtdb({ "chatMeta/a_b/inChat/me": true });
  assert.equal(await isRecipientViewingChat(legacy, "a_b", "me"), false);
  assert.deepEqual(legacy.reads, ["chatMeta/a_b/inChat/me"]);
});

test("eksik girdi güvenli şekilde false döner", async () => {
  assert.equal(await isRecipientViewingChat(null, "a_b", "me"), false);
  assert.equal(await isRecipientViewingChat(fakeRtdb({}), "", "me"), false);
  assert.equal(await isRecipientViewingChat(fakeRtdb({}), "a_b", ""), false);
});
