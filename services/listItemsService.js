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
import { trackFirestoreWrite, trackFirestoreDelete } from "./usageTrackerService";
import {
  createWatchEventId,
  materializeMovieWatchEvents,
  normalizeWatchDate,
} from "../utils/watchHistory";
import { resolveListName, RESERVED_LIST_NAMES } from "../utils/listShare";
import { planRootListMerge } from "../utils/rootListMerge";
import { assertWatchable } from "../utils/watchState";
import {
  LIBRARY_ERROR,
  LibraryError,
  isCustomListName,
  isMembershipList,
  mediaKey,
  MEMBERSHIP_FLAG,
} from "../utils/libraryCore";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";
import { trackFirstContentActivation } from "./activationAnalytics";
import { updateLocalItem, updateLocalItems, deleteLocalItem } from "./listSyncService";

export const PREDEFINED_MOVIE_LISTS = ["favorites", "watchList", "watchedMovies"];
const CUSTOM_ITEMS = "customItems";

// ── Yardımcılar ──────────────────────────────────────────────────────────────
const itemKey = (type, id) => `${type}_${id}`;
const customDocId = (listId, type, id) => `${listId}__${type}_${id}`;

// undefined alanları ele (Firestore undefined kabul etmez); öğeyi normalize et.
export function normalizeItem(item) {
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

/**
 * Kök dokümanın ilk kez oluşturulması (yoksa). Transaction: eski "getDoc → yoksa
 * setDoc" kalıbı arada başka bir yazım (ilk ekleme, başka cihaz) kök dokümanı
 * yarattıysa onu SIFIRLARDI — setDoc merge'siz yazıyordu.
 *
 * @returns {Promise<boolean>} bu çağrı oluşturduysa true
 */
export async function ensureListsRoot(uid) {
  if (!uid) return false;
  const ref = doc(db, "Lists", uid);
  let created = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return;
    tx.set(ref, { watchedTv: [], favorites: [], watchList: [], watchedMovies: [] });
    created = true;
  });
  return created;
}

// ── Öntanımlı film/dizi listeleri ────────────────────────────────────────────

/**
 * Üyelik listesi dışındaki bir anahtar bu iki fonksiyondan geçerse YANLIŞ bayrak
 * ve sayaç yazılırdı (izlenen film için `inWatchList` gibi). Sessizce yanlış
 * yere yazmak yerine yüksek sesle reddedilir.
 */
function assertMembershipList(listKey, fn) {
  if (isMembershipList(listKey)) return;
  throw new LibraryError(
    LIBRARY_ERROR.INVALID,
    `${fn}: "${listKey}" bir üyelik listesi değil (yalnız favorites/watchList)`,
  );
}

/**
 * Öğeyi favorilere / izlenecekler listesine ekler (idempotent — docId `${type}_${id}`).
 * İzlenen film/dizi BURADAN geçmez: onlar üyelik değil izleme olayı yazar
 * (`markMovieWatch` / watchedTvService).
 */
