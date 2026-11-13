// Zevk Çemberleri Faz 6: "Önerilerim" ekranı (screens/match/MatchScreen.js) + gövdesi.
// Kabul: katılmamışken belge okunmaz; öneriler kartlarda; selam / gizle / engelle / şikâyet / çember callable'a
// opak kimlikle gider; karşılıklı selamda sohbet açılır; kartta puan değeri yok.
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, hairlineWidth: 1, absoluteFill: {} },
  View: "View",
  Text: "Text",
  ScrollView: "ScrollView",
  RefreshControl: "RefreshControl",
  TouchableOpacity: "Touch",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@components/AppIcon", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/common/GlassBox", () => ({ __esModule: true, default: "GlassBox" }));
jest.mock("../components/common/GlassTouchable", () => {
  const React = require("react");
  return { __esModule: true, default: ({ children, ...props }) => React.createElement("Touch", props, children) };
});
jest.mock("../components/common/UserAvatar", () => ({ __esModule: true, default: "Avatar" }));
jest.mock("../components/LensLoader", () => ({ __esModule: true, default: "Loader" }));
jest.mock("../components/challenges/ChallengeParts", () => ({ ChallengePoster: "Poster" }));
jest.mock("../components/moderation/ReportReasonSheet", () => ({ __esModule: true, default: "ReportSheet" }));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("@components/AppToast", () => ({ toast: mockToast }));
const mockAlert = jest.fn();
jest.mock("@components/AppAlert", () => ({ appAlert: (...a) => mockAlert(...a) }));
jest.mock("@context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("@context/ThemeContext", () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock("../context/UserProfileContext", () => ({ useUserProfile: () => ({ uid: "me" }) }));
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));

let mockFeature;
jest.mock("../hooks/useMatchFeature", () => ({ __esModule: true, default: () => mockFeature }));
jest.mock("../hooks/useMatchStrength", () => ({ __esModule: true, default: () => null }));
jest.mock("../hooks/useMatchTitles", () => ({
  __esModule: true,
  default: () => ({ movie_1: { name: "Monster", posterPath: "/m.jpg" }, movie_3: { name: "Ayrık Film", posterPath: null } }),
}));

let mockDoc;
const mockFetch = jest.fn();
const mockHello = jest.fn();
const mockAction = jest.fn();
const mockCircle = jest.fn();
jest.mock("../services/matchSuggestions", () => ({
  fetchMatchSuggestions: (...a) => {
    mockFetch(...a);
    return Promise.resolve(mockDoc);
  },
  sendMatchHello: (...a) => mockHello(...a),
  matchCandidateAction: (...a) => mockAction(...a),
  joinMatchCircle: (...a) => mockCircle(...a),
}));

jest.mock("../screens/tabs/settings/settingsUi", () => {
  const React = require("react");
  const host = (name) => ({ children, ...props }) => React.createElement(name, props, children);
  return {
    SettingsSubScreen: host("Screen"),
    buildUiColors: () => new Proxy({}, { get: (_t, key) => (typeof key === "string" ? "#123456" : undefined) }),
  };
});

const MatchScreen = require("../screens/match/MatchScreen").default;
const { MATCH_SCREEN_COPY } = require("../utils/matchScreenCopy");
const copy = MATCH_SCREEN_COPY.tr;

global.IS_REACT_ACT_ENVIRONMENT = true;
let renderer;

const texts = () =>
  renderer.root
    .findAll((n) => n.type === "Text")
    .flatMap((n) => [].concat(n.props.children))
    .filter((c) => typeof c === "string" || typeof c === "number")
    .map(String);
const pressables = (label) => renderer.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === "function");

const mount = async () => {
  await act(async () => {
    renderer = create(<MatchScreen />);
  });
};

const card = (cid, extra = {}) => ({ cid, verdict: "near", score: 84, displayName: `Ad ${cid.slice(-1)}`, avatarIndex: 1, photoURL: null, loved: ["movie_1"], split: "movie_3", implicitHeavy: false, greeted: false, sent: false, ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  mockFeature = { available: true, optedIn: true, lanes: ["movie"] };
  mockDoc = {
    v: 1,
    updatedAt: Date.UTC(2026, 10, 13, 1),
    lanes: {
      movie: {
        pool: 40,
        active: 37,
        inPool: true,
        twinsEnabled: false,
        items: [card("cid_aaaaaaaaa1", { verdict: "twin", score: 93, implicitHeavy: true }), card("cid_bbbbbbbbb2", { greeted: true })],
        circle: { key: "circlekey", size: 5, genres: ["drama"], joined: false, joinedCount: 2, groupId: null, groupReady: false },
      },
    },
  };
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
});

test("katılmamış: belge okunmaz, katıl çağrısı", async () => {
  mockFeature = { available: true, optedIn: false, lanes: [] };
  await mount();
  expect(mockFetch).not.toHaveBeenCalled();
  expect(texts()).toContain(copy.notJoined);
});

test("kapı kapalı: hiçbir şey okunmaz ve çizilmez", async () => {
  mockFeature = { available: false, optedIn: false, lanes: [] };
  await mount();
  expect(mockFetch).not.toHaveBeenCalled();
  expect(texts()).not.toContain(copy.notJoined);
});

