import { Keys, get, set } from "../storage";
import { acknowledgeCineResults } from "./cineswipeService";

// Keep just the latest completed round per account, never a Firestore history.
export async function persistCineResults(result, uid) {
  if (!uid || !result?.roomId || !result?.summary?.complete) throw new Error("invalid-result");
  const pending = { ...result, receiptPending: true };
  if (!set(Keys.cineLastResult, pending, { uid })) throw new Error("local-save-failed");
  await acknowledgeCineResults(result.roomId, uid);
  const saved = { ...result, receiptPending: false };
  // An acknowledgement for an old round must not replace a newer local result.
  if (get(Keys.cineLastResult, { uid })?.roomId === result.roomId) {
    set(Keys.cineLastResult, saved, { uid });
  }
  return saved;
}

// ── Round history (device-local, like the latest result) ─────────────────────
// Newest first, capped. Each entry has the same shape as a result (roomId, room, summary) plus
// `finishedAt`, so the results modal opens it like the latest one. Long card text is trimmed: the
// history keeps every match of up to MAX_CINE_HISTORY rounds in local storage.
export const MAX_CINE_HISTORY = 20;
const OVERVIEW_MAX = 280;

const isEntry = (entry) =>
  !!entry?.roomId && !!entry.room && Array.isArray(entry.summary?.matches) && entry.summary.complete === true;

function compactMatch(media) {
  return {
    id: media.id,
    title: media.title || media.name || "",
    mediaType: media.mediaType || media.media_type || "movie",
    poster_path: media.poster_path || "",
    backdrop_path: media.backdrop_path || "",
    release_date: media.release_date || "",
    vote_average: typeof media.vote_average === "number" ? media.vote_average : 0,
    overview: String(media.overview || "").slice(0, OVERVIEW_MAX),
    genre_ids: Array.isArray(media.genre_ids) ? media.genre_ids.slice(0, 3) : [],
  };
}

/**
 * Past rounds, newest first. The single "last result" saved before history existed is shown as the
 * newest entry until the next round writes the history (it is then carried over).
 */
export function readCineHistory(uid) {
  if (!uid) return [];
  const stored = get(Keys.cineResultHistory, { uid });
  const history = (Array.isArray(stored) ? stored : []).filter(isEntry);
  const last = get(Keys.cineLastResult, { uid });
  if (isEntry(last) && !history.some((entry) => entry.roomId === last.roomId)) {
    const { receiptPending, ...entry } = last;
    return [{ ...entry, finishedAt: entry.finishedAt ?? null }, ...history].slice(0, MAX_CINE_HISTORY);
  }
  return history;
}

/** Adds a completed round once (idempotent per room). @returns {boolean} stored */
export function recordCineHistory(result, uid, now = Date.now()) {
  if (!uid || !isEntry(result)) return false;
  const history = readCineHistory(uid);
  if (history.some((entry) => entry.roomId === result.roomId)) return true;
  const entry = {
    roomId: result.roomId,
    finishedAt: now,
    room: result.room,
    summary: { ...result.summary, matches: result.summary.matches.map(compactMatch) },
  };
  return set(Keys.cineResultHistory, [entry, ...history].slice(0, MAX_CINE_HISTORY), { uid });
}
