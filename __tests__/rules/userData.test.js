// Yerel-öncelikli veri katmanının (services/userData) EMÜLATÖR testleri.
// GERÇEK `firestoreRemote` bağdaştırıcısı, GERÇEK motor/işçi/günlük, GERÇEK
// Firestore SDK'sı ve GERÇEK güvenlik kuralları; yalnız disk (bellek-içi
// dosya sistemi + MMKV taklidi) ve kullanım sayacı sahte.
// `npm run test:rules` ile çalışır (JDK 21 — bkz. hafıza notu rules-tests-jdk).
//
// Mock'lu birim testlerin GÖREMEDİĞİ şeyler burada kanıtlanır:
//   • iç içe yol (Reminders/{uid}/tvShows/{id}/episodes/{id}) batch'te çalışıyor
//   • gerçek SDK `undefined` alanı REDDEDİYOR → temizleme zorunlu
//   • gerçek SDK iç içe diziyi reddediyor → zehirli işlem ayrılıyor, kuyruk tıkanmıyor
//   • yetkisiz yazma gerçek kurallarda `permission-denied` → ölü harf
//   • tek seferlik indirme gerçek koleksiyonları okuyor (eski şema göçü dahil)

const mockHolder = { db: null, uid: null };
jest.mock("../../firebase", () => ({
  get db() {
    return mockHolder.db;
  },
}));
jest.mock("../../services/usageTrackerService", () =>
  require("../helpers/libraryEmulator").usageMock(),
);

const { doc, getDoc, getDocs, collection, setDoc } = require("firebase/firestore");
const { createEmulatorEnv } = require("../helpers/libraryEmulator");
const outbox = require("../../services/userData/outbox");
const snapshot = require("../../services/snapshotCache");
const { createFirestoreRemote } = require("../../services/userData/firestoreRemote");
const { createSyncWorker } = require("../../services/userData/syncWorker");
const { createUserDataDomain } = require("../../services/userData/createDomain");
const { marker } = require("../../services/userData/hydrationMarker");
const {
  notesSpec,
  mediaNotesSpec,
  remindersSpec,
  createRemindersActions,
} = require("../../services/userData/domains");

const UID = "alice";
let testEnv;

const asUser = (uid) => {
  mockHolder.uid = uid;
  mockHolder.db = testEnv.authenticatedContext(uid).firestore();
};

function build() {
  const remote = createFirestoreRemote();
  const worker = createSyncWorker({
    remote,
    outbox,
    isOnline: () => true,
    isAuthed: () => true,
    beforeAck: () => snapshot.flushSnapshotWrites(),
    debounceMs: 1,
    // Geri çekilme/zaman aşımı zamanlayıcıları gerçek setTimeout açıp Jest'i
    // açık tutardı; akışı flush() ile elle sürüyoruz.
    setTimer: () => 0,
    clearTimer: () => {},
  });
  const deps = {
    snapshot,
    outbox,
    remote,
    requestFlush: () => {}, // test akışı flush'ı elle çağırır
    canFetch: () => true,
    marker,
  };
  const notes = createUserDataDomain(notesSpec, deps);
  const mediaNotes = createUserDataDomain(mediaNotesSpec, deps);
  const reminders = createUserDataDomain(remindersSpec, deps);
  return { remote, worker, notes, mediaNotes, reminders, actions: createRemindersActions(reminders) };
}

const adminSeed = async (fn) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });
};

const readDoc = async (path) => {
  const snap = await getDoc(doc(mockHolder.db, path));
  return snap.exists() ? snap.data() : null;
};
const listIds = async (path) =>
  (await getDocs(collection(mockHolder.db, path))).docs.map((d) => d.id).sort();

const note = (id, extra = {}) => ({
  id, type: "note", title: "", content: `icerik ${id}`, todos: [],
  color: "#fff", backgroundColor: "#000", scheduledDate: null, createdAt: 1, updatedAt: 1, ...extra,
});

beforeAll(async () => {
  testEnv = await createEmulatorEnv("seelogd-userdata-test");
});
afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  require("expo-file-system").__reset();
  // Günlük MMKV'de KALICI (ölü işlemler dahil): testler arası açıkça temizle.
  for (const uid of [UID, "mallory", "bob"]) outbox.clear(uid);
  outbox.__resetMemory();
  snapshot.resetSnapshotCache();
  asUser(UID);
});

