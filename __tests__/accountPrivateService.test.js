// services/accountPrivateService.js — e-posta + doğum tarihi gizli belgesi.
//
// Kritik sözleşme: kök belgedeki eski kopya ANCAK gizli belgeye yazıldıktan
// sonra silinir (ters sıra yaş kaydını yok ederdi).

const mockOrder = [];
const mockSetDoc = jest.fn((ref) => {
  mockOrder.push(`set:${ref.path}`);
  return Promise.resolve();
});
const mockUpdateDoc = jest.fn((ref) => {
  mockOrder.push(`update:${ref.path}`);
  return Promise.resolve();
});
const mockGetDoc = jest.fn();

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  doc: (_db, ...segments) => ({ path: segments.join("/") }),
  getDoc: (...a) => mockGetDoc(...a),
  setDoc: (...a) => mockSetDoc(...a),
  updateDoc: (...a) => mockUpdateDoc(...a),
  onSnapshot: jest.fn(),
  deleteField: () => "DELETE",
  serverTimestamp: () => "TS",
}));

const {
  ACCOUNT_PRIVATE_FIELDS,
  migrateRootAccountFields,
  pickAccountFields,
  splitAccountFields,
  writeAccountFields,
} = require("../services/accountPrivateService");

const snapshot = (data) => ({ exists: () => data !== null, data: () => data });

beforeEach(() => {
  jest.clearAllMocks();
  mockOrder.length = 0;
});

describe("pickAccountFields / splitAccountFields", () => {
  it("yalnız e-posta ve doğum tarihini, geçerli değerle alır", () => {
    expect(ACCOUNT_PRIVATE_FIELDS).toEqual(["email", "birthDate"]);
    expect(
      pickAccountFields({
        email: " a@b.co ",
        birthDate: "1998-03-05",
        displayName: "Ali",
      }),
    ).toEqual({ email: "a@b.co", birthDate: "1998-03-05" });
  });

  it("boş / null / string olmayan değeri düşürür (kuralın `is string` şartı)", () => {
    expect(pickAccountFields({ email: "", birthDate: null })).toEqual({});
    expect(pickAccountFields({ email: 12, birthDate: undefined })).toEqual({});
    expect(pickAccountFields(null)).toEqual({});
  });

  it("yamayı gizli ve kök olarak ayırır; geçersiz gizli alan kökte de görünmez", () => {
    const { account, rest } = splitAccountFields({
      birthDate: "1998-03-05",
      email: null,
      bio: "merhaba",
    });
    expect(account).toEqual({ birthDate: "1998-03-05" });
    expect(rest).toEqual({ bio: "merhaba" });
    expect(rest).not.toHaveProperty("email");
  });
});

describe("writeAccountFields", () => {
  it("gizli belgeye merge ile yazar ve updatedAt ekler", async () => {
    await expect(writeAccountFields("u1", { birthDate: "1998-03-05" })).resolves.toBe(true);
    expect(mockSetDoc).toHaveBeenCalledWith(
      { path: "Users/u1/private/account" },
      { birthDate: "1998-03-05", updatedAt: "TS" },
      { merge: true },
    );
  });

  it("yazılacak alan yoksa hiçbir şey yazmaz", async () => {
    await expect(writeAccountFields("u1", {})).resolves.toBe(false);
    await expect(writeAccountFields("u1", { email: "" })).resolves.toBe(false);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

describe("migrateRootAccountFields", () => {
  it("kökte eski alan yoksa hiçbir şey yapmaz (ağa bile çıkmaz)", async () => {
    await expect(migrateRootAccountFields("u1", { username: "ali" })).resolves.toBe("none");
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("ÖNCE gizli belgeye yazar, SONRA kökten siler", async () => {
    mockGetDoc.mockResolvedValue(snapshot(null));
    const result = await migrateRootAccountFields("u1", {
      email: "a@b.co",
      birthDate: "1998-03-05",
      username: "ali",
    });
    expect(result).toBe("migrated");
    expect(mockOrder).toEqual(["set:Users/u1/private/account", "update:Users/u1"]);
    expect(mockSetDoc.mock.calls[0][1]).toMatchObject({
      email: "a@b.co",
      birthDate: "1998-03-05",
    });
    // Yalnız o iki alan siliniyor; updatedAt'e dokunulmuyor (bakım, kullanıcı eylemi değil).
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { path: "Users/u1" },
      { email: "DELETE", birthDate: "DELETE" },
    );
  });

  it("gizli belgede zaten olan değeri ezmez (e-posta sonradan değişmiş olabilir)", async () => {
    mockGetDoc.mockResolvedValue(snapshot({ email: "yeni@b.co", birthDate: "1998-03-05" }));
    const result = await migrateRootAccountFields("u1", {
      email: "eski@b.co",
      birthDate: "1998-03-05",
    });
    expect(result).toBe("migrated");
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it("doğum tarihi çelişiyorsa kökten SİLMEZ", async () => {
    mockGetDoc.mockResolvedValue(snapshot({ birthDate: "2010-01-01" }));
    const result = await migrateRootAccountFields("u1", { birthDate: "1998-03-05" });
    expect(result).toBe("conflict");
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("geçersiz kök değeri (null) kopyalanmaz ama kökten temizlenir", async () => {
    mockGetDoc.mockResolvedValue(snapshot(null));
    const result = await migrateRootAccountFields("u1", { email: null });
    expect(result).toBe("migrated");
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).toHaveBeenCalledWith({ path: "Users/u1" }, { email: "DELETE" });
  });

  it("gizli yazım düşerse kökten SİLİNMEZ (yaş kaydı kaybolmaz)", async () => {
    mockGetDoc.mockResolvedValue(snapshot(null));
    mockSetDoc.mockRejectedValueOnce(new Error("permission-denied"));
    await expect(
      migrateRootAccountFields("u1", { birthDate: "1998-03-05" }),
    ).rejects.toThrow("permission-denied");
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
