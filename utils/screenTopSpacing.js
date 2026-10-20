// utils/screenTopSpacing.js
//
// Sekme ekranlarının (Ayarlar gibi) kaydırma içeriği ekranın TEPESİNDEN, yani
// durum çubuğunun / Dynamic Island'ın altından değil ÜSTÜNDEN başlar
// (AdaptiveTabShell `overrideScrollViewContentInsetAdjustmentBehavior: false`).
// Sayfa başlığına sabit bir `marginTop` vermek bu yüzden iki yerde yanlış kalır:
//
//   • iPhone Dynamic Island / çentik → güvenli alan üstte ~47–62 pt; sabit 36 pt
//     başlığı adanın İÇİNE ya da dibine yapıştırır.
//   • Android edge-to-edge → durum çubuğu ve kamera deliği yüksekliği cihaza göre
//     24–48 dp arasında değişir; sabit değer ya yetmez ya da düz ekranda şişer.
//
// Doğru boşluk = güvenli alan + küçük bir nefes payı; güvenli alan 0 raporlansa
// bile (inset vermeyen düz ekran, ilk çizim) eski sabit değerin altına inmez.
// Film / Dizi sekmelerinin arama çubuğuyla (`insets.top + 16`) AYNI pay kullanılır;
// sekmeler arası geçişte ilk öğe aynı hizada kalsın.

/** Güvenli alan yokken de korunan alt sınır (eski sabit `marginTop`). */
export const TAB_TITLE_MIN_TOP = 36;

/** Güvenli alanın (durum çubuğu / ada) altında bırakılan boşluk. */
export const TAB_TITLE_INSET_GAP = 16;

/**
 * Sekme sayfa başlığının üst boşluğu.
 *
 * @param {number} insetTop  `useSafeAreaInsets().top` (geçersiz/negatifse 0 sayılır)
 * @param {{min?: number, gap?: number}} [opts]
 * @returns {number} Tam piksele yuvarlanmış üst boşluk
 */
export function tabTitleTopSpacing(
  insetTop,
  { min = TAB_TITLE_MIN_TOP, gap = TAB_TITLE_INSET_GAP } = {},
) {
  const inset = Number.isFinite(insetTop) && insetTop > 0 ? insetTop : 0;
  return Math.max(min, Math.round(inset + gap));
}
