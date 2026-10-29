// services/import/importReset.js
//
// Bir kaynaktan (letterboxd / imdb) aktarılanları geri alır. Yalnız aktarımın ETİKETLEDİĞİ
// kayıtlara dokunur (bkz. importWriter: importedFrom / source / importSource):
//   • izlenenler  → aktarımın eklediği izleme olayları silinir; belgede başka (kullanıcının
//                   kendi) izlemesi kalmadıysa belge de silinir, kaldıysa belge korunur.
//   • izleme listesi / favoriler → aktarımın OLUŞTURDUĞU belgeler silinir.
//   • puanlar     → aktarımın eklediği ve kullanıcının sonradan DEĞİŞTİRMEDİĞİ puanlar
//                   (setMyRating yansıyı baştan yazar, işaret orada kalkar).
//   • incelemeler → aktarımın eklediği incelemeler; başkalarının yanıt verdiği inceleme
//                   korunur (yanıtlar sahipsiz kalmasın).
//   • özel listeler → aktarımın eklediği öğeler; aktarımın oluşturduğu liste boşalırsa liste de.
// Sonunda profil özeti alt koleksiyonlardan yeniden hesaplanır ve kaynağın istatistiği sıfırlanır.
//
// Bu sürümden önce yapılmış aktarımlar etiket taşımadığı için kapsam dışıdır.

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { deleteLocalItem, updateLocalItem } from "../listSyncService";
import { removeMyRating } from "../ratingsService";
import { RESERVED_LIST_NAMES } from "../../utils/listShare";
import { rebuildImportedProfileStats } from "./importWriter";
import { clearImportStats, loadImportStats } from "./importStats";
import { isTransientFirestoreError, withRetry } from "./importRetry";

const RETRY = { retries: 3, baseMs: 400, isRetryable: isTransientFirestoreError };
const BATCH_LIMIT = 400;
const WATCHED_LISTS = ["watchedMovies", "watchedTv"];
const FLAG_LISTS = ["watchList", "favorites"];

const emptyCounts = () => ({ titles: 0, watchEvents: 0, ratings: 0, reviews: 0, listItems: 0, lists: 0, keptReviews: 0 });

/**
 * SAF: okunan verilerden sıfırlama planı.
 * @param {{ lists?: Record<string, Record<string, Object>>, ratings?: Record<string, Object>,
 *   comments?: Record<string, Object>, root?: Object, createdLists?: string[] }} data
 * @param {"letterboxd"|"imdb"} source
 */
export function planImportReset(data, source) {
  const { lists = {}, ratings = {}, comments = {}, root = {}, createdLists = [] } = data || {};
  const plan = { deleteDocs: [], updateDocs: [], ratings: [], reviews: [], rootLists: {}, counts: emptyCounts() };

  WATCHED_LISTS.forEach((listKey) => {
    Object.entries(lists[listKey] || {}).forEach(([docId, entry]) => {
      const events = Array.isArray(entry?.watchEvents) ? entry.watchEvents : [];
      const kept = events.filter((event) => event?.source !== source);
      const removed = events.length - kept.length;
      const createdByImport = entry?.importedFrom === source;
      if (!removed && !createdByImport) return;
      plan.counts.watchEvents += removed;
      if (kept.length === 0) {
        plan.deleteDocs.push({ listKey, docId });
        plan.counts.titles += 1;
      } else {
        plan.updateDocs.push({ listKey, docId, watchEvents: kept, clearMark: createdByImport });
      }
    });
  });

  FLAG_LISTS.forEach((listKey) => {
    Object.entries(lists[listKey] || {}).forEach(([docId, entry]) => {
      if (entry?.importedFrom !== source) return;
      plan.deleteDocs.push({ listKey, docId });
      plan.counts.titles += 1;
    });
  });

  Object.values(ratings).forEach((entry) => {
    if (entry?.importedFrom !== source || entry?.mediaId == null) return;
    // Kullanıcı aynı değeri elle yeniden verdiyse de işaret kalkmış olurdu; değer farkı ek güvence.
    if (entry.importedRating != null && Number(entry.rating) !== Number(entry.importedRating)) return;
    plan.ratings.push({ mediaType: entry.mediaType === "tv" ? "tv" : "movie", mediaId: String(entry.mediaId) });
    plan.counts.ratings += 1;
  });

  Object.entries(comments).forEach(([commentId, entry]) => {
    if (entry?.importSource !== source || entry?.parentId) return;
    if (entry.kind !== "movie" && entry.kind !== "tv") return;
    plan.reviews.push({ commentId, kind: entry.kind, targetId: String(entry.targetId) });
  });

  const reserved = new Set(RESERVED_LIST_NAMES);
  Object.entries(root || {}).forEach(([name, value]) => {
    if (!Array.isArray(value) || reserved.has(name)) return;
    const filtered = value.filter((item) => item?.importedFrom !== source);
    if (filtered.length === value.length) return;
    plan.counts.listItems += value.length - filtered.length;
    if (filtered.length === 0 && createdLists.includes(name)) {
      plan.rootLists[name] = null;
      plan.counts.lists += 1;
    } else {
      plan.rootLists[name] = filtered;
    }
  });

  return plan;
}

