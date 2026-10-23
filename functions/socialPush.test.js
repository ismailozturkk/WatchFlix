"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  SERVER_PUSH_MARKER,
  buildMessageNotification,
  createSocialPush,
  directRecipient,
  groupRecipients,
  shouldServerPush,
} = require("./socialPush");
const { MIXED_PROJECTS_ERROR } = require("./expoSend");

// ─── Sahteler ──────────────────────────────────────────────────────────────
// Yol → veri haritasından Firestore. Sorgular yalnız rozet hesabının iki
// sorgusunu taklit eder (conversations unreadCount>0 ve friendRequests count).
function fakeDb(docs = {}, { unread = {}, pending = {} } = {}) {
  const reads = [];
  return {
    reads,
    doc(path) {
      return {
        async get() {
          reads.push(path);
          const data = docs[path];
          return { exists: data !== undefined, data: () => data };
        },
      };
    },
    collection(path) {
      const query = {
        where: () => query,
        select: () => query,
        count: () => ({
          async get() {
            reads.push(`${path}#count`);
            return { data: () => ({ count: pending[path] || 0 }) };
          },
        }),
        async get() {
          reads.push(`${path}#query`);
          return { docs: (unread[path] || []).map((n) => ({ data: () => ({ unreadCount: n }) })) };
        },
      };
      return query;
    },
  };
}

function fakeRtdb(data = {}) {
  return {
    ref(path) {
      return {
        async get() {
          const value = data[path];
          return { val: () => (value === undefined ? null : value), exists: () => value !== undefined };
        },
      };
    },
  };
}

// projectOf: token → Expo projesi. Bir istekte birden çok proje varsa gerçek Expo
// gibi isteğin TAMAMINI reddeder (details: { proje: [token] }).
function fakeExpo(deadTokens = [], projectOf = {}) {
  return {
    calls: [],
    rejected: 0,
    chunkPushNotifications(messages) {
      const chunks = [];
      for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));
      return chunks;
    },
    async sendPushNotificationsAsync(chunk) {
      const details = {};
      for (const m of chunk) {
        const project = projectOf[m.to] || "@seelogd/app";
        (details[project] = details[project] || []).push(m.to);
      }
      if (Object.keys(details).length > 1) {
        this.rejected += 1;
        const error = new Error("All push notification messages in the same request must be for the same project");
        error.code = MIXED_PROJECTS_ERROR;
        error.details = details;
        throw error;
      }
      this.calls.push(chunk);
      return chunk.map((m) =>
        deadTokens.includes(m.to)
          ? { status: "error", details: { error: "DeviceNotRegistered" } }
          : { status: "ok", id: "t" },
      );
    },
  };
}

const silent = { log() {}, warn() {}, error() {} };

function setup({
  docs = {},
  tokens = {},
  rtdbData = {},
  dead = [],
  unread = {},
  pending = {},
  projectOf = {},
} = {}) {
  const db = fakeDb(docs, { unread, pending });
  const expo = fakeExpo(dead, projectOf);
  const cleared = [];
  const contentCalls = [];
  const push = createSocialPush({
    db,
    rtdb: fakeRtdb(rtdbData),
    expo,
    buildContent: (n, lang) => {
      contentCalls.push({ n, lang });
      return { title: n.groupId ? n.groupName : n.fromName, body: n.text || "" };
    },
    pickNotificationLang: (v) => v || "tr",
    loadPushTokens: async (uid) => ({ tokens: tokens[uid] || [], priv: { uid } }),
    clearDeadPushTokens: async (uid, _userData, _priv, deadTokens) => {
      cleared.push({ uid, dead: deadTokens });
    },
    log: silent,
  });
  const sent = () => expo.calls.flat();
  return { push, db, expo, cleared, contentCalls, sent };
}

const marked = (extra = {}) => ({
  text: "Dune izledin mi?",
  senderId: "ali",
  push: SERVER_PUSH_MARKER,
  ...extra,
});

// ─── Saf yardımcılar ───────────────────────────────────────────────────────
test("shouldServerPush: yalnız işaretli ve göndereni olan mesaj", () => {
  assert.equal(shouldServerPush(marked()), true);
  assert.equal(shouldServerPush({ text: "x", senderId: "ali" }), false); // eski istemci
  assert.equal(shouldServerPush({ push: "server" }), false);
  assert.equal(shouldServerPush(null), false);
});

