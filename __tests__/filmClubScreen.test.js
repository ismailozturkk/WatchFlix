// __tests__/filmClubScreen.test.js
//
// Film Kulübü ekranı (screens/club/FilmClubScreen) + GERÇEK çekirdek (utils/filmClub). Firestore servisi sahte:
// dinleyiciler verilen grup/turlarla hemen çağrılır, yazımlar kaydedilir.

import React from "react";
import { act, create } from "react-test-renderer";

// Afiş köşesi (Ayarlar > Poster görünümü) burada sınanmıyor: taban köşe aynen döner.
jest.mock("../hooks/usePosterCorner", () => () => (base) => base);
jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  ScrollView: "ScrollView",
  ActivityIndicator: "Spinner",
  PixelRatio: { get: () => 2 },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children, ...props }) => require("react").createElement("Gradient", props, children),
}));
const mockHost = (name) => ({ __esModule: true, default: ({ children, ...props }) => require("react").createElement(name, props, children) });
jest.mock("../components/AppIcon", () => mockHost("Icon"));
jest.mock("../components/common/GlassPressable", () => mockHost("GlassPressable"));
jest.mock("../components/common/GlassSegmentedControl", () => mockHost("Segments"));
jest.mock("../components/common/UserAvatar", () => mockHost("Avatar"));
jest.mock("../components/club/ClubCandidatePicker", () => ({
  __esModule: true,
  CLUB_ACCENT: "#E8A33D",
  default: (props) => require("react").createElement("Picker", props),
}));
const mockAlert = jest.fn();
jest.mock("../components/AppAlert", () => ({ appAlert: (...args) => mockAlert(...args) }));
const mockToastError = jest.fn();
jest.mock("../components/AppToast", () => ({ toast: { error: (...args) => mockToastError(...args) } }));
jest.mock("../screens/game/GameScreenShell", () => {
  const React = require("react");
  return {
    GameScreenShell: ({ title, subtitle, children }) => React.createElement("Shell", { title, subtitle }, children),
    gameSharedStyles: { primaryButton: {}, primaryButtonText: {}, sectionTitle: {}, metricRow: {}, metric: {}, metricValue: {}, metricLabel: {} },
  };
});
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
let mockStatusIndex = {};
jest.mock("../context/ListStatusContext", () => ({ useListStatusContext: () => ({ statusIndex: mockStatusIndex }) }));
jest.mock("../hooks/useClubSender", () => ({
  __esModule: true,
  default: () => ({ uid: "u1", name: "Ali", username: "ali", avatarIndex: 1, photoURL: null }),
}));
let mockAllows = true;
const mockCheck = jest.fn(() => mockAllows);
jest.mock("../hooks/usePremiumGate", () => ({
  usePremiumGate: () => ({ allows: () => mockAllows, check: (...args) => mockCheck(...args) }),
}));
const mockTrack = jest.fn();
jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: {
    FILM_CLUB_CREATED: "film_club_created",
    FILM_CLUB_ROUND_STARTED: "film_club_round_started",
    FILM_CLUB_PICKED: "film_club_picked",
    FILM_CLUB_FINISHED: "film_club_finished",
  },
  trackEvent: (...args) => mockTrack(...args),
}));

let mockGroup = null;
let mockRounds = [];
jest.mock("../services/groupsService", () => ({
  subscribeGroup: (_id, cb) => {
    cb(mockGroup);
    return () => {};
  },
}));
const mockService = {
  castClubVote: jest.fn(() => Promise.resolve()),
  closeClubVoting: jest.fn(() => Promise.resolve(null)),
  finishClubRound: jest.fn(() => Promise.resolve(null)),
  setClubRating: jest.fn(() => Promise.resolve()),
  setClubSettings: jest.fn(() => Promise.resolve()),
  setClubWatched: jest.fn(() => Promise.resolve()),
  startClubRound: jest.fn(() => Promise.resolve("r-new")),
};
jest.mock("../services/filmClubService", () => ({
  castClubVote: (...a) => mockService.castClubVote(...a),
  closeClubVoting: (...a) => mockService.closeClubVoting(...a),
  finishClubRound: (...a) => mockService.finishClubRound(...a),
  setClubRating: (...a) => mockService.setClubRating(...a),
  setClubSettings: (...a) => mockService.setClubSettings(...a),
  setClubWatched: (...a) => mockService.setClubWatched(...a),
  startClubRound: (...a) => mockService.startClubRound(...a),
  subscribeClubRounds: (_id, cb) => {
    cb(mockRounds);
    return () => {};
  },
}));

