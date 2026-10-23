// utils/chatPush.js
//
// Giden mesajın push'unu kim dağıtır? Saf karar; ChatScreen.postMessage kullanır.
//
// Düz mesaj (metin, medya, anket, paylaşım kartı): mesaja `push: "server"` yazılır
// ve istemci BİLDİRİM BELGESİ YAZMAZ — sunucu mesaj tetikleyicisi alıcıları bulup
// push'u gönderir (functions/socialPush.js, SERVER_PUSH_MARKER ile AYNI değer).
// Eskiden gönderen her alıcı için bir bildirim belgesi + alıcının kök Users
// belgesine sayaç artışı yazıyordu (grupta mesaj başına 2×(üye−1) yazım).
//
// Davet (CineSwipe odası, günlük düello): bildirim belgesi KALIR — Bildirimler
// ekranındaki kabul/ret akışı o belgeye yazılıyor (utils/importantInvites.js).
// Davet mesajı işaret almaz; sunucu onu yok sayar, push'u bildirim belgesinden
// gelir (çift bildirim olmasın).

import { invitationFieldsFromMessage } from "./importantInvites";

export const SERVER_PUSH = "server";

/**
 * @param {object} messageData  Firestore'a yazılacak mesaj
 * @returns {{ message: object, invitation: object|null }}
 *   message    — belgeye yazılacak hali (düz mesajda işaretli)
 *   invitation — davet alanları (bildirim belgesi yazılacak) ya da null
 */
export function prepareOutgoingMessage(messageData) {
  const invitation = invitationFieldsFromMessage(messageData);
  if (invitation) return { message: messageData, invitation };
  return { message: { ...messageData, push: SERVER_PUSH }, invitation: null };
}
