// services/storage/scope.js
//
// Hesap kapsamı ve toplu temizlik.
//
// Geçiş öncesinde çıkışta yalnız `cachedUserId` siliniyordu; kullanıcıya bağlı
// diğer her şey (avatar, liste durumu, aktivite önbelleği, taslaklar, AI sohbet
// geçmişi) cihazda kalıyordu. Artık registry her anahtarın kapsamını ve çıkışta
// korunup korunmayacağını biliyor, temizlik tek çağrı.

import { getStore, STORE_NAMES } from "./instances";
import { ALL_KEYS, ALL_NAMESPACES, Keys, physicalKey } from "./registry";
import { createNamespace } from "./namespace";
import { reportStorageError } from "./errors";

/**
 * Bir kullanıcının cihazdaki kapsamını temizler.
 *
 * `keepOnLogout: true` işaretli anahtarlara DOKUNMAZ — gerekçeleri registry'de
 * girdinin yanında yazılı (izleme defteri serileri, aktivasyon damgası, oyun
 * tercihleri). Oturum deposu tamamen boşaltılır.
 *
 * @param {string} uid
 * @param {{ keepSession?: boolean }} [options]
 * @returns {number} silinen anahtar sayısı
 */
export function clearUserScope(uid, options = {}) {
  if (!uid) return 0;
  let removed = 0;

  for (const descriptor of ALL_KEYS) {
    if (descriptor.scope !== "user" || descriptor.keepOnLogout) continue;
    try {
      const store = getStore(descriptor.store);
      const key = physicalKey(descriptor, uid);
      if (store.contains(key)) {
        store.remove(key);
        removed += 1;
      }
    } catch (error) {
      reportStorageError("clearUserScope", error, { key: descriptor.name, uid });
    }
  }

  if (!options.keepSession) {
    try {
      getStore("session").clearAll();
    } catch (error) {
      reportStorageError("clearUserScope:session", error, { uid });
    }
  }

  return removed;
}

/**
 * Yeniden üretilebilir HER ŞEYİ siler: `cache` deposunun tamamı.
 *
 * Eski karşılığı, elle bakımı yapılan bir anahtar süzgeciydi; listeye
 * eklenmeyen her yeni önbellek anahtarı sonsuza dek diskte kalıyordu. Artık
 * önbellek ayrı bir MMKV örneği olduğu için temizlik tanım gereği eksiksiz.
 */
export function clearAllCacheStorage() {
  try {
    getStore("cache").clearAll();
    return true;
  } catch (error) {
    reportStorageError("clearAllCacheStorage", error);
    return false;
  }
}

/** Önbellek deposunun toplam boyutu (bayt). */
export function cacheByteSize() {
  try {
    return getStore("cache").byteSize || 0;
  } catch {
    return 0;
  }
}

/**
 * Kullanıcı kapsamlı önbellek anahtarlarının yaklaşık boyutu.
 * @param {object} descriptor Keys.listStatus / Keys.mediaActivity gibi
 */
export function scopedByteSize(descriptor) {
  try {
    const store = getStore(descriptor.store);
    let total = 0;
    for (const key of store.getAllKeys()) {
      if (!key.startsWith(descriptor.key)) continue;
      total += key.length + (store.getString(key)?.length || 0);
    }
    return total;
  } catch {
    return 0;
  }
}

/** Sabit adlı tek anahtarın yaklaşık boyutu. */
export function keyByteSize(descriptor, uid) {
  try {
    const store = getStore(descriptor.store);
    const key = physicalKey(descriptor, uid);
    return key.length + (store.getString(key)?.length || 0);
  } catch {
    return 0;
  }
}

/**
 * TÜM depoları siler — yalnızca "uygulamayı sıfırla" gibi yıkıcı bir akış için.
 * Normal çıkışta `clearUserScope`, önbellek temizliğinde `clearAllCacheStorage`
 * kullanılır.
 */
export function wipeEverything() {
  for (const name of STORE_NAMES) {
    try {
      getStore(name).clearAll();
    } catch (error) {
      reportStorageError("wipeEverything", error, { store: name });
    }
  }
  for (const definition of ALL_NAMESPACES) {
    createNamespace(definition).clear();
  }
}

/** Tanı amaçlı: hangi depoda kaç anahtar, kaç bayt var. */
export function storageStats() {
  const out = {};
  for (const name of STORE_NAMES) {
    try {
      const store = getStore(name);
      out[name] = { keys: store.length, bytes: store.byteSize || 0 };
    } catch {
      out[name] = { keys: 0, bytes: 0 };
    }
  }
  return out;
}

export { Keys };