export async function addToList(uid, listKey, item) {
  if (!uid || !listKey || item?.id == null || !item?.type) return;
  assertMembershipList(listKey, "addToList");
  const docKey = itemKey(item.type, item.id);
  const ref = doc(db, "Lists", uid, listKey, docKey);
  const rootRef = doc(db, "Lists", uid);
  const normalized = { ...normalizeItem(item), updatedAt: serverTimestamp() };

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    tx.set(ref, normalized, { merge: true });

    const rootUpdates = {
      [`statusIndex.${item.type}.${item.id}.${MEMBERSHIP_FLAG[listKey]}`]: true,
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

// Tek transaction'da okunan/yazılan öğe sayısı. Firestore transaction'ı 500
// yazmayla sınırlı; kök doküman yazımına ve güvenlik payına yer bırakır.
const BULK_CHUNK = 100;

/**
 * Birden çok öğeyi favorilere / izlenecekler listesine ekler (CineSwipe sepeti).
 * `addToList` ile AYNI muhasebe (idempotent belge, yalnız YENİ öğeler sayacı
 * artırır, statusIndex bayrağı), ama 100'lük parçalar hâlinde TEK transaction:
 * N öğe için N transaction + N kök yazımı yerine ⌈N/100⌉.
 *
 * @returns {Promise<{ added: number, existing: number }>}
 */
export async function addItemsToList(uid, listKey, items) {
  const seen = new Set();
  const incoming = (Array.isArray(items) ? items : []).filter((item) => {
    if (item?.id == null || !item?.type) return false;
    const key = itemKey(item.type, item.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!uid || !listKey || incoming.length === 0) return { added: 0, existing: 0 };
  assertMembershipList(listKey, "addItemsToList");

  const rootRef = doc(db, "Lists", uid);
  let added = 0;

  for (let offset = 0; offset < incoming.length; offset += BULK_CHUNK) {
    const chunk = incoming.slice(offset, offset + BULK_CHUNK);
    const refs = chunk.map((item) => doc(db, "Lists", uid, listKey, itemKey(item.type, item.id)));
    let chunkAdded = 0;

    await runTransaction(db, async (tx) => {
      const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
      const rootUpdates = { updatedAt: serverTimestamp(), _schemaVersion: 3 };
      chunkAdded = 0;
      chunk.forEach((item, index) => {
        tx.set(refs[index], { ...normalizeItem(item), updatedAt: serverTimestamp() }, { merge: true });
        rootUpdates[`statusIndex.${item.type}.${item.id}.${MEMBERSHIP_FLAG[listKey]}`] = true;
        if (!snaps[index].exists()) chunkAdded += 1;
      });
      if (chunkAdded > 0) rootUpdates[`counts.${listKey}`] = increment(chunkAdded);
      tx.set(rootRef, nestedSummaryFields(rootUpdates), { merge: true });
    });

    added += chunkAdded;
    trackFirestoreWrite(`Lists/${listKey}`, chunk.length);
    const now = new Date().toISOString();
    updateLocalItems(
      uid,
      listKey,
      Object.fromEntries(
        chunk.map((item) => [itemKey(item.type, item.id), { ...normalizeItem(item), updatedAt: now }]),
      ),
    );
  }
  return { added, existing: incoming.length - added };
}

/**
 * Öğeyi favorilerden / izlenecekler listesinden çıkarır.
 *
 * `watchedMovies` geriye uyumluluk için KABUL edilir ve `removeWatchedMovie`ye
 * yönlendirilir: bu fonksiyon eskiden her listeye aynı kalıbı uyguluyor, izlenen
 * film için yanlış bayrağı (`inWatchList`) kapatıp `isWatched`'ı ve tüm
 * istatistiği olduğu gibi bırakıyordu (bkz. libraryServices.test.js "denetim").
 */
export async function removeFromList(uid, listKey, type, id) {
  if (!uid || !listKey || id == null || !type) return;
  if (listKey === "watchedMovies") {
    if (type !== "movie") return;
    await removeWatchedMovie(uid, id);
    return;
  }
  assertMembershipList(listKey, "removeFromList");
  const docKey = itemKey(type, id);
  const ref = doc(db, "Lists", uid, listKey, docKey);
  const rootRef = doc(db, "Lists", uid);

  let removed = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    removed = true;
    tx.delete(ref);

    tx.set(
      rootRef,
      nestedSummaryFields({
        [`statusIndex.${type}.${id}.${MEMBERSHIP_FLAG[listKey]}`]: false,
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
  // Geçersiz tarihle sessizce null dönmek arayüze "başarılı" gibi görünürdü.
  if (!watchedAt) throw new LibraryError(LIBRARY_ERROR.INVALID, "Geçersiz izleme tarihi");
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
 * Filmin TÜM izleme kaydını (her tekrar izleme dahil) tek seferde siler ve
 * kök özetteki etkisini geri alır: üyelik sayacı, benzersiz/tekrar sayaçları,
 * süre ve tür sayaçları, `isWatched` bayrağı. "Listeden kaldır" davranışı.
 *
 * Tek tek olay silmek (`removeMovieWatchEvent`) ile aynı muhasebe, olay sayısı
 * kadar çarpılmış: her olay `totalRewatchCount`a 1, `totalMinutes`a film süresi
 * eklemişti.
 */
export async function removeWatchedMovie(uid, movieId) {
  if (!uid || movieId == null) return false;
  const docKey = itemKey("movie", movieId);
  const ref = doc(db, "Lists", uid, "watchedMovies", docKey);
  const rootRef = doc(db, "Lists", uid);

  let removed = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    removed = true;
    const current = snap.data() || {};
    const eventCount = Math.max(1, materializeMovieWatchEvents(current).length);
    const minutes = Number(current.minutes) || 0;

    tx.delete(ref);
    const rootUpdates = {
      [`statusIndex.movie.${movieId}.isWatched`]: false,
      "counts.watchedMovies": increment(-1),
      "stats.movies.uniqueCount": increment(-1),
      "stats.movies.totalRewatchCount": increment(-eventCount),
      "stats.movies.totalMinutes": increment(-eventCount * minutes),
      "stats.totalMinutes": increment(-eventCount * minutes),
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
  });
  if (!removed) return false;
  trackFirestoreDelete("Lists/watchedMovies", 1);
  deleteLocalItem(uid, "watchedMovies", docKey);
  return true;
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

/**
 * Kök doküman ayrılmış adlı alanları (counts/stats/statusIndex…) HARİTA olarak
 * kullanır. Aynı adla dizi yazmak, doküman o alanı henüz içermiyorsa çakışma
 * kontrolünden geçip alanı diziye çeviriyordu ve sonraki her sayaç yazımını
 * bozuyordu. Arayüz bu adları zaten süzer; bu, servis katmanının kendi savunması.
 */
function assertCustomListName(listName) {
  if (!RESERVED_LIST_NAMES.includes(listName)) return;
  throw new LibraryError(
    LIBRARY_ERROR.LIST_RESERVED,
    `"${listName}" liste adı olarak kullanılamaz`,
  );
}

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
  assertCustomListName(listName);
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
 * Birden çok öğeyi ESKİ MODELDEKİ özel listeye TEK işlemde ekler (CineSwipe
 * sepeti → liste). `addToCustomRootList` gibi idempotenttir: listede zaten olan
 * öğe tekrar eklenmez, mevcut öğeler korunur. Liste yoksa oluşturulur ve
 * arkadaş profilinde görünür işaretlenir (CreateListModal ile aynı varsayılan).
 *
 * `set(..., { merge: true })` dizi alanını BİRLEŞTİRMEZ, değiştirir; bu yüzden
 * mevcut dizi işlem İÇİNDE okunup `planRootListMerge` ile birleştirilir.
 *
 * @returns {Promise<{ added: number, total: number, created: boolean }>}
 */
export async function addItemsToCustomRootList(uid, listName, items) {
  const incoming = (Array.isArray(items) ? items : []).filter((it) => it?.id != null && it?.type);
  if (!uid || !listName || incoming.length === 0) return { added: 0, total: 0, created: false };
  assertCustomListName(listName);

  const ref = doc(db, "Lists", uid);
  const userRef = doc(db, "Users", uid);
  let outcome = { added: 0, total: 0, created: false };

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const existing = data[listName];
    // Aynı ada sahip dizi OLMAYAN bir alan (ör. sayaç haritası) varsa ezme.
    if (existing !== undefined && !Array.isArray(existing)) {
      throw Object.assign(new Error("list-name-conflict"), { code: "list-name-conflict" });
    }
    const created = !Array.isArray(existing);
    const plan = planRootListMerge(existing || [], incoming.map(normalizeItem));

    const patch = {
      [listName]: plan.merged,
      updatedAt: serverTimestamp(),
      _schemaVersion: 3,
    };
    plan.added.forEach((it) => {
      patch[`statusIndex.${it.type}.${it.id}.isInOtherLists`] = true;
    });
    tx.set(ref, nestedSummaryFields(patch), { merge: true });
    if (created) tx.set(userRef, { listVisible: { [listName]: true } }, { merge: true });
    outcome = { added: plan.added.length, total: plan.merged.length, created };
  });

  return outcome;
}

/**
 * Öğeyi ESKİ MODELDEKİ özel listeden (kök doküman alanındaki dizi) çıkarır.
 */
export async function removeFromCustomRootList(uid, listName, type, id) {
  if (!uid || !listName || id == null || !type) return false;
  // Ayrılmış adlar özel liste değildir: kök dokümandaki eski dizi kalıntısına
  // (ör. App.js'in açılışta yazdığı boş `favorites: []`) dokunma.
  if (RESERVED_LIST_NAMES.includes(listName)) return false;
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
 * ESKİ MODELDEKİ özel listede manuel sırayı yazar.
 *
 * `orderedItems` ekrandaki NİHAİ sıradır ({ id, type } yeter). Ham dizi işlem
 * İÇİNDE okunur ve ekran sırasına göre dizilir; ekranın görmediği öğeler
 * (başka cihazda o sırada eklenenler) sona eklenir, SİLİNMEZ. Eski ekran kodu
 * `updateDoc(ref, { [listName]: ordered })` yapıyordu: oku-değiştir-yaz kilitsizdi
 * ve `updateDoc` string anahtardaki noktaları alan yolu ayracı sayıyordu
 * ("S.W.A.T. Listem" iç içe haritaya dönüşürdü). Eşleştirme id'nin yanı sıra
 * TİPE bakar: aynı TMDB id'li film ve dizi ayrı eserdir.
 *
 * @returns {Promise<boolean>} liste varsa ve yazıldıysa true
 */
export async function reorderCustomRootList(uid, listName, orderedItems) {
  if (!uid || !isCustomListName(listName) || !Array.isArray(orderedItems)) return false;
  const ref = doc(db, "Lists", uid);
  let written = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const raw = data[listName];
    if (!Array.isArray(raw)) return;

    const rawByKey = new Map(
      raw.filter((entry) => entry?.id != null).map((entry) => [mediaKey(entry.type, entry.id), entry]),
    );
    const ordered = [];
    for (const entry of orderedItems) {
      if (entry?.id == null) continue;
      const key = mediaKey(entry.type, entry.id);
      const match = rawByKey.get(key);
      if (match) {
        ordered.push(match);
        rawByKey.delete(key);
      }
    }
    rawByKey.forEach((leftover) => ordered.push(leftover));

    tx.set(
      ref,
      { [listName]: ordered, updatedAt: serverTimestamp(), _schemaVersion: 3 },
      { merge: true },
    );
    written = true;
  });
  return written;
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
