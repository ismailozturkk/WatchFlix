import { buildImportedSummary } from "./importSummary";
// Letterboxd / IMDb içe aktarımlarını mevcut Seelogd kayıtlarıyla kayıpsız
// birleştirir. Her medya öğesi transaction içinde işlendiği için aynı dosyayı
// yeniden aktarmak watchEvents, puan, yorum veya profil sayaçlarını çoğaltmaz.
//
// Dayanıklılık: öğeler SIRAYLA yazılır (hepsi aynı kök belgeyi günceller; paralel
// transaction'lar birbirini çekişmeyle düşürürdü). Geçici Firestore hatası geri
// çekilerek yeniden denenir; tek bir öğenin kalıcı hatası işi durdurmaz, öğe
// "başarısız" diye raporlanır. Bağlantı yoksa, kullanıcı durdurduysa ya da art arda
// çok öğe düştüyse iş durur ve hata `stats` + `processed` taşır: çağıran taraf
// `resolvedItems.slice(processed)` ile kaldığı yerden sürdürebilir.

import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  increment,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { updateLocalItem } from "../listSyncService";
import { RESERVED_LIST_NAMES } from "../../utils/listShare";
import { normalizeWatchDate } from "../../utils/watchHistory";
import { identityAvatar } from "../../utils/avatarPhotos";
import {
  fillMissingFields,
  importedReviewId,
  mergeBackupTv,
  mergeImportedMovie,
  mergeImportedWatchlist,
} from "./importMerge";
import { ImportError } from "./importErrors";
import { isOfflineFirestoreError, isTransientFirestoreError, withRetry } from "./importRetry";

const TX_RETRY = { retries: 3, baseMs: 400, maxMs: 4000, isRetryable: isTransientFirestoreError };

/** İşi durduran hata: kullanıcıya gösterilecek koda çevrilir, ilerleme bilgisini taşır. */
function interruption(error, extra) {
  let wrapped = error;
  if (!(error instanceof ImportError)) {
    wrapped = new ImportError(isOfflineFirestoreError(error) ? "network" : "saveInterrupted", error?.message);
    wrapped.cause = error;
  }
  return Object.assign(wrapped, extra);
}

const failedEntry = (item, error) => ({
  id: item?.id ?? null,
  mediaType: item?.mediaType === "tv" ? "tv" : "movie",
  title: item?.title || item?.sourceTitle || "",
  year: item?.sourceYear ?? null,
  poster_path: item?.poster_path || null,
  code: String(error?.code || "unknown"),
});

const validRating = (value) => {
  const rating = Number(value);
  return Number.isFinite(rating) && rating > 0 ? Math.min(10, Math.max(0, rating)) : null;
};

