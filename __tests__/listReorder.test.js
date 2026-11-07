// __tests__/listReorder.test.js
//
// Liste içinde içerik taşıma ("Sırayı değiştir"). Kullanıcı bildirimi: taşıma
// çalışmıyordu. Nedenler ve kilitler:
//   1. Sıra yalnız buluta yazılıyordu; listeler YEREL haritadan okunduğu için ekran
//      bir sonraki tazelemede / yeniden açılışta eski sıraya dönüyordu
//      → reorderList / reorderWatchedShows yerel `listOrder`u da yazar.
//   2. Yalnız from…to aralığı yazılıyordu; silinenlerin bıraktığı boşluklu
//      `listOrder` değerlerinde aralık dışı öğe sona kayıyordu → listOrderWrites.
//   3. Ada/tarihe/süreye göre sıralıyken taşıma görünmüyordu → taşıma kapalı + ipucu.

const mockBatches = [];

jest.mock("../firebase", () => ({ db: {}, app: {} }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_db, ...path) => ({ path: path.join("/") })),
  collection: jest.fn((_db, ...path) => ({ path: path.join("/") })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  onSnapshot: jest.fn(() => () => {}),
  runTransaction: jest.fn(),
  writeBatch: jest.fn(() => {
    const batch = { ops: [], committed: false };
    batch.set = jest.fn((ref, data, opts) => batch.ops.push({ op: "set", path: ref.path, data, opts }));
    batch.update = jest.fn((ref, data) => batch.ops.push({ op: "update", path: ref.path, data }));
    batch.delete = jest.fn();
    batch.commit = jest.fn(async () => {
      batch.committed = true;
    });
    mockBatches.push(batch);
    return batch;
  }),
  serverTimestamp: jest.fn(() => "TS"),
  increment: jest.fn((n) => n),
  deleteField: jest.fn(() => "DEL"),
  arrayUnion: jest.fn((...args) => args),
  Timestamp: { fromMillis: jest.fn(), fromDate: jest.fn() },
}));

const fs = require("fs");
const path = require("path");
const { listOrderWrites, sortItemsByListOrder } = require("../utils/listOrder");
const { getLocalList, setLocalList } = require("../services/listSyncService");
const { reorderList } = require("../services/listItemsService");
const { reorderWatchedShows } = require("../services/watchedTvService");
const { reorderSharedListItems } = require("../services/sharedListsService");

