// services/reportService.js
//
// Yorum / mesaj / kullanıcı şikâyetleri → ContentReports koleksiyonu.
//
// Koleksiyon CREATE-ONLY (firestore.rules): istemci kendi yazdığı şikâyeti
// bile geri okuyamaz. Sebebi iki taraflı — şikâyet edilen kişinin kendisi
// hakkındaki şikâyetleri görmesi engelleniyor ve şikâyet listesi bir
// "kimler kimi ihbar etti" veri tabanına dönüşmüyor. İnceleme Firebase
// konsolundan yapılıyor (iç moderasyon görünümü yol haritasında: D5).
//
// GÖNDERİ şikâyetleri BURADA DEĞİL: services/postsService.js → reportPost,
// PostReports koleksiyonu. Bilerek ayrı bırakıldı — birleştirmek var olan
// kayıtların taşınmasını ister ve o koleksiyonun kuralı zaten doğru.

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { buildReport } from "../utils/reportValidation";

/**
 * Doğrulanmış şikâyeti yazar. Doğrulama hatası ATILIR: çağıran taraf
 * kullanıcıya "gönderilemedi" toast'ı gösterebilsin (sessiz yutma yok —
 * mağaza şartı olan bir akışın sessizce çalışmaması en kötü durum).
 */
async function submit(input) {
  const result = buildReport(input);
  if (!result.ok) throw new Error(`report: gecersiz alan (${result.error})`);
  await addDoc(collection(db, "ContentReports"), {
    ...result.data,
    createdAt: serverTimestamp(),
  });
}

/**
 * Film/dizi yorumu ya da yanıtı.
 * @param {object} p
 * @param {string} p.targetPath  Yorumun tam Firestore yolu
 * @param {string} p.targetUserId Yorumu yazanın uid'i
 * @param {string} p.reporterId
 * @param {string} [p.text]      Yorum metni (önizleme için kırpılır)
 * @param {string} [p.reason]
 */
export function reportComment({ targetPath, targetUserId, reporterId, text, reason }) {
  return submit({
    type: "comment",
    targetPath,
    targetUserId,
    reporterId,
    targetPreview: text,
    reason,
  });
}

/**
 * DM ya da grup mesajı.
 * @param {object} p
 * @param {string} p.targetPath  chats/{chatId}/messages/{msgId} veya groups/...
 * @param {string} p.targetUserId Mesajı gönderenin uid'i
 */
export function reportMessage({ targetPath, targetUserId, reporterId, text, reason }) {
  return submit({
    type: "message",
    targetPath,
    targetUserId,
    reporterId,
    targetPreview: text,
    reason,
  });
}

/**
 * Kullanıcının kendisi (profil). Önizleme yerine görünen ad gider —
 * moderatör hangi hesabın kastedildiğini uid'e bakmadan görsün.
 */
export function reportUser({ targetUserId, reporterId, displayName, reason }) {
  return submit({
    type: "user",
    targetPath: `Users/${targetUserId}`,
    targetUserId,
    reporterId,
    targetPreview: displayName,
    reason,
  });
}
