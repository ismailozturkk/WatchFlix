// utils/randomPick.js
//
// Düzgün dağılımlı tamsayı/eleman seçimi.
//
// Neden düz `Math.floor(Math.random() * n)` değil:
//   1) Hermes'in Math.random()'ı xorshift128+ ve tohum süreç ömrü boyunca sabit.
//      Kayıt ekranı gibi "uygulama açılır açılmaz bir kez çekilen" yerlerde
//      dağılım gözle görülür şekilde kümeleniyor.
//   2) Bayt tabanlı üretimde `% n` almak, n ikinin kuvveti değilken küçük
//      index'leri sistematik olarak öne çıkarır (modulo bias). 56 avatar için
//      0-31 arası %25 daha sık çıkardı.
//
// Çözüm: expo-crypto'nun senkron CSPRNG'inden bayt al, aralığın dışına düşen
// değerleri reddet (rejection sampling). Native modül yoksa Math.random'a düş.

let cryptoModule;
let cryptoUnavailable = false;

function getCrypto() {
  if (cryptoUnavailable) return null;
  if (!cryptoModule) {
    try {
      // eslint-disable-next-line global-require
      cryptoModule = require("expo-crypto");
    } catch {
      cryptoUnavailable = true;
      return null;
    }
  }
  return cryptoModule;
}

/**
 * [0, count) aralığında düzgün dağılımlı tamsayı döner.
 * count <= 1 ise her zaman 0.
 */
export function randomInt(count) {
  const n = Math.floor(count);
  if (!Number.isFinite(n) || n <= 1) return 0;

  const bytesNeeded = n <= 256 ? 1 : 2;
  const range = bytesNeeded === 1 ? 256 : 65536;
  // range'in n'e tam bölünen en büyük katı; üstündeki değerler reddedilir.
  // Kabul oranı her zaman >= %50, yani 8 deneme pratikte fazlasıyla yeterli.
  const limit = range - (range % n);

  const crypto = getCrypto();
  if (crypto?.getRandomBytes) {
    try {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const bytes = crypto.getRandomBytes(bytesNeeded);
        const value =
          bytesNeeded === 1 ? bytes[0] : (bytes[0] << 8) | bytes[1];
        if (value < limit) return value % n;
      }
    } catch {
      cryptoUnavailable = true;
    }
  }

  return Math.min(n - 1, Math.floor(Math.random() * n));
}

/** Diziden rastgele bir eleman (boş/geçersiz dizide undefined). */
export function randomPick(list) {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  return list[randomInt(list.length)];
}
