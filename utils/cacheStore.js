// utils/cacheStore.js
//
// Dosya-tabanlı kalıcı JSON cache (offline-first veri katmanının deposu).
// Firebase JS SDK + React Native'de Firestore'un yerleşik disk persistence'ı
// çalışmadığı için (IndexedDB yok), çekilen veriyi BİZ diske yazıyoruz.
//
// İKİ KONUM VAR:
//
//   1) ÖNBELLEK (varsayılan) — <cache>/datacache/<ns>/<readable>_<hash>.json
//      Sistem depolama azalınca bu klasörü SİLEBİLİR (Android "önbelleği
//      temizle", iOS Caches boşaltma). Yeniden üretilebilir veri için uygun:
//      TMDB yanıtları, profil (sunucu kaynaklı), türetilmiş istatistik.
//
//   2) KALICI (DURABLE_NAMESPACES) — <document>/userdata/<ns>/...
//      Kullanıcının KENDİ ürettiği ve buluttan artık her açılışta çekmediğimiz
//      veri: notlar, medya notları, AI sohbetleri, hatırlatıcılar, listeler. Bu veri için
//      yerel kopya "tohum" değil KAYNAKTIR; sistem silerse tek seferlik
//      yeniden indirme gerekirdi ve bekleyen yazımlar tehlikeye girerdi. Belge
//      dizini sistem tarafından silinmez.
//
//   `ns` kalıcı kümedeyse çağrı yerleri DEĞİŞMEZ: aynı setJSON/getJSON, aynı
//   `cacheKeys` anahtarları (snapshotCache, listSyncService, dataDownloader
//   hepsi olduğu gibi çalışır).
//
// ESKİ KONUMDAN TAŞIMA: bu sürümden önce kalıcı ad alanları da önbellek
// klasöründeydi. Okuma, kayıt kalıcı konumda yoksa eski konumda arar, bulursa
// HAM METNİ (zaman damgası dahil) kalıcı konuma kopyalayıp eskisini siler.
// Yani güncellemeyi alan kullanıcı buluttan bir şey İNDİRMEZ.
//
// Her kayıt { t: zaman(ms), v: veri } olarak saklanır → maxAge kontrolü mümkün.
// expo-file-system v19: exists/size/delete/create/write/textSync SENKRON'dur.

import { File, Directory, Paths } from "expo-file-system";

// <cache>/datacache klasör adı (cacheInspector da bunu okur).
export const DATACACHE_DIRNAME = "datacache";
// <document>/userdata — kalıcı kullanıcı verisi.
export const DURABLE_DIRNAME = "userdata";

/**
 * Sistemin silemeyeceği yere yazılan ad alanları. Yeni bir kullanıcı-sahipli
 * Firestore verisi eklenirse BURAYA ekle (ve `services/userData`'ya bir alan).
 *
 * `profile`/`activity`/`stats` BİLEREK yok: profil başkalarının yazımıyla da
 * değişir (arkadaş sayacı vb.) ve canlı dinlenmeye devam eder; geri kalanı
 * kaynağından yeniden türetilebilir.
 */
export const DURABLE_NAMESPACES = Object.freeze([
  "notes",
  "mediaNotes",
  "aiConversations",
  "posterChoices",
  "reminders",
  "lists",
]);
const DURABLE_SET = new Set(DURABLE_NAMESPACES);

export const isDurableNamespace = (ns) => DURABLE_SET.has(ns);

const ROOT = new Directory(Paths.cache, DATACACHE_DIRNAME);
const DURABLE_ROOT = new Directory(Paths.document, DURABLE_DIRNAME);

// Kısa, çakışmasız dosya adı üretimi.
function hashKey(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function sanitize(s, max) {
  return String(s).replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, max);
}
/** Önbellek (silinebilir) klasörü — kalıcı ad alanları için ESKİ konum. */
function cacheNsDir(ns) {
  return new Directory(ROOT, sanitize(ns, 60));
}
function nsDir(ns) {
  const root = isDurableNamespace(ns) ? DURABLE_ROOT : ROOT;
  return new Directory(root, sanitize(ns, 60));
}
function fileName(key) {
  const k = String(key);
  return `${sanitize(k, 90)}_${hashKey(k)}.json`;
}
function keyFile(ns, key) {
  return new File(nsDir(ns), fileName(key));
}
/** Yalnız kalıcı ad alanları için: eski (önbellek) konumdaki dosya. */
function legacyKeyFile(ns, key) {
  return new File(cacheNsDir(ns), fileName(key));
}
function ensureDir(dir) {
  try {
    if (!dir.exists) dir.create({ intermediates: true });
  } catch {
    // zaten var / yarış → yok say
  }
}

