import { intlLocaleOf } from "./appLanguages";
import { invitationDestination } from "./importantInvites";

export function notificationTime(value) {
  if (value == null) return null;
  try {
    const ms = typeof value.toMillis === "function" ? value.toMillis()
      : typeof value.seconds === "number" ? value.seconds * 1000
        : value instanceof Date ? value.getTime()
          : typeof value === "number" ? value : Date.parse(value);
    return Number.isFinite(ms) && !Number.isNaN(new Date(ms).getTime()) ? ms : null;
  } catch { return null; }
}

export function mergeNotifications(recent, older, readIds = new Set()) {
  const byId = new Map();
  // Realtime records take precedence over a previously fetched page.
  [...older, ...recent].forEach((item) => {
    byId.set(item.id, readIds.has(item.id) ? { ...item, read: true } : item);
  });
  return [...byId.values()].sort((a, b) =>
    (notificationTime(b.createdAt) ?? -Infinity) - (notificationTime(a.createdAt) ?? -Infinity)
    || String(a.id).localeCompare(String(b.id)));
}

const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export function notificationSections(items, language, copy, now = new Date()) {
  const today = dayKey(now);
  const previous = new Date(now);
  previous.setDate(previous.getDate() - 1);
  const yesterday = dayKey(previous);
  const groups = new Map();
  items.forEach((item) => {
    const ms = notificationTime(item.createdAt);
    const date = ms === null ? null : new Date(ms);
    const key = date ? dayKey(date) : "unknown";
    if (!groups.has(key)) {
      const title = key === today ? copy.today : key === yesterday ? copy.yesterday
        : date ? date.toLocaleDateString(intlLocaleOf(language), { day: "numeric", month: "long", year: "numeric" }) : copy.unknownDate;
      groups.set(key, { key, title, data: [] });
    }
    groups.get(key).data.push(item);
  });
  return [...groups.values()];
}

export function notificationDateLabel(item, language, copy, now = Date.now()) {
  const ms = notificationTime(item.createdAt);
  if (ms === null) return copy.unknownDate;
  const locale = intlLocaleOf(language);
  const exact = new Date(ms).toLocaleString(locale, {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const seconds = Math.max(0, Math.floor((now - ms) / 1000));
  const [amount, unit] = seconds < 60 ? [seconds, "second"] : seconds < 3600
    ? [Math.floor(seconds / 60), "minute"] : seconds < 86400
      ? [Math.floor(seconds / 3600), "hour"] : [Math.floor(seconds / 86400), "day"];
  // Some device runtimes support date formatting but not RelativeTimeFormat.
  // Keep the relative label localized without requiring a native rebuild/polyfill.
  let relative = copy.relativeTime(amount, unit);
  try {
    if (typeof Intl !== "undefined" && typeof Intl.RelativeTimeFormat === "function") {
      relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-amount, unit);
    }
  } catch {
    // Partial Intl implementations can also reject a supported app locale.
  }
  return `${relative} · ${exact}`;
}

const TYPES = {
  friend_request: ["person-add-outline", "notifBodyFriendRequest"],
  friend_accepted: ["people-outline", "notifBodyFriendAccepted"],
  post_like: ["heart-outline", "notifBodyPostLike"],
  post_comment: ["chatbubble-outline", "notifBodyPostComment"],
  comment_reply: ["return-down-forward-outline", "notifBodyCommentReply"],
  mention: ["at-outline", "notifBodyMention"],
  message: ["mail-outline", "notifBodyMessage"],
  cineswipe_invite: ["film-outline", null],
  game_challenge: ["flash-outline", null],
};

// Bildirim türünün simge tonu: theme.colors anahtarı (ekran temadan çözer; böylece her temada
// okunur). Beğeni kırmızı, istek mavi, kabul yeşil, yorum/yanıt mor, anma turuncu; mesaj ve
// bilinmeyen türler temanın vurgu rengi ("accent").
const TONES = {
  friend_request: "blue",
  friend_accepted: "green",
  post_like: "red",
  post_comment: "purple",
  comment_reply: "purple",
  mention: "orange",
  cineswipe_invite: "red",
  game_challenge: "orange",
};

/** @returns {"red"|"blue"|"green"|"purple"|"orange"|"accent"} */
export function notificationTone(type) {
  return TONES[type] || "accent";
}

export function notificationContent(item, t, copy) {
  const [icon, key] = TYPES[item.type] || ["notifications-outline", null];
  const responseLabel = item.type === "cineswipe_invite" || item.type === "game_challenge"
    ? item.response === "accepted" ? copy.acceptedInvite : item.response === "declined" ? copy.declinedInvite : ""
    : "";
  return {
    icon,
    tone: notificationTone(item.type),
    title: item.groupName || item.fromName || item.title || t.someone || copy.title,
    action: item.type === "cineswipe_invite" ? copy.cineInvite
      : item.type === "game_challenge" ? copy.duelInvite
        : key ? t[key] || copy.title : item.body || copy.title,
    detail: item.text ? `${item.groupId && item.fromName ? `${item.fromName}: ` : ""}${item.text}` : "",
    responseLabel,
  };
}

export function notificationDestination(item) {
  if (item.type === "cineswipe_invite" || item.type === "game_challenge") {
    return item.response === "accepted" ? invitationDestination(item) : null;
  }
  if (item.type === "friend_request") return { name: "FriendRequestsScreen" };
  if (item.type === "friend_accepted" && item.fromUid) return {
    name: "FriendProfileScreen", params: { friendUid: item.fromUid, friendName: item.fromName || "" },
  };
  if (item.type === "message") {
    if (item.groupId) return { name: "ChatScreen", params: { groupId: item.groupId, groupName: item.groupName || "" } };
    if (item.fromUid) return { name: "ChatScreen", params: { friendUid: item.fromUid, friendName: item.fromName || "" } };
  }
  if (["post_like", "post_comment", "comment_reply", "mention"].includes(item.type) && item.postId) {
    return { name: "PostDetailScreen", params: { postId: item.postId, openComments: item.type !== "post_like" } };
  }
  return null;
}
