// Arkadaşlık kapısı — gerçek servis kodu (sendFriendRequest / acceptFriendRequest)
// ve gerçek Firestore kuralları.
//
// "Yalnız arkadaşlar" listeleri (`canReadLists`) okuyanın, sahibin friends alt
// koleksiyonunda kaydı olup olmadığına bakar. O kayıt tek taraflı yazılabilirse
// herkes kendini arkadaş yapıp izleme geçmişini, listeleri ve özel afişleri
// okuyabilir. Karşı tarafın friends kaydına ÇAPRAZ yazım yalnız, sahibin bu
// kişiye gönderdiği bir istek varken (sahibin sentRequests kaydı; onu yalnız
// sahibi yazabilir) serbest olmalı.

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

const { assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, deleteDoc } = require("firebase/firestore");
const { createEmulatorEnv } = require("../helpers/libraryEmulator");
const { acceptFriendRequest, sendFriendRequest } = require("../../services/friendsService");

let testEnv;
const VICTIM = "victim";
const MALLORY = "mallory";
const FRIEND = "friend";

beforeAll(async () => {
  testEnv = await createEmulatorEnv("seelogd-friendship-gate");
});
afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const user = (uid) => ({ uid, displayName: uid, username: uid, avatarIndex: 0 });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const uid of [VICTIM, MALLORY, FRIEND]) {
      await setDoc(doc(db, "Users", uid), {
        displayName: uid,
        friendsCount: 0,
        pendingRequestsInCount: 0,
        pendingRequestsOutCount: 0,
        unreadNotifsCount: 0,
        privacy: { lists: "friends" },
      });
    }
    // Kurbanın yalnız arkadaşlara açık listesi.
    await setDoc(doc(db, "Lists", VICTIM, "watchList", "movie_603"), { id: 603, type: "movie" });
  });
});

describe("tek taraflı arkadaşlık yazılamaz", () => {
  test("istek yokken başkasının friends listesine kendini ekleyemez", async () => {
    await assertFails(setDoc(doc(as(MALLORY), "Users", VICTIM, "friends", MALLORY), { friendUid: MALLORY }));
  });

  test("kendi gelen kutusuna sahte istek koysa da ekleyemez (kanıt yalnız sahibin sentRequests'i)", async () => {
    const m = as(MALLORY);
    // Kendi friendRequests'ine, kurbandan gelmiş gibi kimlikli bir belge (fromUid kendisi olmak zorunda).
    await setDoc(doc(m, "Users", MALLORY, "friendRequests", `${VICTIM}_${MALLORY}`), {
      fromUid: MALLORY,
      status: "pending",
    });
    await assertFails(setDoc(doc(m, "Users", VICTIM, "friends", MALLORY), { friendUid: MALLORY }));
  });

  test("kurbanın sentRequests'ine kanıt yazamaz", async () => {
    await assertFails(
      setDoc(doc(as(MALLORY), "Users", VICTIM, "sentRequests", `${VICTIM}_${MALLORY}`), { toUid: MALLORY }),
    );
  });

  test("sonuç: sahte kayıt denemesinden sonra da 'yalnız arkadaşlar' listesi kapalı kalır", async () => {
    const m = as(MALLORY);
    await setDoc(doc(m, "Users", VICTIM, "friends", MALLORY), { friendUid: MALLORY }).catch(() => {});
    await assertFails(getDoc(doc(m, "Lists", VICTIM, "watchList", "movie_603")));
  });
});

describe("meşru akışlar bozulmaz", () => {
  test("istek gönder → kabul et: iki tarafın friends kaydı yazılır, liste açılır", async () => {
    mockHolder.db = as(VICTIM);
    await sendFriendRequest(user(VICTIM), user(FRIEND));
    mockHolder.db = as(FRIEND);
    await acceptFriendRequest(user(FRIEND), user(VICTIM));

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      expect((await getDoc(doc(db, "Users", VICTIM, "friends", FRIEND))).exists()).toBe(true);
      expect((await getDoc(doc(db, "Users", FRIEND, "friends", VICTIM))).exists()).toBe(true);
    });
    await assertSucceeds(getDoc(doc(as(FRIEND), "Lists", VICTIM, "watchList", "movie_603")));
  });

  test("arkadaş, kendi kaydını güncelleyebilir (profil yayılımı) ve silebilir (arkadaşlıktan çıkma)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "Users", VICTIM, "friends", FRIEND), { friendUid: FRIEND, friendName: "eski" });
    });
    const f = as(FRIEND);
    await assertSucceeds(updateDoc(doc(f, "Users", VICTIM, "friends", FRIEND), { friendName: "yeni" }));
    await assertSucceeds(deleteDoc(doc(f, "Users", VICTIM, "friends", FRIEND)));
  });

  test("sahibi kendi listesine istediğini ekleyebilir (yalnız kendi verisini açar)", async () => {
    await assertSucceeds(setDoc(doc(as(VICTIM), "Users", VICTIM, "friends", FRIEND), { friendUid: FRIEND }));
  });
});
