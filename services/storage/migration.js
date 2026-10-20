// services/storage/migration.js
//
// AsyncStorage → MMKV tek seferlik göç.
//
// SÖZLEŞME
//   • Fikirdeşdir (idempotent): sürüm damgası MMKV'de tutulur, ikinci açılışta
//     hiç async iş yapılmaz. `isMigrated()` senkron olduğu için normal açılış
//     hiçbir bedel ödemez.
//   • Kayıpsızdır: ayar ve kullanıcı verisi kopyalandıktan sonra AsyncStorage'da
//     BIRAKILIR. Bir sürüm boyunca geri dönüş ağı olarak durur; temizliği
//     `purgeMigratedAsyncStorage()` yapar (bilinçli olarak sonraki sürüme kalır).
//   • Önbellek istisnadır: kopyalandıktan HEMEN SONRA AsyncStorage'dan silinir.
//     Aksi halde onlarca MB veri diskte iki kez dururdu; önbellek zaten yeniden
//     üretilebilir olduğu için kısmi hata da zararsız.
//
// KAPSAM DEĞİŞİKLİĞİ
//   Taslaklar ve AI sohbet geçmişi eskiden uid'siz global anahtarlardı. Göç
//   bunları `cachedUserId`nin işaret ettiği sahibin kapsamına taşır — o kayıt
//   girişte yazılıp çıkışta silindiği için taslakların gerçek sahibini tam
//   olarak o gösterir. Kayıt yoksa veri `guest` kapsamına gider.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStore } from "./instances";
import { writeTyped, coerceLegacy } from "./codec";
import { ALL_KEYS, ALL_NAMESPACES, GUEST_SCOPE, Keys } from "./registry";
import { resetActiveUser } from "./store";
import { reportStorageError } from "./errors";

const VERSION_KEY = "__storage/migrationVersion";
const ATTEMPTS_KEY = "__storage/migrationAttempts";
const CURRENT_VERSION = 1;
// Göç sürekli patlıyorsa (bozuk AsyncStorage veritabanı) kullanıcıyı her
// açılışta bekletmeyelim: birkaç denemeden sonra pes edip varsayılanlarla devam.
const MAX_ATTEMPTS = 3;

// Eski sürümlerin diske DÜZ METİN yazdığı parolalar. Eskiden yalnız LoginScreen
// açıldığında temizleniyordu; artık göçün parçası — giriş ekranını hiç görmeyen
// (oturumu açık) kullanıcılarda da siliniyor.
const LEAKED_PASSWORD_PREFIX = "password_";

let inFlight = null;

/** Senkron kontrol — açılış yolunda async iş yapılmalı mı? */
export function isMigrated() {
  try {
    const version = getStore("settings").getNumber(VERSION_KEY) || 0;
    if (version >= CURRENT_VERSION) return true;
    const attempts = getStore("settings").getNumber(ATTEMPTS_KEY) || 0;
    return attempts >= MAX_ATTEMPTS;
  } catch {
    // MMKV açılamıyorsa göçün de anlamı yok; uygulamayı bekletme.
    return true;
  }
}

function markMigrated() {
  try {
    getStore("settings").set(VERSION_KEY, CURRENT_VERSION);
  } catch (error) {
    reportStorageError("migrate:mark", error);
  }
}

function bumpAttempts() {
  try {
    const store = getStore("settings");
    store.set(ATTEMPTS_KEY, (store.getNumber(ATTEMPTS_KEY) || 0) + 1);
  } catch {
    // yok say
  }
}

/** `legacy` girdisi hem düz string hem { key, transform } olabilir. */
function normalizeLegacy(entry) {
  return typeof entry === "string" ? { key: entry, transform: null } : entry;
}

/** Ham AsyncStorage string'ini hedef tipe çevirir (özel dönüşümler dahil). */
function decodeLegacyValue(descriptor, raw, transform) {
  if (raw === null || raw === undefined) return { ok: false };
  const custom = transform || descriptor.fromLegacy;
  if (custom) {
    try {
      const result = custom(raw);
      if (result?.ok) return result;
    } catch {
      // özel dönüşüm patlarsa standart yola düş
    }
  }
  return coerceLegacy(raw, descriptor.type);
}

