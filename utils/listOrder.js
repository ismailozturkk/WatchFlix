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
