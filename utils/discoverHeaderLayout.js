// utils/discoverHeaderLayout.js
//
// Film / Dizi ana ekranının yüzen üst satırının (screens/tabs/DiscoverScreen.js) yerleşimi — SAF
// (RN importu yok, jest ile test edilir).
//
// SATIR: [keşfet düğmesi] [Film/Dizi anahtarı] [arama düğmesi]. İki yuvarlak düğme anahtarın iki
// yanında SİMETRİK durur. Anahtarın dinlenme genişliği 232 pt (2 × 112 bölme + iç boşluk); iki düğme
// (46) ve boşluklarla satır 344 pt tutar ve 320–367 pt'lik ekranlara sığmaz. Bu yüzden bölme genişliği
// ekrana göre daralır; çok daralırsa (bölme < 100) anahtar KOMPAKT olur: bölmelerdeki simgeler kalkar
// ve yazı o yeri alır (320 pt'te "Películas" iki simgeyle birlikte sığmıyordu).

/** Satırın ekran kenarlarından en az bırakacağı boşluk. */
export const ROW_MIN_GUTTER = 12;
/** Anahtar ile düğmeler arasındaki yatay boşluk. */
export const ROW_GAP = 10;
/** Anahtarın dış kenarı ile bölmeler arasındaki iç boşluk (components/home/MediaTypeSwitch.js `PAD`). */
export const SWITCH_PAD = 4;
/** Bölmenin en geniş / en dar hâli. */
export const SEGMENT_MAX = 112;
export const SEGMENT_MIN = 76;
/** Bölme bundan darsa anahtar kompakt olur (simgesiz, dar iç boşluk). */
export const COMPACT_BELOW = 100;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * @param {object} args
 * @param {number} args.width        Ekran genişliği (pt)
 * @param {number} args.buttonSize   Yuvarlak düğmenin çapı (cam: 46, cam olmayan yol: 48)
 * @param {number} args.switchHeight Anahtarın yüksekliği (46); düğme-anahtar farkı çerçeve payıdır
 * @returns {{ segmentWidth: number, compact: boolean, rowWidth: number, fits: boolean }}
 *   fits: en dar bölmeyle bile satır ekrana sığıyor mu (sığmıyorsa yine en dar hâl çizilir)
 */
export function discoverRowLayout({ width, buttonSize, switchHeight }) {
  const w = Number.isFinite(width) && width > 0 ? width : 0;
  // Cam OLMAYAN yolda anahtarın 1 px çerçevesi 2 px ekler (düğme de 2 px büyük): payı düğmeden türet.
  const border = Math.max(0, buttonSize - switchHeight);
  const chrome = 2 * buttonSize + 2 * ROW_GAP + 2 * SWITCH_PAD + border;
  const room = Math.max(0, w - 2 * ROW_MIN_GUTTER) - chrome;
  const wanted = Math.floor(room / 2);
  const segmentWidth = clamp(wanted, SEGMENT_MIN, SEGMENT_MAX);
  return {
    segmentWidth,
    compact: segmentWidth < COMPACT_BELOW,
    rowWidth: chrome + 2 * segmentWidth,
    fits: wanted >= SEGMENT_MIN,
  };
}
