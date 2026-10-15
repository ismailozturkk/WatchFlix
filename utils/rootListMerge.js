// utils/rootListMerge.js
//
// ESKİ MODELDEKİ özel liste (Lists/{uid}.<liste adı>[] kök dizisi) için SAF
// birleştirme planı. Firestore'a dokunmaz; services/listItemsService.js
// `addItemsToCustomRootList` bunu transaction içinde kullanır.
//
// NEDEN: kök dizi alanını `set(..., { merge: true })` ile `{ [ad]: yeniÖğeler }`
// diye yazmak, Firestore'da diziyi BİRLEŞTİRMEZ, TÜMÜYLE DEĞİŞTİRİR. Aynı gün ikinci
// kez "Liste yap"a basan kullanıcının ilk kayıttaki öğeleri sessizce silinirdi.

const keyOf = (item) => `${item?.type || "movie"}:${item?.id}`;

/**
 * @param {Array<object>} current   Listede şu an olan öğeler (sunucudaki güncel hâl).
 * @param {Array<object>} incoming  Eklenmek istenen öğeler.
 * @returns {{ merged: object[], added: object[] }}
 *   `merged` = mevcut sıra korunur, yeniler sona eklenir; `added` = gerçekten yeni olanlar.
 */
export function planRootListMerge(current, incoming) {
  const base = Array.isArray(current) ? current.filter(Boolean) : [];
  const have = new Set(base.map(keyOf));
  const added = [];
  for (const item of Array.isArray(incoming) ? incoming : []) {
    if (!item || item.id == null) continue;
    const key = keyOf(item);
    if (have.has(key)) continue;
    have.add(key);
    added.push(item);
  }
  return { merged: [...base, ...added], added };
}
