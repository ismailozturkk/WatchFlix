global.__DEV__ = false;

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));

const mockSignInAsync = jest.fn();
jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(async () => true),
  signInAsync: (...args) => mockSignInAsync(...args),
  formatFullName: ({ givenName, familyName }) =>
    [givenName, familyName].filter(Boolean).join(" "),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  getRandomBytesAsync: jest.fn(async () => Uint8Array.from([0, 1, 15, 255])),
  digestStringAsync: jest.fn(async (_algorithm, value) => `hash:${value}`),
}));

const mockSignInWithCredential = jest.fn();
const mockLinkWithCredential = jest.fn();
const mockReauthenticateWithCredential = jest.fn();
const mockUnlink = jest.fn();
const mockUpdateProfile = jest.fn();
jest.mock("firebase/auth", () => ({
  OAuthProvider: class OAuthProvider {
    constructor(providerId) { this.providerId = providerId; }
    credential(value) { return { providerId: this.providerId, ...value }; }
  },
  fetchSignInMethodsForEmail: jest.fn(async () => []),
  signInWithCredential: (...args) => mockSignInWithCredential(...args),
  linkWithCredential: (...args) => mockLinkWithCredential(...args),
  reauthenticateWithCredential: (...args) => mockReauthenticateWithCredential(...args),
  unlink: (...args) => mockUnlink(...args),
  updateProfile: (...args) => mockUpdateProfile(...args),
  signOut: jest.fn(async () => undefined),
}));

const mockCallable = jest.fn();
jest.mock("firebase/functions", () => ({
  httpsCallable: (_fns, name) => (data) => mockCallable(name, data),
}));

const mockGetDoc = jest.fn();
jest.mock("firebase/firestore", () => ({
  doc: (...args) => ({ path: args.slice(1).join("/") }),
  getDoc: (...args) => mockGetDoc(...args),
}));

const mockAuth = { currentUser: null };
jest.mock("../firebase", () => ({ auth: mockAuth, db: {}, fns: {} }));
jest.mock("../services/googleAuthService", () => ({
  isGoogleProfileComplete: (profile) => !!profile?.username,
}));

const {
  AppleAuthCode,
  createAppleNonce,
  linkAppleAccount,
  reauthenticateWithApple,
  signInWithApple,
  unlinkAppleAccount,
} = require("../services/appleAuthService");

const appleResponse = {
  identityToken: "identity-token",
  authorizationCode: "authorization-code",
  email: "apple@example.com",
  fullName: { givenName: "Ada", familyName: "Lovelace" },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.currentUser = null;
  mockSignInAsync.mockResolvedValue(appleResponse);
  mockCallable.mockResolvedValue({ data: { allowed: true } });
  mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ username: "ada" }) });
  mockLinkWithCredential.mockResolvedValue({});
  mockReauthenticateWithCredential.mockResolvedValue({});
  mockUnlink.mockResolvedValue({});
  mockUpdateProfile.mockResolvedValue({});
});

it("nonce'u rastgele uretip Apple'a hash, Firebase'e ham deger verir", async () => {
  const user = { uid: "u1", displayName: null };
  mockSignInWithCredential.mockResolvedValue({ user });

  const result = await signInWithApple();

  expect(mockSignInAsync).toHaveBeenCalledWith(expect.objectContaining({ nonce: "hash:00010fff" }));
  expect(mockSignInWithCredential).toHaveBeenCalledWith(
    mockAuth,
    expect.objectContaining({ idToken: "identity-token", rawNonce: "00010fff" }),
  );
  expect(mockUpdateProfile).toHaveBeenCalledWith(user, { displayName: "Ada Lovelace" });
  expect(result).toMatchObject({ user, needsProfileCompletion: false, cancelled: false });
});

it("Apple iptalini uygulama hatasi yerine belirgin iptal koduna cevirir", async () => {
  mockSignInAsync.mockRejectedValue(Object.assign(new Error("cancel"), { code: "ERR_REQUEST_CANCELED" }));

  await expect(signInWithApple()).rejects.toMatchObject({ code: AppleAuthCode.CANCELLED });
});

it("yeniden dogrulamada hesap silme icin authorization code dondurur", async () => {
  const user = { uid: "u1", providerData: [{ providerId: "apple.com" }] };
  mockAuth.currentUser = user;

  await expect(reauthenticateWithApple()).resolves.toEqual({
    cancelled: false,
    appleAuthorizationCode: "authorization-code",
  });
  expect(mockReauthenticateWithCredential).toHaveBeenCalledWith(
    user,
    expect.objectContaining({ providerId: "apple.com" }),
  );
});

it("Apple baglantisini kaldirmadan once sunucuda yetkiyi iptal eder", async () => {
  const user = {
    uid: "u1",
    providerData: [{ providerId: "apple.com" }, { providerId: "password" }],
    reload: jest.fn(async () => undefined),
  };
  mockAuth.currentUser = user;

  await unlinkAppleAccount();

  expect(mockCallable).toHaveBeenCalledWith("revokeAppleAuthorization", {
    authorizationCode: "authorization-code",
  });
  expect(mockUnlink).toHaveBeenCalledWith(user, "apple.com");
});

it("tek giris yontemi Apple ise baglantiyi kaldirmaz", async () => {
  mockAuth.currentUser = {
    uid: "u1",
    providerData: [{ providerId: "apple.com" }],
  };

  await expect(unlinkAppleAccount()).rejects.toMatchObject({
    code: AppleAuthCode.LAST_PROVIDER,
  });
  expect(mockSignInAsync).not.toHaveBeenCalled();
});

