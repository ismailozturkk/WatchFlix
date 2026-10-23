// utils/chatReceipts.js
//
// 1-1 sohbette "iletildi / görüldü" tikleri — saf model; ChatScreen kullanır.
//
// ESKİ MODEL (mesaj başına yazım): gönderenin telefonu kendi mesajı sunucuya
// ulaşınca `status: "delivered"` yazıyor (alıcıyla ilgisi yoktu, yalnız sunucu
// onayıydı), alıcı da sohbeti açınca okunmamış HER mesaja ayrı `status: "seen"`
// yazıyordu. 20 okunmamış mesaj = 20 yazım + iki tarafın dinleyicisinde 40 okuma.
//
// YENİ MODEL: sohbet belgesinde taraf başına tek okundu işareti —
// `chats/{chatId}.readAt.{uid}` = o kişinin GÖRDÜĞÜ en yeni gelen mesajın sunucu
// zamanı. Sohbeti açmak, kaç mesaj birikmiş olursa olsun tek yazım. Tikler
// türetilir:
//   • gönderiliyor (yerel/bekleyen)       → mesajın kendi durumu ("sending"/"sent")
//   • sunucuya ulaştı                     → "delivered" (eski yazımın görünümü)
//   • zamanı ≤ karşı tarafın readAt'i     → "seen"
// İşaret `serverTimestamp()` DEĞİL, görülen mesajın kendi zamanıdır: yazım anı ile
// listenin güncellenmesi arasında gelen ve henüz görülmemiş mesaj "görüldü"
// sayılmasın.
//
// GEÇİŞ: eski istemcilerin yazdığı `status: "seen"` görüldü sayılmaya devam eder.
// Eski sürüm GÖNDEREN, yeni sürüm alıcıdan mavi tik göremez (mesaja seen yazılmıyor).

/** Firestore Timestamp / Date / epoch ms → epoch ms (yoksa 0). */
export function receiptMs(value) {
  if (!value) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const ms = value.toMillis?.() ?? value.toDate?.()?.getTime?.() ?? value.getTime?.();
  return Number.isFinite(ms) ? ms : 0;
}

/** Sunucuya ulaşmış (zamanı sunucudan gelmiş) mesaj mı? */
function isServerConfirmed(message) {
  return Boolean(
    message &&
      message.id &&
      !message._optimistic &&
      !message._pendingWrite &&
      typeof message.timestamp?.toMillis === "function",
  );
}

/**
 * Karşı taraftan gelen, sunucu zamanlı en yeni mesaj (okundu işaretine yazılacak
 * zaman bundan alınır). Yoksa null.
 */
export function newestIncoming(messages, myUid) {
  let newest = null;
  let newestMs = 0;
  for (const m of messages || []) {
    if (!isServerConfirmed(m) || !m.senderId || m.senderId === myUid) continue;
    const ms = receiptMs(m.timestamp);
    if (ms > newestMs) {
      newest = m;
      newestMs = ms;
    }
  }
  return newest;
}

/**
 * Okundu işareti yazılmalı mı: görülen en yeni gelen mesaj, mevcut işaretten
 * YENİ ise. (İşaret yalnız ileri gider; aynı değeri tekrar yazmak boşa yazımdır.)
 */
export function shouldMarkRead(latestIncoming, myReadAt) {
  const latestMs = receiptMs(latestIncoming?.timestamp);
  return latestMs > 0 && latestMs > receiptMs(myReadAt);
}

/**
 * Benim mesajlarımın tik durumunu karşı tarafın okundu işaretinden türetir.
 * Değişmeyen mesajın nesnesi korunur; hiçbiri değişmediyse AYNI dizi döner
 * (balonlar gereksiz yere yeniden çizilmesin).
 */
export function applyReceipts(messages, { myUid, friendReadAt } = {}) {
  const list = messages || [];
  const readMs = receiptMs(friendReadAt);
  let changed = false;
  const next = list.map((m) => {
    if (!m || m.senderId !== myUid || !isServerConfirmed(m)) return m;
    const ms = receiptMs(m.timestamp);
    const seen = m.status === "seen" || (readMs > 0 && ms > 0 && ms <= readMs);
    const status = seen ? "seen" : "delivered";
    if (status === m.status) return m;
    changed = true;
    return { ...m, status };
  });
  return changed ? next : list;
}
