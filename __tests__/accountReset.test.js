// Hesabı sıfırla (services/accountResetService.js):
//   • aşama kimlikleri = ilerleme metinleri (beş dilde dolu, ham kimlik görünmez)
//   • doğrulama iptal/başarısız → HİÇBİR veri silinmez, işçi durdurulmaz
//   • sıra: işçi DURUR → bulut silinir → yerel kopya temizlenir → işçi yeniden başlar
//   • hesap (Users/{uid} profil belgesi, arkadaşlar, gönderiler…) ve premium günlük haklar KALIR
//   • bir adım düşerse diğerleri çalışır; sonda INCOMPLETE fırlatılır, yerel temizlik yine yapılır

global.__DEV__ = false;

const mockLog = [];
const mockPaths = { deleted: [] };
const mockStore = new Map(); // yol → [{ id, data }]

jest.mock("../firebase", () => ({ auth: { currentUser: { uid: "u1" } }, db: { name: "db" } }));
jest.mock("firebase/firestore", () => ({
  collection: (_db, ...path) => ({ kind: "col", path: path.join("/") }),
  doc: (_db, ...path) => ({ kind: "doc", path: path.join("/"), id: path[path.length - 1] }),
  getDocs: async (colRef) => {
    mockLog.push(`read:${colRef.path}`);
    const rows = mockStore.get(colRef.path) || [];
    return {
      empty: rows.length === 0,
      docs: rows.map((row) => ({ id: row.id, data: () => row.data, ref: { kind: "doc", path: `${colRef.path}/${row.id}`, id: row.id } })),
    };
  },
  deleteDoc: async (ref) => {
    if (mockPaths.failOn && mockPaths.failOn(ref.path)) throw new Error("permission-denied");
    mockPaths.deleted.push(ref.path);
    mockLog.push(`delete:${ref.path}`);
  },
}));
jest.mock("../services/accountService", () => ({
  deleteCollection: async (colRef) => {
    const { getDocs, deleteDoc } = require("firebase/firestore");
    const snap = await getDocs(colRef);
    for (const d of snap.docs) await deleteDoc(d.ref);
    return snap.docs;
  },
  reauthenticateForDeletion: jest.fn(async () => ({ cancelled: false })),
}));
const mockRemoveRating = jest.fn(async () => {});
jest.mock("../services/ratingsService", () => ({ removeMyRating: (...a) => mockRemoveRating(...a) }));
jest.mock("../services/listItemsService", () => ({
  ensureListsRoot: jest.fn(async (uid) => { mockLog.push(`ensureRoot:${uid}`); }),
}));
jest.mock("../services/listSyncService", () => ({
  setLocalList: jest.fn((uid, key, map) => { mockLog.push(`localList:${key}:${Object.keys(map).length}`); }),
}));
jest.mock("../services/userData", () => ({
  stopUserData: jest.fn((uid) => { mockLog.push(`worker:stop:${uid}`); }),
  startUserData: jest.fn((uid) => { mockLog.push(`worker:start:${uid}`); }),
  purgeUserData: jest.fn((uid) => { mockLog.push(`local:purge:${uid}`); }),
}));
jest.mock("../services/storage", () => ({
  Keys: new Proxy({}, { get: (_t, name) => ({ name }) }),
  remove: jest.fn((descriptor) => { mockLog.push(`key:${descriptor.name}`); return true; }),
}));

const { RESET_STAGES, ResetAccountCode, resetAccount } = require("../services/accountResetService");
const { reauthenticateForDeletion } = require("../services/accountService");
const { RESET_ACCOUNT_COPY } = require("../screens/tabs/profile/resetAccountCopy");

beforeEach(() => {
  mockLog.length = 0;
  mockPaths.deleted.length = 0;
  mockPaths.failOn = null;
  mockStore.clear();
  mockRemoveRating.mockClear();
  reauthenticateForDeletion.mockClear();
  reauthenticateForDeletion.mockResolvedValue({ cancelled: false });
});

describe("aşamalar ve metinler", () => {
  it("doğrulamayla açılır, yerel temizlikle kapanır", () => {
    expect(RESET_STAGES[0]).toBe("verify");
    expect(RESET_STAGES[RESET_STAGES.length - 1]).toBe("local");
  });

  it.each(Object.keys(RESET_ACCOUNT_COPY))("%s: her aşamanın etiketi dolu, fazladan etiket yok", (language) => {
    const copy = RESET_ACCOUNT_COPY[language];
    expect(Object.keys(copy.stages).sort()).toEqual([...RESET_STAGES].sort());
    RESET_STAGES.forEach((id) => expect(copy.stages[id].length).toBeGreaterThan(3));
    expect(copy.step).toContain("{n}");
    expect(copy.step).toContain("{total}");
    expect(copy.holdHint).toContain("{seconds}");
  });
});

