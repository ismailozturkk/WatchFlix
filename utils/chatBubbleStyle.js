// utils/chatBubbleStyle.js
//
// Sohbet balonunun şekil/renk kararları (saf fonksiyon, RN importu yok).
//
// Şekil: ardışık aynı gönderici mesajları tek blok gibi okunur — komşuya
// değen köşeler küçük (BUBBLE_JOIN_RADIUS), dışa bakan köşeler yuvarlak.
// Eskiden her balonda gönderici tarafındaki üst köşe sabit 6 "kuyruk"tu; blok
// ortasındaki balonlar bu yüzden dağınık görünüyordu.

import { shiftLightness } from "./colorUtils";

export const BUBBLE_RADIUS = 20;
export const BUBBLE_JOIN_RADIUS = 6;

/**
 * @param {object} p
 * @param {boolean} p.isMe        Giden mesaj (sağda) mı?
 * @param {boolean} p.groupTop    Üstte aynı göndericiden mesaj var mı?
 * @param {boolean} p.groupBottom Altta aynı göndericiden mesaj var mı?
 */
export function bubbleRadii({ isMe, groupTop = false, groupBottom = false }) {
  const top = groupTop ? BUBBLE_JOIN_RADIUS : BUBBLE_RADIUS;
  const bottom = groupBottom ? BUBBLE_JOIN_RADIUS : BUBBLE_RADIUS;
  // Gönderici kenarı (giden: sağ, gelen: sol) komşuya bakar; karşı kenar hep yuvarlak.
  return isMe
    ? {
        borderTopLeftRadius: BUBBLE_RADIUS,
        borderBottomLeftRadius: BUBBLE_RADIUS,
        borderTopRightRadius: top,
        borderBottomRightRadius: bottom,
      }
    : {
        borderTopRightRadius: BUBBLE_RADIUS,
        borderBottomRightRadius: BUBBLE_RADIUS,
        borderTopLeftRadius: top,
        borderBottomLeftRadius: bottom,
      };
}

/**
 * Giden balonun degrade uçları: tema vurgusu → biraz koyusu. Vurgu 6 haneli hex
 * değilse (tema rengi rgba olabiliyor) null döner; çağıran düz renge düşer.
 */
export function outgoingGradient(accent) {
  if (typeof accent !== "string" || !/^#[0-9a-f]{6}$/i.test(accent.trim())) return null;
  const from = accent.trim();
  const to = shiftLightness(from, -9);
  return to === from ? null : [from, to];
}

/**
 * Kısa tek satırlık metinde saat/durum metnin YANINDA durur (balon yüksekliği
 * tek satır kalır); uzun ya da çok satırlı metinde altta.
 */
export const INLINE_META_MAX_CHARS = 24;
export function shouldInlineMeta(text) {
  if (typeof text !== "string") return false;
  return text.length > 0 && text.length <= INLINE_META_MAX_CHARS && !text.includes("\n");
}
