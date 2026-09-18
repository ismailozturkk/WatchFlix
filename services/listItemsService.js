import { nestedSummaryFields } from "../utils/firestoreNestedFields";
// services/listItemsService.js
//
// İzlenen DİZİLER dışındaki TÜM listeler için TEK yazma kaynağı. Kanonik model:
// her liste öğesi AYRI dokümandır (eski dev kök-array `Lists/{uid}.<liste>[]` yerine).
//
//   Öntanımlı (film + dizi karışık olabilir):
//     Lists/{uid}/favorites/{type_id}
//     Lists/{uid}/watchList/{type_id}
//     Lists/{uid}/watchedMovies/{type_id}        (yalnız film)
//       { id, type, name, imagePath, dateAdded, minutes, genres, listOrder,
//         watchEvents:[{ id, watchedAt, scope:"movie", recordedAt }] }
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
  runTransaction,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { trackFirestoreWrite, trackFirestoreDelete, trackFirestoreRead } from "./usageTrackerService";
import {
  createWatchEventId,
  materializeMovieWatchEvents,
  normalizeWatchDate,
} from "../utils/watchHistory";
import { resolveListName, RESERVED_LIST_NAMES } from "../utils/listShare";
import { assertWatchable } from "../utils/watchState";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";
import { trackFirstContentActivation } from "./activationAnalytics";
import { updateLocalItem, deleteLocalItem } from "./listSyncService";

export const PREDEFINED_MOVIE_LISTS = ["favorites", "watchList", "watchedMovies"];
const CUSTOM_ITEMS = "customItems";

// ── Yardımcılar ──────────────────────────────────────────────────────────────
const itemKey = (type, id) => `${type}_${id}`;
const customDocId = (listId, type, id) => `${listId}__${type}_${id}`;

// undefined alanları ele (Firestore undefined kabul etmez); öğeyi normalize et.
function normalizeItem(item) {
  const out = {
    id: item.id,
    type: item.type || "movie",
  };
  if (item.name != null) out.name = item.name;
  if (item.imagePath != null) out.imagePath = item.imagePath;
  if (item.dateAdded != null) out.dateAdded = item.dateAdded;
  if (Array.isArray(item.genres)) out.genres = item.genres;
  if (item.minutes != null) out.minutes = item.minutes;              // yalnız film
  if (item.episodeMinutes != null) out.episodeMinutes = item.episodeMinutes;
  if (item.episodeCount != null) out.episodeCount = item.episodeCount;
  if (item.seasonCount != null) out.seasonCount = item.seasonCount;
  // Dizinin toplam süresi: ListsScreen'in süre rozeti ve sıralaması bunu okur.
  if (item.totalMinutes != null) out.totalMinutes = item.totalMinutes;
  if (Number.isFinite(item.listOrder)) out.listOrder = item.listOrder;
  return out;
}

// ── Öntanımlı film/dizi listeleri ────────────────────────────────────────────

/** Öğeyi bir öntanımlı listeye ekler (idempotent — docId `${type}_${id}`). */
export async function addToList(uid, listKey, item) {
  if (!uid || !listKey || item?.id == null || !item?.type) return;
  const docKey = itemKey(item.type, item.id);
  const ref = doc(db, "Lists", uid, listKey, docKey);
  const rootRef = doc(db, "Lists", uid);
  const normalized = { ...normalizeItem(item), updatedAt: serverTimestamp() };

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    tx.set(ref, normalized, { merge: true });

    const statusField = listKey === "favorites" ? "inFavorites" : "inWatchList";
    const rootUpdates = {
      [`statusIndex.${item.type}.${item.id}.${statusField}`]: true,
      updatedAt: serverTimestamp(),
      _schemaVersion: 3,
    };
    // Belge-id tabanlı yeni model idempotenttir. Aynı öğeye tekrar basılması
    // belgeyi güncelleyebilir ama liste sayacını ikinci kez artırmamalıdır.
    if (!snap.exists()) rootUpdates[`counts.${listKey}`] = increment(1);
    tx.set(rootRef, nestedSummaryFields(rootUpdates), { merge: true });
  });
  trackFirestoreWrite(`Lists/${listKey}`, 1);
  updateLocalItem(uid, listKey, docKey, {
    ...normalizeItem(item),
    updatedAt: new Date().toISOString(),
  });
}

