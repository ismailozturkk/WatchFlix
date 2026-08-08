// services/storage/instances.js
//
// MMKV örneklerinin (instance) tek kurulum noktası. Dört ayrı depo var; ayrım
// keyfi değil, SİLME DAVRANIŞINDAN doğuyor:
//
//   settings → kullanıcı tercihleri. Asla otomatik silinmez.
//   data     → kullanıcının ürettiği içerik (taslak, sohbet, ilerleme). Asla
//              otomatik silinmez; yalnız hesap çıkışında uid kapsamı temizlenir.
//   cache    → yeniden üretilebilir her şey (TMDB yanıtları, feed, liste durumu).
//              "Önbelleği temizle" = tek çağrı: cache.clearAll().
//   session  → oturuma bağlı kısa ömürlü durum (cachedUserId, bekleyen google
//              profili, son giren kullanıcılar).
//
// Eskiden hepsi tek bir AsyncStorage kovasındaydı; "önbelleği temizle" akışı bu
// yüzden elle anahtar listesi süzmek zorundaydı (bkz. eski cacheInspector) ve
// listeye eklenmeyen her yeni cache anahtarı sessizce sonsuza dek diskte kaldı.

import { createMMKV } from "react-native-mmkv";
import { reportStorageError } from "./errors";

/** Mantıksal depo adı → MMKV instance id. */
export const STORES = {
  settings: "seelogd.settings",
  data: "seelogd.data",
  cache: "seelogd.cache",
  session: "seelogd.session",
  // Yalnız Firebase Auth SDK'sının kalıcılığı için (bkz. authPersistence.js).
  // AYRI TUTULMASININ SEBEBİ: çıkışta `session` deposu komple boşaltılıyor.
  // Auth token'ı orada olsaydı, oturum açıkken tetiklenen bir temizlik
  // kullanıcıyı düşürürdü. Bu depoya bizim kodumuz hiç dokunmaz.
  auth: "seelogd.auth",
};

export const STORE_NAMES = Object.keys(STORES);

/**
 * MMKV açılamazsa (bozuk dosya, disk dolu, izin) uygulama ÇÖKMEMELİ. O depo
 * için süreç ömrü boyunca yaşayan bellek-içi bir taklit devreye girer: okuma
 * varsayılana düşer, yazma kaybolur ama akış devam eder.
 */
function createInMemoryFallback(id) {
  const map = new Map();
  const listeners = new Set();
  const emit = (key) => {
    for (const fn of listeners) {
      try {
        fn(key);
      } catch {
        // dinleyici hatası diğerlerini düşürmesin
      }
    }
  };
  return {
    id,
    isFallback: true,
    get length() {
      return map.size;
    },
    get byteSize() {
      let total = 0;
      for (const [k, v] of map) total += k.length + String(v).length;
      return total;
    },
    set(key, value) {
      map.set(key, value);
      emit(key);
    },
    getString: (key) => (typeof map.get(key) === "string" ? map.get(key) : undefined),
    getNumber: (key) => (typeof map.get(key) === "number" ? map.get(key) : undefined),
    getBoolean: (key) => (typeof map.get(key) === "boolean" ? map.get(key) : undefined),
    getBuffer: () => undefined,
    contains: (key) => map.has(key),
    remove(key) {
      const had = map.delete(key);
      if (had) emit(key);
      return had;
    },
    getAllKeys: () => Array.from(map.keys()),
    clearAll() {
      const keys = Array.from(map.keys());
      map.clear();
      keys.forEach(emit);
    },
    trim() {},
    addOnValueChangedListener(fn) {
      listeners.add(fn);
      return { remove: () => listeners.delete(fn) };
    },
  };
}

const created = new Map();

function open(name) {
  const id = STORES[name];
  try {
    return createMMKV({
      id,
      // Bozuk CRC/dosya uzunluğunda veriyi atmak yerine kurtarmayı dene.
      // Varsayılan davranış sessizce her şeyi silmek; ayarları kaybetmektense
      // kısmi kurtarma her zaman daha iyi.
      recoveryStrategy: "recover-on-error",
      // Aynı değer tekrar yazılırken diske dokunma. Ayar ekranlarında slider'lar
      // her render'da set çağırabiliyor; bu bayrak o yazmaları ücretsiz yapar.
      compareBeforeSet: true,
    });
  } catch (error) {
    reportStorageError("mmkv:open", error, { id });
    return createInMemoryFallback(id);
  }
}

/**
 * İlgili MMKV örneğini döndürür (tembel açılır, sonra önbelleklenir).
 * @param {"settings"|"data"|"cache"|"session"} name
 */
export function getStore(name) {
  if (!STORES[name]) {
    throw new Error(`[storage] bilinmeyen depo: ${name}`);
  }
  let instance = created.get(name);
  if (!instance) {
    instance = open(name);
    created.set(name, instance);
  }
  return instance;
}

/** Testlerde örnekleri sıfırlamak için. Üretim kodunda çağrılmaz. */
export function __resetStores() {
  for (const instance of created.values()) {
    try {
      instance.clearAll();
    } catch {
      // yok say
    }
  }
  created.clear();
}
