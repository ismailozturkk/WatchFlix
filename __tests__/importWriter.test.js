jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../services/listSyncService", () => ({ updateLocalItem: jest.fn(), deleteLocalItem: jest.fn() }));
jest.mock("../services/usageTrackerService", () => ({ trackFirestoreWrite: jest.fn(), trackFirestoreDelete: jest.fn(), trackFirestoreRead: jest.fn() }));
jest.mock("../services/analytics", () => ({ ANALYTICS_EVENTS: {}, trackEvent: jest.fn() }));
jest.mock("../services/activationAnalytics", () => ({ trackFirstContentActivation: jest.fn() }));

jest.mock("firebase/firestore", () => {
  const store = new Map();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const mergeInto = (target, patch) => {
    Object.entries(patch || {}).forEach(([key, raw]) => {
      // Firestore set() treats dotted keys literally; only update() expands paths.
      const path = [key];
      let cursor = target;
      path.slice(0, -1).forEach((part) => {
        cursor[part] = cursor[part] && typeof cursor[part] === "object" ? cursor[part] : {};
        cursor = cursor[part];
      });
      const leaf = path[path.length - 1];
      if (raw?.__increment != null) cursor[leaf] = (Number(cursor[leaf]) || 0) + raw.__increment;
      else if (raw?.__arrayUnion) cursor[leaf] = [...new Set([...(cursor[leaf] || []), ...raw.__arrayUnion])];
      else if (raw && typeof raw === "object" && !Array.isArray(raw) && !raw.__serverTimestamp) {
        cursor[leaf] = Object.keys(raw).length ? mergeInto({ ...(cursor[leaf] || {}) }, raw) : {};
      } else cursor[leaf] = clone(raw);
    });
    return target;
  };
  const snapshot = (path) => ({
    id: path.split("/").pop(),
    exists: () => store.has(path),
    data: () => clone(store.get(path)),
  });

  return {
    __store: store,
    __reset: () => store.clear(),
    doc: jest.fn((db, ...parts) => ({ path: parts.join("/") })),
    collection: jest.fn((db, ...parts) => ({ path: parts.join("/") })),
    increment: jest.fn((amount) => ({ __increment: amount })),
    arrayUnion: jest.fn((...values) => ({ __arrayUnion: values })),
    serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
    getDocs: jest.fn(async (ref) => {
      const prefix = `${ref.path}/`;
      const docs = [...store.keys()]
        .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
        .map(snapshot);
      return { docs, size: docs.length };
    }),
    runTransaction: jest.fn(async (db, callback) => {
      const writes = [];
      const tx = {
        get: jest.fn(async (ref) => snapshot(ref.path)),
        set: jest.fn((ref, data, options) => writes.push({ ref, data, options })),
        delete: jest.fn((ref) => writes.push({ ref, remove: true })),
      };
      const result = await callback(tx);
      writes.forEach(({ ref, data, options, remove }) => {
        if (remove) { store.delete(ref.path); return; }
        const next = options?.mergeFields
          ? { ...clone(store.get(ref.path)), ...clone(data) }
          : options?.merge ? mergeInto(clone(store.get(ref.path)) || {}, data) : clone(data);
        store.set(ref.path, next);
      });
      return result;
    }),
  };
});

import { importedReviewId } from "../services/import/importMerge";
import { writeImportedCustomLists, writeImportedItems } from "../services/import/importWriter";
import { addToList, removeFromList, markMovieWatch } from "../services/listItemsService";
import { markEpisodes } from "../services/watchedTvService";
import { setMyRating, removeMyRating } from "../services/ratingsService";