test("directRecipient: sohbet kimliğinden karşı taraf; bozuk kimlik null", () => {
  assert.equal(directRecipient("veli_ali", "ali"), "veli");
  assert.equal(directRecipient("veli_ali", "veli"), "ali");
  assert.equal(directRecipient("veli_ali", "mallory"), null); // gönderen taraf değil
  assert.equal(directRecipient("ali_ali", "ali"), null);
  assert.equal(directRecipient("ali", "ali"), null);
  assert.equal(directRecipient("a_b_c", "a"), null);
  assert.equal(directRecipient(undefined, "ali"), null);
});

test("groupRecipients: gönderen dışındaki benzersiz üyeler", () => {
  assert.deepEqual(groupRecipients(["ali", "veli", "ayse", "veli", "", null], "ali"), ["veli", "ayse"]);
  assert.deepEqual(groupRecipients(undefined, "ali"), []);
});

test("buildMessageNotification: eski bildirim belgesiyle aynı alanlar ve kırpma", () => {
  const n = buildMessageNotification({
    senderUid: "ali",
    senderName: "Ali",
    text: "x".repeat(200),
    groupId: "g1",
    groupName: "y".repeat(100),
  });
  assert.equal(n.type, "message");
  assert.equal(n.fromUid, "ali");
  assert.equal(n.text.length, 140);
  assert.equal(n.groupName.length, 80);
  assert.deepEqual(buildMessageNotification({ senderUid: "ali", senderName: "", text: "" }), {
    type: "message",
    fromUid: "ali",
    fromName: "",
  });
});

// ─── 1-1 mesaj ─────────────────────────────────────────────────────────────
const directDocs = {
  "Users/ali": { displayName: "Ali Yılmaz" },
  "Users/veli": { notificationLanguage: "en" },
};

test("işaretsiz (eski istemci) mesaj: hiçbir okuma, hiçbir push", async () => {
  const { push, db, sent } = setup({ docs: directDocs, tokens: { veli: ["T1"] } });
  const result = await push.deliverMessagePush({
    message: { text: "x", senderId: "ali" },
    chatId: "veli_ali",
  });
  assert.deepEqual(result, { skipped: "unmarked" });
  assert.deepEqual(db.reads, []);
  assert.equal(sent().length, 0);
});

test("1-1: alıcıya tek push; ad KÖK belgeden, remoteOnly + messageId + çift kimliği", async () => {
  const { push, sent, contentCalls } = setup({
    docs: directDocs,
    tokens: { veli: ["T1", "T2"] },
    unread: { "Users/veli/conversations": [2, 1] },
    pending: { "Users/veli/friendRequests": 1 },
  });
  await push.deliverMessagePush({
    message: marked({ senderName: "sahte ad" }),
    messageId: "m1",
    chatId: "veli_ali",
  });
  const messages = sent();
  assert.equal(messages.length, 2);
  assert.deepEqual(messages.map((m) => m.to), ["T1", "T2"]);
  assert.equal(messages[0].title, "Ali Yılmaz");
  assert.equal(messages[0].body, "Dune izledin mi?");
  assert.equal(messages[0].badge, 4);
  assert.equal(messages[0].data.type, "message");
  assert.equal(messages[0].data.remoteOnly, true);
  assert.equal(messages[0].data.messageId, "m1");
  assert.equal(messages[0].data.notifId, null);
  assert.equal(messages[0].data.chatId, "veli_ali");
  assert.equal(messages[0].data.fromUid, "ali");
  assert.equal(contentCalls[0].lang, "en");
});

test("1-1: alıcı göndereni engellediyse push yok", async () => {
  const { push, sent } = setup({
    docs: { ...directDocs, "Users/veli/blocked/ali": { at: 1 } },
    tokens: { veli: ["T1"] },
  });
  await push.deliverMessagePush({ message: marked(), chatId: "veli_ali" });
  assert.equal(sent().length, 0);
});