function writeMigrated(descriptor, physical, value) {
  if (descriptor.validate && !descriptor.validate(value)) return false;
  try {
    return writeTyped(getStore(descriptor.store), physical, descriptor.type, value);
  } catch (error) {
    reportStorageError(`migrate:write:${descriptor.name}`, error, { key: physical });
    return false;
  }
}

async function migrateKeys(allKeys, values, ownerUid) {
  const copied = [];
  const cacheKeysToPurge = [];

  for (const descriptor of ALL_KEYS) {
    try {
      if (descriptor.scope === "user") {
        // 1) Zaten uid ile kapsanmış kayıtlar: önekle eşleşen HER uid taşınır.
        for (const legacyKey of allKeys) {
          if (!legacyKey.startsWith(descriptor.key)) continue;
          const decoded = decodeLegacyValue(descriptor, values.get(legacyKey));
          if (!decoded.ok) continue;
          // Fiziksel ad aynı kalıyor (önek + uid) — düz kopya.
          if (writeMigrated(descriptor, legacyKey, decoded.value)) {
            copied.push(legacyKey);
            if (descriptor.store === "cache") cacheKeysToPurge.push(legacyKey);
          }
        }
        // 2) Global iken kapsama alınanlar: eski kayıt sahibinin altına taşınır.
        for (const entry of descriptor.legacy) {
          const { key, transform } = normalizeLegacy(entry);
          if (!values.has(key)) continue;
          const decoded = decodeLegacyValue(descriptor, values.get(key), transform);
          if (!decoded.ok) continue;
          const physical = `${descriptor.key}${ownerUid || GUEST_SCOPE}`;
          if (writeMigrated(descriptor, physical, decoded.value)) copied.push(key);
        }
        continue;
      }

      // Global anahtar: önce asıl ad, yoksa legacy adaylar.
      const candidates = [
        { key: descriptor.key, transform: null },
        ...descriptor.legacy.map(normalizeLegacy),
      ];
      for (const { key, transform } of candidates) {
        if (!values.has(key)) continue;
        const decoded = decodeLegacyValue(descriptor, values.get(key), transform);
        if (!decoded.ok) continue;
        if (writeMigrated(descriptor, descriptor.key, decoded.value)) {
          copied.push(key);
          if (descriptor.store === "cache") cacheKeysToPurge.push(key);
        }
        break; // ilk geçerli aday kazanır
      }
    } catch (error) {
      reportStorageError(`migrate:key:${descriptor.name}`, error);
    }
  }

  return { copied, cacheKeysToPurge };
}

function migrateNamespaces(allKeys, values) {
  const purge = [];
  for (const definition of ALL_NAMESPACES) {
    const store = getStore(definition.store);
    for (const key of allKeys) {
      if (!key.startsWith(definition.prefix)) continue;
      const raw = values.get(key);
      if (typeof raw !== "string") continue;
      try {
        // Ham string olarak taşınır: apicache girdileri zaten { data, ts }
        // JSON'u ve burada ayrıştırmanın hiçbir faydası yok.
        store.set(key, raw);
        if (definition.store === "cache") purge.push(key);
      } catch (error) {
        reportStorageError("migrate:namespace", error, { key });
      }
    }
  }
  return purge;
}

/**
 * Eski TEK özel tema kaydını (`customThemeTokens`) çoklu tema yapısına taşır.
 *
 * Registry'nin `legacy` mekanizmasıyla yapılamıyor çünkü ÇAPRAZ ANAHTAR etkisi
 * var: seçili tema "custom" ise `selectedTheme` de yeni üretilen id'ye
 * ("custom:<id>") çevrilmeli. Tek anahtarlık bir dönüşüm bunu göremez.
 */
function migrateCustomThemes(values, now) {
  const settings = getStore("settings");
  // Yeni yapı zaten doluysa dokunma.
  const mevcut = settings.getString(Keys.customThemes.key);
  if (mevcut && mevcut !== "[]") return;

  const raw = values.get("customThemeTokens");
  if (!raw) return;

  let tokens;
  try {
    tokens = JSON.parse(raw);
  } catch {
    return;
  }
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) return;

  const id = `ct_${now.toString(36)}_migrated`;
  settings.set(
    Keys.customThemes.key,
    JSON.stringify([{ id, name: "Özel Tema", tokens }]),
  );

  if (values.get(Keys.theme.key) === "custom") {
    settings.set(Keys.theme.key, `custom:${id}`);
  }
}

