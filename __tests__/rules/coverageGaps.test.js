// Kural kapsam boşlukları (T2.2): daha önce hiç test edilmeyen, kötüye kullanımı
// para / kota / kimlik / içerik bütünlüğüne dokunan yollar. Her blok "kim ne
// yapamamalı" sorusunu gerçek kurallarla sınar; meşru yol da bir kez denenir.

const { assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, deleteDoc } = require("firebase/firestore");
const { createEmulatorEnv } = require("../helpers/libraryEmulator");

let testEnv;
const ALICE = "alice";
const BOB = "bob";
const CAROL = "carol";

beforeAll(async () => {
  testEnv = await createEmulatorEnv("seelogd-coverage-gaps");
});
afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();
const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    for (const uid of [ALICE, BOB, CAROL]) await setDoc(doc(db, "Users", uid), { displayName: uid });
  });
});

describe("kota ve ödeme belgeleri yalnız sunucunun", () => {
  test("AiUsage: sahibi okur ama kotasını yazamaz/sıfırlayamaz; başkası okuyamaz", async () => {
    await seed((db) => setDoc(doc(db, "AiUsage", ALICE), { day: "2026-10-25", daily: 3, monthly: 30 }));
    await assertSucceeds(getDoc(doc(as(ALICE), "AiUsage", ALICE)));
    await assertFails(updateDoc(doc(as(ALICE), "AiUsage", ALICE), { daily: 0 }));
    await assertFails(setDoc(doc(as(BOB), "AiUsage", BOB), { daily: 0 }));
    await assertFails(getDoc(doc(as(BOB), "AiUsage", ALICE)));
  });

  test("webhook olayları, davet ve promosyon koleksiyonları istemciye tamamen kapalı", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "RevenueCatWebhookEvents", "e1"), { type: "INITIAL_PURCHASE" });
      await setDoc(doc(db, "ReferralCodes", "ABCD2345"), { ownerUid: ALICE });
      await setDoc(doc(db, "ReferralAccounts", ALICE), { creditMonths: 1 });
      await setDoc(doc(db, "PromoCodes", "TESTKOD1"), { days: 30, maxRedemptions: 1, redeemedCount: 0 });
    });
    const a = as(ALICE);
    await assertFails(getDoc(doc(a, "RevenueCatWebhookEvents", "e1")));
    await assertFails(getDoc(doc(a, "ReferralCodes", "ABCD2345")));
    await assertFails(getDoc(doc(a, "ReferralAccounts", ALICE)));
    await assertFails(updateDoc(doc(a, "ReferralAccounts", ALICE), { creditMonths: 12 }));
    await assertFails(getDoc(doc(a, "PromoCodes", "TESTKOD1")));
    await assertFails(updateDoc(doc(a, "PromoCodes", "TESTKOD1"), { redeemedCount: 0 }));
    await assertFails(setDoc(doc(a, "PromoCodes", "BEDAVA99"), { days: 3650 }));
  });

  test("AppConfig herkese okunur, kimse yazamaz", async () => {
    await seed((db) => setDoc(doc(db, "AppConfig", "flags"), { x: 1 }));
    await assertSucceeds(getDoc(doc(anon(), "AppConfig", "flags")));
    await assertFails(setDoc(doc(as(ALICE), "AppConfig", "flags"), { x: 2 }));
  });
});

describe("kullanıcı adı sahiplenme", () => {
  test("kendi adına ayırır; başkasının adını devralamaz ya da silemez; uid taklit edemez", async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), "Usernames", "alice"), { uid: ALICE }));
    await assertFails(setDoc(doc(as(BOB), "Usernames", "alice"), { uid: BOB }));
    await assertFails(deleteDoc(doc(as(BOB), "Usernames", "alice")));
    await assertFails(setDoc(doc(as(BOB), "Usernames", "bobby"), { uid: ALICE }));
    await assertSucceeds(deleteDoc(doc(as(ALICE), "Usernames", "alice")));
  });
});