test("1-1: mesaj bildirimi ya da tüm bildirimler kapalıysa push yok", async () => {
  for (const settings of [{ messagesEnabled: false }, { enabled: false }]) {
    const { push, sent } = setup({
      docs: { ...directDocs, "Users/veli": { notificationSettings: settings } },
      tokens: { veli: ["T1"] },
    });
    await push.deliverMessagePush({ message: marked(), chatId: "veli_ali" });
    assert.equal(sent().length, 0, JSON.stringify(settings));
  }
});

test("1-1: alıcı sohbeti canlı bağlantıyla açık tutuyorsa push yok", async () => {
  const { push, sent } = setup({
    docs: directDocs,
    tokens: { veli: ["T1"] },
    rtdbData: {
      "chatMeta/veli_ali/inChat/veli": "conn1",
      "presence/veli/conns/conn1": 1,
    },
  });
  await push.deliverMessagePush({ message: marked(), chatId: "veli_ali" });
  assert.equal(sent().length, 0);
});

test("1-1: gönderen sohbetin tarafı değilse push yok", async () => {
  const { push, sent } = setup({ docs: directDocs, tokens: { veli: ["T1"] } });
  const result = await push.deliverMessagePush({
    message: marked({ senderId: "mallory" }),
    chatId: "veli_ali",
  });
  assert.deepEqual(result, { skipped: "no-recipient" });
  assert.equal(sent().length, 0);
});

// ─── Grup mesajı ───────────────────────────────────────────────────────────
const groupDocs = {
  "groups/g1": { name: "Film Gecesi", members: ["ali", "veli", "ayse", "can", "ali"] },
  "Users/ali": { displayName: "Ali" },
  "Users/veli": {},
  "Users/ayse": {},
  "Users/can": {},
  "Users/can/blocked/ali": { at: 1 },
};

test("grup: tüm alıcılar TEK gönderimde; engelleyen ve token'sız atlanır", async () => {
  const { push, expo, sent, contentCalls } = setup({
    docs: groupDocs,
    tokens: { veli: ["V1", "V2"], ayse: [], can: ["C1"] },
  });
  await push.deliverMessagePush({ message: marked(), messageId: "m9", groupId: "g1" });
  assert.equal(expo.calls.length, 1);
  assert.deepEqual(sent().map((m) => m.to), ["V1", "V2"]);
  const data = sent()[0].data;
  assert.equal(data.groupId, "g1");
  assert.equal(data.groupName, "Film Gecesi");
  assert.equal(data.chatId, "g1");
  assert.equal(data.remoteOnly, true);
  // İçerik, gönderen adı + grup adıyla kurulur.
  assert.equal(contentCalls[0].n.fromName, "Ali");
  assert.equal(contentCalls[0].n.groupName, "Film Gecesi");
});

test("grup: gönderen üye değilse ya da grup yoksa push yok", async () => {
  const notMember = setup({ docs: groupDocs, tokens: { veli: ["V1"] } });
  assert.deepEqual(
    await notMember.push.deliverMessagePush({ message: marked({ senderId: "mallory" }), groupId: "g1" }),
    { skipped: "not-member" },
  );
  const noGroup = setup({ docs: groupDocs, tokens: { veli: ["V1"] } });
  assert.deepEqual(
    await noGroup.push.deliverMessagePush({ message: marked(), groupId: "yok" }),
    { skipped: "no-group" },
  );
  assert.equal(notMember.sent().length + noGroup.sent().length, 0);
});

test("grup: ölü token yalnız sahibinin kaydından temizlenir", async () => {
  const { push, cleared } = setup({
    docs: groupDocs,
    tokens: { veli: ["V1", "V2"], ayse: ["A1"] },
    dead: ["V2"],
  });
  await push.deliverMessagePush({ message: marked(), groupId: "g1" });
  const byUid = Object.fromEntries(cleared.map((c) => [c.uid, c.dead]));
  assert.deepEqual(byUid, { veli: ["V2"], ayse: [] });
});

