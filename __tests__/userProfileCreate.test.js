// createUserProfile + isUsernameAvailable davranis testleri.
//
// Denetimde bulunan iki blocker'i kilitler:
//   1. Kendi rezervasyonuna tx.set atmak -> /Usernames'te `allow update` yok
//      -> PERMISSION_DENIED -> tum transaction duser (retry akisi tamamen kirik).
//   2. Var olan Users dokumanina tam tx.set -> sayaclar/bio/privacy/createdAt
//      sifirlanir (Google baglayan eski kullanicinin hesabi silinir gibi olur).

jest.mock("firebase/auth", () => ({ updateProfile: jest.fn() }));
jest.mock("../firebase", () => ({ auth: { currentUser: null }, db: {} }));
jest.mock("../utils/avatars", () => ({
  clampAvatarIndex: (i) => i || 0,
  DEFAULT_AVATAR_INDEX: 0,
}));

const mockTx = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
const mockGetDoc = jest.fn();

jest.mock("firebase/firestore", () => ({
  doc: (_db, col, id) => ({ path: `${col}/${id}`, col, id }),
  getDoc: (...a) => mockGetDoc(...a),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  runTransaction: (_db, cb) => cb(mockTx),
  serverTimestamp: () => "TS",
  writeBatch: jest.fn(),
}));

const {
  createUserProfile,
  isUsernameAvailable,
  UserProfileErrorCode,
} = require("../services/userService");

const snapshot = (data) => ({ exists: () => data !== null, data: () => data });

// docs: { "Usernames/ali_42": {...}, "Users/u1": {...} } — listelenmeyen her
// yol "yok" sayilir.
function primeTx(docs = {}) {
  mockTx.get.mockImplementation((ref) =>
    Promise.resolve(snapshot(ref.path in docs ? docs[ref.path] : null)),
  );
}

const setsOn = (col) =>
  mockTx.set.mock.calls.filter(([ref]) => ref.col === col);

beforeEach(() => jest.clearAllMocks());

describe("isUsernameAvailable", () => {
  it("kendi rezervasyonunu MUSAIT sayar (excludeUid ile)", async () => {
    mockGetDoc.mockResolvedValue(snapshot({ uid: "me" }));
    await expect(isUsernameAvailable("ali_42", { excludeUid: "me" })).resolves.toBe(
      true,
    );
  });

  it("baskasinin rezervasyonunu DOLU sayar", async () => {
    mockGetDoc.mockResolvedValue(snapshot({ uid: "someone_else" }));
    await expect(isUsernameAvailable("ali_42", { excludeUid: "me" })).resolves.toBe(
      false,
    );
  });

  it("excludeUid verilmezse eski davranis korunur", async () => {
    mockGetDoc.mockResolvedValue(snapshot({ uid: "me" }));
    await expect(isUsernameAvailable("ali_42")).resolves.toBe(false);
  });

  it("rezervasyon yoksa musait", async () => {
    mockGetDoc.mockResolvedValue(snapshot(null));
    await expect(isUsernameAvailable("ali_42")).resolves.toBe(true);
  });
});

describe("createUserProfile", () => {
  it("yeni kullanici: rezervasyon + tam profil yazar", async () => {
    primeTx({});

    await createUserProfile({
      uid: "u1",
      username: "Ali_42",
      email: "a@b.c",
      displayName: "Ali",
    });

    expect(setsOn("Usernames")).toHaveLength(1);
    const [, payload] = setsOn("Users")[0];
    expect(payload).toMatchObject({
      uid: "u1",
      username: "Ali_42",
      usernameLower: "ali_42",
      friendsCount: 0,
      createdAt: "TS",
    });
  });

  it("rezervasyon zaten BIZIMSE Usernames'e yazmaz (PERMISSION_DENIED onlenir)", async () => {
    primeTx({ "Usernames/ali_42": { uid: "u1" } });

    await createUserProfile({ uid: "u1", username: "Ali_42", email: "a@b.c" });

    expect(setsOn("Usernames")).toHaveLength(0);
    expect(setsOn("Users")).toHaveLength(1);
  });

  it("rezervasyon BASKASININSA kodlu hata firlatir", async () => {
    primeTx({ "Usernames/ali_42": { uid: "other" } });

    // UI metne regex atmasin diye kod sart (ham metin kullaniciya gosterilmez).
    await expect(
      createUserProfile({ uid: "u1", username: "Ali_42", email: "a@b.c" }),
    ).rejects.toMatchObject({ code: UserProfileErrorCode.USERNAME_TAKEN });
  });

  it("profil VARSA sayaclari/bio'yu/createdAt'i EZMEZ, merge ile kimlik tazeler", async () => {
    primeTx({
      "Usernames/ali_42": { uid: "u1" },
      "Users/u1": { uid: "u1", usernameLower: "ali_42", friendsCount: 12, bio: "selam" },
    });

    await createUserProfile({
      uid: "u1",
      username: "Ali_42",
      email: "a@b.c",
      displayName: "Ali",
    });

    const [, payload, options] = setsOn("Users")[0];
    expect(options).toEqual({ merge: true });
    expect(payload).not.toHaveProperty("friendsCount");
    expect(payload).not.toHaveProperty("bio");
    expect(payload).not.toHaveProperty("createdAt");
    expect(payload).not.toHaveProperty("privacy");
    expect(payload).toMatchObject({ username: "Ali_42", displayName: "Ali" });
  });

  it("username degistiyse eski rezervasyonu birakmaz (username yanmasin)", async () => {
    primeTx({
      "Users/u1": { uid: "u1", usernameLower: "eski_ad" },
      "Usernames/eski_ad": { uid: "u1" },
    });

    await createUserProfile({ uid: "u1", username: "Yeni_Ad", email: "a@b.c" });

    expect(mockTx.delete).toHaveBeenCalledWith(
      expect.objectContaining({ col: "Usernames", id: "eski_ad" }),
    );
  });

  it("eski rezervasyon YOKSA delete atmaz (var olmayan dokumana delete kurali dusurur)", async () => {
    primeTx({ "Users/u1": { uid: "u1", usernameLower: "eski_ad" } });

    await createUserProfile({ uid: "u1", username: "Yeni_Ad", email: "a@b.c" });

    expect(mockTx.delete).not.toHaveBeenCalled();
  });

  it("eski rezervasyon BASKASININSA delete atmaz", async () => {
    primeTx({
      "Users/u1": { uid: "u1", usernameLower: "eski_ad" },
      "Usernames/eski_ad": { uid: "someone_else" },
    });

    await createUserProfile({ uid: "u1", username: "Yeni_Ad", email: "a@b.c" });

    expect(mockTx.delete).not.toHaveBeenCalled();
  });

  it("gecersiz username transaction'a hic girmez", async () => {
    await expect(
      createUserProfile({ uid: "u1", username: "ab", email: "a@b.c" }),
    ).rejects.toMatchObject({ code: UserProfileErrorCode.INVALID_USERNAME });
    expect(mockTx.set).not.toHaveBeenCalled();
  });
});
