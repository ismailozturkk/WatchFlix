// createUserProfile + isUsernameAvailable + username helper testleri.

jest.mock("firebase/auth", () => ({ updateProfile: jest.fn() }));
jest.mock("../firebase", () => ({ auth: { currentUser: null }, db: {} }));
jest.mock("../utils/avatars", () => ({
  clampAvatarIndex: (i) => i || 0,
  DEFAULT_AVATAR_INDEX: 0,
}));

const mockTx = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
const mockGetDoc = jest.fn();

jest.mock("firebase/firestore", () => ({
  // Alt belgeler de çözülsün (Users/u1/private/account): `col` ve `id` her
  // zaman SON koleksiyon/belge — "Users" filtresi alt belgeleri yakalamasın.
  doc: (_db, ...segs) => ({
    path: segs.join("/"),
    col: segs[segs.length - 2],
    id: segs[segs.length - 1],
  }),
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
  isValidUsername,
  normalizeUsername,
  formatUsernameInput,
  UserProfileErrorCode,
} = require("../services/userService");

const snapshot = (data) => ({ exists: () => data !== null, data: () => data });

function primeTx(docs = {}) {
  mockTx.get.mockImplementation((ref) =>
    Promise.resolve(snapshot(ref.path in docs ? docs[ref.path] : null)),
  );
}

const setsOn = (col) =>
  mockTx.set.mock.calls.filter(([ref]) => ref.col === col);

beforeEach(() => jest.clearAllMocks());

describe("Username validation and helpers", () => {
  describe("normalizeUsername", () => {
    it("bosluklari trimler, Turkce I/İ harflerini i'ye ve kucuk harfe cevirir", () => {
      expect(normalizeUsername("  Ali_42  ")).toBe("ali_42");
      expect(normalizeUsername("İSMAİL_42")).toBe("ismail_42");
      expect(normalizeUsername("")).toBe("");
      expect(normalizeUsername(null)).toBe("");
      expect(normalizeUsername(undefined)).toBe("");
    });
  });

  describe("formatUsernameInput", () => {
    it("bosluklari siler, kucuk harfe cevirir, Turkce I/İ harflerini i yapar ve 20 karakterle sinirlar", () => {
      expect(formatUsernameInput("  John Doe 123  ")).toBe("johndoe123");
      expect(formatUsernameInput("İSMAİL")).toBe("ismail");
      expect(formatUsernameInput("A".repeat(25))).toBe("a".repeat(20));
      expect(formatUsernameInput("User_Name_99")).toBe("user_name_99");
      expect(formatUsernameInput("")).toBe("");
      expect(formatUsernameInput(null)).toBe("");
    });
  });

  describe("isValidUsername", () => {
    it("gecerli kullanici adlarini kabul eder (kucuk harf, rakam, alt cizgi, en az 1 harf)", () => {
      expect(isValidUsername("ali_42")).toBe(true);
      expect(isValidUsername("john_doe")).toBe(true);
      expect(isValidUsername("user123")).toBe(true);
      expect(isValidUsername("a12")).toBe(true);
      expect(isValidUsername("a_1")).toBe(true);
      expect(isValidUsername("a".repeat(20))).toBe(true);
      expect(isValidUsername("123a")).toBe(true);
      expect(isValidUsername("123_456_a")).toBe(true);
    });

    it("sadece rakamlardan olusan kullanici adlarini REDDEDER", () => {
      expect(isValidUsername("123")).toBe(false);
      expect(isValidUsername("12345")).toBe(false);
      expect(isValidUsername("987654321")).toBe(false);
      expect(isValidUsername("007")).toBe(false);
    });

    it("sadece alt cizgi veya rakam+alt cizgiden olusan (harf icermeyen) adlari REDDEDER", () => {
      expect(isValidUsername("___")).toBe(false);
      expect(isValidUsername("123_456")).toBe(false);
      expect(isValidUsername("_12345_")).toBe(false);
    });

    it("buyuk harf iceren kullanici adlarini REDDEDER (kucuk harf zorunlu)", () => {
      expect(isValidUsername("Ali_42")).toBe(false);
      expect(isValidUsername("JOHN")).toBe(false);
      expect(isValidUsername("User_1")).toBe(false);
    });

    it("Turkce karakterleri REDDEDER (yalnizca Ingilizce karakterler)", () => {
      expect(isValidUsername("şakir")).toBe(false);
      expect(isValidUsername("ismail_öz")).toBe(false);
      expect(isValidUsername("ömer_123")).toBe(false);
      expect(isValidUsername("çağlar")).toBe(false);
      expect(isValidUsername("gözde")).toBe(false);
    });

    it("gecersiz ozel karakterleri ve bosluklari REDDEDER", () => {
      expect(isValidUsername("ali.42")).toBe(false);
      expect(isValidUsername("ali-42")).toBe(false);
      expect(isValidUsername("ali@42")).toBe(false);
      expect(isValidUsername("ali 42")).toBe(false);
      expect(isValidUsername("ali#42")).toBe(false);
      expect(isValidUsername("ali!42")).toBe(false);
    });

    it("uzunluk sinirlarini denetler (min 3, max 20)", () => {
      expect(isValidUsername("a")).toBe(false);
      expect(isValidUsername("ab")).toBe(false);
      expect(isValidUsername("abc")).toBe(true);
      expect(isValidUsername("a".repeat(20))).toBe(true);
      expect(isValidUsername("a".repeat(21))).toBe(false);
    });

    it("null/undefined/string olmayan girdileri REDDEDER", () => {
      expect(isValidUsername(null)).toBe(false);
      expect(isValidUsername(undefined)).toBe(false);
      expect(isValidUsername("")).toBe(false);
      expect(isValidUsername(12345)).toBe(false);
    });
  });
});

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

  it("gecersiz formattaki username icin false doner", async () => {
    await expect(isUsernameAvailable("12345")).resolves.toBe(false);
    await expect(isUsernameAvailable("ab")).resolves.toBe(false);
    await expect(isUsernameAvailable("ali.42")).resolves.toBe(false);
  });
});

