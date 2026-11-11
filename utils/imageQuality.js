// utils/imageQuality.js
//
// Görsel (afiş/arka plan/logo) KALİTESİNİN tek kaynağı. Saf modül (RN yok):
// registry doğrulaması, yedek, ayar ekranı ve tmdbImageUtils buradan okur.
//
// Kademeler:
//   auto     — Otomatik (varsayılan). Çözünürlük her görsel için ayrı seçilir:
//              görselin EKRANDAKİ boyutu × ekran yoğunluğu, bağlantı ölçülüyse
//              (mobil veri) ve cihaz düşük sınıfsa yoğunluk 2×'e kadar kısılır.
//              Poster boyutu (Varsayılan/Küçük/Daha küçük, ızgara sütunu) küçüldükçe
//              inen dosya da kendiliğinden küçülür. "original" asla seçilmez.
//   low · medium · good · high · original — elle sabitlenmiş kademeler.
//
// Eski (≤1.5.x) istemciler "auto"yu yedek/paylaşımda reddeder (bilinçli; xsmall gibi).

export const IMAGE_QUALITY_AUTO = "auto";
export const MANUAL_IMAGE_QUALITIES = Object.freeze(["low", "medium", "good", "high", "original"]);
export const IMAGE_QUALITY_LEVELS = Object.freeze([IMAGE_QUALITY_AUTO, ...MANUAL_IMAGE_QUALITIES]);
export const DEFAULT_IMAGE_QUALITY = IMAGE_QUALITY_AUTO;

export function isImageQualityLevel(value) {
  return IMAGE_QUALITY_LEVELS.includes(value);
}

export function normalizeImageQuality(value) {
  return isImageQualityLevel(value) ? value : DEFAULT_IMAGE_QUALITY;
}

// Otomatik modun yoğunluk tavanları.
export const AUTO_METERED_DENSITY_CAP = 2; // mobil veri / ölçülü Wi‑Fi
export const AUTO_LOW_TIER_DENSITY_CAP = 2; // düşük sınıf cihaz (bellek/kod çözme)
// Ekranın neredeyse tamamını kaplayan görsellerde (arka plan, büyük afiş) 2.5×
// üstü gözle ayırt edilmiyor ama dosya ~1.5 kat büyüyor.
export const AUTO_LARGE_IMAGE_WIDTH = 300;
export const AUTO_LARGE_IMAGE_DENSITY_CAP = 2.5;

/**
 * Otomatik modun bir görsel için kullandığı piksel yoğunluğu.
 * @param {object} ctx
 * @param {number} ctx.pixelRatio   cihaz piksel oranı (PixelRatio.get())
 * @param {boolean} [ctx.metered]   bağlantı ölçülü mü (mobil veri)
 * @param {string} [ctx.tier]       "low" | "mid" | "high"
 * @param {number} [width]          görselin ekrandaki genişliği (pt)
 */
export function autoImageDensity(ctx = {}, width) {
  const ratio = Number(ctx.pixelRatio);
  let density = Number.isFinite(ratio) && ratio >= 1 ? ratio : 2;
  if (ctx.metered) density = Math.min(density, AUTO_METERED_DENSITY_CAP);
  if (ctx.tier === "low") density = Math.min(density, AUTO_LOW_TIER_DENSITY_CAP);
  if (Number.isFinite(width) && width >= AUTO_LARGE_IMAGE_WIDTH) {
    density = Math.min(density, AUTO_LARGE_IMAGE_DENSITY_CAP);
  }
  return density;
}

/**
 * Ayar ekranı için: otomatik mod ŞU AN neye göre karar veriyor?
 * reason: "metered" | "lowTier" | "full"
 */
export function describeAutoQuality(ctx = {}) {
  const full = autoImageDensity({ pixelRatio: ctx.pixelRatio });
  const density = autoImageDensity(ctx);
  let reason = "full";
  if (density < full) reason = ctx.metered ? "metered" : "lowTier";
  return { density: Math.round(density * 10) / 10, reason };
}

// TMDB türevlerinin bir afiş için kabaca ortalama boyutu (KB). Kullanıcıya
// "ne kadar veri" fikri vermek için; ölçüm değil tahmindir.
const APPROX_KB = Object.freeze({
  w45: 3, w92: 6, w154: 12, w185: 17, w300: 35, w342: 42, w500: 75,
  w780: 150, w1280: 260, h632: 70, original: 700,
});

export function approxImageKb(sizeString) {
  return APPROX_KB[sizeString] ?? null;
}
