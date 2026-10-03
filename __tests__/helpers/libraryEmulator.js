// __tests__/helpers/libraryEmulator.js
//
// Liste/izleme yazma servislerini GERÇEK Firestore emülatörüne ve GERÇEK güvenlik
// kurallarına karşı çalıştıran test iskeleti. Servis kodu mock'lanmaz: yalnız
// platform bağımlılıkları (disk önbelleği, analitik, kullanım sayacı) sahte.
//
// `jest.mock` çağrıları dosya başında hoist edilir; bu yüzden bu yardımcı
// `mock` önekli değişkenleri DEĞİL, her test dosyasının kendi `jest.mock`
// satırlarını bekler (aşağıdaki "KULLANIM"a bakın). Yardımcı yalnız emülatör
// ortamını kurar ve kök doküman okuma kısayollarını verir.
//
// KULLANIM (test dosyasının en üstü):
//   const mockHolder = { db: null };
//   jest.mock("../../firebase", () => ({ get db() { return mockHolder.db; } }));
//   jest.mock("../../services/analytics", () => require("../helpers/libraryEmulator").analyticsMock());
//   jest.mock("../../services/activationAnalytics", () => ({ trackFirstContentActivation: jest.fn() }));
//   jest.mock("../../services/usageTrackerService", () => require("../helpers/libraryEmulator").usageMock());
//   jest.mock("../../utils/cacheStore", () => require("../helpers/libraryEmulator").cacheStoreMock());
//
// Çalıştırma: `npm run test:rules` (JDK 21 — bkz. hafıza notu rules-tests-jdk).

const fs = require("fs");
const path = require("path");
const { initializeTestEnvironment } = require("@firebase/rules-unit-testing");
const { doc, getDoc, getDocs, collection } = require("firebase/firestore");

function analyticsMock() {
  return {
    ANALYTICS_EVENTS: new Proxy({}, { get: (_target, key) => String(key) }),
    trackEvent: jest.fn(),
  };
}

function usageMock() {
  return {
    trackFirestoreWrite: jest.fn(),
    trackFirestoreDelete: jest.fn(),
    trackFirestoreRead: jest.fn(),
  };
}

/** cacheStore'un bellek içi karşılığı (expo-file-system node'da yüklenemez). */
function cacheStoreMock() {
  const store = new Map();
  const id = (ns, key) => `${ns}::${key}`;
  return {
    setJSON: (ns, key, data) => {
      store.set(id(ns, key), JSON.parse(JSON.stringify(data)));
    },
    getJSON: (ns, key) => (store.has(id(ns, key)) ? store.get(id(ns, key)) : null),
    getAge: (ns, key) => (store.has(id(ns, key)) ? 0 : null),
    remove: (ns, key) => {
      store.delete(id(ns, key));
    },
    clearNamespace: () => store.clear(),
    clearAll: () => store.clear(),
    totalSize: () => 0,
  };
}

async function createEmulatorEnv(projectId = "seelogd-library-test") {
  return initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(
        path.join(__dirname, "..", "..", "firestore.rules"),
        "utf8",
      ),
      host: "127.0.0.1",
      port: 8085,
    },
  });
}

/** Kök doküman verisi (yoksa {}). */
async function readRoot(db, uid) {
  const snap = await getDoc(doc(db, "Lists", uid));
  return snap.exists() ? snap.data() : {};
}

/** Alt koleksiyon → { [docId]: data }. */
async function readCollection(db, uid, name) {
  const snap = await getDocs(collection(db, "Lists", uid, name));
  return Object.fromEntries(snap.docs.map((entry) => [entry.id, entry.data()]));
}

module.exports = {
  analyticsMock,
  usageMock,
  cacheStoreMock,
  createEmulatorEnv,
  readRoot,
  readCollection,
};
