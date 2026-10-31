// ListStatusContext'in GERÇEK sağlayıcısını react-test-renderer ile çalıştırır;
// yalnız platform/ağ bağımlılıkları (Firestore, oturum, bağlantı, disk) sahte.
// Kanıtladıkları (mock'suz mantık testleri bunları göremez):
//   • ilk indirme kapısı sayaçlara değil "bu cihaza hiç indirildi mi"ye bakar
//   • bekleyen işlem niyeti (bindirme) statusIndex'e biner ve diske YAZILMAZ
//   • sunucu statusIndex'i ile yerel harita ayrışınca yalnız o liste yeniden çekilir,
//     aynı kök sürümünde ikinci kez çekilmez (sonsuz döngü yok)
//   • çevrimdışı açılışta indirilemeyen listeler bağlantı dönünce yeniden denenir

const mockFs = { handlers: {}, collections: {}, getDocsCalls: [], getDocCalls: [], failGetDocs: false };
jest.mock("firebase/firestore", () => ({
  doc: (_db, ...parts) => ({ kind: "doc", path: parts.join("/") }),
  collection: (_db, ...parts) => ({ kind: "col", path: parts.join("/") }),
  query: (ref) => ref,
  where: () => ({}),
  Timestamp: { fromMillis: (ms) => ({ ms }), fromDate: (d) => ({ ms: d.getTime() }) },
  onSnapshot: (ref, next) => {
    mockFs.handlers[ref.path] = next;
    return () => {
      delete mockFs.handlers[ref.path];
    };
  },
  // Sapma onarımı eksik öğeyi belge kimliğiyle tek tek okur (listSyncService.repairListDrift).
  getDoc: async (ref) => {
    mockFs.getDocCalls.push(ref.path);
    const parts = ref.path.split("/");
    const id = parts.pop();
    const value = (mockFs.collections[parts.join("/")] || {})[id];
    return { id, exists: () => value != null, data: () => value };
  },
  getDocs: async (ref) => {
    mockFs.getDocsCalls.push(ref.path);
    if (mockFs.failGetDocs) throw new Error("client is offline");
    const data = mockFs.collections[ref.path] || {};
    const docs = Object.entries(data).map(([id, value]) => ({ id, data: () => value }));
    return { empty: docs.length === 0, docs };
  },
}));
jest.mock("../firebase", () => ({ db: {} }));

const mockSession = { user: { uid: "u0" }, online: true };
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: mockSession.user }),
}));
jest.mock("../context/ConnectivityContext", () => ({
  useConnectivity: () => ({ isOnline: mockSession.online }),
}));

jest.mock("../services/storage", () => ({
  Keys: { listStatus: "listStatus" },
  get: jest.fn(() => null),
  set: jest.fn(),
  getActiveUser: jest.fn(() => null),
}));
jest.mock("../utils/cacheStore", () => {
  const store = new Map();
  const id = (ns, key) => `${ns}::${key}`;
  return {
    setJSON: (ns, key, data) => store.set(id(ns, key), JSON.parse(JSON.stringify(data))),
    getJSON: (ns, key) => (store.has(id(ns, key)) ? store.get(id(ns, key)) : null),
    getAge: (ns, key) => (store.has(id(ns, key)) ? 0 : null),
    remove: (ns, key) => store.delete(id(ns, key)),
  };
});
jest.mock("../services/usageTrackerService", () => ({
  trackFirestoreRead: jest.fn(),
  trackFirestoreWrite: jest.fn(),
  trackFirestoreDelete: jest.fn(),
}));
jest.mock("../services/listItemsService", () => ({
  PREDEFINED_MOVIE_LISTS: ["favorites", "watchList", "watchedMovies"],
  migrateLegacyMovieLists: jest.fn(async () => true),
}));
jest.mock("../services/watchedTvService", () => ({
  clearLegacyWatchedTv: jest.fn(async () => true),
  migrateLegacyShow: jest.fn(async () => true),
  dedupeWatchedTvEntries: (entries) => entries.map(([, data]) => data),
}));

const React = require("react");
const TestRenderer = require("react-test-renderer");
const { act } = TestRenderer;
const { Keys, set: mockStorageSet } = require("../services/storage");
const { ListStatusProvider, useListStatusContext } = require("../context/ListStatusContext");
const {
  beginOverlay,
  failOverlay,
  __resetOverlayForTests,
} = require("../services/libraryOverlay");

global.IS_REACT_ACT_ENVIRONMENT = true;

const LIST_PATHS = (uid) =>
  ["favorites", "watchList", "watchedMovies", "watchedTv"].map((key) => `Lists/${uid}/${key}`);

const serverSnapshot = (data, { pending = false, fromCache = false } = {}) => ({
  exists: () => data != null,
  data: () => data,
  metadata: { fromCache, hasPendingWrites: pending },
});

