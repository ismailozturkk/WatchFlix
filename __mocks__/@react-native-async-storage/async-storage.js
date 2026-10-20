// __mocks__/@react-native-async-storage/async-storage.js
//
// Ortak AsyncStorage taklidi. Kök `__mocks__` klasöründeki node_modules
// taklitleri jest tarafından OTOMATİK kullanılır.
//
// AsyncStorage artık yalnız iki yerde yaşıyor: tek seferlik göç (migration.js)
// ve Firebase Auth köprüsü (authPersistence.js). Bu taklit ikisini de test
// edebilmek için tam yüzeyi sunuyor.

const store = new Map();

const AsyncStorageMock = {
  getItem: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
  setItem: jest.fn(async (key, value) => {
    store.set(key, String(value));
  }),
  removeItem: jest.fn(async (key) => {
    store.delete(key);
  }),
  getAllKeys: jest.fn(async () => Array.from(store.keys())),
  multiGet: jest.fn(async (keys) =>
    keys.map((key) => [key, store.has(key) ? store.get(key) : null]),
  ),
  multiSet: jest.fn(async (pairs) => {
    pairs.forEach(([key, value]) => store.set(key, String(value)));
  }),
  multiRemove: jest.fn(async (keys) => {
    keys.forEach((key) => store.delete(key));
  }),
  mergeItem: jest.fn(async () => {}),
  clear: jest.fn(async () => {
    store.clear();
  }),

  /* -------- test yardımcıları (gerçek API'de yok) -------- */
  __store: store,
  __seed(entries) {
    Object.entries(entries).forEach(([key, value]) => store.set(key, value));
  },
  __reset() {
    store.clear();
    Object.values(AsyncStorageMock).forEach((fn) => {
      if (typeof fn?.mockClear === "function") fn.mockClear();
    });
  },
};

export default AsyncStorageMock;
