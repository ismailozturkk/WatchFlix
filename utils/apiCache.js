import AsyncStorage from "@react-native-async-storage/async-storage";
import { shouldPersistInternetData } from "./dataCacheSettings";

/** TTL constants (milliseconds) */
export const TTL = {
  TREND:      1  * 60 * 60 * 1000,       // 1 hour
  NOW_PLAYING: 6 * 60 * 60 * 1000,       // 6 hours
  PROVIDERS:  24 * 60 * 60 * 1000,       // 24 hours
  GENRES:      7 * 24 * 60 * 60 * 1000,  // 7 days
  OSCAR:       7 * 24 * 60 * 60 * 1000,  // 7 days
  COLLECTION:  7 * 24 * 60 * 60 * 1000,  // 7 days
  CALENDAR:    1 * 60 * 60 * 1000,       // 1 hour
};

const PREFIX = "apicache_";

// In-memory layer — avoids AsyncStorage round-trips within the same session.
const mem = new Map();

const storageKey = (key) => `${PREFIX}${key}`;

/**
 * Returns cached data if the entry exists and is within ttlMs.
 * Checks memory first, then AsyncStorage.
 * @returns {Promise<any|null>}
 */
export const getCachedValue = async (key, ttlMs) => {
  const now = Date.now();

  const hit = mem.get(key);
  if (hit) {
    if (now - hit.ts < ttlMs) return hit.data;
    mem.delete(key);
  }

  try {
    const raw = await AsyncStorage.getItem(storageKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (now - entry.ts < ttlMs) {
      mem.set(key, entry);
      return entry.data;
    }
    AsyncStorage.removeItem(storageKey(key)).catch(() => {});
    return null;
  } catch {
    return null;
  }
};

/**
 * Writes data to memory and AsyncStorage.
 * Fire-and-forget — never throws.
 */
export const setCachedValue = (key, data, { force = false } = {}) => {
  if (!shouldPersistInternetData({ force })) return;
  const entry = { data, ts: Date.now() };
  mem.set(key, entry);
  AsyncStorage.setItem(storageKey(key), JSON.stringify(entry)).catch(() => {});
};

/**
 * Removes an entry from both layers.
 */
export const removeCachedValue = (key) => {
  mem.delete(key);
  AsyncStorage.removeItem(storageKey(key)).catch(() => {});
};

/**
 * Belirli bir önekteki tüm apicache girdilerini (bellek + AsyncStorage) siler.
 * prefix "" verilirse tüm apicache temizlenir. Örn: clearCachedByPrefix("movie_").
 */
export const clearCachedByPrefix = async (prefix = "") => {
  for (const k of Array.from(mem.keys())) {
    if (k.startsWith(prefix)) mem.delete(k);
  }
  try {
    const all = await AsyncStorage.getAllKeys();
    const target = all.filter((k) => k.startsWith(storageKey(prefix)));
    if (target.length) await AsyncStorage.multiRemove(target);
  } catch {
    // yok say
  }
};

// Singleton: preload sadece bir kez çalışır, sonraki çağrılar aynı Promise'i döner.
let _preloadPromise = null;

const _doPreload = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(PREFIX));
    if (!cacheKeys.length) return;
    const pairs = await AsyncStorage.multiGet(cacheKeys);
    pairs.forEach(([sKey, raw]) => {
      if (!raw) return;
      try {
        const entry = JSON.parse(raw);
        if (entry?.ts !== undefined && entry?.data !== undefined) {
          const internalKey = sKey.slice(PREFIX.length);
          if (!mem.has(internalKey)) {
            mem.set(internalKey, entry);
          }
        }
      } catch {}
    });
  } catch {}
};

/**
 * Startup preloader — reads ALL apicache_* keys from AsyncStorage in one
 * multiGet and populates the in-memory map. Subsequent calls return the same
 * Promise (no duplicate AsyncStorage reads). Call as early as possible.
 */
export const preloadAllCache = () => {
  if (!_preloadPromise) _preloadPromise = _doPreload();
  return _preloadPromise;
};