/** Öğeyi bir öntanımlı listeden çıkarır. */
export async function removeFromList(uid, listKey, type, id) {
  if (!uid || !listKey || id == null || !type) return;
  const docKey = itemKey(type, id);
  const ref = doc(db, "Lists", uid, listKey, docKey);
  const rootRef = doc(db, "Lists", uid);

  let removed = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    removed = true;
    tx.delete(ref);

    const statusField = listKey === "favorites" ? "inFavorites" : "inWatchList";
    tx.set(
      rootRef,
      nestedSummaryFields({
        [`statusIndex.${type}.${id}.${statusField}`]: false,
        [`counts.${listKey}`]: increment(-1),
        updatedAt: serverTimestamp(),
        _schemaVersion: 3,
      }),
      { merge: true },
    );
  });
  if (!removed) return;
  trackFirestoreDelete(`Lists/${listKey}`, 1);
  deleteLocalItem(uid, listKey, docKey);
}

/**
 * Filmin her izlenmesini aynı kanonik belge içinde ayrı olay olarak saklar.
 * İlk yazmada eski liste alanları korunur; sonraki yazmalar üyeliği silmeden
 * geçmişe yeni bir occurrence ekler.
 */
export async function markMovieWatch(uid, item, watchDate) {
  if (!uid || item?.id == null) return null;
  const watchedAt = normalizeWatchDate(watchDate);
  if (!watchedAt) return null;
  assertWatchable(item?.releaseDate, item?.status);
  const docKey = itemKey("movie", item.id);
  const ref = doc(db, "Lists", uid, "watchedMovies", docKey);
  const rootRef = doc(db, "Lists", uid);
  const event = {
    id: createWatchEventId(`movie_${item.id}`),
    watchedAt,
    scope: "movie",
    recordedAt: new Date().toISOString(),
  };

  let watchNumber = 1;
  let isFirstWatch = false;
  let localDocument = null;
  const minutes = Number(item.minutes) || 0;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists() ? snap.data() : {};
    const watchEvents = [...materializeMovieWatchEvents(existing), event];
    watchNumber = watchEvents.length;
    isFirstWatch = !snap.exists() || !existing.watchEvents || existing.watchEvents.length === 0;

    const normalized = {
      ...normalizeItem({ ...existing, ...item, type: "movie", dateAdded: watchedAt }),
      watchEvents,
      watchCount: watchEvents.length,
      updatedAt: serverTimestamp(),
    };
    localDocument = {
      ...normalized,
      // Firestore sentinel'i yerel cache'e taşımak yerine sıralanabilir bir
      // istemci zamanı kullanılır; sunucudaki alan transaction ile yazılır.
      updatedAt: new Date().toISOString(),
    };

    tx.set(ref, normalized, { merge: true });

    // Kök özet ve istatistik dokümanı güncellemesi
    const rootUpdates = {
      "stats.movies.totalRewatchCount": increment(1),
      "stats.movies.totalMinutes": increment(minutes),
      "stats.totalMinutes": increment(minutes),
      updatedAt: serverTimestamp(),
      _schemaVersion: 3,
    };

    if (isFirstWatch) {
      rootUpdates[`statusIndex.movie.${item.id}.isWatched`] = true;
      rootUpdates["counts.watchedMovies"] = increment(1);
      rootUpdates["stats.movies.uniqueCount"] = increment(1);

      if (Array.isArray(item.genres)) {
        item.genres.forEach((genreId) => {
          if (genreId != null) {
            rootUpdates[`stats.genreCounts.${genreId}`] = increment(1);
          }
        });
      }
    }

    tx.set(rootRef, nestedSummaryFields(rootUpdates), { merge: true });
  });

  trackFirestoreWrite("Lists/watchedMovies", 1);
  if (localDocument) {
    updateLocalItem(uid, "watchedMovies", docKey, localDocument);
  }

  trackEvent(ANALYTICS_EVENTS.CONTENT_TRACKED, {
    content_type: "movie",
    content_id: String(item.id),
    is_rewatch: watchNumber > 1,
    watch_number: watchNumber,
  });
  trackFirstContentActivation(uid, {
    content_type: "movie",
    content_id: String(item.id),
    source: "movie_watch",
  });

  return event;
}