describe("createUserProfile", () => {
  it("yeni kullanici: rezervasyon + tam profil yazar (kucuk harfle saklar)", async () => {
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
      username: "ali_42",
      usernameLower: "ali_42",
      displayName: "Ali",
      friendsCount: 0,
      createdAt: "TS",
      listVisible: {
        watchedMovies: true,
        watchedTv: true,
        watchList: true,
        favorites: true,
      },
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
    expect(payload).toMatchObject({ username: "ali_42", displayName: "Ali" });
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

  it("sadece rakamlardan olusan username transaction'a hic girmez", async () => {
    await expect(
      createUserProfile({ uid: "u1", username: "123456", email: "a@b.c" }),
    ).rejects.toMatchObject({ code: UserProfileErrorCode.INVALID_USERNAME });
    expect(mockTx.set).not.toHaveBeenCalled();
  });

  // Users/{uid} kök belgesi TÜM oturumlulara okunur; e-posta ve doğum tarihi
  // orada durursa başkası API ile okuyabilir. Yeri: private/account.
  describe("gizli alanlar (e-posta, doğum tarihi)", () => {
    const privateSets = () =>
      mockTx.set.mock.calls.filter(([ref]) => ref.path === "Users/u1/private/account");

    it("yeni profil: KÖKE yazılmaz, aynı transaction'da gizli belgeye yazılır", async () => {
      primeTx({});

      await createUserProfile({
        uid: "u1",
        username: "Ali_42",
        email: "a@b.c",
        birthDate: "1998-03-05",
      });

      const [, rootPayload] = setsOn("Users")[0];
      expect(rootPayload).not.toHaveProperty("email");
      expect(rootPayload).not.toHaveProperty("birthDate");

      expect(privateSets()).toHaveLength(1);
      const [, payload, options] = privateSets()[0];
      expect(payload).toEqual({ email: "a@b.c", birthDate: "1998-03-05", updatedAt: "TS" });
      expect(options).toEqual({ merge: true });
    });

    it("mevcut profili tazelerken kök yine gizli alan taşımaz", async () => {
      primeTx({
        "Usernames/ali_42": { uid: "u1" },
        "Users/u1": { uid: "u1", usernameLower: "ali_42" },
      });

      await createUserProfile({ uid: "u1", username: "Ali_42", email: "a@b.c" });

      const [, rootPayload] = setsOn("Users")[0];
      expect(rootPayload).not.toHaveProperty("email");
      // Tarih bu çağrıda gelmedi → gizli belgeye de yazılmaz (var olan SİLİNMEZ).
      const [, payload] = privateSets()[0];
      expect(payload).not.toHaveProperty("birthDate");
    });

    it("bozuk doğum tarihi gizli belgeye de girmez (kayıt düşmez)", async () => {
      primeTx({});

      await createUserProfile({
        uid: "u1",
        username: "Ali_42",
        email: "a@b.c",
        birthDate: "31-12-1998",
      });

      const [, payload] = privateSets()[0];
      expect(payload).not.toHaveProperty("birthDate");
    });

    it("e-posta yoksa (örn. gizli Apple) gizli belge hiç yazılmaz", async () => {
      primeTx({});

      await createUserProfile({ uid: "u1", username: "Ali_42", email: null });

      expect(privateSets()).toHaveLength(0);
    });
  });
});

describe("updateUserProfile — gizli alan yönlendirmesi", () => {
  const { setDoc, updateDoc } = require("firebase/firestore");
  const { updateUserProfile } = require("../services/userService");

  it("doğum tarihi gizli belgeye gider, kök yamasında YOKTUR", async () => {
    await updateUserProfile("u1", { birthDate: "1998-03-05", bio: "selam" });

    expect(setDoc).toHaveBeenCalledWith(
      { path: "Users/u1/private/account", col: "private", id: "account" },
      { birthDate: "1998-03-05", updatedAt: "TS" },
      { merge: true },
    );
    const rootPatch = updateDoc.mock.calls[0][1];
    expect(rootPatch).toEqual({ bio: "selam", updatedAt: "TS" });
  });

  it("yalnız gizli alan değiştiyse kök belgeye hiç dokunmaz", async () => {
    await updateUserProfile("u1", { birthDate: "1998-03-05" });

    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it("gizli yazım düşerse kök yazımı başlamaz", async () => {
    setDoc.mockRejectedValueOnce(new Error("permission-denied"));

    await expect(
      updateUserProfile("u1", { birthDate: "1998-03-05", bio: "selam" }),
    ).rejects.toThrow("permission-denied");
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it("gizli alan içermeyen yama eskisi gibi tek kök yazımıdır", async () => {
    await updateUserProfile("u1", { displayName: "Ali" });

    expect(setDoc).not.toHaveBeenCalled();
    expect(updateDoc.mock.calls[0][1]).toEqual({ displayName: "Ali", updatedAt: "TS" });
  });
});
