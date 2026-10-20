// services/accountPrivateService.js
//
// Hesabın GİZLİ kimlik bilgileri: e-posta + doğum tarihi.
//
// Users/{uid} kök belgesi TÜM oturumlulara okunur (profil kartları, arama,
// arkadaş listeleri); bu iki alan orada duramaz — arayüz göstermese de başka
// biri API ile okuyabilirdi. Yeri Users/{uid}/private/account (yalnız sahibi
// okur/yazar, bkz. firestore.rules). Push jetonlarıyla (private/push) aynı
// desen; plan ve sıra: docs/mimari/KULLANICI_OZEL_ALAN_GOCU.md.
//
// OKUMA: önce bu belge, bulunmazsa kök (henüz taşınmamış eski hesap).
// YAZMA: yalnız bu belge. Kökte kalmış eski kopyayı sahibi uygulamayı
// açtığında migrateRootAccountFields temizler (önce kopya, SONRA silme).

import {
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

/** Gizli belgede duran alanlar. Başka alan eklemek kural + bekçi test ister. */
export const ACCOUNT_PRIVATE_FIELDS = ["email", "birthDate"];

export const accountDocRef = (uid) => doc(db, "Users", uid, "private", "account");

/**
 * Bir nesneden yalnız gizli alanları, YALNIZ geçerli (boş olmayan string)
 * değerleriyle alır. `undefined`/null/boş yazmak setDoc'u düşürür ya da kuralı
 * (`is string`) çiğner; alan ya geçerli ya da hiç yok.
 */
export function pickAccountFields(source) {
  const out = {};
  if (!source || typeof source !== "object") return out;
  for (const key of ACCOUNT_PRIVATE_FIELDS) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") out[key] = value.trim();
  }
  return out;
}

/**
 * Profil yamasını (updateUserProfile'a gelen) iki yola ayırır:
 * `account` → gizli belge, `rest` → kök belge. Gizli alanın değeri geçersizse
 * (örn. null) `account`a girmez ama kök yamasından da DÜŞER — kökte yeniden
 * ortaya çıkmasın.
 */
export function splitAccountFields(partial) {
  const rest = { ...(partial || {}) };
  for (const key of ACCOUNT_PRIVATE_FIELDS) delete rest[key];
  return { account: pickAccountFields(partial), rest };
}

/** Gizli belgeye (merge) yazar. updatedAt otomatik. */
export async function writeAccountFields(uid, fields) {
  const account = pickAccountFields(fields);
  if (!uid || Object.keys(account).length === 0) return false;
  await setDoc(
    accountDocRef(uid),
    { ...account, updatedAt: serverTimestamp() },
    { merge: true },
  );
  return true;
}

/**
 * Gizli belgeyi canlı dinler. İlk anlık görüntü gelene kadar `onData` çağrılmaz;
 * belge yoksa `onData(null)` — "bilinmiyor" ile "yok" ayrımı çağıranda.
 */
export function subscribeAccountPrivate(uid, onData, onError) {
  return onSnapshot(
    accountDocRef(uid),
    (snap) => onData(snap.exists() ? snap.data() : null),
    onError,
  );
}

/**
 * Kök belgedeki eski kopyayı gizli belgeye taşır (sahibi kendi hesabında).
 *
 * SIRA ÖNEMLİ: önce gizli belgeye yaz, kökten ANCAK ondan sonra sil. Ters
 * sırada yazma düşerse doğum tarihi (yaş kapısı) kalıcı olarak kaybolurdu —
 * kural da bunu zaten reddeder (bkz. birthDateKept). Gizli belgede zaten bir
 * değer varsa o KAZANIR (e-posta sonradan değişmiş olabilir; kökteki eski
 * değer onu ezmemeli).
 *
 * Idempotent; her açılışta değil, kökte alan görüldüğünde çağrılır.
 *
 * @param {string} uid
 * @param {object} rootData kök Users/{uid} belgesinin verisi
 * @returns {Promise<"none"|"migrated"|"conflict">}
 *   "conflict": gizli belgedeki doğum tarihi kökle çelişiyor → kökten silinmedi.
 */
export async function migrateRootAccountFields(uid, rootData) {
  const legacy = pickAccountFields(rootData);
  const legacyKeys = ACCOUNT_PRIVATE_FIELDS.filter(
    (key) => rootData && Object.prototype.hasOwnProperty.call(rootData, key),
  );
  if (!uid || legacyKeys.length === 0) return "none";

  const existingSnap = await getDoc(accountDocRef(uid));
  const existing = existingSnap.exists() ? existingSnap.data() : {};

  if (legacy.birthDate && existing.birthDate && existing.birthDate !== legacy.birthDate) {
    return "conflict";
  }

  const missing = {};
  for (const key of Object.keys(legacy)) {
    if (!existing[key]) missing[key] = legacy[key];
  }
  if (Object.keys(missing).length > 0) await writeAccountFields(uid, missing);

  const removal = {};
  for (const key of legacyKeys) removal[key] = deleteField();
  // updatedAt'e dokunulmuyor: bu bir kullanıcı eylemi değil, bakım.
  await updateDoc(doc(db, "Users", uid), removal);
  return "migrated";
}
