// services/profilePropagation.js
//
// Profil (isim / kullanıcı adı / avatar) değişince, istemcinin yazma izni olan
// birkaç denormalize kopyayı gecikmeden güncelle. Tam ve yetkili fan-out
// functions/index.js:onUserProfileUpdated tarafından yapılır.
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
  getDoc,
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

// update() hedef doküman yoksa NOT_FOUND atar ve batch atomik olduğu için
// chunk'taki DİĞER herkesin güncellemesi de iptal olur. Karşı tarafın mirror
// dokümanı eksik olabilir (asimetrik unfriend/purge kalıntısı) — mevcut
// olmayanları güncelleme listesinden çıkar. set+merge KULLANMIYORUZ: yoksa
// hayalet arkadaş dokümanı oluştururdu.
async function filterExistingRefs(items) {
  const checks = await Promise.all(
    items.map(async (item) => {
      try {
        const snap = await getDoc(item.ref);
        return snap.exists() ? item : null;
      } catch {
        return null;
      }
    }),
  );
  return checks.filter(Boolean);
}

/**
 * @param {string} uid
 * @param {Object} change
 * @param {string} [change.displayName] verilirse isim güncellenir
 * @param {string} [change.username] verilirse kullanıcı adı güncellenir
 * @param {number} [change.avatarIndex] verilirse avatar güncellenir
 * @param {string} [change.photoURL] verilirse sosyal profil fotoğrafı güncellenir
 */
export async function propagateProfileChange(
  uid,
  { displayName, username, avatarIndex, photoURL } = {},
) {
  if (!uid) return;
  const nameSet = typeof displayName === "string" && displayName.trim().length > 0;
  const usernameSet = typeof username === "string" && username.trim().length > 0;
  const avaSet = typeof avatarIndex === "number";
  const photoSet = typeof photoURL === "string";
  if (!nameSet && !usernameSet && !avaSet && !photoSet) return;

  const name = nameSet ? displayName.trim() : null;
  const handle = usernameSet ? username.trim() : null;
  const idx = avaSet ? clampAvatarIndex(avatarIndex) : null;
  const photo = photoSet ? (photoURL.trim() || null) : null;

  // 1) Kullanıcının postları
  try {
    const snap = await getDocs(
      query(collection(db, "Posts"), where("authorId", "==", uid)),
    );
    const items = snap.docs.map((d) => {
      const patch = {};
      if (nameSet) patch.authorName = name;
      if (usernameSet) patch.authorUsername = handle;
      if (avaSet) {
        patch.authorAvatarIndex = idx;
        if (idx !== -1) {
          patch.authorAvatar = null;
          patch.authorPhotoURL = null;
        }
      }
      if (photoSet && idx === -1) {
        patch.authorAvatar = photo;
        patch.authorPhotoURL = photo;
      }
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
      if (usernameSet) patch.friendUsername = handle;
      if (avaSet) {
        patch.friendAvatarIndex = idx;
        if (idx !== -1) {
          patch.friendPhotoURL = null;
        }
      }
      if (photoSet && idx === -1) {
        patch.friendPhotoURL = photo;
      }
      return { ref: doc(db, "Users", friendUid, "friends", uid), patch };
    });
    await commitInChunks(await filterExistingRefs(items));
  } catch (e) {
    if (__DEV__) console.warn("propagateProfileChange friends:", e?.message);
  }

  // 3) Ortak Listeler — üyesi olduğum paylaşılan listeler (members.{uid})
  try {
    const sharedSnap = await getDocs(
      query(collection(db, "SharedLists"), where("memberIds", "array-contains", uid)),
    );
    const items = sharedSnap.docs.map((d) => {
      const patch = {};
      if (nameSet) patch[`members.${uid}.name`] = name;
      if (usernameSet) patch[`members.${uid}.username`] = handle;
      if (avaSet) {
        patch[`members.${uid}.avatarIndex`] = idx;
        if (idx !== -1) {
          patch[`members.${uid}.photoURL`] = null;
        }
      }
      if (photoSet && idx === -1) {
        patch[`members.${uid}.photoURL`] = photo;
      }
      return { ref: d.ref, patch };
    });
    await commitInChunks(items);
  } catch (e) {
    if (__DEV__) console.warn("propagateProfileChange shared lists:", e?.message);
  }

  // 4) Gruplar — dahil olduğum gruplar (memberInfo.{uid})
  try {
    const groupsSnap = await getDocs(
      query(collection(db, "groups"), where("members", "array-contains", uid)),
    );
    const items = groupsSnap.docs.map((d) => {
      const patch = {};
      if (nameSet) patch[`memberInfo.${uid}.name`] = name;
      if (usernameSet) patch[`memberInfo.${uid}.username`] = handle;
      if (avaSet) {
        patch[`memberInfo.${uid}.avatarIndex`] = idx;
        if (idx !== -1) {
          patch[`memberInfo.${uid}.photoURL`] = null;
        }
      }
      if (photoSet && idx === -1) {
        patch[`memberInfo.${uid}.photoURL`] = photo;
      }
      return { ref: d.ref, patch };
    });
    await commitInChunks(items);
  } catch (e) {
    if (__DEV__) console.warn("propagateProfileChange groups:", e?.message);
  }
}
