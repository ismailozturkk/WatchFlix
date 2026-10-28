// utils/settingsShareLayout.js
//
// "Görünümümü paylaş" sayfalarının ve balonunun ekran boyuna göre yerleşimi (SAF,
// jest ile test edilir).
//
// NEDEN: BottomSheetModal durum çubuğunu da kaplayan pencerede açılır
// (statusBarTranslucent) ve kendiliğinden yükseklik sınırı koymaz. Altı bölüm +
// tema önizlemesi ≈ 900 pt; sınır yokken sayfa ekranın tepesine, durum çubuğunun
// ALTINA kadar büyüyordu. Burada üst güvenli alan + pay kadar boşluk bırakan
// `maxHeight` hesaplanır; aradaki içerik SheetScroll'da kayar, başlık ve düğmeler
// sabit kalır.

/** Sayfanın tepesi ile durum çubuğu arasında kalan pay (dp). */
export const SHEET_TOP_GAP = 12;
/** Tablet / geniş ekranda sayfa ortalanır, bu genişliği aşmaz (dp). */
export const SHEET_MAX_WIDTH = 560;
/** Sayfanın yatay iç boşluğu (dp) — önizleme genişliği hesabı için. */
export const SHEET_SIDE_PADDING = 18;
/** Büyük önizleme ancak bu yükseklikten itibaren (büyük telefon / tablet). */
export const LARGE_MOCK_MIN_HEIGHT = 900;
/** Afiş rafında hedeflenen afiş genişliği (dp): geniş ekranda afiş büyümez, sayısı artar. */
export const MOCK_POSTER_TARGET = 44;
// SettingsThemeMock ile aynı: gövde yatay iç boşluğu (2 × 8) ve afiş arası boşluk.
export const MOCK_INNER_PADDING = 16;
export const MOCK_POSTER_GAP = 4;
const MIN_SHEET_HEIGHT = 240;

const finite = (value, fallback) => (Number.isFinite(value) && value > 0 ? value : fallback);

/** Önizleme rafındaki afiş sayısı: verilen genişliğe ~44 dp'lik afiş sığdırır (5–9). */
export function mockPosterCount(mockWidth) {
  const inner = finite(mockWidth, 0) - MOCK_INNER_PADDING;
  const count = Math.floor((inner + MOCK_POSTER_GAP) / (MOCK_POSTER_TARGET + MOCK_POSTER_GAP));
  return Math.max(5, Math.min(9, count));
}

/**
 * Alt sayfanın ölçüleri.
 * @param {{width: number, height: number, insetTop?: number, insetBottom?: number}} window
 * @returns {{maxHeight: number, width: number, centered: boolean, largeMock: boolean,
 *   posterCount: number, paddingBottom: number}}
 */
export function settingsSheetLayout({ width, height, insetTop = 0, insetBottom = 0 } = {}) {
  const w = finite(width, 390);
  const h = finite(height, 844);
  const top = Math.max(0, Number(insetTop) || 0);
  const bottom = Math.max(0, Number(insetBottom) || 0);
  const sheetWidth = Math.min(w, SHEET_MAX_WIDTH);
  return {
    // Ekran ne kadar kısa olursa olsun sayfa durum çubuğuna değmez.
    maxHeight: Math.max(Math.min(MIN_SHEET_HEIGHT, h - top), Math.round(h - top - SHEET_TOP_GAP)),
    width: sheetWidth,
    centered: w > SHEET_MAX_WIDTH,
    largeMock: h >= LARGE_MOCK_MIN_HEIGHT,
    posterCount: mockPosterCount(sheetWidth - SHEET_SIDE_PADDING * 2),
    // Ev göstergesi / gezinme çubuğu üstünde düğmeler için pay.
    paddingBottom: Math.max(bottom + 12, 18),
  };
}

/** Ayar alt sayfasının kaydırma alanı yan boşluğu (settingsUi `ui.scroll`) ve önizleme kartının iç boşluğu. */
export const SCREEN_SIDE_PADDING = 16;
export const PREVIEW_CARD_PADDING = 12;

/**
 * Ayar alt sayfasındaki ("Görünümünü paylaş") önizleme kartı: telefonda tam genişlik,
 * tablette SHEET_MAX_WIDTH'te ortalanır; afiş sayısı kartın iç genişliğinden.
 * @returns {{cardWidth: number, posterCount: number}}
 */
export function settingsScreenPreview(windowWidth) {
  const w = finite(windowWidth, 390);
  const cardWidth = Math.min(w - SCREEN_SIDE_PADDING * 2, SHEET_MAX_WIDTH);
  return { cardWidth, posterCount: mockPosterCount(cardWidth - PREVIEW_CARD_PADDING * 2) };
}

/**
 * Sohbet balonunun gövde genişliği: zengin balon satırın %90'ını aşamaz (bkz.
 * MessageBubble `richMessage`); dar telefonda (320 dp) sabit 244 taşıyordu.
 */
export function settingsBubbleWidth(windowWidth) {
  const w = finite(windowWidth, 390);
  return Math.max(200, Math.min(260, Math.round(w * 0.62)));
}

/** Balondaki kompakt önizlemede hedef afiş genişliği (dp): 27 Eki "önizleme büyük". */
export const BUBBLE_POSTER_TARGET = 28;
// SettingsThemeMock kompakt gövdesi: yatay iç boşluk (2 × 6) ve afiş arası boşluk.
const BUBBLE_INNER_PADDING = 12;
const BUBBLE_POSTER_GAP = 3;

/** Balon önizlemesinin afiş sayısı (6–9): afiş küçük kalır, önizleme alçalır. */
export function bubbleMockPosterCount(bubbleWidth) {
  const inner = finite(bubbleWidth, 244) - BUBBLE_INNER_PADDING;
  const count = Math.floor((inner + BUBBLE_POSTER_GAP) / (BUBBLE_POSTER_TARGET + BUBBLE_POSTER_GAP));
  return Math.max(6, Math.min(9, count));
}
