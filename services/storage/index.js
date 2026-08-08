// services/storage/index.js
//
// Uygulamanın kalıcı depolama giriş kapısı. Hiçbir ekran/servis MMKV'yi ya da
// AsyncStorage'ı doğrudan import ETMEZ — hepsi buradan geçer.
//
// KULLANIM
//
//   import { Keys, get, set, remove, useStored } from "../services/storage";
//
//   const tema = get(Keys.theme);              // senkron, varsayılanlı, doğrulanmış
//   set(Keys.theme, "dark");
//   const avatar = get(Keys.avatarIndex, { uid });   // kullanıcı kapsamlı
//   const dil = useStored(Keys.language);       // React'e bağlı, değişince yeniden çizer
//
// YENİ BİR ANAHTAR: yalnız services/storage/registry.js'e girdi ekle.
// Fiziksel anahtar adı başka hiçbir dosyada geçmemeli.
//
// Dosya haritası:
//   registry.js        anahtar tanımları (tek gerçek kaynak)
//   instances.js       MMKV örnekleri: settings / data / cache / session / auth
//   store.js           get / set / remove / subscribe / useStored
//   codec.js           tip dönüşümü, doğrulayıcılar
//   namespace.js       dinamik anahtar aileleri (apicache_*)
//   scope.js           hesap kapsamı temizliği, önbellek ölçümü
//   migration.js       AsyncStorage → MMKV tek seferlik göç
//   authPersistence.js Firebase Auth kalıcılık köprüsü
//   errors.js          tek hata çıkışı (Sentry)

export { Keys, Namespaces, physicalKey, GUEST_SCOPE } from "./registry";
export {
  get,
  set,
  remove,
  has,
  subscribe,
  useStored,
  setActiveUser,
  getActiveUser,
} from "./store";
export { createNamespace } from "./namespace";
export {
  clearUserScope,
  clearAllCacheStorage,
  cacheByteSize,
  scopedByteSize,
  keyByteSize,
  wipeEverything,
  storageStats,
} from "./scope";
export { isMigrated, runStorageMigration, purgeMigratedAsyncStorage } from "./migration";
export { mmkvAuthPersistence } from "./authPersistence";
export { getStore, STORES } from "./instances";
export { TYPES, oneOf, range, arrayOf, plainObject, all } from "./codec";
