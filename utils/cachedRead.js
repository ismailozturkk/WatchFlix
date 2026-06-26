// utils/cachedRead.js
//
// Read-through cache yardımcıları (offline-first okuma deseni).
//   online  → fetchFn() çağrılır, sonuç cache'e yazılır ve TAZE döner.
//   offline → cache'ten dönülür (varsa).
//   hata    → cache'e düşülür (fallbackToCache).
//
// Firestore okumalarını ve TMDB axios çağrılarını bu sarmalayıcıyla geçirince
// veri kullanım sırasında otomatik cache'lenir ve internet yokken kullanılır.

import axios from "axios";
import * as cacheStore from "./cacheStore";
import { getIsOnline } from "../context/ConnectivityContext";
import { shouldPersistInternetData } from "./dataCacheSettings";

const DAY = 24 * 60 * 60 * 1000;

/**
 * @param {string} ns - namespace
 * @param {string} key - cache anahtarı
 * @param {() => Promise<any>} fetchFn - taze veriyi getiren fonksiyon
 * @param {object} [opts]
 * @param {number} [opts.maxAge] - online iken cache bu kadar tazeyse fetch atlanır
 * @param {boolean} [opts.forceRefresh=false] - cache taze olsa bile fetch et
 * @param {boolean} [opts.fallbackToCache=true] - fetch hata verirse cache'e düş
 * @returns {Promise<{data:any, fromCache:boolean, stale:boolean, error?:any}>}
 */
export async function cachedRead(ns, key, fetchFn, opts = {}) {
  const {
    maxAge,
    forceRefresh = false,
    fallbackToCache = true,
    forceCache = false,
  } = opts;

  // Offline: doğrudan cache.
  if (!getIsOnline()) {
    return { data: cacheStore.getJSON(ns, key), fromCache: true, stale: true };
  }

  // Taze cache varsa (maxAge) ve zorlanmadıysa: ağ trafiği yapma.
  if (!forceRefresh && maxAge) {
    const fresh = cacheStore.getJSON(ns, key, { maxAge });
    if (fresh !== null) return { data: fresh, fromCache: true, stale: false };
  }

  try {
    const data = await fetchFn();
    if (shouldPersistInternetData({ force: forceCache })) {
      cacheStore.setJSON(ns, key, data);
    }
    return { data, fromCache: false, stale: false };
  } catch (error) {
    if (fallbackToCache) {
      const cached = cacheStore.getJSON(ns, key);
      if (cached !== null)
        return { data: cached, fromCache: true, stale: true, error };
    }
    throw error;
  }
}

/**
 * TMDB GET cevabını URL bazlı cache'le. Varsayılan 1 gün taze.
 * @returns {Promise<{data:any, fromCache:boolean, stale:boolean}>}
 */
export function cachedTmdb(url, axiosConfig = {}, opts = {}) {
  return cachedRead(
    "tmdb",
    url,
    async () => {
      const res = await axios.get(url, axiosConfig);
      return res.data;
    },
    { maxAge: DAY, ...opts },
  );
}

/** Sadece cache'ten oku (ağ yok). */
export function readCache(ns, key, opts = {}) {
  return cacheStore.getJSON(ns, key, opts);
}

/** Veriyi cache'e yaz (onSnapshot dinleyicilerinden son durumu saklamak için). */
export function writeCache(ns, key, data, opts = {}) {
  if (!shouldPersistInternetData({ force: opts.forceCache })) return false;
  return cacheStore.setJSON(ns, key, data);
}
