// Arkadaş profili liste önbelleği: kök damga aynıysa koleksiyonlar yeniden okunmaz.
const mockStore = new Map();
jest.mock("../utils/cacheStore", () => ({
  getJSON: (ns, key, { maxAge } = {}) => {
    const entry = mockStore.get(`${ns}/${key}`);
    if (!entry) return null;
    if (maxAge && Date.now() - entry.t > maxAge) return null;
    return entry.v;
  },
  setJSON: (ns, key, v) => mockStore.set(`${ns}/${key}`, { t: Date.now(), v }),
}));

const {
  FRIEND_LISTS_MAX_AGE,
  listsRootStamp,
  readFriendLists,
  writeFriendLists,
} = require("../utils/friendListsCache");

const lists = { movies: [{ id: 1 }], shows: [], favorites: [], watchList: [], customItems: [] };

beforeEach(() => {
  mockStore.clear();
  jest.useRealTimers();
});

test("kök damgası Timestamp, {seconds} ya da yok", () => {
  expect(listsRootStamp({ updatedAt: { toMillis: () => 1234 } })).toBe(1234);
  expect(listsRootStamp({ updatedAt: { seconds: 5 } })).toBe(5000);
  expect(listsRootStamp({})).toBe(0);
  expect(listsRootStamp(null)).toBe(0);
});

test("aynı damgada önbellek döner, damga değişince geçersiz", () => {
  writeFriendLists("f1", 1000, lists);
  expect(readFriendLists("f1", 1000)).toEqual(lists);
  expect(readFriendLists("f1", 2000)).toBeNull();
  expect(readFriendLists("f2", 1000)).toBeNull();
});

test("damga aynı kalsa da en fazla bir gün tutulur", () => {
  jest.useFakeTimers({ now: 0 });
  writeFriendLists("f1", 1000, lists);
  jest.setSystemTime(FRIEND_LISTS_MAX_AGE + 1);
  expect(readFriendLists("f1", 1000)).toBeNull();
});
