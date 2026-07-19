// Google giris + hesap baglama servisinin davranis testleri.
//
// Bu repoda jest-expo/RN test altyapisi yok (bkz. jest.config.js). Bu yuzden
// native/Firebase bagimliliklarini mock'layip servisi saf JS olarak calistiriyoruz.
// Test edilenler, denetimde bulunan gercek regresyonlar:
//   - cancelGoogleRegistration mevcut bir hesabi ASLA silmemeli
//   - profil okunamadiginda giris "basarisiz" diye firlatmamali
//   - signIn oncesi native signOut cagrilmali (hesap degistirilebilsin)
//   - isGoogleProfileComplete eski username formatlarini kabul etmeli

jest.mock("react-native", () => ({ Platform: { OS: "android" } }));

const mockSignIn = jest.fn();
const mockGoogleSignOut = jest.fn().mockResolvedValue(null);
const mockHasPlayServices = jest.fn().mockResolvedValue(true);

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: (...a) => mockHasPlayServices(...a),
    signIn: (...a) => mockSignIn(...a),
    signOut: (...a) => mockGoogleSignOut(...a),
  },
  isSuccessResponse: (r) => r?.type === "success",
  isErrorWithCode: (e) => typeof e?.code === "string",
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
    SIGN_IN_REQUIRED: "SIGN_IN_REQUIRED",
    NULL_PRESENTER: "NULL_PRESENTER",
  },
}));

const mockStore = new Map();
const mockSetItem = jest.fn(async (k, v) => void mockStore.set(k, v));
const mockRemoveItem = jest.fn(async (k) => void mockStore.delete(k));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (k) => (mockStore.has(k) ? mockStore.get(k) : null)),
  setItem: (...a) => mockSetItem(...a),
  removeItem: (...a) => mockRemoveItem(...a),
}));

const mockSignInWithCredential = jest.fn();
const mockLinkWithCredential = jest.fn();
const mockFirebaseSignOut = jest.fn().mockResolvedValue(undefined);
const mockUnlink = jest.fn().mockResolvedValue(undefined);
const mockEligibilityCheck = jest.fn().mockResolvedValue({ data: { allowed: true } });
const mockFetchSignInMethods = jest.fn().mockResolvedValue([]);

jest.mock("firebase/auth", () => ({
  GoogleAuthProvider: {
    PROVIDER_ID: "google.com",
    credential: (idToken) => ({ idToken }),
  },
  signInWithCredential: (...a) => mockSignInWithCredential(...a),
  linkWithCredential: (...a) => mockLinkWithCredential(...a),
  unlink: (...a) => mockUnlink(...a),
  fetchSignInMethodsForEmail: (...a) => mockFetchSignInMethods(...a),
  signOut: (...a) => mockFirebaseSignOut(...a),
}));

jest.mock("firebase/functions", () => ({
  httpsCallable: () => (...a) => mockEligibilityCheck(...a),
}));

const mockGetDoc = jest.fn();
jest.mock("firebase/firestore", () => ({
  doc: (...a) => ({ path: a.slice(1).join("/") }),
  getDoc: (...a) => mockGetDoc(...a),
}));

const mockAuth = { currentUser: null };
jest.mock("../firebase", () => ({ auth: mockAuth, db: {}, fns: {} }));

const {
  cancelGoogleRegistration,
  isGoogleProfileComplete,
  signInWithGoogle,
  GOOGLE_PROFILE_PENDING_KEY,
  GoogleAuthCode,
  describeGoogleAuthError,
} = require("../services/googleAuthService");

const snapshot = (data) => ({ exists: () => data !== null, data: () => data });

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  mockAuth.currentUser = null;
  mockSetItem.mockImplementation(async (k, v) => void mockStore.set(k, v));
  mockRemoveItem.mockImplementation(async (k) => void mockStore.delete(k));
  mockGoogleSignOut.mockResolvedValue(null);
  mockFirebaseSignOut.mockResolvedValue(undefined);
  mockEligibilityCheck.mockResolvedValue({ data: { allowed: true } });
  mockFetchSignInMethods.mockResolvedValue([]);
  mockSignIn.mockResolvedValue({
    type: "success",
    data: { idToken: "tok", user: { email: "a@b.c" } },
  });
  mockSignInWithCredential.mockResolvedValue({ user: { uid: "u1" } });
});

