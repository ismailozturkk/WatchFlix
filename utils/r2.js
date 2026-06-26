// utils/r2.js
//
// Cloudflare R2 public bucket — uygulamadaki tüm bulut asset'lerinin TEK kaynağı.
// Bucket public URL'i (veya custom domain) değişirse SADECE burası güncellenir;
// başka hiçbir yere base URL elle yazılmamalı.
//
// Bucket klasör yapısı (R2'de doğrulandı):
//   /avatar/<index>.png   -> 0.png ... 55.png   (kullanıcı avatarları)
//   /icons/...            (ileride)
//   /backgrounds/...      (ileride)
//   /pets/...             (ileride)

export const R2_BASE_URL = "https://pub-8da9947755d445ebb717219a6bd737b5.r2.dev";

/**
 * R2'deki bir asset'in tam URL'ini üretir.
 * @param {string} category - klasör adı: 'avatar' | 'icons' | 'backgrounds' | 'pets'
 * @param {string|number} fileName - dosya adı (örn '0.png' veya 'eren.webp')
 * @returns {string} tam URL
 */
export function r2Url(category, fileName) {
  return `${R2_BASE_URL}/${category}/${fileName}`;
}

/**
 * Bir pet sprite sheet'inin R2 URL'i. (R2: /pets/<id>.webp)
 * @param {string} id - pet id'si (örn 'astro')
 * @returns {string}
 */
export function petUrl(id) {
  return r2Url("pets", `${id}.webp`);
}
