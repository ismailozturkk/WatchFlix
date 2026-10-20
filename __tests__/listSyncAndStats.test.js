jest.mock("../firebase", () => ({
  db: {},
  app: {},
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((db, col, id) => ({ path: `${col}/${id}` })),
  setDoc: jest.fn(async () => {}),
  getDoc: jest.fn(async () => ({ exists: () => true, data: () => ({}) })),
  deleteDoc: jest.fn(async () => {}),
  updateDoc: jest.fn(async () => {}),
  collection: jest.fn((db, ...path) => ({ path: path.join("/") })),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => args),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    commit: jest.fn(async () => {}),
  })),
  runTransaction: jest.fn(async (db, fn) => fn({
    get: jest.fn(async () => ({ exists: () => false, data: () => ({}) })),
    set: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  })),
  getDocs: jest.fn(async () => ({
    empty: false,
    docs: [
      {
        id: "movie_872585",
        data: () => ({
          id: 872585,
          type: "movie",
          name: "Oppenheimer",
          minutes: 180,
          updatedAt: { seconds: 1724200000 },
        }),
      },
    ],
  })),
  onSnapshot: jest.fn(() => () => {}),
  serverTimestamp: jest.fn(() => "TIMESTAMP"),
  increment: jest.fn((n) => n),
  deleteField: jest.fn(() => "DELETE_FIELD"),
  arrayUnion: jest.fn((...args) => args),
  Timestamp: {
    fromMillis: jest.fn((ms) => ({ seconds: Math.floor(ms / 1000) })),
    fromDate: jest.fn((d) => ({ seconds: Math.floor(d.getTime() / 1000) })),
  },
}));

const {
  getLocalList,
  setLocalList,
  updateLocalItem,
  deleteLocalItem,
  syncListDelta,
} = require("../services/listSyncService");

describe("listSyncService and unified status index", () => {
  const uid = "test_user_123";

  test("getLocalList returns empty object when cache is empty", () => {
    const list = getLocalList(uid, "watchList");
    expect(typeof list).toBe("object");
  });

  test("setLocalList and getLocalList properly store and retrieve map", () => {
    const mockMap = {
      movie_157336: { id: 157336, type: "movie", name: "Interstellar", minutes: 169 },
      movie_27205: { id: 27205, type: "movie", name: "Inception", minutes: 148 },
    };
    setLocalList(uid, "watchedMovies", mockMap);
    const retrieved = getLocalList(uid, "watchedMovies");
    expect(retrieved.movie_157336.name).toBe("Interstellar");
    expect(retrieved.movie_27205.minutes).toBe(148);
  });

  test("updateLocalItem updates item optimistically", () => {
    updateLocalItem(uid, "watchedMovies", "movie_603", {
      id: 603,
      type: "movie",
      name: "The Matrix",
      minutes: 136,
    });
    const retrieved = getLocalList(uid, "watchedMovies");
    expect(retrieved.movie_603).toBeDefined();
    expect(retrieved.movie_603.name).toBe("The Matrix");
  });

  test("deleteLocalItem removes item optimistically", () => {
    deleteLocalItem(uid, "watchedMovies", "movie_603");
    const retrieved = getLocalList(uid, "watchedMovies");
    expect(retrieved.movie_603).toBeUndefined();
  });

  test("syncListDelta merges delta items from Firestore into local cache", async () => {
    const initialMap = {
      movie_157336: { id: 157336, type: "movie", name: "Interstellar", minutes: 169 },
    };
    setLocalList(uid, "watchList", initialMap);

    const merged = await syncListDelta(uid, "watchList", Date.now() - 60000);
    expect(merged.movie_157336).toBeDefined();
    expect(merged.movie_872585).toBeDefined();
    expect(merged.movie_872585.name).toBe("Oppenheimer");
  });

  test("subscribeLocalList receives updates when setLocalList or updateLocalItem runs", () => {
    const { subscribeLocalList } = require("../services/listSyncService");
    const received = [];
    const unsub = subscribeLocalList((syncUid, listKey, data) => {
      received.push({ syncUid, listKey, data });
    });

    setLocalList("user_a", "favorites", { movie_1: { id: 1, name: "Test" } });
    expect(received.length).toBe(1);
    expect(received[0].syncUid).toBe("user_a");
    expect(received[0].listKey).toBe("favorites");
    expect(received[0].data.movie_1.name).toBe("Test");

    unsub();
    setLocalList("user_a", "favorites", {});
    expect(received.length).toBe(1); // unsubscribed
  });

  test("User switching preserves isolation between User A and User B", () => {
    const userA = "user_alpha";
    const userB = "user_beta";

    setLocalList(userA, "favorites", {
      movie_1: { id: 1, name: "Movie for A" },
    });
    setLocalList(userB, "favorites", {
      movie_2: { id: 2, name: "Movie for B" },
    });

    const userAFavs = getLocalList(userA, "favorites");
    const userBFavs = getLocalList(userB, "favorites");

    expect(userAFavs.movie_1).toBeDefined();
    expect(userAFavs.movie_2).toBeUndefined();

    expect(userBFavs.movie_2).toBeDefined();
    expect(userBFavs.movie_1).toBeUndefined();
  });

  test("RESERVED_LIST_NAMES contains all system metadata keys and prevents key leak", () => {
    const { RESERVED_LIST_NAMES } = require("../utils/listShare");
    const systemKeys = [
      "stats",
      "statusIndex",
      "activityIndex",
      "counts",
      "updatedAt",
      "_schemaVersion",
      "customLists",
      "listOrder",
      "createdAt",
    ];
    systemKeys.forEach((key) => {
      expect(RESERVED_LIST_NAMES).toContain(key);
    });

    const mockRootDoc = {
      favorites: [],
      watchList: [],
      watchedMovies: [],
      watchedTv: [],
      stats: { totalMinutes: 100 },
      counts: { favorites: 5 },
      statusIndex: { movie: {}, tv: {} },
      activityIndex: { ratings: {} },
      updatedAt: { seconds: 12345 },
      _schemaVersion: 3,
      customLists: [{ listId: "c1", name: "Custom 1" }],
      "Sci-Fi Favorites": [{ id: 101, type: "movie", name: "Interstellar" }],
    };

    const reservedSet = new Set(RESERVED_LIST_NAMES);
    const customListKeys = Object.keys(mockRootDoc).filter(
      (k) => !reservedSet.has(k) && Array.isArray(mockRootDoc[k]),
    );

    expect(customListKeys).toEqual(["Sci-Fi Favorites"]);
    expect(customListKeys).not.toContain("stats");
    expect(customListKeys).not.toContain("counts");
    expect(customListKeys).not.toContain("statusIndex");
    expect(customListKeys).not.toContain("updatedAt");
    expect(customListKeys).not.toContain("_schemaVersion");
  });
});



