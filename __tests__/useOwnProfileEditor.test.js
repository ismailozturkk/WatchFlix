import React, { forwardRef, useImperativeHandle } from "react";
import { act, create } from "react-test-renderer";
import useOwnProfileEditor from "../hooks/useOwnProfileEditor";

// Profil önizlemesindeki düzenleme modunun kuralları (eski "Profili Düzenle"
// ekranının form testlerinin devamı): ne zaman "değişti" sayılır, Kaydet neyi
// yazar, kullanıcı adı / günde bir / boş ad / sosyal hesap kapıları.

jest.mock("../components/AppToast", () => {
  const mockApi = { show: jest.fn() };
  return { __esModule: true, default: mockApi, toast: mockApi };
});
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { photoURL: null } }) }));

let mockProfile;
const mockUpdateField = jest.fn(() => Promise.resolve());
const mockChangeUsername = jest.fn(() => Promise.resolve());
const mockSelectAvatar = jest.fn(() => Promise.resolve());
jest.mock("../context/UserProfileContext", () => ({
  useUserProfile: () => ({
    profile: mockProfile,
    uid: "me",
    updateField: mockUpdateField,
    changeUsername: mockChangeUsername,
  }),
}));
jest.mock("../context/ProfileUiContext", () => ({
  useProfileUi: () => ({ selectAvatarIndex: 2, selectAvatar: mockSelectAvatar }),
}));
let mockShowcase = [];
const mockReplaceShowcase = jest.fn();
jest.mock("../hooks/useBadgeShowcase", () => ({
  __esModule: true,
  default: () => ({ showcaseIds: mockShowcase, replaceShowcase: mockReplaceShowcase }),
}));

const mockIsAvailable = jest.fn(() => Promise.resolve(true));
const mockSetListVisibility = jest.fn(() => Promise.resolve());
jest.mock("../services/userService", () => ({
  formatUsernameInput: (v) => String(v).toLowerCase().replace(/[^a-z0-9_]/g, ""),
  isValidUsername: (v) => /^[a-z0-9_]{3,20}$/.test(v) && /[a-z]/.test(v),
  isUsernameAvailable: (...args) => mockIsAvailable(...args),
  normalizeUsername: (v) => String(v || "").trim().toLowerCase(),
  setListVisibility: (...args) => mockSetListVisibility(...args),
  UserProfileErrorCode: { USERNAME_TAKEN: "profile/username-taken" },
}));
const mockSaveSocialLinks = jest.fn(() => Promise.resolve());
jest.mock("../services/socialLinksService", () => ({
  saveSocialLinks: (...args) => mockSaveSocialLinks(...args),
}));
const mockPropagate = jest.fn(() => Promise.resolve());
jest.mock("../services/profilePropagation", () => ({
  propagateProfileChange: (...args) => mockPropagate(...args),
}));
const mockTrack = jest.fn();
jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: { FOUR_FAVORITES_SAVED: "four_favorites_saved" },
  trackEvent: (...args) => mockTrack(...args),
}));

const mockToast = require("../components/AppToast").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

const SAVED = {
  uid: "u1",
  displayName: "Ali Veli",
  username: "aliveli",
  bio: "Film delisi",
  avatarIndex: 4,
  listVisible: { favorites: true, watchList: false },
};

const Harness = forwardRef(function Harness(props, ref) {
  const editor = useOwnProfileEditor(props);
  useImperativeHandle(ref, () => editor);
  return null;
});

let renderer;
const ref = React.createRef();
const ed = () => ref.current;
let consoleError;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockProfile = SAVED;
  mockShowcase = [];
  const original = console.error;
  consoleError = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
  renderer = null;
  jest.useRealTimers();
  consoleError.mockRestore();
});

async function render(props = {}) {
  await act(() => {
    renderer = create(<Harness ref={ref} {...props} />);
  });
  await act(() => {
    ed().start();
  });
}
const run = (fn) => act(() => fn(ed()));
const save = () => act(async () => { await ed().save(); });
const flush = () => act(async () => { jest.advanceTimersByTime(600); await Promise.resolve(); });

