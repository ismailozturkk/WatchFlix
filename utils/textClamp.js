// utils/textClamp.js
//
// Uzun kullanıcı metinlerini (paylaşım başlığı/içeriği) "Devamını oku" ile
// kısaltırken kullanılan SAF yardımcı. Asıl satır sayımı ekranda, gizli bir
// ölçer metinle yapılır (components/feed/ClampedText.js); buradaki ön eleme
// yalnız KISA metinlerde o ölçeri hiç kurmamak içindir.

// Bir satıra sığan en az karakter: en dar sütunda (inceleme posteri yanındaki
// metin sütunu, ≈190 px) bile 14 pt metin bunun üstünde karakter alır.
const MIN_CHARS_PER_LINE = 12;

/**
 * Metin `lines` satıra sığmayabilir mi? `false` KESİNDİR (ölçmeye gerek yok);
 * `true` "olabilir, ölç" demektir.
 *
 * Sert satır sonları ayrıca sayılır: kısa ama çok satırlı bir metin karakter
 * sınırını aşmasa da satır sınırını aşar.
 */
export function mayOverflow(text, lines) {
  if (typeof text !== "string" || !text) return false;
  if (!Number.isFinite(lines) || lines < 1) return false;
  if (text.length > lines * MIN_CHARS_PER_LINE) return true;
  let breaks = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) breaks += 1;
  }
  return breaks >= lines;
}