describe("transactional import writer", () => {
  const firestore = require("firebase/firestore");
  const uid = "user-1";
  const reviewId = importedReviewId(uid, "movie", 1);

  beforeEach(() => {
    firestore.__reset();
    firestore.__store.set("Lists/user-1/watchedMovies/movie_1", {
      id: 1,
      type: "movie",
      name: "Mevcut ad",
      minutes: 100,
      dateAdded: "2024-01-01",
      watchEvents: [{ id: "manual", watchedAt: "2024-01-01", scope: "movie" }],
      watchCount: 1,
    });
    firestore.__store.set("Lists/user-1", {
      counts: { watchedMovies: 1 },
      stats: { movies: { uniqueCount: 1, totalRewatchCount: 1, totalMinutes: 100 }, totalMinutes: 100 },
    });
    firestore.__store.set("Ratings/movie_1/userRatings/user-1", { rating: 8 });
    firestore.__store.set("Ratings/movie_1", { mediaType: "movie", mediaId: "1", count: 1, sum: 8 });
    firestore.__store.set("Users/user-1/myRatings/movie_1", { rating: 8, title: "Mevcut ad" });
    firestore.__store.set(`MovieComment/1/comments/${reviewId}`, { userId: uid, text: "Mevcut yorum" });
    firestore.__store.set(`Users/user-1/myComments/${reviewId}`, { kind: "movie", targetId: "1", text: "Mevcut yorum" });
    firestore.__store.set("Users/user-1", { mediaCommentCount: 1 });
  });

  test("a repeated import preserves watch history, rating, review, and counters", async () => {
    const item = {
      id: 1,
      mediaType: "movie",
      title: "İçe aktarılan ad",
      minutes: 120,
      watchDates: ["2024-01-01"],
      userRating: 10,
      review: "İçe aktarılan yorum",
      targetList: "watchedMovies",
    };
    const result = await writeImportedItems(uid, [item], { userProfile: { displayName: "Test" } });

    const movie = firestore.__store.get("Lists/user-1/watchedMovies/movie_1");
    const root = firestore.__store.get("Lists/user-1");
    expect(movie.name).toBe("Mevcut ad");
    expect(movie.minutes).toBe(100);
    expect(movie.watchEvents).toEqual([{ id: "manual", watchedAt: "2024-01-01", scope: "movie" }]);
    expect(firestore.__store.get("Ratings/movie_1/userRatings/user-1").rating).toBe(8);
    expect(firestore.__store.get(`MovieComment/1/comments/${reviewId}`).text).toBe("Mevcut yorum");
    expect(firestore.__store.get("Users/user-1").mediaCommentCount).toBe(1);
    expect(root.counts.watchedMovies).toBe(1);
    expect(root.stats.movies).toEqual({ uniqueCount: 1, totalRewatchCount: 1, totalMinutes: 100 });
    expect(result).toMatchObject({ ratingsCount: 0, reviewsCount: 0, addedWatchEventsCount: 0, preservedRatingsCount: 1, preservedReviewsCount: 1, unchangedCount: 1 });
  });

  test("preserves a pre-existing manual review with a different document id", async () => {
    firestore.__store.set("Users/user-1/myComments/manual-review", {
      kind: "movie",
      targetId: "2",
      parentId: null,
      text: "Uygulamada yazdığım yorum",
    });
    const result = await writeImportedItems(uid, [{
      id: 2,
      mediaType: "movie",
      title: "Film 2",
      minutes: 90,
      watchedDate: "2025-01-01",
      review: "Letterboxd yorumu",
      targetList: "watchedMovies",
    }]);

    expect(firestore.__store.has(`MovieComment/2/comments/${importedReviewId(uid, "movie", 2)}`)).toBe(false);
    expect(firestore.__store.get("Users/user-1").mediaCommentCount).toBe(1);
    expect(result).toMatchObject({ reviewsCount: 0, preservedReviewsCount: 1 });
  });

  test("imports custom Letterboxd lists once and preserves existing item metadata", async () => {
    const first = await writeImportedCustomLists(uid, [{
      name: "Weekend Picks",
      items: [{ id: 7, mediaType: "movie", title: "Imported", poster_path: "/a.jpg" }],
    }]);
    const second = await writeImportedCustomLists(uid, [{
      name: "Weekend Picks",
      items: [{ id: 7, mediaType: "movie", title: "Changed", poster_path: "/b.jpg" }],
    }]);
    const root = firestore.__store.get("Lists/user-1");

    expect(root["Weekend Picks"]).toHaveLength(1);
    expect(root["Weekend Picks"][0]).toMatchObject({ id: 7, name: "Imported", imagePath: "/a.jpg" });
    expect(root.statusIndex.movie[7].isInOtherLists).toBe(true);
    expect(first).toEqual({ customListsCount: 1, customListItemsCount: 1 });
    expect(second).toEqual({ customListsCount: 1, customListItemsCount: 0 });
  });

  test("film import emits both buckets before progress and retains unrelated favorites, TV and activity", async () => {
    firestore.__store.set("Lists/user-1/favorites/movie_42", { id: 42, type: "movie" });
    firestore.__store.set("Lists/user-1/watchedTv/tv_9", { id: 9, type: "tv", dateAdded: "2025-01-01" });
    const root = firestore.__store.get("Lists/user-1");
    root.statusIndex = { tv: { 9: { isWatched: true } } };
    root.Picks = [{ id: 42, type: "movie" }];
    const progress = jest.fn(() => {
      const index = firestore.__store.get("Lists/user-1").statusIndex;
      expect(index.movie).toBeDefined();
      expect(index.tv[9].isWatched).toBe(true);
    });
    await writeImportedItems(uid, [{ id: 2, mediaType: "movie", title: "New film", watchedDate: "2025-01-01", minutes: 90 }], progress);
    const updated = firestore.__store.get("Lists/user-1");
    expect(progress).toHaveBeenCalled();
    expect(updated.statusIndex.movie[42]).toMatchObject({ inFavorites: true, isInOtherLists: true });
    expect(updated.statusIndex.tv[9].isWatched).toBe(true);
    expect(updated.counts.favorites).toBe(1);
    expect(updated.activityIndex.comments).toContain("movie_1");
    expect(updated.Picks).toEqual(root.Picks);
  });

  test("normal list and rating writes keep the repaired nested schema through add/remove", async () => {
    await addToList(uid, "favorites", { id: 9, type: "tv", name: "Show" });
    expect(firestore.__store.get("Lists/user-1")).toMatchObject({ statusIndex: { tv: { 9: { inFavorites: true } } }, counts: { favorites: 1 } });
    await removeFromList(uid, "favorites", "tv", 9);
    expect(firestore.__store.get("Lists/user-1")).toMatchObject({ statusIndex: { tv: { 9: { inFavorites: false } } }, counts: { favorites: 0 } });
    await setMyRating({ uid, mediaType: "tv", mediaId: 9, rating: 7 });
    expect(firestore.__store.get("Lists/user-1").activityIndex.ratings.tv_9).toBe(7);
    await removeMyRating({ uid, mediaType: "tv", mediaId: 9 });
    expect(firestore.__store.get("Lists/user-1").activityIndex.ratings.tv_9).toBeNull();
    expect(Object.keys(firestore.__store.get("Lists/user-1")).some((key) => key.includes("."))).toBe(false);
  });

  test("normal movie and episode watches write nested status and duration counters", async () => {
    await markMovieWatch(uid, { id: 3, type: "movie", name: "Film", minutes: 90, releaseDate: "2020-01-01" }, "2025-01-01");
    await markEpisodes(uid, { id: 9, name: "Show", showEpisodeCount: 1, showSeasonCount: 1 }, { seasonNumber: 1 }, [{ episodeNumber: 1, episodeMinutes: 40, airDate: "2020-01-01" }], "2025-01-01");
    const root = firestore.__store.get("Lists/user-1");
    expect(root.statusIndex.movie[3].isWatched).toBe(true);
    expect(root.statusIndex.tv[9].isWatched).toBe(true);
    expect(root.stats.totalMinutes).toBe(230);
    expect(Object.keys(root).some((key) => key.includes("."))).toBe(false);
  });
});
