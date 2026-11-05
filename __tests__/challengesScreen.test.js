// __tests__/challengesScreen.test.js
//
// Meydan Okumalar'ın BAĞLANTISI: Eğlence kartı + ekran + ayrıntı sayfası + profil madalya satırı + useWatchChallenges,
// GERÇEK depo (bellek-içi MMKV) ve gerçek çekirdekle (utils/watchChallenges.js). İzleme verisi ProfileStatsContext
// taklidinden gelir; görsel parçalar (cam düğme, alt sayfa, ekran kabuğu) taklit edilip props'ları tetiklenir.

import React from "react";
import { act, create } from "react-test-renderer";

// Afiş köşesi (Ayarlar > Poster görünümü) burada sınanmıyor: taban köşe aynen döner.
jest.mock("../hooks/usePosterCorner", () => () => (base) => base);
jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  ScrollView: "ScrollView",
  TextInput: "TextInput",
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  AppState: { addEventListener: () => ({ remove: () => {} }) },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
const mockHost = (name) => ({
  __esModule: true,
  default: ({ children, ...props }) => require("react").createElement(name, props, children),
});
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }) => require("react").createElement("Gradient", null, children),
}));
jest.mock("../components/AppIcon", () => mockHost("Icon"));
jest.mock("../components/common/GlassTouchable", () => mockHost("Touch"));
jest.mock("../components/common/GlassCloseButton", () => mockHost("Close"));
jest.mock("../components/common/SheetScroll", () => mockHost("SheetScroll"));
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children, ...props }) =>
    require("react").createElement("Sheet", { visible, ...props }, visible ? children : null),
}));
jest.mock("../components/hub/HubCard", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children, onPress }) => React.createElement("Card", { onPress }, children),
    GlassPill: ({ text }) => React.createElement("Text", null, text),
    HubArrow: () => null,
  };
});
jest.mock("../screens/game/GameScreenShell", () => ({
  GameScreenShell: ({ title, children }) => require("react").createElement("Shell", { title }, children),
}));
jest.mock("../services/hapticsService", () => ({
  triggerHaptic: () => {},
  notificationAsync: () => Promise.resolve(),
  NotificationFeedbackType: { Success: "success" },
}));
const mockToast = jest.fn();
jest.mock("../components/AppToast", () => ({ toast: { success: (...a) => mockToast(...a) } }));
const mockNavigateRoot = jest.fn();
jest.mock("../services/rootNavigation", () => ({ navigateRoot: (...a) => mockNavigateRoot(...a) }));
const mockFetchMeta = jest.fn();
const mockFetchTitles = jest.fn();
jest.mock("../services/watchChallengeMeta", () => ({
  cachedChallengeMeta: () => ({}),
  fetchChallengeMeta: (...a) => mockFetchMeta(...a),
  fetchPersonTitles: (...a) => mockFetchTitles(...a),
}));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
jest.mock("../context/AppSettingsContext", () => ({
  useApiSettings: () => ({ API_KEY: "k" }),
  useImageQualitySettings: () => ({ getTmdbUrl: (p) => `img${p}` }),
}));
jest.mock("../context/PosterChoicesContext", () => ({ usePosterResolver: () => (type, id, path) => path }));
let mockMovies = [];
jest.mock("../context/ProfileStatsContext", () => ({
  useProfileStats: () => ({ movieHistoryItems: mockMovies, flatEpisodesTv: [] }),
}));
jest.mock("../context/ListStatusContext", () => ({
  useListStatusContext: () => ({ loading: false, watchedTvLoaded: true }),
}));

const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get, set } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const ChallengesScreen = require("../screens/fun/ChallengesScreen").default;
const ChallengesWidget = require("../components/hub/ChallengesWidget").default;
const ChallengeMedalsRow = require("../components/challenges/ChallengeMedalsRow").default;
const { getWatchChallengesCopy } = require("../utils/watchChallengesCopy");
const { getChallenge } = require("../utils/watchChallenges");

global.IS_REACT_ACT_ENVIRONMENT = true;
const copy = getWatchChallengesCopy("tr");
const film = (id, dateAdded, extra = {}) => ({ id, type: "movie", name: `Film ${id}`, imagePath: `/p${id}.jpg`, dateAdded, ...extra });

