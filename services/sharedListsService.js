// services/sharedListsService.js
//
// ORTAK LİSTELER — birden çok kullanıcının paylaştığı özel listeler.
// Kişisel özel listelerden (Lists/{uid} kök-array) ayrı, üst düzey koleksiyon:
// kök doküman tek kullanıcıya ait olduğundan çok kullanıcılı erişim orada
// güvenli kurallanamaz (groups koleksiyonuyla aynı gerekçe/desen).
//
// Koleksiyonlar:
//   SharedLists/{listId}
//     name, ownerId, ownerName
//     memberIds: [uid, ...]            ← kurucu DAHİL; array-contains sorgusu
//                                        ve kural üyelik kontrolü buradan
//     members: {                       ← uid → meta + yetkiler
//       [uid]: { name, username, avatarIndex, canAdd, canRemove, addedAt }
//     }
//     createdAt, updatedAt
//
//   SharedLists/{listId}/items/{itemKey}   itemKey = `${type}_${id}`
//     id, type, name, imagePath, minutes, genres, dateAdded
//     addedBy, addedByName, addedByAvatarIndex, addedAt
//
// Yetki modeli (kurallarda da zorlanır — firestore.rules):
//   • Kurucu tam yetkili: üye ekle/çıkar, canAdd/canRemove ver/al,
//     her öğeyi sil, listeyi sil/yeniden adlandır.
//   • canAdd=false üye yalnız görür; canAdd=true öğe ekler.
//   • Öğeyi ekleyen kendi eklediğini her zaman geri alabilir;
//     canRemove=true üye herkesin eklediğini silebilir.
//   • Üye kendini listeden çıkarabilir (ayrıl).

import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  writeBatch,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { clampAvatarIndex } from "../utils/avatars";
import { snapshotErrorHandler } from "../utils/firestoreError";

export const sharedItemKey = (type, id) => `${type}_${id}`;

const memberMeta = ({ name, username, avatarIndex, canAdd, canRemove }) => ({
  name: name || "",
  username: username || "",
  avatarIndex: clampAvatarIndex(avatarIndex),
  canAdd: !!canAdd,
  canRemove: !!canRemove,
  addedAt: Date.now(), // members map içinde serverTimestamp kullanılamaz (nested)
});

// ─── OLUŞTUR / SİL / ADLANDIR ─────────────────────────────────────────────────

/**
 * Ortak liste oluştur. Kurucu members map'ine tam yetkiyle girer.
 * @param {Object} p
 * @param {{uid,displayName,username,avatarIndex}} p.owner
 * @param {string} p.name
 * @param {Array<{uid,name,username,avatarIndex,canAdd,canRemove}>} p.friends
 * @returns {string} listId
 */