test("100'den fazla push parçalara bölünür ve ölü token sahibine doğru eşlenir", async () => {
  const members = ["ali", ...Array.from({ length: 60 }, (_, i) => `u${i}`)];
  const docs = { "groups/g2": { name: "Kalabalık", members }, "Users/ali": { displayName: "Ali" } };
  const tokens = {};
  members.slice(1).forEach((uid) => {
    docs[`Users/${uid}`] = {};
    tokens[uid] = [`${uid}-a`, `${uid}-b`];
  });
  const { push, expo, cleared } = setup({ docs, tokens, dead: ["u59-b"] });
  const result = await push.deliverMessagePush({ message: marked(), groupId: "g2" });
  assert.equal(result.sent, 120);
  assert.equal(expo.calls.length, 2);
  assert.deepEqual(cleared.find((c) => c.uid === "u59").dead, ["u59-b"]);
  assert.equal(cleared.filter((c) => c.dead.length > 0).length, 1);
});

// ─── Karışık Expo projesi (22 Eki günlüğündeki hata; bölme: expoSend.js) ───
test("grupta bir üyenin eski proje token'ı varsa istek bölünür, herkes push alır", async () => {
  const { push, expo, cleared } = setup({
    docs: groupDocs,
    tokens: { veli: ["V1"], ayse: ["A-eski", "A1"] },
    projectOf: { "A-eski": "@seelogd/eski-dev" },
    dead: ["A-eski"],
  });
  const result = await push.deliverMessagePush({ message: marked(), groupId: "g1" });
  assert.equal(expo.rejected, 1);
  assert.equal(expo.calls.length, 2);
  assert.deepEqual(expo.calls.flat().map((m) => m.to).sort(), ["A-eski", "A1", "V1"]);
  assert.equal(result.sent, 3);
  // Bölünmüş parçadaki ölü token da sahibinden temizlenir.
  assert.deepEqual(cleared.find((c) => c.uid === "ayse").dead, ["A-eski"]);
});

test("bölünemeyen karışık proje hatası tekrar denenmez (sonsuz döngü yok)", async () => {
  const db = fakeDb({ "Users/veli": {} });
  let attempts = 0;
  const expo = {
    chunkPushNotifications: (m) => [m],
    async sendPushNotificationsAsync() {
      attempts += 1;
      const error = new Error("mixed");
      error.code = MIXED_PROJECTS_ERROR; // details yok → bölünemez
      throw error;
    },
  };
  const push = createSocialPush({
    db,
    expo,
    buildContent: () => ({ title: "t", body: "b" }),
    pickNotificationLang: () => "tr",
    loadPushTokens: async () => ({ tokens: ["T1", "T2"], priv: {} }),
    clearDeadPushTokens: async () => {},
    log: silent,
  });
  const prepared = await push.prepare("veli", { type: "post_like", fromUid: "ali" }, { notifId: "n" });
  await push.send([prepared]);
  assert.equal(attempts, 1);
});

// ─── Bildirim belgesi yolu (onSocialNotificationCreated) ───────────────────
test("bildirim belgesi: notifId taşır, remoteOnly YOK, engel kontrolü yapılmaz", async () => {
  const { push, sent, db } = setup({
    docs: { "Users/veli": {}, "Users/veli/blocked/ali": { at: 1 } },
    tokens: { veli: ["T1"] },
  });
  const prepared = await push.prepare(
    "veli",
    { type: "post_like", fromUid: "ali", fromName: "Ali", postId: "p1" },
    { notifId: "n1" },
  );
  await push.send([prepared]);
  const [m] = sent();
  assert.equal(m.data.notifId, "n1");
  assert.equal(m.data.postId, "p1");
  assert.equal(m.data.remoteOnly, undefined);
  assert.equal(m.data.chatId, null);
  // Engel, bildirim belgesi yazılırken kuralda (notBlocked) denetlenir.
  assert.ok(!db.reads.includes("Users/veli/blocked/ali"));
});

test("bildirim belgesi: eski istemcinin 1-1 mesaj bildirimi sohbetteyken susar", async () => {
  const { push } = setup({
    docs: { "Users/veli": {} },
    tokens: { veli: ["T1"] },
    rtdbData: { "chatMeta/veli_ali/inChat/veli": "c1", "presence/veli/conns/c1": 1 },
  });
  const prepared = await push.prepare("veli", { type: "message", fromUid: "ali", text: "x" }, { notifId: "n2" });
  assert.equal(prepared, null);
});

test("send: boş liste hiçbir şey göndermez", async () => {
  const { push, expo } = setup();
  assert.deepEqual(await push.send([null, null]), { sent: 0, dead: 0 });
  assert.equal(expo.calls.length, 0);
});
