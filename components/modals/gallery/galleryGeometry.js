// components/modals/gallery/galleryGeometry.js
//
// Galeri "paylaşılan öğe" geçişinin saf geometrisi (RN importu yok, test edilir).
//
// NEDEN ÖLÇÜM YOK: hedef (galerideki büyük görsel) eskiden açılışta
// `measureInWindow` ile ölçülüyordu; FlatList öğesi henüz yerleşmemişken ölçüm
// 0 ya da bayat dönüyor, uçuş yanlış yere iniyordu. Artık sayfa = kök görünümün
// kendi boyutu ve görsel bu sayfada TAM ORTADA — hedef buradan HESAPLANIR, liste
// de aynı formülle çizer. İki taraf aynı sayıyı kullandığı için iniş pikseli
// pikseline örtüşür.

export const POSTER_VIEW_MAX = Object.freeze({ width: 300, height: 450 });
export const BACKDROP_VIEW_MAX_WIDTH = 380;
// Büyütülmüş görselin köşe yarıçapı (liste öğesi ile uçan kopya aynı değeri kullanır).
export const VIEW_RADIUS = 20;

const POSTER_SIDE_GUTTER = 48;
const BACKDROP_SIDE_GUTTER = 16;
// Afiş, kısa ekranlarda üst çubuk + alt seçiciyle çakışmasın.
const POSTER_MAX_HEIGHT_RATIO = 0.62;

const finite = (n, fallback) => (Number.isFinite(n) && n > 0 ? n : fallback);

/**
 * Kaydırmalı kipteki büyük görselin boyutu. Afiş 2:3, arka plan 16:9 — detay
 * ekranındaki yuvalarla AYNI en-boy oranı; bu sayede uçuş tek bir eşit ölçekle
 * (scale) yapılır, görsel hiç esnemez.
 */
export function heroViewSize(isPoster, pageWidth, pageHeight) {
  const w = finite(pageWidth, 390);
  const h = finite(pageHeight, 844);
  if (isPoster) {
    let width = Math.min(POSTER_VIEW_MAX.width, w - POSTER_SIDE_GUTTER);
    let height = width * 1.5;
    const maxHeight = h * POSTER_MAX_HEIGHT_RATIO;
    if (height > maxHeight) {
      height = maxHeight;
      width = height / 1.5;
    }
    return { width, height };
  }
  const width = Math.min(BACKDROP_VIEW_MAX_WIDTH, w - BACKDROP_SIDE_GUTTER);
  return { width, height: width * (9 / 16) };
}

/** Boyutu sayfanın tam ortasına yerleştirir (sayfa = kök görünüm). */
export function centeredRect(size, pageWidth, pageHeight) {
  return {
    x: (pageWidth - size.width) / 2,
    y: (pageHeight - size.height) / 2,
    width: size.width,
    height: size.height,
  };
}

/**
 * Hedef dikdörtgende çizilen görünümü kaynağa oturtan transform başlangıcı.
 * Görünüm HEDEFTE yerleşir; progress=0'da bu ötelemeler + ölçekle kaynağın
 * üstüne biner, progress=1'de transform kimliktir. Yerleşim (left/top/width/
 * height) hiç animasyonlanmaz — yalnız UI iş parçacığında transform.
 */
export function flightStart(from, to) {
  if (!from || !to || !(to.width > 0)) return null;
  const scale = from.width / to.width;
  if (!Number.isFinite(scale) || scale <= 0) return null;
  return {
    dx: from.x + from.width / 2 - (to.x + to.width / 2),
    dy: from.y + from.height / 2 - (to.y + to.height / 2),
    scale,
  };
}

/**
 * Uçuş anındaki köşe yarıçapı (hedef görünüm biriminde). Görünüm `scale` ile
 * küçüldüğünde yarıçap da küçülür; görünen yarıçapın kaynaktan (fromRadius)
 * hedefe (toRadius) düzgün geçmesi için ölçeğe bölünür. Worklet içinde de
 * çağrılır.
 */
export function flightRadius(progress, start, fromRadius, toRadius) {
  "worklet";
  const p = Math.min(Math.max(progress, 0), 1);
  const s = start.scale + (1 - start.scale) * progress;
  const visible = fromRadius + (toRadius - fromRadius) * p;
  return visible / Math.max(s, 0.01);
}

/**
 * Kopya, yuvaya yakın uçta (progress < FLIGHT_COVER_AT) yuvayla ÇAPRAZ solar:
 * açılışta yuvanın üstünde belirerek kalkar, kapanışta yuvanın üstünde solarak
 * iner. Yuva yalnız kopya tam örtükken gizlidir (`isFlightCovering`), böylece
 * kopya ile yuvadaki çizim birebir aynı olmasa da (arka planın alt solması,
 * başlık, afiş çerçevesi) hiçbir karede sıçrama/boşluk görünmez.
 */
export const FLIGHT_COVER_AT = 0.22;

export function flightOpacity(progress) {
  "worklet";
  return Math.min(Math.max(progress / FLIGHT_COVER_AT, 0), 1);
}

export function isFlightCovering(progress) {
  "worklet";
  return progress >= FLIGHT_COVER_AT;
}
