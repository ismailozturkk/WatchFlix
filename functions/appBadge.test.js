"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  badgeForPush,
  chatIdForMessage,
  computeAppBadge,
  pairChatId,
  sumUnreadMessages,
  toCount,
} = require("./appBadge");

test("toCount bozuk girdiyi 0'a, geçerliyi tam sayıya çevirir", () => {
  assert.equal(toCount(3), 3);
  assert.equal(toCount(2.9), 2);
  assert.equal(toCount("5"), 5);
  assert.equal(toCount(-2), 0);
  assert.equal(toCount(NaN), 0);
  assert.equal(toCount(undefined), 0);
  assert.equal(toCount(null), 0);
  assert.equal(toCount(Infinity), 0);
});

test("sumUnreadMessages dokümanlardaki unreadCount toplamını verir", () => {
  const docs = [
    { data: () => ({ unreadCount: 2 }) },
    { data: () => ({ unreadCount: 3 }) },
    { data: () => ({}) },
    { data: () => ({ unreadCount: -9 }) },
  ];
  assert.equal(sumUnreadMessages(docs), 5);
  // düz nesne de kabul edilir (testlerde ve select() sonuçlarında kolaylık)
  assert.equal(sumUnreadMessages([{ unreadCount: 4 }, { unreadCount: 1 }]), 5);
  assert.equal(sumUnreadMessages([]), 0);
  assert.equal(sumUnreadMessages(undefined), 0);
});

test("computeAppBadge istemcideki utils/appBadge.js ile aynı toplamı verir", () => {
  assert.equal(computeAppBadge({ unreadMessages: 3, pendingRequests: 2 }), 5);
  assert.equal(computeAppBadge({ unreadMessages: 0, pendingRequests: 0 }), 0);
  assert.equal(computeAppBadge(), 0);
  assert.equal(computeAppBadge({ unreadMessages: -4, pendingRequests: 1 }), 1);
});

test("1-1 mesaj push'u en az 1 rozet taşır (sayaç yarışına karşı taban)", () => {
  assert.equal(
    badgeForPush({ type: "message" }, { unreadMessages: 0, pendingRequests: 0 }),
    1,
  );
  assert.equal(
    badgeForPush({ type: "message" }, { unreadMessages: 4, pendingRequests: 1 }),
    5,
  );
});

test("grup mesajı ve diğer türlerde taban YOK (sayılmayan şey rozete yazılmaz)", () => {
  assert.equal(
    badgeForPush({ type: "message", groupId: "g1" }, { unreadMessages: 0, pendingRequests: 0 }),
    0,
  );
  assert.equal(
    badgeForPush({ type: "post_like" }, { unreadMessages: 0, pendingRequests: 0 }),
    0,
  );
  assert.equal(
    badgeForPush({ type: "friend_request" }, { unreadMessages: 0, pendingRequests: 2 }),
    2,
  );
});

test("pairChatId ChatScreen formülüyle aynı: büyük uid başta", () => {
  assert.equal(pairChatId("aaa", "bbb"), "bbb_aaa");
  assert.equal(pairChatId("bbb", "aaa"), "bbb_aaa");
  assert.equal(pairChatId("aaa", ""), null);
  assert.equal(pairChatId(null, "aaa"), null);
});

test("chatIdForMessage: grup → groupId, 1-1 → çift, mesaj değilse null", () => {
  assert.equal(chatIdForMessage({ type: "message", groupId: "g9" }, "me"), "g9");
  assert.equal(chatIdForMessage({ type: "message", fromUid: "friend" }, "me"), "me_friend");
  assert.equal(chatIdForMessage({ type: "post_like", fromUid: "friend" }, "me"), null);
  assert.equal(chatIdForMessage(null, "me"), null);
});
