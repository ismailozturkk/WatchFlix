// hooks/useSettingsShare: gönderen GÖRDÜĞÜNÜ paylaşır; alıcıda her bölüm kendi
// setter'ıyla CANLI yazılır; geri al önceki hâli aynı yoldan getirir ve bu işlemle
// eklenen özel temayı siler.
import React from "react";
import { act, create } from "react-test-renderer";

const mockStore = {};
const mockSet = jest.fn((descriptor, value) => {
  mockStore[descriptor.key] = value;
  return true;
});
const mockRemove = jest.fn((descriptor) => {
  delete mockStore[descriptor.key];
  return true;
});
jest.mock("../services/storage", () => {
  const { Keys } = jest.requireActual("../services/storage/registry");
  return {
    Keys,
    get: (descriptor) => (descriptor.key in mockStore ? mockStore[descriptor.key] : descriptor.default),
    set: (...args) => mockSet(...args),
    remove: (...args) => mockRemove(...args),
  };
});

let mockTheme;
let mockSnow;
let mockAmbient;
let mockIcon;
let mockDecor;
let mockLayout;
let mockProfileUi;
let mockTypography;
const mockSetFontRole = jest.fn(() => true);
jest.mock("../context/ThemeContext", () => ({ useTheme: () => mockTheme }));
jest.mock("../context/AppSettingsContext", () => ({
  useSnowSettings: () => mockSnow,
  useAmbientBackgroundSettings: () => mockAmbient,
  useIconBackgroundSettings: () => mockIcon,
  useDecorScopeSettings: () => mockDecor,
  useListLayoutSettings: () => mockLayout,
}));
jest.mock("../context/ProfileUiContext", () => ({ useProfileUi: () => mockProfileUi }));
jest.mock("../services/typographySettings", () => ({
  setFontRole: (...args) => mockSetFontRole(...args),
  useTypographyState: () => mockTypography,
}));

const useSettingsShare = require("../hooks/useSettingsShare").default;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const OCEAN = { id: "ct_ocean", name: "Okyanus", tokens: { primary: "#0B1320", accent: "#3AA0FF" } };

let api;
function Probe() {
  api = useSettingsShare();
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockStore)) delete mockStore[key];
  mockTheme = {
    selectedTheme: "custom:ct_mine",
    appliedTheme: "blue", // Free'de kilitli özel tema yerine çizilen
    customThemes: [{ id: "ct_mine", name: "Benim", tokens: { primary: "#111111" } }],
    changeTheme: jest.fn(),
    saveCustomTheme: jest.fn(),
    deleteCustomTheme: jest.fn(),
  };
  mockSnow = { showSnow: false, changeShowSnow: jest.fn() };
  mockAmbient = { showAmbientBackground: false, changeShowAmbientBackground: jest.fn() };
  mockIcon = {
    showIconBackground: false,
    iconBackgroundMode: "shared",
    iconBackgroundOpacity: 1,
    changeShowIconBackground: jest.fn(),
    changeIconBackgroundMode: jest.fn(),
    changeIconBackgroundOpacity: jest.fn(),
  };
  mockDecor = { decorHidden: {}, replaceDecorScopes: jest.fn() };
  mockLayout = {
    listsGridColumns: 3,
    seeAllGridColumns: 3,
    listsPosterRadius: 10,
    seeAllPosterRadius: 10,
    railPosterRadius: 15,
    railPosterSize: "normal",
    postListPosterLayout: "spaced",
    listPosterInfo: { mediaType: true, title: false },
    posterBadges: { shared: true },
    changeListsGridColumns: jest.fn(),
    changeSeeAllGridColumns: jest.fn(),
    changeListsPosterRadius: jest.fn(),
    changeSeeAllPosterRadius: jest.fn(),
    changeRailPosterRadius: jest.fn(),
    changeRailPosterSize: jest.fn(),
    changePostListPosterLayout: jest.fn(),
    changeListPosterInfo: jest.fn(),
    changePosterBadges: jest.fn(),
  };
  mockProfileUi = { allCornersRounded: false, gridStyle: 1, saveAllCornersRounded: jest.fn(), saveListGridStyle: jest.fn() };
  mockTypography = {
    heading: "system",
    body: "system",
    numeric: "system",
    selected: { heading: "bebasNeue", body: "system", numeric: "system" },
  };
  act(() => {
    create(<Probe />);
  });
});

test("gönderen kullanıcının GÖRDÜĞÜNÜ paylaşır (kilitli özel tema / font yerine çizilen)", () => {
  const share = api.buildMine(["theme", "fonts"], "Ada");
  expect(share.owner).toBe("Ada");
  expect(share.sections.theme).toEqual({ theme: "blue" });
  expect(share.sections.fonts.fontRoles).toEqual({ heading: "system", body: "system", numeric: "system" });
});

