// utils/groupLimits.js
//
// Grup üye tavanı — TEK kaynak. firestore.rules'taki `groupSizeOk` aynı sayıyı
// taşır; biri değişirse diğeri de değişmeli (__tests__/groupLimits.test.js
// kural dosyasındaki sayıyı buna karşı denetler).
//
// Neden tavan var: grup mesajının maliyeti üye sayısıyla doğrusal büyür. Gönderen
// her mesajda diğer üyelerin okunmamış sayacını (Users/{uid}/groupInbox/{groupId})
// mesajla AYNI batch'te artırır ve üye başına bir bildirim yazar. Tavan, tek
// mesajın telefondan yaptığı yazımı sınırlı tutar (Firestore batch'i en çok 500
// yazım alır; kural tarafındaki üyelik okuması da üye listesini taşır).

export const MAX_GROUP_MEMBERS = 50;

/** Gruba daha kaç kişi eklenebilir (kurucu dahil üye sayısından; negatif olmaz). */
export function groupSlotsLeft(memberCount) {
  const n = Math.floor(Number(memberCount));
  return Math.max(0, MAX_GROUP_MEMBERS - (Number.isFinite(n) && n > 0 ? n : 0));
}
