// __tests__/importReset.test.js
// Kaynak etiketleme → birikimli istatistik → kaynak bazında sıfırlama, uçtan uca (Firestore
// taklidiyle). Asıl güvence: sıfırlama YALNIZ aktarımın eklediğini geri alır; kullanıcının kendi
// izlemeleri, sonradan değiştirdiği puan ve diğer kaynaktan gelenler korunur.

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../services/listSyncService", () => ({ updateLocalItem: jest.fn(), deleteLocalItem: jest.fn() }));
jest.mock("../services/usageTrackerService", () => ({ trackFirestoreWrite: jest.fn(), trackFirestoreDelete: jest.fn(), trackFirestoreRead: jest.fn() }));
jest.mock("../services/analytics", () => ({ ANALYTICS_EVENTS: {}, trackEvent: jest.fn() }));
jest.mock("../services/activationAnalytics", () => ({ trackFirstContentActivation: jest.fn() }));

jest.mock("firebase/firestore", () => {
  const store = new Map();
  const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
  const DELETE = "__deleteField__";
  const mergeInto = (target, patch) => {
    Object.entries(patch || {}).forEach(([key, raw]) => {
      if (raw === DELETE) {
        delete target[key];
      } else if (raw?.__increment != null) target[key] = (Number(target[key]) || 0) + raw.__increment;
      else if (raw?.__arrayUnion) target[key] = [...new Set([...(target[key] || []), ...raw.__arrayUnion])];
      else if (raw && typeof raw === "object" && !Array.isArray(raw) && !raw.__serverTimestamp) {
        target[key] = Object.keys(raw).length ? mergeInto({ ...(target[key] || {}) }, raw) : {};
      } else target[key] = clone(raw);
    });
    return target;
  };
  const snapshot = (path) => ({ id: path.split("/").pop(), exists: () => store.has(path), data: () => clone(store.get(path)) });
  const apply = ({ ref, data, options, remove }) => {
    if (remove) {
      store.delete(ref.path);
      return;
    }
    const next = options?.mergeFields
      ? { ...clone(store.get(ref.path)), ...clone(data) }
      : options?.merge
        ? mergeInto(clone(store.get(ref.path)) || {}, data)
        : mergeInto({}, data);
    store.set(ref.path, next);
  };
  const failures = [];
  return {
    __store: store,
    __failNextTransaction: (error) => failures.push(error),
    __reset: () => {
      store.clear();
      failures.length = 0;
    },
    doc: jest.fn((db, ...parts) => ({ path: parts.join("/") })),
    collection: jest.fn((db, ...parts) => ({ path: parts.join("/") })),
    increment: jest.fn((amount) => ({ __increment: amount })),
    arrayUnion: jest.fn((...values) => ({ __arrayUnion: values })),
    serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
    deleteField: jest.fn(() => DELETE),
    getDoc: jest.fn(async (ref) => snapshot(ref.path)),
    getDocs: jest.fn(async (ref) => {
      const prefix = `${ref.path}/`;
      const docs = [...store.keys()]
        .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
        .map(snapshot);
      return { docs, size: docs.length };
    }),
    setDoc: jest.fn(async (ref, data, options) => apply({ ref, data, options })),
    deleteDoc: jest.fn(async (ref) => apply({ ref, remove: true })),
    writeBatch: jest.fn(() => {
      const writes = [];
      return {
        set: (ref, data, options) => writes.push({ ref, data, options }),
        delete: (ref) => writes.push({ ref, remove: true }),
        commit: async () => writes.forEach(apply),
      };
    }),
    runTransaction: jest.fn(async (db, callback) => {
      if (failures.length) throw failures.shift();
      const writes = [];
      const tx = {
        get: jest.fn(async (ref) => snapshot(ref.path)),
        set: jest.fn((ref, data, options) => writes.push({ ref, data, options })),
        delete: jest.fn((ref) => writes.push({ ref, remove: true })),
      };
      const result = await callback(tx);
      writes.forEach(apply);
      return result;
    }),
  };
});

import { writeImportedCustomLists, writeImportedItems, rebuildImportedProfileStats } from "../services/import/importWriter";
import { resetImportedData, planImportReset } from "../services/import/importReset";
import { loadImportStats, mergeSourceStats, recordImportStats, emptySourceStats } from "../services/import/importStats";
import { importedReviewId } from "../services/import/importMerge";
import { setMyRating } from "../services/ratingsService";
import { createImportSignal } from "../services/import/importRetry";

const firestore = require("firebase/firestore");
const uid = "user-1";

