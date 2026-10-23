// Firestore bellek önbelleği LRU olmalı (firebase.js).
//
// Bozulursa (ör. biri `getFirestore(app)`a geri dönerse): varsayılan "eager"
// önbellek, dinleyici kapanınca belgeleri ve devam token'ını atar — sohbete her
// dönüş sunucu beklenerek sıfırdan okunur, devam token'ı gönderilmez.
// Emülatör ölçümü: eager'da yeniden dinlemenin ilk görüntüsü sunucudan
// (resumeToken yok); LRU'da 8 ms'de önbellekten, resumeToken gönderiliyor.

const mockInitializeFirestore = jest.fn(() => ({ kind: "db" }));
const mockMemoryLocalCache = jest.fn((settings) => ({ kind: "memoryCache", settings }));
const mockLru = jest.fn((settings) => ({ kind: "lru", settings }));

jest.mock("firebase/app", () => ({ initializeApp: jest.fn(() => ({ kind: "app" })) }));
jest.mock("firebase/auth", () => ({
  initializeAuth: jest.fn(() => ({ kind: "auth" })),
  getReactNativePersistence: jest.fn(() => ({})),
}));
jest.mock("firebase/firestore", () => ({
  initializeFirestore: (...args) => mockInitializeFirestore(...args),
  memoryLocalCache: (...args) => mockMemoryLocalCache(...args),
  memoryLruGarbageCollector: (...args) => mockLru(...args),
  getFirestore: jest.fn(() => {
    throw new Error("getFirestore kullanılmamalı: önbellek ayarı kaybolur");
  }),
}));
jest.mock("firebase/database", () => ({ getDatabase: jest.fn(() => ({ kind: "rtdb" })) }));
jest.mock("firebase/functions", () => ({ getFunctions: jest.fn(() => ({ kind: "fns" })) }));
jest.mock("../services/storage/authPersistence", () => ({ mmkvAuthPersistence: {} }));
jest.mock("../services/appCheck", () => ({ initAppCheck: jest.fn() }));

test("Firestore, LRU çöp toplayıcılı bellek önbelleğiyle başlatılır", () => {
  const { db } = jest.requireActual("../firebase");
  expect(db).toEqual({ kind: "db" });
  expect(mockInitializeFirestore).toHaveBeenCalledTimes(1);
  const [app, settings] = mockInitializeFirestore.mock.calls[0];
  expect(app).toEqual({ kind: "app" });
  expect(settings.localCache.kind).toBe("memoryCache");
  expect(settings.localCache.settings.garbageCollector.kind).toBe("lru");
  // Sınır makul aralıkta: SDK en az 1 MB ister; bellek sınırlı telefonlarda
  // onlarca MB'ı aşmasın.
  const bytes = mockLru.mock.calls[0][0].cacheSizeBytes;
  expect(bytes).toBeGreaterThanOrEqual(1024 * 1024);
  expect(bytes).toBeLessThanOrEqual(40 * 1024 * 1024);
});