const uid = "u_reorder";
const ops = () => mockBatches.flatMap((b) => b.ops);
const move = (items, from, to) => {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

beforeEach(() => {
  mockBatches.length = 0;
});

describe("listOrderWrites", () => {
  test("bitişik sırada yalnız taşınan aralık yazılır", () => {
    const items = [0, 1, 2, 3, 4].map((n) => ({ id: n, listOrder: n }));
    const writes = listOrderWrites(move(items, 3, 1));
    expect(writes.map(({ item, index }) => [item.id, index])).toEqual([
      [3, 1],
      [1, 2],
      [2, 3],
    ]);
  });

  test("boşluklu eski değerler: aralık dışı öğe de normalize olur, sıra korunur", () => {
    // Baştaki üç öğe silinmiş: değerler 3,4,5. Eski kod 2→1 taşımasında yalnız
    // 1..2'yi yazıyordu; ilk öğe 3'te kalıp listenin SONUNA kayıyordu.
    const items = [
      { id: "a", listOrder: 3 },
      { id: "b", listOrder: 4 },
      { id: "c", listOrder: 5 },
    ];
    const ordered = move(items, 2, 1); // a, c, b
    const writes = listOrderWrites(ordered);
    const after = ordered.map((it) => {
      const w = writes.find((x) => x.item === it);
      return { ...it, listOrder: w ? w.index : it.listOrder };
    });
    expect(sortItemsByListOrder(after).map((it) => it.id)).toEqual(["a", "c", "b"]);
  });

  test("listOrder'ı olmayan (eski) öğeler de yazılır; id'siz öğe atlanır", () => {
    const writes = listOrderWrites([{ id: 1 }, { id: 2, listOrder: 1 }, { name: "bozuk" }]);
    expect(writes.map(({ item, index }) => [item.id, index])).toEqual([[1, 0]]);
  });
});

describe("öntanımlı liste (Favoriler / İzleme / İzlenen filmler)", () => {
  test("bulut + YEREL harita aynı sırayı alır; ekranın sıralaması yeni sırayı gösterir", async () => {
    const local = {
      movie_1: { id: 1, type: "movie", name: "A", listOrder: 0 },
      movie_2: { id: 2, type: "movie", name: "B", listOrder: 1 },
      tv_3: { id: 3, type: "tv", name: "C", listOrder: 2 },
    };
    setLocalList(uid, "watchList", local);
    const screen = sortItemsByListOrder(Object.values(local));

    await reorderList(uid, "watchList", move(screen, 2, 0));

    expect(ops()).toEqual([
      { op: "set", path: "Lists/u_reorder/watchList/tv_3", data: { listOrder: 0, updatedAt: "TS" }, opts: { merge: true } },
      { op: "set", path: "Lists/u_reorder/watchList/movie_1", data: { listOrder: 1, updatedAt: "TS" }, opts: { merge: true } },
      { op: "set", path: "Lists/u_reorder/watchList/movie_2", data: { listOrder: 2, updatedAt: "TS" }, opts: { merge: true } },
    ]);
    const after = getLocalList(uid, "watchList");
    expect(sortItemsByListOrder(Object.values(after)).map((it) => it.name)).toEqual(["C", "A", "B"]);
    // Diğer alanlar korunur.
    expect(after.tv_3).toMatchObject({ id: 3, type: "tv", name: "C" });
  });

  test("bulut yazımı düşerse yerel harita DEĞİŞMEZ (ekran eski sıraya döner)", async () => {
    const local = {
      movie_1: { id: 1, type: "movie", listOrder: 0 },
      movie_2: { id: 2, type: "movie", listOrder: 1 },
    };
    setLocalList(uid, "favorites", local);
    const { writeBatch } = require("firebase/firestore");
    writeBatch.mockImplementationOnce(() => ({
      set: jest.fn(),
      commit: jest.fn(async () => {
        throw new Error("offline");
      }),
    }));

    await expect(
      reorderList(uid, "favorites", move(Object.values(local), 1, 0)),
    ).rejects.toThrow("offline");
    expect(getLocalList(uid, "favorites")).toEqual(local);
  });
});

test("izlenen diziler: belge + yerel harita güncellenir", async () => {
  const local = {
    tv_10: { id: 10, name: "X", listOrder: 0 },
    tv_11: { id: 11, name: "Y", listOrder: 1 },
  };
  setLocalList(uid, "watchedTv", local);

  await reorderWatchedShows(uid, move(Object.values(local), 1, 0));

  expect(ops()).toEqual([
    { op: "update", path: "Lists/u_reorder/watchedTv/tv_11", data: { listOrder: 0, updatedAt: "TS" } },
    { op: "update", path: "Lists/u_reorder/watchedTv/tv_10", data: { listOrder: 1, updatedAt: "TS" } },
  ]);
  expect(getLocalList(uid, "watchedTv").tv_11.listOrder).toBe(0);
  expect(getLocalList(uid, "watchedTv").tv_10.listOrder).toBe(1);
});

test("ortak liste: boşluklu değerler normalize olur, yalnız listOrder yazılır (kural)", async () => {
  const items = [
    { id: 1, type: "movie", listOrder: 4 },
    { id: 2, type: "movie", listOrder: 7 },
    { id: 3, type: "tv", listOrder: 9 },
  ];

  await reorderSharedListItems("L1", move(items, 2, 1));

  expect(ops()).toEqual([
    { op: "update", path: "SharedLists/L1/items/movie_1", data: { listOrder: 0 } },
    { op: "update", path: "SharedLists/L1/items/tv_3", data: { listOrder: 1 } },
    { op: "update", path: "SharedLists/L1/items/movie_2", data: { listOrder: 2 } },
  ]);
});

test("ada/tarihe göre sıralıyken taşıma kapalı ve ipucu gösterilir (iki ekranda da)", () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  expect(read("screens/lists/ListsScreen.js")).toMatch(/canMove=\{!sortActive\}/);
  expect(read("screens/lists/SharedListScreen.js")).toMatch(/canMove=\{canReorder && sortBy === "default"\}/);
  for (const lang of ["tr", "en", "es", "pt", "de"]) {
    const t = require(`../translations/${lang}.json`);
    expect(t.autoI18n.tasima_yalniz_liste_sirasinda).toBeTruthy();
  }
});