const FilmClubScreen = require("../screens/club/FilmClubScreen").default;

const HOUR = 60 * 60 * 1000;
const film = (id) => ({ id, media_type: "movie", title: `Film ${id}`, poster_path: null, release_date: "2020-01-01" });
const group = (extra = {}) => ({
  id: "g1",
  name: "Sinemacılar",
  members: ["u1", "u2", "u3"],
  memberInfo: { u1: { name: "Ali" }, u2: { name: "Banu" }, u3: { name: "Cem" } },
  admins: [],
  createdBy: "u1",
  club: { enabled: true, cadence: "weekly", updatedBy: "u1" },
  ...extra,
});
const voting = (extra = {}) => ({
  id: "r1",
  number: 1,
  status: "voting",
  cadence: "weekly",
  candidates: [film(1), film(2)],
  candidateIds: ["movie-1", "movie-2"],
  votes: {},
  voteEndsAt: { toMillis: () => Date.now() + 24 * HOUR },
  watched: {},
  ratings: {},
  commentCount: 0,
  ...extra,
});
const watching = (extra = {}) =>
  voting({
    status: "watching",
    pickId: "movie-2",
    pick: film(2),
    watchEndsAt: { toMillis: () => Date.now() + 72 * HOUR },
    ...extra,
  });

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
let tree;
const render = async (params = { groupId: "g1" }) => {
  await act(async () => {
    tree = create(<FilmClubScreen navigation={navigation} route={{ params }} />);
  });
  return tree.root;
};
const byTestId = (root, id) => root.find((node) => node.props.testID === id && typeof node.type === "string");
const queryTestId = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === "string");
const texts = (root) => root.findAllByType("Text").map((node) => [].concat(node.props.children).join(""));
const press = async (node) => {
  await act(async () => {
    await node.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGroup = group();
  mockRounds = [];
  mockAllows = true;
  mockStatusIndex = {};
});
afterEach(() => {
  act(() => tree?.unmount());
});

describe("kulüp kurulumu", () => {
  test("yönetici sıklık seçip kulübü kurar", async () => {
    mockGroup = group({ club: undefined });
    const root = await render();
    expect(texts(root)).toContain("Grubunla düzenli film gecesi");
    const segments = root.findByType("Segments");
    await act(async () => segments.props.onChange("monthly"));
    await press(byTestId(root, "club-setup"));
    expect(mockService.setClubSettings).toHaveBeenCalledWith("g1", { enabled: true, cadence: "monthly" }, "u1");
    expect(mockTrack).toHaveBeenCalledWith("film_club_created", { cadence: "monthly", members: 3 });
  });

  test("Free yönetici kuramaz: yükseltme sayfası açılır, yazım yok", async () => {
    mockGroup = group({ club: undefined });
    mockAllows = false;
    const root = await render();
    await press(byTestId(root, "club-setup"));
    expect(mockCheck).toHaveBeenCalled();
    expect(mockService.setClubSettings).not.toHaveBeenCalled();
  });

  test("üye kuramaz, bekleme notu görür", async () => {
    mockGroup = group({ club: undefined, createdBy: "u2" });
    const root = await render();
    expect(queryTestId(root, "club-setup")).toHaveLength(0);
    expect(texts(root)).toContain("Kulübü grubun kurucusu ya da bir yönetici kurabilir.");
  });
});

describe("tur", () => {
  test("açık tur yokken yönetici yeni tur açar; üye düğmeyi görmez", async () => {
    let root = await render();
    expect(queryTestId(root, "club-start-round")).toHaveLength(1);
    await press(byTestId(root, "club-start-round"));
    const picker = root.findByType("Picker");
    expect(picker.props.visible).toBe(true);
    let ok;
    await act(async () => {
      ok = await picker.props.onSubmit([film(5), film(6)]);
    });
    expect(ok).toBe(true);
    expect(mockService.startClubRound).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: "g1", number: 1, candidates: [film(5), film(6)] }),
    );
    act(() => tree.unmount());
    mockGroup = group({ createdBy: "u2" });
    root = await render();
    expect(queryTestId(root, "club-start-round")).toHaveLength(0);
  });

  test("oy verir; aynı adaya tekrar basınca geri çeker", async () => {
    mockRounds = [voting()];
    let root = await render();
    await press(byTestId(root, "club-vote-movie-2"));
    expect(mockService.castClubVote).toHaveBeenLastCalledWith("g1", "r1", "u1", "movie-2");
    act(() => tree.unmount());
    mockRounds = [voting({ votes: { u1: "movie-2" } })];
    root = await render();
    await press(byTestId(root, "club-vote-movie-2"));
    expect(mockService.castClubVote).toHaveBeenLastCalledWith("g1", "r1", "u1", null);
  });

  test("üye süre dolmadan oylamayı kapatamaz; süre dolunca ekran kendisi kapatır (bir kez)", async () => {
    mockGroup = group({ createdBy: "u2" });
    mockRounds = [voting()];
    let root = await render();
    expect(queryTestId(root, "club-close-voting")).toHaveLength(0);
    act(() => tree.unmount());
    mockRounds = [voting({ voteEndsAt: { toMillis: () => Date.now() - 1000 } })];
    root = await render();
    expect(mockService.closeClubVoting).toHaveBeenCalledTimes(1);
    expect(mockService.closeClubVoting.mock.calls[0][0]).toEqual(expect.objectContaining({ groupId: "g1", roundId: "r1" }));
  });

  test("izledim + puan; izlemeden tartışma kilitli", async () => {
    mockRounds = [watching()];
    let root = await render();
    expect(texts(root)).toContain("Filmi izleyince açılır");
    expect(texts(root)).toContain("Haftanın filmi");
    await press(byTestId(root, "club-watched"));
    expect(mockService.setClubWatched).toHaveBeenCalledWith("g1", "r1", "u1", true);
    expect(queryTestId(root, "club-rate-8")).toHaveLength(0);

    act(() => tree.unmount());
    mockRounds = [watching({ watched: { u1: 1, u2: 1 }, ratings: { u2: 6 }, commentCount: 3 })];
    root = await render();
    expect(texts(root)).toContain("2/3 kişi izledi");
    expect(texts(root)).toContain("3 mesaj");
    await press(byTestId(root, "club-rate-8"));
    expect(mockService.setClubRating).toHaveBeenCalledWith("g1", "r1", "u1", 8);
    await press(byTestId(root, "club-discussion"));
    expect(navigation.navigate).toHaveBeenCalledWith("FilmClubDiscussionScreen", { groupId: "g1", roundId: "r1" });
  });

  test("kütüphanede izlenmişse ipucu görünür", async () => {
    mockRounds = [watching()];
    mockStatusIndex = { movie: { 2: { isWatched: true } } };
    const root = await render();
    expect(texts(root)).toContain("Kütüphanende izlendi görünüyor");
  });

  test("yönetici turu bitirir; üye süre dolmadan bitiremez", async () => {
    mockRounds = [watching()];
    let root = await render();
    await press(byTestId(root, "club-finish"));
    expect(mockService.finishClubRound).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    mockGroup = group({ createdBy: "u2" });
    root = await render();
    expect(queryTestId(root, "club-finish")).toHaveLength(0);
  });
});

describe("arşiv ve ayarlar", () => {
  test("biten turlar istatistikle listelenir; sohbet kartından gelen tur seçili açılır", async () => {
    mockRounds = [
      watching({ id: "r2", number: 2 }),
      watching({ id: "r1", number: 1, status: "done", watched: { u1: 1, u2: 1 }, ratings: { u1: 9, u2: 3 } }),
    ];
    const root = await render({ groupId: "g1", roundId: "r1" });
    const all = texts(root);
    expect(all).toContain("Arşiv");
    expect(all).toContain("En çok ayrıştığınız");
    expect(all).toContain("6 puan fark");
    expect(all).toContain("Bitti");
  });

  test("kulübü kapatmak onay ister", async () => {
    const root = await render();
    await press(byTestId(root, "club-close"));
    expect(mockAlert).toHaveBeenCalledTimes(1);
    const confirm = mockAlert.mock.calls[0][2].find((button) => button.style === "destructive");
    await act(async () => confirm.onPress());
    expect(mockService.setClubSettings).toHaveBeenCalledWith("g1", { enabled: false, cadence: "weekly" }, "u1");
  });
});
