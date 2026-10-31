// Aşama 3 istemcisi: liderlik anlık görüntüsü (services/boardSnapshots.js) ve Top 100 sayaçlarının
// CDN kopyası (services/top100Service.js). Sunucu: functions/publicBoards.js.
const mockSnapshots = new Map(); // boardId → belge verisi
const mockCallable = jest.fn();
const mockQueries = [];
let mockSnapshotDenied = false;

jest.mock("../firebase", () => ({ db: {}, fns: {} }));
jest.mock("firebase/firestore", () => ({
  doc: (_db, ...path) => ({ path: path.join("/") }),
  collection: (_db, ...path) => ({ path: path.join("/") }),
  query: (col) => col,
  orderBy: () => ({}),
  limit: () => ({}),
  increment: () => ({}),
  writeBatch: () => ({}),
  setDoc: jest.fn(),
  getDoc: async (ref) => {
    if (mockSnapshotDenied) throw new Error("permission-denied");
    const id = ref.path.split("/").pop();
    const data = mockSnapshots.get(id);
    return { exists: () => data != null, data: () => data };
  },
  getDocs: async (col) => {
    mockQueries.push(col.path);
    const docs = [{ id: "movie_9", data: () => ({ count: 4, score: 9, uid: "q1" }) }];
    return { docs, forEach: (fn) => docs.forEach(fn) };
  },
}));
jest.mock("firebase/functions", () => ({
  httpsCallable: (_fns, name) => (payload) => mockCallable(name, payload),
}));
const mockAxiosGet = jest.fn();
jest.mock("axios", () => ({ __esModule: true, default: { get: (...args) => mockAxiosGet(...args) } }));
jest.mock("../services/sceneGameService", () => ({
  fetchLeaderboard: jest.fn(async () => [{ uid: "s1", bestScore: 1 }]),
}));

const { BOARD_SNAPSHOT_TTL_MS, readBoardSnapshot } = require("../services/boardSnapshots");
const { __clearBoardCache, fetchGameBoard } = require("../services/gameLeaderboards");
const { TOP100_CDN_URL, fetchTop100Counters, parseTop100CdnBody } = require("../services/top100Service");

const entry = (id, score) => ({ id, data: { uid: id, score, displayNameSnapshot: id } });

beforeEach(() => {
  mockSnapshots.clear();
  mockCallable.mockReset();
  mockQueries.length = 0;
  mockSnapshotDenied = false;
  mockAxiosGet.mockReset();
  __clearBoardCache();
});

describe("readBoardSnapshot", () => {
  test("taze belge varsa callable çağrılmaz", async () => {
    mockSnapshots.set("quick_blur", { entries: [entry("a", 5)], builtAt: 1000 });
    const out = await readBoardSnapshot("quick_blur", { now: () => 1000 + BOARD_SNAPSHOT_TTL_MS - 1 });
    expect(out).toEqual([entry("a", 5)]);
    expect(mockCallable).not.toHaveBeenCalled();
  });

  test("bayat ya da yoksa sunucu yeniden kurar", async () => {
    mockSnapshots.set("quick_blur", { entries: [], builtAt: 0 });
    mockCallable.mockResolvedValue({ data: { entries: [entry("b", 7)], builtAt: 1 } });
    expect(await readBoardSnapshot("quick_blur", { now: () => BOARD_SNAPSHOT_TTL_MS })).toEqual([entry("b", 7)]);
    expect(mockCallable).toHaveBeenCalledWith("getBoardSnapshot", { boardId: "quick_blur" });
  });

  test("kural/fonksiyon yayında değilse null (çağıran eski sorguya düşer)", async () => {
    mockSnapshotDenied = true;
    expect(await readBoardSnapshot("quick_blur")).toBeNull();
    mockSnapshotDenied = false;
    mockCallable.mockRejectedValue(new Error("not-found"));
    expect(await readBoardSnapshot("quick_blur")).toBeNull();
  });
});

describe("oyun tablosu", () => {
  test("anlık görüntüden satır kurulur, tablo sorgulanmaz", async () => {
    mockSnapshots.set("quick_blur", { entries: [entry("a", 5)], builtAt: Date.now() });
    const rows = await fetchGameBoard("blur");
    expect(rows[0]).toMatchObject({ uid: "a", bestScore: 5, displayName: "a" });
    expect(mockQueries).toEqual([]);
  });

  test("anlık görüntü yoksa eskisi gibi tablo okunur", async () => {
    mockSnapshotDenied = true;
    const rows = await fetchGameBoard("blur");
    expect(mockQueries).toEqual(["GameLeaderboards/quick_blur/entries"]);
    expect(rows[0]).toMatchObject({ uid: "q1", bestScore: 9 });
  });
});

describe("Top 100 sayaçları", () => {
  test("CDN yanıtı geçerliyse Firestore okunmaz; bozuk anahtarlar düşer", async () => {
    mockAxiosGet.mockResolvedValue({ data: { counters: { movie_1: { count: 3 }, bozuk: { count: 9 } } } });
    expect(await fetchTop100Counters()).toEqual({ movie_1: { count: 3 } });
    expect(mockAxiosGet).toHaveBeenCalledWith(TOP100_CDN_URL, expect.any(Object));
    expect(mockQueries).toEqual([]);
  });

  test("CDN ulaşılamaz ya da biçim bozuksa Firestore'a düşer", async () => {
    mockAxiosGet.mockRejectedValue(new Error("ağ"));
    expect(await fetchTop100Counters()).toEqual({ movie_9: { count: 4 } });
    expect(mockQueries).toEqual(["Top100Hype"]);
    expect(parseTop100CdnBody({ counters: [] })).toBeNull();
    expect(parseTop100CdnBody(null)).toBeNull();
  });
});