describe("resetAccount", () => {
  it("doğrulama iptal edilirse hiçbir şey silinmez ve işçi durdurulmaz", async () => {
    reauthenticateForDeletion.mockResolvedValueOnce({ cancelled: true });
    await expect(resetAccount({})).resolves.toEqual({ cancelled: true });
    expect(mockLog).toEqual([]);
  });

  it("doğrulama hata verirse (yanlış şifre) hiçbir şey silinmez", async () => {
    reauthenticateForDeletion.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "auth/wrong-password" }));
    await expect(resetAccount({ password: "yanlis" })).rejects.toMatchObject({ code: "auth/wrong-password" });
    expect(mockLog).toEqual([]);
  });

  it("çağıran az önce doğruladıysa ikinci kez doğrulama istemez", async () => {
    await resetAccount({ reauthenticated: true });
    expect(reauthenticateForDeletion).not.toHaveBeenCalled();
  });

  it("sıra: işçi durur → bulut silinir → yerel temizlenir → işçi yeniden başlar", async () => {
    await resetAccount({ password: "x" });
    const at = (entry) => mockLog.findIndex((line) => line === entry);
    const firstDelete = mockLog.findIndex((line) => line.startsWith("delete:"));
    expect(at("worker:stop:u1")).toBeGreaterThanOrEqual(0);
    expect(at("worker:stop:u1")).toBeLessThan(firstDelete);
    expect(at("local:purge:u1")).toBeGreaterThan(mockLog.map((l) => l.startsWith("delete:")).lastIndexOf(true));
    expect(at("worker:start:u1")).toBeGreaterThan(at("local:purge:u1"));
    // Kök belge silindikten SONRA boş olarak yeniden kurulur.
    expect(at("ensureRoot:u1")).toBeGreaterThan(at("delete:Lists/u1"));
  });

  it("ilerleme olayları aşama sırasıyla gelir", async () => {
    const stages = [];
    await resetAccount({ onProgress: ({ stage, stages: all }) => stages.push([stage, all.length]) });
    expect(stages.map(([stage]) => stage)).toEqual(RESET_STAGES);
    expect(stages.every(([, count]) => count === RESET_STAGES.length)).toBe(true);
  });

  it("ilerleme geri çağrısı patlarsa sıfırlama durmaz", async () => {
    await expect(resetAccount({ onProgress: () => { throw new Error("ui"); } })).resolves.toEqual({ cancelled: false });
  });

  it("kütüphane, notlar, oyunlar ve istatistik silinir; HESAP ve premium haklar silinmez", async () => {
    mockStore.set("Lists/u1/watchedTv", [{ id: "tv_1", data: {} }]);
    mockStore.set("Lists/u1/favorites", [{ id: "movie_5", data: {} }]);
    mockStore.set("Notes/u1/items", [{ id: "n1", data: {} }]);
    mockStore.set("Reminders/u1/tvShows", [{ id: "9", data: {} }]);
    mockStore.set("Reminders/u1/tvShows/9/episodes", [{ id: "e1", data: {} }]);
    await resetAccount({});
    const deleted = mockPaths.deleted;
    for (const path of [
      "Lists/u1/watchedTv/tv_1",
      "Lists/u1/favorites/movie_5",
      "Lists/u1",
      "Notes/u1/items/n1",
      "Notes/u1",
      "Reminders/u1/tvShows/9/episodes/e1",
      "Reminders/u1",
      "SceneGame/u1",
      "SceneGameHistory/u1",
      "UserStats/u1",
      "GameLeaderboards/scene_classic_easy/entries/u1",
    ]) {
      expect(deleted).toContain(path);
    }
    // Hesap kimliği ve ilişkiler: dokunulmaz.
    expect(deleted).not.toContain("Users/u1");
    expect(deleted.some((p) => /^Users\/u1\/(friends|following|followers|blocked|private)/.test(p))).toBe(false);
    expect(deleted.some((p) => /^(Posts|chats|groups|Usernames)\//.test(p))).toBe(false);
    expect(deleted.some((p) => p.startsWith("AiUsage"))).toBe(false);
    const keys = mockLog.filter((l) => l.startsWith("key:")).map((l) => l.slice(4));
    expect(keys).toEqual(expect.arrayContaining(["watchLedger", "yearlyGoals", "cinemaBingo", "followedPeople"]));
    expect(keys).not.toContain("premiumDailyUsage");
  });

  it("puanlar agregatları düşüren yoldan silinir; eksik meta yalnız aynayı siler", async () => {
    mockStore.set("Users/u1/myRatings", [
      { id: "movie_550", data: { mediaType: "movie", mediaId: 550 } },
      { id: "broken", data: {} },
    ]);
    await resetAccount({});
    expect(mockRemoveRating).toHaveBeenCalledTimes(1);
    expect(mockRemoveRating).toHaveBeenCalledWith({ mediaType: "movie", mediaId: 550, uid: "u1" });
    expect(mockPaths.deleted).toContain("Users/u1/myRatings/broken");
  });

  it("yerel haritalar boş yazılır: ekranlar anında boşalır", async () => {
    await resetAccount({});
    ["favorites", "watchList", "watchedMovies", "watchedTv"].forEach((key) =>
      expect(mockLog).toContain(`localList:${key}:0`),
    );
  });

  it("bir adım düşerse diğerleri çalışır, yerel temizlik yapılır, sonda INCOMPLETE fırlar", async () => {
    mockPaths.failOn = (path) => path === "Notes/u1";
    const error = await resetAccount({}).catch((e) => e);
    expect(error).toMatchObject({ code: ResetAccountCode.INCOMPLETE });
    expect(error.failed).toContain("notes");
    // Notlar düştü ama oyunlar ve yerel temizlik yine çalıştı; işçi yeniden başladı.
    expect(mockPaths.deleted).toContain("SceneGame/u1");
    expect(mockLog).toContain("local:purge:u1");
    expect(mockLog).toContain("worker:start:u1");
  });

  it("tekrar çalıştırılabilir (idempotent): ikinci tur aynı sonucu verir", async () => {
    await resetAccount({});
    const first = [...mockPaths.deleted];
    mockPaths.deleted.length = 0;
    await resetAccount({});
    expect(mockPaths.deleted).toEqual(first);
  });
});
