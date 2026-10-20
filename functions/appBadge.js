"use strict";

// functions/appBadge.js
//
// Push'a yazılan uygulama simgesi rozeti (iOS) ve sohbet kimliği — saf yardımcılar.
//
// İSTEMCİDEKİ KARŞILIĞI: utils/appBadge.js (computeAppBadgeCount) ve
// services/activeChatTracker.js (pairChatId). Üçü de AYNI tanımı kullanmak
// zorunda; ayrışırlarsa uygulama açıkken görülen sayı ile kapalıyken bildirimin
// taşıdığı sayı birbirini ezer.
//
// Rozet = okunmamış 1-1 mesajlar + bekleyen gelen arkadaşlık istekleri.
// Neden böyle: bkz. utils/appBadge.js. Özeti — eski rozet, hiçbir ekranın
// okundu işaretlemediği bildirim dokümanlarını sayıyordu ve yalnız büyüyordu;
// ayrıca push'lar `badge` taşımadığından uygulama kapalıyken düzeltilemiyordu.

/** Negatif/NaN/ondalık girdiyi güvenli bir tam sayıya indirir. */
function toCount(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** conversations dokümanlarının unreadCount alanlarını toplar. */
function sumUnreadMessages(conversationDocs) {
  let total = 0;
  for (const doc of conversationDocs || []) {
    const data = typeof doc?.data === "function" ? doc.data() : doc;
    total += toCount(data?.unreadCount);
  }
  return total;
}

/**
 * @param {{ unreadMessages?: number, pendingRequests?: number }} counts
 * @returns {number} >= 0 tam sayı
 */
function computeAppBadge({ unreadMessages = 0, pendingRequests = 0 } = {}) {
  return toCount(unreadMessages) + toCount(pendingRequests);
}

/**
 * Bu push'un taşıyacağı rozet.
 *
 * 1-1 mesajda en az 1: bildirim, alıcının sohbeti açık tutmadığı doğrulandıktan
 * SONRA gönderiliyor, yani mesaj kesin okunmamış. İstemcinin sayaç artışı
 * bildirimden geç yazılmışsa (eski istemci sürümleri bildirimi sayaçtan ÖNCE
 * yazıyordu) toplam yeni mesajı henüz içermeyebilir; taban bu yarışı kapatır.
 */
function badgeForPush({ type, groupId }, counts) {
  const total = computeAppBadge(counts);
  const isDirectMessage = type === "message" && !groupId;
  return isDirectMessage ? Math.max(total, 1) : total;
}

/** 1-1 sohbet kimliği: iki uid, büyük olan başta (ChatScreen ile aynı formül). */
function pairChatId(uidA, uidB) {
  if (!uidA || !uidB) return null;
  return uidA > uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

/**
 * Bir mesaj bildiriminin sohbet kimliği. Mesaj değilse null.
 * Grup → groupId; 1-1 → gönderen + alıcı çifti.
 */
function chatIdForMessage(notification, recipientUid) {
  if (!notification || notification.type !== "message") return null;
  if (notification.groupId) return String(notification.groupId);
  return pairChatId(notification.fromUid, recipientUid);
}

module.exports = {
  toCount,
  sumUnreadMessages,
  computeAppBadge,
  badgeForPush,
  pairChatId,
  chatIdForMessage,
};
