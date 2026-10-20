import { buildImportedSummary } from "./importSummary";
// Letterboxd / IMDb içe aktarımlarını mevcut Seelogd kayıtlarıyla kayıpsız
// birleştirir. Her medya öğesi transaction içinde işlendiği için aynı dosyayı
// yeniden aktarmak watchEvents, puan, yorum veya profil sayaçlarını çoğaltmaz.

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
import {
  fillMissingFields,
  importedReviewId,
  mergeImportedMovie,
  mergeImportedTv,
  mergeImportedWatchlist,
} from "./importMerge";

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

const addIncrement = (updates, path, amount) => {
  if (amount) setNested(updates, path, increment(amount));
};

const addGenreIncrements = (updates, genres) => {
  (Array.isArray(genres) ? genres : []).forEach((genre) => {
    if (genre !== undefined && genre !== null && String(genre).trim()) {
      addIncrement(updates, `stats.genreCounts.${genre}`, 1);
    }
  });
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
});

/** Letterboxd lists/*.csv kayıtlarını ekranların bugün kullandığı kök-array
 * özel liste modeline idempotent olarak yazar. */
export async function writeImportedCustomLists(uid, customLists = []) {
  if (!uid || !Array.isArray(customLists) || customLists.length === 0) {
    return { customListsCount: 0, customListItemsCount: 0 };
  }
  await ensureImportIndexShape(uid);
  const reserved = new Set(RESERVED_LIST_NAMES);
  let customListsCount = 0;
  let customListItemsCount = 0;
  const today = normalizeWatchDate(new Date()); // yerel gün (UTC değil)

  for (const sourceList of customLists) {
    const items = Array.isArray(sourceList?.items) ? sourceList.items.filter((item) => item?.id != null) : [];
    if (!sourceList?.name?.trim() || items.length === 0) continue;
    let addedInList = 0;
    await runTransaction(db, async (tx) => {
      addedInList = 0;
      const rootRef = doc(db, "Lists", uid);
      const userRef = doc(db, "Users", uid);
      const rootSnap = await tx.get(rootRef);
      const root = rootSnap.exists() ? rootSnap.data() || {} : {};
      let listName = sourceList.name.trim();
      if (reserved.has(listName)) listName = `Letterboxd - ${listName}`;
      if (root[listName] !== undefined && !Array.isArray(root[listName])) {
        listName = `Letterboxd - ${listName}`;
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
          merged.push(normalized);
          addedInList += 1;
        } else {
          merged[index] = { ...merged[index], ...fillMissingFields(merged[index], normalized) };
        }
        setNested(rootPatch, `statusIndex.${normalized.type}.${normalized.id}.isInOtherLists`, true);
      });

      tx.set(rootRef, { ...rootPatch, [listName]: merged }, { merge: true });
      if (!Array.isArray(root[listName])) {
        tx.set(userRef, { listVisible: { [listName]: true } }, { merge: true });
      }
    });
    customListsCount += 1;
    customListItemsCount += addedInList;
  }
  if (customListsCount > 0) await rebuildImportedProfileStats(uid);
  return { customListsCount, customListItemsCount };
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

