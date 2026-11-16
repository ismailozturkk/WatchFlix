// E-POSTA DOĞRULAMA KAPISI (16 Kas 2026; firestore.rules → emailVerified()).
// Rastgele e-postayla açılan hesap liste ekleme / oy / mesaj gibi işlemleri YAPAMAZ;
// yalnız kayıt işleminin kendisi (kendi profil belgesi, private/account, kullanıcı adı)
// doğrulamadan önce yazılabilir. Google/Apple oturumu sağlayıcıda doğrulanmış sayılır.

const { assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc } = require("firebase/firestore");
const { createEmulatorEnv } = require("../helpers/libraryEmulator");

let testEnv;
const SPAM = "spam";
const ALICE = "alice";

const UNVERIFIED = { email_verified: false, firebase: { sign_in_provider: "password" } };

beforeAll(async () => {
  testEnv = await createEmulatorEnv("seelogd-email-gate");
});
afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

const unverified = () => testEnv.authenticatedContext(SPAM, UNVERIFIED).firestore();
const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

const profil = (uid) => ({
  uid,
  username: uid,
  usernameLower: uid,
  displayName: uid,
  friendsCount: 0,
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, "Users", ALICE), profil(ALICE));
    await setDoc(doc(db, "Posts", "p1"), { authorId: ALICE, text: "selam", likesCount: 0, commentsCount: 0 });
  });
});

describe("doğrulanmamış e-posta+şifre hesabı", () => {
  test("kayıt işlemi yapılabilir: kendi profili, private/account, kullanıcı adı", async () => {
    const db = unverified();
    await assertSucceeds(getDoc(doc(db, "Users", SPAM)));
    await assertSucceeds(setDoc(doc(db, "Usernames", SPAM), { uid: SPAM }));
    await assertSucceeds(setDoc(doc(db, "Users", SPAM), profil(SPAM)));
    await assertSucceeds(
      setDoc(doc(db, "Users", SPAM, "private", "account"), { email: "x@y.co", birthDate: "1998-03-05" }),
    );
  });

  test("başka hiçbir şey: başka profil okuma, gönderi, beğeni sayacı, profil güncelleme, diğer gizli belgeler", async () => {
    await seed((db) => setDoc(doc(db, "Users", SPAM), profil(SPAM)));
    const db = unverified();
    await assertFails(getDoc(doc(db, "Users", ALICE)));
    await assertFails(
      setDoc(doc(db, "Posts", "spam1"), { authorId: SPAM, text: "spam", likesCount: 0, commentsCount: 0 }),
    );
    await assertFails(updateDoc(doc(db, "Users", ALICE), { friendsCount: 1 }));
    await assertFails(updateDoc(doc(db, "Users", SPAM), { bio: "spam" }));
    await assertFails(
      setDoc(doc(db, "Users", SPAM, "private", "universes"), { id: "all", solved: {}, updatedAt: 0 }),
    );
    await assertFails(setDoc(doc(db, "Lists", SPAM), { uid: SPAM }));
  });
});

describe("doğrulanmış hesaplar", () => {
  test("e-postası doğrulanmış şifre hesabı başka profili okur", async () => {
    const db = testEnv
      .authenticatedContext(SPAM, { email_verified: true, firebase: { sign_in_provider: "password" } })
      .firestore();
    await assertSucceeds(getDoc(doc(db, "Users", ALICE)));
  });

  test.each(["google.com", "apple.com"])("%s oturumu email_verified iddiası olmadan da geçer", async (provider) => {
    const db = testEnv
      .authenticatedContext(SPAM, { email_verified: false, firebase: { sign_in_provider: provider } })
      .firestore();
    await assertSucceeds(getDoc(doc(db, "Users", ALICE)));
  });
});
