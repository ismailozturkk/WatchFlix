// __tests__/listVisibilityScreen.test.js
//
// Ayarlar > Gizlilik > Profilinde görünen listeler. Gerçek ekran ve gerçek saf çekirdek;
// profil/liste bağlamları ve yazım servisi taklit. Sınananlar: satır sırası ve durumu,
// satır anahtarının YALNIZ o listeyi yazması (noktalı ad dahil), yazım yolda iken
// anahtarın geri sekmemesi, hata yolunda geri dönüş + uyarı, toplu aç/kapat, eski
// dizi biçiminde tam harita yazımı, kitle seçimi ve "kimse görmüyor" notu.

import React from "react";
import { act, create } from "react-test-renderer";

let mockLang = "en";
let mockProfile;
let mockLists;
const mockSetVis = jest.fn();
const mockUpdatePrivacy = jest.fn();
const mockToastError = jest.fn();

jest.mock("react-native", () => ({
  StyleSheet: { create: (styles) => styles },
  TouchableOpacity: "Touchable",
  View: "View",
  Text: "Text",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/SwitchToggle", () => ({ __esModule: true, default: "Switch" }));
jest.mock("../components/AppToast", () => ({ toast: { error: (...args) => mockToastError(...args) } }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock("../context/UserProfileContext", () => ({
  useUserProfile: () => ({
    uid: "u1",
    profile: mockProfile,
    privacy: mockProfile.privacy,
    updatePrivacy: (...args) => mockUpdatePrivacy(...args),
  }),
}));
jest.mock("../context/ListStatusContext", () => ({
  useListStatusContext: () => ({ combinedLists: mockLists }),
}));
jest.mock("../services/userService", () => ({ setListVisibility: (...args) => mockSetVis(...args) }));
jest.mock("../services/hapticsService", () => ({ selectionAsync: () => {} }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
jest.mock("../screens/tabs/settings/settingsUi", () => ({
  SettingsSubScreen: "Screen",
  buildUiColors: () => new Proxy({}, { get: () => "#336699" }),
  ui: new Proxy({}, { get: () => ({}) }),
}));

const ListVisibilityScreen = require("../screens/tabs/profile/ListVisibilityScreen").default;
const { LIST_VISIBILITY_COPY } = require("../screens/tabs/profile/listVisibilityCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let warn;
const render = () => {
  act(() => { renderer = create(<ListVisibilityScreen />); });
};
const rerender = () => {
  act(() => { renderer.update(<ListVisibilityScreen />); });
};
const rowIds = () =>
  renderer.root
    .findAll((n) => n.type === "Touchable" && String(n.props.testID || "").startsWith("list-visibility-row-"))
    .map((n) => n.props.testID.replace("list-visibility-row-", ""));
const row = (name) => renderer.root.findByProps({ testID: `list-visibility-row-${name}` });
const checked = (name) => row(name).props.accessibilityState.checked;
const press = async (testID) => {
  await act(async () => { renderer.root.findByProps({ testID }).props.onPress(); });
};
const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
const copy = () => LIST_VISIBILITY_COPY[mockLang];

beforeEach(() => {
  mockLang = "en";
  mockProfile = {
    privacy: { profile: "public", lists: "public" },
    listVisible: { favorites: true, watchList: true, watchedMovies: false, watchedTv: true, "S.W.A.T.": true },
  };
  mockLists = {
    favorites: [{ id: 1 }],
    watchList: [],
    watchedMovies: [{ id: 2 }, { id: 3 }],
    watchedTv: [{ id: 4 }],
    "S.W.A.T.": [{ id: 5 }],
    Anime: [{ id: 6 }],
  };
  mockSetVis.mockReset().mockResolvedValue(undefined);
  mockUpdatePrivacy.mockReset().mockResolvedValue(undefined);
  mockToastError.mockClear();
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  warn.mockRestore();
});

describe("ilk görünüm", () => {
  test("öntanımlı dört liste önce, özel listeler ada göre; durum haritadan", () => {
    render();
    expect(rowIds()).toEqual(["favorites", "watchList", "watchedMovies", "watchedTv", "Anime", "S.W.A.T."]);
    expect(checked("favorites")).toBe(true);
    expect(checked("watchedMovies")).toBe(false);
    // Haritada olmayan liste kapalı sayılır (arkadaş profili de öyle sayar).
    expect(checked("Anime")).toBe(false);
    expect(texts()).toContain(copy().shownCount(4, 6));
  });

  test("satır alt yazısı ne olacağını söyler: görünür / boş / yalnız sen", () => {
    render();
    const sub = (name) => row(name).props.accessibilityHint;
    expect(sub("favorites")).toBe(copy().shownSub(1));
    expect(sub("watchList")).toBe(copy().emptySub);
    expect(sub("watchedMovies")).toBe(copy().hiddenSub(2));
  });

  test("her dilde başlık ve açıklama çizilir", () => {
    for (const dil of ["tr", "en", "es", "pt", "de"]) {
      mockLang = dil;
      render();
      expect(texts()).toEqual(expect.arrayContaining([copy().intro, copy().whoLabel, copy().whichLabel, copy().footer]));
      act(() => renderer.unmount());
      renderer = null;
    }
  });
});

describe("satır anahtarı", () => {
  test("yalnız o listeyi yazar ve anlık görüntü gelmeden açık/kapalı görünür", async () => {
    render();
    await press("list-visibility-row-watchedMovies");
    expect(mockSetVis).toHaveBeenCalledWith("u1", { watchedMovies: true });
    expect(checked("watchedMovies")).toBe(true);
    expect(texts()).toContain(copy().shownCount(5, 6));
  });

  test("noktalı ad tek anahtar olarak yazılır", async () => {
    render();
    await act(async () => { row("S.W.A.T.").findByType("Switch").props.onValueChange(false); });
    expect(mockSetVis).toHaveBeenCalledWith("u1", { "S.W.A.T.": false });
  });

  test("anlık görüntü gelince geçici değer düşer, kayıt esas alınır", async () => {
    render();
    await press("list-visibility-row-favorites");
    expect(checked("favorites")).toBe(false);
    mockProfile = { ...mockProfile, listVisible: { ...mockProfile.listVisible, favorites: false } };
    rerender();
    expect(checked("favorites")).toBe(false);
  });

  test("yazım başarısızsa anahtar geri döner ve uyarı çıkar", async () => {
    mockSetVis.mockRejectedValue(new Error("offline"));
    render();
    await press("list-visibility-row-favorites");
    expect(checked("favorites")).toBe(true);
    expect(mockToastError).toHaveBeenCalledWith(copy().saveFailed);
  });

  test("eski dizi biçiminde haritanın tamamı yazılır (diğer bayraklar düşmesin)", async () => {
    mockProfile = { ...mockProfile, listVisible: [{ favorites: true }, { watchList: false }] };
    render();
    await press("list-visibility-row-watchList");
    expect(mockSetVis).toHaveBeenCalledWith("u1", { favorites: true, watchList: true });
  });
});

describe("Tümünü aç / kapat", () => {
  test("bir kısmı kapalıyken yalnız kapalıları açar; hepsi açıkken hepsini kapatır", async () => {
    render();
    expect(texts()).toContain(copy().showAll);
    await press("list-visibility-toggle-all");
    expect(mockSetVis).toHaveBeenLastCalledWith("u1", { watchedMovies: true, Anime: true });
    expect(texts()).toContain(copy().hideAll);
    await press("list-visibility-toggle-all");
    expect(mockSetVis).toHaveBeenLastCalledWith("u1", {
      favorites: false,
      watchList: false,
      watchedMovies: false,
      watchedTv: false,
      Anime: false,
      "S.W.A.T.": false,
    });
  });
});

describe("kim görebilir", () => {
  test("seçili kitle işaretli; başka seçenek privacy.lists'i yazar", async () => {
    render();
    const chip = (v) => renderer.root.findByProps({ testID: `list-audience-${v}` });
    expect(chip("public").props.accessibilityState).toEqual({ checked: true });
    await press("list-audience-friends");
    expect(mockUpdatePrivacy).toHaveBeenCalledWith({ lists: "friends" });
    // Aynı seçeneğe basmak yazmaz.
    mockUpdatePrivacy.mockClear();
    await press("list-audience-public");
    expect(mockUpdatePrivacy).not.toHaveBeenCalled();
  });

  test("Yalnız ben: 'kimse görmüyor' notu", () => {
    mockProfile = { ...mockProfile, privacy: { profile: "public", lists: "private" } };
    render();
    expect(texts()).toContain(copy().audienceNote.private);
  });

  test("profil arkadaşlara açıkken listeler herkese açık olsa da not daraltmayı açıklar", () => {
    mockProfile = { ...mockProfile, privacy: { profile: "friends", lists: "public" } };
    render();
    expect(texts()).toContain(copy().limitedNote.friends);
    expect(texts()).not.toContain(copy().audienceNote.public);
  });
});
