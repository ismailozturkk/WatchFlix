const { isProfileEditDirty, isNearLimit, usernameFieldState } = require("../utils/profileEdit");

const saved = {
  displayName: "Ali Veli",
  username: "aliveli",
  bio: "Film delisi",
  avatarIndex: 4,
  birthDate: "1998-03-05",
};
const same = { displayName: "Ali Veli", username: "aliveli", bio: "Film delisi", avatarIndex: 4, birthDate: "1998-03-05" };

describe("isProfileEditDirty", () => {
  it("is clean when the form matches the saved profile", () => {
    expect(isProfileEditDirty({ ready: true, saved, draft: same })).toBe(false);
  });

  it("is never dirty before the form has been filled from the profile", () => {
    // Alanlar henüz boş, profil dolu: her şey "değişmiş" görünürdü.
    const empty = { displayName: "", username: "", bio: "", avatarIndex: 0, birthDate: null };
    expect(isProfileEditDirty({ ready: false, saved, draft: empty })).toBe(false);
    expect(isProfileEditDirty({ ready: true, saved: null, draft: empty })).toBe(false);
  });

  it.each([
    ["name", { displayName: "Ali V." }],
    ["username", { username: "aliveli2" }],
    ["bio", { bio: "Dizi delisi" }],
    ["avatar", { avatarIndex: 5 }],
  ])("detects a changed %s", (_label, patch) => {
    expect(isProfileEditDirty({ ready: true, saved, draft: { ...same, ...patch } })).toBe(true);
  });

  it("ignores surrounding whitespace the save would trim away", () => {
    expect(isProfileEditDirty({ ready: true, saved, draft: { ...same, displayName: "  Ali Veli  ", bio: "Film delisi \n" } })).toBe(false);
  });

  it("treats clearing a field as a change", () => {
    expect(isProfileEditDirty({ ready: true, saved, draft: { ...same, bio: "" } })).toBe(true);
  });

  describe("birth date (writable once)", () => {
    it("is dirty when a date is entered for the first time", () => {
      expect(isProfileEditDirty({ ready: true, saved: { ...saved, birthDate: null }, draft: { ...same, birthDate: "2000-01-01" } })).toBe(true);
    });

    it("stays clean while it is still empty", () => {
      expect(isProfileEditDirty({ ready: true, saved: { ...saved, birthDate: null }, draft: { ...same, birthDate: null } })).toBe(false);
    });

    it("cannot make an already-saved date dirty (the field is locked and the rules reject a rewrite)", () => {
      expect(isProfileEditDirty({ ready: true, saved, draft: { ...same, birthDate: "1999-09-09" } })).toBe(false);
    });
  });

  describe("four favorites", () => {
    const film = (id) => ({ id, title: `Film ${id}`, image: `/f${id}.jpg` });
    const favs = (ids) => ({ movies: ids.map(film), shows: [], people: [] });

    it("stays clean when neither side has the field (older accounts)", () => {
      expect(isProfileEditDirty({ ready: true, saved, draft: same })).toBe(false);
      expect(
        isProfileEditDirty({
          ready: true,
          saved: { ...saved, fourFavorites: undefined },
          draft: { ...same, fourFavorites: favs([]) },
        }),
      ).toBe(false);
    });

    it("is dirty after adding, removing or reordering a favourite", () => {
      const base = { ...saved, fourFavorites: favs([1, 2]) };
      expect(isProfileEditDirty({ ready: true, saved: base, draft: { ...same, fourFavorites: favs([1, 2]) } })).toBe(false);
      expect(isProfileEditDirty({ ready: true, saved: base, draft: { ...same, fourFavorites: favs([1, 2, 3]) } })).toBe(true);
      expect(isProfileEditDirty({ ready: true, saved: base, draft: { ...same, fourFavorites: favs([1]) } })).toBe(true);
      expect(isProfileEditDirty({ ready: true, saved: base, draft: { ...same, fourFavorites: favs([2, 1]) } })).toBe(true);
    });

    it("clearing every favourite is a change worth saving", () => {
      expect(
        isProfileEditDirty({
          ready: true,
          saved: { ...saved, fourFavorites: favs([1]) },
          draft: { ...same, fourFavorites: favs([]) },
        }),
      ).toBe(true);
    });
  });

  it("tolerates a profile with missing optional fields", () => {
    const sparse = { displayName: undefined, username: undefined, bio: undefined, avatarIndex: 0, birthDate: undefined };
    const draft = { displayName: "", username: "", bio: "", avatarIndex: 0, birthDate: null };
    expect(isProfileEditDirty({ ready: true, saved: sparse, draft })).toBe(false);
  });
});

describe("usernameFieldState", () => {
  it("maps availability to the field's valid/invalid/neutral tone", () => {
    expect(usernameFieldState("available")).toBe(true);
    expect(usernameFieldState("taken")).toBe(false);
    expect(usernameFieldState("invalid")).toBe(false);
    for (const neutral of ["idle", "same", "checking", undefined]) {
      expect(usernameFieldState(neutral)).toBeNull();
    }
  });
});

describe("isNearLimit", () => {
  it("warns only inside the last stretch of the limit", () => {
    expect(isNearLimit(139, 160)).toBe(false);
    expect(isNearLimit(140, 160)).toBe(true);
    expect(isNearLimit(160, 160)).toBe(true);
    expect(isNearLimit(10, 160)).toBe(false);
  });
});
