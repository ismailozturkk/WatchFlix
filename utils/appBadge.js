// utils/appBadge.js
//
// Uygulama simgesi rozetinin (iOS ana ekran sayısı) TEK tanımı.
//
// ESKİ DAVRANIŞ (hata): rozet, `Users/{uid}/notifications` içindeki OKUNMAMIŞ
// bildirim dokümanlarının sayısıydı. Hiçbir ekran o dokümanları okundu
// işaretlemediği için sayı yalnızca büyüyordu; uygulama açılsa, mesajlar
// okunsa da sıfırlanmıyordu. Üstüne sunucu push'ları `badge` alanı da
// taşımadığından uygulama kapalıyken sayı hiç düzeltilemiyordu.
//
// YENİ TANIM: rozet, kullanıcının GERÇEKTEN bekleyen işleri:
//   okunmamış 1-1 mesajlar  (Users/{uid}/conversations/*.unreadCount toplamı)
// + bekleyen gelen arkadaşlık istekleri (Users/{uid}/friendRequests, pending)
// Bunların ikisi de kullanıcı eyleminde (sohbeti açmak, isteği yanıtlamak)
// kendiliğinden düşer — ayrı bir "okundu" bakımı gerekmez.
//
// Beğeni/yorum bildirimleri bilerek DAHİL DEĞİL: onları temizleyecek bir
// bildirim ekranı yok, rozete eklenirlerse yine sıfırlanamaz olurlardı. Grup
// mesajlarında da okunmamış sayacı tutulmuyor, o yüzden sayıma girmiyor.
//
// AYNI MANTIK functions/appBadge.js içinde (CommonJS, sunucu push'una `badge`
// yazar). İkisi birlikte güncellenmeli — iki taraf ayrışırsa uygulama açıkken
// görülen sayı ile kapalıyken bildirimin taşıdığı sayı birbirini ezer.

/** Negatif/NaN/ondalık girdiyi güvenli bir tam sayıya indirir. */
export function toCount(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * @param {{ unreadMessages?: number, incomingRequests?: number }} counts
 * @returns {number} >= 0 tam sayı
 */
export function computeAppBadgeCount({ unreadMessages = 0, incomingRequests = 0 } = {}) {
  return toCount(unreadMessages) + toCount(incomingRequests);
}
