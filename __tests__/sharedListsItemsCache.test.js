// Ortak liste öğeleri canlı dinlenmez: liste damgası (updatedAt) değişince o liste bir kez okunur,
// damga aynıysa cihaz önbelleği (context/SharedListsContext.js, maliyet analizi Aşama 2).
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

const mockStore = new Map();
jest.mock("../utils/cacheStore", () => ({
  getJSON: (ns, key, { maxAge } = {}) => {
    const entry = mockStore.get(`${ns}/${key}`);
    if (!entry || (maxAge && Date.now() - entry.t > maxAge)) return null;
    return entry.v;
  },
  setJSON: (ns, key, v) => mockStore.set(`${ns}/${key}`, { t: Date.now(), v }),
}));

const mockSvc = { emitLists: null, changed: new Set(), server: {} };
const mockFetch = jest.fn(async (listId) => mockSvc.server[listId] || []);
jest.mock("../services/sharedListsService", () => ({
  subscribeToMySharedLists: (_uid, cb) => {
    mockSvc.emitLists = cb;
    return () => {};
  },
  fetchSharedListItems: (...args) => mockFetch(...args),
  onSharedListItemsChanged: (fn) => {
    mockSvc.changed.add(fn);
    return () => mockSvc.changed.delete(fn);
  },
}));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../hooks/useStartupGate", () => ({ __esModule: true, default: () => true }));
jest.mock("../hooks/useAppActive", () => ({ __esModule: true, default: () => true }));

const { SharedListsProvider, useSharedLists } = require("../context/SharedListsContext");

let latest = null;
function Probe() {
  latest = useSharedLists();
  return null;
}
const ts = (ms) => ({ seconds: ms / 1000, nanoseconds: 0, toMillis: () => ms });
const list = (id, ms) => ({ id, name: id, updatedAt: ts(ms) });
const item = (id) => ({ key: `movie_${id}`, id, type: "movie" });

async function mount() {
  let tree;
  await act(async () => {
    tree = create(
      <SharedListsProvider>
        <Probe />
      </SharedListsProvider>,
    );
  });
  return tree;
}
const emit = (lists) => act(async () => mockSvc.emitLists(lists));
const fetchesFor = (id) => mockFetch.mock.calls.filter(([listId]) => listId === id).length;

beforeEach(() => {
  mockStore.clear();
  mockFetch.mockClear();
  mockSvc.server = { a: [item(1)], b: [item(2)] };
});

test("ilk açılışta her liste bir kez okunur; aynı damga tekrar gelince okuma yok", async () => {
  const tree = await mount();
  await emit([list("a", 1000), list("b", 1000)]);
  expect(fetchesFor("a")).toBe(1);
  expect(fetchesFor("b")).toBe(1);
  expect(latest.sharedListIndex.movie).toEqual({ 1: true, 2: true });

  await emit([list("a", 1000), list("b", 1000)]);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  act(() => tree.unmount());
});

test("damgası değişen liste yalnız kendisi yeniden okunur", async () => {
  const tree = await mount();
  await emit([list("a", 1000), list("b", 1000)]);
  mockSvc.server.a = [item(1), item(3)];
  await emit([list("a", 2000), list("b", 1000)]);
  expect(fetchesFor("a")).toBe(2);
  expect(fetchesFor("b")).toBe(1);
  expect(latest.sharedListIndex.movie).toEqual({ 1: true, 2: true, 3: true });
  act(() => tree.unmount());
});

test("yeni oturumda damgalar aynıysa hiç okuma yapılmaz", async () => {
  let tree = await mount();
  await emit([list("a", 1000), list("b", 1000)]);
  act(() => tree.unmount());
  mockFetch.mockClear();

  tree = await mount();
  await emit([list("a", 1000), list("b", 1000)]);
  expect(mockFetch).not.toHaveBeenCalled();
  expect(latest.sharedListIndex.movie).toEqual({ 1: true, 2: true });
  act(() => tree.unmount());
});

test("bu cihazdaki ekleme damga değişmese de o listeyi yeniden okutur", async () => {
  const tree = await mount();
  await emit([list("a", 1000), list("b", 1000)]);
  mockSvc.server.b = [item(2), item(4)];
  await act(async () => mockSvc.changed.forEach((fn) => fn("b")));
  expect(fetchesFor("b")).toBe(2);
  expect(latest.sharedListIndex.movie[4]).toBe(true);
  act(() => tree.unmount());
});

test("üyelikten çıkılan liste indeksten düşer", async () => {
  const tree = await mount();
  await emit([list("a", 1000), list("b", 1000)]);
  await emit([list("a", 1000)]);
  expect(latest.sharedListIndex.movie).toEqual({ 1: true });
  act(() => tree.unmount());
});