const film = (id, extra = {}) => ({
  id,
  mediaType: "movie",
  title: `Film ${id}`,
  poster_path: `/p${id}.jpg`,
  minutes: 100,
  genres: ["Dram"],
  targetList: "watchedMovies",
  importSource: "letterboxd",
  ...extra,
});

beforeEach(() => {
  firestore.__reset();
  firestore.__store.set("Lists/user-1", { counts: {}, stats: {} });
  firestore.__store.set("Users/user-1", { mediaCommentCount: 0 });
});

describe("kaynak etiketleri", () => {
  test("aktarımın oluşturduğu belge, olay, puan ve inceleme kaynağını taşır; sayaçlar kaynak bazında", async () => {
    const stats = await writeImportedItems(uid, [
      film(1, { watchDates: ["2024-01-01"], userRating: 8, review: "Harika" }),
      film(2, { targetList: "watchList", importSource: "imdb" }),
    ], { rebuildStats: false });

    const movie = firestore.__store.get("Lists/user-1/watchedMovies/movie_1");
    expect(movie.importedFrom).toBe("letterboxd");
    expect(movie.watchEvents[0]).toMatchObject({ source: "letterboxd", watchedAt: "2024-01-01" });
    expect(firestore.__store.get("Users/user-1/myRatings/movie_1")).toMatchObject({ importedFrom: "letterboxd", importedRating: 8 });
    const reviewId = importedReviewId(uid, "movie", 1);
    expect(firestore.__store.get(`Users/user-1/myComments/${reviewId}`).importSource).toBe("letterboxd");
    expect(firestore.__store.get(`MovieComment/1/comments/${reviewId}`).importSource).toBe("letterboxd");
    expect(firestore.__store.get("Lists/user-1/watchList/movie_2").importedFrom).toBe("imdb");
    expect(stats.bySource).toEqual({
      letterboxd: { titles: 1, watchEvents: 1, ratings: 1, reviews: 1 },
      imdb: { titles: 1, watchEvents: 0, ratings: 0, reviews: 0 },
    });

    const again = await writeImportedItems(uid, [film(1, { watchDates: ["2024-01-01"], userRating: 8, review: "Harika" })], { rebuildStats: false });
    expect(again.bySource.letterboxd).toEqual({ titles: 0, watchEvents: 0, ratings: 0, reviews: 0 });
  });

  test("var olan belgeye eklenen izleme etiketlenir, belge sahipliği değişmez", async () => {
    firestore.__store.set("Lists/user-1/watchedMovies/movie_5", {
      id: 5, type: "movie", name: "Kendi", watchEvents: [{ id: "manual", watchedAt: "2023-01-01", scope: "movie" }], watchCount: 1,
    });
    await writeImportedItems(uid, [film(5, { watchDates: ["2024-02-02"] })], { rebuildStats: false });
    const doc = firestore.__store.get("Lists/user-1/watchedMovies/movie_5");
    expect(doc.importedFrom).toBeUndefined();
    expect(doc.watchEvents.map((event) => event.source || "manual")).toEqual(["letterboxd", "manual"]);
  });
});

describe("dayanıklı yazım", () => {
  test("geçici çekişme hatası yeniden denenir", async () => {
    firestore.__failNextTransaction(Object.assign(new Error("contention"), { code: "aborted" }));
    const stats = await writeImportedItems(uid, [film(1)], { rebuildStats: false });
    expect(stats).toMatchObject({ count: 1, failedCount: 0 });
  });

  test("kalıcı hata tek öğeyi düşürür, iş sürer", async () => {
    const progress = jest.fn();
    const original = firestore.runTransaction.getMockImplementation();
    let call = 0;
    // 1. transaction şema hazırlığı, 2. ilk öğe.
    firestore.runTransaction.mockImplementation(async (db, cb) => {
      call += 1;
      if (call === 2) throw Object.assign(new Error("denied"), { code: "permission-denied" });
      return original(db, cb);
    });
    try {
      const stats = await writeImportedItems(uid, [film(1), film(2)], { rebuildStats: false, onProgress: progress });
      expect(stats.failedCount).toBe(1);
      expect(stats.failedItems[0]).toMatchObject({ id: 1, code: "permission-denied" });
      expect(stats.count).toBe(1);
      expect(progress.mock.calls.map((args) => args[2].outcome)).toEqual(["failed", "added"]);
    } finally {
      firestore.runTransaction.mockImplementation(original);
    }
  });

  test("çevrimdışı: iş 'network' ile durur, kaldığı yer bilinir", async () => {
    const original = firestore.runTransaction.getMockImplementation();
    let call = 0;
    firestore.runTransaction.mockImplementation(async (db, cb) => {
      call += 1;
      if (call >= 3) throw Object.assign(new Error("client is offline"), { code: "unavailable" });
      return original(db, cb);
    });
    jest.useFakeTimers();
    try {
      const promise = writeImportedItems(uid, [film(1), film(2), film(3)], { rebuildStats: false });
      const caught = promise.catch((error) => error);
      await jest.advanceTimersByTimeAsync(60000);
      const error = await caught;
      expect(error).toMatchObject({ code: "network", processed: 1 });
      expect(error.stats.count).toBe(1);
    } finally {
      jest.useRealTimers();
      firestore.runTransaction.mockImplementation(original);
    }
  });

  test("durdurma sinyali sıradaki öğeden önce keser", async () => {
    const signal = createImportSignal();
    await expect(
      writeImportedItems(uid, [film(1), film(2)], { rebuildStats: false, signal, onProgress: () => signal.cancel() }),
    ).rejects.toMatchObject({ code: "cancelled", processed: 1 });
  });
});