const flush = async (rounds = 12) => {
  for (let i = 0; i < rounds; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const advance = async (ms) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};

function mount() {
  const ref = { current: null };
  const Probe = () => {
    ref.current = useListStatusContext();
    return null;
  };
  const tree = () => React.createElement(ListStatusProvider, null, React.createElement(Probe));
  let renderer;
  act(() => {
    renderer = TestRenderer.create(tree());
  });
  return {
    ref,
    renderer,
    rerender: () => act(() => renderer.update(tree())),
    unmount: () => act(() => renderer.unmount()),
  };
}

const pushRoot = async (uid, data, options) => {
  await act(async () => {
    mockFs.handlers[`Lists/${uid}`](serverSnapshot(data, options));
  });
  await flush();
};

const getDocsFor = (path) => mockFs.getDocsCalls.filter((entry) => entry === path).length;
const getDocFor = (path) => mockFs.getDocCalls.filter((entry) => entry === path).length;

// react-test-renderer 19 her create()'te kullanımdan kaldırma uyarısı basıyor; testin
// gürültüsü olmasın diye YALNIZ onu süz (diğer console.error'lar görünür kalır).
const realConsoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation((...args) => {
    if (String(args[0]).includes("react-test-renderer is deprecated")) return;
    realConsoleError(...args);
  });
});
afterAll(() => {
  console.error.mockRestore();
});

