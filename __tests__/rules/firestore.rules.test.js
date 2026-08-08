// Firestore güvenlik kurallarının emülatör testleri.
//
// NEDEN AYRI: bu dosya `npm test` ile ÇALIŞMAZ (jest.config.js dışlıyor);
// çalışan bir Firestore emülatörü ister → `npm run test:rules`.
//
// KAPSAM: 2026-08-08 denetiminde bulunan dört yazma açığı (yorum kimliği,
// puanlama agregatı, DM gönderen bağı, doğum tarihi kilidi) ve bu kısıtların
// KIRMAMASI gereken meşru akışlar. Meşru akış testleri en az açık testleri
// kadar önemli: kuralı sıkmak kolay, sıkarken sohbeti bozmamak zor.

const fs = require("fs");
const path = require("path");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  collection,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  deleteField,
  runTransaction,
  serverTimestamp,
} = require("firebase/firestore");

const ALICE = "alice";
const BOB = "bob";
const CAROL = "carol";
// chatId biçimi "uidKüçük_uidBüyük" (screens/chat/ChatScreen.js kurar).
const CHAT = `${ALICE}_${BOB}`;
const KEY = "movie_550";

let testEnv;
let alice;
let bob;
let carol;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "seelogd-rules-test",
    firestore: {
      rules: fs.readFileSync(
        path.join(__dirname, "..", "..", "firestore.rules"),
        "utf8",
      ),
      // firebase.json → emulators.firestore.port ile aynı olmalı. 8080 değil:
      // o port geliştirme makinelerinde sık dolu oluyor.
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
});

/** Kuralları atlayarak başlangıç verisi yaz (test kurulumu). */
const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