/** Veriyi cache'e yaz. Başarılıysa true. */
export function setJSON(ns, key, data) {
  try {
    ensureDir(nsDir(ns));
    keyFile(ns, key).write(JSON.stringify({ t: Date.now(), v: data }));
    if (isDurableNamespace(ns)) {
      // Eski konumdaki kopya artık BAYAT: bırakılırsa bir sonraki okuma ya da
      // taşıma yeni veriyi eskisiyle ezebilirdi.
      try {
        const eski = legacyKeyFile(ns, key);
        if (eski.exists) eski.delete();
      } catch {
        // yok say
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Kalıcı ad alanı için eski konumdan taşıma. Ham metni kopyalar (zaman damgası
 * korunur); kopya yazılamazsa eski dosya SİLİNMEZ, bir sonraki okumada tekrar
 * denenir.
 */
function migrateFromCacheDir(ns, key) {
  try {
    const eski = legacyKeyFile(ns, key);
    if (!eski.exists) return null;
    const ham = eski.textSync();
    const parsed = JSON.parse(ham);
    ensureDir(nsDir(ns));
    keyFile(ns, key).write(ham);
    try {
      eski.delete();
    } catch {
      // kopya yazıldı; eski dosyanın silinememesi veriyi bozmaz
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Ham kaydı döndür ({ t, v }) ya da null. */
function getEntry(ns, key) {
  try {
    const file = keyFile(ns, key);
    if (file.exists) return JSON.parse(file.textSync());
    if (isDurableNamespace(ns)) return migrateFromCacheDir(ns, key);
    return null;
  } catch {
    // Bozuk JSON: "kayıt yok" say. Kalıcı ad alanlarında bu, tek seferlik
    // yeniden indirmeyi tetikler; bekleyen yazımlar ayrı bir günlükte
    // (services/userData/outbox) durduğu için kaybolmaz.
    return null;
  }
}

/**
 * Cache'ten veri oku.
 * @param {object} [opts]
 * @param {number} [opts.maxAge] - ms; kayıt bundan eskiyse null döner.
 * @returns veri | null
 */
export function getJSON(ns, key, { maxAge } = {}) {
  const entry = getEntry(ns, key);
  if (!entry) return null;
  if (maxAge && Date.now() - entry.t > maxAge) return null;
  return entry.v;
}

/** Kaydın yaşı (ms) ya da null. */
export function getAge(ns, key) {
  const entry = getEntry(ns, key);
  return entry ? Date.now() - entry.t : null;
}

/** Tek bir kaydı sil (kalıcı ad alanlarında eski konumdaki kopya da). */
export function remove(ns, key) {
  try {
    const f = keyFile(ns, key);
    if (f.exists) f.delete();
  } catch {
    // yok say
  }
  if (isDurableNamespace(ns)) {
    try {
      const eski = legacyKeyFile(ns, key);
      if (eski.exists) eski.delete();
    } catch {
      // yok say
    }
  }
}

/** Bir namespace'in tamamını sil (kalıcı ad alanında her iki konum). */
export function clearNamespace(ns) {
  try {
    const d = nsDir(ns);
    if (d.exists) d.delete();
  } catch {
    // yok say
  }
  if (isDurableNamespace(ns)) {
    try {
      const eski = cacheNsDir(ns);
      if (eski.exists) eski.delete();
    } catch {
      // yok say
    }
  }
}

/**
 * Tüm ÖNBELLEK klasörünü sil.
 *
 * KALICI ad alanlarına (notlar, hatırlatıcılar, listeler…) DOKUNMAZ: "önbelleği
 * temizle" kullanıcının kendi verisinin tek yerel kopyasını silmemeli. Kalıcı
 * veriyi silmek için `clearNamespace` / `clearAllDurable` açıkça çağrılır.
 */
export function clearAll() {
  try {
    if (ROOT.exists) ROOT.delete();
  } catch {
    // yok say
  }
}

/** Kalıcı kullanıcı verisinin tamamını sil (çıkış / hesap silme / sıfırlama). */
export function clearAllDurable() {
  try {
    if (DURABLE_ROOT.exists) DURABLE_ROOT.delete();
  } catch {
    // yok say
  }
}

function dirSize(dir) {
  let total = 0;
  try {
    if (!dir.exists) return 0;
    for (const item of dir.list()) {
      if (item instanceof File) total += item.size ?? 0;
      else if (item instanceof Directory) total += dirSize(item);
    }
  } catch {
    // yok say
  }
  return total;
}

/** Toplam ÖNBELLEK boyutu (byte). Kalıcı kullanıcı verisi dahil değil. */
export function totalSize() {
  return dirSize(ROOT);
}

/** Bir ad alanının bayt boyutu (kalıcıysa yeni + henüz taşınmamış eski konum). */
export function namespaceSize(ns) {
  let total = dirSize(nsDir(ns));
  if (isDurableNamespace(ns)) total += dirSize(cacheNsDir(ns));
  return total;
}