describe("gönderiler", () => {
  beforeEach(async () => {
    await seed((db) =>
      setDoc(doc(db, "Posts", "p1"), { authorId: ALICE, text: "selam", likesCount: 0, commentsCount: 0 }),
    );
  });

  test("başkası adına gönderi oluşturulamaz; sayaçlar sıfırdan başlamak zorunda", async () => {
    await assertFails(setDoc(doc(as(BOB), "Posts", "p2"), { authorId: ALICE, likesCount: 0, commentsCount: 0 }));
    await assertFails(setDoc(doc(as(BOB), "Posts", "p3"), { authorId: BOB, likesCount: 500, commentsCount: 0 }));
    await assertSucceeds(setDoc(doc(as(BOB), "Posts", "p4"), { authorId: BOB, likesCount: 0, commentsCount: 0 }));
  });

  test("sahibi gönderisini düzenler ama yazarını DEĞİŞTİREMEZ (başkasının adına geçirme)", async () => {
    await assertSucceeds(updateDoc(doc(as(ALICE), "Posts", "p1"), { text: "düzenlendi" }));
    await assertFails(updateDoc(doc(as(ALICE), "Posts", "p1"), { authorId: BOB }));
  });

  test("başkası metni değiştiremez, silemez; sayacı tek adımda yalnız ±1 oynatır", async () => {
    await assertFails(updateDoc(doc(as(BOB), "Posts", "p1"), { text: "ele geçirildi" }));
    await assertFails(deleteDoc(doc(as(BOB), "Posts", "p1")));
    await assertFails(updateDoc(doc(as(BOB), "Posts", "p1"), { likesCount: 100 }));
    await assertSucceeds(updateDoc(doc(as(BOB), "Posts", "p1"), { likesCount: 1 }));
  });

  test("beğeni yalnız kendi adına; yorum yalnız kendi adına", async () => {
    await assertFails(setDoc(doc(as(BOB), "Posts", "p1", "likes", CAROL), { userId: CAROL }));
    await assertSucceeds(setDoc(doc(as(BOB), "Posts", "p1", "likes", BOB), { userId: BOB }));
    await assertFails(setDoc(doc(as(BOB), "Posts", "p1", "comments", "c1"), { authorId: CAROL, text: "x" }));
    await assertSucceeds(setDoc(doc(as(BOB), "Posts", "p1", "comments", "c2"), { authorId: BOB, text: "x" }));
  });

  test("şikâyet yalnız kendi adına oluşturulur, kimse okuyamaz", async () => {
    await assertFails(setDoc(doc(as(BOB), "PostReports", "r1"), { reporterId: CAROL, postId: "p1" }));
    await assertSucceeds(setDoc(doc(as(BOB), "PostReports", "r2"), { reporterId: BOB, postId: "p1" }));
    await assertFails(getDoc(doc(as(BOB), "PostReports", "r2")));
  });
});

describe("sosyal alt koleksiyonlar", () => {
  test("engellenenler listesi yalnız sahibine", async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), "Users", ALICE, "blocked", BOB), { at: 1 }));
    await assertFails(getDoc(doc(as(BOB), "Users", ALICE, "blocked", BOB)));
    await assertFails(deleteDoc(doc(as(BOB), "Users", ALICE, "blocked", BOB)));
  });

  test("arkadaşlık isteği: başkası adına gönderilemez, engelleyene gönderilemez", async () => {
    await assertFails(setDoc(doc(as(BOB), "Users", ALICE, "friendRequests", `${CAROL}_${ALICE}`), { fromUid: CAROL }));
    await assertSucceeds(setDoc(doc(as(BOB), "Users", ALICE, "friendRequests", `${BOB}_${ALICE}`), { fromUid: BOB }));
    await seed((db) => setDoc(doc(db, "Users", ALICE, "blocked", CAROL), { at: 1 }));
    await assertFails(setDoc(doc(as(CAROL), "Users", ALICE, "friendRequests", `${CAROL}_${ALICE}`), { fromUid: CAROL }));
  });

  test("gönderilen istek kaydını yalnız sahibi yazar; alıcı silebilir, üçüncü kişi silemez", async () => {
    await assertFails(setDoc(doc(as(BOB), "Users", ALICE, "sentRequests", `${ALICE}_${BOB}`), { toUid: BOB }));
    await seed((db) => setDoc(doc(db, "Users", ALICE, "sentRequests", `${ALICE}_${BOB}`), { toUid: BOB }));
    await assertFails(deleteDoc(doc(as(CAROL), "Users", ALICE, "sentRequests", `${ALICE}_${BOB}`)));
    await assertSucceeds(deleteDoc(doc(as(BOB), "Users", ALICE, "sentRequests", `${ALICE}_${BOB}`)));
  });

  test("gelen kutusu kaydını yalnız sahibi ve o sohbetin karşı tarafı yazar", async () => {
    await assertFails(setDoc(doc(as(CAROL), "Users", ALICE, "conversations", BOB), { lastText: "sahte" }));
    await assertSucceeds(setDoc(doc(as(BOB), "Users", ALICE, "conversations", BOB), { lastText: "selam" }));
    await assertFails(getDoc(doc(as(BOB), "Users", ALICE, "conversations", BOB)));
  });

  test("çevrimiçi durumu yalnız sahibi yazar", async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), "Presence", ALICE), { online: true }));
    await assertFails(setDoc(doc(as(BOB), "Presence", ALICE), { online: false }));
  });
});

describe("oyun ve kişisel kayıtlar", () => {
  test("skor tablosunda yalnız kendi kaydı yazılır", async () => {
    const board = "scene_classic_normal";
    await assertSucceeds(setDoc(doc(as(ALICE), "GameLeaderboards", board, "entries", ALICE), { score: 10 }));
    await assertFails(setDoc(doc(as(BOB), "GameLeaderboards", board, "entries", ALICE), { score: 0 }));
  });

  test("kişisel kayıtlar (istatistik, oyun geçmişi, ayna koleksiyonları) başkasına kapalı", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "UserStats", ALICE), { x: 1 });
      await setDoc(doc(db, "SceneGameHistory", ALICE), { x: 1 });
      await setDoc(doc(db, "Users", ALICE, "myRatings", "movie_1"), { r: 5 });
      await setDoc(doc(db, "Users", ALICE, "bookmarks", "p1"), { at: 1 });
    });
    const b = as(BOB);
    await assertFails(getDoc(doc(b, "UserStats", ALICE)));
    await assertFails(getDoc(doc(b, "SceneGameHistory", ALICE)));
    await assertFails(getDoc(doc(b, "Users", ALICE, "myRatings", "movie_1")));
    await assertFails(getDoc(doc(b, "Users", ALICE, "bookmarks", "p1")));
  });
});
