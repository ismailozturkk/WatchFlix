// __tests__/filmChainScreen.test.js
//
// Film Zinciri BAĞLANTISI: ekran (screens/game/FilmChainScreen) + durum makinesi (hooks/useFilmChain) + GERÇEK
// çekirdek ve GERÇEK depo (bellek-içi MMKV). TMDB servisi ve bulmaca listesi küçük bir sahte grafla taklit.
//
//   A(1) ─ F10 ─ X(3) ─ F11 ─ B(2)        (par 2)
//   A(1) ─ F12 ─ Y(4) ─ F13 ─ X(3) …      (daha uzun yol)

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => {
  const React = require("react");
  return {
    StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
    View: "View",
    Text: "Text",
    TextInput: "TextInput",
    ScrollView: "ScrollView",
    ActivityIndicator: "Spinner",
    PixelRatio: { get: () => 2 },
    Share: { share: (...args) => mockShare(...args) },
    FlatList: ({ data, renderItem, keyExtractor, ListEmptyComponent }) =>
      React.createElement(
        "List",
        null,
        data.length
          ? data.map((item, index) => React.createElement(React.Fragment, { key: keyExtractor(item, index) }, renderItem({ item, index })))
          : ListEmptyComponent,
      ),
  };
});
const mockShare = jest.fn(() => Promise.resolve({ action: "sharedAction" }));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: ({ children, ...props }) => require("react").createElement("Gradient", props, children) }));
let mockInset = 0;
let mockChainLocked = false;
jest.mock("../hooks/usePremiumScreenGuard", () => ({ __esModule: true, default: (id) => (id === "film_chain" ? mockChainLocked : false) }));
jest.mock("../hooks/useKeyboardInset", () => ({ __esModule: true, default: () => ({ inset: mockInset, onLayout: () => {} }) }));
jest.mock("../components/chat/ShareToChatSheet", () => ({ __esModule: true, default: (props) => require("react").createElement("ChatSheet", props) }));
const mockHost = (name) => ({ __esModule: true, default: ({ children, ...props }) => require("react").createElement(name, props, children) });
jest.mock("../components/AppIcon", () => mockHost("Icon"));
jest.mock("../components/common/GlassPressable", () => mockHost("GlassPressable"));
jest.mock("../components/common/GlassField", () => mockHost("GlassField"));
jest.mock("../components/common/GlassSegmentedControl", () => mockHost("Segments"));
jest.mock("../components/game/ui", () => {
  const React = require("react");
  return { PressableScale: ({ children, ...props }) => React.createElement("Scale", props, children) };
});
jest.mock("../screens/game/GameScreenShell", () => {
  const React = require("react");
  return {
    GameScreenShell: ({ title, subtitle, children }) => React.createElement("Shell", { title, subtitle }, children),
    gameSharedStyles: { primaryButton: {}, primaryButtonText: {} },
  };
});

const mockTrack = jest.fn();
jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: {
    FILM_CHAIN_STARTED: "film_chain_started",
    FILM_CHAIN_FINISHED: "film_chain_finished",
    FILM_CHAIN_SHARED: "film_chain_shared",
  },
  trackEvent: (...args) => mockTrack(...args),
}));

jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
let mockUser = { uid: "u1", displayName: "Ali" };
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("../context/AppSettingsContext", () => ({ useApiSettings: () => ({ API_KEY: "key" }) }));

const person = (id, name) => ({ kind: "person", id, name, profilePath: null });
const filmN = (id, title) => ({ kind: "film", id, title, year: 2000, posterPath: null });
jest.mock("../data/filmChainPuzzles", () => {
  const p = (id, name) => ({ kind: "person", id, name, profilePath: null });
  const f = (id, title) => ({ kind: "film", id, title, year: 2000, posterPath: null });
  return {
    FILM_CHAIN_PUZZLES: [
      { id: "1-2", start: p(1, "Ayşe"), target: p(2, "Burak"), par: 2, solution: [p(1, "Ayşe"), f(10, "On"), p(3, "Xenon"), f(11, "Onbir"), p(2, "Burak")] },
      { id: "5-6", start: p(5, "Cem"), target: p(6, "Deniz"), par: 2, solution: [p(5, "Cem"), f(20, "Yirmi"), p(7, "Ece"), f(21, "Yirmibir"), p(6, "Deniz")] },
    ],
  };
});

