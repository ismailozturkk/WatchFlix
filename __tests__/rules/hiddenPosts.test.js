// Şikâyet edilen gönderiyi gizleme (T3 B15) — gerçek servis kodu, gerçek kurallar.
//   • sahibi gizler, listeler, geri alır
//   • başkası okuyamaz, yazamaz (kimin neyi şikâyet ettiği sızmaz)
//   • belge şekli sabit: postId yolla aynı, yalnız izinli alanlar

global.__DEV__ = false;

const mockHolder = { db: null };
jest.mock("../../firebase", () => ({
  get db() {
    return mockHolder.db;
  },
}));
jest.mock("../../services/usageTrackerService", () => require("../helpers/libraryEmulator").usageMock());

const { assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, getDocs, collection, setDoc } = require("firebase/firestore");
const { createEmulatorEnv } = require("../helpers/libraryEmulator");
const { hidePost, unhidePost, subscribeHiddenPosts } = require("../../services/hiddenPostsService");

let testEnv;
const ALICE = "alice";
const MALLORY = "mallory";

beforeAll(async () => {
  testEnv = await createEmulatorEnv("seelogd-hidden-posts");
});
afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  mockHolder.db = testEnv.authenticatedContext(ALICE).firestore();
});

const as = (uid) => testEnv.authenticatedContext(uid).firestore();

test("sahibi gizler, dinleyici kimliği görür, geri alır", async () => {
  await hidePost(ALICE, "p1");
  const seen = await new Promise((resolve) => {
    const unsub = subscribeHiddenPosts(ALICE, (ids) => {
      if (ids.has("p1")) {
        unsub();
        resolve(ids);
      }
    });
  });
  expect([...seen]).toEqual(["p1"]);
  await unhidePost(ALICE, "p1");
  expect((await getDoc(doc(mockHolder.db, `Users/${ALICE}/hiddenPosts/p1`))).exists()).toBe(false);
});

test("başkası okuyamaz ve yazamaz", async () => {
  await hidePost(ALICE, "p1");
  await assertFails(getDocs(collection(as(MALLORY), `Users/${ALICE}/hiddenPosts`)));
  await assertFails(
    setDoc(doc(as(MALLORY), `Users/${ALICE}/hiddenPosts/p2`), { postId: "p2", reason: "report" }),
  );
});

test("şekil: postId yolla aynı olmalı, fazladan alan yok", async () => {
  const db = as(ALICE);
  await assertFails(setDoc(doc(db, `Users/${ALICE}/hiddenPosts/p1`), { postId: "baska", reason: "report" }));
  await assertFails(
    setDoc(doc(db, `Users/${ALICE}/hiddenPosts/p1`), { postId: "p1", reason: "report", authorId: "x" }),
  );
  await assertSucceeds(setDoc(doc(db, `Users/${ALICE}/hiddenPosts/p1`), { postId: "p1", reason: "report" }));
});
