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
  getDocs,
  query,
  where,
  deleteField,
  runTransaction,
  serverTimestamp,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
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

describe("important invitation responses", () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "Users", BOB, "notifications", "invite"), {
        type: "cineswipe_invite", fromUid: ALICE, read: false, inviteCode: "123456",
      });
      await setDoc(doc(db, "Users", BOB, "notifications", "ordinary"), {
        type: "message", fromUid: ALICE, read: false,
      });
    });
  });

  test("recipient can accept once; sender and later changes cannot alter decision", async () => {
    const ref = doc(bob, "Users", BOB, "notifications", "invite");
    await assertSucceeds(updateDoc(ref, { read: true, response: "accepted" }));
    await assertFails(updateDoc(ref, { response: "declined" }));
    await assertFails(updateDoc(doc(alice, "Users", BOB, "notifications", "invite"), { response: "declined" }));
  });

  test("ordinary messages cannot gain a response field", async () => {
    await assertFails(updateDoc(doc(bob, "Users", BOB, "notifications", "ordinary"), { response: "accepted" }));
  });
});

describe("ortak liste siralama yetkisi", () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "SharedLists", "shared-1"), {
        name: "Ortak",
        ownerId: ALICE,
        memberIds: [ALICE, BOB],
        members: {
          [ALICE]: { canAdd: true, canRemove: true },
          [BOB]: { canAdd: false, canRemove: false, canReorder: true },
        },
      });
      await setDoc(doc(db, "SharedLists", "shared-1", "items", KEY), {
        id: 550,
        type: "movie",
        name: "Fight Club",
        addedBy: ALICE,
      });
    });
  });

  test("uye yalniz listOrder alanini guncelleyebilir", async () => {
    await assertSucceeds(
      updateDoc(doc(bob, "SharedLists", "shared-1", "items", KEY), {
        listOrder: 2,
      }),
    );
  });

  test("uye siralama izniyle icerik verisini degistiremez", async () => {
    await assertFails(
      updateDoc(doc(bob, "SharedLists", "shared-1", "items", KEY), {
        listOrder: 2,
        name: "Degistirildi",
      }),
    );
  });

  test("uye olmayan kisi sirayi degistiremez", async () => {
    await assertFails(
      updateDoc(doc(carol, "SharedLists", "shared-1", "items", KEY), {
        listOrder: 1,
      }),
    );
  });

  test("canReorder yetkisi olmayan uye sirayi degistiremez", async () => {
    await seed((db) =>
      updateDoc(doc(db, "SharedLists", "shared-1"), {
        [`members.${BOB}.canReorder`]: false,
      }),
    );
    await assertFails(
      updateDoc(doc(bob, "SharedLists", "shared-1", "items", KEY), {
        listOrder: 3,
      }),
    );
  });
});

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

  // Okundu işareti (utils/chatReceipts.js): ChatScreen sohbet belgesine
  // readAt.{uid} + üst düzey participants yazar; karşı taraf belgeyi dinler.
  // Hesap silme `participants array-contains` sorgusuyla bu belgeyi bulur.
  test("uye okundu isaretini yazar, karsi taraf okur; participants sorgusu bulur", async () => {
    await assertSucceeds(
      setDoc(
        doc(bob, "chats", CHAT),
        { readAt: { [BOB]: new Date(1000) }, participants: [BOB, ALICE] },
        { merge: true },
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(alice, "chats", CHAT),
        { readAt: { [ALICE]: new Date(2000) }, participants: [ALICE, BOB] },
        { merge: true },
      ),
    );
    const snap = await getDoc(doc(alice, "chats", CHAT));
    expect(Object.keys(snap.data().readAt).sort()).toEqual([ALICE, BOB]);
    const found = await getDocs(
      query(collection(bob, "chats"), where("participants", "array-contains", BOB)),
    );
    expect(found.docs.map((d) => d.id)).toEqual([CHAT]);
  });

  test("sohbetin disindaki kullanici okundu isaretini okuyamaz ve yazamaz", async () => {
    await seed((db) => setDoc(doc(db, "chats", CHAT), { readAt: {}, participants: [ALICE, BOB] }));
    await assertFails(getDoc(doc(carol, "chats", CHAT)));
    await assertFails(
      setDoc(doc(carol, "chats", CHAT), { readAt: { [CAROL]: new Date() } }, { merge: true }),
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

  test("duello karti: alici yalniz KENDI kabul anahtarini yazar", async () => {
    await seed((db) =>
      setDoc(
        doc(db, "chats", CHAT, "messages", "c1"),
        mesaj(ALICE, { kind: "challengeShare", share: { type: "challenge", dayKey: "2026-10-27", score: 7450 } }),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(bob, "chats", CHAT, "messages", "c1"), { [`accepts.${BOB}`]: serverTimestamp() }),
    );
    // Başkası adına kabul, uydurma zaman, kart içeriği ve gönderenin kendi kabulü reddedilir.
    await assertFails(
      updateDoc(doc(bob, "chats", CHAT, "messages", "c1"), { [`accepts.${ALICE}`]: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(bob, "chats", CHAT, "messages", "c1"), { [`accepts.${BOB}`]: "dun" }),
    );
    await assertFails(
      updateDoc(doc(bob, "chats", CHAT, "messages", "c1"), { "share.score": 99999 }),
    );
    await assertFails(
      updateDoc(doc(alice, "chats", CHAT, "messages", "c1"), { [`accepts.${ALICE}`]: serverTimestamp() }),
    );
    // Düz mesaja kabul anahtarı yazılamaz.
    await seed((db) => setDoc(doc(db, "chats", CHAT, "messages", "m1"), mesaj(ALICE)));
    await assertFails(
      updateDoc(doc(bob, "chats", CHAT, "messages", "m1"), { [`accepts.${BOB}`]: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(bob, "chats", CHAT, "messages", "m1"), { [`declines.${BOB}`]: serverTimestamp() }),
    );
  });

  test("davet karti: alici reddeder; tek yon (reddeden kabul edemez, kabul eden reddedemez)", async () => {
    const kart = (id, kind, share) => seed((db) => setDoc(doc(db, "chats", CHAT, "messages", id), mesaj(ALICE, { kind, share })));
    await kart("c1", "challengeShare", { type: "challenge", dayKey: "2026-10-29", score: 7450 });
    await kart("r1", "cineRoomShare", { type: "cineRoom", code: "123456" });
    const ref = (db, id) => doc(db, "chats", CHAT, "messages", id);

    await assertSucceeds(updateDoc(ref(bob, "c1"), { [`declines.${BOB}`]: serverTimestamp() }));
    await assertFails(updateDoc(ref(bob, "c1"), { [`accepts.${BOB}`]: serverTimestamp() }));
    // CineSwipe odası: kabul (katılmak) da mesaja yazılır; kabulden sonra ret yok.
    await assertSucceeds(updateDoc(ref(bob, "r1"), { [`accepts.${BOB}`]: serverTimestamp() }));
    await assertFails(updateDoc(ref(bob, "r1"), { [`declines.${BOB}`]: serverTimestamp() }));
    // Başkası adına, uydurma zamanla, gönderenin kendi davetine ve iki alan birden yazılamaz.
    await assertFails(updateDoc(ref(bob, "r1"), { [`declines.${ALICE}`]: serverTimestamp() }));
    await assertFails(updateDoc(ref(alice, "r1"), { [`declines.${ALICE}`]: serverTimestamp() }));
    await kart("r2", "cineRoomShare", { type: "cineRoom", code: "654321" });
    await assertFails(updateDoc(ref(bob, "r2"), { [`declines.${BOB}`]: "dun" }));
    await assertFails(
      updateDoc(ref(bob, "r2"), { [`accepts.${BOB}`]: serverTimestamp(), [`declines.${BOB}`]: serverTimestamp() }),
    );
    await assertFails(updateDoc(ref(bob, "r2"), { "share.code": "111111" }));
  });

  test("CineSwipe karti: oda bitince iki uyeden biri BIR KEZ 'tamamlandi' yazar", async () => {
    const ref = (db, id) => doc(db, "chats", CHAT, "messages", id);
    await seed((db) => setDoc(ref(db, "r1"), mesaj(ALICE, { kind: "cineRoomShare", share: { type: "cineRoom", code: "123456" } })));
    await seed((db) => setDoc(ref(db, "r2"), mesaj(ALICE, { kind: "cineRoomShare", share: { type: "cineRoom", code: "654321" } })));
    await seed((db) => setDoc(ref(db, "c1"), mesaj(ALICE, { kind: "challengeShare", share: { type: "challenge" } })));

    // Bozuk şekil / uydurma zaman / sınır dışı sayı reddedilir.
    await assertFails(updateDoc(ref(bob, "r1"), { done: { at: serverTimestamp(), matches: -1 } }));
    await assertFails(updateDoc(ref(bob, "r1"), { done: { at: "dun", matches: 2 } }));
    await assertFails(updateDoc(ref(bob, "r1"), { done: { at: serverTimestamp(), matches: 2, roomId: "x" } }));
    await assertFails(updateDoc(ref(bob, "r1"), { done: { at: serverTimestamp(), matches: 2 }, text: "x" }));
    // Misafir yazar; sonradan kimse değiştiremez.
    await assertSucceeds(updateDoc(ref(bob, "r1"), { done: { at: serverTimestamp(), matches: 2 } }));
    await assertFails(updateDoc(ref(alice, "r1"), { done: { at: serverTimestamp(), matches: 5 } }));
    // Kurucu (mesajın göndereni) de yazabilir — sırayla odada son oyu o verebilir.
    await assertSucceeds(updateDoc(ref(alice, "r2"), { done: { at: serverTimestamp(), matches: 0 } }));
    // Düello kartına bitiş kaydı yazılamaz.
    await assertFails(updateDoc(ref(bob, "c1"), { done: { at: serverTimestamp(), matches: 1 } }));
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
// 4) Gizli kullanıcı verisi: push token'ları yalnız sahibine
// ─────────────────────────────────────────────────────────────────────────────
describe("Users/{uid}/private", () => {
  const TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

  test("sahibi kendi push dokumanini yazip okuyabilir", async () => {
    await assertSucceeds(
      setDoc(doc(alice, "Users", ALICE, "private", "push"), {
        expoPushToken: TOKEN,
        expoPushTokens: [TOKEN],
      }),
    );
    await assertSucceeds(getDoc(doc(alice, "Users", ALICE, "private", "push")));
  });

  test("BASKA kullanici push dokumanini OKUYAMAZ", async () => {
    await seed((db) =>
      setDoc(doc(db, "Users", ALICE, "private", "push"), {
        expoPushToken: TOKEN,
        expoPushTokens: [TOKEN],
      }),
    );
    // Asıl açık buydu: kök Users dokümanı tüm oturumlulara okunur, token
    // orada dururken herkes hepsini dökebiliyordu.
    await assertFails(getDoc(doc(bob, "Users", ALICE, "private", "push")));
  });

  test("BASKA kullanici push dokumanina YAZAMAZ", async () => {
    await assertFails(
      setDoc(doc(bob, "Users", ALICE, "private", "push"), { expoPushToken: TOKEN }),
    );
  });

  test("oturumsuz kullanici okuyamaz", async () => {
    await seed((db) =>
      setDoc(doc(db, "Users", ALICE, "private", "push"), { expoPushToken: TOKEN }),
    );
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "Users", ALICE, "private", "push")));
  });

  test("kok dokumandaki eski token alanlari sahibince silinebilir", async () => {
    await seed((db) =>
      setDoc(doc(db, "Users", ALICE), {
        uid: ALICE,
        username: "alice",
        usernameLower: "alice",
        displayName: "Alice",
        expoPushToken: TOKEN,
        expoPushTokens: [TOKEN],
        pushTokenUpdatedAt: null,
      }),
    );
    // İstemcinin kendi kendini göç ettirme adımı
    // (services/pushNotificationsService.js).
    await assertSucceeds(
      updateDoc(doc(alice, "Users", ALICE), {
        expoPushToken: deleteField(),
        expoPushTokens: deleteField(),
        pushTokenUpdatedAt: deleteField(),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5) İçerik şikayetleri: yalnız create, yalnız kendi adına
// ─────────────────────────────────────────────────────────────────────────────
describe("ContentReports", () => {
  const rapor = (extra = {}) => ({
    type: "comment",
    targetPath: "MovieComment/550/comments/c1",
    targetPreview: "kotu bir yorum",
    targetUserId: BOB,
    reporterId: ALICE,
    reason: "harassment",
    createdAt: new Date(),
    ...extra,
  });

  test("oturumlu kullanici kendi adina sikayet yazabilir", async () => {
    await assertSucceeds(addDoc(collection(alice, "ContentReports"), rapor()));
  });

  test("uc turun hepsi kabul edilir", async () => {
    for (const type of ["comment", "message", "user"]) {
      await assertSucceeds(
        addDoc(collection(alice, "ContentReports"), rapor({ type })),
      );
    }
  });

  test("BASKASININ adina sikayet yazilamaz", async () => {
    await assertFails(
      addDoc(collection(alice, "ContentReports"), rapor({ reporterId: CAROL })),
    );
  });

  test("kendini sikayet edemez", async () => {
    await assertFails(
      addDoc(collection(alice, "ContentReports"), rapor({ targetUserId: ALICE })),
    );
  });

  test("bilinmeyen tur reddedilir", async () => {
    await assertFails(
      addDoc(collection(alice, "ContentReports"), rapor({ type: "post" })),
    );
  });

  test("fazladan alan reddedilir", async () => {
    await assertFails(
      addDoc(collection(alice, "ContentReports"), rapor({ adminNote: "x" })),
    );
  });

  test("asiri uzun onizleme reddedilir", async () => {
    await assertFails(
      addDoc(
        collection(alice, "ContentReports"),
        rapor({ targetPreview: "a".repeat(301) }),
      ),
    );
  });

  test("hicbir kullanici okuyamaz, guncelleyemez, silemez", async () => {
    let id;
    await seed(async (db) => {
      const ref = await addDoc(collection(db, "ContentReports"), rapor());
      id = ref.id;
    });
    await assertFails(getDoc(doc(alice, "ContentReports", id)));
    await assertFails(updateDoc(doc(alice, "ContentReports", id), { reason: "spam" }));
    await assertFails(deleteDoc(doc(alice, "ContentReports", id)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6) Doğum tarihi: bir kez yazılır, sonra kilitli
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

// ─────────────────────────────────────────────────────────────────────────────
// 6b) Gizli hesap belgesi: e-posta + doğum tarihi yalnız sahibine
//     (docs/mimari/KULLANICI_OZEL_ALAN_GOCU.md)
// ─────────────────────────────────────────────────────────────────────────────
describe("Users/{uid}/private/account", () => {
  const account = (db, uid = ALICE) => doc(db, "Users", uid, "private", "account");
  const profil = (extra = {}) => ({
    uid: ALICE,
    username: "alice",
    usernameLower: "alice",
    displayName: "Alice",
    friendsCount: 0,
    ...extra,
  });

  test("sahibi e-posta + dogum tarihini yazip okuyabilir", async () => {
    await assertSucceeds(
      setDoc(account(alice), { email: "a@b.co", birthDate: "1998-03-05" }),
    );
    await assertSucceeds(getDoc(account(alice)));
  });

  test("BASKA kullanici OKUYAMAZ — asil acik buydu", async () => {
    await seed((db) =>
      setDoc(account(db), { email: "a@b.co", birthDate: "1998-03-05" }),
    );
    await assertFails(getDoc(account(bob)));
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(account(anon)));
  });

  test("BASKA kullanici YAZAMAZ", async () => {
    await assertFails(setDoc(account(bob, ALICE), { birthDate: "2010-01-01" }));
  });

  test("kok belge hala herkese okunur ama artik bu alanlari tasimaz", async () => {
    // Kural okuma yolunu kapatamaz (alan bazlı okuma yok) — kapatan şey
    // alanların kökte OLMAMASI. Bu test sözleşmeyi yazıyor: göçten sonra kökte
    // bulunmayan alan, başkasının okuduğu belgede de yoktur.
    await seed(async (db) => {
      await setDoc(doc(db, "Users", ALICE), profil());
      await setDoc(account(db), { email: "a@b.co", birthDate: "1998-03-05" });
    });
    const snap = await getDoc(doc(bob, "Users", ALICE));
    expect(snap.data()).not.toHaveProperty("birthDate");
    expect(snap.data()).not.toHaveProperty("email");
  });

  test("yazilmis tarih DEGISTIRILEMEZ ve SILINEMEZ", async () => {
    await seed((db) => setDoc(account(db), { birthDate: "1998-03-05" }));
    await assertFails(updateDoc(account(alice), { birthDate: "2010-01-01" }));
    await assertFails(updateDoc(account(alice), { birthDate: deleteField() }));
  });

  test("tarih dururken e-posta guncellenebilir", async () => {
    await seed((db) =>
      setDoc(account(db), { email: "a@b.co", birthDate: "1998-03-05" }),
    );
    await assertSucceeds(updateDoc(account(alice), { email: "yeni@b.co" }));
  });

  test("tarihi olmayan hesap bir kez yazabilir", async () => {
    await seed((db) => setDoc(account(db), { email: "a@b.co" }));
    await assertSucceeds(updateDoc(account(alice), { birthDate: "1998-03-05" }));
  });

  test("bilinmeyen alan ve bozuk bicim reddedilir", async () => {
    await assertFails(setDoc(account(alice), { email: "a@b.co", isAdmin: true }));
    await assertFails(setDoc(account(alice), { birthDate: "1998" }));
    await assertFails(setDoc(account(alice), { birthDate: 19980305 }));
    await assertFails(setDoc(account(alice), { email: "x".repeat(400) }));
    await assertFails(setDoc(account(alice), { email: 12345 }));
  });

  test("kokte tarih varsa gizli kopya onunla CELISEMEZ", async () => {
    await seed((db) =>
      setDoc(doc(db, "Users", ALICE), profil({ birthDate: "1998-03-05" })),
    );
    // Küçük görünmek için ikinci bir tarih yazma yolu kapalı:
    await assertFails(setDoc(account(alice), { birthDate: "2010-01-01" }));
    await assertSucceeds(setDoc(account(alice), { birthDate: "1998-03-05" }));
  });

  test("GOC: gizli kopya hazirsa sahibi tarihi ve e-postayi kokten silebilir", async () => {
    await seed(async (db) => {
      await setDoc(
        doc(db, "Users", ALICE),
        profil({ birthDate: "1998-03-05", email: "a@b.co" }),
      );
      await setDoc(account(db), { email: "a@b.co", birthDate: "1998-03-05" });
    });
    await assertSucceeds(
      updateDoc(doc(alice, "Users", ALICE), {
        birthDate: deleteField(),
        email: deleteField(),
      }),
    );
  });

  test("GOC: gizli kopya YOKKEN ya da FARKLIYKEN kokten silinemez", async () => {
    await seed((db) =>
      setDoc(doc(db, "Users", ALICE), profil({ birthDate: "1998-03-05" })),
    );
    // Kopya yok → silmek yaş kaydını yok ederdi.
    await assertFails(
      updateDoc(doc(alice, "Users", ALICE), { birthDate: deleteField() }),
    );
    await seed((db) => setDoc(account(db), { birthDate: "2010-01-01" }));
    await assertFails(
      updateDoc(doc(alice, "Users", ALICE), { birthDate: deleteField() }),
    );
  });

  test("GOC SONRASI: kokte tarih yeniden yazilirsa gizli kopyayla ayni olmali", async () => {
    // Eski istemci tarihi kökte "boş" görüp seçici açabilir; farklı bir tarihi
    // yazamamalı (18 altı kullanıcı kapıyı açmasın).
    await seed(async (db) => {
      await setDoc(doc(db, "Users", ALICE), profil());
      await setDoc(account(db), { birthDate: "2010-01-01" });
    });
    await assertFails(
      updateDoc(doc(alice, "Users", ALICE), { birthDate: "1990-01-01" }),
    );
    await assertSucceeds(
      updateDoc(doc(alice, "Users", ALICE), { birthDate: "2010-01-01" }),
    );
  });

  test("sahibi gizli belgesini silebilir (hesap silme purge'u)", async () => {
    await seed((db) => setDoc(account(db), { email: "a@b.co" }));
    await assertSucceeds(deleteDoc(account(alice)));
  });

  test("ESKI ISTEMCI uyumu: kayit ekrani e-posta + tarihi hala kok belgeye yazabilir", async () => {
    // Aşama 3 anahtarı açıkken (şimdiki durum) bozulmamalı.
    await assertSucceeds(
      setDoc(doc(alice, "Users", ALICE), profil({
        email: "a@b.co",
        birthDate: "1998-03-05",
      })),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6c) AŞAMA 3: legacyRootAccountWrites() = false
//     Anahtar kuralların içinde sabit `true`; deploy edilmeden önce burada
//     metin olarak çevrilip ayrı bir proje kimliğinde denenir.
// ─────────────────────────────────────────────────────────────────────────────
describe("Asama 3 anahtari kapali (kokte ozel alan yazimi yasak)", () => {
  let strictEnv;
  let sAlice;
  let sBob;

  const profil = (extra = {}) => ({
    uid: ALICE,
    username: "alice",
    usernameLower: "alice",
    displayName: "Alice",
    friendsCount: 0,
    ...extra,
  });

  beforeAll(async () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "..", "firestore.rules"),
      "utf8",
    );
    const strict = source.replace(
      /(function legacyRootAccountWrites\(\) \{ return )true;/,
      "$1false;",
    );
    // Çeviri sessizce tutmazsa bu blok hiçbir şeyi kanıtlamaz.
    expect(strict).not.toBe(source);
    strictEnv = await initializeTestEnvironment({
      projectId: "seelogd-rules-test-strict",
      firestore: { rules: strict, host: "127.0.0.1", port: 8085 },
    });
  });

  afterAll(async () => {
    if (strictEnv) await strictEnv.cleanup();
  });

  beforeEach(async () => {
    await strictEnv.clearFirestore();
    sAlice = strictEnv.authenticatedContext(ALICE).firestore();
    sBob = strictEnv.authenticatedContext(BOB).firestore();
  });

  const sSeed = (fn) =>
    strictEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

  test("yeni profil kok belgede e-posta/tarih/jeton TASIYAMAZ", async () => {
    await assertFails(
      setDoc(doc(sAlice, "Users", ALICE), profil({ email: "a@b.co" })),
    );
    await assertFails(
      setDoc(doc(sAlice, "Users", ALICE), profil({ birthDate: "1998-03-05" })),
    );
    await assertFails(
      setDoc(doc(sAlice, "Users", ALICE), profil({ expoPushTokens: ["t"] })),
    );
  });

  test("yeni profil bu alanlar OLMADAN acilir, gizli belge yazilabilir", async () => {
    await assertSucceeds(setDoc(doc(sAlice, "Users", ALICE), profil()));
    await assertSucceeds(
      setDoc(doc(sAlice, "Users", ALICE, "private", "account"), {
        email: "a@b.co",
        birthDate: "1998-03-05",
      }),
    );
  });

  test("kokte e-posta/tarih/jeton EKLENEMEZ", async () => {
    await sSeed((db) => setDoc(doc(db, "Users", ALICE), profil()));
    await assertFails(
      updateDoc(doc(sAlice, "Users", ALICE), { email: "a@b.co" }),
    );
    await assertFails(
      updateDoc(doc(sAlice, "Users", ALICE), { birthDate: "1998-03-05" }),
    );
    await assertFails(
      updateDoc(doc(sAlice, "Users", ALICE), { expoPushToken: "t" }),
    );
  });

  test("kokteki eski alanlar SILINEBILIR ve digerleri guncellenmeye devam eder", async () => {
    await sSeed(async (db) => {
      await setDoc(
        doc(db, "Users", ALICE),
        profil({
          email: "a@b.co",
          birthDate: "1998-03-05",
          expoPushToken: "t",
          expoPushTokens: ["t"],
        }),
      );
      await setDoc(doc(db, "Users", ALICE, "private", "account"), {
        email: "a@b.co",
        birthDate: "1998-03-05",
      });
    });
    // Eski alanlar dururken ilgisiz yazım (sayaç, profil) engellenmemeli:
    await assertSucceeds(
      updateDoc(doc(sAlice, "Users", ALICE), { displayName: "Alice B" }),
    );
    await assertSucceeds(
      updateDoc(doc(sBob, "Users", ALICE), { friendsCount: 1 }),
    );
    // B3 + bu göç: sahibi kendi kök alanlarını siler.
    await assertSucceeds(
      updateDoc(doc(sAlice, "Users", ALICE), {
        email: deleteField(),
        birthDate: deleteField(),
        expoPushToken: deleteField(),
        expoPushTokens: deleteField(),
      }),
    );
  });

  test("gizli belge kurallari anahtardan bagimsiz calisir", async () => {
    await sSeed((db) =>
      setDoc(doc(db, "Users", ALICE, "private", "account"), {
        birthDate: "1998-03-05",
      }),
    );
    await assertFails(
      updateDoc(doc(sAlice, "Users", ALICE, "private", "account"), {
        birthDate: "2010-01-01",
      }),
    );
    await assertFails(getDoc(doc(sBob, "Users", ALICE, "private", "account")));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dört favori: kategori başına en fazla 4 giriş (utils/fourFavorites.js)
// ─────────────────────────────────────────────────────────────────────────────
describe("dort favori siniri", () => {
  const profil = (extra = {}) => ({
    uid: ALICE,
    username: "alice",
    usernameLower: "alice",
    displayName: "Alice",
    friendsCount: 0,
    ...extra,
  });
  const giris = (id) => ({ id, title: `Baslik ${id}`, image: `/p${id}.jpg` });
  const liste = (n) => Array.from({ length: n }, (_, i) => giris(i + 1));

  test("alani olmayan profil yine guncellenebilir (eski hesaplar)", async () => {
    await seed((db) => setDoc(doc(db, "Users", ALICE), profil()));
    await assertSucceeds(
      updateDoc(doc(alice, "Users", ALICE), { displayName: "Alice B" }),
    );
  });

  test("her kategoride 4 girise kadar yazilabilir", async () => {
    await seed((db) => setDoc(doc(db, "Users", ALICE), profil()));
    await assertSucceeds(
      updateDoc(doc(alice, "Users", ALICE), {
        fourFavorites: { movies: liste(4), shows: liste(4), people: liste(4) },
      }),
    );
  });

  test("bos kategoriler ve eksik kategori gecerli (0 favori de serbest)", async () => {
    await seed((db) => setDoc(doc(db, "Users", ALICE), profil()));
    await assertSucceeds(
      updateDoc(doc(alice, "Users", ALICE), {
        fourFavorites: { movies: [], shows: [], people: [] },
      }),
    );
    await assertSucceeds(
      updateDoc(doc(alice, "Users", ALICE), { fourFavorites: { movies: liste(1) } }),
    );
  });

  test("5. giris reddedilir", async () => {
    await seed((db) => setDoc(doc(db, "Users", ALICE), profil()));
    await assertFails(
      updateDoc(doc(alice, "Users", ALICE), {
        fourFavorites: { movies: liste(5), shows: [], people: [] },
      }),
    );
  });

  test("bilinmeyen kategori ve dizi olmayan deger reddedilir", async () => {
    await seed((db) => setDoc(doc(db, "Users", ALICE), profil()));
    await assertFails(
      updateDoc(doc(alice, "Users", ALICE), { fourFavorites: { books: liste(1) } }),
    );
    await assertFails(
      updateDoc(doc(alice, "Users", ALICE), { fourFavorites: { movies: "x" } }),
    );
    await assertFails(
      updateDoc(doc(alice, "Users", ALICE), { fourFavorites: "x" }),
    );
  });

  test("tohum alan da kural icinde olusturulabilir, sismis olani olusturulamaz", async () => {
    await assertSucceeds(
      setDoc(doc(alice, "Users", ALICE), profil({ fourFavorites: { movies: liste(2) } })),
    );
    await assertFails(
      setDoc(doc(alice, "Users", ALICE), profil({ fourFavorites: { movies: liste(9) } })),
    );
  });

  test("baskasinin favorilerini yazamaz", async () => {
    await seed((db) => setDoc(doc(db, "Users", ALICE), profil()));
    await assertFails(
      updateDoc(doc(bob, "Users", ALICE), { fourFavorites: { movies: liste(1) } }),
    );
  });

  test("favoriler arkadasin profil okumasini bozmaz", async () => {
    await seed((db) =>
      setDoc(doc(db, "Users", ALICE), profil({ fourFavorites: { movies: liste(2) } })),
    );
    await assertSucceeds(getDoc(doc(bob, "Users", ALICE)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Premium yetkileri ve kimlik rozetleri yalnız sunucuya ait
// (functions/index.js revenueCatWebhook + syncPremiumStatus yazar).
// ─────────────────────────────────────────────────────────────────────────────
describe("premium ve rozet alanlari", () => {
  const profil = (extra = {}) => ({
    uid: ALICE,
    username: "alice",
    usernameLower: "alice",
    displayName: "Alice",
    friendsCount: 0,
    ...extra,
  });

  test("kullanici kendini premium yapamaz (create ve update)", async () => {
    await assertFails(
      setDoc(doc(alice, "Users", ALICE), profil({ entitlements: { premium: true } })),
    );
    await seed((db) => setDoc(doc(db, "Users", ALICE), profil()));
    await assertFails(
      updateDoc(doc(alice, "Users", ALICE), { "entitlements.premiumPlan": "unlimited" }),
    );
  });

  test("kullanici kendine kurucu rozeti yazamaz (create ve update)", async () => {
    await assertFails(
      setDoc(doc(alice, "Users", ALICE), profil({ badges: { founder: true } })),
    );
    await seed((db) => setDoc(doc(db, "Users", ALICE), profil()));
    await assertFails(
      updateDoc(doc(alice, "Users", ALICE), { badges: { founder: true } }),
    );
  });

  test("sunucunun yazdigi rozet ve plan dururken profil guncellenebilir", async () => {
    await seed((db) =>
      setDoc(
        doc(db, "Users", ALICE),
        profil({
          badges: { founder: true },
          entitlements: { premium: true, premiumPlan: "premium" },
        }),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(alice, "Users", ALICE), { displayName: "Alice B" }),
    );
  });

  test("arkadasin plani rozet icin okunabilir", async () => {
    await seed((db) =>
      setDoc(
        doc(db, "Users", ALICE),
        profil({ entitlements: { premium: true, premiumPlan: "unlimited" } }),
      ),
    );
    await assertSucceeds(getDoc(doc(bob, "Users", ALICE)));
  });

  test("private/entitlements: sahibi okur ve siler, yazamaz", async () => {
    await seed((db) =>
      setDoc(doc(db, "Users", ALICE, "private", "entitlements"), {
        premiumPlan: "premium",
        expiresAt: null,
      }),
    );
    await assertSucceeds(getDoc(doc(alice, "Users", ALICE, "private", "entitlements")));
    await assertFails(
      setDoc(doc(alice, "Users", ALICE, "private", "entitlements"), {
        premiumPlan: "unlimited",
      }),
    );
    await assertFails(
      updateDoc(doc(alice, "Users", ALICE, "private", "entitlements"), {
        premiumPlan: "unlimited",
      }),
    );
    // Hesap silme (services/accountService.js) private alt koleksiyonunu siler.
    await assertSucceeds(
      deleteDoc(doc(alice, "Users", ALICE, "private", "entitlements")),
    );
  });

  test("private/entitlements baskasina kapali", async () => {
    await seed((db) =>
      setDoc(doc(db, "Users", ALICE, "private", "entitlements"), {
        premiumPlan: "premium",
      }),
    );
    await assertFails(getDoc(doc(bob, "Users", ALICE, "private", "entitlements")));
  });
});

// Grup okunmamış sayacı: Users/{uid}/groupInbox/{groupId}.unread. Gönderen
// mesajla AYNI batch'te diğer üyelerin kaydını increment(1) ile artırır
// (screens/chat/ChatScreen.js → queueThreadWrites → groupsService
// .queueGroupUnreadIncrements), üye sohbeti görünürken kendininkini sıfırlar.
// Başka üye yalnız TAM +1 yazabilir. Eski istemcilerin groups/{id}.unread
// haritası (alttaki "eski istemci" testleri) geçiş süresince kabul ediliyor.
describe("grup okunmamis sayaci", () => {
  const GROUP = "grp-1";
  const groupRef = (db) => doc(db, "groups", GROUP);
  const inboxRef = (db, uid, groupId = GROUP) => doc(db, "Users", uid, "groupInbox", groupId);
  // seed() değer döndürmez; kuralları atlayarak güncel belgeyi okur.
  const readAs = async (refOf) => {
    let data;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      data = (await getDoc(refOf(ctx.firestore()))).data();
    });
    return data;
  };
  const readGroup = () => readAs(groupRef);
  // ChatScreen.postMessage'ın grup batch'i: mesaj + özet + alıcı sayaçları.
  const sendBatch = (db, senderUid, recipients, groupId = GROUP) => {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "groups", groupId, "messages")), {
      text: "selam",
      senderId: senderUid,
      timestamp: serverTimestamp(),
    });
    batch.set(
      doc(db, "groups", groupId),
      {
        lastMessage: { text: "selam", senderId: senderUid, time: serverTimestamp() },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    for (const uid of recipients) {
      batch.set(inboxRef(db, uid, groupId), { unread: increment(1) }, { merge: true });
    }
    return batch.commit();
  };

  beforeEach(async () => {
    await seed((db) =>
      setDoc(groupRef(db), {
        name: "Film Gecesi",
        color: "#6C63FF",
        avatarIndex: 0,
        members: [ALICE, BOB],
        memberInfo: {},
        admins: [],
        createdBy: ALICE,
        lastMessage: null,
        unread: { [BOB]: 2 },
      }),
    );
  });

  test("gonderen mesajla birlikte alicinin gelen kutusunu artirir (ilk kayit + artis)", async () => {
    await assertSucceeds(sendBatch(alice, ALICE, [BOB]));
    expect(await readAs((db) => inboxRef(db, BOB))).toEqual({ unread: 1 });
    await assertSucceeds(sendBatch(alice, ALICE, [BOB]));
    expect(await readAs((db) => inboxRef(db, BOB))).toEqual({ unread: 2 });
    // Grup belgesinin eski haritasına dokunulmaz.
    expect((await readGroup()).unread).toEqual({ [BOB]: 2 });
  });

  test("grupta duello karti: uye yalniz KENDI kabul anahtarini yazar", async () => {
    const cardRef = (db) => doc(db, "groups", GROUP, "messages", "c1");
    await seed((db) =>
      setDoc(cardRef(db), { senderId: ALICE, kind: "challengeShare", share: { type: "challenge" } }),
    );
    await assertSucceeds(updateDoc(cardRef(bob), { [`accepts.${BOB}`]: serverTimestamp() }));
    await assertFails(updateDoc(cardRef(bob), { [`accepts.${ALICE}`]: serverTimestamp() }));
    await assertFails(updateDoc(cardRef(alice), { [`accepts.${ALICE}`]: serverTimestamp() }));
    await assertFails(updateDoc(cardRef(bob), { [`declines.${BOB}`]: serverTimestamp() })); // kabul eden reddedemez
  });

  test("grupta CineSwipe karti: uye reddeder, bitis kaydi bir kez", async () => {
    const cardRef = (db) => doc(db, "groups", GROUP, "messages", "r1");
    await seed((db) =>
      setDoc(cardRef(db), { senderId: ALICE, kind: "cineRoomShare", share: { type: "cineRoom", code: "123456" } }),
    );
    await assertSucceeds(updateDoc(cardRef(bob), { [`declines.${BOB}`]: serverTimestamp() }));
    await assertFails(updateDoc(cardRef(bob), { [`accepts.${BOB}`]: serverTimestamp() }));
    await assertSucceeds(updateDoc(cardRef(alice), { done: { at: serverTimestamp(), matches: 1 } }));
    await assertFails(updateDoc(cardRef(bob), { done: { at: serverTimestamp(), matches: 2 } }));
  });

  test("sahibi kendi sayacini okur ve sifirlar; baskasi okuyamaz", async () => {
    await seed((db) => setDoc(inboxRef(db, BOB), { unread: 4 }));
    await assertSucceeds(getDoc(inboxRef(bob, BOB)));
    await assertSucceeds(updateDoc(inboxRef(bob, BOB), { unread: 0 }));
    expect(await readAs((db) => inboxRef(db, BOB))).toEqual({ unread: 0 });
    await assertFails(getDoc(inboxRef(alice, BOB)));
    await assertSucceeds(deleteDoc(inboxRef(bob, BOB)));
  });

  test("baska uye keyfi deger yazamaz: sifirlama, +2 ya da sabit sayi reddedilir", async () => {
    await seed((db) => setDoc(inboxRef(db, BOB), { unread: 2 }));
    await assertFails(updateDoc(inboxRef(alice, BOB), { unread: 0 }));
    await assertFails(updateDoc(inboxRef(alice, BOB), { unread: increment(2) }));
    await assertFails(setDoc(inboxRef(alice, BOB), { unread: 10 }));
    await assertFails(deleteDoc(inboxRef(alice, BOB)));
    // İlk kayıt da yalnız 1 olabilir.
    await assertFails(setDoc(inboxRef(alice, BOB, "grp-yeni"), { unread: 5 }));
  });

  test("uye olmayan yazamaz, uye olmayana da yazilamaz, olmayan gruba sayac acilamaz", async () => {
    await assertFails(
      setDoc(inboxRef(carol, BOB), { unread: increment(1) }, { merge: true }),
    );
    await assertFails(
      setDoc(inboxRef(alice, CAROL), { unread: increment(1) }, { merge: true }),
    );
    await assertFails(
      setDoc(inboxRef(alice, BOB, "grp-yok"), { unread: increment(1) }, { merge: true }),
    );
    // Uye olmayana yazım tüm mesaj batch'ini düşürür (mesaj yarım kalmaz).
    await assertFails(sendBatch(alice, ALICE, [BOB, CAROL]));
  });

  test("sayaca ek alan tasinamaz; sahibi de negatif ya da ek alan yazamaz", async () => {
    await assertFails(
      setDoc(inboxRef(alice, BOB), { unread: increment(1), not: "x" }, { merge: true }),
    );
    await assertFails(setDoc(inboxRef(bob, BOB), { unread: 0, not: "x" }));
    await assertFails(setDoc(inboxRef(bob, BOB), { unread: -1 }));
    await assertFails(setDoc(inboxRef(bob, BOB), { unread: "3" }));
  });

  test("tavandaki grupta tek mesaj batch'i 49 aliciyi birden artirabilir", async () => {
    const others = Array.from({ length: 49 }, (_, i) => `uye${i}`);
    await seed((db) =>
      setDoc(doc(db, "groups", "grp-kalabalik"), {
        name: "Kalabalık",
        members: [ALICE, ...others],
        memberInfo: {},
        admins: [],
        createdBy: ALICE,
        lastMessage: null,
      }),
    );
    await assertSucceeds(sendBatch(alice, ALICE, others, "grp-kalabalik"));
    expect(await readAs((db) => inboxRef(db, "uye48", "grp-kalabalik"))).toEqual({ unread: 1 });
  });

  test("eski istemci: uye mesajla birlikte grup belgesindeki sayaci artirir", async () => {
    const batch = writeBatch(alice);
    batch.set(
      groupRef(alice),
      {
        lastMessage: { text: "selam", senderId: ALICE, time: serverTimestamp() },
        updatedAt: serverTimestamp(),
        unread: { [BOB]: increment(1) },
      },
      { merge: true },
    );
    await assertSucceeds(batch.commit());
    expect((await readGroup()).unread).toEqual({ [BOB]: 3 });
  });

  test("eski istemci: uye grup belgesindeki kendi sayacini sifirlar", async () => {
    await seed((db) => updateDoc(groupRef(db), { "unread.alice": 4 }));
    await assertSucceeds(updateDoc(groupRef(alice), { "unread.alice": 0 }));
    expect((await readGroup()).unread).toEqual({ [ALICE]: 0, [BOB]: 2 });
  });

  test("eski istemci: uye olmayan uid icin sayac anahtari reddedilir", async () => {
    await assertFails(updateDoc(groupRef(alice), { "unread.mallory": 1 }));
  });

  test("uye olmayan kullanici sayaca yazamaz", async () => {
    await assertFails(updateDoc(groupRef(carol), { "unread.bob": 0 }));
  });

  test("sayac yazimi yan alanlari (ad, uyelik) degistirmeye tasinamaz", async () => {
    await assertFails(
      updateDoc(groupRef(bob), { "unread.bob": 0, name: "Ele geçirildi" }),
    );
    await assertFails(
      updateDoc(groupRef(bob), { "unread.bob": 0, members: [ALICE, BOB, CAROL] }),
    );
  });

  test("eski istemci: sayaci olmayan gruba da ilk artis yazilabilir", async () => {
    await seed((db) =>
      setDoc(doc(db, "groups", "grp-legacy"), {
        name: "Eski",
        members: [ALICE, BOB],
        memberInfo: {},
        admins: [],
        createdBy: ALICE,
        lastMessage: null,
      }),
    );
    const batch = writeBatch(alice);
    batch.set(
      doc(alice, "groups", "grp-legacy"),
      { updatedAt: serverTimestamp(), unread: { [BOB]: increment(1) } },
      { merge: true },
    );
    await assertSucceeds(batch.commit());
  });

  // Kuralın ilk dalını (üye özeti/sayaç) genişlettik; diğer dalların — yönetim,
  // gruptan ayrılma, özet senkronu — KIRILMADIĞINI burada sabitliyoruz.
  test("gerileme: kurucu ad degistirip uye ekleyebilir", async () => {
    await assertSucceeds(
      updateDoc(groupRef(alice), {
        name: "Yeni Ad",
        members: arrayUnion(CAROL),
        "memberInfo.carol": { name: "Carol", username: "carol", avatarIndex: 1 },
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("gerileme: uye gruptan kendini cikarabilir (sayac izi kalsa da)", async () => {
    await assertSucceeds(
      updateDoc(groupRef(bob), {
        members: arrayRemove(BOB),
        admins: arrayRemove(BOB),
        "memberInfo.bob": deleteField(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("gerileme: son mesaj silinince ozet alani temizlenebilir (syncThreadPreview)", async () => {
    await assertSucceeds(updateDoc(groupRef(bob), { lastMessage: deleteField() }));
  });
});

// Grup üye tavanı: 50 (utils/groupLimits.js; __tests__/groupLimits.test.js sayının
// kural dosyasıyla aynı olduğunu denetler). Tavanı aşan ESKİ bir grupta üye
// çıkarmak ve gruptan ayrılmak serbest kalmalı.
describe("grup uye tavani", () => {
  const uyeler = (n) => Array.from({ length: n }, (_, i) => `uye${i}`);
  const grup = (members) => ({
    name: "Kalabalık",
    color: "#6C63FF",
    avatarIndex: 0,
    members,
    memberInfo: {},
    admins: [],
    createdBy: ALICE,
    lastMessage: null,
  });

  test("kurucu dahil 50 uyeyle grup kurulur, 51 ile kurulamaz", async () => {
    await assertSucceeds(
      setDoc(doc(alice, "groups", "grp-50"), grup([ALICE, ...uyeler(49)])),
    );
    await assertFails(
      setDoc(doc(alice, "groups", "grp-51"), grup([ALICE, ...uyeler(50)])),
    );
  });

  test("dolu gruba uye eklenemez, bir eksigine eklenir", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "groups", "grp-dolu"), grup([ALICE, ...uyeler(49)]));
      await setDoc(doc(db, "groups", "grp-yer"), grup([ALICE, ...uyeler(48)]));
    });
    await assertFails(
      updateDoc(doc(alice, "groups", "grp-dolu"), {
        members: arrayUnion(CAROL),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(alice, "groups", "grp-yer"), {
        members: arrayUnion(CAROL),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("tavani asan eski grupta uye cikarilir ve uye kendisi ayrilabilir", async () => {
    await seed((db) =>
      setDoc(doc(db, "groups", "grp-eski"), grup([ALICE, BOB, ...uyeler(52)])),
    );
    await assertSucceeds(
      updateDoc(doc(alice, "groups", "grp-eski"), {
        members: arrayRemove("uye0"),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(bob, "groups", "grp-eski"), {
        members: arrayRemove(BOB),
        admins: arrayRemove(BOB),
        updatedAt: serverTimestamp(),
      }),
    );
    // Küçülmeyen yönetim yazımı (ad değişikliği) da geçer; büyüme geçmez.
    await assertSucceeds(updateDoc(doc(alice, "groups", "grp-eski"), { name: "Yeni" }));
    await assertFails(
      updateDoc(doc(alice, "groups", "grp-eski"), { members: arrayUnion(CAROL) }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Uygulama içi geri bildirim: hata bildirimi Free, özellik isteği yalnız Max
// ─────────────────────────────────────────────────────────────────────────────
describe("Feedback (geri bildirim kutusu)", () => {
  // alice = Premium, bob = Premium Max, carol = Free (entitlements yok).
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "Users", ALICE), {
        entitlements: { premium: true, premiumUnlimited: false, premiumPlan: "premium" },
      });
      await setDoc(doc(db, "Users", BOB), {
        entitlements: { premium: true, premiumUnlimited: true, premiumPlan: "unlimited" },
      });
      await setDoc(doc(db, "Users", CAROL), { displayName: "carol" });
    });
  });

  const hata = (uid, extra = {}) => ({
    uid,
    kind: "bug",
    category: "crash",
    severity: "annoying",
    title: "Liste ekrani aciliyor kapaniyor",
    message: "Listelerim ekranina girince uygulama kendiliginden kapaniyor.",
    status: "open",
    language: "tr",
    appVersion: "1.4.9",
    platform: "ios",
    osVersion: "26.0",
    deviceModel: "iPhone 16",
    createdAt: serverTimestamp(),
    ...extra,
  });
  const istek = (uid, extra = {}) => ({
    uid,
    kind: "feature",
    category: "lists",
    title: "Listeleri siralayabilmek",
    message: "Ozel listelerimi surukleyerek siralayabilmek istiyorum.",
    status: "open",
    language: "tr",
    createdAt: serverTimestamp(),
    ...extra,
  });
  const yaz = (db, data) => addDoc(collection(db, "Feedback"), data);

  test("Premium hata bildirimi yazabilir", async () => {
    await assertSucceeds(yaz(alice, hata(ALICE)));
  });

  test("Premium Max hem hata hem ozellik istegi yazabilir", async () => {
    await assertSucceeds(yaz(bob, hata(BOB)));
    await assertSucceeds(yaz(bob, istek(BOB)));
  });

  test("Premium ozellik istegi YAZAMAZ (yalniz Max)", async () => {
    await assertFails(yaz(alice, istek(ALICE)));
  });

  test("Free hata bildirebilir ama ozellik istegi yazamaz", async () => {
    await assertSucceeds(yaz(carol, hata(CAROL)));
    await assertFails(yaz(carol, istek(CAROL)));
  });

  test("cihaz bilgisi olmadan da yazilir", async () => {
    const { appVersion, platform, osVersion, deviceModel, ...yalin } = hata(ALICE);
    await assertSucceeds(yaz(alice, yalin));
  });

  test("BASKASININ adina yazilamaz", async () => {
    await assertFails(yaz(alice, hata(BOB)));
  });

  test("durum yalnizca open olabilir; sunucu zamani sart", async () => {
    await assertFails(yaz(alice, hata(ALICE, { status: "done" })));
    await assertFails(yaz(alice, hata(ALICE, { createdAt: new Date() })));
  });

  test("fazladan alan, bilinmeyen kategori ve yanlis tur reddedilir", async () => {
    await assertFails(yaz(alice, hata(ALICE, { reply: "x" })));
    await assertFails(yaz(alice, hata(ALICE, { category: "design" })));
    await assertFails(yaz(bob, istek(BOB, { category: "crash" })));
    await assertFails(yaz(alice, hata(ALICE, { kind: "post" })));
    await assertFails(yaz(alice, hata(ALICE, { severity: "apocalypse" })));
    await assertFails(yaz(bob, istek(BOB, { severity: "minor" })));
  });

  test("ozellik isteginde cihaz bilgisi serbest", async () => {
    await assertSucceeds(yaz(bob, istek(BOB, { appVersion: "1.4.9" })));
  });

  test("uzunluk sinirlari: kisa baslik/mesaj ve asiri uzun metin reddedilir", async () => {
    await assertFails(yaz(alice, hata(ALICE, { title: "ab" })));
    await assertFails(yaz(alice, hata(ALICE, { message: "kisa" })));
    await assertFails(yaz(alice, hata(ALICE, { title: "a".repeat(81) })));
    await assertFails(yaz(alice, hata(ALICE, { message: "a".repeat(1001) })));
    await assertFails(yaz(alice, hata(ALICE, { deviceModel: "a".repeat(41) })));
    await assertSucceeds(yaz(alice, hata(ALICE, { title: "a".repeat(80), message: "a".repeat(1000) })));
  });

  test("sahibi kendi kayitlarini listeler; baskasininkini okuyamaz", async () => {
    let id;
    await seed(async (db) => {
      const ref = await addDoc(collection(db, "Feedback"), { ...hata(ALICE), createdAt: new Date() });
      id = ref.id;
    });
    await assertSucceeds(getDoc(doc(alice, "Feedback", id)));
    await assertFails(getDoc(doc(bob, "Feedback", id)));
    await assertSucceeds(
      getDocs(query(collection(alice, "Feedback"), where("uid", "==", ALICE))),
    );
    // uid suzgeci olmayan sorgu (herkesin kaydini ceker) reddedilir.
    await assertFails(getDocs(collection(alice, "Feedback")));
    await assertFails(
      getDocs(query(collection(bob, "Feedback"), where("uid", "==", ALICE))),
    );
  });

  test("kayit guncellenemez ve silinemez (durum/yanit konsoldan degisir)", async () => {
    let id;
    await seed(async (db) => {
      const ref = await addDoc(collection(db, "Feedback"), { ...hata(ALICE), createdAt: new Date() });
      id = ref.id;
    });
    await assertFails(updateDoc(doc(alice, "Feedback", id), { status: "done" }));
    await assertFails(deleteDoc(doc(alice, "Feedback", id)));
  });
});

// Arkadaş daveti + promosyon kodu: tüm koleksiyonlar yalnız Cloud Functions'a ait
// (functions/index.js → getReferralOverview / redeemCode / claimReferralReward).
// İstemci ne okuyabilir ne yazabilir: yoksa herkes kendine ücretsiz ay yazar, kod
// sayaçlarını sıfırlar ya da başkasının davet kodunu/davetlilerini listeler.
describe("davet ve promosyon kodlari yalniz sunucuya acik", () => {
  const KAPALI = [
    ["ReferralCodes", "ABCDEFGH", { ownerUid: ALICE }],
    ["ReferralAccounts", ALICE, { code: "ABCDEFGH", creditMonths: 1 }],
    ["Referrals", BOB, { inviterUid: ALICE, subscribedAt: null, rewardedAt: null }],
    ["PromoCodes", "PROMO123", { days: 30, maxRedemptions: 5, redeemedCount: 0 }],
  ];

  test.each(KAPALI)("%s: sahibi bile okuyamaz ve yazamaz", async (koleksiyon, id, veri) => {
    await seed((db) => setDoc(doc(db, koleksiyon, id), veri));
    await assertFails(getDoc(doc(alice, koleksiyon, id)));
    await assertFails(setDoc(doc(alice, koleksiyon, `${id}X`), veri));
    await assertFails(updateDoc(doc(alice, koleksiyon, id), { creditMonths: 99 }));
    await assertFails(deleteDoc(doc(alice, koleksiyon, id)));
  });

  test("davet edenin listesi sorgulanamaz", async () => {
    await assertFails(
      getDocs(query(collection(alice, "Referrals"), where("inviterUid", "==", ALICE))),
    );
  });

  test("promosyon kullanim kaydi alt koleksiyonu kapali", async () => {
    await seed((db) =>
      setDoc(doc(db, "PromoCodes", "PROMO123", "redemptions", ALICE), { redeemedAt: new Date() }),
    );
    await assertFails(getDoc(doc(alice, "PromoCodes", "PROMO123", "redemptions", ALICE)));
    await assertFails(
      setDoc(doc(alice, "PromoCodes", "PROMO123", "redemptions", BOB), { redeemedAt: new Date() }),
    );
  });

  test("kullanici kendine promoUntil yazamaz (entitlements sunucuya ait)", async () => {
    await seed((db) => setDoc(doc(db, "Users", ALICE), { displayName: "A" }));
    await assertFails(
      updateDoc(doc(alice, "Users", ALICE), {
        "entitlements.promoUntil": new Date(Date.now() + 86400000 * 365),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Günün Sorusu (DailyPolls): sayaç yalnız oy kaydıyla BİRLİKTE, +1 ve seçilen yana artar.
// ─────────────────────────────────────────────────────────────────────────────
describe("Günün Sorusu (DailyPolls)", () => {
  // Gün anahtarı sunucu saatine göre TR günü (UTC+3) olmalı — istemcinin utils/dailyChallenge.dayKeyOf'u gibi.
  const trDay = (offsetDays = 0) => {
    const shifted = new Date(Date.now() + 3 * 3600000 + offsetDays * 86400000);
    const p = (n) => String(n).padStart(2, "0");
    return `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}`;
  };
  const TODAY = trDay();

  /** Oyu ve sayacı TEK toplu yazımda yazar (istemcideki işlemle aynı biçim). */
  const castBatch = (db, uid, choice, day = TODAY, counter) => {
    const batch = writeBatch(db);
    batch.set(doc(db, "DailyPolls", day, "votes", uid), { choice });
    batch.set(doc(db, "DailyPolls", day), counter || { a: choice === "a" ? 1 : 0, b: choice === "b" ? 1 : 0 });
    return batch.commit();
  };
  const bumpBatch = (db, uid, choice, fields, day = TODAY) => {
    const batch = writeBatch(db);
    batch.set(doc(db, "DailyPolls", day, "votes", uid), { choice });
    batch.update(doc(db, "DailyPolls", day), fields);
    return batch.commit();
  };

  test("ilk oy sayacı kurar; sonraki oylar +1 artırır; sayaç herkese okunur", async () => {
    await assertSucceeds(castBatch(alice, ALICE, "a"));
    await assertSucceeds(bumpBatch(bob, BOB, "b", { b: increment(1) }));
    await assertSucceeds(bumpBatch(carol, CAROL, "a", { a: increment(1) }));
    const snap = await assertSucceeds(getDoc(doc(bob, "DailyPolls", TODAY)));
    expect(snap.data()).toEqual({ a: 2, b: 1 });
  });

  test("istemcinin kullandığı transaction akışı çalışır (sayaç yoksa kur, varsa artır)", async () => {
    const vote = (db, uid, choice) =>
      runTransaction(db, async (tx) => {
        const counterRef = doc(db, "DailyPolls", TODAY);
        const snap = await tx.get(counterRef);
        tx.set(doc(db, "DailyPolls", TODAY, "votes", uid), { choice });
        if (snap.exists()) tx.update(counterRef, { [choice]: increment(1) });
        else tx.set(counterRef, { a: choice === "a" ? 1 : 0, b: choice === "b" ? 1 : 0 });
      });
    await assertSucceeds(vote(alice, ALICE, "b"));
    await assertSucceeds(vote(bob, BOB, "b"));
    await assertSucceeds(vote(carol, CAROL, "a"));
    expect((await getDoc(doc(alice, "DailyPolls", TODAY))).data()).toEqual({ a: 1, b: 2 });
  });

  test("seçilmeyen tarafın sayacı artırılamaz; çift artış ve keyfî değer reddedilir", async () => {
    await seed((db) => setDoc(doc(db, "DailyPolls", TODAY), { a: 5, b: 5 }));
    await assertFails(bumpBatch(alice, ALICE, "a", { b: increment(1) })); // a seçti, b'yi artırdı
    await assertFails(bumpBatch(alice, ALICE, "a", { a: increment(2) })); // +2
    await assertFails(bumpBatch(alice, ALICE, "a", { a: 999 })); // keyfî
    await assertFails(bumpBatch(alice, ALICE, "b", { a: increment(1), b: increment(1) })); // iki taraf birden
    await assertFails(bumpBatch(alice, ALICE, "a", { a: increment(-1) })); // azaltma
    await assertSucceeds(bumpBatch(alice, ALICE, "a", { a: increment(1) }));
  });

  test("oy kaydı olmadan sayaç oynatılamaz; sayaçsız oy kaydı da olmaz", async () => {
    await seed((db) => setDoc(doc(db, "DailyPolls", TODAY), { a: 5, b: 5 }));
    await assertFails(updateDoc(doc(alice, "DailyPolls", TODAY), { a: increment(1) }));
    await assertFails(setDoc(doc(alice, "DailyPolls", TODAY, "votes", ALICE), { choice: "a" }));
  });

  test("ikinci oy reddedilir (aynı seçim de, farklı seçim de); oy değiştirilemez ve silinemez", async () => {
    await assertSucceeds(castBatch(alice, ALICE, "a"));
    await assertFails(bumpBatch(alice, ALICE, "a", { a: increment(1) }));
    await assertFails(bumpBatch(alice, ALICE, "b", { b: increment(1) }));
    await assertFails(updateDoc(doc(alice, "DailyPolls", TODAY, "votes", ALICE), { choice: "b" }));
    await assertFails(deleteDoc(doc(alice, "DailyPolls", TODAY, "votes", ALICE)));
    expect((await getDoc(doc(alice, "DailyPolls", TODAY))).data()).toEqual({ a: 1, b: 0 });
  });

  test("başkası adına oy yazılamaz; oylar yalnız sahibine okunur", async () => {
    await assertFails(castBatch(alice, BOB, "a"));
    await assertSucceeds(castBatch(alice, ALICE, "a"));
    await assertSucceeds(getDoc(doc(alice, "DailyPolls", TODAY, "votes", ALICE)));
    await assertFails(getDoc(doc(bob, "DailyPolls", TODAY, "votes", ALICE)));
    await assertFails(getDocs(collection(bob, "DailyPolls", TODAY, "votes")));
  });

  test("gün anahtarı bugün olmalı: dün, yarın ve bozuk anahtar reddedilir", async () => {
    await assertFails(castBatch(alice, ALICE, "a", trDay(-1)));
    await assertFails(castBatch(alice, ALICE, "a", trDay(1)));
    await assertFails(castBatch(alice, ALICE, "a", "2026-13-45"));
    await assertFails(castBatch(alice, ALICE, "a", "bugun"));
    await assertSucceeds(castBatch(alice, ALICE, "a", TODAY));
  });

  test("geçersiz seçim ve fazladan alan reddedilir", async () => {
    await assertFails(castBatch(alice, ALICE, "c", TODAY, { a: 1, b: 0 }));
    const extraVote = writeBatch(alice);
    extraVote.set(doc(alice, "DailyPolls", TODAY, "votes", ALICE), { choice: "a", weight: 50 });
    extraVote.set(doc(alice, "DailyPolls", TODAY), { a: 1, b: 0 });
    await assertFails(extraVote.commit());
    const extraCounter = writeBatch(alice);
    extraCounter.set(doc(alice, "DailyPolls", TODAY, "votes", ALICE), { choice: "a" });
    extraCounter.set(doc(alice, "DailyPolls", TODAY), { a: 1, b: 0, total: 1 });
    await assertFails(extraCounter.commit());
  });

  test("ilk oyla sayaç keyfî değerle kurulamaz (2/0, 1/1, negatif, yanlış taraf)", async () => {
    await assertFails(castBatch(alice, ALICE, "a", TODAY, { a: 2, b: 0 }));
    await assertFails(castBatch(alice, ALICE, "a", TODAY, { a: 1, b: 1 }));
    await assertFails(castBatch(alice, ALICE, "a", TODAY, { a: -1, b: 0 }));
    await assertFails(castBatch(alice, ALICE, "a", TODAY, { a: 0, b: 1 }));
    await assertFails(castBatch(alice, ALICE, "a", TODAY, { a: "1", b: 0 }));
    await assertSucceeds(castBatch(alice, ALICE, "a"));
  });

  test("sayaç silinemez; giriş yapmamış kullanıcı ne okur ne yazar", async () => {
    await assertSucceeds(castBatch(alice, ALICE, "a"));
    await assertFails(deleteDoc(doc(alice, "DailyPolls", TODAY)));
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "DailyPolls", TODAY)));
    await assertFails(castBatch(anon, "anon", "a", TODAY, { a: 1, b: 0 }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Günün Sorusu — PARÇALI sayaç (2026-10-31 sıcak nokta düzeltmesi). services/dailyPollService.castPollVote:
// oy { choice, shard } + DailyPolls/{gün}/shards/{shard} üzerinde increment. Eski yol (yukarıdaki blok) hâlâ açık;
// burada yeni yolun meşru akışları ve iki yolun birlikte çift sayım üretemediği sınanır.
// ─────────────────────────────────────────────────────────────────────────────
describe("Günün Sorusu — parçalı sayaç (DailyPolls/shards)", () => {
  const trDay = (offsetDays = 0) => {
    const shifted = new Date(Date.now() + 3 * 3600000 + offsetDays * 86400000);
    const p = (n) => String(n).padStart(2, "0");
    return `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}`;
  };
  const TODAY = trDay();
  const shardDoc = (db, shard, day = TODAY) => doc(db, "DailyPolls", day, "shards", String(shard));
  const voteDoc = (db, uid, day = TODAY) => doc(db, "DailyPolls", day, "votes", uid);

  /** İstemcideki toplu yazımın birebir aynısı. */
  const castShard = (db, uid, choice, shard, { day = TODAY, vote, fields } = {}) => {
    const batch = writeBatch(db);
    batch.set(voteDoc(db, uid, day), vote || { choice, shard });
    batch.set(
      shardDoc(db, shard, day),
      fields || { a: increment(choice === "a" ? 1 : 0), b: increment(choice === "b" ? 1 : 0) },
      { merge: true },
    );
    return batch.commit();
  };
  const sumAll = async (db, day = TODAY) => {
    const shards = await getDocs(collection(db, "DailyPolls", day, "shards"));
    const legacy = await getDoc(doc(db, "DailyPolls", day));
    return [legacy.exists() ? legacy.data() : null, ...shards.docs.map((d) => d.data())].reduce(
      (acc, part) => ({ a: acc.a + (part?.a || 0), b: acc.b + (part?.b || 0) }),
      { a: 0, b: 0 },
    );
  };

  test("parçaya oy: ilk oy parçayı kurar, sonrakiler +1; farklı parçalar ve eski sayaç birlikte toplanır", async () => {
    await assertSucceeds(castShard(alice, ALICE, "a", 3));
    await assertSucceeds(castShard(bob, BOB, "b", 3));
    await assertSucceeds(castShard(carol, CAROL, "a", 7));
    expect((await getDoc(shardDoc(alice, 3))).data()).toEqual({ a: 1, b: 1 });
    // Eski istemcinin oyu gün belgesine: toplamda birlikte görünür.
    const dave = testEnv.authenticatedContext("dave").firestore();
    const legacy = writeBatch(dave);
    legacy.set(voteDoc(dave, "dave"), { choice: "b" });
    legacy.set(doc(dave, "DailyPolls", TODAY), { a: 0, b: 1 });
    await assertSucceeds(legacy.commit());
    expect(await sumAll(bob)).toEqual({ a: 2, b: 2 });
  });

  test("ÇİFT SAYIM YOK: parçalı oy gün belgesini de artıramaz; eski oy parçayı artıramaz", async () => {
    await seed((db) => setDoc(doc(db, "DailyPolls", TODAY), { a: 5, b: 5 }));
    const both = writeBatch(alice);
    both.set(voteDoc(alice, ALICE), { choice: "a", shard: 2 });
    both.set(shardDoc(alice, 2), { a: increment(1), b: increment(0) }, { merge: true });
    both.update(doc(alice, "DailyPolls", TODAY), { a: increment(1) });
    await assertFails(both.commit());
    // Parça numarası olmayan (eski biçim) oy parçayı artıramaz.
    await assertFails(castShard(alice, ALICE, "a", 2, { vote: { choice: "a" } }));
    // Parçalı oy gün belgesini tek başına da artıramaz.
    const legacyOnly = writeBatch(alice);
    legacyOnly.set(voteDoc(alice, ALICE), { choice: "a", shard: 2 });
    legacyOnly.update(doc(alice, "DailyPolls", TODAY), { a: increment(1) });
    await assertFails(legacyOnly.commit());
    expect(await sumAll(alice)).toEqual({ a: 5, b: 5 });
  });

  test("oyun söylediği parça dışında parça artırılamaz; iki parça birden artırılamaz", async () => {
    await assertFails(castShard(alice, ALICE, "a", 4, { vote: { choice: "a", shard: 3 } }));
    const two = writeBatch(alice);
    two.set(voteDoc(alice, ALICE), { choice: "a", shard: 3 });
    two.set(shardDoc(alice, 3), { a: increment(1), b: increment(0) }, { merge: true });
    two.set(shardDoc(alice, 4), { a: increment(1), b: increment(0) }, { merge: true });
    await assertFails(two.commit());
    await assertSucceeds(castShard(alice, ALICE, "a", 3));
  });

  test("parça aralığı 0-9: 10, -1, metin ve kesirli numara reddedilir", async () => {
    await assertFails(castShard(alice, ALICE, "a", 10));
    await assertFails(castShard(alice, ALICE, "a", "x", { vote: { choice: "a", shard: -1 } }));
    await assertFails(castShard(alice, ALICE, "a", 3, { vote: { choice: "a", shard: "3" } }));
    await assertFails(castShard(alice, ALICE, "a", 3, { vote: { choice: "a", shard: 3.5 } }));
    await assertSucceeds(castShard(alice, ALICE, "a", 0));
    await assertSucceeds(castShard(bob, BOB, "b", 9));
  });

  test("parçada yanlış taraf, +2, keyfî değer ve fazladan alan reddedilir", async () => {
    await seed((db) => setDoc(doc(db, "DailyPolls", TODAY, "shards", "5"), { a: 4, b: 4 }));
    await assertFails(castShard(alice, ALICE, "a", 5, { fields: { a: increment(0), b: increment(1) } }));
    await assertFails(castShard(alice, ALICE, "a", 5, { fields: { a: increment(2), b: increment(0) } }));
    await assertFails(castShard(alice, ALICE, "a", 5, { fields: { a: 99, b: 4 } }));
    await assertFails(castShard(alice, ALICE, "a", 5, { fields: { a: increment(1), b: increment(0), total: 9 } }));
    await assertFails(castShard(alice, ALICE, "a", 5, { vote: { choice: "a", shard: 5, weight: 9 } }));
    await assertSucceeds(castShard(alice, ALICE, "a", 5));
    expect((await getDoc(shardDoc(alice, 5))).data()).toEqual({ a: 5, b: 4 });
  });

  test("oysuz parça artırılamaz; oy parçasız yazılamaz; ikinci oy reddedilir; parça silinemez", async () => {
    await assertFails(setDoc(shardDoc(alice, 1), { a: increment(1), b: increment(0) }, { merge: true }));
    await assertFails(setDoc(voteDoc(alice, ALICE), { choice: "a", shard: 1 }));
    await assertSucceeds(castShard(alice, ALICE, "a", 1));
    await assertFails(castShard(alice, ALICE, "b", 2));
    await assertFails(castShard(alice, ALICE, "a", 1));
    await assertFails(deleteDoc(shardDoc(alice, 1)));
    expect(await sumAll(alice)).toEqual({ a: 1, b: 0 });
  });

  test("dün/yarın parçası yazılamaz; parçalar oturumluya okunur, oturumsuza değil", async () => {
    await assertFails(castShard(alice, ALICE, "a", 1, { day: trDay(-1) }));
    await assertFails(castShard(alice, ALICE, "a", 1, { day: trDay(1) }));
    await assertSucceeds(castShard(alice, ALICE, "a", 1));
    await assertSucceeds(getDocs(collection(bob, "DailyPolls", TODAY, "shards")));
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(anon, "DailyPolls", TODAY, "shards")));
  });

  test("EŞZAMANLI: 40 kullanıcı aynı anda parçalı yoldan oy verir — hepsi geçer, toplam kesin", async () => {
    const users = Array.from({ length: 40 }, (_, i) => `voter${i}`);
    const results = await Promise.allSettled(
      users.map((uid, i) =>
        castShard(testEnv.authenticatedContext(uid).firestore(), uid, i % 2 ? "b" : "a", i % 10),
      ),
    );
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(0);
    expect(await sumAll(alice)).toEqual({ a: 20, b: 20 });
  });
});

describe("Özel afiş seçimleri (PosterChoices)", () => {
  const belge = (choices = { movie_603: "/abc123.jpg" }) => ({ id: "all", choices, updatedAt: 1 });
  const profil = (lists) => ({ uid: ALICE, username: "alice", usernameLower: "alice", privacy: { lists } });
  const cokSecim = (n) =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [`movie_${i + 1}`, `/p${i + 1}.jpg`]));

  test("sahibi yazar ve okur; başkası yazamaz", async () => {
    await assertSucceeds(setDoc(doc(alice, "PosterChoices", ALICE), belge()));
    await assertSucceeds(getDoc(doc(alice, "PosterChoices", ALICE)));
    await assertFails(setDoc(doc(bob, "PosterChoices", ALICE), belge()));
    await assertSucceeds(deleteDoc(doc(alice, "PosterChoices", ALICE)));
  });

  test("şekil: fazladan alan, harita olmayan seçim ve 500 tavanı", async () => {
    await assertFails(setDoc(doc(alice, "PosterChoices", ALICE), { ...belge(), extra: true }));
    await assertFails(setDoc(doc(alice, "PosterChoices", ALICE), { id: "all", choices: ["/a.jpg"] }));
    await assertFails(setDoc(doc(alice, "PosterChoices", ALICE), { ...belge(), updatedAt: "dün" }));
    await assertSucceeds(setDoc(doc(alice, "PosterChoices", ALICE), belge(cokSecim(500))));
    await assertFails(setDoc(doc(alice, "PosterChoices", ALICE), belge(cokSecim(501))));
  });

  test("arka plan haritası: kendi tavanı (500), harita olmalı; afişle birlikte yazılır", async () => {
    const ref = doc(alice, "PosterChoices", ALICE);
    await assertSucceeds(setDoc(ref, { ...belge(), backdrops: { movie_603: "/bd603.jpg" } }));
    await assertSucceeds(setDoc(ref, { ...belge(cokSecim(500)), backdrops: cokSecim(500) }));
    await assertFails(setDoc(ref, { ...belge(), backdrops: cokSecim(501) }));
    await assertFails(setDoc(ref, { ...belge(), backdrops: ["/bd.jpg"] }));
  });

  test("okuma listelerle aynı: herkese açık → okur, gizli → okuyamaz", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "PosterChoices", ALICE), belge());
      await setDoc(doc(db, "Users", ALICE), profil("public"));
    });
    await assertSucceeds(getDoc(doc(bob, "PosterChoices", ALICE)));

    await seed((db) => setDoc(doc(db, "Users", ALICE), profil("private")));
    await assertFails(getDoc(doc(bob, "PosterChoices", ALICE)));
    await assertSucceeds(getDoc(doc(alice, "PosterChoices", ALICE)));
  });

  test("yalnız arkadaşlar: sahibin arkadaş listesindeki okur, diğeri okuyamaz", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "PosterChoices", ALICE), belge());
      await setDoc(doc(db, "Users", ALICE), profil("friends"));
      await setDoc(doc(db, "Users", ALICE, "friends", BOB), { friendUid: BOB });
    });
    await assertSucceeds(getDoc(doc(bob, "PosterChoices", ALICE)));
    await assertFails(getDoc(doc(carol, "PosterChoices", ALICE)));
  });
});

describe("betaTesters (landing test kullanıcısı formu)", () => {
  const anon = () => testEnv.unauthenticatedContext().firestore();
  const kayit = (extra = {}) => ({
    email: "tester@example.com",
    platform: "android",
    lang: "tr",
    createdAt: serverTimestamp(),
    source: "landing",
    ...extra,
  });

  test("oturumsuz ziyaretçi kendi kaydını yazar ve tek kaydı okur; liste dökülemez", async () => {
    const db = anon();
    const ref = doc(db, "betaTesters", "dGVzdGVy_android");
    await assertSucceeds(setDoc(ref, kayit()));
    await assertSucceeds(getDoc(ref));
    await assertFails(getDocs(collection(db, "betaTesters")));
  });

  test("aynı kişi iOS için ayrı kayıt açar; kayıt değiştirilemez, silinemez", async () => {
    const db = anon();
    await assertSucceeds(setDoc(doc(db, "betaTesters", "dGVzdGVy_ios"), kayit({ platform: "ios" })));
    const ref = doc(db, "betaTesters", "dGVzdGVy_android");
    await assertSucceeds(setDoc(ref, kayit()));
    await assertFails(updateDoc(ref, { platform: "ios" }));
    await assertFails(deleteDoc(ref));
  });

  test("geçersiz platform, e-posta, dil, kaynak, belge kimliği ya da fazladan alan reddedilir", async () => {
    const db = anon();
    const ref = (id = "dGVzdGVy_android") => doc(db, "betaTesters", id);
    await assertFails(setDoc(ref("dGVzdGVy_windows"), kayit({ platform: "windows" })));
    await assertFails(setDoc(ref(), kayit({ email: "olmaz" })));
    await assertFails(setDoc(ref(), kayit({ lang: "fr" })));
    await assertFails(setDoc(ref(), kayit({ source: "app" })));
    await assertFails(setDoc(ref("dGVzdGVy_ios"), kayit()));
    await assertFails(setDoc(ref(), kayit({ name: "Ali" })));
    await assertFails(setDoc(ref(), kayit({ createdAt: new Date(2020, 0, 1) })));
    const { platform, ...eksik } = kayit();
    await assertFails(setDoc(ref(), eksik));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Seelogd Top 100 (Top100Hype): puansız oy; yapım sayacı + kullanıcının hak sayacı (Top100HypeUsers) aynı
// yazımda ±1. Aktif oy hakkı Free 0 · Premium 10 · Max 20; geri almak serbest ve hakkı geri verir.
// ─────────────────────────────────────────────────────────────────────────────
describe("Seelogd Top 100 (Top100Hype)", () => {
  const MK = "movie_550";
  const C = "Top100Hype";
  const U = "Top100HypeUsers";

  // alice Premium (10), bob Max (20), carol Free (0).
  const plan = (premiumPlan, extra = {}) => ({ entitlements: { premiumPlan, ...extra } });
  beforeEach(() =>
    seed(async (db) => {
      await setDoc(doc(db, "Users", ALICE), plan("premium", { premium: true }));
      await setDoc(doc(db, "Users", BOB), plan("unlimited", { premium: true, premiumUnlimited: true }));
      await setDoc(doc(db, "Users", CAROL), plan("free"));
    }),
  );

  /** Top100Service.setTop100Hype ile aynı transaction (istemci sınırı yok: kuralı sınamak için). */
  const setHype = (db, uid, hyped, key = MK) =>
    runTransaction(db, async (tx) => {
      const counterRef = doc(db, C, key);
      const voteRef = doc(db, C, key, "votes", uid);
      const userRef = doc(db, U, uid);
      const counter = await tx.get(counterRef);
      const vote = await tx.get(voteRef);
      const user = await tx.get(userRef);
      const count = counter.exists() ? counter.data().count : 0;
      const used = user.exists() ? user.data().used : 0;
      if (vote.exists() === hyped) return;
      if (hyped) {
        tx.set(voteRef, { hype: true });
        if (counter.exists()) tx.update(counterRef, { count: count + 1 });
        else {
          const [type, id] = key.split("_");
          tx.set(counterRef, { type, id: Number(id), count: 1 });
        }
        tx.set(userRef, { used: used + 1, last: key });
      } else {
        tx.delete(voteRef);
        tx.update(counterRef, { count: count - 1 });
        if (user.exists()) tx.set(userRef, { used: used - 1, last: key });
      }
    });

  /** Elle kurulan yazım: oy + yapım sayacı + hak sayacı alanları. */
  const addBatch = (db, uid, { counter, user, createCounter = false, vote = { hype: true }, key = MK }) => {
    const batch = writeBatch(db);
    batch.set(doc(db, C, key, "votes", uid), vote);
    if (counter) {
      if (createCounter) batch.set(doc(db, C, key), counter);
      else batch.update(doc(db, C, key), counter);
    }
    if (user) batch.set(doc(db, U, uid), user);
    return batch.commit();
  };
  const removeBatch = (db, uid, { counter, user, key = MK }) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, C, key, "votes", uid));
    batch.update(doc(db, C, key), counter);
    if (user) batch.set(doc(db, U, uid), user);
    return batch.commit();
  };
  const keys = (n) => Array.from({ length: n }, (_, i) => "movie_" + (1000 + i));

  test("oy sayacı kurar, sonrakiler +1, geri alma −1; hak sayacı birlikte oynar; sayaç herkese okunur", async () => {
    await assertSucceeds(setHype(alice, ALICE, true));
    await assertSucceeds(setHype(bob, BOB, true));
    await assertSucceeds(setHype(alice, ALICE, false));
    expect((await assertSucceeds(getDoc(doc(carol, C, MK)))).data()).toEqual({ type: "movie", id: 550, count: 1 });
    expect((await getDoc(doc(alice, U, ALICE))).data()).toEqual({ used: 0, last: MK });
    expect((await getDoc(doc(bob, U, BOB))).data()).toEqual({ used: 1, last: MK });
    await assertSucceeds(setHype(alice, ALICE, true)); // geri alınan oy yeniden verilebilir
    expect((await getDoc(doc(carol, C, MK))).data().count).toBe(2);
  });

  test("Premium 10 aktif oy: 11. oy reddedilir; birini geri alınca hak geri gelir", async () => {
    for (const key of keys(10)) await assertSucceeds(setHype(alice, ALICE, true, key));
    await assertFails(setHype(alice, ALICE, true, "movie_2000"));
    await assertSucceeds(setHype(alice, ALICE, false, keys(10)[3]));
    await assertSucceeds(setHype(alice, ALICE, true, "movie_2000"));
    expect((await getDoc(doc(alice, U, ALICE))).data().used).toBe(10);
  });

  test("Max 20 aktif oy: 21. oy reddedilir", async () => {
    for (const key of keys(20)) await assertSucceeds(setHype(bob, BOB, true, key));
    await assertFails(setHype(bob, BOB, true, "movie_2000"));
  });

  test("Free oy veremez; Users kaydı olmayan da veremez; istemci planını yükseltemez", async () => {
    await assertFails(setHype(carol, CAROL, true));
    await assertSucceeds(setHype(alice, ALICE, true));
    await assertFails(setHype(carol, CAROL, true));
    const dave = testEnv.authenticatedContext("dave").firestore();
    await assertFails(setHype(dave, "dave", true));
    await assertFails(updateDoc(doc(carol, "Users", CAROL), { entitlements: { premiumPlan: "premium" } }));
    expect((await getDoc(doc(bob, C, MK))).data().count).toBe(1);
  });

  test("hak sayacı oy olmadan düşürülemez, keyfî değere çekilemez, başka yapıma 'last' yazılamaz", async () => {
    for (const key of keys(10)) await assertSucceeds(setHype(alice, ALICE, true, key));
    // Doğrudan düşürme (oy silmeden): reddedilir.
    await assertFails(setDoc(doc(alice, U, ALICE), { used: 9, last: keys(10)[0] }));
    await assertFails(setDoc(doc(alice, U, ALICE), { used: 0, last: keys(10)[0] }));
    await assertFails(deleteDoc(doc(alice, U, ALICE)));
    // Yeni oyda hak sayacını artırmadan geçmek: reddedilir.
    await assertFails(
      addBatch(alice, ALICE, { key: "movie_3000", createCounter: true, counter: { type: "movie", id: 3000, count: 1 } }),
    );
    // last başka yapım: reddedilir.
    await assertSucceeds(setHype(alice, ALICE, false, keys(10)[0]));
    const fresh = { key: "movie_3000", createCounter: true, counter: { type: "movie", id: 3000, count: 1 } };
    await assertFails(addBatch(alice, ALICE, { ...fresh, user: { used: 10, last: "movie_9999" } }));
    await assertSucceeds(addBatch(alice, ALICE, { ...fresh, user: { used: 10, last: "movie_3000" } }));
  });

  test("dizi anahtarı çalışır; bozuk anahtar, uyumsuz tür/id ve fazladan alan reddedilir", async () => {
    await assertSucceeds(setHype(alice, ALICE, true, "tv_1396"));
    await assertFails(setHype(alice, ALICE, true, "person_12"));
    await assertFails(setHype(alice, ALICE, true, "movie_0"));
    const user = { used: 2, last: MK };
    const base = { createCounter: true, user };
    await assertFails(addBatch(alice, ALICE, { ...base, counter: { type: "tv", id: 550, count: 1 } }));
    await assertFails(addBatch(alice, ALICE, { ...base, counter: { type: "movie", id: 551, count: 1 } }));
    await assertFails(addBatch(alice, ALICE, { ...base, counter: { type: "movie", id: 550, count: 1, sum: 9 } }));
    await assertFails(addBatch(alice, ALICE, { ...base, counter: { type: "movie", id: 550, count: 1 }, vote: { hype: false } }));
    await assertFails(addBatch(alice, ALICE, { ...base, counter: { type: "movie", id: 550, count: 5 } }));
    await assertSucceeds(addBatch(alice, ALICE, { ...base, counter: { type: "movie", id: 550, count: 1 } }));
  });

  test("ikinci oy reddedilir; oy kaydı olmadan sayaç oynatılamaz; sayaçsız oy olmaz", async () => {
    await assertSucceeds(setHype(alice, ALICE, true));
    await assertFails(addBatch(alice, ALICE, { counter: { count: 2 }, user: { used: 2, last: MK } }));
    await assertFails(updateDoc(doc(bob, C, MK), { count: 2 }));
    await assertFails(setDoc(doc(bob, C, MK, "votes", BOB), { hype: true }));
    await assertFails(updateDoc(doc(alice, C, MK, "votes", ALICE), { hype: true }));
    await assertFails(deleteDoc(doc(alice, C, MK)));
  });

  test("geri alma: tam −1 (yapım ve hak); olmayan oy geri alınamaz; başkası adına yazılamaz", async () => {
    await assertSucceeds(setHype(alice, ALICE, true));
    await assertSucceeds(setHype(bob, BOB, true));
    await assertFails(deleteDoc(doc(alice, C, MK, "votes", ALICE)));
    await assertFails(removeBatch(alice, ALICE, { counter: { count: 1 } })); // hak sayacına dokunmadı
    await assertFails(removeBatch(alice, ALICE, { counter: { count: 0 }, user: { used: 0, last: MK } }));
    await assertFails(removeBatch(carol, CAROL, { counter: { count: 1 } }));
    await assertFails(setHype(alice, BOB, true));
    await assertFails(getDoc(doc(bob, C, MK, "votes", ALICE)));
    await assertFails(getDoc(doc(bob, U, ALICE)));
    await assertSucceeds(removeBatch(alice, ALICE, { counter: { count: 1 }, user: { used: 0, last: MK } }));
  });

  test("plan düşünce verilmiş oy kalır ve geri alınabilir; yeniden vermek kapalı", async () => {
    await assertSucceeds(setHype(alice, ALICE, true));
    await seed((db) => setDoc(doc(db, "Users", ALICE), plan("free")));
    expect((await getDoc(doc(bob, C, MK))).data().count).toBe(1);
    await assertSucceeds(setHype(alice, ALICE, false));
    await assertFails(setHype(alice, ALICE, true));
  });

  test("hak sisteminden önce verilmiş oy (hak kaydı yok) hak sayacına dokunmadan geri alınır", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, C, MK), { type: "movie", id: 550, count: 1 });
      await setDoc(doc(db, C, MK, "votes", CAROL), { hype: true });
    });
    await assertSucceeds(setHype(carol, CAROL, false));
    expect((await getDoc(doc(bob, C, MK))).data().count).toBe(0);
  });

  test("eski puanlı Top100 koleksiyonu artık kapalı", async () => {
    await assertFails(getDoc(doc(alice, "Top100", MK)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sayaçlar transaction'sız (2026-10-31 sıcak nokta düzeltmesi): Top100Hype ve Ratings istemcide artık
// oku-değiştir-yaz transaction'ı DEĞİL, increment'li toplu yazımla güncellenir. Kurallar aynı kalır; burada
// yeni istemci biçiminin geçtiği, keyfî farkın yine reddedildiği ve eşzamanlı yazımların kaybolmadığı sınanır.
// ─────────────────────────────────────────────────────────────────────────────
describe("Top100Hype — increment'li toplu yazım (services/top100Service)", () => {
  const MK = "movie_550";
  const C = "Top100Hype";
  const U = "Top100HypeUsers";
  beforeEach(() =>
    seed(async (db) => {
      await setDoc(doc(db, "Users", ALICE), { entitlements: { premiumPlan: "premium", premium: true } });
      await setDoc(doc(db, "Users", BOB), { entitlements: { premiumPlan: "premium", premium: true } });
      await setDoc(doc(db, "Users", CAROL), { entitlements: { premiumPlan: "free" } });
    }),
  );

  /** setTop100Hype'ın yazım biçimi (okuma yok; increment). */
  const hypeOn = (db, uid, key = MK) => {
    const [type, id] = key.split("_");
    const batch = writeBatch(db);
    batch.set(doc(db, C, key, "votes", uid), { hype: true });
    batch.set(doc(db, C, key), { type, id: Number(id), count: increment(1) }, { merge: true });
    batch.set(doc(db, U, uid), { used: increment(1), last: key }, { merge: true });
    return batch.commit();
  };
  const hypeOff = (db, uid, key = MK) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, C, key, "votes", uid));
    batch.update(doc(db, C, key), { count: increment(-1) });
    batch.set(doc(db, U, uid), { used: increment(-1), last: key }, { merge: true });
    return batch.commit();
  };

  test("ilk oy sayacı kurar, ikinci kullanıcı +1, geri alma −1; hak sayacı birlikte oynar", async () => {
    await assertSucceeds(hypeOn(alice, ALICE));
    await assertSucceeds(hypeOn(bob, BOB));
    await assertSucceeds(hypeOff(alice, ALICE));
    expect((await getDoc(doc(carol, C, MK))).data()).toEqual({ type: "movie", id: 550, count: 1 });
    expect((await getDoc(doc(alice, U, ALICE))).data()).toEqual({ used: 0, last: MK });
    expect((await getDoc(doc(bob, U, BOB))).data()).toEqual({ used: 1, last: MK });
  });

  test("hak sınırı increment'le de aşılamaz; Free yine oy veremez; ikinci oy reddedilir", async () => {
    const keys = Array.from({ length: 10 }, (_, i) => `movie_${1000 + i}`);
    for (const key of keys) await assertSucceeds(hypeOn(alice, ALICE, key));
    await assertFails(hypeOn(alice, ALICE, "movie_2000"));
    await assertFails(hypeOn(carol, CAROL));
    await assertFails(hypeOn(alice, ALICE, keys[0]));
  });

  test("keyfî artış (+2) ve oysuz artış reddedilir", async () => {
    await assertSucceeds(hypeOn(alice, ALICE));
    const plusTwo = writeBatch(bob);
    plusTwo.set(doc(bob, C, MK, "votes", BOB), { hype: true });
    plusTwo.set(doc(bob, C, MK), { type: "movie", id: 550, count: increment(2) }, { merge: true });
    plusTwo.set(doc(bob, U, BOB), { used: increment(1), last: MK }, { merge: true });
    await assertFails(plusTwo.commit());
    await assertFails(updateDoc(doc(bob, C, MK), { count: increment(1) }));
  });

  test("EŞZAMANLI: 30 Premium kullanıcı aynı yapıma aynı anda oy verir — hiçbiri kaybolmaz", async () => {
    const users = Array.from({ length: 30 }, (_, i) => `fan${i}`);
    await seed(async (db) => {
      for (const uid of users) {
        await setDoc(doc(db, "Users", uid), { entitlements: { premiumPlan: "premium", premium: true } });
      }
    });
    const results = await Promise.allSettled(users.map((uid) => hypeOn(testEnv.authenticatedContext(uid).firestore(), uid)));
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(0);
    expect((await getDoc(doc(alice, C, MK))).data().count).toBe(30);
  });
});

describe("Ratings — increment'li toplu yazım (services/ratingsService)", () => {
  /** setMyRating'in yazım biçimi: kendi oyumu okur, agregata yalnız farkı increment'ler. */
  const rate = async (db, uid, value) => {
    const userRef = doc(db, "Ratings", KEY, "userRatings", uid);
    const snap = await getDoc(userRef);
    const prev = snap.exists() ? snap.data().rating : null;
    const batch = writeBatch(db);
    batch.set(userRef, { rating: value, updatedAt: serverTimestamp() });
    batch.set(
      doc(db, "Ratings", KEY),
      {
        mediaType: "movie",
        mediaId: "550",
        count: increment(prev === null ? 1 : 0),
        sum: increment(prev === null ? value : value - prev),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return batch.commit();
  };
  const unrate = async (db, uid) => {
    const userRef = doc(db, "Ratings", KEY, "userRatings", uid);
    const prev = (await getDoc(userRef)).data().rating;
    const batch = writeBatch(db);
    batch.delete(userRef);
    batch.set(
      doc(db, "Ratings", KEY),
      { mediaType: "movie", mediaId: "550", count: increment(-1), sum: increment(-prev), updatedAt: serverTimestamp() },
      { merge: true },
    );
    return batch.commit();
  };

  test("ilk oy, ikinci kullanıcı, kendi oyunu değiştirme ve kaldırma doğru sayar", async () => {
    await assertSucceeds(rate(alice, ALICE, 8));
    await assertSucceeds(rate(bob, BOB, 4));
    await assertSucceeds(rate(alice, ALICE, 6));
    expect((await getDoc(doc(alice, "Ratings", KEY))).data()).toMatchObject({ count: 2, sum: 10 });
    await assertSucceeds(unrate(bob, BOB));
    expect((await getDoc(doc(alice, "Ratings", KEY))).data()).toMatchObject({ count: 1, sum: 6 });
  });

  test("bayat fark (oy arada değişti) reddedilir — istemci taze okumayla yeniden dener", async () => {
    await assertSucceeds(rate(alice, ALICE, 8));
    // Başka cihaz oyu 3 yaptı; bu cihaz hâlâ 8 sanıp +2 (8→10) farkı yazarsa sum tutmaz.
    await assertSucceeds(rate(alice, ALICE, 3));
    const stale = writeBatch(alice);
    stale.set(doc(alice, "Ratings", KEY, "userRatings", ALICE), { rating: 10, updatedAt: serverTimestamp() });
    stale.set(doc(alice, "Ratings", KEY), { count: increment(0), sum: increment(2), updatedAt: serverTimestamp() }, { merge: true });
    await assertFails(stale.commit());
    await assertSucceeds(rate(alice, ALICE, 10)); // taze okuma: 3→10 = +7
    expect((await getDoc(doc(alice, "Ratings", KEY))).data()).toMatchObject({ count: 1, sum: 10 });
  });

  test("EŞZAMANLI: 30 kullanıcı aynı içeriği aynı anda puanlar — sayım ve toplam kesin", async () => {
    const users = Array.from({ length: 30 }, (_, i) => `critic${i}`);
    const results = await Promise.allSettled(users.map((uid) => rate(testEnv.authenticatedContext(uid).firestore(), uid, 5)));
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(0);
    expect((await getDoc(doc(alice, "Ratings", KEY))).data()).toMatchObject({ count: 30, sum: 150 });
  });
});
