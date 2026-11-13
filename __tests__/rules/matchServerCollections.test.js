// Zevk Çemberleri Faz 5 sunucu koleksiyonları (emülatör testi).
// MatchSuggestions/{uid}: yalnız SAHİBİ okur, kimse yazamaz. Diğer tüm eşleşme koleksiyonları istemciye KAPALI.
// Çalıştırma: `npm run test:rules`.

const fs = require("fs");
const path = require("path");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, collection, getDocs } = require("firebase/firestore");

const ALICE = "alice";
const BOB = "bob";

let testEnv;
let alice;
let bob;
let anon;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "seelogd-rules-match-server",
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
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "MatchSuggestions", ALICE), { v: 1, lanes: {} });
    await setDoc(doc(db, "MatchMembers", ALICE), { lanes: ["movie"] });
    await setDoc(doc(db, "MatchProfiles", ALICE), { v: 1 });
    await setDoc(doc(db, "MatchProfiles", ALICE, "built", "movie"), { json: "{}" });
    await setDoc(doc(db, "MatchPairs", ALICE), { map: {} });
    await setDoc(doc(db, "MatchHellos", `${ALICE}_${BOB}`), { uids: [ALICE, BOB] });
    await setDoc(doc(db, "MatchMeta", "salt"), { salt: "x" });
    await setDoc(doc(db, "TitleFeatures", "movie_1"), { type: "movie" });
  });
});

test("öneri belgesi: sahibi okur; başkası ve oturumsuz okuyamaz; kimse yazamaz", async () => {
  await assertSucceeds(getDoc(doc(alice, "MatchSuggestions", ALICE)));
  await assertFails(getDoc(doc(bob, "MatchSuggestions", ALICE)));
  await assertFails(getDoc(doc(anon, "MatchSuggestions", ALICE)));
  await assertFails(setDoc(doc(alice, "MatchSuggestions", ALICE), { v: 1, lanes: {} }));
  await assertFails(getDocs(collection(alice, "MatchSuggestions")));
});

test("profil, üyelik, eşleme, selam, bağlam ve yapım özellikleri: sahibine bile kapalı", async () => {
  const paths = [
    ["MatchMembers", ALICE],
    ["MatchProfiles", ALICE],
    ["MatchProfiles", ALICE, "built", "movie"],
    ["MatchPairs", ALICE],
    ["MatchHellos", `${ALICE}_${BOB}`],
    ["MatchMeta", "salt"],
    ["TitleFeatures", "movie_1"],
  ];
  for (const p of paths) {
    await assertFails(getDoc(doc(alice, ...p)));
    await assertFails(setDoc(doc(alice, ...p), { x: 1 }));
  }
});
