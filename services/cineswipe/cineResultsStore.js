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
