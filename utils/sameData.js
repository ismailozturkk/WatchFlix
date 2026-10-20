// utils/sameData.js
//
// "Bu veri gerçekten değişti mi?" — açılışta önbellekten gösterilip arka planda
// tazelenen her yüzeyin dayandığı karşılaştırmalar.
//
// NEDEN TEK YERDE: `sameJson` + `setIfChanged` ikilisi TvShowContex,
// MovieContex, ListStatusContext ve MediaActivityContext'te AYRI AYRI yazılıydı.
// Dördü de aynı satırdı, ama biri düzeltilse diğerleri sessizce eski davranışta
// kalırdı. Saf JS olduğu için jest bunu test edebiliyor (bkz. jest.config.js).

/** Derin eşitlik — anahtar sırası aynı üretildiği sürece güvenilir. */
export const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Değer gerçekten değiştiyse state'i günceller.
 *
 * NEDEN ÖNEMLİ: aynı diziyi yeni bir referansla set etmek React'ta yeniden
 * çizim demek. Önbellekten gösterip arka planda tazeleyen bir yüzeyde ağdan
 * AYNI veri geldiğinde ekranın titremesi bundan olurdu.
 */
export const setIfChanged = (setter, next) =>
  setter((current) => (sameJson(current, next) ? current : next));

/**
 * Listenin KİMLİK parmak izi: eleman kimlikleri + sıra.
 *
 * NEDEN AYRI BİR KARŞILAŞTIRMA: TMDB aynı listeyi her istekte biraz farklı
 * `popularity` / `vote_average` ondalıklarıyla döndürüyor. `sameJson` bunu
 * "değişti" sayar ve hiçbir kullanıcı farkı olmadan tüm ray yeniden çizilir.
 * Kimlik parmak izi yalnız içerik gerçekten değiştiğinde (yeni dizi girdi,
 * sıra değişti) farklı çıkar.
 */
export function listIdentity(list, idKey = "id") {
  if (!Array.isArray(list)) return "";
  let out = "";
  for (const item of list) {
    const id = item == null ? undefined : item[idKey];
    out += (id === undefined || id === null ? "?" : String(id)) + ",";
  }
  return out;
}

/** İki listenin kimlik/sıra olarak aynı olup olmadığı. */
export const sameListIdentity = (a, b, idKey = "id") =>
  listIdentity(a, idKey) === listIdentity(b, idKey);

/**
 * Liste state'ini yalnız KİMLİKLER değiştiyse günceller.
 *
 * Alan güncellemeleri (puan, oy sayısı) bilerek yok sayılır: kullanıcı için
 * görünür bir fark yaratmazlar, ama her açılışta tüm rayı yeniden çizerlerdi.
 * Gerçekten alan hassasiyeti gereken yerde `setIfChanged` kullanılmalı.
 */
export const setListIfChanged = (setter, next, idKey = "id") =>
  setter((current) => (sameListIdentity(current, next, idKey) ? current : next));
