// Hesabı SIFIRLA'nın Etkinliklerim kısmı — GERÇEK servis kodu, GERÇEK Firestore kuralları.
// Odak: istemci kuralları gönderi / yorum / beğeni / puan / ayna silmeye ve sayaç
// düşümüne izin veriyor mu, başkasının verisine ve hesabın kendisine dokunulmuyor mu.

const mockHolder = { db: null };
jest.mock("../../firebase", () => ({
  get db() {
    return mockHolder.db;
  },
  auth: { currentUser: { uid: "alice" } },
  rtdb: null,
  fns: {},
}));
jest.mock("firebase/auth", () => ({
  EmailAuthProvider: { PROVIDER_ID: "password" },
  GoogleAuthProvider: { PROVIDER_ID: "google.com" },
  reauthenticateWithCredential: jest.fn(),
  deleteUser: jest.fn(),
}));
jest.mock("firebase/functions", () => ({ httpsCallable: jest.fn() }));
jest.mock("firebase/database", () => ({}));
jest.mock("../../services/googleAuthService", () => ({}));
jest.mock("../../services/appleAuthService", () => ({}));
jest.mock("../../services/sharedListsService", () => ({}));
jest.mock("../../services/userData", () => ({
  purgeUserData: jest.fn(),
  startUserData: jest.fn(),
  stopUserData: jest.fn(),
}));
jest.mock("../../services/storage", () => ({
  Keys: new Proxy({}, { get: (_t, name) => ({ name }) }),
  remove: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  purgeUserScope: jest.fn(),
}));
jest.mock("../../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
jest.mock("../../utils/avatars", () => ({ AVATARS: [], CUSTOM_AVATAR_INDEX: -1, clampAvatarIndex: (i) => Number(i) || 0 }));
jest.mock("../../utils/watchBadgeLedger", () => ({ resetWatchLedger: jest.fn() }));
jest.mock("../../services/analytics", () => require("../helpers/libraryEmulator").analyticsMock());
jest.mock("../../services/activationAnalytics", () => ({ trackFirstContentActivation: jest.fn() }));
jest.mock("../../services/usageTrackerService", () => require("../helpers/libraryEmulator").usageMock());
jest.mock("../../utils/cacheStore", () => require("../helpers/libraryEmulator").cacheStoreMock());

const { doc, getDoc, getDocs, collection, setDoc } = require("firebase/firestore");
const { createEmulatorEnv } = require("../helpers/libraryEmulator");
const { resetAccount } = require("../../services/accountResetService");
const { resetWatchLedger } = require("../../utils/watchBadgeLedger");

let testEnv;
const ALICE = "alice";
const BOB = "bob";

beforeAll(async () => {
  testEnv = await createEmulatorEnv("seelogd-account-reset");
});
afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const put = (path, data) => setDoc(doc(db, path), data);
    await put(`Users/${ALICE}`, { displayName: "Alice", username: "alice", postsCount: 1 });
    await put(`Users/${BOB}`, { displayName: "Bob", username: "bob", postsCount: 1 });
    await put(`Users/${ALICE}/friends/${BOB}`, { uid: BOB });
    // Alice'in gönderisi (Bob beğenmiş + yorum yapmış).
    await put("Posts/pA", { authorId: ALICE, likesCount: 1, commentsCount: 1, content: "a" });
    await put(`Posts/pA/likes/${BOB}`, { userId: BOB });
    await put("Posts/pA/comments/ca1", { authorId: BOB, content: "bob yorumu" });
    // Bob'un gönderisi (Alice beğenmiş + yorum yapmış + kaydetmiş).
    await put("Posts/pB", { authorId: BOB, likesCount: 1, commentsCount: 1, content: "b" });
    await put(`Posts/pB/likes/${ALICE}`, { userId: ALICE });
    await put("Posts/pB/comments/cb1", { authorId: ALICE, content: "alice yorumu" });
    await put(`Users/${ALICE}/likedPosts/pB`, { at: 1 });
    await put(`Users/${ALICE}/bookmarks/pB`, { at: 1 });
    await put(`Users/${ALICE}/myComments/cb1`, { kind: "post", targetId: "pB" });
    // Film yorumu.
    await put("MovieComment/603/comments/mc1", { userId: ALICE, text: "iyi" });
    await put(`Users/${ALICE}/myComments/mc1`, { kind: "movie", targetId: 603 });
    // Puan: iki kişi oylamış.
    await put(`Users/${ALICE}/myRatings/movie_550`, { mediaType: "movie", mediaId: 550, rating: 8 });
    await put("Ratings/movie_550", { mediaType: "movie", mediaId: 550, count: 2, sum: 16 });
    await put(`Ratings/movie_550/userRatings/${ALICE}`, { rating: 8 });
    await put(`Ratings/movie_550/userRatings/${BOB}`, { rating: 8 });
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  jest.clearAllMocks();
  mockHolder.db = testEnv.authenticatedContext(ALICE).firestore();
  await seed();
});

