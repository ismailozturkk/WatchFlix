// services/authEmail.js — şifre sıfırlama ve doğrulama e-postalarının TEK girişi.
//   • adres temizliği (otomatik tamamlamanın bıraktığı boşluklar)
//   • e-posta şablon dili: auth.languageCode uygulama diline ayarlanır (eskiden hiç ayarlanmıyordu)
//   • hata sınıflama: çevrimdışı / çok fazla deneme / geçersiz adres ayrı (eskiden hepsi "geçersiz e-posta")
//   • sıfırlamada hesap yok (user-not-found) başarı sayılır — hesap var/yok bilgisi sızmasın
//   • doğrulama: önce kullanıcı tazelenir, zaten doğrulanmışsa e-posta gitmez

global.__DEV__ = false;

const mockSendReset = jest.fn();
const mockSendVerify = jest.fn();
jest.mock("firebase/auth", () => ({
  sendPasswordResetEmail: (...args) => mockSendReset(...args),
  sendEmailVerification: (...args) => mockSendVerify(...args),
}));
const mockAuth = { languageCode: null };
jest.mock("../firebase", () => ({ auth: mockAuth }));
jest.mock("../translations", () => ({ __esModule: true, default: { language: "tr" } }));

const {
  AuthEmailCode,
  authEmailErrorMessage,
  authLanguageCode,
  classifyAuthEmailError,
  cleanEmail,
  sendResetEmail,
  sendVerificationEmail,
} = require("../services/authEmail");
const { AUTH_EMAIL_COPY } = require("../utils/authEmailCopy");

const firebaseError = (code) => Object.assign(new Error(code), { code });
const fakeUser = (over = {}) => ({
  email: "ada@example.com",
  emailVerified: false,
  reload: jest.fn(async () => {}),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.languageCode = null;
  mockSendReset.mockResolvedValue(undefined);
  mockSendVerify.mockResolvedValue(undefined);
});

describe("cleanEmail / authLanguageCode", () => {
  it("boşlukları baştan, sondan ve ortadan siler", () => {
    expect(cleanEmail("  ada@example.com ")).toBe("ada@example.com");
    expect(cleanEmail("ada @ example.com\n")).toBe("ada@example.com");
    expect(cleanEmail(undefined)).toBe("");
  });

  it("uygulama dilini Firebase şablon diline çevirir (pt → pt-BR), bilinmeyen İngilizce", () => {
    expect(authLanguageCode("tr")).toBe("tr");
    expect(authLanguageCode("pt")).toBe("pt-BR");
    expect(authLanguageCode("de")).toBe("de");
    expect(authLanguageCode("es")).toBe("es");
    expect(authLanguageCode("xx")).toBe("en");
  });
});

describe("sendResetEmail", () => {
  it("temizlenmiş adrese gönderir ve şablon dilini uygulama diline ayarlar", async () => {
    await expect(sendResetEmail("  ada@example.com ", { language: "pt" })).resolves.toBe("ada@example.com");
    expect(mockSendReset).toHaveBeenCalledWith(mockAuth, "ada@example.com");
    expect(mockAuth.languageCode).toBe("pt-BR");
  });

  it("dil verilmezse uygulamanın geçerli dilini kullanır", async () => {
    await sendResetEmail("ada@example.com");
    expect(mockAuth.languageCode).toBe("tr");
  });

  it("geçersiz adres ağa HİÇ çıkmaz", async () => {
    await expect(sendResetEmail("ada")).rejects.toMatchObject({ code: AuthEmailCode.INVALID_EMAIL });
    await expect(sendResetEmail("")).rejects.toMatchObject({ code: AuthEmailCode.INVALID_EMAIL });
    expect(mockSendReset).not.toHaveBeenCalled();
  });

  it("hesap yoksa (user-not-found) başarı sayılır: hesap var/yok sızmaz", async () => {
    mockSendReset.mockRejectedValue(firebaseError("auth/user-not-found"));
    await expect(sendResetEmail("kimse@example.com")).resolves.toBe("kimse@example.com");
  });

  it.each([
    ["auth/network-request-failed", AuthEmailCode.OFFLINE],
    ["auth/too-many-requests", AuthEmailCode.TOO_MANY],
    ["auth/invalid-email", AuthEmailCode.INVALID_EMAIL],
    ["auth/internal-error", AuthEmailCode.UNKNOWN],
  ])("%s → %s", async (firebaseCode, expected) => {
    mockSendReset.mockRejectedValue(firebaseError(firebaseCode));
    await expect(sendResetEmail("ada@example.com")).rejects.toMatchObject({ name: "AuthEmailError", code: expected });
  });
});