const importDate = (value, fallback) => {
  const raw = value || fallback;
  const date = new Date(`${String(raw).slice(0, 10)}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const setNested = (target, path, value) => {
  const parts = path.startsWith("stats.genreCounts.")
    ? ["stats", "genreCounts", path.slice("stats.genreCounts.".length)]
    : path.split(".");
  const leaf = parts.pop();
  const parent = parts.reduce((cursor, part) => {
    cursor[part] = cursor[part] && typeof cursor[part] === "object" ? cursor[part] : {};
    return cursor[part];
  }, target);
  parent[leaf] = value;
};

const reviewKey = (type, mediaId) => `${type}:${String(mediaId)}`;

const normalizedLibraryItem = (item, fallbackDate) => ({
  id: item.id,
  type: item.mediaType === "tv" ? "tv" : "movie",
  name: item.title || item.original_title || "",
  imagePath: item.poster_path || null,
  dateAdded: item.dateAdded || item.watchedDate || fallbackDate,
  genres: Array.isArray(item.genres) ? item.genres : [],
  ...(Number(item.minutes) > 0 ? { minutes: Number(item.minutes) } : {}),
  ...(Number(item.episodeMinutes) > 0 ? { episodeMinutes: Number(item.episodeMinutes) } : {}),
  ...(Number(item.episodeCount) > 0 ? { episodeCount: Number(item.episodeCount) } : {}),
  ...(Number(item.seasonCount) > 0 ? { seasonCount: Number(item.seasonCount) } : {}),
  ...(item.mediaType === "tv" && Number(item.totalMinutes) > 0 ? { totalMinutes: Number(item.totalMinutes) } : {}),
});

/** Letterboxd lists/*.csv kayıtlarını ekranların bugün kullandığı kök-array
 * özel liste modeline idempotent olarak yazar.
 * @param {{ signal?: object, rebuildStats?: boolean,
 *   onProgress?: (done:number, total:number, detail:{ name:string, added:number, failed?:boolean })=>void }} [options]
 */
export async function writeImportedCustomLists(uid, customLists = [], options = {}) {
  const { signal, onProgress, rebuildStats = true } = options;
  if (!uid || !Array.isArray(customLists) || customLists.length === 0) {
    return { customListsCount: 0, customListItemsCount: 0, failedListsCount: 0, failedLists: [], createdLists: [], bySource: {} };
  }
  await withRetry(() => ensureImportIndexShape(uid), { ...TX_RETRY, signal });
  const reserved = new Set(RESERVED_LIST_NAMES);
  let customListsCount = 0;
  let customListItemsCount = 0;
  const failedLists = [];
  const createdLists = [];
  const bySource = {};
  const today = normalizeWatchDate(new Date()); // yerel gün (UTC değil)
  let processed = 0;
  const partial = () => ({
    stats: { customListsCount, customListItemsCount, failedListsCount: failedLists.length, failedLists, createdLists, bySource },
    processed,
  });

  for (const sourceList of customLists) {
    if (signal?.cancelled) throw interruption(new ImportError("cancelled"), partial());
    const items = Array.isArray(sourceList?.items) ? sourceList.items.filter((item) => item?.id != null) : [];
    if (!sourceList?.name?.trim() || items.length === 0) {
      processed += 1;
      continue;
    }
    let addedInList = 0;
    let createdName = null;
    const listSource = items.find((item) => item.importSource)?.importSource || null;
    try {
      await withRetry(() => runTransaction(db, async (tx) => {
        addedInList = 0;
        createdName = null;
        const rootRef = doc(db, "Lists", uid);
        const userRef = doc(db, "Users", uid);
        const rootSnap = await tx.get(rootRef);
        const root = rootSnap.exists() ? rootSnap.data() || {} : {};
        let listName = sourceList.name.trim();
        // Ad çakışırsa kaynağın adıyla önek (Seelogd yedeğinden gelen liste "Letterboxd -" almasın).
        const prefix = listSource === "seelogd" ? "Seelogd" : "Letterboxd";
        if (reserved.has(listName)) listName = `${prefix} - ${listName}`;
        if (root[listName] !== undefined && !Array.isArray(root[listName])) {
          listName = `${prefix} - ${listName}`;
        }
        const current = Array.isArray(root[listName]) ? root[listName] : [];
        const merged = [...current];
        const byKey = new Map(current.map((item, index) => [`${item?.type || "movie"}:${item?.id}`, index]));
        const rootPatch = { updatedAt: serverTimestamp(), _schemaVersion: 3 };

        items.forEach((item) => {
          const normalized = normalizedLibraryItem(item, today);
          const key = `${normalized.type}:${normalized.id}`;
          const index = byKey.get(key);
          if (index === undefined) {
            byKey.set(key, merged.length);
            merged.push(item.importSource ? { ...normalized, importedFrom: item.importSource } : normalized);
            addedInList += 1;
          } else {
            merged[index] = { ...merged[index], ...fillMissingFields(merged[index], normalized) };
          }
          setNested(rootPatch, `statusIndex.${normalized.type}.${normalized.id}.isInOtherLists`, true);
        });

        tx.set(rootRef, { ...rootPatch, [listName]: merged }, { merge: true });
        if (!Array.isArray(root[listName])) {
          createdName = listName;
          tx.set(userRef, { listVisible: { [listName]: true } }, { merge: true });
        }
      }), { ...TX_RETRY, signal });
    } catch (error) {
      if (error?.code === "cancelled" || isOfflineFirestoreError(error)) throw interruption(error, partial());
      // Tek liste (ör. kök belge sınırı) diğerlerini engellemesin.
      failedLists.push(sourceList.name.trim());
      processed += 1;
      onProgress?.(processed, customLists.length, { name: sourceList.name.trim(), added: 0, failed: true });
      continue;
    }
    customListsCount += 1;
    customListItemsCount += addedInList;
    if (createdName) createdLists.push(createdName);
    if (listSource) {
      const entry = (bySource[listSource] = bySource[listSource] || { lists: 0, listItems: 0, createdLists: [] });
      entry.lists += createdName ? 1 : 0;
      entry.listItems += addedInList;
      if (createdName) entry.createdLists.push(createdName);
    }
    processed += 1;
    onProgress?.(processed, customLists.length, { name: sourceList.name.trim(), added: addedInList });
  }
  if (customListsCount > 0 && rebuildStats) {
    await withRetry(() => rebuildImportedProfileStats(uid), { ...TX_RETRY, signal });
  }
  return { customListsCount, customListItemsCount, failedListsCount: failedLists.length, failedLists, createdLists, bySource };
}

/** Alt koleksiyonlardan profil sayaçlarını yeniden hesaplar ve eski importer
 * sürümlerinin eksik bıraktığı kök özetini de onarır. */
export async function rebuildImportedProfileStats(uid) {
  if (!uid) return null;
  let patch;
  await runTransaction(db, async (tx) => {
    const rootRef = doc(db, "Lists", uid);
    const snap = await tx.get(rootRef);
    // Read the root first so a concurrent list/root write retries this scan.
    const lists = {};
    await Promise.all(["favorites", "watchList", "watchedMovies", "watchedTv", "customItems", "myRatings", "myComments"].map(async (key) => {
      const listSnap = await getDocs(collection(db, key.startsWith("my") ? "Users" : "Lists", uid, key));
      lists[key] = Object.fromEntries(listSnap.docs.map((entry) => [entry.id, { docId: entry.id, ...entry.data() }]));
    }));
    patch = buildImportedSummary(snap.exists() ? snap.data() : {}, lists);
    tx.set(rootRef, { ...patch, updatedAt: serverTimestamp(), _schemaVersion: 3 }, {
      mergeFields: ["statusIndex", "activityIndex", "counts", "stats", "updatedAt", "_schemaVersion"],
    });
  });
  return patch.stats;
}

// Ensure both buckets before the first item emits a root snapshot. An empty
// map is written only when absent; set+merge would otherwise clear that map.
async function ensureImportIndexShape(uid) {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "Lists", uid);
    const snap = await tx.get(ref);
    const index = snap.exists() ? snap.data()?.statusIndex : null;
    const patch = {};
    for (const type of ["movie", "tv"]) {
      if (!index?.[type] || typeof index[type] !== "object" || Array.isArray(index[type])) patch[type] = {};
    }
    if (Object.keys(patch).length) tx.set(ref, { statusIndex: patch }, { merge: true });
  });
}

// Kayıt PARÇALAR halinde: bir transaction en çok ITEM_CHUNK_SIZE öğeyi birlikte okur/yazar. Eskiden her
// öğe ayrı transaction + ayrı kök belge yazımıydı (1000 filmlik Letterboxd ≈ 1000 gidiş-dönüş, dakikalar).
// Kök belge (sayaçlar, statusIndex) parça başına TEK kez yazılır; sayaçlar parçada toplanıp tek increment olur.
// Aynı medya (aynı belge/puan/yorum) bir parçada iki kez bulunmaz: ikisi aynı ön-durumu okuyup birbirini ezerdi.
// Parça kalıcı bir hatayla düşerse öğeleri TEK TEK yeniden denenir: hatalı öğe yalnız kendisini düşürür.
export const ITEM_CHUNK_SIZE = 12;

const itemMediaKey = (item) => `${item?.mediaType === "tv" ? "tv" : "movie"}_${item?.id}`;

function chunkItems(items, start, size) {
  const chunk = [];
  const keys = new Set();
  for (let index = start; index < items.length && chunk.length < size; index += 1) {
    const item = items[index];
    if (item?.id != null) {
      const key = itemMediaKey(item);
      if (keys.has(key)) break;
      keys.add(key);
    }
    chunk.push(item);
  }
  return chunk;
}

/** Bir öğenin transaction dışında belirlenebilen her şeyi (belge yolları, bayraklar). */
function planImportItem(uid, item, existingReviewByKey) {
  if (item?.id == null) return null;
  const type = item.mediaType === "tv" ? "tv" : "movie";
  const mediaKey = `${type}_${item.id}`;
  const isWatchlist = item.targetList === "watchList";
  const isFavorite = item.targetList === "favorites";
  const listKey = isWatchlist ? "watchList" : isFavorite ? "favorites" : type === "tv" ? "watchedTv" : "watchedMovies";
  const reviewId = importedReviewId(uid, type, item.id);
  const existingReviewId = existingReviewByKey.get(reviewKey(type, item.id));
  const commentCollection = type === "tv" ? "TvComment" : "MovieComment";
  return {
    uid,
    item,
    type,
    mediaKey,
    isWatchlist,
    isFavorite,
    listKey,
    listRef: doc(db, "Lists", uid, listKey, mediaKey),
    incomingRating: validRating(item.userRating),
    hasReview: typeof item.review === "string" && item.review.trim().length > 0,
    reviewId,
    preserveDifferentExistingReview: Boolean(existingReviewId && existingReviewId !== reviewId),
    ratingUserRef: doc(db, "Ratings", mediaKey, "userRatings", uid),
    ratingMirrorRef: doc(db, "Users", uid, "myRatings", mediaKey),
    ratingAggregateRef: doc(db, "Ratings", mediaKey),
    mediaCommentRef: doc(db, commentCollection, String(item.id), "comments", reviewId),
    commentMirrorRef: doc(db, "Users", uid, "myComments", reviewId),
    source: item.importSource || null,
  };
}

async function readImportItem(tx, plan) {
  const rated = plan.incomingRating != null;
  const reviewed = plan.hasReview && !plan.preserveDifferentExistingReview;
  const [listSnap, ratingUserSnap, ratingMirrorSnap, ratingAggregateSnap, mediaCommentSnap, commentMirrorSnap] =
    await Promise.all([
      tx.get(plan.listRef),
      rated ? tx.get(plan.ratingUserRef) : null,
      rated ? tx.get(plan.ratingMirrorRef) : null,
      rated ? tx.get(plan.ratingAggregateRef) : null,
      reviewed ? tx.get(plan.mediaCommentRef) : null,
      reviewed ? tx.get(plan.commentMirrorRef) : null,
    ]);
  return { listSnap, ratingUserSnap, ratingMirrorSnap, ratingAggregateSnap, mediaCommentSnap, commentMirrorSnap };
}

/** Parçanın kök belge yazımı: sayaçlar toplanır, indeksler birleşir. */
function createRootAccumulator() {
  return { patch: { updatedAt: serverTimestamp(), _schemaVersion: 3 }, counters: new Map(), comments: new Set(), commentCount: 0 };
}

const bump = (acc, path, amount) => {
  if (amount) acc.counters.set(path, (acc.counters.get(path) || 0) + amount);
};

const bumpGenres = (acc, genres) => {
  (Array.isArray(genres) ? genres : []).forEach((genre) => {
    if (genre !== undefined && genre !== null && String(genre).trim()) bump(acc, `stats.genreCounts.${genre}`, 1);
  });
};

function flushRootAccumulator(tx, acc, rootRef, userRef) {
  const patch = acc.patch;
  acc.counters.forEach((amount, path) => {
    if (amount) setNested(patch, path, increment(amount));
  });
  if (acc.comments.size) setNested(patch, "activityIndex.comments", arrayUnion(...acc.comments));
  tx.set(rootRef, patch, { merge: true });
  if (acc.commentCount) tx.set(userRef, { mediaCommentCount: increment(acc.commentCount) }, { merge: true });
}

/** Tek öğenin yazımları (kök hariç: o birikime işlenir). Dönen değer öğenin sonucu. */
function applyImportItem(tx, plan, snaps, acc, { now, today, userProfile }) {
  const { item, type, mediaKey, isWatchlist, isFavorite, listKey, listRef, incomingRating, hasReview, source } = plan;
  const { listSnap, ratingUserSnap, ratingMirrorSnap, ratingAggregateSnap, mediaCommentSnap, commentMirrorSnap } = snaps;
  const result = {
    finalDocument: null,
    itemChanged: false,
    addedWatchEventsCount: 0,
    ratingAdded: false,
    ratingPreserved: false,
    reviewAdded: false,
    reviewPreserved: false,
    docCreated: false,
  };
  const existing = listSnap.exists() ? listSnap.data() || {} : {};
  let finalDocument = null;
  let itemChanged = false;

  if (isWatchlist || isFavorite) {
    finalDocument = mergeImportedWatchlist(existing, item, today);
    if (!listSnap.exists()) {
      bump(acc, `counts.${listKey}`, 1);
      itemChanged = true;
    }
    setNested(acc.patch, `statusIndex.${type}.${item.id}.${isFavorite ? "inFavorites" : "inWatchList"}`, true);
  } else if (type === "movie") {
    const merged = mergeImportedMovie(existing, item, { now, fallbackDate: today });
    finalDocument = merged.document;
    result.addedWatchEventsCount = merged.addedEvents;
    const minutes = Number(finalDocument.minutes) || 0;
    if (merged.addedEvents > 0) {
      bump(acc, "stats.movies.totalRewatchCount", merged.addedEvents);
      bump(acc, "stats.movies.totalMinutes", merged.addedEvents * minutes);
      bump(acc, "stats.totalMinutes", merged.addedEvents * minutes);
      itemChanged = true;
    }
    if (!merged.wasWatched && finalDocument.watchEvents.length > 0) {
      bump(acc, "counts.watchedMovies", 1);
      bump(acc, "stats.movies.uniqueCount", 1);
      bumpGenres(acc, finalDocument.genres);
    }
    setNested(acc.patch, `statusIndex.movie.${item.id}.isWatched`, true);
  } else {
    // Seelogd yedeği bölüm bölüm geçmiş taşır; Letterboxd/IMDb yalnız "dizi izlendi" der.
    // Bölüm geçmişi + "tüm dizi" izlemeleri birlikte (importMerge.mergeBackupTv).
    const merged = mergeBackupTv(existing, item, { now, fallbackDate: today });
    finalDocument = merged.document;
    result.addedWatchEventsCount = merged.addedEvents;
    // repairedMinutes: önceki aktarımın 0 dk yazdığı dizi onarıldı (belge yeniden yazılmalı).
    if (merged.addedEvents > 0 || merged.addedEpisodes > 0 || merged.repairedMinutes > 0) {
      bump(acc, "stats.tv.shows.total", merged.addedShowEvents);
      bump(acc, "stats.tv.seasons.total", merged.addedSeasons);
      bump(acc, "stats.tv.episodes.total", merged.addedEpisodes);
      bump(acc, "stats.tv.totalMinutes", merged.addedMinutes);
      bump(acc, "stats.totalMinutes", merged.addedMinutes);
      itemChanged = true;
    }
    if (!merged.wasWatched && finalDocument.watchEvents.length > 0) {
      bump(acc, "counts.watchedTv", 1);
      bump(acc, "stats.tv.shows.unique", 1);
      bump(acc, "stats.tv.seasons.unique", Number(finalDocument.showSeasonCount) || 0);
      bump(acc, "stats.tv.episodes.unique", Number(finalDocument.showEpisodeCount) || 0);
      bumpGenres(acc, finalDocument.genres);
    }
    setNested(acc.patch, `statusIndex.tv.${item.id}.isWatched`, true);
  }

  // Aktarımın oluşturduğu belge kaynağını taşır: sıfırlama yalnız bunları siler.
  if (!listSnap.exists() && finalDocument) {
    result.docCreated = true;
    if (source) finalDocument = { ...finalDocument, importedFrom: source };
  }
  const metadataPatch = fillMissingFields(existing, finalDocument);
  if (!listSnap.exists() || Object.keys(metadataPatch).length > 0 || itemChanged) {
    tx.set(listRef, { ...finalDocument, updatedAt: serverTimestamp() }, { merge: true });
    itemChanged = true;
  }

  if (incomingRating != null) {
    const globalRating = ratingUserSnap.exists() ? validRating(ratingUserSnap.data()?.rating) : null;
    const mirrorRating = ratingMirrorSnap.exists() ? validRating(ratingMirrorSnap.data()?.rating) : null;
    const ratingToStore = globalRating ?? mirrorRating ?? incomingRating;
    if (!ratingUserSnap.exists()) {
      const aggregate = ratingAggregateSnap.exists() ? ratingAggregateSnap.data() || {} : {};
      tx.set(plan.ratingUserRef, { rating: ratingToStore, updatedAt: serverTimestamp() });
      tx.set(plan.ratingAggregateRef, {
        mediaType: type,
        mediaId: String(item.id),
        count: Math.max(0, Number(aggregate.count) || 0) + 1,
        sum: Math.max(0, Number(aggregate.sum) || 0) + ratingToStore,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      result.ratingAdded = true;
      itemChanged = true;
    } else {
      result.ratingPreserved = true;
    }
    const ratingMetadata = {
      rating: ratingToStore,
      mediaType: type,
      mediaId: String(item.id),
      title: item.title || item.original_title || "",
      poster: item.poster_path || null,
    };
    if (!ratingMirrorSnap.exists()) {
      // Puanı aktarım EKLEDİYSE işaretlenir. setMyRating yansıyı baştan yazar: kullanıcı
      // puanı sonradan değiştirirse işaret kalkar, sıfırlama o puanı korur.
      const importMark = result.ratingAdded && source ? { importedFrom: source, importedRating: ratingToStore } : {};
      tx.set(plan.ratingMirrorRef, { ...ratingMetadata, ...importMark, updatedAt: serverTimestamp() });
      itemChanged = true;
    } else {
      const missing = fillMissingFields(ratingMirrorSnap.data(), ratingMetadata);
      if (Object.keys(missing).length) tx.set(plan.ratingMirrorRef, missing, { merge: true });
    }
    setNested(acc.patch, `activityIndex.ratings.${mediaKey}`, ratingToStore);
  }

  if (hasReview && plan.preserveDifferentExistingReview) {
    result.reviewPreserved = true;
    acc.comments.add(mediaKey);
  } else if (hasReview) {
    const reviewText = item.review.trim();
    const createdAt = importDate(item.watchedDate || item.dateAdded, today);
    if (!mediaCommentSnap.exists()) {
      const identity = identityAvatar(userProfile);
      tx.set(plan.mediaCommentRef, {
        userId: plan.uid,
        username: userProfile.displayName || userProfile.name || "Kullanıcı",
        userHandle: userProfile.username || userProfile.userHandle || "",
        // Hazır avatarda fotoğraf yazılmaz (utils/avatarPhotos.identityAvatar).
        avatar: identity.photoURL,
        authorPhotoURL: identity.photoURL,
        avatarIndex: identity.avatarIndex,
        text: reviewText,
        isSpoiler: false,
        parentId: null,
        likeCount: 0,
        likedBy: {},
        replyCount: 0,
        timestamp: createdAt,
        imported: true,
        ...(source ? { importSource: source } : {}),
      });
      if (!commentMirrorSnap.exists()) acc.commentCount += 1;
      result.reviewAdded = true;
      itemChanged = true;
    } else {
      result.reviewPreserved = true;
    }
    if (!commentMirrorSnap.exists()) {
      tx.set(plan.commentMirrorRef, {
        kind: type,
        targetId: String(item.id),
        parentId: null,
        text: mediaCommentSnap.exists() ? mediaCommentSnap.data()?.text || reviewText : reviewText,
        title: item.title || item.original_title || "",
        poster: item.poster_path || null,
        createdAt,
        imported: true,
        ...(source && !mediaCommentSnap.exists() ? { importSource: source } : {}),
      });
      itemChanged = true;
    }
    acc.comments.add(mediaKey);
  }

  result.finalDocument = finalDocument;
  result.itemChanged = itemChanged;
  return result;
}

/**
 * @param {string} uid
 * @param {Object[]} resolvedItems  tmdbResolver çıktısı (attachSourceData)
 * @param {Function|{ userProfile?: Object, signal?: object, rebuildStats?: boolean,
 *   maxConsecutiveFailures?: number, chunkSize?: number,
 *   onProgress?: (processed:number, total:number, detail:{ item:Object, outcome:"added"|"unchanged"|"failed" })=>void }} optionsOrProgress
 */
export async function writeImportedItems(uid, resolvedItems, optionsOrProgress = {}) {
  const options = typeof optionsOrProgress === "function" ? { onProgress: optionsOrProgress } : optionsOrProgress || {};
  const { onProgress, signal, rebuildStats = true, maxConsecutiveFailures = 5 } = options;
  const chunkSize = Math.max(1, Number(options.chunkSize) || ITEM_CHUNK_SIZE);
  const userProfile = options.userProfile || {};
  if (!uid || !Array.isArray(resolvedItems) || resolvedItems.length === 0) {
    return { success: true, count: 0, watchedCount: 0, watchlistCount: 0, favoritesCount: 0, ratingsCount: 0, reviewsCount: 0, addedWatchEventsCount: 0, unchangedCount: 0, failedCount: 0, failedItems: [] };
  }

  await withRetry(() => ensureImportIndexShape(uid), { ...TX_RETRY, signal });
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const env = { now, today, userProfile };
  const stats = {
    success: true,
    count: 0,
    watchedCount: 0,
    watchlistCount: 0,
    favoritesCount: 0,
    ratingsCount: 0,
    reviewsCount: 0,
    addedWatchEventsCount: 0,
    unchangedCount: 0,
    preservedRatingsCount: 0,
    preservedReviewsCount: 0,
    failedCount: 0,
    failedItems: [],
    // Kaynak bazında EKLENEN (önceden olmayan) kayıtlar: birikimli aktarım istatistiği.
    bySource: {},
  };
  const total = resolvedItems.length;
  let processed = 0;
  let consecutiveFailures = 0;
  // Deterministik importer kimliğinden önce yazılmış manuel/eski yorumları da
  // tanı: aynı medya için ikinci bir üst-seviye yorum oluşturma.
  const commentsSnap = await withRetry(
    () => getDocs(collection(db, "Users", uid, "myComments")),
    { ...TX_RETRY, signal },
  );
  const existingReviewByKey = new Map();
  commentsSnap.docs.forEach((entry) => {
    const data = entry.data() || {};
    if ((data.kind === "movie" || data.kind === "tv") && !data.parentId && data.targetId != null) {
      existingReviewByKey.set(reviewKey(data.kind, data.targetId), entry.id);
    }
  });
  const rootRef = doc(db, "Lists", uid);
  const userRef = doc(db, "Users", uid);

  /** Parçayı tek transaction'da yazar; öğe sonuçlarını parça sırasıyla döndürür (kimliksiz öğe: null). */
  const commitChunk = async (chunk) => {
    const plans = chunk.map((item) => planImportItem(uid, item, existingReviewByKey));
    const live = plans.filter(Boolean);
    if (!live.length) return plans.map(() => null);
    let results = [];
    await withRetry(() => runTransaction(db, async (tx) => {
      // Firestore çekişmede geri çağrıyı yeniden çalıştırır: dış durum her denemede sıfırdan.
      const snaps = await Promise.all(live.map((plan) => readImportItem(tx, plan)));
      const acc = createRootAccumulator();
      results = live.map((plan, index) => applyImportItem(tx, plan, snaps[index], acc, env));
      // Aynı dokümana tek transaction yazımı: sayaç transformları ve aktivite
      // indeksleri birbirini son-yazan-kazan davranışıyla gölgeleyemez.
      flushRootAccumulator(tx, acc, rootRef, userRef);
    }), { ...TX_RETRY, signal });
    let cursor = 0;
    return plans.map((plan) => (plan ? { plan, result: results[cursor++] } : null));
  };

  const recordSuccess = (item, entry) => {
    processed += 1;
    if (!entry) return; // kimliksiz öğe: atlandı
    const { plan, result } = entry;
    if (result.finalDocument) {
      updateLocalItem(uid, plan.listKey, plan.mediaKey, { ...result.finalDocument, updatedAt: now });
    }
    stats.addedWatchEventsCount += result.addedWatchEventsCount || 0;
    if (result.ratingAdded) stats.ratingsCount += 1;
    if (result.ratingPreserved) stats.preservedRatingsCount += 1;
    if (result.reviewAdded) stats.reviewsCount += 1;
    if (result.reviewPreserved) stats.preservedReviewsCount += 1;
    if (plan.hasReview && result.reviewAdded) existingReviewByKey.set(reviewKey(plan.type, item.id), plan.reviewId);
    stats.count += 1;
    if (plan.isWatchlist) stats.watchlistCount += 1;
    else if (plan.isFavorite) stats.favoritesCount += 1;
    else stats.watchedCount += 1;
    if (!result.itemChanged) stats.unchangedCount += 1;
    if (plan.source) {
      const bucket = (stats.bySource[plan.source] = stats.bySource[plan.source] || { titles: 0, watchEvents: 0, ratings: 0, reviews: 0 });
      if (result.docCreated) bucket.titles += 1;
      bucket.watchEvents += result.addedWatchEventsCount || 0;
      if (result.ratingAdded) bucket.ratings += 1;
      if (result.reviewAdded) bucket.reviews += 1;
    }
    onProgress?.(processed, total, { item, outcome: result.itemChanged ? "added" : "unchanged" });
  };

  /** Kalıcı hatayla düşen tek öğe: raporla, sıradakine geç; art arda çok düşerse dur. */
  const recordFailure = (item, error) => {
    consecutiveFailures += 1;
    stats.failedCount += 1;
    stats.failedItems.push(failedEntry(item, error));
    processed += 1;
    onProgress?.(processed, total, { item, outcome: "failed" });
    if (consecutiveFailures >= maxConsecutiveFailures) {
      throw interruption(new ImportError("saveInterrupted", error?.message), { stats, processed });
    }
  };

  const stopsJob = (error) => error?.code === "cancelled" || isOfflineFirestoreError(error);

  while (processed < total) {
    if (signal?.cancelled) throw interruption(new ImportError("cancelled"), { stats, processed });
    const chunk = chunkItems(resolvedItems, processed, chunkSize);
    let entries;
    try {
      entries = await commitChunk(chunk);
    } catch (error) {
      if (stopsJob(error)) throw interruption(error, { stats, processed });
      if (chunk.length === 1) {
        recordFailure(chunk[0], error);
        continue;
      }
      // Parçada kalıcı hata (izin, belge sınırı …): hangi öğe olduğunu bulmak için tek tek.
      for (const item of chunk) {
        if (signal?.cancelled) throw interruption(new ImportError("cancelled"), { stats, processed });
        let single;
        try {
          [single] = await commitChunk([item]);
        } catch (itemError) {
          if (stopsJob(itemError)) throw interruption(itemError, { stats, processed });
          recordFailure(item, itemError);
          continue;
        }
        consecutiveFailures = 0;
        recordSuccess(item, single);
      }
      continue;
    }
    consecutiveFailures = 0;
    chunk.forEach((item, index) => recordSuccess(item, entries[index]));
  }

  if (rebuildStats) {
    stats.profileStats = await withRetry(() => rebuildImportedProfileStats(uid), { ...TX_RETRY, signal });
  }
  return stats;
}