const exists = async (path) => (await getDoc(doc(mockHolder.db, path))).exists();
const ids = async (path) => (await getDocs(collection(mockHolder.db, path))).docs.map((d) => d.id);

describe("hesabı sıfırla — Etkinliklerim (gerçek kurallar)", () => {
  test("gönderilerim, yorumlarım, beğenilerim, kayıtlarım ve puanlarım silinir; ayna koleksiyonları boşalır", async () => {
    await expect(resetAccount({ reauthenticated: true })).resolves.toEqual({ cancelled: false });

    // Gönderilerim (alt koleksiyonlarıyla).
    expect(await exists("Posts/pA")).toBe(false);
    expect(await ids("Posts/pA/likes")).toEqual([]);
    expect(await ids("Posts/pA/comments")).toEqual([]);
    // Yorumlarım: başkasının gönderisindeki ve film sayfasındaki.
    expect(await ids("Posts/pB/comments")).toEqual([]);
    expect(await exists("MovieComment/603/comments/mc1")).toBe(false);
    // Beğenilerim ve kayıtlarım.
    expect(await ids("Posts/pB/likes")).toEqual([]);
    for (const sub of ["likedPosts", "bookmarks", "myComments", "myRatings"]) {
      expect(await ids(`Users/${ALICE}/${sub}`)).toEqual([]);
    }
    // Puan: Alice'in oyu düştü, Bob'unki ve agregat tutarlı.
    expect(await exists(`Ratings/movie_550/userRatings/${ALICE}`)).toBe(false);
    expect(await exists(`Ratings/movie_550/userRatings/${BOB}`)).toBe(true);
    const agg = (await getDoc(doc(mockHolder.db, "Ratings/movie_550"))).data();
    expect(agg).toMatchObject({ count: 1, sum: 8 });
  });

  test("başkasının gönderisi kalır, sayaçları düşer; gönderi sayacı 0 olur", async () => {
    await resetAccount({ reauthenticated: true });
    const bobPost = (await getDoc(doc(mockHolder.db, "Posts/pB"))).data();
    expect(bobPost).toMatchObject({ authorId: BOB, likesCount: 0, commentsCount: 0 });
    const alice = (await getDoc(doc(mockHolder.db, `Users/${ALICE}`))).data();
    expect(alice.postsCount).toBe(0);
  });

  test("hesabın kendisi ve ilişkiler KALIR (profil belgesi, arkadaşlar, başkasının profili)", async () => {
    await resetAccount({ reauthenticated: true });
    expect(await exists(`Users/${ALICE}`)).toBe(true);
    expect(await exists(`Users/${ALICE}/friends/${BOB}`)).toBe(true);
    expect(await exists(`Users/${BOB}`)).toBe(true);
    expect((await getDoc(doc(mockHolder.db, `Users/${ALICE}`))).data()).toMatchObject({ displayName: "Alice", username: "alice" });
  });

  test("rozet defteri canlı kancayla birlikte sıfırlanır; ikinci tur sorunsuz (idempotent)", async () => {
    await resetAccount({ reauthenticated: true });
    expect(resetWatchLedger).toHaveBeenCalledWith(ALICE);
    await expect(resetAccount({ reauthenticated: true })).resolves.toEqual({ cancelled: false });
  });
});
