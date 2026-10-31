// CineSwipe "izleme listem" destesi: liste cihazda varsa Firestore okunmaz (maliyet analizi Aşama 1).
jest.mock("../firebase", () => ({ db: {}, app: {} }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  deleteDoc: jest.fn(),
  collection: jest.fn((db, ...path) => ({ path: path.join("/") })),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(async () => ({
    docs: [{ id: "movie_9", data: () => ({ id: 9, title: "Uzak", imagePath: "/u.jpg" }) }],
  })),
  onSnapshot: jest.fn(() => () => {}),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(),
}));

const mockLocal = { has: true, map: {} };
jest.mock("../services/listSyncService", () => ({
  hasLocalList: () => mockLocal.has,
  getLocalList: () => mockLocal.map,
}));

const firestore = require("firebase/firestore");
const { fetchSwipeDeckPage } = require("../services/cineswipe/cineswipeService");

beforeEach(() => firestore.getDocs.mockClear());

test("yerel liste varken Firestore okunmaz, kartlar yerelden gelir", async () => {
  mockLocal.has = true;
  mockLocal.map = {
    movie_1: { id: 1, title: "Film", imagePath: "/f.jpg" },
    tv_2: { id: 2, name: "Dizi", type: "tv", imagePath: "/d.jpg" },
  };
  const { items, hasMore } = await fetchSwipeDeckPage({ category: "watchlist", userId: "u1", mediaType: "all" });
  expect(firestore.getDocs).not.toHaveBeenCalled();
  expect(items.map((c) => c.id).sort()).toEqual([1, 2]);
  expect(hasMore).toBe(false);

  const tvOnly = await fetchSwipeDeckPage({ category: "watchlist", userId: "u1", mediaType: "tv" });
  expect(tvOnly.items.map((c) => c.id)).toEqual([2]);
});

test("yerel kopya henüz yoksa Firestore'a düşülür", async () => {
  mockLocal.has = false;
  const { items } = await fetchSwipeDeckPage({ category: "watchlist", userId: "u1" });
  expect(firestore.getDocs).toHaveBeenCalledTimes(1);
  expect(items.map((c) => c.id)).toEqual([9]);
});