export async function writeImportedItems(uid, resolvedItems, optionsOrProgress = {}) {
  const onProgress = typeof optionsOrProgress === "function"
    ? optionsOrProgress
    : optionsOrProgress?.onProgress;
  const userProfile = typeof optionsOrProgress === "object"
    ? optionsOrProgress?.userProfile || {}
    : {};
  if (!uid || !Array.isArray(resolvedItems) || resolvedItems.length === 0) {
    return { success: true, count: 0, watchedCount: 0, watchlistCount: 0, favoritesCount: 0, ratingsCount: 0, reviewsCount: 0, addedWatchEventsCount: 0, unchangedCount: 0 };
  }

  await ensureImportIndexShape(uid);
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
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
  };
  // Deterministik importer kimliğinden önce yazılmış manuel/eski yorumları da
  // tanı: aynı medya için ikinci bir üst-seviye yorum oluşturma.
  const commentsSnap = await getDocs(collection(db, "Users", uid, "myComments"));
  const existingReviewByKey = new Map();
  commentsSnap.docs.forEach((entry) => {
    const data = entry.data() || {};
    if ((data.kind === "movie" || data.kind === "tv") && !data.parentId && data.targetId != null) {
      existingReviewByKey.set(reviewKey(data.kind, data.targetId), entry.id);
    }
  });

  for (const item of resolvedItems) {
    if (item?.id == null) continue;
    const type = item.mediaType === "tv" ? "tv" : "movie";
    const mediaKey = `${type}_${item.id}`;
    const isWatchlist = item.targetList === "watchList";
    const isFavorite = item.targetList === "favorites";
    const listKey = isWatchlist ? "watchList" : isFavorite ? "favorites" : type === "tv" ? "watchedTv" : "watchedMovies";
    const listRef = doc(db, "Lists", uid, listKey, mediaKey);
    const rootRef = doc(db, "Lists", uid);
    const incomingRating = validRating(item.userRating);
    const hasReview = typeof item.review === "string" && item.review.trim().length > 0;
    const reviewId = importedReviewId(uid, type, item.id);
    const existingReviewId = existingReviewByKey.get(reviewKey(type, item.id));
    const preserveDifferentExistingReview = Boolean(existingReviewId && existingReviewId !== reviewId);
    const ratingUserRef = doc(db, "Ratings", mediaKey, "userRatings", uid);
    const ratingMirrorRef = doc(db, "Users", uid, "myRatings", mediaKey);
    const ratingAggregateRef = doc(db, "Ratings", mediaKey);
    const commentCollection = type === "tv" ? "TvComment" : "MovieComment";
    const mediaCommentRef = doc(db, commentCollection, String(item.id), "comments", reviewId);
    const commentMirrorRef = doc(db, "Users", uid, "myComments", reviewId);
    const userRef = doc(db, "Users", uid);
    let finalDocument = null;
    let itemChanged = false;
    let transactionStats = {};

    await runTransaction(db, async (tx) => {
      transactionStats = {
        addedWatchEventsCount: 0,
        ratingAdded: false,
        ratingPreserved: false,
        reviewAdded: false,
        reviewPreserved: false,
      };
      const listSnap = await tx.get(listRef);
      const [ratingUserSnap, ratingMirrorSnap, ratingAggregateSnap] = incomingRating != null
        ? await Promise.all([tx.get(ratingUserRef), tx.get(ratingMirrorRef), tx.get(ratingAggregateRef)])
        : [null, null, null];
      const [mediaCommentSnap, commentMirrorSnap] = hasReview && !preserveDifferentExistingReview
        ? await Promise.all([tx.get(mediaCommentRef), tx.get(commentMirrorRef)])
        : [null, null];
      const existing = listSnap.exists() ? listSnap.data() || {} : {};
      const rootUpdates = { updatedAt: serverTimestamp(), _schemaVersion: 3 };

      if (isWatchlist || isFavorite) {
        finalDocument = mergeImportedWatchlist(existing, item, today);
        if (!listSnap.exists()) {
          addIncrement(rootUpdates, `counts.${listKey}`, 1);
          itemChanged = true;
        }
        setNested(rootUpdates, `statusIndex.${type}.${item.id}.${isFavorite ? "inFavorites" : "inWatchList"}`, true);
      } else if (type === "movie") {
        const merged = mergeImportedMovie(existing, item, { now, fallbackDate: today });
        finalDocument = merged.document;
        transactionStats.addedWatchEventsCount = merged.addedEvents;
        const minutes = Number(finalDocument.minutes) || 0;
        if (merged.addedEvents > 0) {
          addIncrement(rootUpdates, "stats.movies.totalRewatchCount", merged.addedEvents);
          addIncrement(rootUpdates, "stats.movies.totalMinutes", merged.addedEvents * minutes);
          addIncrement(rootUpdates, "stats.totalMinutes", merged.addedEvents * minutes);
          itemChanged = true;
        }
        if (!merged.wasWatched && finalDocument.watchEvents.length > 0) {
          addIncrement(rootUpdates, "counts.watchedMovies", 1);
          addIncrement(rootUpdates, "stats.movies.uniqueCount", 1);
          addGenreIncrements(rootUpdates, finalDocument.genres);
        }
        setNested(rootUpdates, `statusIndex.movie.${item.id}.isWatched`, true);
      } else {
        const merged = mergeImportedTv(existing, item, { now, fallbackDate: today });
        finalDocument = merged.document;
        transactionStats.addedWatchEventsCount = merged.addedEvents;
        if (merged.addedEvents > 0) {
          addIncrement(rootUpdates, "stats.tv.shows.total", merged.addedEvents);
          addIncrement(rootUpdates, "stats.tv.seasons.total", merged.addedSeasons);
          addIncrement(rootUpdates, "stats.tv.episodes.total", merged.addedEpisodes);
          addIncrement(rootUpdates, "stats.tv.totalMinutes", merged.addedMinutes);
          addIncrement(rootUpdates, "stats.totalMinutes", merged.addedMinutes);
          itemChanged = true;
        }
        if (!merged.wasWatched && finalDocument.watchEvents.length > 0) {
          addIncrement(rootUpdates, "counts.watchedTv", 1);
          addIncrement(rootUpdates, "stats.tv.shows.unique", 1);
          addIncrement(rootUpdates, "stats.tv.seasons.unique", Number(finalDocument.showSeasonCount) || 0);
          addIncrement(rootUpdates, "stats.tv.episodes.unique", Number(finalDocument.showEpisodeCount) || 0);
          addGenreIncrements(rootUpdates, finalDocument.genres);
        }
        setNested(rootUpdates, `statusIndex.tv.${item.id}.isWatched`, true);
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
          tx.set(ratingUserRef, { rating: ratingToStore, updatedAt: serverTimestamp() });
          tx.set(ratingAggregateRef, {
            mediaType: type,
            mediaId: String(item.id),
            count: Math.max(0, Number(aggregate.count) || 0) + 1,
            sum: Math.max(0, Number(aggregate.sum) || 0) + ratingToStore,
            updatedAt: serverTimestamp(),
          }, { merge: true });
          transactionStats.ratingAdded = true;
          itemChanged = true;
        } else {
          transactionStats.ratingPreserved = true;
        }
        const ratingMetadata = {
          rating: ratingToStore,
          mediaType: type,
          mediaId: String(item.id),
          title: item.title || item.original_title || "",
          poster: item.poster_path || null,
        };
        if (!ratingMirrorSnap.exists()) {
          tx.set(ratingMirrorRef, { ...ratingMetadata, updatedAt: serverTimestamp() });
          itemChanged = true;
        } else {
          const missing = fillMissingFields(ratingMirrorSnap.data(), ratingMetadata);
          if (Object.keys(missing).length) tx.set(ratingMirrorRef, missing, { merge: true });
        }
        setNested(rootUpdates, `activityIndex.ratings.${mediaKey}`, ratingToStore);
      }

      if (hasReview && preserveDifferentExistingReview) {
        transactionStats.reviewPreserved = true;
        setNested(rootUpdates, "activityIndex.comments", arrayUnion(mediaKey));
      } else if (hasReview) {
        const reviewText = item.review.trim();
        const createdAt = importDate(item.watchedDate || item.dateAdded, today);
        if (!mediaCommentSnap.exists()) {
          tx.set(mediaCommentRef, {
            userId: uid,
            username: userProfile.displayName || userProfile.name || "Kullanıcı",
            userHandle: userProfile.username || userProfile.userHandle || "",
            avatar: userProfile.photoURL || null,
            authorPhotoURL: userProfile.photoURL || null,
            avatarIndex: userProfile.avatarIndex ?? 0,
            text: reviewText,
            isSpoiler: false,
            parentId: null,
            likeCount: 0,
            likedBy: {},
            replyCount: 0,
            timestamp: createdAt,
            imported: true,
          });
          if (!commentMirrorSnap.exists()) tx.set(userRef, { mediaCommentCount: increment(1) }, { merge: true });
          transactionStats.reviewAdded = true;
          itemChanged = true;
        } else {
          transactionStats.reviewPreserved = true;
        }
        if (!commentMirrorSnap.exists()) {
          tx.set(commentMirrorRef, {
            kind: type,
            targetId: String(item.id),
            parentId: null,
            text: mediaCommentSnap.exists() ? mediaCommentSnap.data()?.text || reviewText : reviewText,
            title: item.title || item.original_title || "",
            poster: item.poster_path || null,
            createdAt,
            imported: true,
          });
          itemChanged = true;
        }
        setNested(rootUpdates, "activityIndex.comments", arrayUnion(mediaKey));
      }

      // Aynı dokümana tek transaction yazımı: sayaç transformları ve aktivite
      // indeksleri birbirini son-yazan-kazan davranışıyla gölgeleyemez.
      tx.set(rootRef, rootUpdates, { merge: true });
    });

    if (finalDocument) updateLocalItem(uid, listKey, mediaKey, { ...finalDocument, updatedAt: now });
    stats.addedWatchEventsCount += transactionStats.addedWatchEventsCount || 0;
    if (transactionStats.ratingAdded) stats.ratingsCount += 1;
    if (transactionStats.ratingPreserved) stats.preservedRatingsCount += 1;
    if (transactionStats.reviewAdded) stats.reviewsCount += 1;
    if (transactionStats.reviewPreserved) stats.preservedReviewsCount += 1;
    if (hasReview && transactionStats.reviewAdded) {
      existingReviewByKey.set(reviewKey(type, item.id), reviewId);
    }
    stats.count += 1;
    if (isWatchlist) stats.watchlistCount += 1;
    else if (isFavorite) stats.favoritesCount += 1;
    else stats.watchedCount += 1;
    if (!itemChanged) stats.unchangedCount += 1;
    onProgress?.(stats.count, resolvedItems.length);
  }

  stats.profileStats = await rebuildImportedProfileStats(uid);
  return stats;
}