export async function createSharedList({ owner, name, friends = [] }) {
  if (!owner?.uid) throw new Error("createSharedList: owner yok");
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("createSharedList: isim boş");

  const ref = doc(collection(db, "SharedLists"));
  const members = {
    [owner.uid]: memberMeta({
      name: owner.displayName,
      username: owner.username,
      avatarIndex: owner.avatarIndex,
      canAdd: true,
      canRemove: true,
    }),
  };
  const memberIds = [owner.uid];
  friends.forEach((f) => {
    if (!f?.uid || f.uid === owner.uid || members[f.uid]) return;
    members[f.uid] = memberMeta(f);
    memberIds.push(f.uid);
  });

  await setDoc(ref, {
    name: trimmed,
    ownerId: owner.uid,
    ownerName: owner.displayName || "",
    memberIds,
    members,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameSharedList(listId, name) {
  const trimmed = (name || "").trim();
  if (!listId || !trimmed) throw new Error("renameSharedList: eksik parametre");
  await updateDoc(doc(db, "SharedLists", listId), {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
}

/** Listeyi ve tüm öğelerini sil (yalnız kurucu — kural da zorlar). */
export async function deleteSharedList(listId) {
  if (!listId) throw new Error("deleteSharedList: listId yok");
  // Önce items alt koleksiyonu (Firestore alt koleksiyonu otomatik silmez).
  const itemsSnap = await getDocs(collection(db, "SharedLists", listId, "items"));
  const docs = itemsSnap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, "SharedLists", listId));
}

// ─── ÜYE YÖNETİMİ (kurucu) ────────────────────────────────────────────────────

/** Üye(ler) ekle — kurucu. */
export async function addSharedListMembers(listId, friends = []) {
  if (!listId || friends.length === 0) return;
  const update = { updatedAt: serverTimestamp() };
  const ids = [];
  friends.forEach((f) => {
    if (!f?.uid) return;
    update[`members.${f.uid}`] = memberMeta(f);
    ids.push(f.uid);
  });
  if (ids.length === 0) return;
  update.memberIds = arrayUnion(...ids);
  await updateDoc(doc(db, "SharedLists", listId), update);
}

/** Üye çıkar — kurucu. */
export async function removeSharedListMember(listId, memberUid) {
  if (!listId || !memberUid) throw new Error("removeSharedListMember: eksik parametre");
  await updateDoc(doc(db, "SharedLists", listId), {
    memberIds: arrayRemove(memberUid),
    [`members.${memberUid}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/** Üyenin ekleme/silme yetkisini güncelle — kurucu. */
export async function updateSharedListPermission(listId, memberUid, perms) {
  if (!listId || !memberUid) throw new Error("updateSharedListPermission: eksik parametre");
  const update = { updatedAt: serverTimestamp() };
  if (typeof perms.canAdd === "boolean")
    update[`members.${memberUid}.canAdd`] = perms.canAdd;
  if (typeof perms.canRemove === "boolean")
    update[`members.${memberUid}.canRemove`] = perms.canRemove;
  await updateDoc(doc(db, "SharedLists", listId), update);
}

/** Üye kendini çıkarır (ayrıl). Kural yalnız kendi kaydını silmesine izin verir. */
export async function leaveSharedList(listId, uid) {
  if (!listId || !uid) throw new Error("leaveSharedList: eksik parametre");
  await updateDoc(doc(db, "SharedLists", listId), {
    memberIds: arrayRemove(uid),
    [`members.${uid}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

// ─── ÖĞELER ───────────────────────────────────────────────────────────────────

/**
 * Listeye içerik ekle. Doc id deterministik (`movie_550`) — aynı içerik iki kez
 * eklenemez, kim önce eklediyse çipte o görünür (setDoc üzerine yazmasın diye
 * önce varlık kontrolü çağıran tarafta yapılır; yarış durumunda üzerine yazım
 * zararsızdır — aynı içerik, sadece ekleyen adı değişir).
 * @param {Object} p
 * @param {string} p.listId
 * @param {{uid,displayName,avatarIndex}} p.user
 * @param {{id,type,name,imagePath,minutes,genres,dateAdded}} p.item
 */
export async function addItemToSharedList({ listId, user, item }) {
  if (!listId || !user?.uid || item?.id == null)
    throw new Error("addItemToSharedList: eksik parametre");
  const key = sharedItemKey(item.type, item.id);
  await setDoc(doc(db, "SharedLists", listId, "items", key), {
    id: item.id,
    type: item.type,
    name: item.name || "",
    imagePath: item.imagePath ?? null,
    minutes: item.minutes ?? null,
    genres: item.genres || [],
    dateAdded: item.dateAdded || new Date().toISOString().slice(0, 10),
    addedBy: user.uid,
    addedByName: user.displayName || "",
    addedByAvatarIndex: clampAvatarIndex(user.avatarIndex),
    addedAt: serverTimestamp(),
  });
  // Liste kartı önizlemeleri "son eklenen" görünsün diye updatedAt tazele
  // (best-effort; üye kuralı buna izin vermiyorsa sessiz geç).
  updateDoc(doc(db, "SharedLists", listId), {
    updatedAt: serverTimestamp(),
  }).catch(() => {});
}

export async function removeItemFromSharedList(listId, type, id) {
  if (!listId || id == null) throw new Error("removeItemFromSharedList: eksik parametre");
  await deleteDoc(doc(db, "SharedLists", listId, "items", sharedItemKey(type, id)));
}

/** Tek öğe var mı? (detay ekranı toggle durumu için) */
export async function getSharedListItem(listId, type, id) {
  const snap = await getDoc(
    doc(db, "SharedLists", listId, "items", sharedItemKey(type, id)),
  );
  return snap.exists() ? snap.data() : null;
}

// ─── ABONELİKLER ──────────────────────────────────────────────────────────────

/**
 * Kullanıcının üyesi olduğu tüm ortak listeler (canlı).
 * @returns {Function} unsubscribe — callback(Array<{id, ...data}>)
 */
export function subscribeToMySharedLists(uid, callback) {
  if (!uid) return () => {};
  const q = query(
    collection(db, "SharedLists"),
    where("memberIds", "array-contains", uid),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    snapshotErrorHandler("SharedLists"),
  );
}

/**
 * Tek listenin doküman'ını canlı dinle (üye/yetki değişimleri).
 * Erişim kaldırıldığında (permission-denied) callback(null) çağrılır —
 * ekran "erişim yok" durumuna düşer, sonsuz yükleme kalmaz.
 */
export function subscribeToSharedList(listId, callback) {
  if (!listId) return () => {};
  return onSnapshot(
    doc(db, "SharedLists", listId),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => {
      snapshotErrorHandler("SharedLists/doc")(err);
      callback(null);
    },
  );
}

/** Listenin öğelerini canlı dinle (eklenme sırasına göre eski→yeni). */
export function subscribeToSharedListItems(listId, callback) {
  if (!listId) return () => {};
  return onSnapshot(
    collection(db, "SharedLists", listId, "items"),
    (snap) => {
      const items = snap.docs.map((d) => ({ key: d.id, ...d.data() }));
      items.sort(
        (a, b) =>
          (a.addedAt?.toMillis?.() ?? Infinity) -
          (b.addedAt?.toMillis?.() ?? Infinity),
      );
      callback(items);
    },
    snapshotErrorHandler("SharedLists/items"),
  );
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

export const isSharedListOwner = (list, uid) => !!list && list.ownerId === uid;

export const canAddToSharedList = (list, uid) =>
  !!list && (list.ownerId === uid || list.members?.[uid]?.canAdd === true);

export const canRemoveFromSharedList = (list, uid, item) =>
  !!list &&
  (list.ownerId === uid ||
    item?.addedBy === uid ||
    list.members?.[uid]?.canRemove === true);
