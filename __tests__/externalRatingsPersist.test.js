// Harici puanlar cihazda 7 gün tutulur: yeni oturumda aynı başlık Functions'a gitmeden gelir.
const mockStore = new Map();
jest.mock("../utils/cacheStore", () => ({
  getJSON: (ns, key, { maxAge } = {}) => {
    const entry = mockStore.get(`${ns}/${key}`);
    if (!entry || (maxAge && Date.now() - entry.t > maxAge)) return null;
    return entry.v;
  },
  setJSON: (ns, key, v) => mockStore.set(`${ns}/${key}`, { t: Date.now(), v }),
  clearNamespace: () => mockStore.clear(),
}));
jest.mock("../firebase", () => ({ fns: {} }), { virtual: true });
const mockCall = jest.fn();
jest.mock("firebase/functions", () => ({
  httpsCallable: (_fns, name) => (payload) => mockCall(name, payload),
}));

const loadFresh = () => {
  let mod;
  jest.isolateModules(() => {
    mod = require("../services/externalRatings");
  });
  return mod;
};

beforeEach(() => {
  mockStore.clear();
  mockCall.mockReset();
});

test("kesin sonuç yeni oturumda cihazdan gelir", async () => {
  mockCall.mockResolvedValue({ data: { found: true, imdbRating: 8.4 } });
  expect(await loadFresh().fetchTitleRatings("tt1")).toEqual({ found: true, imdbRating: 8.4 });
  expect(await loadFresh().fetchTitleRatings("tt1")).toEqual({ found: true, imdbRating: 8.4 });
  expect(mockCall).toHaveBeenCalledTimes(1);
});

test("geçici sonuç (kota) cihaza yazılmaz", async () => {
  mockCall.mockResolvedValue({ data: { found: false, reason: "quota" } });
  await loadFresh().fetchTitleRatings("tt2");
  await loadFresh().fetchTitleRatings("tt2");
  expect(mockCall).toHaveBeenCalledTimes(2);
});