test("kartlar: rozet, yüzde, ortak sevilen, ayrışılan (puansız), soğuk başlangıç, çember", async () => {
  await mount();
  expect(mockFetch).toHaveBeenCalledWith("me");
  const t = texts();
  expect(t).toContain(copy.verdict.twin);
  expect(t).toContain(copy.scoreLabel(93));
  expect(t).toContain(copy.implicit);
  expect(t).toContain("Monster");
  expect(t).toContain(`${copy.split}: Ayrık Film`);
  expect(t).toContain(copy.coldStart);
  expect(t).toContain(copy.poolCount(37));
  expect(t).toContain(copy.circle.title);
  expect(t).toContain(`👋 ${copy.greetedNote}`);
  // Kartta puan değeri yok (yalnız uyum yüzdesi).
  expect(t.join(" ")).not.toMatch(/★|\/10/);
});

test("selam: tek taraflı → gönderildi; karşılıklı → arkadaşlık ve sohbet", async () => {
  mockHello.mockResolvedValueOnce({ status: "sent" });
  await mount();
  await act(async () => pressables(copy.hello)[0].props.onPress());
  expect(mockHello).toHaveBeenCalledWith("cid_aaaaaaaaa1");
  expect(mockToast.success).toHaveBeenCalledWith(copy.helloSentToast);
  expect(texts()).toContain(copy.sent);

  mockHello.mockResolvedValueOnce({ status: "mutual", friendUid: "friend-uid", friendName: "Ad 2" });
  await act(async () => pressables(copy.replyHello)[0].props.onPress());
  expect(mockHello).toHaveBeenLastCalledWith("cid_bbbbbbbbb2");
  expect(mockToast.success).toHaveBeenLastCalledWith(copy.mutualToast("Ad 2"));
  await act(async () => pressables(copy.openChat)[0].props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith("ChatScreen", { friendUid: "friend-uid", friendName: "Ad 2" });
});

test("selam sınırı: hata metni", async () => {
  mockHello.mockRejectedValueOnce({ code: "functions/resource-exhausted" });
  await mount();
  await act(async () => pressables(copy.hello)[0].props.onPress());
  expect(mockToast.error).toHaveBeenCalledWith(copy.errors.limit);
});

test("menü: gizle adayı kaldırır; engelle onay ister; şikâyet sebep sayfası açar", async () => {
  jest.useFakeTimers();
  mockAction.mockResolvedValue({ status: "ok" });
  await mount();
  act(() => pressables(copy.more)[0].props.onPress());
  const buttons = mockAlert.mock.calls[0][2];
  expect(buttons.map((b) => b.text)).toEqual([copy.hide, copy.block, copy.report, copy.cancel]);
  await act(async () => buttons[0].onPress());
  expect(mockAction).toHaveBeenCalledWith("cid_aaaaaaaaa1", "hide", undefined);
  expect(texts()).not.toContain("Ad 1");

  act(() => pressables(copy.more)[0].props.onPress());
  const second = mockAlert.mock.calls[1][2];
  act(() => second[1].onPress());
  act(() => jest.advanceTimersByTime(300));
  const confirm = mockAlert.mock.calls[2];
  expect(confirm[0]).toBe(copy.blockTitle);
  await act(async () => confirm[2][1].onPress());
  expect(mockAction).toHaveBeenLastCalledWith("cid_bbbbbbbbb2", "block", undefined);
  jest.useRealTimers();
});

test("şikâyet: sebep seçilince callable'a gider", async () => {
  jest.useFakeTimers();
  mockAction.mockResolvedValue({ status: "ok" });
  await mount();
  act(() => pressables(copy.more)[0].props.onPress());
  act(() => mockAlert.mock.calls[0][2][2].onPress());
  act(() => jest.advanceTimersByTime(300));
  const sheet = renderer.root.find((n) => n.type === "ReportSheet");
  expect(sheet.props.visible).toBe(true);
  await act(async () => sheet.props.onSelect("spam"));
  expect(mockAction).toHaveBeenCalledWith("cid_aaaaaaaaa1", "report", "spam");
  expect(mockToast.success).toHaveBeenCalledWith(copy.done.report);
  jest.useRealTimers();
});

test("çember: katıl → bekleme; grup kurulunca sohbete gider", async () => {
  mockCircle.mockResolvedValueOnce({ status: "waiting", joined: 3, size: 5, groupId: null });
  await mount();
  await act(async () => pressables(copy.circle.join)[0].props.onPress());
  expect(mockCircle).toHaveBeenCalledWith("movie", copy.circle.groupName);
  expect(mockToast.success).toHaveBeenCalledWith(copy.circle.waiting);

  act(() => renderer.unmount());
  mockCircle.mockResolvedValueOnce({ status: "group", joined: 3, size: 5, groupId: "g1", created: true });
  await mount();
  await act(async () => pressables(copy.circle.join)[0].props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith("ChatScreen", { groupId: "g1", groupName: copy.circle.groupName });
});

test("ilk gece: belge yok → hazır değil metni", async () => {
  mockDoc = null;
  await mount();
  expect(texts()).toContain(copy.notReady);
});