let renderer;
let errSpy;
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 30, 12, 0, 0)); // 30 Ekim 2026, yerel
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  mockToast.mockClear();
  mockNavigateRoot.mockClear();
  mockFetchMeta.mockReset().mockResolvedValue({});
  mockFetchTitles.mockReset().mockResolvedValue({});
  mockMovies = [];
  const original = console.error;
  errSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  errSpy.mockRestore();
  jest.useRealTimers();
});

const flush = async () => {
  for (let i = 0; i < 4; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await Promise.resolve(); });
  }
};
const navigation = () => ({ navigate: jest.fn(), goBack: jest.fn() });
const mount = async (element) => {
  act(() => { renderer = create(element); });
  await flush();
};
const textOf = (n) => [].concat(n.props.children).join("");
const texts = () => renderer.root.findAllByType("Text").map(textOf);
const touchByLabel = (label) => renderer.root.findAllByType("Touch").find((n) => n.props.accessibilityLabel === label);
const touchWithText = (label) =>
  renderer.root.findAllByType("Touch").find((n) => n.findAllByType("Text").some((t) => textOf(t) === label));
const sheet = () => renderer.root.findByType("Sheet");
const press = async (node) => {
  act(() => node.props.onPress());
  await flush();
};
const runs = () => get(Keys.watchChallenges, { uid: "u1" })?.runs || [];

test("Eğlence kartı: görev yokken davet, dokununca ekran", async () => {
  const nav = navigation();
  await mount(<ChallengesWidget navigation={nav} />);
  expect(texts()).toEqual(expect.arrayContaining([copy.widgetTitle, copy.open, copy.eyebrow]));
  act(() => renderer.root.findByType("Card").props.onPress());
  expect(nav.navigate).toHaveBeenCalledWith("ChallengesScreen");
});

test("katıl → süren görev kartı; katılımdan önceki izleme sayılmaz", async () => {
  mockMovies = [film(1, "2026-10-29"), film(2, "2026-10-30"), film(3, "2026-10-30")];
  await mount(<ChallengesScreen navigation={navigation()} route={{}} />);
  expect(texts()).toContain(copy.noActive);

  await press(touchByLabel(copy.titles.films10_30));
  expect(sheet().props.visible).toBe(true);
  await press(touchWithText(copy.join));

  expect(runs()).toEqual([{ id: "films10_30", joinedAt: "2026-10-30", status: "active" }]);
  expect(touchByLabel(`${copy.titles.films10_30}, 2/10`)).toBeTruthy();
  expect(texts()).not.toContain(copy.noActive);
});

test("hedefe ulaşan görev tamamlanır: kutlama tek kez, madalya ekranda ve profilde", async () => {
  mockMovies = Array.from({ length: 10 }, (_, i) => film(i + 1, "2026-10-30"));
  await mount(<ChallengesScreen navigation={navigation()} route={{}} />);
  await press(touchByLabel(copy.titles.films10_30));
  await press(touchWithText(copy.join));

  expect(runs()[0]).toMatchObject({ id: "films10_30", status: "done", endedAt: "2026-10-30", count: 10, target: 10 });
  expect(mockToast).toHaveBeenCalledTimes(1);
  expect(mockToast.mock.calls[0][0]).toBe(copy.doneToastTitle);
  mockToast.mock.calls[0][2].onPress();
  expect(mockNavigateRoot).toHaveBeenCalledWith("ChallengesScreen", { openId: "films10_30" });
  expect(texts()).toContain("30 Ekim 2026"); // madalya tarihi
  act(() => renderer.unmount());

  // İkinci açılış kutlamayı yinelemez; profil satırı madalyayı gösterir.
  const onPress = jest.fn();
  await mount(<ChallengeMedalsRow onPress={onPress} />);
  expect(mockToast).toHaveBeenCalledTimes(1);
  const row = touchByLabel(copy.medalsA11y(1));
  expect(row).toBeTruthy();
  act(() => row.props.onPress());
  expect(onPress).toHaveBeenCalled();
});

test("profil satırı madalya yokken hiç çizilmez", async () => {
  await mount(<ChallengeMedalsRow onPress={() => {}} />);
  expect(renderer.toJSON()).toBeNull();
});

test("yönetmen kartı katılmadan izlenen sayıyı gösterir; sayfa tüm filmografiyi çizer", async () => {
  const nolan = getChallenge("director_525");
  mockMovies = [film(nolan.films[0].id, "2015-05-01"), film(nolan.films[1].id, "2020-01-01")];
  await mount(<ChallengesScreen navigation={navigation()} route={{}} />);
  const card = touchByLabel(`${copy.titleOf(nolan)}, 2/${nolan.target}`);
  expect(card).toBeTruthy();
  await press(card);
  const posters = sheet().findAllByType("Touch").filter((n) => /\(\d{4}\)/.test(n.props.accessibilityLabel || ""));
  expect(posters).toHaveLength(nolan.target);
  expect(texts()).toContain(copy.previewNote(2));
});