const FILMS = {
  1: [{ id: 10, title: "On", year: 2001 }, { id: 12, title: "Oniki", year: 2003 }],
  3: [{ id: 10, title: "On", year: 2001 }, { id: 11, title: "Onbir", year: 2002 }, { id: 13, title: "Onüç", year: 2004 }],
  4: [{ id: 12, title: "Oniki", year: 2003 }, { id: 13, title: "Onüç", year: 2004 }],
  5: [{ id: 20, title: "Yirmi", year: 2010 }],
};
const CAST = {
  10: [{ id: 1, name: "Ayşe" }, { id: 3, name: "Xenon", character: "Kaptan" }],
  11: [{ id: 3, name: "Xenon" }, { id: 2, name: "Burak" }],
  12: [{ id: 1, name: "Ayşe" }, { id: 4, name: "Yusuf" }],
  13: [{ id: 4, name: "Yusuf" }, { id: 3, name: "Xenon" }],
  20: [{ id: 5, name: "Cem" }, { id: 7, name: "Ece" }],
};
const mockFilms = jest.fn(({ personId }) => Promise.resolve(FILMS[personId] || []));
const mockCast = jest.fn(({ movieId }) => Promise.resolve(CAST[movieId] || []));
jest.mock("../services/filmChainService", () => ({
  fetchChainFilms: (...args) => mockFilms(...args),
  fetchChainCast: (...args) => mockCast(...args),
}));

const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const FilmChainScreen = require("../screens/game/FilmChainScreen").default;
const { FILM_CHAIN_COPY } = require("../utils/filmChainCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;
const copy = FILM_CHAIN_COPY.tr;
let renderer;
let errorSpy;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-30T12:00:00Z")); // günlük #1 → "1-2"
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  mockTrack.mockClear();
  mockShare.mockClear();
  mockFilms.mockClear();
  mockCast.mockClear();
  mockInset = 0;
  mockChainLocked = false;
  mockUser = { uid: "u1", displayName: "Ali" };
  const original = console.error;
  errorSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  errorSpy.mockRestore();
  jest.useRealTimers();
});

const navigation = { goBack: jest.fn() };
const mount = async (params = {}) => {
  await act(async () => {
    renderer = create(<FilmChainScreen navigation={navigation} route={{ params }} />);
  });
};
const flush = () => act(async () => {});
const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).filter((c) => typeof c === "string" || typeof c === "number").join(""));
const has = (value) => texts().includes(value);
const rows = () => renderer.root.findAllByType("Scale").filter((n) => n.props.accessibilityLabel && n.props.accessibilityLabel !== copy.share);
const rowLabels = () => rows().map((n) => n.props.accessibilityLabel);
const choose = async (label) => {
  const row = rows().find((n) => n.props.accessibilityLabel === label || n.props.accessibilityLabel.startsWith(`${label},`));
  if (!row) throw new Error(`satır yok: ${label} (var: ${rowLabels().join(" | ")})`);
  await act(async () => row.props.onPress());
};
const button = (label) =>
  renderer.root.findAllByType("GlassPressable").find((n) => n.findAllByType("Text").some((t) => [].concat(t.props.children).join("") === label));
const press = (label) => act(async () => button(label).props.onPress());
const stored = () => get(Keys.filmChain, { uid: "u1" });

