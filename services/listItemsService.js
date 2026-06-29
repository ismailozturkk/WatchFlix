// services/listItemsService.js
//
// İzlenen DİZİLER dışındaki TÜM listeler için TEK yazma kaynağı. Kanonik model:
// her liste öğesi AYRI dokümandır (eski dev kök-array `Lists/{uid}.<liste>[]` yerine).
//
//   Öntanımlı (film + dizi karışık olabilir):
//     Lists/{uid}/favorites/{type_id}
//     Lists/{uid}/watchList/{type_id}
//     Lists/{uid}/watchedMovies/{type_id}        (yalnız film)
//       { id, type, name, imagePath, dateAdded, minutes, genres, listOrder }
//
//   Özel (kullanıcının oluşturduğu) listeler — TÜMÜ tek koleksiyonda, listId ile ayrışır:
//     Lists/{uid}/customItems/{listId__type_id}
//       { listId, id, type, name, imagePath, dateAdded, minutes, genres, listOrder }
//     Kayıt defteri kök doküman alanında:
//     Lists/{uid}.customLists: [{ listId, name, order, createdAt }]
//
// Diziler (Lists/{uid}/watchedTv/{showId}, gömülü seasons) `watchedTvService.js`'tedir.
//
// NEDEN: eski model her dokunuşta TÜM listeyi okuyup yeniden yazıyordu. Burada
// yalnızca ilgili ÖĞENİN dokümanı yazılır (Notes/Reminders/watchedTv deseni).

