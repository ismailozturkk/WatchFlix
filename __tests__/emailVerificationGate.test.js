// E-POSTA DOĞRULAMA KAPISI — istemci (context/AuthContext.js + utils/emailVerificationGate.js).
// Doğrulanmamış e-posta+şifre hesabı `user` olarak YAYINLANMAZ (uygulama ağacı kurulmaz),
// `pendingVerificationUser` olur; doğrulanınca markEmailVerified ile içeri alınır.

const mockAuth = { currentUser: null };
let mockAuthListener = null;

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth, cb) => {
    mockAuthListener = cb;
    return () => {};
  },
}));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(async () => ({ exists: () => true, data: () => ({ username: "x" }) })),
}));
jest.mock("../firebase", () => ({ auth: mockAuth, db: {} }));
jest.mock("../services/storage", () => ({
  Keys: { cachedUserId: "cu", cachedInitialRoute: "cr", hasSeenOnboarding: "so", googleProfilePendingUid: "gp" },
  get: jest.fn(() => null),
  set: jest.fn(),
  remove: jest.fn(),
  setActiveUser: jest.fn(),
  getActiveUser: jest.fn(() => null),
  clearUserScope: jest.fn(),
}));
jest.mock("../services/snapshotCache", () => ({ resetSnapshotCache: jest.fn() }));
jest.mock("../services/userData", () => ({ clearUserLocal: jest.fn() }));
jest.mock("../services/googleAuthService", () => ({ isGoogleProfileComplete: () => true }));

const React = require("react");
const TestRenderer = require("react-test-renderer");
const { act } = TestRenderer;
const { AuthProvider, useAuth } = require("../context/AuthContext");
const { requiresEmailVerification, refreshVerification } = require("../utils/emailVerificationGate");

const passwordUser = (extra = {}) => ({
  uid: "u1",
  email: "a@b.co",
  emailVerified: false,
  providerData: [{ providerId: "password" }],
  reload: jest.fn(async () => {}),
  getIdToken: jest.fn(async () => "t"),
  ...extra,
});

function mount() {
  let ctx;
  const Probe = () => {
    ctx = useAuth();
    return null;
  };
  act(() => {
    TestRenderer.create(React.createElement(AuthProvider, null, React.createElement(Probe)));
  });
  return () => ctx;
}

const emit = async (user) => {
  mockAuth.currentUser = user;
  await act(async () => {
    await mockAuthListener(user);
  });
};

describe("requiresEmailVerification", () => {
  test("doğrulanmamış şifre hesabı kapıda kalır", () => {
    expect(requiresEmailVerification(passwordUser())).toBe(true);
  });
  test("doğrulanmış hesap, Google ve Apple geçer; oturumsuz kapı yok", () => {
    expect(requiresEmailVerification(passwordUser({ emailVerified: true }))).toBe(false);
    expect(requiresEmailVerification(passwordUser({ providerData: [{ providerId: "google.com" }] }))).toBe(false);
    expect(requiresEmailVerification(passwordUser({ providerData: [{ providerId: "apple.com" }] }))).toBe(false);
    expect(requiresEmailVerification(null)).toBe(false);
  });
});

describe("refreshVerification", () => {
  test("doğrulandıysa ID token ZORLA yenilenir (kurallar token iddiasına bakar)", async () => {
    const user = passwordUser();
    user.reload.mockImplementation(async () => {
      user.emailVerified = true;
    });
    await expect(refreshVerification(user)).resolves.toBe(true);
    expect(user.getIdToken).toHaveBeenCalledWith(true);
  });
  test("doğrulanmadıysa token yenilenmez", async () => {
    const user = passwordUser();
    await expect(refreshVerification(user)).resolves.toBe(false);
    expect(user.getIdToken).not.toHaveBeenCalled();
  });
});

describe("AuthContext kapısı", () => {
  test("doğrulanmamış hesap user DEĞİL pendingVerificationUser olur", async () => {
    const ctx = mount();
    const user = passwordUser();
    await emit(user);
    expect(ctx().user).toBeNull();
    expect(ctx().pendingVerificationUser).toBe(user);
    expect(ctx().loading).toBe(false);
  });

  test("doğrulanınca markEmailVerified içeri alır", async () => {
    const ctx = mount();
    const user = passwordUser();
    await emit(user);
    user.emailVerified = true;
    await act(async () => {
      expect(ctx().markEmailVerified()).toBe(true);
    });
    expect(ctx().pendingVerificationUser).toBeNull();
    expect(ctx().user).toBe(user);
  });

  test("hâlâ doğrulanmamışsa markEmailVerified kapıyı açmaz", async () => {
    const ctx = mount();
    await emit(passwordUser());
    await act(async () => {
      expect(ctx().markEmailVerified()).toBe(false);
    });
    expect(ctx().user).toBeNull();
  });

  test("kayıt sürerken kapı inmez; bitince gösterilir", async () => {
    const ctx = mount();
    act(() => ctx().holdVerificationGate());
    const user = passwordUser();
    await emit(user);
    expect(ctx().pendingVerificationUser).toBeNull();
    expect(ctx().user).toBeNull();
    act(() => ctx().releaseVerificationGate());
    expect(ctx().pendingVerificationUser).toBe(user);
  });

  test("çıkış yapınca kapı kalkar", async () => {
    const ctx = mount();
    await emit(passwordUser());
    await emit(null);
    expect(ctx().pendingVerificationUser).toBeNull();
    expect(ctx().user).toBeNull();
  });

  test("Google hesabı doğrudan içeri girer", async () => {
    const ctx = mount();
    const user = passwordUser({ providerData: [{ providerId: "google.com" }] });
    await emit(user);
    expect(ctx().user).toBe(user);
    expect(ctx().pendingVerificationUser).toBeNull();
  });
});