describe("yazma (gerçek SDK + gerçek kurallar)", () => {
  test("not ekle/güncelle/sil tek batch ile gerçek Firestore'a gider", async () => {
    const h = build();
    await h.notes.ensureHydrated(UID);
    h.notes.apply(UID, [
      { kind: "items", doc: note("n1") },
      { kind: "items", doc: note("n2", { content: "ikinci" }) },
    ]);
    await h.worker.flush(UID);
    expect(await listIds(`Notes/${UID}/items`)).toEqual(["n1", "n2"]);
    expect((await readDoc(`Notes/${UID}/items/n2`)).content).toBe("ikinci");

    h.notes.apply(UID, [{ kind: "items", doc: note("n1", { content: "güncel" }) }]);
    h.notes.apply(UID, [{ kind: "items", key: "n2" }]);
    await h.worker.flush(UID);
    expect(await listIds(`Notes/${UID}/items`)).toEqual(["n1"]);
    expect((await readDoc(`Notes/${UID}/items/n1`)).content).toBe("güncel");
    expect(outbox.counts(UID)).toEqual({ pending: 0, dead: 0 });
  });

  test("hatırlatıcı: iç içe bölüm yolu + dizi belgesi türetimi", async () => {
    const h = build();
    await h.reminders.ensureHydrated(UID);
    h.actions.setEpisode(UID, { episodeId: "e1", showId: 1399, showName: "GoT", seasonNumber: 1, episodeNumber: 1, airDate: "2027-01-01" });
    h.actions.setEpisode(UID, { episodeId: "e2", showId: 1399, showName: "GoT", seasonNumber: 1, episodeNumber: 2, airDate: "2027-01-08" });
    h.actions.setMovie(UID, { movieId: 603, movieName: "Matrix", releaseDate: "2027-02-02" });
    await h.worker.flush(UID);

    expect(await readDoc(`Reminders/${UID}/tvShows/1399`)).toMatchObject({ showId: 1399, showName: "GoT" });
    expect(await listIds(`Reminders/${UID}/tvShows/1399/episodes`)).toEqual(["e1", "e2"]);
    expect(await listIds(`Reminders/${UID}/movies`)).toEqual(["603"]);

    h.actions.removeEpisode(UID, 1399, "e1");
    await h.worker.flush(UID);
    expect(await readDoc(`Reminders/${UID}/tvShows/1399`)).not.toBeNull(); // e2 hâlâ var

    h.actions.removeEpisode(UID, 1399, "e2");
    await h.worker.flush(UID);
    expect(await readDoc(`Reminders/${UID}/tvShows/1399`)).toBeNull(); // son bölüm → dizi belgesi gitti
    expect(await listIds(`Reminders/${UID}/tvShows/1399/episodes`)).toEqual([]);
  });

  test("medya notu yolu", async () => {
    const h = build();
    await h.mediaNotes.ensureHydrated(UID);
    h.mediaNotes.apply(UID, [{ kind: "items", doc: { id: "tv_7", type: "tv", mediaId: 7, text: "x", updatedAt: 3 } }]);
    await h.worker.flush(UID);
    expect(await readDoc(`MediaNotes/${UID}/items/tv_7`)).toMatchObject({ mediaId: 7 });
  });

  test("`undefined` alan gerçek SDK'da patlar — temizleme olmadan batch düşerdi", async () => {
    // Kanıt: ham SDK reddediyor.
    // (SDK EŞZAMANLI fırlatır: batch.set içinde olsa tüm batch düşerdi.)
    expect(() => setDoc(doc(mockHolder.db, `Notes/${UID}/items/raw`), { a: undefined })).toThrow(/undefined/i);

    // Motor aynı belgeyi temizleyerek gönderiyor.
    const h = build();
    await h.notes.ensureHydrated(UID);
    h.notes.apply(UID, [{ kind: "items", doc: note("n1", { scheduledDate: undefined, pinned: undefined }) }]);
    await h.worker.flush(UID);
    const yazilan = await readDoc(`Notes/${UID}/items/n1`);
    expect(yazilan).not.toBeNull();
    expect("pinned" in yazilan).toBe(false);
  });
});

describe("zehirli işlem (gerçek SDK hatası)", () => {
  test("iç içe dizi gerçek SDK'da 'invalid-argument': kötüsü ölüye ayrılır, iyiler gider", async () => {
    const h = build();
    await h.notes.ensureHydrated(UID);
    h.notes.apply(UID, [
      { kind: "items", doc: note("iyi1") },
      { kind: "items", doc: note("kotu", { todos: [[1, 2], [3]] }) }, // Firestore: iç içe dizi yok
      { kind: "items", doc: note("iyi2") },
    ]);
    await h.worker.flush(UID);

    expect(await listIds(`Notes/${UID}/items`)).toEqual(["iyi1", "iyi2"]);
    expect(outbox.counts(UID)).toEqual({ pending: 0, dead: 1 });
    // Yerel kopya kötü belgeyi KORUYOR (kullanıcı verisi silinmez)
    expect(h.notes.getSnapshot(UID).has("items", "kotu")).toBe(true);
  });

  test("yetkisiz yazma: gerçek kurallar permission-denied → 3 denemede ölü harf", async () => {
    const h = build();
    await h.notes.ensureHydrated(UID);
    // Başka kullanıcının yoluna yazmaya çalışan işlem (ör. yanlış uid ile kurulmuş)
    outbox.enqueue(UID, [
      { path: "Notes/mallory/items/x", op: "set", data: note("x") },
    ]);
    await h.worker.flush(UID);
    expect(outbox.counts(UID)).toEqual({ pending: 1, dead: 0 }); // 1. deneme: yumuşak hata
    outbox.peek(UID).forEach(() => {});
    await h.worker.flush(UID);
    await h.worker.flush(UID);
    expect(outbox.counts(UID)).toEqual({ pending: 0, dead: 1 });
    expect(await (async () => {
      asUser("mallory");
      return readDoc("Notes/mallory/items/x");
    })()).toBeNull();
  });
});

