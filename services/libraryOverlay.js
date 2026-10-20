// services/libraryOverlay.js
//
// "İyimser" liste durumu — SADECE bellekte, kalıcı değil.
//
// ── PROBLEM ──────────────────────────────────────────────────────────────────
// Liste/izleme yazımları Firestore transaction'ıdır ve transaction'lar yerelde
// "gecikme telafisi" almaz: kök dokümandaki `statusIndex` sunucu commit'inden
// SONRA değişir (yavaş ağda saniyeler). Bu yüzden detay ekranındaki kalp/izleme
// listesi/izlendi düğmesi basıldığı anda tepki vermiyordu; her ekran kendi
// `optimistic` state'ini kuruyordu (QuickListButtons, ListView, OtherListsPicker…)
// ve bunlar birbirinden habersizdi — liste kartındaki kalbe basınca açık detay
// ekranı, aynı filmin kalbini hâlâ boş gösteriyordu.
//
// ── ÇÖZÜM ────────────────────────────────────────────────────────────────────
// İşlemin NİYETİ (ör. "film 550 favorilerde olacak") işlem sürerken buraya
// yazılır, ListStatusContext bunu statusIndex'in üstüne bindirir
// (utils/listStatusIndex.applyStatusOverlay). Böylece o eseri gösteren HER
// ekran aynı anda güncellenir. İşlem bitince girdi kalkar; başarısızsa hemen,
// başarılıysa kısa bir tutma süresinden sonra (sunucu snapshot'ı gelene kadar
// ekran eski duruma "geri sıçramasın").
//
// BAYRAK BAŞINA JETON: aynı eser için ekle→çıkar art arda gelirse yalnız SON
// jeton bayrağın sahibidir; öndeki işlemin geç bitmesi sondakinin niyetini silmez.

const SETTLE_GRACE_MS = 2500;

/** `${uid}|${type}|${id}|${flag}` → { value, token } */
const entries = new Map();
/** token → o jetonun yazdığı anahtarlar */
const tokenKeys = new Map();
/** uid → donmuş { movie, tv } anlık görüntü (değişmedikçe AYNI referans) */
const snapshots = new Map();
const listeners = new Set();

let nextToken = 1;

export const EMPTY_OVERLAY = Object.freeze({
  movie: Object.freeze({}),
  tv: Object.freeze({}),
});

const keyOf = (uid, type, id, flag) => `${uid}|${type}|${id}|${flag}`;

function rebuild(uid) {
  const movie = {};
  const tv = {};
  const prefix = `${uid}|`;
  for (const [key, entry] of entries) {
    if (!key.startsWith(prefix)) continue;
    const [, type, id, flag] = key.split("|");
    const bucket = type === "tv" ? tv : movie;
    bucket[id] = { ...(bucket[id] || {}), [flag]: entry.value };
  }
  const empty = Object.keys(movie).length === 0 && Object.keys(tv).length === 0;
  if (empty) snapshots.delete(uid);
  else snapshots.set(uid, Object.freeze({ movie, tv }));
}

function emit(uids) {
  uids.forEach(rebuild);
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Dinleyici hatası diğerlerini ya da yazımı etkilemesin.
    }
  });
}

/**
 * Bir işlemin niyetini bindirmeye alır.
 * @param {string} uid
 * @param {"movie"|"tv"} type
 * @param {string|number} id
 * @param {Record<string, boolean>} flags  ör. { inFavorites: true }
 * @returns {number} jeton — settle/fail için sakla
 */
export function beginOverlay(uid, type, id, flags) {
  if (!uid || id == null || !flags) return 0;
  const token = nextToken++;
  const kind = type === "tv" ? "tv" : "movie";
  const keys = [];
  for (const [flag, value] of Object.entries(flags)) {
    if (typeof value !== "boolean") continue;
    const key = keyOf(uid, kind, id, flag);
    entries.set(key, { value, token });
    keys.push(key);
  }
  if (keys.length === 0) return 0;
  tokenKeys.set(token, { uid, keys });
  emit([uid]);
  return token;
}

function release(token) {
  const owned = tokenKeys.get(token);
  if (!owned) return;
  tokenKeys.delete(token);
  let changed = false;
  owned.keys.forEach((key) => {
    // Daha yeni bir jeton bayrağı devraldıysa dokunma.
    if (entries.get(key)?.token === token) {
      entries.delete(key);
      changed = true;
    }
  });
  if (changed) emit([owned.uid]);
}

/** Başarılı bitiş: sunucu snapshot'ı yetişsin diye kısa süre tutup kaldırır. */
export function settleOverlay(token, graceMs = SETTLE_GRACE_MS) {
  if (!token || !tokenKeys.has(token)) return;
  if (graceMs <= 0) {
    release(token);
    return;
  }
  const timer = setTimeout(() => release(token), graceMs);
  // Node/jest sürecinin bu zamanlayıcı yüzünden açık kalmaması için.
  timer?.unref?.();
}

/** Başarısız bitiş: niyet geçersiz, ekran hemen gerçek duruma dönsün. */
export function failOverlay(token) {
  if (!token) return;
  release(token);
}

/** Çıkışta/hesap değişiminde o kullanıcının bekleyen bindirmelerini bırakır. */
export function clearOverlayFor(uid) {
  if (!uid) return;
  const prefix = `${uid}|`;
  let changed = false;
  for (const key of [...entries.keys()]) {
    if (key.startsWith(prefix)) {
      entries.delete(key);
      changed = true;
    }
  }
  for (const [token, owned] of [...tokenKeys.entries()]) {
    if (owned.uid === uid) tokenKeys.delete(token);
  }
  if (changed) emit([uid]);
}

/** useSyncExternalStore için: kullanıcının anlık görüntüsü (yoksa EMPTY_OVERLAY). */
export function getOverlay(uid) {
  return (uid && snapshots.get(uid)) || EMPTY_OVERLAY;
}

export function subscribeOverlay(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Yalnız testler için. */
export function __resetOverlayForTests() {
  entries.clear();
  tokenKeys.clear();
  snapshots.clear();
  listeners.clear();
  nextToken = 1;
}