test("her bölüm kendi setter'ıyla yazılır", () => {
  const result = api.apply({
    theme: { theme: "custom:ct_ocean:dark", custom: OCEAN },
    fonts: { fontRoles: { heading: "oswald", body: "system", numeric: "system" } },
    effects: { showSnow: true, showAmbientBackground: false, iconBackgroundMode: "random", iconBackgroundOpacity: 0.5, decorScopes: { snow: ["chat"] } },
    posters: { allCornersRounded: true, listsPosterRadius: 20, railPosterSize: "small" },
    lists: { listsGridColumns: 4, listGridStyle: 2, listPosterInfo: { title: true }, posterBadges: { shared: false } },
    home: { sectionVisibility: { movie: ["trends"] } },
  });
  expect(result.applied).toEqual(["theme", "fonts", "effects", "posters", "lists", "home"]);
  expect(result.failed).toEqual([]);

  expect(mockTheme.saveCustomTheme).toHaveBeenCalledWith(OCEAN);
  expect(mockTheme.changeTheme).toHaveBeenCalledWith("custom:ct_ocean:dark");
  expect(mockSetFontRole.mock.calls).toEqual([["heading", "oswald"], ["body", "system"], ["numeric", "system"]]);
  expect(mockSnow.changeShowSnow).toHaveBeenCalledWith(true);
  expect(mockAmbient.changeShowAmbientBackground).toHaveBeenCalledWith(false);
  expect(mockIcon.changeShowIconBackground).not.toHaveBeenCalled(); // gövdede yok → dokunulmaz
  expect(mockIcon.changeIconBackgroundMode).toHaveBeenCalledWith("random");
  expect(mockIcon.changeIconBackgroundOpacity).toHaveBeenCalledWith(0.5);
  expect(mockDecor.replaceDecorScopes).toHaveBeenCalledWith({ snow: ["chat"] });
  expect(mockProfileUi.saveAllCornersRounded).toHaveBeenCalledWith(true);
  expect(mockLayout.changeListsPosterRadius).toHaveBeenCalledWith(20);
  expect(mockLayout.changeRailPosterSize).toHaveBeenCalledWith("small");
  expect(mockLayout.changeListsGridColumns).toHaveBeenCalledWith(4);
  expect(mockProfileUi.saveListGridStyle).toHaveBeenCalledWith(2);
  expect(mockLayout.changeListPosterInfo).toHaveBeenCalledWith("title", true);
  expect(mockLayout.changePosterBadges).toHaveBeenCalledWith({ shared: false });
  expect(mockStore.sectionVisibility).toEqual(expect.objectContaining({ movie: ["trends"] }));
});

test("null değer varsayılana döner; gizli bölüm kalmazsa anahtar silinir", () => {
  mockStore.sectionVisibility = { movie: ["trends"] };
  api.apply({ posters: { listsPosterRadius: null }, home: { sectionVisibility: null } });
  expect(mockLayout.changeListsPosterRadius).toHaveBeenCalledWith(10);
  expect(mockRemove).toHaveBeenCalled();
  expect(mockStore.sectionVisibility).toBeUndefined();
});

test("kilitli font reddedilirse bölüm başarısız sayılır, diğerleri uygulanır", () => {
  mockSetFontRole.mockImplementation((role, id) => id !== "bebasNeue");
  const result = api.apply({
    fonts: { fontRoles: { heading: "bebasNeue", body: "system", numeric: "system" } },
    lists: { listsGridColumns: 4 },
  });
  expect(result.applied).toEqual(["lists"]);
  expect(result.failed).toEqual(["fonts"]);
});

test("geri al: önceki değerler aynı yoldan yazılır, yeni eklenen tema silinir", () => {
  const result = api.apply({
    theme: { theme: "custom:ct_ocean", custom: OCEAN },
    posters: { listsPosterRadius: 20 },
    lists: { listsGridColumns: 4 },
  });
  jest.clearAllMocks();
  result.undo();
  // Önceki seçim kendi temasıyla birlikte geri gelir.
  expect(mockTheme.saveCustomTheme).toHaveBeenCalledWith(expect.objectContaining({ id: "ct_mine" }));
  expect(mockTheme.changeTheme).toHaveBeenCalledWith("custom:ct_mine");
  expect(mockTheme.deleteCustomTheme).toHaveBeenCalledWith("ct_ocean");
  expect(mockLayout.changeListsPosterRadius).toHaveBeenCalledWith(10);
  expect(mockLayout.changeListsGridColumns).toHaveBeenCalledWith(3);
});

test("cihazda zaten olan tema güncellenirse geri alırken silinmez", () => {
  mockTheme.customThemes = [...mockTheme.customThemes, { ...OCEAN, tokens: { primary: "#000000" } }];
  act(() => {
    create(<Probe />);
  });
  const result = api.apply({ theme: { theme: "custom:ct_ocean", custom: OCEAN } });
  result.undo();
  expect(mockTheme.deleteCustomTheme).not.toHaveBeenCalled();
});