describe("tek seferlik indirme (gerçek okuma)", () => {
  test("notlar + hatırlatıcılar gerçek koleksiyonlardan iner; ikinci açılışta SIFIR okuma yolu", async () => {
    await adminSeed(async (db) => {
      await setDoc(doc(db, `Notes/${UID}/items/n1`), note("n1", { createdAt: 5 }));
      await setDoc(doc(db, `Notes/${UID}/items/n2`), note("n2", { createdAt: 9 }));
      await setDoc(doc(db, `Reminders/${UID}/movies/10`), { movieId: 10, movieName: "F" });
      await setDoc(doc(db, `Reminders/${UID}/tvShows/1`), { showId: 1, showName: "D" });
      await setDoc(doc(db, `Reminders/${UID}/tvShows/1/episodes/a`), { episodeId: "a", showId: 1, showName: "D" });
      await setDoc(doc(db, `Reminders/${UID}/tvShows/2`), { showId: 2, showName: "E" });
      await setDoc(doc(db, `Reminders/${UID}/tvShows/2/episodes/b`), { episodeId: "b", showId: 2, showName: "E" });
    });

    const h = build();
    expect(await h.notes.ensureHydrated(UID)).toBe(true);
    expect(await h.reminders.ensureHydrated(UID)).toBe(true);
    expect(h.notes.getSnapshot(UID).lists.items.map((n) => n.id)).toEqual(["n2", "n1"]);
    expect(h.reminders.getSnapshot(UID).lists.episodes.map((e) => e.episodeId).sort()).toEqual(["a", "b"]);
    expect(h.reminders.getSnapshot(UID).lists.movies).toHaveLength(1);

    // Yeniden açılış: disk kopyası var → ağ yok. Okumaları sayabilmek için
    // remote'u sarmalayıp yeni motoru onunla kuruyoruz.
    snapshot.resetSnapshotCache();
    outbox.__resetMemory();
    let reads = 0;
    const remote = createFirestoreRemote();
    const spied = {
      ...remote,
      fetchCollection: async (...a) => { reads += 1; return remote.fetchCollection(...a); },
      fetchDoc: async (...a) => { reads += 1; return remote.fetchDoc(...a); },
    };
    const deps = { snapshot, outbox, remote: spied, requestFlush: () => {}, canFetch: () => true, marker };
    const notes2 = createUserDataDomain(notesSpec, deps);
    const reminders2 = createUserDataDomain(remindersSpec, deps);
    expect(notes2.getSnapshot(UID).ready).toBe(true);
    await notes2.ensureHydrated(UID);
    await reminders2.ensureHydrated(UID);
    expect(reads).toBe(0);
    expect(notes2.getSnapshot(UID).lists.items).toHaveLength(2);
  });

  test("eski şema (Notes/{uid}.notes[]) gerçek belgeden taşınır", async () => {
    await adminSeed(async (db) => {
      await setDoc(doc(db, `Notes/${UID}`), { notes: [note("old1"), note("old2")] });
    });
    const h = build();
    await h.notes.ensureHydrated(UID);
    expect(h.notes.getSnapshot(UID).lists.items.map((n) => n.id).sort()).toEqual(["old1", "old2"]);
    expect(await listIds(`Notes/${UID}/items`)).toEqual(["old1", "old2"]); // alt koleksiyona yazıldı
  });

  test("başka kullanıcının koleksiyonunu indirmek kurallarda reddedilir", async () => {
    await adminSeed(async (db) => {
      await setDoc(doc(db, `Notes/bob/items/n1`), note("n1"));
    });
    const h = build();
    await expect(h.notes.ensureHydrated("bob")).resolves.toBe(false); // hata yutulur, kopya yok
    expect(h.notes.getSnapshot("bob").error).toBe("permission-denied");
    expect(h.notes.getSnapshot("bob").lists.items).toHaveLength(0);
  });
});

describe("çevrimdışı → çevrimiçi (gerçek yazma günlüğü)", () => {
  test("günlükte bekleyen işlemler sonradan gerçek Firestore'a gider; süreç ölümüne dayanır", async () => {
    const h = build();
    await h.notes.ensureHydrated(UID);
    h.notes.apply(UID, [{ kind: "items", doc: note("off1", { content: "çevrimdışı yazıldı" }) }]);

    // süreç öldü (hiç flush edilmedi)
    snapshot.resetSnapshotCache();
    outbox.__resetMemory();
    const h2 = build();
    expect(h2.notes.getSnapshot(UID).has("items", "off1")).toBe(true); // günlükten geri geldi
    await h2.worker.flush(UID);
    expect((await readDoc(`Notes/${UID}/items/off1`)).content).toBe("çevrimdışı yazıldı");
  });
});
