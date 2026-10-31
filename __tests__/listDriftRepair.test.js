// Sapan liste tam yeniden çekilmez, onarılır (maliyet analizi Aşama 1): fazlalar yerelden silinir,
// yalnız eksik öğeler okunur. utils/listStatusIndex.planDriftRepair + services/listSyncService.repairListDrift.
jest.mock("../firebase", () => ({ db: {}, app: {} }));

const mockServer = new Map(); // "listKey/docId" → data
jest.mock("firebase/firestore", () => ({
  doc: jest.fn((db, ...path) => ({ path: path.join("/"), id: path[path.length - 1] })),
  getDoc: jest.fn(async (ref) => {
    const key = ref.path.split("/").slice(2).join("/");
    const data = mockServer.get(key);
    return { id: ref.id, exists: () => data != null, data: () => data };
  }),
  collection: jest.fn((db, ...path) => ({ path: path.join("/") })),
  getDocs: jest.fn(async (ref) => {
    const listKey = ref.path.split("/")[2];
    const docs = [...mockServer.entries()]
      .filter(([key]) => key.startsWith(`${listKey}/`))
      .map(([key, data]) => ({ id: key.split("/")[1], data: () => data }));
    return { empty: docs.length === 0, docs };
  }),
  query: jest.fn(),
  where: jest.fn(),
  Timestamp: { fromMillis: jest.fn(), fromDate: jest.fn() },
}));

const firestore = require("firebase/firestore");
const { planDriftRepair } = require("../utils/listStatusIndex");
const {
  DRIFT_REPAIR_MAX_DOCS,
  getLocalList,
  setLocalList,
  repairListDrift,
} = require("../services/listSyncService");

const film = (id) => ({ id, type: "movie", name: `F${id}` });

beforeEach(() => {
  mockServer.clear();
  firestore.getDoc.mockClear();
  firestore.getDocs.mockClear();
});

describe("planDriftRepair", () => {
  test("eksik ve fazla öğeleri ayırır; bayraksız eski kayıt sapma sayılmaz", () => {
    const index = {
      movie: {
        1: { inWatchList: true },
        2: { inWatchList: false },
        3: { inWatchList: true },
        4: {},
      },
    };
    const local = { movie_2: film(2), movie_3: film(3), movie_4: film(4) };
    expect(planDriftRepair(index, "watchList", local)).toEqual({ missing: ["movie_1"], extra: ["movie_2"] });
  });

  test("izlenen diziler yalnız tv kovasına bakar; eski çıplak anahtar da fazlaya girer", () => {
    const index = { movie: { 7: { isWatched: true } }, tv: { 9: { isWatched: false } } };
    const local = { 9: { id: 9, type: "tv" }, tv_9: { id: 9, type: "tv" } };
    expect(planDriftRepair(index, "watchedTv", local)).toEqual({ missing: [], extra: ["9", "tv_9"] });
  });

  test("tanınmayan liste ya da veri → null", () => {
    expect(planDriftRepair({ movie: {} }, "customItems", {})).toBeNull();
    expect(planDriftRepair(null, "favorites", {})).toBeNull();
  });
});

describe("repairListDrift", () => {
  test("yalnız eksik öğeleri okur, fazlayı yerelden siler; tam liste okunmaz", async () => {
    setLocalList("u1", "favorites", { movie_2: film(2), movie_5: film(5) });
    mockServer.set("favorites/movie_1", film(1));
    mockServer.set("favorites/movie_5", film(5));

    const map = await repairListDrift("u1", "favorites", { missing: ["movie_1"], extra: ["movie_2"] });

    expect(firestore.getDoc).toHaveBeenCalledTimes(1);
    expect(firestore.getDocs).not.toHaveBeenCalled();
    expect(Object.keys(map).sort()).toEqual(["movie_1", "movie_5"]);
    expect(Object.keys(getLocalList("u1", "favorites")).sort()).toEqual(["movie_1", "movie_5"]);
  });

  test("yalnız silme gerekiyorsa hiç okuma yapılmaz", async () => {
    setLocalList("u1", "watchList", { movie_2: film(2) });
    const map = await repairListDrift("u1", "watchList", { missing: [], extra: ["movie_2"] });
    expect(firestore.getDoc).not.toHaveBeenCalled();
    expect(map).toEqual({});
  });

  test("beklenen kimlikte belge yoksa (eski biçim) tam çekime düşer", async () => {
    setLocalList("u1", "watchedTv", {});
    mockServer.set("watchedTv/77", { id: 77, type: "tv" });
    const map = await repairListDrift("u1", "watchedTv", { missing: ["tv_77"], extra: [] });
    expect(firestore.getDocs).toHaveBeenCalledTimes(1);
    expect(Object.keys(map)).toEqual(["77"]);
  });

  test("çok eksik varsa ya da plan yoksa tam çekim", async () => {
    const many = Array.from({ length: DRIFT_REPAIR_MAX_DOCS + 1 }, (_, i) => `movie_${i}`);
    await repairListDrift("u1", "favorites", { missing: many, extra: [] });
    await repairListDrift("u1", "favorites", null);
    expect(firestore.getDoc).not.toHaveBeenCalled();
    expect(firestore.getDocs).toHaveBeenCalledTimes(2);
  });
});
