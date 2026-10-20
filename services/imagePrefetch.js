// services/imagePrefetch.js
//
// Görselleri (TMDB poster/backdrop, avatar, pet vb.) topluca expo-image disk
// cache'ine indirir. Bir kez indirilince offline'da da gösterilir.
// Sınırlı eşzamanlılıkla çalışır → cihazı/ağı boğmaz.

import { Image } from "expo-image";

/**
 * @param {string[]} urls - indirilecek görsel URL'leri (tekrar/boşlar elenir)
 * @param {object} [opts]
 * @param {number} [opts.concurrency=6]
 * @param {(done:number,total:number)=>void} [opts.onProgress]
 * @returns {Promise<number>} başarıyla denenmiş görsel sayısı
 */
export async function prefetchImages(urls, { concurrency = 6, onProgress } = {}) {
  const list = [...new Set((urls || []).filter(Boolean))];
  const total = list.length;
  if (total === 0) {
    onProgress?.(0, 0);
    return 0;
  }

  let index = 0;
  let done = 0;

  async function worker() {
    while (index < total) {
      const url = list[index++];
      try {
        await Image.prefetch(url, "disk");
      } catch {
        // tek bir görsel hatası tüm işi bozmasın
      }
      done++;
      onProgress?.(done, total);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, total) },
    worker,
  );
  await Promise.all(workers);
  return done;
}
