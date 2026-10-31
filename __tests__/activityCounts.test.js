// Profil "Etkinliklerim" sayıları: dört koleksiyonu dinlemek yerine sayım sorgusu (activityService).
jest.mock("../firebase", () => ({ db: {} }));
const mockCounts = { myRatings: 12, myComments: 3, likedPosts: 40, bookmarks: 5 };
jest.mock("firebase/firestore", () => ({
  collection: jest.fn((db, ...path) => ({ sub: path[path.length - 1] })),
  getCountFromServer: jest.fn(async (ref) => {
    if (mockCounts[ref.sub] instanceof Error) throw mockCounts[ref.sub];
    return { data: () => ({ count: mockCounts[ref.sub] }) };
  }),
  query: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
}));
jest.mock("../services/usageTrackerService", () => ({ trackFirestoreRead: jest.fn() }));

const firestore = require("firebase/firestore");
const {
  ACTIVITY_COUNTS_MIN_INTERVAL_MS,
  fetchMyActivityCounts,
  peekMyActivityCounts,
} = require("../services/activityService");

test("dört sayı sayım sorgusuyla gelir; kısa sürede tekrar sorulursa ağa gidilmez", async () => {
  let t = 1000;
  const now = () => t;
  expect(peekMyActivityCounts("u1")).toBeNull();
  const counts = await fetchMyActivityCounts("u1", { now });
  expect(counts).toEqual({ ratings: 12, comments: 3, likes: 40, bookmarks: 5 });
  expect(firestore.getCountFromServer).toHaveBeenCalledTimes(4);

  t += ACTIVITY_COUNTS_MIN_INTERVAL_MS - 1;
  await fetchMyActivityCounts("u1", { now });
  expect(firestore.getCountFromServer).toHaveBeenCalledTimes(4);
  expect(peekMyActivityCounts("u1")).toEqual(counts);

  t += 2;
  mockCounts.myRatings = 13;
  expect((await fetchMyActivityCounts("u1", { now })).ratings).toBe(13);
  expect(firestore.getCountFromServer).toHaveBeenCalledTimes(8);
});

test("okunamayan sayı son bilinen değerde kalır", async () => {
  mockCounts.likedPosts = new Error("offline");
  const counts = await fetchMyActivityCounts("u1", { force: true });
  expect(counts.likes).toBe(40);
  expect(counts.ratings).toBe(13);
});
