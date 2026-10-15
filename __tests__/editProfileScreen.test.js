import React from "react";
import { act, create } from "react-test-renderer";
import EditProfileScreen from "../screens/tabs/profile/EditProfileScreen";

// Ekranın BAĞLANTISI test edilir (Kaydet ne zaman açılır, avatar seçimi forma
// nasıl yazılır, kullanıcı adı engeli, hesap silme çağrısı). Görsel parçalar
// (AuthKit, EditProfileKit) ana makinede çizilemediği için ana makine bileşenleri
// olarak taklit edilir; props'ları doğrudan okunup tetiklenir.

jest.mock("react-native", () => ({
  View: "View", ScrollView: "ScrollView", StatusBar: "StatusBar", ActivityIndicator: "Spinner",
  KeyboardAvoidingView: "Keyboard", Platform: { OS: "ios" },
  StyleSheet: { create: (s) => s, absoluteFill: { position: "absolute" }, hairlineWidth: 1 },
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeArea",
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("react-native-toast-message", () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
jest.mock("../components/ScreenDecor", () => ({ __esModule: true, default: "Decor" }));
jest.mock("../components/auth/BirthDateField", () => ({ __esModule: true, default: "BirthDateField" }));
jest.mock("../components/profile/ProfileAvatarPickerModal", () => ({ __esModule: true, default: "AvatarSheet" }));
jest.mock("../utils/ageGate", () => ({
  MIN_ADULT_AGE: 18,
  calculateAge: (iso) => (iso ? 26 : null),
  syncAgeRestriction: jest.fn(),
}));

jest.mock("../components/auth/AuthKit", () => {
  const React = require("react");
  return {
    AUTH_ERROR: "rgb(189, 8, 28)", AUTH_SUCCESS: "rgb(37, 211, 102)", AUTH_WARN: "#f39c12",
    authColumn: {},
    AuthBackdrop: "Backdrop",
    AuthSectionLabel: "SectionLabel",
    Reveal: ({ children }) => children,
    AuthField: React.forwardRef((props, ref) => React.createElement("AuthField", { ...props, fieldRef: ref })),
  };
});
jest.mock("../components/profile/EditProfileKit", () => ({
  EditHeader: "EditHeader", ProfileHero: "ProfileHero", FormSection: "FormSection", FieldBlock: "FieldBlock",
  FieldLabel: "FieldLabel", FieldHint: "FieldHint", DangerRow: "DangerRow", DeleteAccountSheet: "DeleteSheet",
}));

const mockToast = require("react-native-toast-message").default;
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", between: "#222222", border: "#333333", accent: "#3388ff",
  text: { primary: "#fff", secondary: "#bbb", muted: "#888" }, colors: { red: "#e11", green: "#1e1" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { photoURL: null } }) }));

let mockProfileState;
const mockUpdateField = jest.fn(() => Promise.resolve());
const mockChangeUsername = jest.fn(() => Promise.resolve());
const mockSelectAvatar = jest.fn(() => Promise.resolve());
jest.mock("../context/UserProfileContext", () => ({
  useUserProfile: () => ({
    profile: mockProfileState.profile,
    loading: mockProfileState.loading,
    updateField: mockUpdateField,
    changeUsername: mockChangeUsername,
  }),
}));
jest.mock("../context/ProfileUiContext", () => ({
  useProfileUi: () => ({ selectAvatarIndex: 2, selectAvatar: mockSelectAvatar }),
}));

