import { isInviteMessageId } from "./chatInvites";
import { readShare } from "./chatShare";
import { dayKeyOf } from "./dailyChallenge";
import { DAILY_MODE_ID, DAILY_SOURCE_ID } from "./dailyChallenge";
import { SCENE_GAME_ID } from "../screens/game/gameConfig";

export const INVITE_TYPES = Object.freeze({ cine: "cineswipe_invite", duel: "game_challenge" });
const DAY_MS = 24 * 60 * 60 * 1000;
const timeOf = (value) => {
  const raw = value?.toMillis?.() ?? (typeof value?.seconds === "number" ? value.seconds * 1000 : value);
  const ms = raw instanceof Date ? raw.getTime() : typeof raw === "string" ? Date.parse(raw) : Number(raw);
  return Number.isFinite(ms) ? ms : null;
};

/** Invitation fields of an already validated share body (see readShare). */
export function invitationFieldsFromShare(share) {
  if (share?.type === "cineRoom") return { type: INVITE_TYPES.cine, inviteCode: share.code };
  if (share?.type === "challenge") return { type: INVITE_TYPES.duel, dayKey: share.dayKey };
  return null;
}

/** The chat message is the source of truth; only validated share cards become invitations. */
export function invitationFieldsFromMessage(message) {
  return invitationFieldsFromShare(readShare(message));
}

export function isPendingInvitation(item, now = Date.now(), today = dayKeyOf(now)) {
  if (!item || item.response) return false;
  if (item.type === INVITE_TYPES.cine) {
    const created = timeOf(item.createdAt);
    return /^\d{6}$/.test(String(item.inviteCode || "")) && created !== null && now < created + DAY_MS;
  }
  if (item.type === INVITE_TYPES.duel) return item.dayKey === today;
  return false;
}

export const pendingInvitations = (items, now = Date.now()) =>
  (Array.isArray(items) ? items : []).filter((item) => isPendingInvitation(item, now));

/**
 * The chat an invitation came from: the group for a group invite, otherwise the 1-1 chat with the
 * sender. Results (duel scores, CineSwipe matches) are written back there. Same field names as the
 * ChatScreen route params.
 */
export function chatTargetOf({ groupId, groupName, fromUid, fromName } = {}) {
  if (typeof groupId === "string" && groupId) return { groupId, groupName: String(groupName || "") };
  if (typeof fromUid === "string" && fromUid) return { friendUid: fromUid, friendName: String(fromName || "") };
  return null;
}

/** Stable key of a chat target (dedupes a second write to the same chat). */
export const chatTargetKey = (chat) =>
  chat?.groupId ? `group:${chat.groupId}` : chat?.friendUid ? `dm:${chat.friendUid}` : null;

/**
 * Inbox records of an invitation answered from its chat card, so the priority bar stops asking again.
 * Match: type + sender + room code / day (+ group). Records that name their chat message (`messageId`,
 * written with the invitation) must name THIS card; older records without it match by the fields alone.
 */
export function matchingInvitationIds(
  items,
  { type, fromUid, inviteCode, dayKey, groupId, messageId } = {},
  now = Date.now(),
) {
  if (!type || !fromUid) return [];
  return pendingInvitations(items, now)
    .filter((item) => item.type === type && item.fromUid === fromUid)
    .filter((item) => (item.groupId || null) === (groupId || null))
    .filter((item) => (type === INVITE_TYPES.cine ? item.inviteCode === inviteCode : item.dayKey === dayKey))
    .filter((item) => !isInviteMessageId(messageId) || !item.messageId || item.messageId === messageId)
    .map((item) => item.id);
}

/**
 * Duel context handed to the daily game: when it ends, the result screen writes both scores to `chat`
 * (see hooks/useDuelResultReport). Null when the challenger or the chat is unknown.
 */
export function duelContextOf({ dayKey, hostUid, hostName, chat } = {}) {
  if (typeof dayKey !== "string" || !dayKey || typeof hostUid !== "string" || !hostUid || !chatTargetKey(chat)) {
    return null;
  }
  return { dayKey, hostUid, hostName: String(hostName || ""), chat };
}

export function dailyDuelRoute(duel) {
  return {
    name: "SceneGamePlayScreen",
    params: {
      gameId: SCENE_GAME_ID,
      modeId: DAILY_MODE_ID,
      difficultyId: "normal",
      sourceId: DAILY_SOURCE_ID,
      ...(duel ? { duel } : {}),
    },
  };
}

export function invitationDestination(item) {
  if (item?.response === "declined") return null;
  const chat = chatTargetOf(item || {});
  if (item?.type === INVITE_TYPES.cine && /^\d{6}$/.test(String(item.inviteCode || ""))) {
    // Davet kartının kimliği odaya taşınır: oda bitince kart iki tarafta "Tamamlandı" olur (utils/chatInvites).
    const card = chat && isInviteMessageId(item.messageId) ? { inviteMessageId: item.messageId } : {};
    return {
      name: "CineSwipeScreen",
      params: { initialMode: "duo", inviteCode: item.inviteCode, autoJoin: true, ...(chat ? { inviteChat: chat } : {}), ...card },
    };
  }
  if (item?.type === INVITE_TYPES.duel && item.dayKey === dayKeyOf()) {
    return dailyDuelRoute(duelContextOf({ dayKey: item.dayKey, hostUid: item.fromUid, hostName: item.fromName, chat }));
  }
  return null;
}
