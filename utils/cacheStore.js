// utils/cacheStore.js
//
// Dosya-tabanlı kalıcı JSON cache (offline-first veri katmanının deposu).
// Firebase JS SDK + React Native'de Firestore'un yerleşik disk persistence'ı
// çalışmadığı için (IndexedDB yok), çekilen veriyi BİZ diske yazıyoruz.
//
// Konum: <cache>/datacache/<ns>/<readable>_<hash>.json
//   - ns  : namespace (örn 'lists', 'notes', 'tmdb', 'profile')
//   - key : serbest string (URL, uid, contextId...) — dosya adına hash'lenir
//
// Her kayıt { t: zaman(ms), v: veri } olarak saklanır → maxAge kontrolü mümkün.
// expo-file-system v19: exists/size/delete/create/write/textSync SENKRON'dur.

import { File, Directory, Paths } from "expo-file-system";

// <cache>/datacache klasör adı (cacheInspector da bunu okur).
export const DATACACHE_DIRNAME = "datacache";

const ROOT = new Directory(Paths.cache, DATACACHE_DIRNAME);

// Kısa, çakışmasız dosya adı üretimi.
function hashKey(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function sanitize(s, max) {
  return String(s).replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, max);
}
function nsDir(ns) {
  return new Directory(ROOT, sanitize(ns, 60));
}
function keyFile(ns, key) {
  const k = String(key);
  const name = `${sanitize(k, 90)}_${hashKey(k)}.json`;
  return new File(nsDir(ns), name);
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
    return true;
  } catch {
    return false;
  }
}

/** Ham kaydı döndür ({ t, v }) ya da null. */
function getEntry(ns, key) {
  try {
    const file = keyFile(ns, key);
    if (!file.exists) return null;
    return JSON.parse(file.textSync());
  } catch {
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

/** Tek bir kaydı sil. */
export function remove(ns, key) {
  try {
    const f = keyFile(ns, key);
    if (f.exists) f.delete();
  } catch {
    // yok say
  }
}

/** Bir namespace'in tamamını sil. */
export function clearNamespace(ns) {
  try {
    const d = nsDir(ns);
    if (d.exists) d.delete();
  } catch {
    // yok say
  }
}

/** Tüm veri cache'ini sil. */
export function clearAll() {
  try {
    if (ROOT.exists) ROOT.delete();
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

/** Toplam veri-cache boyutu (byte). */
export function totalSize() {
  return dirSize(ROOT);
}