const mockIsAvailable = jest.fn(() => Promise.resolve(true));
jest.mock("../services/userService", () => ({
  formatUsernameInput: (v) => String(v).toLowerCase().replace(/[^a-z0-9_]/g, ""),
  isValidUsername: (v) => /^[a-z0-9_]{3,20}$/.test(v) && /[a-z]/.test(v),
  isUsernameAvailable: (...args) => mockIsAvailable(...args),
  normalizeUsername: (v) => String(v || "").trim().toLowerCase(),
}));
const mockDeleteAccount = jest.fn(() => Promise.resolve({}));
jest.mock("../services/accountService", () => ({
  deleteAccount: (...args) => mockDeleteAccount(...args),
  getSignInMethods: () => ({ hasPassword: true, hasGoogle: false, hasApple: false }),
  reauthenticateForDeletion: jest.fn(),
}));
jest.mock("../services/googleAuthService", () => ({
  describeGoogleAuthError: () => "google error", GoogleAuthCode: { CANCELLED: "google/cancelled" },
}));
jest.mock("../services/appleAuthService", () => ({
  describeAppleAuthError: () => "apple error", AppleAuthCode: { CANCELLED: "apple/cancelled" },
}));
jest.mock("../services/profilePropagation", () => ({
  propagateProfileChange: jest.fn(() => Promise.resolve()),
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const SAVED = {
  uid: "u1", displayName: "Ali Veli", username: "aliveli", bio: "Film delisi",
  avatarIndex: 4, birthDate: "1998-03-05",
};

let renderer;
let navigation;
let consoleError;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockProfileState = { profile: SAVED, loading: false };
  navigation = { goBack: jest.fn(), reset: jest.fn() };
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

async function render() {
  await act(() => { renderer = create(<EditProfileScreen navigation={navigation} />); });
}
const header = () => renderer.root.findByType("EditHeader");
const field = (icon) => renderer.root.findAll((n) => n.type === "AuthField" && n.props.icon === icon)[0];
const type = (icon, value) => act(() => field(icon).props.onChangeText(value));
const flush = () => act(async () => { jest.advanceTimersByTime(600); await Promise.resolve(); });

describe("EditProfileScreen", () => {
  it("fills the form from the profile and leaves Save off until something changes", async () => {
    await render();
    expect(field("person-outline").props.value).toBe("Ali Veli");
    expect(field("at").props.value).toBe("aliveli");
    expect(field("chatbubble-ellipses-outline").props.value).toBe("Film delisi");
    expect(header().props.canSave).toBe(false);
    expect(header().props.saving).toBe(false);
  });

  it("shows only the spinner while the profile is still loading", async () => {
    mockProfileState = { profile: null, loading: true };
    await render();
    expect(renderer.root.findAllByType("EditHeader")).toHaveLength(0);
    expect(renderer.root.findAllByType("Spinner")).toHaveLength(1);
  });

  it("enables Save when a field changes and disables it again when changed back", async () => {
    await render();
    await type("person-outline", "Ali V.");
    expect(header().props.canSave).toBe(true);
    await type("person-outline", "Ali Veli");
    expect(header().props.canSave).toBe(false);
  });

  it("mirrors the form into the hero preview as the user types", async () => {
    await render();
    await type("person-outline", "Yeni Ad");
    const hero = renderer.root.findByType("ProfileHero");
    expect(hero.props.name).toBe("Yeni Ad");
    expect(hero.props.username).toBe("aliveli");
    expect(hero.props.avatarIndex).toBe(4);
  });

  it("saves only what changed, then goes back", async () => {
    await render();
    await type("person-outline", "Ali V.");
    await act(async () => { await header().props.onSave(); });
    expect(mockUpdateField).toHaveBeenCalledWith({ displayName: "Ali V." });
    expect(mockChangeUsername).not.toHaveBeenCalled();
    expect(mockSelectAvatar).not.toHaveBeenCalled();
    expect(mockToast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it("refuses to save an empty name with a toast", async () => {
    await render();
    await type("person-outline", "   ");
    await act(async () => { await header().props.onSave(); });
    expect(mockUpdateField).not.toHaveBeenCalled();
    expect(mockToast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  describe("avatar", () => {
    it("writes the pick into the form only and closes the sheet; Save makes it permanent", async () => {
      await render();
      expect(renderer.root.findByType("AvatarSheet").props.visible).toBe(false);
      await act(() => renderer.root.findByType("ProfileHero").props.onPress());
      expect(renderer.root.findByType("AvatarSheet").props.visible).toBe(true);

      await act(() => renderer.root.findByType("AvatarSheet").props.onSelect(9));
      expect(renderer.root.findByType("AvatarSheet").props.visible).toBe(false);
      expect(renderer.root.findByType("ProfileHero").props.avatarIndex).toBe(9);
      expect(mockSelectAvatar).not.toHaveBeenCalled(); // henüz kaydedilmedi
      expect(header().props.canSave).toBe(true);

      await act(async () => { await header().props.onSave(); });
      expect(mockSelectAvatar).toHaveBeenCalledWith(9);
    });

    it("picking the avatar that is already saved is not a change", async () => {
      await render();
      await act(() => renderer.root.findByType("AvatarSheet").props.onSelect(9));
      await act(() => renderer.root.findByType("AvatarSheet").props.onSelect(4));
      expect(header().props.canSave).toBe(false);
    });
  });

  describe("username", () => {
    it("blocks Save while checking and while the name is taken", async () => {
      mockIsAvailable.mockResolvedValueOnce(false);
      await render();
      await type("at", "baskasi");
      expect(header().props.canSave).toBe(false); // kontrol ediliyor
      await flush();
      expect(field("at").props.state).toBe(false); // alınmış
      expect(header().props.canSave).toBe(false);
      expect(renderer.root.findAllByType("FieldHint").length).toBeGreaterThan(0);
    });

    it("allows Save once the new name is available and changes it", async () => {
      await render();
      await type("at", "yeniad");
      await flush();
      expect(field("at").props.state).toBe(true);
      expect(header().props.canSave).toBe(true);
      await act(async () => { await header().props.onSave(); });
      expect(mockChangeUsername).toHaveBeenCalledWith("yeniad");
    });

    it("blocks Save for an invalid name", async () => {
      await render();
      await type("at", "ab");
      await flush();
      expect(field("at").props.state).toBe(false);
      expect(header().props.canSave).toBe(false);
    });
  });

  describe("birth date", () => {
    it("is read-only once saved, and never makes the form dirty", async () => {
      await render();
      expect(renderer.root.findByType("BirthDateField").props.disabled).toBe(true);
      await act(() => renderer.root.findByType("BirthDateField").props.onChange("1999-09-09"));
      expect(header().props.canSave).toBe(false);
    });

    it("is editable and saved when the profile has none yet", async () => {
      mockProfileState = { profile: { ...SAVED, birthDate: null }, loading: false };
      await render();
      expect(renderer.root.findByType("BirthDateField").props.disabled).toBe(false);
      await act(() => renderer.root.findByType("BirthDateField").props.onChange("2000-01-01"));
      expect(header().props.canSave).toBe(true);
      await act(async () => { await header().props.onSave(); });
      expect(mockUpdateField).toHaveBeenCalledWith({ birthDate: "2000-01-01" });
    });
  });

  describe("delete account", () => {
    const sheet = () => renderer.root.findByType("DeleteSheet");

    it("opens the confirmation sheet in password mode for a password account", async () => {
      await render();
      expect(sheet().props.visible).toBe(false);
      await act(() => renderer.root.findByType("DangerRow").props.onPress());
      expect(sheet().props.visible).toBe(true);
      expect(sheet().props.provider).toBeNull();
      expect(sheet().props.confirmDisabled).toBe(false);
    });

    it("asks for the password before deleting", async () => {
      await render();
      await act(() => renderer.root.findByType("DangerRow").props.onPress());
      await act(async () => { await sheet().props.onConfirm(); });
      expect(mockDeleteAccount).not.toHaveBeenCalled();
      expect(mockToast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    });

    it("deletes with the typed password and returns to the login screen", async () => {
      await render();
      await act(() => renderer.root.findByType("DangerRow").props.onPress());
      await act(() => sheet().props.onPasswordChange("gizli123"));
      await act(async () => { await sheet().props.onConfirm(); });
      expect(mockDeleteAccount).toHaveBeenCalledWith(expect.objectContaining({ password: "gizli123" }));
      expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: "LoginScreen" }] });
    });

    it("closes with the cancel handler", async () => {
      await render();
      await act(() => renderer.root.findByType("DangerRow").props.onPress());
      await act(() => sheet().props.onClose());
      expect(sheet().props.visible).toBe(false);
    });
  });
});
