// services/chatInviteService.js
//
// Sohbetteki davet kartının (düello / CineSwipe odası) MESAJ üzerindeki yanıt durumunu yazar. Model ve
// kural adları utils/chatInvites.js'te; iki tarafın kartı bu alanlardan çizilir.
//   • yanıt  : accepts.{uid} / declines.{uid} = sunucu zamanı (yalnız kendi anahtarım, tek yön)
//   • bitiş  : done = { at, matches } (CineSwipe odası bitince, bir kez)
//
// Mesajın yolu sohbet hedefinden çıkar (utils/importantInvites.chatTargetOf alan adları): grup →
// groups/{id}/messages, 1-1 → chats/{sıralı uid}/messages. Çağıranlar hatayı yutar: kart yazılamazsa
// yanıt yine bildirim kaydında durur.

import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { INVITE_RESPONSE_FIELD, isInviteMessageId } from "../utils/chatInvites";
import { directChatId } from "./chatOutbox";

/** Davet mesajının belgesi; hedef ya da kimlik geçersizse null. */
export function inviteMessageRef(chat, messageId, uid) {
  if (!isInviteMessageId(messageId)) return null;
  if (typeof chat?.groupId === "string" && chat.groupId) return doc(db, "groups", chat.groupId, "messages", messageId);
  const friendUid = chat?.friendUid;
  if (typeof friendUid !== "string" || !friendUid || !uid || friendUid === uid) return null;
  return doc(db, "chats", directChatId(uid, friendUid), "messages", messageId);
}

/** Mesaja yazılacak yanıt alanı (ChatScreen kendi mesaj koleksiyonuyla da kullanır); geçersizse null. */
export function inviteResponsePatch(uid, response) {
  const field = INVITE_RESPONSE_FIELD[response];
  return uid && field ? { [`${field}.${uid}`]: serverTimestamp() } : null;
}

/** @returns {Promise<boolean>} yazıldı mı (eski kayıtta mesaj kimliği yoksa false) */
export async function writeInviteResponse({ uid, chat, messageId, response }) {
  const ref = inviteMessageRef(chat, messageId, uid);
  const patch = inviteResponsePatch(uid, response);
  if (!ref || !patch) return false;
  await updateDoc(ref, patch);
  return true;
}

/**
 * CineSwipe davet kartı "Tamamlandı"ya döner. İkinci yazım kuralca reddedilir (kayıt zaten var).
 * @returns {Promise<boolean>}
 */
export async function markCineInviteDone({ uid, chat, messageId, matches }) {
  const ref = inviteMessageRef(chat, messageId, uid);
  if (!ref) return false;
  const count = Number.isInteger(matches) ? Math.min(Math.max(matches, 0), 1000) : 0;
  await updateDoc(ref, { done: { at: serverTimestamp(), matches: count } });
  return true;
}