describe("birikimli istatistik", () => {
  test("yeni oturum üstüne ekler, sürdürülen oturum aynı geçmiş satırını büyütür", () => {
    let stats = mergeSourceStats(emptySourceStats(), { titles: 10, ratings: 4, createdLists: ["A"] }, { at: "2026-10-01T10:00:00Z" });
    stats = mergeSourceStats(stats, { titles: 3 }, { at: "2026-10-02T10:00:00Z" });
    stats = mergeSourceStats(stats, { titles: 2, createdLists: ["A", "B"] }, { at: "2026-10-02T10:05:00Z", newSession: false });
    expect(stats).toMatchObject({ titles: 15, ratings: 4, imports: 2, firstImportAt: "2026-10-01T10:00:00Z", lastImportAt: "2026-10-02T10:05:00Z", createdLists: ["A", "B"] });
    expect(stats.history.map((entry) => entry.titles)).toEqual([5, 10]);
  });

  test("Firestore'a kaynak bazında yazılır ve okunur", async () => {
    await recordImportStats(uid, { letterboxd: { titles: 2, watchEvents: 3 } }, { at: "2026-10-29T08:00:00Z" });
    await recordImportStats(uid, { letterboxd: { titles: 1 }, imdb: { ratings: 5 } }, { at: "2026-10-29T09:00:00Z" });
    const stats = await loadImportStats(uid);
    expect(stats.letterboxd).toMatchObject({ titles: 3, watchEvents: 3, imports: 2 });
    expect(stats.imdb).toMatchObject({ ratings: 5, imports: 1 });
  });
});

