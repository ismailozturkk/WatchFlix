// Arkadaşlıktan çıkarınca 1-1 sohbet SİLİNİR — gerçek servis kodu, gerçek Firestore kuralları.
//   • arkadaşlık iki taraftan çözülür, friendsCount iki tarafta 1 düşer
//   • sohbet: mesajlar, sabitlemeler, sohbet belgesi, iki tarafın gelen kutusu kaydı gider
//   • benim gelen kutumdaki o kişiden gelen MESAJ bildirimleri gider; başka türdeki bildirimler,
//     başkalarıyla olan sohbetler ve grup sohbetleri kalır
//   • benim tarafımda zaten arkadaş olmayana tekrar çağrı sayaçları ikinci kez düşürmez (idempotent);
//     karşı tarafın friends belgesi okunamaz (kural), bu yüzden karar yalnız kendi kaydıma bakar

global.__DEV__ = false;

const mockHolder = { db: null };
jest.mock("../../firebase", () => ({
  get db() {
    return mockHolder.db;
  },
}));
jest.mock("../../services/usageTrackerService", () => require("../helpers/libraryEmulator").usageMock());
jest.mock("../../utils/avatars", () => ({ clampAvatarIndex: (i) => Number(i) || 0 }));
jest.mock("../../utils/firestoreError", () => ({ snapshotErrorHandler: () => () => {} }));

const { doc, getDoc, getDocs, collection, setDoc } = require("firebase/firestore");
const { createEmulatorEnv } = require("../helpers/libraryEmulator");
const { directChatId, deleteDirectChat, unfriend } = require("../../services/friendsService");

let testEnv;
const ALICE = "alice";
const BOB = "bob";
const CAROL = "carol";
const CHAT_AB = directChatId(ALICE, BOB);
const CHAT_AC = directChatId(ALICE, CAROL);

beforeAll(async () => {
  testEnv = await createEmulatorEnv("seelogd-unfriend-chat");
});
afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const put = (path, data) => setDoc(doc(db, path), data);
    await put(`Users/${ALICE}`, { displayName: "Alice", friendsCount: 2 });
    await put(`Users/${BOB}`, { displayName: "Bob", friendsCount: 1 });
    await put(`Users/${CAROL}`, { displayName: "Carol", friendsCount: 1 });
    for (const [a, b] of [[ALICE, BOB], [BOB, ALICE], [ALICE, CAROL], [CAROL, ALICE]]) {
      await put(`Users/${a}/friends/${b}`, { uid: b });
    }
    // Alice–Bob sohbeti.
    await put(`chats/${CHAT_AB}`, { participants: [ALICE, BOB].sort() });
    await put(`chats/${CHAT_AB}/messages/m1`, { senderId: ALICE, text: "selam" });
    await put(`chats/${CHAT_AB}/messages/m2`, { senderId: BOB, text: "merhaba" });
    await put(`chats/${CHAT_AB}/pins/m2`, { messageId: "m2", senderId: BOB, pinnedBy: ALICE });
    await put(`Users/${ALICE}/conversations/${BOB}`, { withUid: BOB, lastText: "merhaba", unreadCount: 3 });
    await put(`Users/${BOB}/conversations/${ALICE}`, { withUid: ALICE, lastText: "selam", unreadCount: 0 });
    // Alice'in gelen kutusu: Bob'dan mesaj + başka tür bildirim, Carol'dan mesaj.
    await put(`Users/${ALICE}/notifications/n1`, { type: "message", fromUid: BOB });
    await put(`Users/${ALICE}/notifications/n2`, { type: "post_like", fromUid: BOB });
    await put(`Users/${ALICE}/notifications/n3`, { type: "message", fromUid: CAROL });
    await put(`Users/${ALICE}/notifications/n4`, { type: "message", fromUid: BOB, groupId: "g1" });
    await put(`Users/${BOB}/notifications/nb1`, { type: "message", fromUid: ALICE });
    // Alice–Carol sohbeti (dokunulmamalı).
    await put(`chats/${CHAT_AC}`, { participants: [ALICE, CAROL].sort() });
    await put(`chats/${CHAT_AC}/messages/c1`, { senderId: CAROL, text: "selam alice" });
    await put(`Users/${ALICE}/conversations/${CAROL}`, { withUid: CAROL, lastText: "selam alice" });
    // Grup sohbeti (dokunulmamalı).
    await put("groups/g1", { members: [ALICE, BOB], createdBy: ALICE, admins: [] });
    await put("groups/g1/messages/gm1", { senderId: BOB, text: "grup" });
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  mockHolder.db = testEnv.authenticatedContext(ALICE).firestore();
  await seed();
});

const exists = async (path) => (await getDoc(doc(mockHolder.db, path))).exists();
const ids = async (path) => (await getDocs(collection(mockHolder.db, path))).docs.map((d) => d.id).sort();
// Karşı tarafın özel alt koleksiyonları (friends, conversations, notifications) kurallarca yalnız
// SAHİBİNE okunur; doğrulama için kuralsız bağlam kullanılır.
const adminExists = async (path) => {
  let found;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    found = (await getDoc(doc(ctx.firestore(), path))).exists();
  });
  return found;
};
const field = async (path, key) => (await getDoc(doc(mockHolder.db, path))).data()?.[key];

