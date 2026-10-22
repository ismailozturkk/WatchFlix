const { buildShareMessage, buildCineRoomShare, buildChallengeShare } = require("../utils/chatShare");
const { invitationFieldsFromMessage, pendingInvitations, invitationDestination } = require("../utils/importantInvites");

const now = new Date("2026-10-22T12:00:00Z").getTime();

test("only validated CineSwipe and daily duel chat cards become priority invitations", () => {
  expect(invitationFieldsFromMessage(buildShareMessage(buildCineRoomShare({ code: "123456" })))).toEqual({
    type: "cineswipe_invite", inviteCode: "123456",
  });
  expect(invitationFieldsFromMessage(buildShareMessage(buildChallengeShare({ dayKey: "2026-10-22", score: 100 })))).toEqual({
    type: "game_challenge", dayKey: "2026-10-22",
  });
  expect(invitationFieldsFromMessage({ kind: "cineRoomShare", share: { type: "cineRoom", code: "bad" } })).toBeNull();
  expect(invitationFieldsFromMessage({ kind: "message", text: "hello" })).toBeNull();
});

test("pending filter keeps read but unanswered invitations, removes expired and answered ones", () => {
  const items = [
    { id: "open", type: "cineswipe_invite", inviteCode: "123456", createdAt: now - 1000, read: true },
    { id: "old", type: "cineswipe_invite", inviteCode: "123456", createdAt: now - 25 * 3600000 },
    { id: "played", type: "game_challenge", dayKey: "2026-10-22", response: "accepted" },
    { id: "today", type: "game_challenge", dayKey: "2026-10-22" },
    { id: "yesterday", type: "game_challenge", dayKey: "2026-10-21" },
  ];
  expect(pendingInvitations(items, now).map((item) => item.id)).toEqual(["open", "today"]);
});

test("accept destinations carry the room code and daily mode", () => {
  expect(invitationDestination({ type: "cineswipe_invite", inviteCode: "123456" })).toEqual({
    name: "CineSwipeScreen", params: { initialMode: "duo", inviteCode: "123456", autoJoin: true },
  });
  jest.useFakeTimers().setSystemTime(now);
  expect(invitationDestination({ type: "game_challenge", dayKey: "2026-10-22" })).toEqual({
    name: "SceneGamePlayScreen",
    params: expect.objectContaining({ modeId: "daily", difficultyId: "normal" }),
  });
  expect(invitationDestination({ type: "game_challenge", dayKey: "2026-10-21" })).toBeNull();
  expect(invitationDestination({ type: "cineswipe_invite", inviteCode: "123456", response: "declined" })).toBeNull();
  jest.useRealTimers();
});
