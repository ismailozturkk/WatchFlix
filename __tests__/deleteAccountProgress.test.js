// Hesap silme ilerleme görünümünün sözleşmeleri:
//   • İstemci aşama listesi, sunucunun aşama listesiyle (functions/accountPurge.js) AYNI
//     ve AYNI sırada — biri değişirse çubuk yanlış yerde dolar.
//   • Her aşamanın beş dilde etiketi var (ekranda ham kimlik görünmesin) ve adım metni
//     yer tutucularını taşıyor.
//   • "Profil" aşaması en sonda: aynaları taşıyan Users/{uid} ağacını o siler; önce
//     silinirse sonraki aşamalar aynasız kalır.

global.__DEV__ = false;

const fs = require("fs");
const path = require("path");

jest.mock("firebase/auth", () => ({
  EmailAuthProvider: { PROVIDER_ID: "password" },
  GoogleAuthProvider: { PROVIDER_ID: "google.com" },
  reauthenticateWithCredential: jest.fn(),
  deleteUser: jest.fn(),
}));
jest.mock("firebase/firestore", () => ({}));
jest.mock("firebase/functions", () => ({ httpsCallable: jest.fn() }));
jest.mock("firebase/database", () => ({}));
jest.mock("../firebase", () => ({ auth: {}, db: {}, rtdb: null, fns: {} }));
jest.mock("../services/ratingsService", () => ({}));
jest.mock("../services/googleAuthService", () => ({}));
jest.mock("../services/appleAuthService", () => ({}));
jest.mock("../services/postsService", () => ({}));
jest.mock("../services/sharedListsService", () => ({}));
jest.mock("../services/userData", () => ({ purgeUserData: jest.fn() }));

const { DELETE_STAGES, SERVER_PURGE_PHASES } = require("../services/accountService");
const { DELETE_ACCOUNT_COPY, getDeleteAccountCopy } = require("../screens/tabs/profile/deleteAccountCopy");

describe("silme aşamaları", () => {
  it("istemci sunucu aşamaları = functions/accountPurge.js PURGE_PHASES (aynı sıra)", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "functions", "accountPurge.js"), "utf8");
    const block = source.match(/const PURGE_PHASES = Object\.freeze\(\[([\s\S]*?)\]\)/)[1];
    const serverPhases = [...block.matchAll(/"(\w+)"/g)].map((m) => m[1]);
    expect(SERVER_PURGE_PHASES).toEqual(serverPhases);
  });

  it("'profile' sunucu aşamalarının sonuncusu; liste verify → local ile açılıp account ile kapanır", () => {
    expect(SERVER_PURGE_PHASES[SERVER_PURGE_PHASES.length - 1]).toBe("profile");
    expect(DELETE_STAGES[0]).toBe("verify");
    expect(DELETE_STAGES[1]).toBe("local");
    expect(DELETE_STAGES[DELETE_STAGES.length - 1]).toBe("account");
  });
});

describe("ilerleme metinleri", () => {
  const languages = Object.keys(DELETE_ACCOUNT_COPY);

  it("beş dil de var", () => {
    expect(languages.sort()).toEqual(["de", "en", "es", "pt", "tr"]);
  });

  it.each(languages)("%s: her aşamanın (yedek dahil) etiketi dolu", (language) => {
    const copy = DELETE_ACCOUNT_COPY[language];
    for (const id of [...DELETE_STAGES, "fallback"]) {
      expect(typeof copy.stages[id]).toBe("string");
      expect(copy.stages[id].trim().length).toBeGreaterThan(3);
    }
    // Fazladan (artık kullanılmayan) etiket de kalmasın.
    expect(Object.keys(copy.stages).sort()).toEqual([...DELETE_STAGES, "fallback"].sort());
  });

  it.each(languages)("%s: adım metni {n} ve {total} taşır; başlık ve ipucu dolu", (language) => {
    const copy = DELETE_ACCOUNT_COPY[language];
    expect(copy.step).toContain("{n}");
    expect(copy.step).toContain("{total}");
    expect(copy.title.length).toBeGreaterThan(3);
    expect(copy.hint.length).toBeGreaterThan(10);
  });

  it("diller birbirinin kopyası değil (çeviri unutulmasın)", () => {
    const en = JSON.stringify(DELETE_ACCOUNT_COPY.en);
    for (const language of ["tr", "es", "pt", "de"]) {
      expect(JSON.stringify(DELETE_ACCOUNT_COPY[language])).not.toBe(en);
    }
  });

  it("bilinmeyen dil İngilizce'ye düşer", () => {
    expect(getDeleteAccountCopy("fr")).toBe(DELETE_ACCOUNT_COPY.en);
  });
});