import {
  doc,
  collection,
  setDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  query,
  where,
  writeBatch,
  deleteField,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";

export const PREDEFINED_MOVIE_LISTS = ["favorites", "watchList", "watchedMovies"];
const CUSTOM_ITEMS = "customItems";

// ── Yardımcılar ──────────────────────────────────────────────────────────────
const itemKey = (type, id) => `${type}_${id}`;
const customDocId = (listId, type, id) => `${listId}__${type}_${id}`;

// undefined alanları ele (Firestore undefined kabul etmez); öğeyi normalize et.
function normalizeItem(item) {
  const out = {
    id: item.id,
    type: item.type,
    name: item.name ?? "",
    imagePath: item.imagePath ?? null,
    dateAdded: item.dateAdded ?? null,
    genres: Array.isArray(item.genres) ? item.genres : [],
  };
  if (item.minutes != null) out.minutes = item.minutes;
  if (Number.isFinite(item.listOrder)) out.listOrder = item.listOrder;
  return out;
}

// ── Öntanımlı film/dizi listeleri ────────────────────────────────────────────

/** Öğeyi bir öntanımlı listeye ekler (idempotent — docId `${type}_${id}`). */
export async function addToList(uid, listKey, item) {
  if (!uid || !listKey || item?.id == null || !item?.type) return;
  const ref = doc(db, "Lists", uid, listKey, itemKey(item.type, item.id));
  await setDoc(ref, normalizeItem(item), { merge: true });
}

/** Öğeyi bir öntanımlı listeden çıkarır. */
export async function removeFromList(uid, listKey, type, id) {
  if (!uid || !listKey || id == null || !type) return;
  await deleteDoc(doc(db, "Lists", uid, listKey, itemKey(type, id)));
}

/**
 * Bir öntanımlı listede manuel sırayı `listOrder` ile saklar (watchedTv
 * `reorderWatchedShows` deseni: yalnız taşınan aralığı yaz, ilk seferde normalize).
 */
export async function reorderList(uid, listKey, orderedItems, fromIndex, toIndex) {
  if (!uid || !listKey || !Array.isArray(orderedItems) || orderedItems.length === 0) return;
  await reorderDocs(
    orderedItems,
    fromIndex,
    toIndex,
    (it) => doc(db, "Lists", uid, listKey, itemKey(it.type, it.id)),
  );
}

// ── Özel listeler ────────────────────────────────────────────────────────────

const newListId = () =>
  `cl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** Yeni özel liste oluşturur (defter girdisi). Oluşturulan listId döner. */
export async function createCustomList(uid, name, currentLists = []) {
  if (!uid || !name?.trim()) return null;
  const listId = newListId();
  const entry = {
    listId,
    name: name.trim(),
    order: currentLists.length,
    createdAt: new Date().toISOString(),
  };
  await setDoc(
    doc(db, "Lists", uid),
    { customLists: arrayUnion(entry) },
    { merge: true },
  );
  return listId;
}

/** Özel listeyi yeniden adlandırır (defteri yeniden yazar). */
export async function renameCustomList(uid, listId, newName, currentLists) {
  if (!uid || !listId || !newName?.trim() || !Array.isArray(currentLists)) return;
  const next = currentLists.map((l) =>
    l.listId === listId ? { ...l, name: newName.trim() } : l,
  );
  await updateDoc(doc(db, "Lists", uid), { customLists: next });
}

/** Özel listeyi ve TÜM öğelerini siler (defter + customItems batch). */
export async function deleteCustomList(uid, listId, currentLists) {
  if (!uid || !listId) return;
  const itemsSnap = await getDocs(
    query(collection(db, "Lists", uid, CUSTOM_ITEMS), where("listId", "==", listId)),
  );
  const next = Array.isArray(currentLists)
    ? currentLists.filter((l) => l.listId !== listId)
    : undefined;

  // 450'lik parçalar (Firestore batch limiti 500).
  const docs = itemsSnap.docs;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(db);
    docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    if (i === 0 && next !== undefined) {
      batch.update(doc(db, "Lists", uid), { customLists: next });
    }
    await batch.commit();
  }
  if (docs.length === 0 && next !== undefined) {
    await updateDoc(doc(db, "Lists", uid), { customLists: next });
  }
}

/** Öğeyi özel listeye ekler. */
export async function addToCustomList(uid, listId, item) {
  if (!uid || !listId || item?.id == null || !item?.type) return;
  const ref = doc(db, "Lists", uid, CUSTOM_ITEMS, customDocId(listId, item.type, item.id));
  await setDoc(ref, { ...normalizeItem(item), listId }, { merge: true });
}

/** Öğeyi özel listeden çıkarır. */
export async function removeFromCustomList(uid, listId, type, id) {
  if (!uid || !listId || id == null || !type) return;
  await deleteDoc(doc(db, "Lists", uid, CUSTOM_ITEMS, customDocId(listId, type, id)));
}

/** Özel listede manuel sırayı `listOrder` ile saklar. */
export async function reorderCustomList(uid, listId, orderedItems, fromIndex, toIndex) {
  if (!uid || !listId || !Array.isArray(orderedItems) || orderedItems.length === 0) return;
  await reorderDocs(
    orderedItems,
    fromIndex,
    toIndex,
    (it) => doc(db, "Lists", uid, CUSTOM_ITEMS, customDocId(listId, it.type, it.id)),
  );
}

// Ortak reorder: yalnız taşınan aralığı yaz; tüm liste listOrder içermiyorsa
// (ilk sıralama) baştan sona normalize et. 450'lik batch parçaları.
async function reorderDocs(orderedItems, fromIndex, toIndex, refFor) {
  const complete = orderedItems.every((it) => Number.isFinite(it?.listOrder));
  const start = complete ? Math.min(fromIndex, toIndex) : 0;
  const end = complete ? Math.max(fromIndex, toIndex) : orderedItems.length - 1;
  const writes = orderedItems
    .map((it, index) => ({ it, index }))
    .filter(({ it, index }) => it?.id != null && it?.type && index >= start && index <= end);

  for (let offset = 0; offset < writes.length; offset += 450) {
    const batch = writeBatch(db);
    writes.slice(offset, offset + 450).forEach(({ it, index }) => {
      batch.set(refFor(it), { listOrder: index }, { merge: true });
    });
    await batch.commit();
  }
}

// ── Tek seferlik migration (eski kök-array → subcollection) ───────────────────

/**
 * Eski `Lists/{uid}.{favorites|watchList|watchedMovies}[]` array'lerini
 * subcollection'lara taşır ve array alanlarını kök doc'tan siler.
 * Yalnız subcollection'da OLMAYAN öğeleri yazar (çift sayım yok). Bir şey
 * taşındıysa true döner.
 */
export async function migrateLegacyMovieLists(uid, rootData, existingMaps = {}) {
  if (!uid || !rootData) return false;
  let wroteAny = false;

  for (const listKey of PREDEFINED_MOVIE_LISTS) {
    const legacy = Array.isArray(rootData[listKey]) ? rootData[listKey] : [];
    if (legacy.length === 0) continue;
    const existing = existingMaps[listKey] || {};

    const pending = legacy.filter(
      (it) => it && it.id != null && it.type && !existing[itemKey(it.type, it.id)],
    );
    for (let i = 0; i < pending.length; i += 450) {
      const batch = writeBatch(db);
      pending.slice(i, i + 450).forEach((it, j) => {
        const ref = doc(db, "Lists", uid, listKey, itemKey(it.type, it.id));
        batch.set(ref, { ...normalizeItem(it), listOrder: i + j }, { merge: true });
      });
      await batch.commit();
      wroteAny = true;
    }
  }

  // Array alanlarını kök doc'tan temizle (yalnız var olanları).
  const clear = {};
  for (const listKey of PREDEFINED_MOVIE_LISTS) {
    if (Array.isArray(rootData[listKey])) clear[listKey] = deleteField();
  }
  if (Object.keys(clear).length > 0) {
    await updateDoc(doc(db, "Lists", uid), clear);
  }
  return wroteAny;
}

/**
 * Eski özel adlı array'leri (`Lists/{uid}.<özelAd>[]`) defter + customItems'a taşır
 * ve o alanları kök doc'tan siler. `reservedKeys` taşınmayacak alanlar
 * (favorites/watchList/watchedMovies/watchedTv/customLists vb.).
 */
export async function migrateLegacyCustomLists(uid, rootData, reservedKeys) {
  if (!uid || !rootData) return false;
  const reserved = new Set(reservedKeys);
  const customArrayKeys = Object.keys(rootData).filter(
    (k) => !reserved.has(k) && Array.isArray(rootData[k]),
  );
  if (customArrayKeys.length === 0) return false;

  const registry = Array.isArray(rootData.customLists) ? [...rootData.customLists] : [];
  const clear = {};

  for (const name of customArrayKeys) {
    const items = rootData[name] || [];
    const listId = newListId();
    registry.push({
      listId,
      name,
      order: registry.length,
      createdAt: new Date().toISOString(),
    });
    const valid = items.filter((it) => it && it.id != null && it.type);
    for (let i = 0; i < valid.length; i += 450) {
      const batch = writeBatch(db);
      valid.slice(i, i + 450).forEach((it, j) => {
        const ref = doc(db, "Lists", uid, CUSTOM_ITEMS, customDocId(listId, it.type, it.id));
        batch.set(ref, { ...normalizeItem(it), listId, listOrder: i + j }, { merge: true });
      });
      await batch.commit();
    }
    clear[name] = deleteField();
  }

  await updateDoc(doc(db, "Lists", uid), { ...clear, customLists: registry });
  return true;
}