// ─────────────────────────────────────────────────────────────────────────────
// 1) Film/dizi yorumları: create dokümandaki userId ile kimliği bağlamalı
// ─────────────────────────────────────────────────────────────────────────────
describe("yorum create kimlik bagi", () => {
  const yorum = (userId) => ({
    userId,
    username: "Test",
    text: "merhaba",
    isSpoiler: false,
    parentId: null,
    likeCount: 0,
    likedBy: {},
    replyCount: 0,
  });

  test("kendi uid'iyle film yorumu yazabilir", async () => {
    await assertSucceeds(
      addDoc(collection(alice, "MovieComment", "550", "comments"), yorum(ALICE)),
    );
  });

  test("BASKASININ uid'iyle film yorumu yazamaz", async () => {
    await assertFails(
      addDoc(collection(alice, "MovieComment", "550", "comments"), yorum(BOB)),
    );
  });

  test("BASKASININ uid'iyle film yorumuna yanit yazamaz", async () => {
    await seed((db) =>
      setDoc(doc(db, "MovieComment", "550", "comments", "c1"), yorum(BOB)),
    );
    await assertFails(
      addDoc(
        collection(alice, "MovieComment", "550", "comments", "c1", "replies"),
        yorum(BOB),
      ),
    );
  });

  test("kendi uid'iyle dizi yorumu yazabilir, baskasininkiyle yazamaz", async () => {
    await assertSucceeds(
      addDoc(collection(alice, "TvComment", "1399", "comments"), yorum(ALICE)),
    );
    await assertFails(
      addDoc(collection(alice, "TvComment", "1399", "comments"), yorum(CAROL)),
    );
  });

  test("baskasinin yorumunda begeni sayaci hala guncellenebilir", async () => {
    await seed((db) =>
      setDoc(doc(db, "MovieComment", "550", "comments", "c1"), yorum(BOB)),
    );
    await assertSucceeds(
      updateDoc(doc(alice, "MovieComment", "550", "comments", "c1"), {
        likeCount: 1,
        likedBy: { [ALICE]: true },
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) Puanlama agregatı: yazım, kullanıcının kendi oyuyla tutarlı olmalı
// ─────────────────────────────────────────────────────────────────────────────
describe("Ratings agregati", () => {
  // services/ratingsService.js → setMyRating'in kural açısından önemli olan
  // kısmı: iki doküman TEK transaction'da yazılır.
  const oyVer = (db, uid, deger) =>
    runTransaction(db, async (tx) => {
      const aggRef = doc(db, "Ratings", KEY);
      const userRef = doc(db, "Ratings", KEY, "userRatings", uid);
      const aggSnap = await tx.get(aggRef);
      const userSnap = await tx.get(userRef);
      const agg = aggSnap.exists() ? aggSnap.data() : { count: 0, sum: 0 };
      let count = agg.count || 0;
      let sum = agg.sum || 0;
      if (userSnap.exists()) sum += deger - (userSnap.data().rating || 0);
      else {
        count += 1;
        sum += deger;
      }
      tx.set(userRef, { rating: deger, updatedAt: serverTimestamp() });
      tx.set(
        aggRef,
        {
          mediaType: "movie",
          mediaId: "550",
          count: Math.max(0, count),
          sum: Math.max(0, sum),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });

  const oyKaldir = (db, uid) =>
    runTransaction(db, async (tx) => {
      const aggRef = doc(db, "Ratings", KEY);
      const userRef = doc(db, "Ratings", KEY, "userRatings", uid);
      const userSnap = await tx.get(userRef);
      const aggSnap = await tx.get(aggRef);
      const agg = aggSnap.exists() ? aggSnap.data() : { count: 0, sum: 0 };
      const prev = userSnap.data().rating || 0;
      tx.delete(userRef);
      tx.set(
        aggRef,
        {
          mediaType: "movie",
          mediaId: "550",
          count: Math.max(0, (agg.count || 0) - 1),
          sum: Math.max(0, (agg.sum || 0) - prev),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });

  test("ilk oy: agregat acilabilir", async () => {
    await assertSucceeds(oyVer(alice, ALICE, 7.5));
    const snap = await getDoc(doc(alice, "Ratings", KEY));
    expect(snap.data()).toMatchObject({ count: 1, sum: 7.5 });
  });

  test("ikinci kullanicinin oyu sayaci 1 artirir", async () => {
    await oyVer(alice, ALICE, 7.5);
    await assertSucceeds(oyVer(bob, BOB, 4));
    const snap = await getDoc(doc(alice, "Ratings", KEY));
    expect(snap.data()).toMatchObject({ count: 2, sum: 11.5 });
  });

  test("kendi oyunu degistirmek sayaci degil toplami oynatir", async () => {
    await oyVer(alice, ALICE, 7.5);
    await assertSucceeds(oyVer(alice, ALICE, 2));
    const snap = await getDoc(doc(alice, "Ratings", KEY));
    expect(snap.data()).toMatchObject({ count: 1, sum: 2 });
  });

  test("kendi oyunu kaldirmak agregati dusurur", async () => {
    await oyVer(alice, ALICE, 7.5);
    await oyVer(bob, BOB, 4);
    await assertSucceeds(oyKaldir(bob, BOB));
    const snap = await getDoc(doc(alice, "Ratings", KEY));
    expect(snap.data()).toMatchObject({ count: 1, sum: 7.5 });
  });

  test("OY VERMEDEN agregat acilamaz", async () => {
    await assertFails(
      setDoc(doc(alice, "Ratings", KEY), {
        mediaType: "movie",
        mediaId: "550",
        count: 1,
        sum: 10,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("oy vermis kullanici bile agregati tek basina sisiremez", async () => {
    await oyVer(alice, ALICE, 7.5);
    await assertFails(
      updateDoc(doc(alice, "Ratings", KEY), {
        count: 1,
        sum: 10,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(alice, "Ratings", KEY), {
        count: 999,
        sum: 9990,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("baskasinin oy dokumanina yazilamaz", async () => {
    await assertFails(
      setDoc(doc(alice, "Ratings", KEY, "userRatings", BOB), { rating: 10 }),
    );
  });

  test("agregat silinemez", async () => {
    await oyVer(alice, ALICE, 7.5);
    await assertFails(deleteDoc(doc(alice, "Ratings", KEY)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) DM mesajları: gönderen bağı + karşı tarafın meşru güncellemeleri
// ─────────────────────────────────────────────────────────────────────────────
describe("DM mesajlari", () => {
  const mesaj = (senderId, extra = {}) => ({
    senderId,
    text: "selam",
    status: "sent",
    ...extra,
  });

  test("uye kendi uid'iyle mesaj yazabilir", async () => {
    await assertSucceeds(
      addDoc(collection(alice, "chats", CHAT, "messages"), mesaj(ALICE)),
    );
  });

  test("uye KARSI TARAFIN agzindan mesaj yazamaz", async () => {
    await assertFails(
      addDoc(collection(alice, "chats", CHAT, "messages"), mesaj(BOB)),
    );
  });

  test("sohbetin disindaki kullanici okuyamaz ve yazamaz", async () => {
    await seed((db) => setDoc(doc(db, "chats", CHAT, "messages", "m1"), mesaj(ALICE)));
    await assertFails(getDoc(doc(carol, "chats", CHAT, "messages", "m1")));
    await assertFails(
      addDoc(collection(carol, "chats", CHAT, "messages"), mesaj(CAROL)),
    );
  });

  test("gonderen kendi metnini duzenleyebilir", async () => {
    await seed((db) => setDoc(doc(db, "chats", CHAT, "messages", "m1"), mesaj(ALICE)));
    await assertSucceeds(
      updateDoc(doc(alice, "chats", CHAT, "messages", "m1"), {
        text: "duzeltildi",
        edited: true,
      }),
    );
  });

  test("alici KARSI TARAFIN metnini duzenleyemez", async () => {
    await seed((db) => setDoc(doc(db, "chats", CHAT, "messages", "m1"), mesaj(ALICE)));
    await assertFails(
      updateDoc(doc(bob, "chats", CHAT, "messages", "m1"), {
        text: "carpitildi",
        edited: true,
      }),
    );
  });

  test("makbuz: gonderen delivered, alici seen yazar", async () => {
    await seed((db) => setDoc(doc(db, "chats", CHAT, "messages", "m1"), mesaj(ALICE)));
    await assertSucceeds(
      updateDoc(doc(alice, "chats", CHAT, "messages", "m1"), {
        status: "delivered",
        deliveredAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(bob, "chats", CHAT, "messages", "m1"), { status: "seen" }),
    );
  });

  test("makbuz baska alanlari tasiyamaz", async () => {
    await seed((db) => setDoc(doc(db, "chats", CHAT, "messages", "m1"), mesaj(ALICE)));
    await assertFails(
      updateDoc(doc(bob, "chats", CHAT, "messages", "m1"), {
        status: "seen",
        text: "carpitildi",
      }),
    );
  });

  test("ankette yalniz KENDI oy anahtari degistirilebilir", async () => {
    await seed((db) =>
      setDoc(
        doc(db, "chats", CHAT, "messages", "p1"),
        mesaj(ALICE, {
          kind: "poll",
          poll: {
            question: "hangisi?",
            type: "text",
            options: [{ id: "o0", label: "A" }],
            votes: {},
          },
        }),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(bob, "chats", CHAT, "messages", "p1"), {
        [`poll.votes.${BOB}`]: "o0",
      }),
    );
    await assertFails(
      updateDoc(doc(bob, "chats", CHAT, "messages", "p1"), {
        [`poll.votes.${ALICE}`]: "o0",
      }),
    );
    await assertFails(
      updateDoc(doc(bob, "chats", CHAT, "messages", "p1"), {
        "poll.question": "degistirildi",
      }),
    );
  });

  test("silme UYE bazinda kalir (hesap silme purge'u icin) — bilincli", async () => {
    await seed((db) => setDoc(doc(db, "chats", CHAT, "messages", "m1"), mesaj(ALICE)));
    // Karşı tarafın mesajını silebilmek BİLEREK açık: purge sohbeti
    // boşaltırken iki tarafın mesajlarını da temizliyor (yol haritası D7
    // sunucu süpürücüsü gelince gönderen şartına inecek).
    await assertSucceeds(deleteDoc(doc(bob, "chats", CHAT, "messages", "m1")));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4) Doğum tarihi: bir kez yazılır, sonra kilitli
// ─────────────────────────────────────────────────────────────────────────────
describe("birthDate kilidi", () => {
  const profil = (extra = {}) => ({
    uid: ALICE,
    username: "alice",
    usernameLower: "alice",
    displayName: "Alice",
    friendsCount: 0,
    ...extra,
  });

  test("alani olmayan hesap bir kez yazabilir", async () => {
    await seed((db) => setDoc(doc(db, "Users", ALICE), profil()));
    await assertSucceeds(
      updateDoc(doc(alice, "Users", ALICE), { birthDate: "1998-03-05" }),
    );
  });

  test("yazilmis tarih DEGISTIRILEMEZ", async () => {
    await seed((db) =>
      setDoc(doc(db, "Users", ALICE), profil({ birthDate: "1998-03-05" })),
    );
    await assertFails(
      updateDoc(doc(alice, "Users", ALICE), { birthDate: "2010-01-01" }),
    );
  });

  test("yazilmis tarih SILINEMEZ", async () => {
    await seed((db) =>
      setDoc(doc(db, "Users", ALICE), profil({ birthDate: "1998-03-05" })),
    );
    await assertFails(
      updateDoc(doc(alice, "Users", ALICE), { birthDate: deleteField() }),
    );
  });

  test("tarih dururken diger alanlar guncellenebilir", async () => {
    await seed((db) =>
      setDoc(doc(db, "Users", ALICE), profil({ birthDate: "1998-03-05" })),
    );
    await assertSucceeds(
      updateDoc(doc(alice, "Users", ALICE), { displayName: "Alice B" }),
    );
  });

  test("baskasinin sayac cross-write'i bozulmadi", async () => {
    await seed((db) =>
      setDoc(doc(db, "Users", ALICE), profil({ birthDate: "1998-03-05" })),
    );
    await assertSucceeds(
      updateDoc(doc(bob, "Users", ALICE), { friendsCount: 1 }),
    );
  });

  test("baskasi dogum tarihini yazamaz", async () => {
    await seed((db) => setDoc(doc(db, "Users", ALICE), profil()));
    await assertFails(
      updateDoc(doc(bob, "Users", ALICE), { birthDate: "2010-01-01" }),
    );
  });
});
