// utils/stampedCache.js
//
// "Damgalı" cihaz önbelleği: kayıt, kaynağının bir sürüm damgasıyla (ör. üst belgenin updatedAt'i,
// bir sayaç) birlikte saklanır; damga aynıysa okuma yapılmaz. Damgayı güncellemeyen nadir yazımlara
// karşı kayıt en fazla `maxAge` tutulur. Hep-açık dinleyicileri (yeniden bağlanmada TÜM belgeleri
// yeniden faturalayan) "değişince bir kez oku"ya çevirmek için (maliyet analizi Aşama 2).
//
// Önbellek klasörü sistemce silinebilir (cacheStore varsayılanı): kaybolursa yalnız bir kez yeniden
// okunur.

import * as cacheStore from "./cacheStore";

/** Firestore Timestamp, {seconds} ya da sayı → ms; yoksa 0. */
export function stampOf(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
  return Number.isFinite(value) ? value : 0;
}

/** Damga aynı ve kayıt maxAge'den taze ise veri; değilse null. */
export function readStamped(ns, key, stamp, maxAge) {
  if (!key) return null;
  const entry = cacheStore.getJSON(ns, key, { maxAge });
  if (!entry || entry.stamp !== stamp || entry.data === undefined) return null;
  return entry.data;
}

/** Damgaya bakmadan son kayıt (anında çizim için); yoksa null. */
export function peekStamped(ns, key) {
  if (!key) return null;
  return cacheStore.getJSON(ns, key)?.data ?? null;
}

export function writeStamped(ns, key, stamp, data) {
  if (!key) return;
  cacheStore.setJSON(ns, key, { stamp, data });
}
