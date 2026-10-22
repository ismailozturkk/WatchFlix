import {
  notificationTime, mergeNotifications, notificationSections, notificationDateLabel,
  notificationDestination, notificationContent, notificationTone,
} from "../utils/notificationInbox";
import { notificationInboxCopy } from "../utils/notificationInboxCopy";
import { SUPPORTED_LANGUAGE_CODES } from "../utils/appLanguages";

const copy = notificationInboxCopy("tr");

test("timestamps accept Firestore, persisted data and Date; invalid dates stay unknown", () => {
  expect(notificationTime({ toMillis: () => 1234 })).toBe(1234);
  expect(notificationTime({ seconds: 2 })).toBe(2000);
  expect(notificationTime(new Date(5000))).toBe(5000);
  for (const invalid of [null, undefined, "bad date", NaN, Infinity, { toMillis: () => { throw Error(); } }]) {
    expect(notificationTime(invalid)).toBeNull();
  }
});

test("pagination deduplicates, respects live read state, sorts newest first and keeps unknown dates last", () => {
  const items = mergeNotifications(
    [{ id: "new", createdAt: 300, read: true }, { id: "last", createdAt: null }],
    [{ id: "new", createdAt: 300, read: false }, { id: "old", createdAt: 100, read: false }], new Set(["old"]),
  );
  expect(items.map((item) => item.id)).toEqual(["new", "old", "last"]);
  expect(items.slice(0, 2).every((item) => item.read)).toBe(true);
});

test("day groups use calendar days across month/year boundaries", () => {
  const sections = notificationSections([
    { createdAt: new Date(2026, 0, 1, 0, 1) },
    { createdAt: new Date(2025, 11, 31, 23, 59) },
    { createdAt: new Date(2025, 11, 29, 14) },
    { createdAt: null },
  ], "tr", copy, new Date(2026, 0, 1, 1));
  expect(sections.map((section) => section.title)).toEqual(["Bugün", "Dün", "29 Aralık 2025", copy.unknownDate]);
});

test.each(SUPPORTED_LANGUAGE_CODES)("%s has complete copy and relative plus exact date", (language) => {
  const localCopy = notificationInboxCopy(language);
  expect(Object.keys(localCopy).sort()).toEqual(Object.keys(copy).sort());
  const date = new Date(2026, 9, 21, 14, 35);
  const label = notificationDateLabel({ createdAt: date }, language, localCopy, date.getTime() + 120000);
  expect(label).toContain("2026");
  expect(label).toContain(" · ");
  expect(notificationDateLabel({}, language, localCopy)).toBe(localCopy.unknownDate);
});

test("destinations distinguish groups, direct chats, requests, accepted friends and post activity", () => {
  expect(notificationDestination({ type: "message", groupId: "g", fromUid: "u" })).toEqual({ name: "ChatScreen", params: { groupId: "g", groupName: "" } });
  expect(notificationDestination({ type: "message", fromUid: "u" }).params.friendUid).toBe("u");
  expect(notificationDestination({ type: "friend_request" }).name).toBe("FriendRequestsScreen");
  expect(notificationDestination({ type: "friend_accepted", fromUid: "u" }).name).toBe("FriendProfileScreen");
  for (const type of ["post_like", "post_comment", "comment_reply", "mention"]) {
    expect(notificationDestination({ type, postId: "p" }).params).toEqual({ postId: "p", openComments: type !== "post_like" });
  }
  expect(notificationDestination({ type: "post_comment" })).toBeNull();
  expect(notificationDestination({ type: "message" })).toBeNull();
  expect(notificationDestination({ type: "future_type" })).toBeNull();
});

test("group message details include sender and the full stored text", () => {
  const content = notificationContent({ type: "message", groupId: "g", groupName: "Film kulübü", fromName: "Ada", text: "İzleyelim mi?" }, { notifBodyMessage: "sana bir mesaj gönderdi" }, copy);
  expect(content.title).toBe("Film kulübü");
  expect(content.detail).toBe("Ada: İzleyelim mi?");
});

test("invitation history shows accepted and declined decisions", () => {
  expect(notificationContent({ type: "cineswipe_invite", response: "accepted" }, {}, copy).responseLabel).toBe(copy.acceptedInvite);
  expect(notificationContent({ type: "game_challenge", response: "declined" }, {}, copy).responseLabel).toBe(copy.declinedInvite);
  expect(notificationContent({ type: "game_challenge" }, {}, copy).responseLabel).toBe("");
  expect(notificationDestination({ type: "cineswipe_invite", inviteCode: "123456", response: "declined" })).toBeNull();
  expect(notificationDestination({ type: "cineswipe_invite", inviteCode: "123456" })).toBeNull();
  expect(notificationDestination({ type: "cineswipe_invite", inviteCode: "123456", response: "accepted" })?.name).toBe("CineSwipeScreen");
});

describe("device runtimes without RelativeTimeFormat", () => {
  const original = Object.getOwnPropertyDescriptor(Intl, "RelativeTimeFormat");
  beforeEach(() => Object.defineProperty(Intl, "RelativeTimeFormat", { configurable: true, value: undefined }));
  afterEach(() => Object.defineProperty(Intl, "RelativeTimeFormat", original));

  test.each([
    ["tr", "2 dakika önce"], ["en", "2 minutes ago"], ["es", "hace 2 minutos"],
    ["pt", "há 2 minutos"], ["de", "vor 2 Minuten"],
  ])("%s preserves relative and exact dates when the constructor is missing", (language, expected) => {
    const date = new Date(2026, 9, 21, 14, 35);
    const label = notificationDateLabel({ createdAt: date }, language, notificationInboxCopy(language), date.getTime() + 120000);
    expect(label.startsWith(`${expected} · `)).toBe(true);
    expect(label).toContain("2026");
  });

  test.each([
    [-1000, "şimdi"], [0, "şimdi"], [59000, "59 saniye önce"],
    [60000, "1 dakika önce"], [3600000, "1 saat önce"], [86400000, "1 gün önce"],
  ])("fallback handles elapsed milliseconds %i", (elapsed, expected) => {
    const label = notificationDateLabel({ createdAt: 100000000 }, "tr", copy, 100000000 + elapsed);
    expect(label.startsWith(`${expected} · `)).toBe(true);
  });

  test("a present but failing Intl constructor also uses the localized fallback", () => {
    Object.defineProperty(Intl, "RelativeTimeFormat", { configurable: true, value: function () { throw new RangeError("Unsupported locale"); } });
    expect(notificationDateLabel({ createdAt: 1000 }, "tr", copy, 121000)).toMatch(/^2 dakika önce · /);
  });
});

test("her bildirim türünün simge tonu var; bilinmeyen tür temanın vurgu rengine düşer", () => {
  expect(notificationTone("post_like")).toBe("red");
  expect(notificationTone("friend_request")).toBe("blue");
  expect(notificationTone("friend_accepted")).toBe("green");
  expect(notificationTone("post_comment")).toBe("purple");
  expect(notificationTone("comment_reply")).toBe("purple");
  expect(notificationTone("mention")).toBe("orange");
  expect(notificationTone("message")).toBe("accent");
  expect(notificationTone("bilinmeyen")).toBe("accent");
  expect(notificationTone(undefined)).toBe("accent");
});

test("notificationContent tonu simgeyle birlikte döner", () => {
  expect(notificationContent({ type: "post_like", fromName: "Ada" }, {}, copy)).toMatchObject({ icon: "heart-outline", tone: "red" });
  expect(notificationContent({ type: "x" }, {}, copy)).toMatchObject({ icon: "notifications-outline", tone: "accent" });
});
