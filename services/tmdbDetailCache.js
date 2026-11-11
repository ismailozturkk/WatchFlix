// services/tmdbDetailCache.js
//
// Film/dizi detay cevabı için kısa ömürlü bellek önbelleği (yol haritası Y12).
// Aynı detayı TTL içinde yeniden açmak ağ beklemez: önbellekteki cevap ilk
// karede çizilir. Kapasite sınırlı (LRU) — uzun oturumda büyümez.
//
// Anahtar: tür + id + dil (dil değişince ayrı kayıt). Değer, ekranın
// setDetails'e verdiği SON hal (localizeMediaDetails sonrası).

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 24;

const entries = new Map(); // key -> { value, at }

export const detailCacheKey = (type, id, language) => `${type}:${id}:${language || ""}`;

/** Taze kayıt ya da null. Okunan kayıt LRU sırasında sona taşınır. */
export function readDetail(key, now = Date.now()) {
  const entry = entries.get(key);
  if (!entry) return null;
  if (now - entry.at > TTL_MS) {
    entries.delete(key);
    return null;
  }
  entries.delete(key);
  entries.set(key, entry);
  return entry.value;
}

export function writeDetail(key, value, now = Date.now()) {
  if (value == null) return;
  entries.delete(key);
  entries.set(key, { value, at: now });
  while (entries.size > MAX_ENTRIES) {
    entries.delete(entries.keys().next().value);
  }
}

/** Test / hesap değişimi için. */
export function clearDetailCache() {
  entries.clear();
}

export const isAbortError = (error) =>
  error?.name === "CanceledError" || error?.name === "AbortError" || error?.code === "ERR_CANCELED";
