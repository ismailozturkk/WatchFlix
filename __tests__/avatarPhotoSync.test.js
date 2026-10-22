// services/avatarPhotoSync.js — bağlı hesap fotoğraf deposu + profil eşlemesi.
// Firebase ve Google SDK taklit; kararların kendisi avatarPhotos.test.js'te.

const mockAuth = { currentUser: null };
jest.mock("../firebase", () => ({ auth: mockAuth }));

const mockSilent = jest.fn();
jest.mock("../services/googleAuthService", () => ({
  getSilentGoogleProfile: (...a) => mockSilent(...a),
}));

const mockRefreshAvatarPhoto = jest.fn(() => Promise.resolve());
const mockSetAvatarIndex = jest.fn(() => Promise.resolve());
jest.mock("../services/userService", () => ({
  refreshAvatarPhoto: (...a) => mockRefreshAvatarPhoto(...a),
  setAvatarIndex: (...a) => mockSetAvatarIndex(...a),
}));

const {
  __resetAvatarPhotoSyncForTests,
  fetchFreshProviderPhotos,
  getLinkedPhotosState,
  reconcileAvatarPhoto,
  refreshLinkedPhotos,
  subscribeLinkedPhotos,
} = require("../services/avatarPhotoSync");

const G_OLD = "https://lh3.googleusercontent.com/a/OLD=s96-c";
const G_NEW = "https://lh3.googleusercontent.com/a/NEW=s96-c";

const signIn = (providerData, uid = "u1") => {
  mockAuth.currentUser = { uid, providerData };
};

beforeEach(() => {
  __resetAvatarPhotoSyncForTests();
  mockAuth.currentUser = null;
  mockSilent.mockReset().mockResolvedValue(null);
  mockRefreshAvatarPhoto.mockClear();
  mockSetAvatarIndex.mockClear();
});

describe("linked photo store", () => {
  it("publishes a newly linked Google photo to subscribers", () => {
    const listener = jest.fn();
    subscribeLinkedPhotos(listener);
    signIn([{ providerId: "password", uid: "a@b.c" }]);
    refreshLinkedPhotos();
    expect(getLinkedPhotosState().linkedPhotos).toEqual([]);

    // linkWithCredential `user`ı yerinde değiştirir — React bunu göremez.
    mockAuth.currentUser.providerData.push({ providerId: "google.com", uid: "g-1", photoURL: G_OLD });
    refreshLinkedPhotos();
    expect(getLinkedPhotosState().linkedPhotos).toEqual([{ providerId: "google.com", uri: G_OLD }]);
    expect(listener).toHaveBeenCalledTimes(2);

    // Değişiklik yoksa yayın da yok (gereksiz render olmasın).
    refreshLinkedPhotos();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("asks Google for the current photo and throttles repeat asks", async () => {
    signIn([{ providerId: "google.com", uid: "g-1", photoURL: G_OLD }]);
    mockSilent.mockResolvedValue({ id: "g-1", photo: G_NEW });

    await fetchFreshProviderPhotos();
    expect(getLinkedPhotosState().linkedPhotos[0].uri).toBe(G_NEW);
    await fetchFreshProviderPhotos();
    expect(mockSilent).toHaveBeenCalledTimes(1);
    await fetchFreshProviderPhotos({ force: true });
    expect(mockSilent).toHaveBeenCalledTimes(2);
  });

  it("does not ask Google when no Google account is linked", async () => {
    signIn([{ providerId: "password", uid: "a@b.c" }]);
    await fetchFreshProviderPhotos({ force: true });
    expect(mockSilent).not.toHaveBeenCalled();
  });

  it("drops the previous user's fresh photos on account switch", async () => {
    signIn([{ providerId: "google.com", uid: "g-1", photoURL: G_OLD }]);
    mockSilent.mockResolvedValue({ id: "g-1", photo: G_NEW });
    await fetchFreshProviderPhotos();
    signIn([{ providerId: "google.com", uid: "g-2", photoURL: G_OLD }], "u2");
    refreshLinkedPhotos();
    expect(getLinkedPhotosState()).toEqual({
      uid: "u2",
      providerIds: ["google.com"],
      linkedPhotos: [{ providerId: "google.com", uri: G_OLD }],
    });
  });
});

describe("reconcileAvatarPhoto", () => {
  const photoProfile = { uid: "u1", avatarIndex: -1, photoURL: G_OLD, photoSource: "google.com" };

  it("writes the new Google photo when it changed", async () => {
    signIn([{ providerId: "google.com", uid: "g-1", photoURL: G_OLD }]);
    mockSilent.mockResolvedValue({ id: "g-1", photo: G_NEW });
    await fetchFreshProviderPhotos();

    await expect(reconcileAvatarPhoto("u1", photoProfile)).resolves.toMatchObject({ action: "update" });
    expect(mockRefreshAvatarPhoto).toHaveBeenCalledWith("u1", {
      photoURL: G_NEW,
      photoSource: "google.com",
      photoChanged: true,
    });
  });

  it("does not overwrite the profile from the Firebase copy alone", async () => {
    // Google oturumu yok → yalnız providerData (eski) bilinir.
    signIn([{ providerId: "google.com", uid: "g-1", photoURL: G_OLD }]);
    await fetchFreshProviderPhotos({ force: true });
    await reconcileAvatarPhoto("u1", { ...photoProfile, photoURL: G_NEW });
    expect(mockRefreshAvatarPhoto).not.toHaveBeenCalled();
  });

  it("backfills photoSource without fanning out the same picture", async () => {
    signIn([{ providerId: "google.com", uid: "g-1", photoURL: G_OLD }]);
    await reconcileAvatarPhoto("u1", { uid: "u1", avatarIndex: -1, photoURL: G_OLD });
    expect(mockRefreshAvatarPhoto).toHaveBeenCalledWith("u1", {
      photoURL: G_OLD,
      photoSource: "google.com",
      photoChanged: false,
    });
  });

  it("switches to a preset avatar after Google is unlinked", async () => {
    signIn([{ providerId: "password", uid: "a@b.c" }]);
    await expect(reconcileAvatarPhoto("u1", photoProfile)).resolves.toEqual({ action: "revert" });
    expect(mockSetAvatarIndex).toHaveBeenCalledTimes(1);
    const [uid, index] = mockSetAvatarIndex.mock.calls[0];
    expect(uid).toBe("u1");
    expect(index).toBeGreaterThanOrEqual(0);
  });

  it("does not write twice for the same decision while one is in flight", async () => {
    signIn([{ providerId: "password", uid: "a@b.c" }]);
    let release;
    mockSetAvatarIndex.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    const first = reconcileAvatarPhoto("u1", photoProfile);
    await expect(reconcileAvatarPhoto("u1", photoProfile)).resolves.toEqual({ action: "none" });
    release();
    await first;
    expect(mockSetAvatarIndex).toHaveBeenCalledTimes(1);
  });

  it("ignores a profile that belongs to someone else", async () => {
    signIn([{ providerId: "password", uid: "a@b.c" }]);
    await reconcileAvatarPhoto("u1", { ...photoProfile, uid: "u2" });
    await reconcileAvatarPhoto("u2", { ...photoProfile, uid: "u2" });
    expect(mockSetAvatarIndex).not.toHaveBeenCalled();
  });
});
