// Sosyal hesap bağlantılarının görünürlük kuralları (emülatör testi).
//
// Bağlantılar Users/{uid}/socialLinks/links belgesinde; okuma
// Users/{uid}.privacy.socialLinks ('public' | 'friends' | 'private') ile sınırlı.
// Kökteki eski `socialLinks` kopyası yalnız 'public' iken yazılabilir — aksi
// halde gizli ayar herkese okunur kökte sızardı.
// Çalıştırma: `npm run test:rules`.

const fs = require("fs");
const path = require("path");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  deleteDoc,
  deleteField,
  runTransaction,
  serverTimestamp,
} = require("firebase/firestore");

const ALICE = "alice";
const BOB = "bob";
const CAROL = "carol";

let testEnv;
let alice;
let bob;
let carol;
let anon;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    // Diğer kural dosyalarıyla paralel koşarken clearFirestore çakışmasın.
    projectId: "seelogd-rules-social-links",
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
  carol = testEnv.authenticatedContext(CAROL).firestore();
  anon = testEnv.unauthenticatedContext().firestore();
});

const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

const profil = (extra = {}) => ({
  uid: ALICE,
  username: "alice",
  usernameLower: "alice",
  displayName: "Alice",
  friendsCount: 0,
  ...extra,
});

const LINKS = { instagram: "alice_ig", x: "alice_x" };
const linksRef = (db, uid = ALICE) => doc(db, "Users", uid, "socialLinks", "links");

async function seedAlice({ privacy, rootLinks, subLinks = LINKS, bobIsFriend = false } = {}) {
  await seed(async (db) => {
    await setDoc(
      doc(db, "Users", ALICE),
      profil({
        ...(privacy ? { privacy } : {}),
        ...(rootLinks ? { socialLinks: rootLinks } : {}),
      }),
    );
    if (subLinks) await setDoc(linksRef(db), { links: subLinks, updatedAt: serverTimestamp() });
    if (bobIsFriend) {
      await setDoc(doc(db, "Users", ALICE, "friends", BOB), { uid: BOB });
      await setDoc(doc(db, "Users", BOB, "friends", ALICE), { uid: ALICE });
    }
  });
}

describe("socialLinks okuma görünürlüğü", () => {
  test("privacy alanı yoksa varsayılan herkese açık", async () => {
    await seedAlice();
    await assertSucceeds(getDoc(linksRef(bob)));
    await assertSucceeds(getDoc(linksRef(carol)));
  });

  test("oturumsuz kullanıcı okuyamaz", async () => {
    await seedAlice({ privacy: { socialLinks: "public" } });
    await assertFails(getDoc(linksRef(anon)));
  });

  test("'friends': arkadaş okur, yabancı okuyamaz", async () => {
    await seedAlice({ privacy: { socialLinks: "friends" }, bobIsFriend: true });
    await assertSucceeds(getDoc(linksRef(bob)));
    await assertFails(getDoc(linksRef(carol)));
  });

  test("'private': yalnız sahibi okur", async () => {
    await seedAlice({ privacy: { socialLinks: "private" }, bobIsFriend: true });
    await assertSucceeds(getDoc(linksRef(alice)));
    await assertFails(getDoc(linksRef(bob)));
    await assertFails(getDoc(linksRef(carol)));
  });

  test("sahibi belge yokken de okuyabilir (abonelik hata vermez)", async () => {
    await seedAlice({ privacy: { socialLinks: "private" }, subLinks: null });
    await assertSucceeds(getDoc(linksRef(alice)));
  });

  test("'links' dışındaki belge kimliği okunamaz/yazılamaz", async () => {
    await seedAlice();
    await assertFails(getDoc(doc(bob, "Users", ALICE, "socialLinks", "other")));
    await assertFails(setDoc(doc(alice, "Users", ALICE, "socialLinks", "other"), { links: {} }));
  });
});

describe("socialLinks yazma", () => {
  test("sahibi geçerli bağlantıları yazar, boş harita da geçerli", async () => {
    await seedAlice({ subLinks: null });
    await assertSucceeds(setDoc(linksRef(alice), { links: LINKS, updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(linksRef(alice), { links: {}, updatedAt: serverTimestamp() }));
  });

  test("başkası yazamaz/silemez", async () => {
    await seedAlice();
    await assertFails(setDoc(linksRef(bob), { links: { x: "hack" }, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(linksRef(bob)));
  });

  test("bilinmeyen platform, uzun ad ve fazladan alan reddedilir", async () => {
    await seedAlice({ subLinks: null });
    await assertFails(setDoc(linksRef(alice), { links: { myspace: "a" } }));
    await assertFails(setDoc(linksRef(alice), { links: { x: "a".repeat(31) } }));
    await assertFails(setDoc(linksRef(alice), { links: LINKS, extra: true }));
    await assertFails(setDoc(linksRef(alice), { links: "x" }));
  });
});

describe("kökteki eski socialLinks kopyası", () => {
  test("gizlilik 'public' değilken köke bağlantı yazılamaz", async () => {
    await seedAlice({ privacy: { socialLinks: "friends" } });
    await assertFails(updateDoc(doc(alice, "Users", ALICE), { socialLinks: LINKS }));
  });

  test("saveSocialLinks işlemi: alt belge yazılır, kök kopya silinir", async () => {
    await seedAlice({ rootLinks: LINKS, subLinks: null });
    await assertSucceeds(
      runTransaction(alice, async (tx) => {
        const rootRef = doc(alice, "Users", ALICE);
        await tx.get(rootRef);
        tx.set(linksRef(alice), { links: { x: "yeni" }, updatedAt: serverTimestamp() });
        tx.update(rootRef, { socialLinks: deleteField(), updatedAt: serverTimestamp() });
      }),
    );
  });

  test("updatePrivacy işlemi: kök kopya taşınıp gizlilik daraltılabilir", async () => {
    await seedAlice({ rootLinks: LINKS, subLinks: null });
    await assertSucceeds(
      runTransaction(alice, async (tx) => {
        const rootRef = doc(alice, "Users", ALICE);
        await tx.get(rootRef);
        await tx.get(linksRef(alice));
        tx.set(linksRef(alice), { links: LINKS, updatedAt: serverTimestamp() });
        tx.update(rootRef, {
          socialLinks: deleteField(),
          privacy: { socialLinks: "private", showSocialLinksOnOwnProfile: false },
          updatedAt: serverTimestamp(),
        });
      }),
    );
    await assertFails(getDoc(linksRef(bob)));
  });

  test("kök kopya silinmeden gizlilik daraltılamaz", async () => {
    await seedAlice({ rootLinks: LINKS });
    await assertFails(
      updateDoc(doc(alice, "Users", ALICE), { privacy: { socialLinks: "private" } }),
    );
  });

  test("showSocialLinksOnOwnProfile tek başına güncellenebilir", async () => {
    await seedAlice({ privacy: { socialLinks: "friends" } });
    await assertSucceeds(
      updateDoc(doc(alice, "Users", ALICE), {
        privacy: { socialLinks: "friends", showSocialLinksOnOwnProfile: false },
      }),
    );
  });
});
