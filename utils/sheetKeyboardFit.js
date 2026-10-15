// utils/sheetKeyboardFit.js
//
// Klavye açıkken bir alt sayfanın ekrana SIĞMASI için gereken ölçüler.
// Saf modül (RN importu yok) — hooks/useSheetTransition.js kullanır, jest ile
// test edilir (__tests__/sheetKeyboardFit.test.js).
//
// SORUN: useSheetTransition sayfayı klavye yüksekliği kadar `translateY` ile
// yukarı kaydırır. `translateY` yalnız KONUM değiştirir, boyut değil. Sayfa
// "ekran − klavye"den uzunsa (maxHeight: "88%" gibi) üst kısmı ekranın DIŞINA,
// durum çubuğunun da üstüne taşar: başlık, tutamak, kapat düğmesi görünmez.
//
// ÇÖZÜM: klavye açıkken sayfanın `maxHeight`ı "klavyenin üstünde kalan alan"a
// indirilir. İçindeki ScrollView/FlatList (varsayılan flexShrink: 1) o kadar
// küçülür ve kendi içinde kaydırır.

// Klavye ekranın neredeyse tamamını kapladığında (yatay mod, bölünmüş ekran)
// sayfa sıfıra çökmesin; bu değerin altına inilmez.
export const MIN_SHEET_BUDGET = 140;

// Sayfanın tepesi ile ekranın üstü (durum çubuğu dahil) arasında bırakılan pay.
export const SHEET_TOP_MARGIN = 8;

/**
 * 320 | "78%" | undefined → piksel. Yüzde `base`e göre çözülür (Yoga'nın
 * kaplayıcı yüksekliğine çözdüğüyle aynı). Çözülemeyen değer için null.
 */
export function resolveSheetLength(value, base) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const match = /^\s*(-?\d+(?:\.\d+)?)%\s*$/.exec(value);
  if (!match || !(base > 0)) return null;
  return (parseFloat(match[1]) / 100) * base;
}

/**
 * Sayfanın klavye için fiilen yukarı kaydırılacağı miktar. Pencere klavyeyle
 * birlikte daraldıysa (`overlayHeight` < `baseOverlayHeight`) o kısım zaten
 * "emilmiştir", tekrar kaydırılmaz.
 */
export function keyboardLift({ keyboardHeight, baseOverlayHeight, overlayHeight }) {
  const keyboard = Math.max(0, keyboardHeight || 0);
  if (keyboard === 0) return 0;
  const absorbed =
    baseOverlayHeight > 0 && overlayHeight > 0
      ? Math.max(0, baseOverlayHeight - overlayHeight)
      : 0;
  return Math.max(0, keyboard - absorbed);
}

/**
 * Klavye açıkken sayfanın kaplayabileceği EN FAZLA yükseklik (px).
 * Klavye kapalıysa null — sayfaya hiçbir sınır eklenmez.
 *
 * @param {object} p
 * @param {number} p.keyboardHeight     Klavyenin örttüğü yükseklik.
 * @param {number} p.baseOverlayHeight  Kaplayıcının klavye KAPALIYKEN ölçüsü.
 * @param {number} p.overlayHeight      Kaplayıcının şimdiki ölçüsü (0 = ölçülmedi).
 * @param {number} p.windowHeight       Kaplayıcı ölçülmediyse yedek.
 * @param {number} p.topGap             Üstte boş kalacak pay (durum çubuğu dahil).
 */
export function keyboardSheetBudget({
  keyboardHeight,
  baseOverlayHeight,
  overlayHeight,
  windowHeight,
  topGap,
}) {
  if (!(keyboardHeight > 0)) return null;
  // Pencere klavyeyle daraldıysa lift 0'dır ama alan yine DARALMIŞ pencereden
  // ölçülür — yüzdeli maxHeight'ı olmayan sayfa o pencereye de sığmalı.
  const lift = keyboardLift({ keyboardHeight, baseOverlayHeight, overlayHeight });
  const total = overlayHeight > 0 ? overlayHeight : windowHeight;
  if (!(total > 0)) return null;
  const budget = Math.round(total - lift - Math.max(0, topGap || 0));
  return Math.max(MIN_SHEET_BUDGET, budget);
}

/**
 * Çağıranın (düzleştirilmiş) sayfa stiline eklenecek sınırlar. Çağıranın kendi
 * `maxHeight`ı daha küçükse ona dokunulmaz. `minHeight` bütçeyi aşıyorsa o da
 * indirilir — Yoga'da min, max'a baskın gelir ve sayfa yine taşardı.
 *
 * @returns {{maxHeight: number, minHeight?: number} | null}
 */
export function keyboardFitOverrides(flatStyle, budget, overlayHeight) {
  if (budget == null) return null;
  const own = resolveSheetLength(flatStyle?.maxHeight, overlayHeight);
  const maxHeight = own != null ? Math.min(own, budget) : budget;
  const overrides = { maxHeight };
  const min = resolveSheetLength(flatStyle?.minHeight, overlayHeight);
  if (min != null && min > maxHeight) overrides.minHeight = maxHeight;
  return overrides;
}
