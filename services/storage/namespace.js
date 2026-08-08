// services/storage/namespace.js
//
// Registry'ye tek tek yazılamayan, çalışma anında üreyen anahtar aileleri için
// (bugün yalnız `apicache_*`). Önek + depo tek yerde tanımlı olduğu için ölçme
// ve temizleme de tek yerden yapılabiliyor — eskiden "apicache_" üç dosyada elle
// yazılıydı ve cacheInspector'ın süzgecine eklenmeyen her yeni önek diskte
// görünmez şekilde birikiyordu.

import { getStore } from "./instances";
import { reportStorageError } from "./errors";

/**
 * @param {{store: string, prefix: string}} definition Namespaces.* girdisi
 */
export function createNamespace(definition) {
  const { store: storeName, prefix } = definition;
  const physical = (key) => `${prefix}${key}`;

  const api = {
    prefix,
    storeName,

    /** Ham string okur. Yoksa `undefined`. */
    getString(key) {
      try {
        return getStore(storeName).getString(physical(key));
      } catch (error) {
        reportStorageError("ns:read", error, { key, prefix });
        return undefined;
      }
    },

    setString(key, value) {
      try {
        getStore(storeName).set(physical(key), value);
        return true;
      } catch (error) {
        reportStorageError("ns:write", error, { key, prefix });
        return false;
      }
    },

    /** JSON okur; bozuk kayıt kendini onarır (silinir) ve `undefined` döner. */
    getJSON(key) {
      const raw = api.getString(key);
      if (raw === undefined || raw === "") return undefined;
      try {
        return JSON.parse(raw);
      } catch (error) {
        reportStorageError("ns:decode", error, { key, prefix });
        api.remove(key);
        return undefined;
      }
    },

    setJSON(key, value) {
      try {
        return api.setString(key, JSON.stringify(value));
      } catch (error) {
        reportStorageError("ns:encode", error, { key, prefix });
        return false;
      }
    },

    has(key) {
      try {
        return getStore(storeName).contains(physical(key));
      } catch {
        return false;
      }
    },

    remove(key) {
      try {
        getStore(storeName).remove(physical(key));
        return true;
      } catch (error) {
        reportStorageError("ns:remove", error, { key, prefix });
        return false;
      }
    },

    /** Bu ailedeki mantıksal anahtarlar (önek soyulmuş). */
    keys(startsWith = "") {
      try {
        const full = `${prefix}${startsWith}`;
        return getStore(storeName)
          .getAllKeys()
          .filter((k) => k.startsWith(full))
          .map((k) => k.slice(prefix.length));
      } catch (error) {
        reportStorageError("ns:keys", error, { prefix });
        return [];
      }
    },

    /** Aileyi (ya da alt önekini) siler; silinen anahtar sayısını döner. */
    clear(startsWith = "") {
      const target = api.keys(startsWith);
      if (!target.length) return 0;
      try {
        const store = getStore(storeName);
        for (const key of target) store.remove(physical(key));
        return target.length;
      } catch (error) {
        reportStorageError("ns:clear", error, { prefix, startsWith });
        return 0;
      }
    },

    /** Yaklaşık bayt (anahtar + değer uzunluğu) — önbellek dökümü için. */
    byteSize(startsWith = "") {
      try {
        const store = getStore(storeName);
        let total = 0;
        for (const key of api.keys(startsWith)) {
          const full = physical(key);
          total += full.length + (store.getString(full)?.length || 0);
        }
        return total;
      } catch (error) {
        reportStorageError("ns:byteSize", error, { prefix });
        return 0;
      }
    },
  };

  return api;
}
