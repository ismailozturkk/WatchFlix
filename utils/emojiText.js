// utils/emojiText.js
//
// Yalnızca 1–3 emojiden oluşan mesajı tespit eder: sohbette balonsuz, büyük
// emoji olarak çizilir. Saf fonksiyon, RN/Intl importu yok.
//
// `\p{Extended_Pictographic}` bilerek kullanılmadı: Hermes'in Unicode özellik
// kaçışı desteği sürüme bağlı ve regex derleme anında patlar. Bunun yerine kod
// noktası aralıkları taranır.

const ZWJ = 0x200d;
const VS16 = 0xfe0f;
const KEYCAP = 0x20e3;

const isSkinTone = (cp) => cp >= 0x1f3fb && cp <= 0x1f3ff;
const isRegionalIndicator = (cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff;
const isTagChar = (cp) => cp >= 0xe0020 && cp <= 0xe007f;

const isPictographic = (cp) =>
  (cp >= 0x1f300 && cp <= 0x1faff) ||
  (cp >= 0x1f000 && cp <= 0x1f2ff) ||
  (cp >= 0x2600 && cp <= 0x27bf) ||
  (cp >= 0x2b00 && cp <= 0x2bff) ||
  (cp >= 0x2190 && cp <= 0x21ff) ||
  (cp >= 0x2300 && cp <= 0x23ff) ||
  cp === 0x00a9 ||
  cp === 0x00ae ||
  cp === 0x203c ||
  cp === 0x2049 ||
  cp === 0x2122 ||
  cp === 0x2139 ||
  cp === 0x3030 ||
  cp === 0x303d ||
  cp === 0x3297 ||
  cp === 0x3299;

/**
 * Metindeki emoji öbeği sayısı; emoji dışı (boşluk hariç) bir karakter varsa
 * -1. Öbek = ZWJ ile bağlı dizi, cilt tonu, bayrak çifti, keycap.
 */
export function countEmojiClusters(text) {
  if (typeof text !== "string") return -1;
  const points = Array.from(text.trim()).map((ch) => ch.codePointAt(0));
  if (points.length === 0) return -1;

  let clusters = 0;
  let joinNext = false; // ZWJ sonrası gelen glif aynı öbeğe eklenir
  let pendingRegional = false; // bayrağın ilk yarısı görüldü

  for (let i = 0; i < points.length; i += 1) {
    const cp = points[i];
    if (/\s/u.test(String.fromCodePoint(cp))) {
      if (joinNext) return -1; // ZWJ'den sonra boşluk: bozuk dizi
      pendingRegional = false;
      continue;
    }
    if (cp === VS16 || cp === KEYCAP || isSkinTone(cp) || isTagChar(cp)) {
      if (clusters === 0) return -1; // öncesinde taban emoji yok
      continue;
    }
    if (cp === ZWJ) {
      if (clusters === 0) return -1;
      joinNext = true;
      continue;
    }
    if (isRegionalIndicator(cp)) {
      if (pendingRegional) {
        pendingRegional = false; // bayrağın ikinci yarısı
        continue;
      }
      pendingRegional = true;
      clusters += 1;
      joinNext = false;
      continue;
    }
    // Keycap tabanı: 0-9 # * ardından VS16/KEYCAP gelirse emoji sayılır.
    const next = points[i + 1];
    const isKeycapBase =
      (cp >= 0x30 && cp <= 0x39) || cp === 0x23 || cp === 0x2a;
    if (isKeycapBase && (next === KEYCAP || (next === VS16 && points[i + 2] === KEYCAP))) {
      clusters += 1;
      joinNext = false;
      continue;
    }
    if (!isPictographic(cp)) return -1;
    if (joinNext) {
      joinNext = false; // ZWJ ile bağlandı, yeni öbek açma
      continue;
    }
    clusters += 1;
    pendingRegional = false;
  }
  return joinNext ? -1 : clusters;
}

/** 1–3 emojiden ibaret mi? (yazı yok) */
export function isEmojiOnly(text, max = 3) {
  const n = countEmojiClusters(text);
  return n >= 1 && n <= max;
}
