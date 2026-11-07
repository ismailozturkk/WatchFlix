// components/tournament/zoomPanMath.js
//
// Tam ekran eleme ağacının (BracketTree fullscreen → ZoomPanCanvas) iki parmakla
// yakınlaştırma + serbest kaydırma hesabı. Tuval sol-üst köşesinden ölçeklenir
// (transformOrigin "0 0"): ekrandaki konum = öteleme + ölçek × tuval noktası.
//
// Saf modül, fonksiyonlar worklet (UI thread'de gesture içinden çağrılır) ve
// düz JS'te de çalışır → __tests__/zoomPanMath.test.js node'da sınar.

/** Ağacın tamamını gösteren (büyütmeyen) en küçük ölçek. */
export function fitScale(content, view) {
  "worklet";
  if (!content.w || !content.h || !view.w || !view.h) return 1;
  return Math.min(1, view.w / content.w, view.h / content.h);
}

/**
 * Tek eksende ötelemeyi sınırlar: içerik görünümden küçükse ORTALANIR,
 * büyükse kenar boşluk bırakmadan [view - size, 0] aralığında kalır.
 */
export function clampOffset(offset, size, view) {
  "worklet";
  if (size <= view) return (view - size) / 2;
  return Math.min(0, Math.max(view - size, offset));
}

/** Kaydırma (decay) için eksen sınırları: [min, max]. */
export function offsetBounds(size, view) {
  "worklet";
  if (size <= view) {
    const c = (view - size) / 2;
    return [c, c];
  }
  return [view - size, 0];
}

export function clampScale(scale, min, max) {
  "worklet";
  return Math.min(max, Math.max(min, scale));
}

/**
 * Bir odak noktası (focal, görünüm koordinatı) etrafında yakınlaştırma.
 * start: { s, x, y } — hareket başındaki ölçek/öteleme; startFocal: o andaki odak.
 * Başta parmakların altındaki tuval noktası, şimdi `focal`ın altında kalır →
 * iki parmakla hem büyütülür hem sürüklenir.
 */
export function zoomAround(start, startFocal, focal, nextScale, content, view) {
  "worklet";
  const px = (startFocal.x - start.x) / start.s;
  const py = (startFocal.y - start.y) / start.s;
  return {
    s: nextScale,
    x: clampOffset(focal.x - px * nextScale, content.w * nextScale, view.w),
    y: clampOffset(focal.y - py * nextScale, content.h * nextScale, view.h),
  };
}
