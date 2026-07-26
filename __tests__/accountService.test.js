// Hesap silme akisinin davranis testleri.
//
// Bu repoda jest-expo/Firestore emulator altyapisi yok (bkz. jest.config.js);
// Firebase yuzeyini mock'layip servisi saf JS olarak calistiriyoruz.
// Test edilenler, magaza uyumlulugu icin kritik olan sozlesmeler:
//   - purge HER ZAMAN deleteUser'dan ONCE calisir (Auth silinince Firestore
//     kurallari yazmalari reddeder; sira bozulursa veri yetim kalir)
//   - saglayici tespiti: parola hesabi sifreyle, Google hesabi hesap seciciyle
//     yeniden dogrular; Google kullanicisindan sifre ISTENMEZ
//   - dogrulama iptal edilirse HICBIR veri silinmez

global.__DEV__ = false;

const mockReauthenticateWithCredential = jest.fn();
const mockDeleteUser = jest.fn();

jest.mock("firebase/auth", () => ({
  EmailAuthProvider: {
    PROVIDER_ID: "password",
    credential: (email, password) => ({ type: "password", email, password }),
  },
  GoogleAuthProvider: { PROVIDER_ID: "google.com" },
  reauthenticateWithCredential: (...a) => mockReauthenticateWithCredential(...a),
  deleteUser: (...a) => mockDeleteUser(...a),
}));

// Firestore: purge adimlarinin tamami servis icinde safe() ile sarmalanmis
// oldugundan bos snapshot'lar yeterli — burada amac purge'un CALISTIGINI ve
// deleteUser'dan once bittigini gormek, her koleksiyonu dogrulamak degil.
const calls = [];

jest.mock("firebase/firestore", () => ({
  collection: (...a) => ({ path: a.slice(1).join("/") }),
  doc: (...a) => ({ path: a.slice(1).join("/") }),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  getDocs: jest.fn(async () => ({ empty: true, docs: [] })),
  deleteDoc: jest.fn(async () => void calls.push("purge")),
  updateDoc: jest.fn(async () => void calls.push("purge")),
  query: (...a) => a,
  where: (...a) => a,
  writeBatch: () => ({
    delete: jest.fn(),
    update: jest.fn(),
    set: jest.fn(),
    commit: jest.fn(async () => void calls.push("purge")),
  }),
  increment: (n) => ({ increment: n }),
  arrayRemove: (...a) => ({ arrayRemove: a }),
  deleteField: () => ({ deleteField: true }),
  serverTimestamp: () => ({ serverTimestamp: true }),
}));

jest.mock("firebase/database", () => ({
  ref: (...a) => ({ path: a[1] }),
  remove: jest.fn(async () => {}),
}));

const mockAuth = { currentUser: null };
jest.mock("../firebase", () => ({ auth: mockAuth, db: {}, rtdb: null }));

jest.mock("../services/ratingsService", () => ({
  removeMyRating: jest.fn(async () => {}),
}));
jest.mock("../services/postsService", () => ({
  deleteComment: jest.fn(async () => {}),
}));
jest.mock("../services/sharedListsService", () => ({
  deleteSharedList: jest.fn(async () => {}),
  leaveSharedList: jest.fn(async () => {}),
}));

const mockReauthenticateWithGoogle = jest.fn();
jest.mock("../services/googleAuthService", () => ({
  reauthenticateWithGoogle: (...a) => mockReauthenticateWithGoogle(...a),
}));

const {
  DeleteAccountCode,
  deleteAccount,
  getSignInMethods,
  reauthenticateForDeletion,
} = require("../services/accountService");

const userWith = (...providers) => ({
  uid: "u1",
  email: "user@example.com",
  providerData: providers.map((providerId) => ({ providerId })),
});

const authError = (code) => Object.assign(new Error(code), { code });

beforeEach(() => {
  jest.clearAllMocks();
  calls.length = 0;
  mockAuth.currentUser = null;
  mockReauthenticateWithCredential.mockResolvedValue({});
  mockReauthenticateWithGoogle.mockResolvedValue({ cancelled: false });
  mockDeleteUser.mockImplementation(async () => void calls.push("deleteUser"));
});

describe("getSignInMethods", () => {
  it("providerData'dan parola ve Google saglayicilarini ayirir", () => {
    expect(getSignInMethods(userWith("google.com"))).toMatchObject({
      hasPassword: false,
      hasGoogle: true,
    });
    expect(getSignInMethods(userWith("password"))).toMatchObject({
      hasPassword: true,
      hasGoogle: false,
    });
    expect(getSignInMethods(userWith("password", "google.com"))).toMatchObject({
      hasPassword: true,
      hasGoogle: true,
    });
  });

  it("oturum yoksa bos sonuc doner (UI cokmesin)", () => {
    expect(getSignInMethods(null)).toEqual({
      providerIds: [],
      hasPassword: false,
      hasGoogle: false,
    });
  });
});

