const mockLinkWithCredential = jest.fn();
const mockSendPasswordResetEmail = jest.fn();
const mockUnlink = jest.fn();

jest.mock("firebase/auth", () => ({
  EmailAuthProvider: {
    PROVIDER_ID: "password",
    credential: (email, password) => ({ email, password }),
  },
  linkWithCredential: (...args) => mockLinkWithCredential(...args),
  sendPasswordResetEmail: (...args) => mockSendPasswordResetEmail(...args),
  unlink: (...args) => mockUnlink(...args),
}));

const mockAuth = { currentUser: null };
jest.mock("../firebase", () => ({ auth: mockAuth }));

const {
  AccountConnectionCode,
  addPasswordSignIn,
  sendCurrentUserPasswordReset,
  unlinkAccountProvider,
} = require("../services/accountConnectionsService");

const userWith = (...providers) => ({
  email: "user@example.com",
  providerData: providers.map((providerId) => ({ providerId })),
  reload: jest.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.currentUser = null;
  mockLinkWithCredential.mockResolvedValue({});
  mockSendPasswordResetEmail.mockResolvedValue(undefined);
  mockUnlink.mockResolvedValue({});
});

describe("addPasswordSignIn", () => {
  it("Google-only hesaba ayni e-postayla password provider baglar", async () => {
    const user = userWith("google.com");
    mockAuth.currentUser = user;

    await addPasswordSignIn({ password: "secret1", confirmation: "secret1" });

    expect(mockLinkWithCredential).toHaveBeenCalledWith(user, {
      email: "user@example.com",
      password: "secret1",
    });
  });

  it("parolalar eslesmiyorsa Firebase'e gitmez", async () => {
    mockAuth.currentUser = userWith("google.com");
    await expect(
      addPasswordSignIn({ password: "secret1", confirmation: "secret2" }),
    ).rejects.toMatchObject({ code: AccountConnectionCode.PASSWORD_MISMATCH });
    expect(mockLinkWithCredential).not.toHaveBeenCalled();
  });

  it("password provider zaten bagliysa ikinci kez baglamaz", async () => {
    mockAuth.currentUser = userWith("google.com", "password");
    await expect(
      addPasswordSignIn({ password: "secret1", confirmation: "secret1" }),
    ).rejects.toMatchObject({ code: AccountConnectionCode.ALREADY_LINKED });
  });
});

describe("provider management", () => {
  it("mevcut parola hesabi icin sifirlama e-postasi yollar", async () => {
    mockAuth.currentUser = userWith("password");
    await sendCurrentUserPasswordReset();
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(mockAuth, "user@example.com");
  });

  it("Apple tek giris yontemiyse kaldirmaz", async () => {
    mockAuth.currentUser = userWith("apple.com");
    await expect(unlinkAccountProvider("apple.com")).rejects.toMatchObject({
      code: AccountConnectionCode.LAST_PROVIDER,
    });
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it("baska giris yontemi varsa Apple baglantisini kaldirir", async () => {
    const user = userWith("apple.com", "password");
    mockAuth.currentUser = user;
    await unlinkAccountProvider("apple.com");
    expect(mockUnlink).toHaveBeenCalledWith(user, "apple.com");
  });
});