describe("isGoogleProfileComplete", () => {
  it("username'i olan eski hesaplari TAMAM sayar (regex'e uymasa bile)", () => {
    // Regresyon: isValidUsername regex'i kullanilirsa nokta/Turkce karakter
    // iceren ya da 20 karakterden uzun eski username'ler "eksik" sayilir,
    // kullanici tamamlama ekranina dusup profilini sifirlardi.
    expect(isGoogleProfileComplete({ username: "ismail.oz" })).toBe(true);
    expect(isGoogleProfileComplete({ username: "işmail_öz" })).toBe(true);
    expect(isGoogleProfileComplete({ username: "a".repeat(30) })).toBe(true);
  });

  it("profil yok / username yok / bos ise EKSIK sayar", () => {
    expect(isGoogleProfileComplete(null)).toBe(false);
    expect(isGoogleProfileComplete({})).toBe(false);
    expect(isGoogleProfileComplete({ username: "   " })).toBe(false);
  });
});

describe("signInWithGoogle", () => {
  it("hesap seciciyi acabilmek icin signIn ONCESI native signOut cagirir", async () => {
    // Regresyon: native oturum acik kalirsa SDK son hesabi sessizce yeniden
    // kullanir; kullanici hesap degistiremez.
    mockGetDoc.mockResolvedValue(snapshot({ username: "ali" }));
    await signInWithGoogle();
    expect(mockGoogleSignOut).toHaveBeenCalled();
    const signOutOrder = mockGoogleSignOut.mock.invocationCallOrder[0];
    const signInOrder = mockSignIn.mock.invocationCallOrder[0];
    expect(signOutOrder).toBeLessThan(signInOrder);
  });

  it("iptal edilirse cancelled doner, firlatmaz", async () => {
    mockSignIn.mockResolvedValue({ type: "cancelled", data: null });
    await expect(signInWithGoogle()).resolves.toEqual({ cancelled: true });
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it("profil okunamazsa FIRLATMAZ — oturum acik, kullanici 'basarisiz' gormemeli", async () => {
    // Regresyon: getDoc throw edince signInWithGoogle firliyordu; ekran
    // "Google ile giris basarisiz" gosterirken kullanici aslinda girmisti.
    mockGetDoc.mockRejectedValue(
      Object.assign(new Error("offline"), { code: "unavailable" }),
    );
    const result = await signInWithGoogle();
    expect(result.cancelled).toBe(false);
    expect(result.user).toEqual({ uid: "u1" });
  });

  it("profil eksikse pending isaretini yazar", async () => {
    mockGetDoc.mockResolvedValue(snapshot(null));
    const result = await signInWithGoogle();
    expect(result.needsProfileCompletion).toBe(true);
    expect(mockStore.get(GOOGLE_PROFILE_PENDING_KEY)).toBe("u1");
  });

  it("ayni e-postali sifre hesabi varsa Firebase credential'i gondermez", async () => {
    mockEligibilityCheck.mockRejectedValue({
      code: "functions/already-exists",
      details: { reason: "LINK_REQUIRED" },
    });

    await expect(signInWithGoogle()).rejects.toMatchObject({
      code: GoogleAuthCode.ACCOUNT_REQUIRES_LINK,
    });
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it("callable yoksa yerel provider kontroluyle parola hesabini engeller", async () => {
    mockEligibilityCheck.mockRejectedValue({ code: "functions/not-found" });
    mockFetchSignInMethods.mockResolvedValue(["password"]);

    await expect(signInWithGoogle()).rejects.toMatchObject({
      code: GoogleAuthCode.ACCOUNT_REQUIRES_LINK,
    });
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it("profil tamsa bayat pending isaretini temizler", async () => {
    mockStore.set(GOOGLE_PROFILE_PENDING_KEY, "u1");
    mockGetDoc.mockResolvedValue(snapshot({ username: "ali" }));
    const result = await signInWithGoogle();
    expect(result.needsProfileCompletion).toBe(false);
    expect(mockStore.has(GOOGLE_PROFILE_PENDING_KEY)).toBe(false);
  });

  // Asagidaki iki test, ilk duzeltmede GERCEKTEN olusan bir hatayi kilitler:
  // profil okumasi ile isaret yazimi ayni try icindeydi; okuma BASARILI olup
  // AsyncStorage yazimi duserse catch, dogru hesaplanan cevabi atip yazamadigi
  // isaretten YANLIS cevap turetiyordu. (Android'de AsyncStorage SQLite
  // tabanli: disk doluyken okumalar calisir, yazimlar duser.)
  it("setItem duserse profilsiz kullaniciyi 'tam' gostermez", async () => {
    mockGetDoc.mockResolvedValue(snapshot(null)); // profil GERCEKTEN yok
    mockSetItem.mockRejectedValue(new Error("database or disk is full"));

    const result = await signInWithGoogle();

    expect(result.needsProfileCompletion).toBe(true);
  });

  it("removeItem duserse profili tam olan kullaniciyi tamamlama ekranina atmaz", async () => {
    mockStore.set(GOOGLE_PROFILE_PENDING_KEY, "u1"); // bayat isaret
    mockGetDoc.mockResolvedValue(snapshot({ username: "ali" })); // profil TAM
    mockRemoveItem.mockRejectedValue(new Error("database or disk is full"));

    const result = await signInWithGoogle();

    expect(result.needsProfileCompletion).toBe(false);
  });

  it("Firebase reddederse native oturumu birakmaz ve kodu esler", async () => {
    mockSignInWithCredential.mockRejectedValue({
      code: "auth/network-request-failed",
    });
    await expect(signInWithGoogle()).rejects.toMatchObject({
      code: GoogleAuthCode.NETWORK,
    });
    // signIn oncesi 1 + hata sonrasi 1
    expect(mockGoogleSignOut).toHaveBeenCalledTimes(2);
  });
});

describe("cancelGoogleRegistration", () => {
  it("profil VARSA hesabi SILMEZ — sadece cikis yapar", async () => {
    // Bu testin varlik sebebi: bayat bir pending isareti, profili tam olan bir
    // kullaniciyi da tamamlama ekranina dusurebilir. Oradaki "Baska hesap
    // kullan" hesabini silseydi felaket olurdu.
    const del = jest.fn();
    mockAuth.currentUser = { uid: "u1", delete: del };
    mockGetDoc.mockResolvedValue(snapshot({ username: "ali" }));

    await cancelGoogleRegistration();

    expect(del).not.toHaveBeenCalled();
    expect(mockFirebaseSignOut).toHaveBeenCalled();
  });

  it("profil YOKSA yetim Auth kaydini siler", async () => {
    // Aksi halde e-posta kalici olarak "kullanimda" gorunur ve kullanici
    // sonradan ayni adresle e-posta/sifre kaydi yapamaz.
    const del = jest.fn().mockResolvedValue(undefined);
    mockAuth.currentUser = { uid: "u1", delete: del };
    mockGetDoc.mockResolvedValue(snapshot(null));

    await cancelGoogleRegistration();

    expect(del).toHaveBeenCalled();
    expect(mockFirebaseSignOut).not.toHaveBeenCalled();
  });

  it("profil OKUNAMAZSA silmez (guvenli taraf)", async () => {
    const del = jest.fn();
    mockAuth.currentUser = { uid: "u1", delete: del };
    mockGetDoc.mockRejectedValue(new Error("offline"));

    await cancelGoogleRegistration();

    expect(del).not.toHaveBeenCalled();
    expect(mockFirebaseSignOut).toHaveBeenCalled();
  });

  it("delete reddedilirse cikisa geri duser", async () => {
    const del = jest.fn().mockRejectedValue({ code: "auth/requires-recent-login" });
    mockAuth.currentUser = { uid: "u1", delete: del };
    mockGetDoc.mockResolvedValue(snapshot(null));

    await cancelGoogleRegistration();

    expect(del).toHaveBeenCalled();
    expect(mockFirebaseSignOut).toHaveBeenCalled();
  });

  it("pending isaretini her halukarda temizler", async () => {
    mockStore.set(GOOGLE_PROFILE_PENDING_KEY, "u1");
    mockAuth.currentUser = null;
    await cancelGoogleRegistration();
    expect(mockStore.has(GOOGLE_PROFILE_PENDING_KEY)).toBe(false);
  });
});

describe("describeGoogleAuthError", () => {
  it("ham Firebase metnini sizdirmaz", () => {
    const raw = { message: "Firebase: Error (auth/requires-recent-login)." };
    expect(describeGoogleAuthError(raw, true)).not.toMatch(/Firebase/);
  });

  it("bilinen kodlari iki dilde esler", () => {
    const err = { code: GoogleAuthCode.ALREADY_LINKED_ELSEWHERE };
    expect(describeGoogleAuthError(err, true)).toMatch(/başka bir Watchify/);
    expect(describeGoogleAuthError(err, false)).toMatch(/another Watchify/);
  });
});
