// utils/avatarPhotos.js — avatar seçimi ve bağlı hesap fotoğraflarının saf
// kararları. Gerçek hatalar: parola hesabına bağlanan Google'ın fotoğrafı
// seçicide çıkmıyordu, Google'da değişen fotoğraf hiç tazelenmiyordu, kaldırılan
// hesabın fotoğrafı avatarda kalıyordu.

const {
  avatarSnapshot,
  buildAvatarChoices,
  getLinkedPhotos,
  inferPhotoSource,
  isGooglePhotoUrl,
  linkedProviderIds,
  photoKey,
  planAvatarPhotoSync,
  profileAvatarChoice,
  sameAvatarChoice,
  samePhoto,
  toAvatarChoice,
} = require("../utils/avatarPhotos");
const { AVATAR_COUNT } = require("../utils/avatars");

const G_OLD = "https://lh3.googleusercontent.com/a/OLD=s96-c";
const G_OLD_BIG = "https://lh3.googleusercontent.com/a/OLD=s500-c";
const G_NEW = "https://lh3.googleusercontent.com/a/NEW=s96-c";

const google = (photoURL, uid = "g-1") => ({ providerId: "google.com", uid, photoURL });
const password = { providerId: "password", uid: "a@b.c", photoURL: null };

describe("photoKey / samePhoto", () => {
  it("treats Google size variants as the same picture", () => {
    expect(samePhoto(G_OLD, G_OLD_BIG)).toBe(true);
    expect(samePhoto("https://lh3.googleusercontent.com/a/OLD", G_OLD)).toBe(true);
    expect(samePhoto("https://lh3.googleusercontent.com/-x/AAA/s96-c/photo.jpg", "https://lh3.googleusercontent.com/-x/AAA/s400/photo.jpg")).toBe(true);
    expect(samePhoto("https://lh3.googleusercontent.com/a/OLD?sz=50", G_OLD)).toBe(true);
  });

  it("detects a new picture", () => {
    expect(samePhoto(G_OLD, G_NEW)).toBe(false);
  });

  it("never matches empty / non-http values", () => {
    expect(samePhoto(null, null)).toBe(false);
    expect(samePhoto("", "")).toBe(false);
    expect(photoKey("file:///x.png")).toBeNull();
  });

  it("leaves non-Google URLs untouched", () => {
    expect(photoKey(" https://cdn.test/a.png?sz=50 ")).toBe("https://cdn.test/a.png?sz=50");
    expect(isGooglePhotoUrl("https://cdn.test/a.png")).toBe(false);
    expect(isGooglePhotoUrl(G_OLD)).toBe(true);
  });
});

describe("getLinkedPhotos", () => {
  it("finds the photo of a Google account linked to a password account", () => {
    // Asıl hata: user.photoURL burada BOŞ; foto yalnız providerData'da.
    expect(getLinkedPhotos([password, google(G_OLD)])).toEqual([
      { providerId: "google.com", uri: G_OLD },
    ]);
  });

  it("prefers the fresh photo read from the provider SDK", () => {
    const fresh = { "google.com": { uri: G_NEW, accountId: "g-1" } };
    expect(getLinkedPhotos([google(G_OLD)], fresh)).toEqual([
      { providerId: "google.com", uri: G_NEW, fresh: true },
    ]);
  });

  it("ignores a fresh photo that belongs to another Google account", () => {
    const fresh = { "google.com": { uri: G_NEW, accountId: "someone-else" } };
    expect(getLinkedPhotos([google(G_OLD)], fresh)[0]).toEqual({ providerId: "google.com", uri: G_OLD });
  });

  it("skips providers without a photo and dedupes the same picture", () => {
    const apple = { providerId: "apple.com", uid: "ap", photoURL: G_OLD_BIG };
    expect(getLinkedPhotos([apple, google(G_OLD), password])).toEqual([
      { providerId: "google.com", uri: G_OLD },
    ]);
    expect(getLinkedPhotos([{ providerId: "apple.com", uid: "ap", photoURL: null }])).toEqual([]);
    expect(getLinkedPhotos(undefined)).toEqual([]);
  });
});

describe("inferPhotoSource", () => {
  it("uses the stored source first", () => {
    expect(inferPhotoSource({ photoURL: "https://x.test/a.png", photoSource: "apple.com" })).toBe("apple.com");
  });

  it("matches a linked photo, then falls back to the Google host", () => {
    expect(inferPhotoSource({ photoURL: G_OLD_BIG }, [{ providerId: "google.com", uri: G_OLD }])).toBe("google.com");
    expect(inferPhotoSource({ photoURL: G_NEW }, [])).toBe("google.com");
  });

  it("is unknown for a foreign photo", () => {
    expect(inferPhotoSource({ photoURL: "https://cdn.test/a.png" }, [])).toBeNull();
    expect(inferPhotoSource({ photoURL: null }, [])).toBeNull();
  });
});

