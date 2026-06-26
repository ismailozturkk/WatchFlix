// services/profilePropagation.js
//
// Profil (isim / avatar) değişince DENORMALIZE kopyaları güncelle.
// Postlar ve arkadaşlık kayıtları, oluşturulduğu andaki isim+avatar'ı snapshot
// olarak tutar. Kullanıcı profilini değiştirince bu kopyalar eski kalmasın diye
// burada toplu (batch) güncelleme yapılır.
//
// Kapsam:
//   - Posts/{id}            → authorName, authorAvatarIndex   (where authorId == uid)
//   - Users/{friendUid}/friends/{uid} → friendName, friendAvatarIndex
//
// En iyi-çaba: bir adım patlasa diğeri etkilenmez; UI'ı bloklamaz.

import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { clampAvatarIndex } from "../utils/avatars";

const CHUNK = 400; // Firestore batch limiti 500; güvenli pay.

async function commitInChunks(items) {
  let batch = writeBatch(db);
  let n = 0;
  for (const { ref, patch } of items) {
    batch.update(ref, patch);
    if (++n >= CHUNK) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n) await batch.commit();
}

/**
 * @param {string} uid
 * @param {Object} change
 * @param {string} [change.displayName] verilirse isim güncellenir
 * @param {number} [change.avatarIndex] verilirse avatar güncellenir
 */
export async function propagateProfileChange(uid, { displayName, avatarIndex } = {}) {
  if (!uid) return;
  const nameSet = typeof displayName === "string" && displayName.trim().length > 0;
  const avaSet = typeof avatarIndex === "number";
  if (!nameSet && !avaSet) return;

  const name = nameSet ? displayName.trim() : null;
  const idx = avaSet ? clampAvatarIndex(avatarIndex) : null;

  // 1) Kullanıcının postları
  try {
    const snap = await getDocs(
      query(collection(db, "Posts"), where("authorId", "==", uid)),
    );
    const items = snap.docs.map((d) => {
      const patch = {};
      if (nameSet) patch.authorName = name;
      if (avaSet) patch.authorAvatarIndex = idx;
      return { ref: d.ref, patch };
    });
    await commitInChunks(items);
  } catch (e) {
    if (__DEV__) console.warn("propagateProfileChange posts:", e?.message);
  }

  // 2) Arkadaş kayıtları — bana referans veren kopyalar (karşı tarafın listesi).
  try {
    const friendsSnap = await getDocs(collection(db, "Users", uid, "friends"));
    const items = friendsSnap.docs.map((f) => {
      const friendUid = f.id;
      const patch = {};
      if (nameSet) patch.friendName = name;
      if (avaSet) patch.friendAvatarIndex = idx;
      return { ref: doc(db, "Users", friendUid, "friends", uid), patch };
    });
    await commitInChunks(items);
  } catch (e) {
    if (__DEV__) console.warn("propagateProfileChange friends:", e?.message);
  }
}