describe("reauthenticateForDeletion", () => {
  it("Google hesabinda sifre ISTEMEDEN Google akisini calistirir", async () => {
    mockAuth.currentUser = userWith("google.com");

    await expect(reauthenticateForDeletion()).resolves.toEqual({
      cancelled: false,
    });

    expect(mockReauthenticateWithGoogle).toHaveBeenCalledTimes(1);
    expect(mockReauthenticateWithCredential).not.toHaveBeenCalled();
  });

  it("parola hesabinda e-posta kimlik bilgisiyle dogrular", async () => {
    const user = userWith("password");
    mockAuth.currentUser = user;

    await reauthenticateForDeletion({ password: "secret1" });

    expect(mockReauthenticateWithCredential).toHaveBeenCalledWith(user, {
      type: "password",
      email: "user@example.com",
      password: "secret1",
    });
    expect(mockReauthenticateWithGoogle).not.toHaveBeenCalled();
  });

  it("ikisi de bagliysa parolayi tercih eder (hesap secici acilmaz)", async () => {
    mockAuth.currentUser = userWith("password", "google.com");

    await reauthenticateForDeletion({ password: "secret1" });

    expect(mockReauthenticateWithCredential).toHaveBeenCalledTimes(1);
    expect(mockReauthenticateWithGoogle).not.toHaveBeenCalled();
  });

  it("parola hesabinda sifre yoksa Firebase'e hic gitmez", async () => {
    mockAuth.currentUser = userWith("password");

    await expect(reauthenticateForDeletion()).rejects.toMatchObject({
      code: DeleteAccountCode.NEEDS_PASSWORD,
    });
    expect(mockReauthenticateWithCredential).not.toHaveBeenCalled();
  });
});

describe("deleteAccount", () => {
  it("Google hesabini sifresiz siler; purge deleteUser'dan once biter", async () => {
    mockAuth.currentUser = userWith("google.com");

    await expect(deleteAccount()).resolves.toEqual({ cancelled: false });

    expect(mockReauthenticateWithGoogle).toHaveBeenCalledTimes(1);
    expect(calls).toContain("purge");
    // deleteUser en sonda: Auth silindikten sonra tek bir Firestore yazmasi
    // bile kurallara takilirdi.
    expect(calls[calls.length - 1]).toBe("deleteUser");
    expect(calls.indexOf("deleteUser")).toBe(calls.length - 1);
  });

  it("parola hesabinda ayni sirayi korur", async () => {
    mockAuth.currentUser = userWith("password");

    await deleteAccount({ password: "secret1" });

    expect(mockReauthenticateWithCredential).toHaveBeenCalledTimes(1);
    expect(calls).toContain("purge");
    expect(calls[calls.length - 1]).toBe("deleteUser");
  });

  it("Google secicisi kapatilirsa HICBIR sey silmez", async () => {
    mockAuth.currentUser = userWith("google.com");
    mockReauthenticateWithGoogle.mockResolvedValue({ cancelled: true });

    await expect(deleteAccount()).resolves.toEqual({ cancelled: true });

    expect(calls).toEqual([]);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("UI zaten dogruladiysa hesap secici ikinci kez acilmaz", async () => {
    mockAuth.currentUser = userWith("google.com");

    await deleteAccount({ reauthenticated: true });

    expect(mockReauthenticateWithGoogle).not.toHaveBeenCalled();
    expect(calls[calls.length - 1]).toBe("deleteUser");
  });

  it("dogrulama bayatlarsa yeniden dogrulayip deleteUser'i tekrar dener", async () => {
    mockAuth.currentUser = userWith("password");
    mockDeleteUser
      .mockRejectedValueOnce(authError("auth/requires-recent-login"))
      .mockImplementationOnce(async () => void calls.push("deleteUser"));

    await deleteAccount({ password: "secret1" });

    // Veri ilk denemede zaten silindi; yetim bir Auth hesabi birakmamak icin
    // ikinci tur dogrulama + silme.
    expect(mockReauthenticateWithCredential).toHaveBeenCalledTimes(2);
    expect(mockDeleteUser).toHaveBeenCalledTimes(2);
    expect(calls[calls.length - 1]).toBe("deleteUser");
  });

  it("yeniden dogrulama da basarisizsa orijinal Firebase kodunu firlatir", async () => {
    mockAuth.currentUser = userWith("google.com");
    mockDeleteUser.mockRejectedValue(authError("auth/requires-recent-login"));
    mockReauthenticateWithGoogle.mockResolvedValue({ cancelled: true });

    // UI bu kodu gorup kullaniciyi "yeniden dogrula" adimina gonderiyor.
    await expect(deleteAccount({ reauthenticated: true })).rejects.toMatchObject({
      code: "auth/requires-recent-login",
    });
  });

  it("oturum yoksa purge baslatmaz", async () => {
    mockAuth.currentUser = null;

    await expect(deleteAccount()).rejects.toMatchObject({
      code: DeleteAccountCode.NO_SESSION,
    });
    expect(calls).toEqual([]);
  });
});