beforeEach(() => {
  jest.useFakeTimers();
  __resetOverlayForTests();
  mockFs.handlers = {};
  mockFs.collections = {};
  mockFs.getDocsCalls = [];
  mockFs.failGetDocs = false;
  mockSession.online = true;
  mockStorageSet.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("ilk indirme kapısı", () => {
  test("sayaçlar 0 olsa da hiç indirilmemiş dört liste çekilir; sonraki açılışta çekilmez", async () => {
    mockSession.user = { uid: "u-hydrate" };
    mockFs.collections["Lists/u-hydrate/favorites"] = { movie_1: { id: 1, type: "movie", name: "A" } };
    const root = {
      // Sapmış (sıfıra inmiş) sayaç: eski kapı burada listeyi hiç indirmezdi.
      counts: { favorites: 0, watchList: 0, watchedMovies: 0, watchedTv: 0 },
      statusIndex: { movie: { 1: { inFavorites: true } }, tv: {} },
    };

    const first = mount();
    await pushRoot("u-hydrate", root);
    expect(mockFs.getDocsCalls.sort()).toEqual(LIST_PATHS("u-hydrate").sort());
    expect(first.ref.current.favoritesItems).toHaveLength(1);
    first.unmount();

    mockFs.getDocsCalls = [];
    const second = mount();
    await pushRoot("u-hydrate", root);
    // Dört liste de bu cihazda mevcut (boş olanlar dahil): tek sorgu yok.
    expect(mockFs.getDocsCalls).toEqual([]);
    expect(second.ref.current.favoritesItems).toHaveLength(1);
    second.unmount();
  });

  test("çevrimdışı açılışta indirilemeyen listeler bağlantı dönünce yeniden denenir", async () => {
    mockSession.user = { uid: "u-offline" };
    mockSession.online = false;
    mockFs.failGetDocs = true;
    mockFs.collections["Lists/u-offline/favorites"] = { movie_9: { id: 9, type: "movie", name: "Z" } };

    const view = mount();
    await pushRoot("u-offline", { counts: { favorites: 1 }, statusIndex: { movie: {}, tv: {} } });
    expect(view.ref.current.favoritesItems).toHaveLength(0);
    const failedCalls = mockFs.getDocsCalls.length;
    expect(failedCalls).toBeGreaterThan(0);

    mockFs.failGetDocs = false;
    mockSession.online = true;
    view.rerender();
    await flush();
    expect(view.ref.current.favoritesItems).toHaveLength(1);
    view.unmount();
  });
});

describe("bekleyen işlem bindirmesi", () => {
  test("statusIndex'e biner, hata olunca kalkar ve diske YAZILMAZ", async () => {
    mockSession.user = { uid: "u-overlay" };
    const view = mount();
    await pushRoot("u-overlay", { statusIndex: { movie: {}, tv: {} } });

    let token;
    await act(async () => {
      token = beginOverlay("u-overlay", "movie", 550, { inFavorites: true });
    });
    expect(view.ref.current.statusIndex.movie[550].inFavorites).toBe(true);

    // Debounce'lu önbellek yazımı bindirmeyi içermemeli.
    await advance(3000);
    const written = mockStorageSet.mock.calls
      .filter(([key]) => key === Keys.listStatus)
      .map(([, value]) => value.statusIndex);
    expect(written.length).toBeGreaterThan(0);
    written.forEach((index) => expect(index.movie[550]?.inFavorites).not.toBe(true));

    await act(async () => {
      failOverlay(token);
    });
    expect(view.ref.current.statusIndex.movie[550]?.inFavorites).not.toBe(true);
    view.unmount();
  });

  test("bindirme sunucudaki 'true' bayrağını 'false' niyetiyle bastırır", async () => {
    mockSession.user = { uid: "u-overlay2" };
    const view = mount();
    await pushRoot("u-overlay2", {
      statusIndex: { movie: { 7: { inWatchList: true } }, tv: {} },
    });
    expect(view.ref.current.statusIndex.movie[7].inWatchList).toBe(true);
    await act(async () => {
      beginOverlay("u-overlay2", "movie", 7, { inWatchList: false });
    });
    expect(view.ref.current.statusIndex.movie[7].inWatchList).toBe(false);
    view.unmount();
  });
});

describe("sapma onarımı", () => {
  // Gerçek Firestore Timestamp'i gibi: JSON'da görünen alanlar + toMillis.
  // (Yalnız fonksiyon taşıyan sahte nesne iki sürümü AYNI sanır ve snapshot yok sayılır.)
  const stamp = (ms) => ({ seconds: Math.floor(ms / 1000), nanoseconds: 0, toMillis: () => ms });
  const driftRoot = (ms) => ({
    updatedAt: stamp(ms),
    statusIndex: { movie: { 7: { inWatchList: true } }, tv: {} },
  });

  test("sunucuda olup yerelde olmayan öğe YALNIZ kendisi okunarak onarılır; liste yeniden çekilmez, tekrarlanmaz", async () => {
    mockSession.user = { uid: "u-drift" };
    const view = mount();
    await pushRoot("u-drift", driftRoot(1000));
    // İlk indirme: dört liste birer kez.
    expect(getDocsFor("Lists/u-drift/watchList")).toBe(1);

    // Başka cihaz film 7'yi izlenecekler'e eklemiş: sunucu belgesi artık orada.
    mockFs.collections["Lists/u-drift/watchList"] = { movie_7: { id: 7, type: "movie", name: "Yeni" } };
    await advance(3000);
    expect(getDocFor("Lists/u-drift/watchList/movie_7")).toBe(1);
    expect(getDocsFor("Lists/u-drift/watchList")).toBe(1);
    expect(getDocsFor("Lists/u-drift/favorites")).toBe(1);
    expect(view.ref.current.watchListItems).toHaveLength(1);

    // Aynı kök sürümü tekrar gelse de (tutarlıyken) yeni okuma yok.
    await pushRoot("u-drift", driftRoot(1000));
    await advance(3000);
    expect(getDocFor("Lists/u-drift/watchList/movie_7")).toBe(1);
    expect(getDocsFor("Lists/u-drift/watchList")).toBe(1);
    view.unmount();
  });

  test("başka cihazda silinen öğe yerelden okumasız düşer", async () => {
    mockSession.user = { uid: "u-del" };
    mockFs.collections["Lists/u-del/watchList"] = { movie_7: { id: 7, type: "movie", name: "Eski" } };
    const view = mount();
    await pushRoot("u-del", driftRoot(1000));
    expect(view.ref.current.watchListItems).toHaveLength(1);
    const reads = mockFs.getDocsCalls.length + mockFs.getDocCalls.length;

    await pushRoot("u-del", {
      updatedAt: stamp(2000),
      statusIndex: { movie: { 7: { inWatchList: false } }, tv: {} },
    });
    await advance(3000);
    expect(view.ref.current.watchListItems).toHaveLength(0);
    expect(mockFs.getDocsCalls.length + mockFs.getDocCalls.length).toBe(reads);
    view.unmount();
  });

  test("yeniden çekmeyle kapanmayan sapma aynı sürümde döngüye girmez, yeni sürümde bir kez daha dener", async () => {
    mockSession.user = { uid: "u-ghost" };
    const view = mount();
    await pushRoot("u-ghost", driftRoot(1000));
    expect(getDocsFor("Lists/u-ghost/watchList")).toBe(1);

    // Sunucuda belge YOK ama bayrak true (eski bir hatadan kalma hayalet bayrak): tek belge
    // okunur, bulunamayınca eski kimlik biçimi ihtimaline karşı liste bir kez tam çekilir.
    await advance(3000);
    expect(getDocFor("Lists/u-ghost/watchList/movie_7")).toBe(1);
    expect(getDocsFor("Lists/u-ghost/watchList")).toBe(2);
    await advance(10000);
    await advance(10000);
    expect(getDocsFor("Lists/u-ghost/watchList")).toBe(2);

    await pushRoot("u-ghost", driftRoot(2000));
    await advance(3000);
    expect(getDocsFor("Lists/u-ghost/watchList")).toBe(3);
    view.unmount();
  });

  test("yerel yazım yankısı (hasPendingWrites) ve bekleyen bindirme varken denetim yapılmaz", async () => {
    mockSession.user = { uid: "u-echo" };
    const view = mount();
    await pushRoot("u-echo", { statusIndex: { movie: {}, tv: {} } });
    const baseline = mockFs.getDocsCalls.length;

    await pushRoot("u-echo", driftRoot(1000), { pending: true });
    await advance(5000);
    expect(mockFs.getDocsCalls.length).toBe(baseline);

    // Sunucu onaylı sürüm gelir ama işlem hâlâ sürüyor (bindirme açık).
    await act(async () => {
      beginOverlay("u-echo", "movie", 7, { inWatchList: true });
    });
    await pushRoot("u-echo", driftRoot(1000));
    await advance(5000);
    expect(mockFs.getDocsCalls.length).toBe(baseline);
    view.unmount();
  });
});
