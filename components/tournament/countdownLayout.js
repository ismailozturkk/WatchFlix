// components/tournament/countdownLayout.js
//
// Geri sayım (CountdownTimer) hücre ölçüleri. Eskiden rakam kutusu SABİT
// genişlikteydi (lg: 20 dp, 27 pt yazı); kullanıcı geniş rakamlı bir yazı tipi
// seçince ya da sistem yazı boyutu büyükken rakamlar kutudan taşıp kırpılıyordu.
// Artık ölçüler yazı boyutundan türer ve `fill` kipinde (turnuva hero paneli)
// satırın ölçülen genişliğine göre yazı küçültülür → her yazı tipinde sığar.
//
// Saf modül → __tests__/countdownLayout.test.js node'da sınar.

// Rakam genişliği / yazı boyutu: sistem yazısında ≈ 0.58, geniş görüntü
// yazılarında ≈ 0.72 em. Pay bırakılır ki hiçbir ailede kırpılmasın.
export const DIGIT_RATIO = 0.76;
// Satır yüksekliği / yazı boyutu: uzun inişli-çıkışlı ailelerde de dikey kırpma yok.
export const LINE_RATIO = 1.24;
// ":" ayracı: yazı boyutu oranı + iki yandaki boşluk.
export const SEP_FONT_RATIO = 0.62;
const SEP_GLYPH_RATIO = 0.42;
const SEP_MARGIN = 3;

const BASE = {
  lg: { font: 27, label: 10, gap: 3, pad: 6, radius: 10 },
  lgNarrow: { font: 22, label: 9, gap: 3, pad: 5, radius: 10 },
  sm: { font: 15, label: 7, gap: 2, pad: 5, radius: 8 },
};
const MIN_FONT = 13;

const withFont = (base, font) => ({
  ...base,
  font,
  w: Math.ceil(font * DIGIT_RATIO),
  h: Math.ceil(font * LINE_RATIO),
});

/** Bir ayracın kapladığı genişlik (yazı + iki yan boşluk). */
export const sepWidth = (font) => font * SEP_FONT_RATIO * SEP_GLYPH_RATIO + 2 * SEP_MARGIN;

/** İki haneli birim kutusunun genişliği. */
export const unitBoxWidth = (d) => 2 * d.w + d.gap + 2 * d.pad;

/**
 * size: "lg" | "sm"; screenW: pencere genişliği; rowW: (fill kipinde) satırın
 * ölçülen genişliği — verilirse yazı, dört kutu + üç ayraç satıra sığacak
 * kadar küçültülür (hiç büyütülmez).
 */
export function countdownDims(size, screenW, rowW) {
  const base = size === "lg" ? (screenW <= 350 ? BASE.lgNarrow : BASE.lg) : BASE.sm;
  let font = base.font;
  if (rowW > 0) {
    const perUnit = (rowW - 3 * sepWidth(font)) / 4;
    const digitW = (perUnit - 2 * base.pad - base.gap) / 2;
    font = Math.max(MIN_FONT, Math.min(font, Math.floor(digitW / DIGIT_RATIO)));
  }
  return withFont(base, font);
}
