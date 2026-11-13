// Zevk Çemberleri katılım belgesi Users/{uid}/private/match (Faz 4, emülatör testi).
// Yalnız sahibi okur/yazar/siler; biçim sınırlı (şişirilemez, başka alan taşımaz).
// Çalıştırma: `npm run test:rules`.

const fs = require("fs");
const path = require("path");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, setDoc, getDoc, deleteDoc, serverTimestamp } = require("firebase/firestore");

const ALICE = "alice";
const BOB = "bob";

let testEnv;
let alice;
let bob;
let anon;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "seelogd-rules-match-optin",
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, "..", "..", "firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8085,
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  alice = testEnv.authenticatedContext(ALICE).firestore();
  bob = testEnv.authenticatedContext(BOB).firestore();
  anon = testEnv.unauthenticatedContext().firestore();
});

const ok = () => ({ optIn: true, lanes: ["movie", "tv"], consentVersion: 1, updatedAt: serverTimestamp() });
const ref = (db, uid = ALICE) => doc(db, "Users", uid, "private", "match");

test("sahibi yazar, okur, günceller ve siler", async () => {
  await assertSucceeds(setDoc(ref(alice), ok()));
  await assertSucceeds(getDoc(ref(alice)));
  await assertSucceeds(setDoc(ref(alice), { ...ok(), optIn: false, lanes: [] }));
  await assertSucceeds(deleteDoc(ref(alice)));
});

test("başkası ve oturumsuz okuyamaz, yazamaz, silemez", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "Users", ALICE, "private", "match"), { optIn: true, lanes: ["movie"], consentVersion: 1, updatedAt: 1 });
  });
  await assertFails(getDoc(ref(bob)));
  await assertFails(getDoc(ref(anon)));
  await assertFails(setDoc(ref(bob), ok()));
  await assertFails(deleteDoc(ref(bob)));
});

test("biçim dışı belge reddedilir", async () => {
  await assertFails(setDoc(ref(alice), { ...ok(), score: 99 })); // fazladan alan
  await assertFails(setDoc(ref(alice), { ...ok(), lanes: ["movie", "korku"] })); // bilinmeyen kulvar
  await assertFails(setDoc(ref(alice), { ...ok(), lanes: ["movie", "tv", "anime", "movie"] })); // şişirme
  await assertFails(setDoc(ref(alice), { ...ok(), optIn: "evet" }));
  await assertFails(setDoc(ref(alice), { ...ok(), consentVersion: 0 }));
  await assertFails(setDoc(ref(alice), { ...ok(), updatedAt: 123 })); // istemci saati değil sunucu damgası
});