async function readMap(ref) {
  const snap = await withRetry(() => getDocs(ref), RETRY);
  return Object.fromEntries(snap.docs.map((entry) => [entry.id, entry.data() || {}]));
}

async function loadResetData(uid, source) {
  const lists = {};
  await Promise.all([...WATCHED_LISTS, ...FLAG_LISTS].map(async (listKey) => {
    lists[listKey] = await readMap(collection(db, "Lists", uid, listKey));
  }));
  const [ratings, comments, rootSnap, stats] = await Promise.all([
    readMap(collection(db, "Users", uid, "myRatings")),
    readMap(collection(db, "Users", uid, "myComments")),
    withRetry(() => getDoc(doc(db, "Lists", uid)), RETRY),
    loadImportStats(uid).catch(() => ({})),
  ]);
  return {
    lists,
    ratings,
    comments,
    root: rootSnap.exists() ? rootSnap.data() || {} : {},
    createdLists: stats?.[source]?.createdLists || [],
  };
}

/**
 * Kaynağın aktardıklarını geri alır.
 * @param {string} uid
 * @param {"letterboxd"|"imdb"} source
 * @param {{ onProgress?: (done:number, total:number)=>void }} [options]
 * @returns {Promise<ReturnType<typeof emptyCounts>>}
 */
export async function resetImportedData(uid, source, { onProgress } = {}) {
  if (!uid || !source) return emptyCounts();
  const plan = planImportReset(await loadResetData(uid, source), source);
  const docOps = [
    ...plan.deleteDocs.map((op) => ({ ...op, remove: true })),
    ...plan.updateDocs,
  ];
  const hasRootLists = Object.keys(plan.rootLists).length > 0;
  const total = docOps.length + plan.ratings.length + plan.reviews.length + (hasRootLists ? 1 : 0) + 1;
  let done = 0;
  const tick = (amount = 1) => {
    done += amount;
    onProgress?.(Math.min(done, total), total);
  };
  onProgress?.(0, total);

  // 1) Liste belgeleri — toplu yazım
  for (let start = 0; start < docOps.length; start += BATCH_LIMIT) {
    const chunk = docOps.slice(start, start + BATCH_LIMIT);
    await withRetry(() => {
      const batch = writeBatch(db);
      chunk.forEach((op) => {
        const ref = doc(db, "Lists", uid, op.listKey, op.docId);
        if (op.remove) batch.delete(ref);
        else {
          batch.set(ref, {
            watchEvents: op.watchEvents,
            watchCount: op.watchEvents.length,
            ...(op.clearMark ? { importedFrom: deleteField() } : {}),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      });
      return batch.commit();
    }, RETRY);
    chunk.forEach((op) => {
      if (op.remove) deleteLocalItem(uid, op.listKey, op.docId);
      else updateLocalItem(uid, op.listKey, op.docId, { watchEvents: op.watchEvents, watchCount: op.watchEvents.length });
    });
    tick(chunk.length);
  }

  // 2) Puanlar — ortak agregatı da düşüren servisle
  for (const rating of plan.ratings) {
    await withRetry(() => removeMyRating({ ...rating, uid }), RETRY);
    tick();
  }

  // 3) İncelemeler
  const counts = { ...plan.counts, reviews: 0 };
  for (const review of plan.reviews) {
    const collectionName = review.kind === "tv" ? "TvComment" : "MovieComment";
    const mediaRef = doc(db, collectionName, review.targetId, "comments", review.commentId);
    const mediaSnap = await withRetry(() => getDoc(mediaRef), RETRY);
    const media = mediaSnap.exists() ? mediaSnap.data() || {} : null;
    if (media && Number(media.replyCount) > 0) {
      counts.keptReviews += 1;
      tick();
      continue;
    }
    if (media && media.userId === uid) {
      await withRetry(() => deleteDoc(mediaRef), RETRY);
      await withRetry(() => setDoc(doc(db, "Users", uid), { mediaCommentCount: increment(-1) }, { merge: true }), RETRY);
    }
    await withRetry(() => deleteDoc(doc(db, "Users", uid, "myComments", review.commentId)), RETRY);
    counts.reviews += 1;
    tick();
  }

  // 4) Özel listeler (kök belgedeki diziler)
  if (hasRootLists) {
    const rootPatch = { updatedAt: serverTimestamp() };
    const visibility = {};
    Object.entries(plan.rootLists).forEach(([name, items]) => {
      rootPatch[name] = items === null ? deleteField() : items;
      if (items === null) visibility[name] = deleteField();
    });
    await withRetry(() => setDoc(doc(db, "Lists", uid), rootPatch, { merge: true }), RETRY);
    if (Object.keys(visibility).length) {
      await withRetry(() => setDoc(doc(db, "Users", uid), { listVisible: visibility }, { merge: true }), RETRY);
    }
    tick();
  }

  // 5) Profil özeti + kaynak istatistiği
  await withRetry(() => rebuildImportedProfileStats(uid), RETRY);
  await withRetry(() => clearImportStats(uid, source), RETRY);
  tick();
  return counts;
}