async function removeFromAsyncStorage(keys) {
  if (!keys.length) return;
  // multiRemove'u parçalara böl: bazı Android sürümlerinde tek seferde binlerce
  // anahtar SQLite değişken sınırına takılıyor.
  const CHUNK = 200;
  for (let i = 0; i < keys.length; i += CHUNK) {
    try {
      await AsyncStorage.multiRemove(keys.slice(i, i + CHUNK));
    } catch (error) {
      reportStorageError("migrate:purge", error, { count: keys.length });
    }
  }
}

async function performMigration() {
  bumpAttempts();

  const allKeys = await AsyncStorage.getAllKeys();
  if (!allKeys.length) {
    markMigrated();
    resetActiveUser();
    return { copied: 0, purged: 0, empty: true };
  }

  const pairs = await AsyncStorage.multiGet(allKeys);
  const values = new Map(pairs);

  // Taslak/sohbet sahibini belirle. Bu kayıt girişte yazılıp çıkışta silindiği
  // için "bu cihazda en son oturum açan" sorusunun tam cevabı.
  const ownerUid = values.get(Keys.cachedUserId.key) || null;

  const { copied, cacheKeysToPurge } = await migrateKeys(allKeys, values, ownerUid);
  migrateCustomThemes(values, Date.now());
  const namespacePurge = migrateNamespaces(allKeys, values);

  // Sızmış düz metin parolalar — kopyalanmaz, doğrudan silinir.
  const leaked = allKeys.filter((k) => k.startsWith(LEAKED_PASSWORD_PREFIX));

  const purge = [...new Set([...cacheKeysToPurge, ...namespacePurge, ...leaked])];
  await removeFromAsyncStorage(purge);

  markMigrated();
  // Göç `cachedUserId`yi yeni yazdı; aktif kullanıcının tembel önbelleği
  // bayat olabilir (bkz. store.js → resetActiveUser).
  resetActiveUser();
  return { copied: copied.length, purged: purge.length, ownerUid: !!ownerUid };
}

/**
 * Göçü çalıştırır (gerekiyorsa). Aynı anda birden çok çağrı tek işe bağlanır.
 * ASLA throw etmez — hata durumunda uygulama registry varsayılanlarıyla açılır
 * ve göç bir sonraki açılışta yeniden denenir.
 */
export function runStorageMigration() {
  if (isMigrated()) return Promise.resolve(null);
  if (inFlight) return inFlight;

  inFlight = performMigration()
    .catch((error) => {
      reportStorageError("migrate", error);
      return null;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/**
 * Göç edilmiş ayar/veri anahtarlarını AsyncStorage'dan siler.
 *
 * BİLİNÇLİ OLARAK AÇILIŞTA ÇAĞRILMAZ: bir sürüm boyunca eski kayıtlar geri
 * dönüş ağı olarak dursun. MMKV'ye geçen sürüm sahada doğrulandıktan sonra
 * bir sonraki sürümde açılış akışına eklenir.
 */
export async function purgeMigratedAsyncStorage() {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const owned = new Set();
    for (const descriptor of ALL_KEYS) {
      if (descriptor.scope === "user") {
        allKeys.filter((k) => k.startsWith(descriptor.key)).forEach((k) => owned.add(k));
      } else {
        owned.add(descriptor.key);
      }
      descriptor.legacy.forEach((entry) => owned.add(normalizeLegacy(entry).key));
    }
    for (const definition of ALL_NAMESPACES) {
      allKeys.filter((k) => k.startsWith(definition.prefix)).forEach((k) => owned.add(k));
    }
    const target = allKeys.filter((k) => owned.has(k));
    await removeFromAsyncStorage(target);
    return target.length;
  } catch (error) {
    reportStorageError("purgeMigrated", error);
    return 0;
  }
}

export const __internal = { CURRENT_VERSION, VERSION_KEY, ATTEMPTS_KEY, MAX_ATTEMPTS };
