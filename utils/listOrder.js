/**
 * Liste öğelerinin GÖRÜNTÜLENME sırası — tek kaynak.
 *
 * Kullanıcı listedeki öğeleri elle sıralayabildiği için `listOrder` her zaman
 * önce gelir; olmayan (eski) kayıtlar ekleme tarihine, o da eşitse id'ye göre
 * dizilir. Profil rayı (screens/tabs/profile/ProfileLists.js) ve ana ekran
 * widget'ı (services/listsWidgetService.js) AYNI sırayı göstermek zorunda —
 * widget'ın ilk 3 posteri ile karttaki ilk 3 poster tutmazsa aynı listenin iki
 * farklı yüzü gibi görünür. Bu yüzden mantık burada ortak tutulur.
 */
export const sortItemsByListOrder = (items) =>
  (Array.isArray(items) ? items : []).slice().sort((a, b) => {
    const aHasOrder = Number.isFinite(a?.listOrder);
    const bHasOrder = Number.isFinite(b?.listOrder);

    if (aHasOrder && bHasOrder) {
      const orderDiff = a.listOrder - b.listOrder;
      if (orderDiff !== 0) return orderDiff;
    } else if (aHasOrder !== bHasOrder) {
      return aHasOrder ? -1 : 1;
    }

    const aDate = new Date(a?.dateAdded || 0).getTime() || 0;
    const bDate = new Date(b?.dateAdded || 0).getTime() || 0;
    return aDate - bDate || String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  });

/**
 * Elle taşıma sonrası yazılacak `listOrder` değerleri: ekrandaki NİHAİ sıradaki
 * her öğe için konumu (0…n-1), yalnız kayıtlı değeri farklı olanlar döner.
 *
 * NEDEN "yalnız taşınan aralık" DEĞİL: eskiden yalnız from…to aralığı yazılıyordu.
 * Silinen öğeler `listOrder`da boşluk bırakır (ör. [3, 4, 5]); aralık dışında kalan
 * öğenin eski değeri yeni yazılan küçük değerlerden BÜYÜK kalınca o öğe listenin
 * sonuna kayıyor, taşıma "işe yaramamış" gibi görünüyordu. Değer zaten konumuna
 * eşitse yazılmaz: bitişik listede yine yalnız taşınan aralık yazılır.
 *
 * @param {Array<{id:any, listOrder?:number}>} orderedItems ekrandaki nihai sıra
 * @returns {Array<{ item: object, index: number }>}
 */
export const listOrderWrites = (orderedItems) =>
  (Array.isArray(orderedItems) ? orderedItems : [])
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => item?.id != null && item.listOrder !== index);