describe("günlük", () => {
  test("açılış: günlük #1, başlangıç/hedef, par ve başlangıcın filmleri", async () => {
    await mount();
    expect(renderer.root.findByType("Shell").props.subtitle).toBe(copy.dailyNumber(1));
    expect(has("Ayşe")).toBe(true);
    expect(has("Burak")).toBe(true);
    expect(has(copy.parLabel(2))).toBe(true);
    expect(has(copy.pickFilmTitle)).toBe(true);
    expect(mockFilms).toHaveBeenCalledWith({ apiKey: "key", language: "tr", personId: 1 });
    expect(rowLabels()).toEqual(["On, 2001", "Oniki, 2003"]);
    expect(mockTrack).toHaveBeenCalledWith("film_chain_started", { mode: "daily", number: 1, par: 2 });
  });

  test("en kısa zinciri kurmak: 100 puan, kusursuz, kayıt ve ölçüm", async () => {
    await mount();
    await choose("On");
    expect(has(copy.pickPersonTitle)).toBe(true);
    // Başlangıç oyuncusu zincirde: kadroda tekrar seçilemez.
    expect(rowLabels()).toEqual(["Xenon"]);
    expect(has(copy.asCharacter("Kaptan"))).toBe(true);
    await choose("Xenon");
    expect(rowLabels()).toEqual(["Onbir, 2002", "Onüç, 2004"]); // "On" kullanıldı
    await choose("Onbir");
    await choose("Burak");
    expect(has(copy.solvedTitle.toUpperCase())).toBe(true);
    expect(has("100")).toBe(true);
    expect(has(copy.perfect)).toBe(true);
    expect(has(copy.streak(1))).toBe(true);
    expect(stored()).toMatchObject({ plays: 1, solved: 1, perfect: 1, days: { "2026-10-30": { puzzleId: "1-2", links: 2, points: 100 } } });
    expect(mockTrack).toHaveBeenCalledWith("film_chain_finished", { mode: "daily", number: 1, par: 2, links: 2, gave_up: false, points: 100 });
  });

  test("geri al son halkayı siler; uzun yol daha az puan", async () => {
    await mount();
    await choose("Oniki");
    await choose("Yusuf");
    await press(copy.undo);
    expect(has(copy.pickPersonTitle)).toBe(true);
    expect(rowLabels()).toEqual(["Yusuf"]);
    await choose("Yusuf");
    await choose("Onüç");
    await choose("Xenon");
    await choose("Onbir");
    await choose("Burak");
    expect(has("75")).toBe(true);
    expect(has(copy.overPar(1))).toBe(true);
    expect(stored().perfect).toBe(0);
  });

  test("arama listeyi süzer, eşleşme yoksa boş metni", async () => {
    await mount();
    const input = renderer.root.findByType("TextInput");
    await act(async () => input.props.onChangeText("onik"));
    expect(rowLabels()).toEqual(["Oniki, 2003"]);
    await act(async () => input.props.onChangeText("zzz"));
    expect(has(copy.noMatches)).toBe(true);
  });

  test("pes et: 0 puan, en kısa zincir gösterilir, günlük kapanır; yeniden açılışta sonuç", async () => {
    await mount();
    await press(copy.giveUp);
    expect(has(copy.gaveUpTitle.toUpperCase())).toBe(true);
    expect(has("0")).toBe(true);
    expect(has(copy.ourChain(2))).toBe(true);
    expect(has("Xenon")).toBe(true); // çözüm zinciri
    expect(stored()).toMatchObject({ gaveUp: 1, days: { "2026-10-30": { gaveUp: true } } });
    act(() => renderer.unmount());
    mockTrack.mockClear();
    await mount();
    expect(has(copy.gaveUpTitle.toUpperCase())).toBe(true);
    expect(mockTrack).not.toHaveBeenCalledWith("film_chain_started", expect.anything()); // sonuçla açılış sayılmaz
  });

  test("paylaş: emoji özet sistem sayfasına", async () => {
    await mount();
    await choose("On");
    await choose("Xenon");
    await choose("Onbir");
    await choose("Burak");
    await press(copy.share);
    expect(mockShare).toHaveBeenCalledWith({ message: "Seelogd Film Zinciri #1\nAyşe → Burak\n🎬🎬 2 film · en kısa 2\n⭐⭐⭐" });
    expect(mockTrack).toHaveBeenCalledWith("film_chain_shared", { mode: "daily", number: 1, target: "out" });
  });

  test("liste yüklenemezse hata; tekrar dene yeniden ister", async () => {
    mockFilms.mockImplementationOnce(() => Promise.reject(new Error("ağ")));
    await mount();
    expect(has(copy.errorTitle)).toBe(true);
    await press(copy.retry);
    await flush();
    expect(rowLabels()).toEqual(["On, 2001", "Oniki, 2003"]);
  });
});

describe("serbest", () => {
  test("günlükten farklı bulmaca; çözünce 'Yeni zincir'; günlük kaydı yazılmaz", async () => {
    await mount({ mode: "free" });
    expect(renderer.root.findByType("Shell").props.subtitle).toBe(copy.freeMode);
    expect(has("Cem")).toBe(true); // tek diğer bulmaca
    await choose("Yirmi");
    await choose("Ece");
    expect(mockCast).toHaveBeenCalledWith({ apiKey: "key", language: "tr", movieId: 20 });
    await press(copy.giveUp);
    expect(stored().days).toEqual({});
    expect(button(copy.newPuzzle)).toBeTruthy();
    await press(copy.newPuzzle);
    expect(has(copy.pickFilmTitle)).toBe(true);
  });

  test("günlük sonuçtan 'Serbest modda oyna' moda geçirir", async () => {
    await mount();
    await press(copy.giveUp);
    await press(copy.playFree);
    expect(renderer.root.findByType("Shell").props.subtitle).toBe(copy.freeMode);
    expect(has(copy.pickFilmTitle)).toBe(true);
  });
});

describe("Premium kapısı", () => {
  test("kilitliyken oyun kurulmaz: TMDB isteği yok, ölçüm yok, yalnız boş kabuk", async () => {
    mockChainLocked = true;
    await mount();
    expect(mockFilms).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
    expect(renderer.root.findByType("Shell").props.title).toBe(copy.title);
    expect(rowLabels()).toEqual([]);
  });

  test("ekran kendi kapısını kullanır (registry film_chain)", () => {
    const src = require("fs").readFileSync(require("path").join(__dirname, "../screens/game/FilmChainScreen.js"), "utf8");
    expect(src).toMatch(/usePremiumScreenGuard\("film_chain", navigation\)/);
  });
});