describe("directChatId", () => {
  test("büyük uid başta (ChatScreen ve functions/appBadge ile aynı formül)", () => {
    expect(directChatId("alice", "bob")).toBe("bob_alice");
    expect(directChatId("bob", "alice")).toBe("bob_alice");
  });
});

describe("unfriend", () => {
  test("arkadaşlık iki taraftan çözülür, sayaçlar 1'er düşer", async () => {
    await expect(unfriend(ALICE, BOB)).resolves.toMatchObject({ removed: true, chatFailed: [] });
    expect(await exists(`Users/${ALICE}/friends/${BOB}`)).toBe(false);
    expect(await adminExists(`Users/${BOB}/friends/${ALICE}`)).toBe(false);
    expect(await field(`Users/${ALICE}`, "friendsCount")).toBe(1);
    expect(await field(`Users/${BOB}`, "friendsCount")).toBe(0);
    // Diğer arkadaşlık dokunulmaz.
    expect(await exists(`Users/${ALICE}/friends/${CAROL}`)).toBe(true);
  });

  test("aralarındaki sohbet SİLİNİR: mesajlar, sabitlemeler, sohbet belgesi, iki tarafın gelen kutusu", async () => {
    await unfriend(ALICE, BOB);
    expect(await ids(`chats/${CHAT_AB}/messages`)).toEqual([]);
    expect(await ids(`chats/${CHAT_AB}/pins`)).toEqual([]);
    expect(await exists(`chats/${CHAT_AB}`)).toBe(false);
    expect(await exists(`Users/${ALICE}/conversations/${BOB}`)).toBe(false);
    // Karşı tarafın gelen kutusu kaydı da gider (Mesajlar listesinde hayalet satır kalmasın).
    expect(await adminExists(`Users/${BOB}/conversations/${ALICE}`)).toBe(false);
  });

  test("benim gelen kutumdaki o kişiden MESAJ bildirimleri gider; diğer bildirimler kalır", async () => {
    await unfriend(ALICE, BOB);
    expect(await ids(`Users/${ALICE}/notifications`)).toEqual(["n2", "n3", "n4"]);
    // Karşı tarafın gelen kutusuna dokunulamaz (kurallar yalnız sahibine silme verir).
    expect(await adminExists(`Users/${BOB}/notifications/nb1`)).toBe(true);
  });

  test("başkalarıyla sohbetler ve grup sohbetleri KALIR", async () => {
    await unfriend(ALICE, BOB);
    expect(await ids(`chats/${CHAT_AC}/messages`)).toEqual(["c1"]);
    expect(await exists(`Users/${ALICE}/conversations/${CAROL}`)).toBe(true);
    expect(await ids("groups/g1/messages")).toEqual(["gm1"]);
  });

  test("TEKRAR çağrı hiçbir şeyi bozmaz: sayaçlar ikinci kez düşmez", async () => {
    await unfriend(ALICE, BOB);
    await expect(unfriend(ALICE, BOB)).resolves.toEqual({ removed: false, chatFailed: [] });
    expect(await field(`Users/${ALICE}`, "friendsCount")).toBe(1);
    expect(await field(`Users/${BOB}`, "friendsCount")).toBe(0);
  });

  test("büyük sohbet: 450'den fazla mesaj parçalara bölünerek silinir", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (let i = 0; i < 520; i += 1) {
        await setDoc(doc(db, `chats/${CHAT_AB}/messages/big${i}`), { senderId: i % 2 ? ALICE : BOB, text: `m${i}` });
      }
    });
    await unfriend(ALICE, BOB);
    expect(await ids(`chats/${CHAT_AB}/messages`)).toEqual([]);
  }, 60000);
});

describe("deleteDirectChat", () => {
  test("arkadaş OLMASA da sohbeti siler ve tekrar çağrılabilir (idempotent)", async () => {
    await expect(deleteDirectChat(ALICE, BOB)).resolves.toEqual({ failed: [] });
    await expect(deleteDirectChat(ALICE, BOB)).resolves.toEqual({ failed: [] });
    expect(await exists(`chats/${CHAT_AB}`)).toBe(false);
    // Arkadaşlık bu fonksiyonla ÇÖZÜLMEZ.
    expect(await exists(`Users/${ALICE}/friends/${BOB}`)).toBe(true);
  });

  test("üyesi olmadığım sohbeti silemez: adımlar başarısız olarak raporlanır, veri kalır", async () => {
    const other = testEnv.authenticatedContext(CAROL).firestore();
    mockHolder.db = other;
    // Carol, Alice–Bob sohbetine üye değil.
    const { failed } = await deleteDirectChat(ALICE, BOB);
    expect(failed).toEqual(expect.arrayContaining(["messages", "chat"]));
    mockHolder.db = testEnv.authenticatedContext(ALICE).firestore();
    expect(await exists(`chats/${CHAT_AB}`)).toBe(true);
  });
});