describe("useOwnProfileEditor", () => {
  it("is idle until started, and does not start when disabled", async () => {
    await act(() => {
      renderer = create(<Harness ref={ref} enabled={false} />);
    });
    expect(ed().editing).toBe(false);
    let started;
    await act(() => { started = ed().start(); });
    expect(started).toBe(false);
    expect(ed().editing).toBe(false);
  });

  it("fills the draft from the profile and is not dirty", async () => {
    await render();
    expect(ed().editing).toBe(true);
    expect(ed().draft).toEqual(expect.objectContaining({
      displayName: "Ali Veli", username: "aliveli", bio: "Film delisi",
    }));
    expect(ed().draft.avatar.avatarIndex).toBe(4);
    expect(ed().dirty).toBe(false);
  });

  it("becomes dirty on a change and clean again when changed back", async () => {
    await render();
    await run((e) => e.setDisplayName("Ali V."));
    expect(ed().dirty).toBe(true);
    expect(ed().canSave).toBe(true);
    await run((e) => e.setDisplayName("Ali Veli"));
    expect(ed().dirty).toBe(false);
  });

  it("saves only what changed, then leaves edit mode", async () => {
    await render();
    await run((e) => e.setDisplayName("Ali V."));
    await save();
    expect(mockUpdateField).toHaveBeenCalledWith({ displayName: "Ali V." }, { stampIdentity: true });
    expect(mockChangeUsername).not.toHaveBeenCalled();
    expect(mockSelectAvatar).not.toHaveBeenCalled();
    expect(mockSaveSocialLinks).not.toHaveBeenCalled();
    expect(mockSetListVisibility).not.toHaveBeenCalled();
    expect(mockReplaceShowcase).not.toHaveBeenCalled();
    expect(mockPropagate).toHaveBeenCalledWith("u1", { displayName: "Ali V.", username: undefined });
    expect(mockToast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
    expect(ed().editing).toBe(false);
  });

  it("saving with no changes just leaves edit mode without writing", async () => {
    await render();
    await save();
    expect(mockUpdateField).not.toHaveBeenCalled();
    expect(ed().editing).toBe(false);
  });

  it("cancel throws the draft away", async () => {
    await render();
    await run((e) => e.setDisplayName("Başka"));
    await run((e) => e.cancel());
    expect(ed().editing).toBe(false);
    expect(ed().draft).toBeNull();
    expect(mockUpdateField).not.toHaveBeenCalled();
  });

  it("günde bir kez: ad değişimi beklemedeyken kaydedilmez, bio serbest kalır", async () => {
    mockProfile = { ...SAVED, identityChangedAt: Date.now() - 2 * 60 * 60 * 1000 };
    await render();
    await run((e) => e.setDisplayName("Ali V."));
    await save();
    expect(mockUpdateField).not.toHaveBeenCalled();
    expect(mockToast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "info" }));
    expect(ed().editing).toBe(true);

    await run((e) => e.setDisplayName("Ali Veli"));
    await run((e) => e.setBio("Yeni bio"));
    await save();
    expect(mockUpdateField).toHaveBeenCalledWith({ bio: "Yeni bio" }, { stampIdentity: false });
  });

  it("refuses to save an empty name with a toast", async () => {
    await render();
    await run((e) => e.setDisplayName("   "));
    await save();
    expect(mockUpdateField).not.toHaveBeenCalled();
    expect(mockToast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    expect(ed().editing).toBe(true);
  });

  it("caps name and bio at their limits", async () => {
    await render();
    await run((e) => e.setDisplayName("x".repeat(80)));
    await run((e) => e.setBio("y".repeat(400)));
    expect(ed().draft.displayName).toHaveLength(40);
    expect(ed().draft.bio).toHaveLength(160);
  });

  describe("username", () => {
    it("formats the input and blocks Save while checking and while taken", async () => {
      mockIsAvailable.mockResolvedValueOnce(false);
      await render();
      await run((e) => e.setUsername("Baskasi!"));
      expect(ed().draft.username).toBe("baskasi");
      expect(ed().usernameStatus).toBe("checking");
      expect(ed().usernameHint).toEqual(expect.objectContaining({ tone: "muted" }));
      expect(ed().canSave).toBe(false);
      await flush();
      expect(ed().usernameStatus).toBe("taken");
      expect(ed().usernameHint).toEqual(expect.objectContaining({ tone: "error" }));
      expect(ed().canSave).toBe(false);
    });

    it("allows Save once available and changes it", async () => {
      await render();
      await run((e) => e.setUsername("yeniad"));
      await flush();
      expect(ed().usernameStatus).toBe("available");
      expect(ed().usernameHint).toEqual(expect.objectContaining({ tone: "success" }));
      expect(ed().canSave).toBe(true);
      await save();
      expect(mockChangeUsername).toHaveBeenCalledWith("yeniad");
      expect(mockPropagate).toHaveBeenCalledWith("u1", { displayName: undefined, username: "yeniad" });
    });

    it("kontrolden sonra alınan ad: servis metni değil çevrili metin gösterilir", async () => {
      mockChangeUsername.mockRejectedValueOnce(
        Object.assign(new Error("Bu kullanıcı adı zaten alınmış"), { code: "profile/username-taken" }),
      );
      await render();
      await run((e) => e.setUsername("yeniad"));
      await flush();
      await save();
      expect(mockToast.show).toHaveBeenCalledWith({ type: "error", text1: "Bu kullanıcı adı alınmış" });
      expect(ed().editing).toBe(true);
    });

    it("bilinmeyen hata ham mesajı değil genel çevrili metni gösterir", async () => {
      mockChangeUsername.mockRejectedValueOnce(new Error("FirebaseError: permission-denied"));
      await render();
      await run((e) => e.setUsername("yeniad"));
      await flush();
      await save();
      expect(mockToast.show).toHaveBeenCalledWith({ type: "error", text1: "Güncellenemedi" });
    });

    it("an invalid name is blocked without asking the server", async () => {
      await render();
      await run((e) => e.setUsername("ab"));
      await flush();
      expect(ed().usernameStatus).toBe("invalid");
      expect(mockIsAvailable).not.toHaveBeenCalled();
      expect(ed().canSave).toBe(false);
    });

    it("typing the saved name back is not a change", async () => {
      await render();
      await run((e) => e.setUsername("yeniad"));
      await run((e) => e.setUsername("aliveli"));
      expect(ed().usernameStatus).toBe("same");
      expect(ed().usernameHint).toBeNull();
      expect(ed().dirty).toBe(false);
    });
  });

  describe("avatar", () => {
    it("writes the pick into the draft only; Save makes it permanent", async () => {
      await render();
      await run((e) => e.setAvatar(9));
      expect(ed().draft.avatar.avatarIndex).toBe(9);
      expect(mockSelectAvatar).not.toHaveBeenCalled();
      expect(ed().dirty).toBe(true);
      await save();
      expect(mockSelectAvatar).toHaveBeenCalledWith({ avatarIndex: 9, photoURL: null, photoSource: null });
    });

    it("picking the saved avatar again is not a change", async () => {
      await render();
      await run((e) => e.setAvatar(9));
      await run((e) => e.setAvatar(4));
      expect(ed().dirty).toBe(false);
    });
  });

  describe("four favorites", () => {
    const film = (id) => ({ id, title: `Film ${id}`, image: `/f${id}.jpg` });
    const favs = (ids) => ({ movies: ids.map(film), shows: [], people: [] });

    it("saves picks with the other changes and tracks them", async () => {
      await render();
      await run((e) => e.setDisplayName("Ali V."));
      await run((e) => e.setFavorites(favs([7, 8])));
      await save();
      expect(mockUpdateField).toHaveBeenCalledWith(
        { displayName: "Ali V.", fourFavorites: favs([7, 8]) },
        { stampIdentity: true },
      );
      expect(mockTrack).toHaveBeenCalledWith("four_favorites_saved", { movies: 2, shows: 0, people: 0, total: 2 });
    });

    it("clearing every favourite is saved as an empty structure", async () => {
      mockProfile = { ...SAVED, fourFavorites: favs([1, 2]) };
      await render();
      await run((e) => e.setFavorites({ movies: [], shows: [], people: [] }));
      expect(ed().dirty).toBe(true);
      await save();
      expect(mockUpdateField).toHaveBeenCalledWith(
        { fourFavorites: { movies: [], shows: [], people: [] } },
        { stampIdentity: false },
      );
    });
  });

  describe("profile banner", () => {
    const banner = { id: 27205, type: "movie", title: "Inception", path: "/abc.jpg" };

    it("saves a picked banner and removing it writes null", async () => {
      await render();
      await run((e) => e.setBanner(banner));
      expect(ed().dirty).toBe(true);
      await save();
      expect(mockUpdateField).toHaveBeenCalledWith({ profileBanner: banner }, { stampIdentity: false });

      mockUpdateField.mockClear();
      mockProfile = { ...SAVED, profileBanner: banner };
      await render();
      await run((e) => e.setBanner(null));
      await save();
      expect(mockUpdateField).toHaveBeenCalledWith({ profileBanner: null }, { stampIdentity: false });
    });

    it("an invalid banner is ignored (not dirty)", async () => {
      await render();
      await run((e) => e.setBanner({ ...banner, path: "https://x.example/a.jpg" }));
      expect(ed().dirty).toBe(false);
    });
  });

  describe("social accounts", () => {
    it("saves a resolved handle to the links document", async () => {
      await render();
      await run((e) => e.setSocial("instagram", "instagram.com/ali.veli"));
      expect(ed().dirty).toBe(true);
      await save();
      expect(mockSaveSocialLinks).toHaveBeenCalledWith("me", { instagram: "ali.veli" });
      expect(mockUpdateField).not.toHaveBeenCalled();
    });

    it("an invalid handle stops the save and marks the platform", async () => {
      await render();
      await run((e) => e.setSocial("instagram", "bad handle with spaces!!"));
      await save();
      expect(mockSaveSocialLinks).not.toHaveBeenCalled();
      expect(ed().socialInvalid).toEqual(["instagram"]);
      expect(ed().editing).toBe(true);
      // Düzeltince işaret kalkar.
      await run((e) => e.setSocial("instagram", "aliveli"));
      expect(ed().socialInvalid).toEqual([]);
    });
  });

  describe("showcase badges and lists", () => {
    it("replaces the showcase only when it changed", async () => {
      mockShowcase = ["ilk_kare"];
      await render();
      await run((e) => e.setShowcase(["ilk_kare", "ilk_bolum"]));
      expect(ed().dirty).toBe(true);
      await save();
      expect(mockReplaceShowcase).toHaveBeenCalledWith(["ilk_kare", "ilk_bolum"]);
    });

    it("writes only the list flags that changed", async () => {
      await render();
      await run((e) => e.toggleList("watchList"));
      await run((e) => e.toggleList("favorites"));
      expect(ed().draft.listVisible).toEqual({ favorites: false, watchList: true });
      await save();
      expect(mockSetListVisibility).toHaveBeenCalledWith("me", { favorites: false, watchList: true });
    });

    it("toggling a list twice is not a change", async () => {
      await render();
      await run((e) => e.toggleList("watchedTv"));
      await run((e) => e.toggleList("watchedTv"));
      expect(ed().dirty).toBe(false);
    });

    it("old array-shaped visibility is rewritten as a whole map", async () => {
      mockProfile = { ...SAVED, listVisible: [{ favorites: true }, { watchList: false }] };
      await render();
      await run((e) => e.toggleList("watchList"));
      await save();
      expect(mockSetListVisibility).toHaveBeenCalledWith("me", { favorites: true, watchList: true });
    });
  });
});
