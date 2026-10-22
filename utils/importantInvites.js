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

/** The chat message is the source of truth; only validated share cards become invitations. */
export function invitationFieldsFromMessage(message) {
  const share = readShare(message);
  if (share?.type === "cineRoom") return { type: INVITE_TYPES.cine, inviteCode: share.code };
  if (share?.type === "challenge") return { type: INVITE_TYPES.duel, dayKey: share.dayKey };
  return null;
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

export function invitationDestination(item) {
  if (item?.type === INVITE_TYPES.cine && /^\d{6}$/.test(String(item.inviteCode || ""))) {
    return { name: "CineSwipeScreen", params: { initialMode: "duo", inviteCode: item.inviteCode } };
  }
  if (item?.type === INVITE_TYPES.duel && item.dayKey === dayKeyOf()) {
    return {
      name: "SceneGamePlayScreen",
      params: { gameId: SCENE_GAME_ID, modeId: DAILY_MODE_ID, difficultyId: "normal", sourceId: DAILY_SOURCE_ID },
    };
  }
  return null;
}