/** Seçilen film izleme olayını siler; son olay silinirse liste belgesi de silinir. */
export async function removeMovieWatchEvent(uid, movieId, eventId) {
  if (!uid || movieId == null || !eventId) return;
  const docKey = itemKey("movie", movieId);
  const ref = doc(db, "Lists", uid, "watchedMovies", docKey);
  const rootRef = doc(db, "Lists", uid);

  let nextLocalDocument = null;
  let shouldDeleteLocal = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const current = snap.data() || {};
    const remaining = materializeMovieWatchEvents(current).filter(
      (event) => event.id !== eventId,
    );
    const minutes = Number(current.minutes) || 0;
    const removedEvent = materializeMovieWatchEvents(current).find(
      (event) => event.id === eventId,
    );
    if (!removedEvent) return;

    if (!remaining.length) {
      tx.delete(ref);
      const rootUpdates = {
        [`statusIndex.movie.${movieId}.isWatched`]: false,
        "counts.watchedMovies": increment(-1),
        "stats.movies.uniqueCount": increment(-1),
        "stats.movies.totalRewatchCount": increment(-1),
        "stats.movies.totalMinutes": increment(-minutes),
        "stats.totalMinutes": increment(-minutes),
        updatedAt: serverTimestamp(),
        _schemaVersion: 3,
      };
      if (Array.isArray(current.genres)) {
        current.genres.forEach((genreId) => {
          if (genreId != null) {
            rootUpdates[`stats.genreCounts.${genreId}`] = increment(-1);
          }
        });
      }
      tx.set(rootRef, nestedSummaryFields(rootUpdates), { merge: true });
      shouldDeleteLocal = true;
      return;
    }

    const latest = remaining
      .slice()
      .sort((a, b) => String(b.watchedAt).localeCompare(String(a.watchedAt)))[0];
    tx.update(ref, {
      watchEvents: remaining,
      watchCount: remaining.length,
      dateAdded: latest.watchedAt,
      updatedAt: serverTimestamp(),
    });
    tx.set(
      rootRef,
      nestedSummaryFields({
        "stats.movies.totalRewatchCount": increment(-1),
        "stats.movies.totalMinutes": increment(-minutes),
        "stats.totalMinutes": increment(-minutes),
        updatedAt: serverTimestamp(),
        _schemaVersion: 3,
      }),
      { merge: true },
    );
    nextLocalDocument = {
      ...current,
      watchEvents: remaining,
      watchCount: remaining.length,
      dateAdded: latest.watchedAt,
      updatedAt: new Date().toISOString(),
    };
  });
  if (shouldDeleteLocal) deleteLocalItem(uid, "watchedMovies", docKey);
  else if (nextLocalDocument) {
    updateLocalItem(uid, "watchedMovies", docKey, nextLocalDocument);
  }
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
  const batch = writeBatch(db);
  batch.set(
    doc(db, "Lists", uid),
    { customLists: arrayUnion(entry) },
    { merge: true },
  );
  batch.set(
    doc(db, "Users", uid),
    { listVisible: { [entry.name]: true } },
    { merge: true },
  );
  await batch.commit();
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
  const docKey = customDocId(listId, item.type, item.id);
  const ref = doc(db, "Lists", uid, CUSTOM_ITEMS, docKey);
  const rootRef = doc(db, "Lists", uid);

  const batch = writeBatch(db);
  batch.set(ref, { ...normalizeItem(item), listId, updatedAt: serverTimestamp() }, { merge: true });
  batch.set(
    rootRef,
    nestedSummaryFields({
      [`statusIndex.${item.type}.${item.id}.isInOtherLists`]: true,
      updatedAt: serverTimestamp(),
      _schemaVersion: 3,
    }),
    { merge: true },
  );

  await batch.commit();
  updateLocalItem(uid, CUSTOM_ITEMS, docKey, { ...normalizeItem(item), listId });
}

/** Öğeyi özel listeden çıkarır. */
export async function removeFromCustomList(uid, listId, type, id) {
  if (!uid || !listId || id == null || !type) return;
  const docKey = customDocId(listId, type, id);
  const ref = doc(db, "Lists", uid, CUSTOM_ITEMS, docKey);
  await deleteDoc(ref);
  deleteLocalItem(uid, CUSTOM_ITEMS, docKey);
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

/**
 * Öğeyi ESKİ MODELDEKİ özel listeye (kök doküman alanındaki dizi) ekler.
 */
export async function addToCustomRootList(uid, listName, item) {
  if (!uid || !listName || item?.id == null || !item?.type) return false;
  const ref = doc(db, "Lists", uid);
  let added = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const current = Array.isArray(data[listName]) ? data[listName] : [];
    const exists = current.some(
      (it) =>
        it &&
        String(it.id) === String(item.id) &&
        (it.type || "movie") === item.type,
    );
    if (exists) return;
    tx.set(
      ref,
      nestedSummaryFields({
        [listName]: [...current, normalizeItem(item)],
        [`statusIndex.${item.type}.${item.id}.isInOtherLists`]: true,
        updatedAt: serverTimestamp(),
        _schemaVersion: 3,
      }),
      { merge: true },
    );
    added = true;
  });

  return added;
}

/**
 * Öğeyi ESKİ MODELDEKİ özel listeden (kök doküman alanındaki dizi) çıkarır.
 */