describe("sendVerificationEmail", () => {
  it("oturum yoksa NO_SESSION", async () => {
    await expect(sendVerificationEmail(null)).rejects.toMatchObject({ code: AuthEmailCode.NO_SESSION });
    expect(mockSendVerify).not.toHaveBeenCalled();
  });

  it("önce kullanıcıyı tazeler; bu arada doğrulandıysa e-posta GİTMEZ", async () => {
    const user = fakeUser({
      reload: jest.fn(async function reload() { user.emailVerified = true; }),
    });
    await expect(sendVerificationEmail(user)).resolves.toEqual({ sent: false, alreadyVerified: true });
    expect(user.reload).toHaveBeenCalled();
    expect(mockSendVerify).not.toHaveBeenCalled();
  });

  it("doğrulanmamışsa uygulama dilinde gönderir", async () => {
    const user = fakeUser();
    await expect(sendVerificationEmail(user, { language: "de" })).resolves.toEqual({ sent: true, alreadyVerified: false });
    expect(mockSendVerify).toHaveBeenCalledWith(user);
    expect(mockAuth.languageCode).toBe("de");
  });

  it("tazeleme (çevrimdışı) düşse de gönderimi dener", async () => {
    const user = fakeUser({ reload: jest.fn(async () => { throw firebaseError("auth/network-request-failed"); }) });
    await expect(sendVerificationEmail(user)).resolves.toMatchObject({ sent: true });
  });

  it("gönderim hataları sınıflanır", async () => {
    mockSendVerify.mockRejectedValue(firebaseError("auth/too-many-requests"));
    await expect(sendVerificationEmail(fakeUser())).rejects.toMatchObject({ code: AuthEmailCode.TOO_MANY });
  });
});

describe("hata metinleri", () => {
  it("sınıflama: AuthEmailError olduğu gibi, bilinmeyen kod UNKNOWN", () => {
    expect(classifyAuthEmailError({ name: "AuthEmailError", code: AuthEmailCode.OFFLINE })).toBe(AuthEmailCode.OFFLINE);
    expect(classifyAuthEmailError(firebaseError("auth/whatever"))).toBe(AuthEmailCode.UNKNOWN);
    expect(classifyAuthEmailError(undefined)).toBe(AuthEmailCode.UNKNOWN);
  });

  it.each(Object.keys(AUTH_EMAIL_COPY))("%s: her hata türünün ayrı, dolu bir metni var", (language) => {
    const copy = AUTH_EMAIL_COPY[language];
    const texts = [
      authEmailErrorMessage({ name: "AuthEmailError", code: AuthEmailCode.INVALID_EMAIL }, language),
      authEmailErrorMessage({ name: "AuthEmailError", code: AuthEmailCode.OFFLINE }, language),
      authEmailErrorMessage({ name: "AuthEmailError", code: AuthEmailCode.TOO_MANY }, language),
      authEmailErrorMessage({ name: "AuthEmailError", code: AuthEmailCode.NO_SESSION }, language),
      authEmailErrorMessage(firebaseError("x"), language),
    ];
    expect(new Set(texts).size).toBe(5);
    expect(texts).toEqual([copy.invalidEmail, copy.offline, copy.tooMany, copy.noSession, copy.generic]);
  });
});