test("bırak iki adımlı: önce onay, sonra kayıttan silinir", async () => {
  set(Keys.watchChallenges, { runs: [{ id: "long5", joinedAt: "2026-10-30", status: "active" }] }, { uid: "u1" });
  await mount(<ChallengesScreen navigation={navigation()} route={{ params: { openId: "long5" } }} />);
  expect(sheet().props.visible).toBe(true);
  await press(touchWithText(copy.leave));
  expect(texts()).toContain(copy.leaveTitle);
  expect(runs()).toHaveLength(1);
  const confirm = sheet().findAllByType("Touch").filter((n) => n.findAllByType("Text").some((t) => textOf(t) === copy.leave)).pop();
  await press(confirm);
  expect(runs()).toEqual([]);
  expect(sheet().props.visible).toBe(false);
});

test("Ekim'de mevsimlik görev listelenir, Kasım'da listelenmez", async () => {
  await mount(<ChallengesScreen navigation={navigation()} route={{}} />);
  expect(touchByLabel(copy.titles.oct_horror)).toBeTruthy();
  act(() => renderer.unmount());
  jest.setSystemTime(new Date(2026, 10, 2, 12, 0, 0));
  await mount(<ChallengesScreen navigation={navigation()} route={{}} />);
  expect(touchByLabel(copy.titles.oct_horror)).toBeUndefined();
});

test("on yıl görevi film ayrıntısını yalnız penceredeki filmler için ister", async () => {
  mockMovies = [film(11, "2026-10-30"), film(12, "2026-09-01")];
  mockFetchMeta.mockResolvedValue({ 11: { year: 1994, country: "US" } });
  set(Keys.watchChallenges, { runs: [{ id: "decades", joinedAt: "2026-10-30", status: "active" }] }, { uid: "u1" });
  await mount(<ChallengesScreen navigation={navigation()} route={{}} />);
  expect(mockFetchMeta).toHaveBeenCalledTimes(1);
  expect(mockFetchMeta.mock.calls[0][0].ids).toEqual(["11"]);
  expect(touchByLabel(`${copy.titles.decades}, 1/8`)).toBeTruthy();
});

test("yönetmen filmleri seçili dilde; çevirisi olmayan İngilizce kalır", async () => {
  const ceylan = getChallenge("director_56214");
  const [first, second] = ceylan.films;
  mockFetchTitles.mockResolvedValue({ [first.id]: "Kasaba" });
  await mount(<ChallengesScreen navigation={navigation()} route={{ params: { openId: "director_56214" } }} />);
  expect(mockFetchTitles).toHaveBeenCalledWith({ personId: 56214, role: "director", apiKey: "k", language: "tr" });
  expect(texts()).toContain("Kasaba");
  expect(texts()).not.toContain(first.title);
  expect(texts()).toContain(second.title);
});

test("üst şerit: süren / madalya / katalog sayısı", async () => {
  set(Keys.watchChallenges, { runs: [{ id: "long5", joinedAt: "2026-10-30", status: "active" }] }, { uid: "u1" });
  await mount(<ChallengesScreen navigation={navigation()} route={{}} />);
  const { MAX_ACTIVE_CHALLENGES } = require("../utils/watchChallenges");
  expect(texts()).toEqual(expect.arrayContaining([`1/${MAX_ACTIVE_CHALLENGES}`, copy.statActive, copy.statMedals, copy.statCatalog]));
});

test("grup süzgeci: seçilen grup dışındakiler gizlenir, Tümü geri getirir", async () => {
  await mount(<ChallengesScreen navigation={navigation()} route={{}} />);
  expect(touchByLabel(copy.titles.films10_30)).toBeTruthy();
  expect(touchByLabel(copy.titles.turkish10)).toBeTruthy();
  await press(touchByLabel(copy.groups.world));
  expect(touchByLabel(copy.titles.turkish10)).toBeTruthy();
  expect(touchByLabel(copy.titles.films10_30)).toBeUndefined();
  expect(texts()).toContain(copy.groupSubs.world);
  await press(touchByLabel(copy.filterAll));
  expect(touchByLabel(copy.titles.films10_30)).toBeTruthy();
});

