// utils/posterSizes.js
//
// Raf poster BOYUTUNUN tek kaynağı (Ayarlar > Poster görünümü > Ana Ekran > Poster
// boyutu). Üç kademe: Varsayılan · Küçük · Daha küçük. Değer ÇARPAN olarak okunur;
// her raf kendi taban genişliğini bununla çarpar:
//   Film & Dizi ana ekran rafları   → ekran × 0.40 (hooks/useRailPosterStyle)
//   Detay "Önerilen" + film "Seri"  → ekran × 0.38 (detailRailItemWidth)
// "normal"/"small" değerleri eski iki kademeyle aynı → kayıtlı/paylaşılan/yedeklenen
// ayarlar göç gerektirmez. Eski (≤1.5.x) istemciler "xsmall"ı reddeder (bilinçli).
//
// Saf modül (RN/i18n yok): registry doğrulaması da buradan okur.

export const POSTER_SIZES = Object.freeze(["normal", "small", "xsmall"]);

// Küçük ×0.85 eski değer; Daha küçük bir adım daha (~0.85²).
const SIZE_SCALE = Object.freeze({ normal: 1, small: 0.85, xsmall: 0.72 });

// Rozet/hap ölçeği (ListBadges, PosterInfoBadges): Küçük'te eski 0.82 korunur.
const BADGE_SCALE = Object.freeze({ normal: 1, small: 0.82, xsmall: 0.72 });

export function isPosterSize(value) {
  return POSTER_SIZES.includes(value);
}

/** Poster genişlik çarpanı; bilinmeyen değer → 1 (Varsayılan). */
export function posterSizeScale(size) {
  return SIZE_SCALE[size] || 1;
}

/** Poster üstü rozetlerin ölçeği (raf boyutuna göre). */
export function posterBadgeScale(size) {
  return BADGE_SCALE[size] || 1;
}

/** Film & Dizi ana ekran raf posteri genişliği (pt). */
export function railPosterWidth(windowWidth, size) {
  return windowWidth * 0.4 * posterSizeScale(size);
}

/** Detay sayfası "Önerilen"/"Seri" kart genişliği (pt). */
export function detailRailItemWidth(windowWidth, size) {
  return windowWidth * 0.38 * posterSizeScale(size);
}