describe("planAvatarPhotoSync", () => {
  const linked = (uri, fresh = true) => [{ providerId: "google.com", uri, ...(fresh ? { fresh } : {}) }];
  const photoProfile = { avatarIndex: -1, photoURL: G_OLD, photoSource: "google.com" };

  it("updates the avatar when the Google photo changed", () => {
    expect(
      planAvatarPhotoSync({ profile: photoProfile, providerIds: ["google.com"], linkedPhotos: linked(G_NEW) }),
    ).toEqual({ action: "update", photoURL: G_NEW, photoSource: "google.com" });
  });

  it("never rolls a newer photo back to this device's stale Firebase copy", () => {
    // İkinci cihaz: Google oturumu yok, providerData eski resmi taşıyor.
    const synced = { avatarIndex: -1, photoURL: G_NEW, photoSource: "google.com" };
    expect(
      planAvatarPhotoSync({ profile: synced, providerIds: ["google.com"], linkedPhotos: linked(G_OLD, false) }),
    ).toEqual({ action: "none" });
  });

  it("does nothing when only the size suffix differs", () => {
    expect(
      planAvatarPhotoSync({ profile: photoProfile, providerIds: ["google.com"], linkedPhotos: linked(G_OLD_BIG) }),
    ).toEqual({ action: "none" });
  });

  it("backfills the source of a legacy photo without touching the picture", () => {
    const legacy = { avatarIndex: -1, photoURL: G_OLD };
    expect(
      planAvatarPhotoSync({ profile: legacy, providerIds: ["google.com", "password"], linkedPhotos: linked(G_OLD, false) }),
    ).toEqual({ action: "update", photoURL: G_OLD, photoSource: "google.com" });
  });

  it("reverts to a preset avatar when the photo's account was unlinked", () => {
    expect(
      planAvatarPhotoSync({ profile: photoProfile, providerIds: ["password"], linkedPhotos: [] }),
    ).toEqual({ action: "revert" });
  });

  it("never reverts while the linked accounts are unknown", () => {
    expect(planAvatarPhotoSync({ profile: photoProfile, providerIds: [], linkedPhotos: [] })).toEqual({ action: "none" });
  });

  it("leaves preset avatars and foreign photos alone", () => {
    expect(
      planAvatarPhotoSync({ profile: { avatarIndex: 7, photoURL: G_OLD }, providerIds: ["google.com"], linkedPhotos: linked(G_NEW) }),
    ).toEqual({ action: "none" });
    expect(
      planAvatarPhotoSync({ profile: { avatarIndex: -1, photoURL: "https://cdn.test/me.png" }, providerIds: ["password"], linkedPhotos: [] }),
    ).toEqual({ action: "none" });
    expect(planAvatarPhotoSync({ profile: null })).toEqual({ action: "none" });
  });
});

describe("choices", () => {
  it("normalizes numbers and objects to one shape", () => {
    expect(toAvatarChoice(9)).toEqual({ avatarIndex: 9, photoURL: null, photoSource: null });
    expect(toAvatarChoice(999)).toEqual({ avatarIndex: 0, photoURL: null, photoSource: null });
    expect(toAvatarChoice({ avatarIndex: -1, photoURL: G_NEW, photoSource: "google.com" })).toEqual({
      avatarIndex: -1,
      photoURL: G_NEW,
      photoSource: "google.com",
    });
  });

  it("fills a bare -1 from the fallback photo, or drops to the default avatar", () => {
    expect(toAvatarChoice(-1, { photoURL: G_OLD, photoSource: "google.com" })).toEqual({
      avatarIndex: -1,
      photoURL: G_OLD,
      photoSource: "google.com",
    });
    expect(toAvatarChoice(-1)).toEqual({ avatarIndex: 0, photoURL: null, photoSource: null });
  });

  it("compares choices by picture, not by URL spelling", () => {
    expect(sameAvatarChoice({ avatarIndex: -1, photoURL: G_OLD }, { avatarIndex: -1, photoURL: G_OLD_BIG })).toBe(true);
    expect(sameAvatarChoice({ avatarIndex: -1, photoURL: G_OLD }, { avatarIndex: -1, photoURL: G_NEW })).toBe(false);
    expect(sameAvatarChoice({ avatarIndex: 3, photoURL: G_OLD }, { avatarIndex: 3, photoURL: null })).toBe(true);
    expect(sameAvatarChoice(null, { avatarIndex: 3 })).toBe(false);
  });

  it("reads the saved profile avatar with the cached-index and auth-photo fallbacks", () => {
    expect(profileAvatarChoice({}, { fallbackIndex: 5 })).toEqual({ avatarIndex: 5, photoURL: null, photoSource: null });
    expect(profileAvatarChoice({ avatarIndex: -1 }, { authPhotoURL: G_OLD })).toEqual({
      avatarIndex: -1,
      photoURL: G_OLD,
      photoSource: null,
    });
  });

  it("snapshots carry the photo only for a photo avatar", () => {
    expect(avatarSnapshot({ avatarIndex: -1, photoURL: G_NEW })).toEqual({ avatarIndex: -1, photoURL: G_NEW });
    expect(avatarSnapshot({ avatarIndex: 4, photoURL: G_NEW })).toEqual({ avatarIndex: 4, photoURL: null });
    expect(avatarSnapshot(null)).toEqual({ avatarIndex: 0, photoURL: null });
  });

  it("lists linked photos first and keeps the current photo even when no account offers it", () => {
    const choices = buildAvatarChoices({
      linkedPhotos: [{ providerId: "google.com", uri: G_NEW }],
      current: { avatarIndex: -1, photoURL: "https://cdn.test/me.png", photoSource: null },
    });
    expect(choices.slice(0, 2).map((c) => [c.key, c.photoURL])).toEqual([
      ["photo:google.com", G_NEW],
      ["photo:current", "https://cdn.test/me.png"],
    ]);
    expect(choices).toHaveLength(2 + AVATAR_COUNT);
    expect(new Set(choices.map((c) => c.key)).size).toBe(choices.length);
  });

  it("does not duplicate the current photo when it is the linked one", () => {
    const choices = buildAvatarChoices({
      linkedPhotos: [{ providerId: "google.com", uri: G_OLD }],
      current: { avatarIndex: -1, photoURL: G_OLD_BIG },
    });
    expect(choices).toHaveLength(1 + AVATAR_COUNT);
  });

  it("linkedProviderIds dedupes and drops junk", () => {
    expect(linkedProviderIds([password, google(G_OLD), google(G_OLD), {}, null])).toEqual(["password", "google.com"]);
  });
});
