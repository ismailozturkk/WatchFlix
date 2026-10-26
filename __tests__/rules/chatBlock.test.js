// Engel 1-1 sohbette yazımı kapatır (T3 B12) — gerçek Firestore kuralları.
//
// Engel sohbeti silmiyor (geri alınabilir). Kural yalnız sohbet üyeliğine
// baktığında engellenen kişi var olan sohbete yazmaya devam edebiliyordu.
//   • engellenen → engelleyene mesaj ve gelen kutusu yazımı reddedilir
//   • engelleyen → engellenene de yazamaz (iki yönlü)
//   • engel yokken ve başka sohbetlerde yazım serbest
//   • silme (arkadaşlıktan çıkarma / hesap silme temizliği) engelde de açık

const { assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, setDoc, deleteDoc, serverTimestamp } = require("firebase/firestore");
const { createEmulatorEnv } = require("../helpers/libraryEmulator");

let testEnv;
const ALICE = "alice";
const BOB = "bob";
const CAROL = "carol";
const chatId = (a, b) => (a > b ? `${a}_${b}` : `${b}_${a}`);

beforeAll(async () => {
  testEnv = await createEmulatorEnv("seelogd-chat-block");
});
afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `chats/${chatId(ALICE, BOB)}`), { participants: [ALICE, BOB].sort() });
    await setDoc(doc(db, `chats/${chatId(ALICE, CAROL)}`), { participants: [ALICE, CAROL].sort() });
    await setDoc(doc(db, `Users/${BOB}/conversations/${ALICE}`), { withUid: ALICE, lastText: "selam" });
    await setDoc(doc(db, `Users/${ALICE}/conversations/${BOB}`), { withUid: BOB, lastText: "selam" });
  });
});

const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const block = (owner, target) =>
  testEnv.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), `Users/${owner}/blocked/${target}`), { uid: target }),
  );
const message = (db, from, to, id = "m1") =>
  setDoc(doc(db, `chats/${chatId(from, to)}/messages/${id}`), {
    senderId: from,
    text: "selam",
    timestamp: serverTimestamp(),
  });
const inbox = (db, owner, writer) =>
  setDoc(
    doc(db, `Users/${owner}/conversations/${writer}`),
    { withUid: writer, lastText: "selam", lastTime: serverTimestamp() },
    { merge: true },
  );

test("engel yokken mesaj ve karşı tarafın gelen kutusu yazılır", async () => {
  await assertSucceeds(message(as(ALICE), ALICE, BOB));
  await assertSucceeds(inbox(as(ALICE), BOB, ALICE));
});

test("engellenen kişi engelleyene mesaj atamaz, gelen kutusuna yazamaz", async () => {
  await block(BOB, ALICE);
  await assertFails(message(as(ALICE), ALICE, BOB));
  await assertFails(inbox(as(ALICE), BOB, ALICE));
});

test("engel iki yönlü: engelleyen de engellenene yazamaz", async () => {
  await block(BOB, ALICE);
  await assertFails(message(as(BOB), BOB, ALICE, "m2"));
  await assertFails(inbox(as(BOB), ALICE, BOB));
});

test("engel başka sohbetleri etkilemez; kişi kendi gelen kutusunu yazar", async () => {
  await block(BOB, ALICE);
  await assertSucceeds(message(as(ALICE), ALICE, CAROL));
  await assertSucceeds(inbox(as(ALICE), ALICE, BOB));
});

test("engelde de karşı tarafın gelen kutusu kaydı silinebilir (temizlik)", async () => {
  await block(BOB, ALICE);
  await assertSucceeds(deleteDoc(doc(as(ALICE), `Users/${BOB}/conversations/${ALICE}`)));
});
