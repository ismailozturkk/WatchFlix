// Zevk Çemberleri Faz 4: kapı (bayrak + 18+) ve Ayarlar > Zevk Çemberleri ekranı.
// Kabul: bayrak ya da yaş kapısı kapalıyken katılım belgesi OKUNMAZ ve ekranda eşleşme öğesi yok.
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  TouchableOpacity: "Touch",
  LayoutAnimation: { configureNext: () => {}, Presets: {} },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@components/AppIcon", () => ({ __esModule: true, default: "Icon" }));
jest.mock("@components/common/GlassIconButton", () => ({ __esModule: true, default: "GlassIconButton" }));
jest.mock("../components/common/GlassBox", () => ({ __esModule: true, default: "GlassBox" }));
jest.mock("../components/common/GlassTouchable", () => {
  const React = require("react");
  return { __esModule: true, default: ({ children, ...props }) => React.createElement("Touch", props, children) };
});
jest.mock("../components/LensLoader", () => ({ __esModule: true, default: "Loader" }));
jest.mock("../components/common/BetaBadge", () => ({ __esModule: true, default: "BetaBadge" }));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("@components/AppToast", () => ({ toast: mockToast }));
const mockAlert = jest.fn();
jest.mock("@components/AppAlert", () => ({ appAlert: (...a) => mockAlert(...a) }));
jest.mock("@services/hapticsService", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("@context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("@context/ThemeContext", () => ({ useTheme: () => ({ theme: {} }) }));
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));

let mockProfile;
jest.mock("../context/UserProfileContext", () => ({ useUserProfile: () => ({ uid: "u1", profile: mockProfile }) }));
jest.mock("@context/UserProfileContext", () => ({ useUserProfile: () => ({ uid: "u1", profile: mockProfile }) }));
let mockLists;
jest.mock("../context/ListStatusContext", () => ({ useListStatusContext: () => mockLists }));
jest.mock("../services/analytics", () => ({ ANALYTICS_EVENTS: {}, trackEvent: jest.fn() }));

let mockConfig;
let mockOptInDoc;
const mockSubscribe = jest.fn();
const mockSave = jest.fn();
const mockLeave = jest.fn();
jest.mock("../services/matchOptIn", () => ({
  fetchMatchConfig: () => Promise.resolve(mockConfig),
  subscribeMatchOptIn: (uid, onData) => {
    mockSubscribe(uid);
    onData(mockOptInDoc);
    return () => {};
  },
  saveMatchOptIn: (...a) => mockSave(...a),
  leaveMatch: (...a) => mockLeave(...a),
}));

jest.mock("../screens/tabs/settings/settingsUi", () => {
  const React = require("react");
  const host = (name) => ({ children, ...props }) => React.createElement(name, props, children);
  return {
    SettingsSubScreen: host("Screen"),
    SettingRow: host("Row"),
    Chevron: "Chevron",
    ui: new Proxy({}, { get: () => ({}) }),
    buildUiColors: () => new Proxy({}, { get: (_t, key) => (typeof key === "string" ? `#${String(key).length}` : undefined) }),
  };
});

const MatchSettingsScreen = require("../screens/tabs/settings/MatchSettingsScreen").default;
const { MATCH_COPY } = require("../utils/matchCopy");
const copy = MATCH_COPY.tr;

global.IS_REACT_ACT_ENVIRONMENT = true;
let renderer;
let prevDev;

const texts = () =>
  renderer.root
    .findAll((n) => n.type === "Text")
    .flatMap((n) => [].concat(n.props.children))
    .filter((c) => typeof c === "string" || typeof c === "number")
    .map(String);
const pressable = (label) => renderer.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === "function");

const mount = async () => {
  await act(async () => {
    renderer = create(<MatchSettingsScreen />);
  });
};

beforeEach(() => {
  prevDev = global.__DEV__;
  global.__DEV__ = false;
  mockConfig = { enabled: true };
  mockOptInDoc = null;
  mockProfile = { birthDate: "1995-06-01", fourFavorites: { movies: [{}, {}], shows: [] } };
  mockLists = {
    watchedMoviesItems: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, dateAdded: new Date(Date.now() - i * 864e5).toISOString() })),
    watchedTvMap: {},
    activityIndex: { ratings: {}, comments: [] },
  };
  jest.clearAllMocks();
});
afterEach(() => {
  global.__DEV__ = prevDev;
  if (renderer) act(() => renderer.unmount());
});

test("bayrak kapalı: belge okunmaz, ekran boş", async () => {
  mockConfig = { enabled: false };
  await mount();
  expect(mockSubscribe).not.toHaveBeenCalled();
  expect(texts()).not.toContain(copy.heroTitle);
});

test("18 altı ya da doğum tarihi yok: belge okunmaz, ekran boş", async () => {
  for (const birthDate of ["2012-01-01", null]) {
    mockProfile = { birthDate };
    await mount();
    expect(mockSubscribe).not.toHaveBeenCalled();
    expect(texts()).not.toContain(copy.heroTitle);
    act(() => renderer.unmount());
    renderer = null;
  }
});

test("açık + katılmamış: onay metni, kulvar gücü ve sonraki adım; Katıl seçili kulvarları yazar", async () => {
  mockSave.mockResolvedValue({ optIn: true, lanes: ["movie", "tv"] });
  await mount();
  expect(mockSubscribe).toHaveBeenCalledWith("u1");
  const t = texts();
  expect(t).toContain(copy.heroTitle);
  // Beta döneminde rozet (utils/betaFeatures "match") oy kimliğiyle çizilir.
  expect(renderer.root.findAll((n) => n.type === "BetaBadge").map((n) => n.props.featureId)).toEqual(["match"]);
  for (const point of copy.consent.points) expect(t).toContain(point);
  // 40 film, puansız: puan yolu için 20 puan eksik
  expect(t).toContain(copy.step.rate(20));
  // Puan adımı → Meydan Okuma düğmesi (20 eksik → aylık 25 puan görevi).
  await act(async () => pressable("Puan görevine katıl").props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith("ChallengesScreen", { openId: "rate25_30" });
  await act(async () => pressable(copy.join).props.onPress());
  expect(mockSave).toHaveBeenCalledWith("u1", ["movie", "tv"]);
  expect(mockToast.success).toHaveBeenCalledWith(copy.joined);
});

test("katılmış: onay metni yok, ayrıl onay penceresi açar", async () => {
  mockOptInDoc = { optIn: true, lanes: ["movie"], consentVersion: 1 };
  await mount();
  const t = texts();
  expect(t).not.toContain(copy.consent.points[0]);
  expect(t).toContain(copy.poolSoon);
  act(() => pressable(copy.leave).props.onPress());
  expect(mockAlert).toHaveBeenCalledWith(copy.leaveConfirmTitle, copy.leaveConfirmBody, expect.any(Array));
  const destructive = mockAlert.mock.calls[0][2].find((b) => b.style === "destructive");
  mockLeave.mockResolvedValue({});
  await act(async () => destructive.onPress());
  expect(mockLeave).toHaveBeenCalledWith("u1");
});

test("eski onay sürümü: yeniden onay istenir", async () => {
  mockOptInDoc = { optIn: true, lanes: ["movie"], consentVersion: 0 };
  await mount();
  expect(texts()).toContain(copy.consent.reconsent);
});