describe("kaynak bazında sıfırlama", () => {
  test("plan yalnız etiketli kayıtları kapsar", () => {
    const plan = planImportReset({
      lists: {
        watchedMovies: {
          movie_1: { importedFrom: "letterboxd", watchEvents: [{ source: "letterboxd" }] },
          movie_2: { watchEvents: [{ id: "manual" }, { source: "letterboxd" }] },
          movie_3: { importedFrom: "letterboxd", watchEvents: [{ source: "letterboxd" }, { id: "later-manual" }] },
          movie_4: { importedFrom: "imdb", watchEvents: [{ source: "imdb" }] },
        },
        watchList: { movie_9: { importedFrom: "letterboxd" }, movie_10: {} },
      },
      ratings: {
        movie_1: { importedFrom: "letterboxd", importedRating: 8, rating: 8, mediaType: "movie", mediaId: "1" },
        movie_2: { importedFrom: "letterboxd", importedRating: 8, rating: 6, mediaType: "movie", mediaId: "2" },
      },
      comments: { r1: { importSource: "letterboxd", kind: "movie", targetId: "1" }, r2: { kind: "movie", targetId: "2" } },
      root: { Seçki: [{ id: 1, importedFrom: "letterboxd" }, { id: 7 }], Yeni: [{ id: 1, importedFrom: "letterboxd" }] },
      createdLists: ["Yeni"],
    }, "letterboxd");
    expect(plan.deleteDocs).toEqual([
      { listKey: "watchedMovies", docId: "movie_1" },
      { listKey: "watchList", docId: "movie_9" },
    ]);
    expect(plan.updateDocs.map((op) => [op.docId, op.watchEvents.length, op.clearMark])).toEqual([
      ["movie_2", 1, false],
      ["movie_3", 1, true],
    ]);
    expect(plan.ratings).toEqual([{ mediaType: "movie", mediaId: "1" }]);
    expect(plan.reviews.map((review) => review.commentId)).toEqual(["r1"]);
    expect(plan.rootLists).toEqual({ Seçki: [{ id: 7 }], Yeni: null });
    expect(plan.counts).toMatchObject({ titles: 2, watchEvents: 3, ratings: 1, listItems: 2, lists: 1 });
  });

  test("aktar → sıfırla: Letterboxd verisi gider, kullanıcınınki ve IMDb'ninki kalır", async () => {
    firestore.__store.set("Lists/user-1/watchedMovies/movie_5", {
      id: 5, type: "movie", name: "Kendi", minutes: 90, watchEvents: [{ id: "manual", watchedAt: "2023-01-01", scope: "movie" }], watchCount: 1,
    });
    const items = [
      film(1, { watchDates: ["2024-01-01"], userRating: 8, review: "Harika" }),
      film(2, { userRating: 7 }),
      film(5, { watchDates: ["2024-02-02"] }),
      film(3, { targetList: "watchList" }),
      film(4, { importSource: "imdb", userRating: 9 }),
    ];
    await writeImportedItems(uid, items, { userProfile: { displayName: "Test" } });
    const lists = await writeImportedCustomLists(uid, [{ name: "Hafta Sonu", items: [film(1), film(4, { importSource: "letterboxd" })] }]);
    await recordImportStats(uid, { letterboxd: { titles: 4, createdLists: lists.createdLists } });

    // Kullanıcı Film 2'nin puanını sonradan değiştirdi: sıfırlama bu puanı korumalı.
    await setMyRating({ uid, mediaType: "movie", mediaId: 2, rating: 4, title: "Film 2" });
    expect(firestore.__store.get("Ratings/movie_1")).toMatchObject({ count: 1, sum: 8 });
    expect(firestore.__store.get("Users/user-1").mediaCommentCount).toBe(1);

    const progress = jest.fn();
    const counts = await resetImportedData(uid, "letterboxd", { onProgress: progress });

    const store = firestore.__store;
    expect(store.has("Lists/user-1/watchedMovies/movie_1")).toBe(false);
    expect(store.has("Lists/user-1/watchedMovies/movie_2")).toBe(false);
    expect(store.has("Lists/user-1/watchList/movie_3")).toBe(false);
    expect(store.get("Lists/user-1/watchedMovies/movie_5").watchEvents).toEqual([
      { id: "manual", watchedAt: "2023-01-01", scope: "movie" },
    ]);
    expect(store.get("Lists/user-1/watchedMovies/movie_4").importedFrom).toBe("imdb");
    expect(store.has("Users/user-1/myRatings/movie_1")).toBe(false);
    expect(store.get("Ratings/movie_1")).toMatchObject({ count: 0, sum: 0 });
    expect(store.get("Users/user-1/myRatings/movie_2")).toMatchObject({ rating: 4 });
    expect(store.get("Users/user-1/myRatings/movie_4")).toMatchObject({ importedFrom: "imdb" });
    const reviewId = importedReviewId(uid, "movie", 1);
    expect(store.has(`MovieComment/1/comments/${reviewId}`)).toBe(false);
    expect(store.has(`Users/user-1/myComments/${reviewId}`)).toBe(false);
    expect(store.get("Users/user-1").mediaCommentCount).toBe(0);
    const root = store.get("Lists/user-1");
    expect(root["Hafta Sonu"]).toBeUndefined();
    expect(store.get("Users/user-1").listVisible?.["Hafta Sonu"]).toBeUndefined();
    expect(root.counts.watchedMovies).toBe(2); // movie_4 (IMDb) + movie_5 (kendi)
    expect(root.counts.watchList).toBe(0);
    expect(counts).toMatchObject({ titles: 3, ratings: 1, reviews: 1, lists: 1 });
    expect((await loadImportStats(uid)).letterboxd).toMatchObject({ titles: 0, imports: 0, createdLists: [] });
    expect(progress).toHaveBeenLastCalledWith(expect.any(Number), expect.any(Number));
    const [done, total] = progress.mock.calls.at(-1);
    expect(done).toBe(total);
  });

  test("yanıt almış inceleme korunur", async () => {
    await writeImportedItems(uid, [film(1, { review: "Harika" })], { rebuildStats: false });
    const reviewId = importedReviewId(uid, "movie", 1);
    const path = `MovieComment/1/comments/${reviewId}`;
    firestore.__store.set(path, { ...firestore.__store.get(path), replyCount: 2 });
    const counts = await resetImportedData(uid, "letterboxd");
    expect(firestore.__store.has(path)).toBe(true);
    expect(counts).toMatchObject({ reviews: 0, keptReviews: 1 });
    await rebuildImportedProfileStats(uid);
  });
});