test("katılmadan sayılacaklar döşemede 'hazır' olarak görünür (bu ayın görevi)", async () => {
  // 2 Kasım: Kasım gerilim görevi; ayın başındaki gerilim filmi sayılır.
  jest.setSystemTime(new Date(2026, 10, 2, 12, 0, 0));
  mockMovies = [film(1, "2026-11-01", { genres: ["Gerilim"] })];
  await mount(<ChallengesScreen navigation={navigation()} route={{}} />);
  expect(touchByLabel(copy.titles.nov_thriller)).toBeTruthy();
  expect(texts()).toContain(copy.ready(1));
});

test("kişi bölümü: ray ilk 12 kişi, 'Tümünü gör' ızgara + arama, Türk sineması süzgeci", async () => {
  const { CHALLENGES } = require("../utils/watchChallenges");
  const directors = CHALLENGES.filter((c) => c.group === "directors");
  const demirkubuz = directors.find((c) => c.person.name === "Zeki Demirkubuz");
  const label = (c) => `${copy.titleOf(c)}, 0/${c.target}`;
  await mount(<ChallengesScreen navigation={navigation()} route={{}} />);
  await press(touchByLabel(copy.groups.directors));
  // Kapalı ray: ilk 12 kişi (Demirkubuz 11.) + "Tümünü gör" kartı; listenin sonu rayda yok.
  const last = directors[directors.length - 1];
  expect(touchByLabel(label(demirkubuz))).toBeTruthy();
  expect(touchByLabel(label(last))).toBeUndefined();
  await press(touchByLabel(copy.seeAll(directors.length)));
  expect(touchByLabel(label(last))).toBeTruthy();

  const input = renderer.root.findByType("TextInput");
  act(() => input.props.onChangeText("demirkub"));
  await flush();
  const people = renderer.root.findAllByType("Touch").filter((n) => /, \d+\/\d+$/.test(n.props.accessibilityLabel || ""));
  expect(people.map((n) => n.props.accessibilityLabel)).toEqual([label(demirkubuz)]);

  act(() => input.props.onChangeText(""));
  await flush();
  await press(touchWithText(copy.peopleTr));
  const shown = renderer.root
    .findAllByType("Touch")
    .filter((n) => /, \d+\/\d+$/.test(n.props.accessibilityLabel || ""))
    .map((n) => n.props.accessibilityLabel);
  const trLabels = directors.filter((c) => c.person.tr).map(label);
  expect(shown.sort()).toEqual([...trLabels].sort());
});

test("başladığın kişi rayda öne geçer", async () => {
  const { CHALLENGES } = require("../utils/watchChallenges");
  const atif = CHALLENGES.find((c) => c.person?.name === "Atıf Yılmaz");
  mockMovies = [film(atif.films[0].id, "2001-01-01")];
  await mount(<ChallengesScreen navigation={navigation()} route={{}} />);
  await press(touchByLabel(copy.groups.directors));
  const first = renderer.root.findAllByType("Touch").find((n) => /, \d+\/\d+$/.test(n.props.accessibilityLabel || ""));
  expect(first.props.accessibilityLabel).toBe(`${copy.titleOf(atif)}, 1/${atif.target}`);
});

test("oyuncu görevi: başrol filmografisi sayfası, başlıklar oyuncu kadrosundan istenir", async () => {
  const { CHALLENGES } = require("../utils/watchChallenges");
  const aamir = CHALLENGES.find((c) => c.person?.name === "Aamir Khan");
  mockMovies = [film(aamir.films[0].id, "2015-05-01")];
  await mount(<ChallengesScreen navigation={navigation()} route={{ params: { openId: aamir.id } }} />);
  expect(mockFetchTitles).toHaveBeenCalledWith({ personId: aamir.person.id, role: "actor", apiKey: "k", language: "tr" });
  expect(texts()).toContain(copy.titleOf(aamir));
  expect(copy.titleOf(aamir)).toBe("Aamir Khan maratonu");
  const posters = sheet().findAllByType("Touch").filter((n) => /\(\d{4}\)/.test(n.props.accessibilityLabel || ""));
  expect(posters).toHaveLength(aamir.target);
  expect(texts()).toContain(copy.previewNote(1));
  await press(touchWithText(copy.join));
  expect(runs()).toEqual([{ id: aamir.id, joinedAt: "2026-10-30", status: "active" }]);
});
