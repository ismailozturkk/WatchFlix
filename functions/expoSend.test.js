"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { MIXED_PROJECTS_ERROR, splitByProject, sendExpoPushes } = require("./expoSend");

const silent = { warn() {}, error() {} };

// projectOf: token → Expo projesi. Bir istekte birden çok proje varsa gerçek Expo
// gibi isteğin TAMAMINI reddeder (details: { proje: [token] }).
function fakeExpo({ dead = [], projectOf = {}, failAll = null } = {}) {
  return {
    calls: [],
    chunkPushNotifications(messages) {
      const chunks = [];
      for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));
      return chunks;
    },
    async sendPushNotificationsAsync(chunk) {
      if (failAll) throw failAll;
      const details = {};
      for (const m of chunk) {
        const project = projectOf[m.to] || "@seelogd/app";
        (details[project] = details[project] || []).push(m.to);
      }
      if (Object.keys(details).length > 1) {
        const error = new Error("All push notification messages in the same request must be for the same project");
        error.code = MIXED_PROJECTS_ERROR;
        error.details = details;
        throw error;
      }
      this.calls.push(chunk.map((m) => m.to));
      return chunk.map((m) =>
        dead.includes(m.to) ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok" },
      );
    },
  };
}

const msgs = (...tokens) => tokens.map((to) => ({ to, title: "t", body: "b" }));

test("splitByProject: details'e göre gruplar; bilinmeyen token ayrı grupta", () => {
  const messages = msgs("A1", "B1", "A2", "X");
  const groups = splitByProject(messages, { "@a/app": ["A1", "A2"], "@b/eski": ["B1"] });
  assert.deepEqual(groups.map((g) => g.map((m) => m.to)), [["A1", "A2"], ["B1"], ["X"]]);
  assert.equal(splitByProject(messages, undefined).length, 1);
});

test("tek projede tek istek; ölü token'lar döner", async () => {
  const expo = fakeExpo({ dead: ["T2"] });
  const dead = await sendExpoPushes(expo, msgs("T1", "T2"), { log: silent });
  assert.deepEqual(expo.calls, [["T1", "T2"]]);
  assert.deepEqual(dead, ["T2"]);
});

// 22 Eki: aynı kullanıcının eski geliştirme build'inden kalan token'ı yüzünden
// haftalık özet / platform bildirimi o kişiye hiç gitmiyordu.
test("tek kullanıcının karışık proje token'ları: istek bölünür, iki cihaz da alır", async () => {
  const expo = fakeExpo({ projectOf: { ESKI: "@seelogd/eski-dev" }, dead: ["ESKI"] });
  const dead = await sendExpoPushes(expo, msgs("YENI", "ESKI"), { log: silent, label: "weeklyDigest" });
  assert.deepEqual(expo.calls, [["YENI"], ["ESKI"]]);
  assert.deepEqual(dead, ["ESKI"]);
});

test("bölünemeyen hata ve başka hatalar yeniden denenmez", async () => {
  const noDetails = Object.assign(new Error("mixed"), { code: MIXED_PROJECTS_ERROR });
  for (const failAll of [noDetails, new Error("ağ hatası")]) {
    let attempts = 0;
    const expo = fakeExpo({ failAll });
    const original = expo.sendPushNotificationsAsync.bind(expo);
    expo.sendPushNotificationsAsync = async (chunk) => {
      attempts += 1;
      return original(chunk);
    };
    const dead = await sendExpoPushes(expo, msgs("T1", "T2"), { log: silent });
    assert.equal(attempts, 1);
    assert.deepEqual(dead, []);
  }
});

test("boş liste hiçbir şey göndermez", async () => {
  const expo = fakeExpo();
  assert.deepEqual(await sendExpoPushes(expo, [], { log: silent }), []);
  assert.deepEqual(await sendExpoPushes(expo, undefined, { log: silent }), []);
  assert.equal(expo.calls.length, 0);
});