export async function removeFromCustomRootList(uid, listName, type, id) {
  if (!uid || !listName || id == null || !type) return false;
  const ref = doc(db, "Lists", uid);
  let removed = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const current = Array.isArray(data[listName]) ? data[listName] : [];
    const next = current.filter(
      (it) =>
        !(
          it &&
          String(it.id) === String(id) &&
          (it.type || "movie") === type
        ),
    );
    if (next.length === current.length) return;
    tx.set(
      ref,
      {
        [listName]: next,
        updatedAt: serverTimestamp(),
        _schemaVersion: 3,
      },
      { merge: true },
    );
    removed = true;
  });

  return removed;
}

/**
 * ESKİ MODELDEKİ özel listenin ADINI değiştirir (kök dokümandaki dizi alanı):
 * öğeler aynı diziyle yeni anahtara taşınır, eski anahtar silinir.
 *
 * Öntanımlı dört liste (favorites/watchList/watchedMovies/watchedTv) buradan
 * geçmez — onlar alan adı DEĞİL, şemanın parçası; adları çevirilerden gelir.
 * Defter modeline (`customLists`) geçildiğinde yerini `renameCustomList` alır.
 *
 * `addToCustomRootList` ile aynı iki incelik geçerli:
 *  • Transaction: kök doküman TÜM özel listeleri taşıyor; oku-değiştir-yaz'ı
 *    istemcide yapmak başka cihazdaki eşzamanlı eklemeyi sessizce siler.
 *  • `tx.set(..., { merge: true })` — `updateDoc` DEĞİL: updateDoc string
 *    anahtardaki noktaları alan yolu ayracı sayar, "S.W.A.T." iç içe map olur.
 *
 * Çakışma kararı İŞLEM İÇİNDE, sunucudaki güncel duruma göre verilir:
 * kullanıcı ekrandaki adları gördüğünden beri başka cihazda liste açmış
 * olabilir; arayüzdeki listeye bakarak yazmak var olanı sessizce ezerdi.
 *
 * @returns {Promise<"ok"|"missing"|"taken">}
 */
export async function renameCustomRootList(uid, oldName, newName) {
  const from = String(oldName ?? "").trim();
  const to = String(newName ?? "").trim();
  if (!uid || !from || !to) return "missing";
  if (from === to) return "ok";

  const ref = doc(db, "Lists", uid);
  let result = "ok";
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    if (!Array.isArray(data[from])) {
      result = "missing";
      return;
    }
    if (RESERVED_LIST_NAMES.includes(to) || data[to] !== undefined) {
      result = "taken";
      return;
    }
    tx.set(ref, { [to]: data[from], [from]: deleteField() }, { merge: true });
    result = "ok";
  });
  return result;
}

// ── Paylaşılan listeyi profile kopyalama ─────────────────────────────────────

/**
 * Feed'de paylaşılmış bir listeyi profile YENİ bir özel liste olarak yazar.
 *
 * Ad çakışması İŞLEM İÇİNDE, sunucudaki güncel duruma göre çözülür: kullanıcı
 * arayüzdeki liste adlarını gördüğünden beri başka bir cihazda liste açmış
 * olabilir; ekrandaki listeye bakarak karar vermek sessizce üzerine yazardı.
 *
 * Özel listeler hâlâ kök dokümanın alanlarında duruyor (Part B'de customItems'a
 * taşınacak); buradaki yazma da bu yüzden ListsViewScreen'in `addNewList`
 * yoluyla aynı biçimde.
 *
 * @returns {Promise<string|null>} kullanılan liste adı (ad üretilemezse null)
 */
export async function saveSharedListToProfile(uid, name, items, meta = {}) {
  if (!uid || !Array.isArray(items) || items.length === 0) return null;
  const ref = doc(db, "Lists", uid);
  let finalName = null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    finalName = resolveListName(name, Object.keys(data));
    if (!finalName) throw new Error("saveSharedListToProfile: liste adı çözülemedi");
    // setDoc+merge (updateDoc değil): updateDoc string anahtardaki noktaları
    // field-path ayracı sayar, "S.W.A.T. Favorilerim" iç içe map'e dönüşür ve
    // liste hiç görünmezdi. tx.set data anahtarlarını literal işler.
    tx.set(ref, { [finalName]: items.map(normalizeItem) }, { merge: true });
    // Arkadaş profilinde kullanıcı açıkça paylaşmayı seçene kadar
    // kopyalanan liste kapalı kalır. Nested map, noktalı liste adını da
    // literal anahtar olarak korur.
    tx.set(
      doc(db, "Users", uid),
      { listVisible: { [finalName]: false } },
      { merge: true },
    );
  });

  trackEvent(ANALYTICS_EVENTS.SHARED_LIST_SAVED, {
    item_count: items.length,
    renamed: finalName !== String(name || "").trim(),
    source_post_id: meta.postId ? String(meta.postId) : "",
  });
  return finalName;
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