describe("klavye", () => {
  test("klavye açıkken pano alttan klavye kadar boşluk alır, üst kart tek satıra iner, liste kalır", async () => {
    mockInset = 280;
    await mount();
    const board = renderer.root.findAll((n) => n.type === "View" && n.props.onLayout)[0];
    expect([].concat(board.props.style).find((st) => st && st.paddingBottom !== undefined).paddingBottom).toBe(280);
    expect(renderer.root.findAllByType("Segments")).toHaveLength(0); // mod anahtarı gizli
    expect(has(copy.parLabel(2))).toBe(false); // büyük kart yerine…
    expect(has("0/2")).toBe(true); // …tek satır: film sayısı / en kısa
    expect(has(copy.pickFilmTitle)).toBe(false);
    expect(button(copy.giveUp)).toBeUndefined();
    expect(rowLabels()).toEqual(["On, 2001", "Oniki, 2003"]); // seçim hâlâ yapılabilir
  });

  test("klavye kapalıyken tam düzen, boşluk yok", async () => {
    await mount();
    expect(renderer.root.findAllByType("Segments")).toHaveLength(1);
    expect(has(copy.parLabel(2))).toBe(true);
  });
});

describe("arkadaşa meydan okuma", () => {
  const solve = async () => {
    await choose("On");
    await choose("Xenon");
    await choose("Onbir");
    await choose("Burak");
  };

  test("oynarken gönderilecek bir şey yok; bitince sayfa açılır ve gövde SPOILER taşımaz", async () => {
    await mount();
    expect(renderer.root.findByType("ChatSheet").props.share).toBeNull();
    await solve();
    expect(has(copy.challengeHint)).toBe(true);
    const send = renderer.root.findAllByType("Scale").find((n) => n.props.accessibilityLabel === copy.challengeFriend);
    await act(async () => send.props.onPress());
    const sheet = renderer.root.findByType("ChatSheet");
    expect(sheet.props.visible).toBe(true);
    expect(sheet.props.share).toMatchObject({
      type: "chain", puzzleId: "1-2", mode: "daily", number: 1, dayKey: "2026-10-30",
      par: 2, links: 2, points: 100, gaveUp: false, host: "Ali",
      start: { id: 1, name: "Ayşe" }, target: { id: 2, name: "Burak" },
    });
    const body = JSON.stringify(sheet.props.share);
    ["Xenon", "Onbir", '"id":3', '"id":10', '"id":11'].forEach((leak) => expect(body).not.toContain(leak));
    await act(async () => sheet.props.onSent());
    expect(mockTrack).toHaveBeenCalledWith("film_chain_shared", { mode: "daily", number: 1, target: "chat" });
  });

  test("pes edilen sonuç da gönderilebilir (0 puan); oturum yoksa düğme yok", async () => {
    await mount();
    await press(copy.giveUp);
    expect(renderer.root.findByType("ChatSheet").props.share).toMatchObject({ gaveUp: true, links: 0, points: 0 });
    act(() => renderer.unmount());
    renderer = null;
    __resetStores();
    __resetAllMMKV();
    __resetStoreCaches();
    mockUser = null;
    await mount();
    await press(copy.giveUp);
    expect(renderer.root.findAllByType("Scale").some((n) => n.props.accessibilityLabel === copy.challengeFriend)).toBe(false);
  });

  test("karttan gelen puzzleId o bulmacayı serbest modda açar; sonuç bulmaca başına kaydedilir", async () => {
    await mount({ mode: "free", puzzleId: "1-2" });
    expect(renderer.root.findByType("Shell").props.subtitle).toBe(copy.freeMode);
    expect(has("Ayşe")).toBe(true);
    await solve();
    expect(stored().results).toEqual({ "1-2": { links: 2, points: 100, gaveUp: false } });
    expect(stored().days).toEqual({});
    expect(renderer.root.findByType("ChatSheet").props.share).toMatchObject({ mode: "free", puzzleId: "1-2" });
    expect(renderer.root.findByType("ChatSheet").props.share.number).toBeUndefined();
  });

  test("bilinmeyen puzzleId rastgele bulmacaya düşer", async () => {
    await mount({ puzzleId: "999-998" });
    expect(renderer.root.findByType("Shell").props.subtitle).toBe(copy.freeMode);
    expect(has(copy.pickFilmTitle)).toBe(true);
  });
});

test("yardımcılar kullanılmadan kalmasın", () => {
  expect(person(1, "a").kind).toBe("person");
  expect(filmN(1, "a").kind).toBe("film");
});
