// services/storage/authPersistence.js
//
// Firebase Auth için MMKV destekli kalıcılık.
//
// GEÇİŞİN EN RİSKLİ NOKTASI BURASIYDI. Oturum token'ları AsyncStorage'da
// `firebase:authUser:<apiKey>:[DEFAULT]` altında duruyor. Depoyu düz
// değiştirmek, güncellemeyi alan HERKESİ çıkışa düşürürdü.
//
// Çözüm tembel göç: okuma önce MMKV'ye bakar, ıskalarsa AsyncStorage'a düşer ve
// bulduğunu MMKV'ye geri yazar. Firebase'in kalıcılık arayüzü zaten async
// olduğu için bu düşüş bedavaya geliyor — SDK tarafında hiçbir değişiklik yok.
//
// Token'lar YENİ AÇILIŞTA ilk okumada taşınır; sonraki okumalar MMKV'den gelir.
// AsyncStorage'daki kopya silinmez: bu sürüm geri alınırsa oturumlar yerinde
// durmalı. Temizliği migration.js'teki purgeMigratedAsyncStorage üstlenir.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStore } from "./instances";
import { reportStorageError } from "./errors";

// Yalnız bir kez düşülsün: ilk ıskalamadan sonra anahtarın AsyncStorage'da da
// olmadığı biliniyorsa her okumada köprüyü tekrar yoklamanın anlamı yok.
const missing = new Set();

/**
 * `getReactNativePersistence(...)`a verilecek nesne. Firebase yalnız bu üç
 * metodu çağırır ve hepsinin Promise dönmesini bekler.
 */
export const mmkvAuthPersistence = {
  async getItem(key) {
    try {
      const local = getStore("auth").getString(key);
      if (local !== undefined) return local;
    } catch (error) {
      reportStorageError("auth:read", error, { key });
    }

    if (missing.has(key)) return null;

    // MMKV'de yok → eski depoya düş ve bulursan taşı.
    try {
      const legacy = await AsyncStorage.getItem(key);
      if (legacy === null || legacy === undefined) {
        missing.add(key);
        return null;
      }
      try {
        getStore("auth").set(key, legacy);
      } catch (error) {
        reportStorageError("auth:backfill", error, { key });
      }
      return legacy;
    } catch (error) {
      reportStorageError("auth:legacyRead", error, { key });
      return null;
    }
  },

  async setItem(key, value) {
    missing.delete(key);
    try {
      getStore("auth").set(key, String(value));
    } catch (error) {
      // Token yazılamazsa oturum bu açılışla sınırlı kalır; uygulama çalışır.
      reportStorageError("auth:write", error, { key });
    }
  },

  async removeItem(key) {
    missing.add(key);
    try {
      getStore("auth").remove(key);
    } catch (error) {
      reportStorageError("auth:remove", error, { key });
    }
    // Eski kopyayı da sil: aksi halde çıkış yapan kullanıcı, sürüm geri
    // alındığında geri giriş yapmış görünürdü.
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // yok say — MMKV tarafı zaten temiz
    }
  },
};

/** Testler için köprü durumunu sıfırlar. */
export function __resetAuthPersistence() {
  missing.clear();
}
