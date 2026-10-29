// __tests__/cinemaBingoScreen.test.js
//
// Sinema Bingosu'nun BAĞLANTISI: Eğlence'deki kart + tam sayfa + useCinemaBingo kancası, GERÇEK depoyla
// (bellek-içi MMKV) ve GERÇEK çekirdekle. Görsel parçalar (kart kabuğu, cam düğme, simgeler, ekran kabuğu)
// ana makinede çizilemediği için taklit edilir; props'ları doğrudan okunup tetiklenir.
//
// Sabit "bugün": 21 Ekim 2026 Çarşamba → hafta 19–25 Ekim. Veri: `kalabalik()` her kareyi doldurur,
// `az()` yalnız bir film içerir.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  Share: { share: jest.fn(() => Promise.resolve({ action: "sharedAction" })) },
  AppState: { addEventListener: () => ({ remove: () => {} }) },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
const mockHost = (name) => ({ __esModule: true, default: ({ children, ...props }) => require("react").createElement(name, props, children) });
jest.mock("../components/AppIcon", () => mockHost("Icon"));
jest.mock("../components/common/GlassPressable", () => mockHost("GlassPressable"));
jest.mock("../components/badges/WatchBadgeCard", () => mockHost("WatchBadgeCard"));
// Kart kabuğu: onPress'i taşır, çocukları çizer. Yapı taşları yalnız metni/simgeyi gösterir.
jest.mock("../components/hub/HubCard", () => {
  const React = require("react");
  const Card = ({ children, onPress, ...props }) => React.createElement("Card", { ...props, onPress }, children);
  return {
    __esModule: true,
    default: Card,
    GlassPill: ({ text }) => React.createElement("Text", { testID: "pill" }, text),
    HubArrow: () => React.createElement("Arrow"),
    HubSendButton: () => null,
  };
});
jest.mock("../screens/game/GameScreenShell", () => {
  const React = require("react");
  return {
    GameScreenShell: ({ title, subtitle, headerRight, children }) =>
      React.createElement("Shell", { title, subtitle }, headerRight, children),
  };
});

const mockTrack = jest.fn();
jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: { BINGO_VIEWED: "bingo_viewed", BINGO_LINE: "bingo_line", BINGO_SHARED: "bingo_shared" },
  trackEvent: (...args) => mockTrack(...args),
}));
const mockHaptic = jest.fn();
jest.mock("../services/hapticsService", () => ({ triggerHaptic: (...args) => mockHaptic(...args) }));
const mockToastSuccess = jest.fn();
jest.mock("../components/AppToast", () => ({ toast: { success: (...args) => mockToastSuccess(...args) } }));

let mockLang = "tr";
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", between: "#222222", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
let mockBadgeCards = [];
jest.mock("../context/WatchProgressContext", () => ({ useWatchProgressContext: () => ({ kartlar: mockBadgeCards }) }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
let mockStats;
jest.mock("../context/ProfileStatsContext", () => ({ useProfileStats: () => mockStats }));
let mockLists;
jest.mock("../context/ListStatusContext", () => ({ useListStatusContext: () => mockLists }));

const fs = require("fs");
const path = require("path");
const { Share } = require("react-native");
const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const BingoWidget = require("../components/hub/BingoWidget").default;
const CinemaBingoScreen = require("../screens/bingo/CinemaBingoScreen").default;
const { BINGO_COPY, bingoCellText, bingoCellIcon } = require("../utils/cinemaBingoCopy");
const { buildBingoCard, evaluateBingo, monthEndOf, normalizeBingoHistory } = require("../utils/cinemaBingo");

global.IS_REACT_ACT_ENVIRONMENT = true;

const WEEK = "2026-10-19";
const MONTH = "2026-10-01";
let renderer;
let warn;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-21T12:00:00"));
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  [mockTrack, mockHaptic, mockToastSuccess, Share.share].forEach((fn) => fn.mockClear());
  mockLang = "tr";
  mockBadgeCards = [];
  mockLists = { loading: false, watchedTvLoaded: true };
  mockStats = { movieHistoryItems: [], flatEpisodesTv: [] };
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
  jest.useRealTimers();
});

const film = (id, day, extra = {}) => ({ id, dateAdded: day, minutes: 0, genres: [], ...extra });
const bolum = (showId, n, day, genres = []) => ({ id: `${showId}_1_${n}`, showId, episodeWatchTime: day, genres });

/** Haftadan önce yalnız Dram izlenmiş; bu hafta her kareyi dolduran zengin bir izleme. */
const kalabalik = () => {
  mockStats = {
    movieHistoryItems: [
      film(99, "2026-01-05", { genres: ["Dram"] }),
      film(3, "2026-01-06", { genres: ["Dram"] }),
      film(1, "2026-10-19", { minutes: 90, genres: ["Aksiyon", "Komedi", "Dram", "Korku", "Bilim Kurgu", "Gerilim"] }),
      film(2, "2026-10-20", { minutes: 160, genres: ["Romantik", "Animasyon", "Belgesel", "Suç", "Fantastik", "Gizem"] }),
      film(3, "2026-10-21", { minutes: 120, genres: ["Dram"] }),
      film(4, "2026-10-24", { minutes: 120, genres: ["Dram"] }),
    ],
    flatEpisodesTv: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => bolum("A", n, n <= 4 ? "2026-10-22" : "2026-10-25", ["Dram"]))
      .concat([bolum("B", 1, "2026-10-23", ["Dram"])]),
  };
};
const az = () => {
  mockStats = { movieHistoryItems: [film(1, "2026-10-20", { genres: ["Dram"] })], flatEpisodesTv: [] };
};

const navigation = () => ({ navigate: jest.fn(), goBack: jest.fn() });
const mount = (element) => { act(() => { renderer = create(element); }); };
const allTexts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
const hasText = (value) => allTexts().includes(value);
const stored = () => normalizeBingoHistory(get(Keys.cinemaBingoMonthly, { uid: "u1" }));
const expected = () =>
  evaluateBingo({ card: buildBingoCard(MONTH), weekId: MONTH, endDay: monthEndOf(MONTH), movieEntries: mockStats.movieHistoryItems, episodes: mockStats.flatEpisodesTv });

describe("Eğlence kartı", () => {
  test("başlık, çizgi/kare sayısı ve kalan gün; basınca sayfayı açar", () => {
    az();
    const nav = navigation();
    mount(<BingoWidget navigation={nav} />);
    const r = expected();
    const copy = BINGO_COPY.tr;
    expect(hasText(copy.title)).toBe(true);
    expect(hasText(copy.lines(r.lineCount))).toBe(true);
    expect(hasText(copy.squares(r.doneCount, 9))).toBe(true);
    expect(hasText(copy.daysLeft(11))).toBe(true); // 21 Ekim, ay sonuna 11 gün
    expect(hasText(copy.weeklyCount(1))).toBe(true);
    act(() => renderer.root.findByType("Card").props.onPress());
    expect(nav.navigate).toHaveBeenCalledWith("CinemaBingoScreen", { source: "hub" });
    expect(mockHaptic).toHaveBeenCalledWith("impact");
  });

  test("tam kart: altın satır 'Tam kart!' der ve kayıt tam kartı işler", () => {
    kalabalik();
    mount(<BingoWidget navigation={navigation()} />);
    expect(expected().full).toBe(true);
    expect(hasText(BINGO_COPY.tr.fullCard)).toBe(true);
    expect(stored()[MONTH]).toMatchObject({ lines: 8, squares: 9, full: true });
  });

  test("listeler gelmeden: yükleniyor metni, kayıt YAZILMAZ", () => {
    kalabalik();
    mockLists = { loading: true, watchedTvLoaded: false };
    mount(<BingoWidget navigation={navigation()} />);
    expect(hasText(BINGO_COPY.tr.loading)).toBe(true);
    expect(get(Keys.cinemaBingoMonthly, { uid: "u1" })).toBeNull();
  });

  test("hiç izleme yoksa geçmişe sıfır kayıt yazılmaz", () => {
    mount(<BingoWidget navigation={navigation()} />);
    expect(get(Keys.cinemaBingoMonthly, { uid: "u1" })).toBeNull();
  });

  test("beş dilde kart metni çizilir", () => {
    az();
    for (const lang of ["tr", "en", "es", "pt", "de"]) {
      mockLang = lang;
      mount(<BingoWidget navigation={navigation()} />);
      expect(hasText(BINGO_COPY[lang].title)).toBe(true);
      expect(allTexts().some((t) => t.includes("undefined") || t.includes("NaN"))).toBe(false);
      act(() => renderer.unmount());
      renderer = null;
    }
  });
});

describe("tam sayfa", () => {
  test("başlık haftanın aralığı; dokuz kare ve dokuz satır çizilir", () => {
    kalabalik();
    mount(<CinemaBingoScreen navigation={navigation()} route={{ params: { source: "hub" } }} />);
    const shell = renderer.root.findByType("Shell");
    expect(shell.props.title).toBe(BINGO_COPY.tr.title);
    expect(shell.props.subtitle).toMatch(/1.*31/);
    const r = expected();
    r.cells.forEach((cell) => expect(allTexts()).toContain(bingoCellText(BINGO_COPY.tr, cell).long));
  });

  test("açılış ölçümü bir kez, veri hazırken", () => {
    az();
    mount(<CinemaBingoScreen navigation={navigation()} route={{ params: { source: "hub" } }} />);
    const viewed = mockTrack.mock.calls.filter(([name]) => name === "bingo_viewed");
    expect(viewed).toHaveLength(1);
    expect(viewed[0][1]).toEqual({ source: "hub", lines: expected().lineCount, squares: expected().doneCount });
  });

  test("görülmemiş çizgi kutlanır: toast + titreşim + ölçüm + 'görüldü' yazımı; ikinci açılışta sessiz", () => {
    kalabalik();
    mount(<CinemaBingoScreen navigation={navigation()} route={{}} />);
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess.mock.calls[0][0]).toBe(BINGO_COPY.tr.newFull); // tam kart
    expect(mockHaptic).toHaveBeenCalledWith("success");
    expect(mockTrack).toHaveBeenCalledWith("bingo_line", expect.objectContaining({ lines: 8, full: true }));
    expect(stored()[MONTH].seen).toBe(8);

    act(() => renderer.unmount());
    renderer = null;
    mockToastSuccess.mockClear();
    mount(<CinemaBingoScreen navigation={navigation()} route={{}} />);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  test("çizgi yokken kutlama yok; yalnız ilerleme", () => {
    az();
    expect(expected().lineCount).toBe(0);
    mount(<CinemaBingoScreen navigation={navigation()} route={{}} />);
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockHaptic).not.toHaveBeenCalled();
  });

  test("listeler gelmeden kutlama ve ölçüm yok", () => {
    kalabalik();
    mockLists = { loading: true, watchedTvLoaded: false };
    mount(<CinemaBingoScreen navigation={navigation()} route={{}} />);
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  test("paylaş: sistem sayfasına sonuç metnini verir ve ölçer", async () => {
    kalabalik();
    mount(<CinemaBingoScreen navigation={navigation()} route={{}} />);
    const button = renderer.root.findAllByType("GlassPressable").find((n) => n.props.accessibilityLabel === BINGO_COPY.tr.share);
    await act(async () => { await button.props.onPress(); });
    expect(Share.share).toHaveBeenCalledWith({ message: BINGO_COPY.tr.shareMessage(8, 9, 9) });
    expect(mockTrack).toHaveBeenCalledWith("bingo_shared", { lines: 8, squares: 9 });
  });

  test("paylaşım hatası sayfayı çökertmez", async () => {
    az();
    Share.share.mockImplementationOnce(() => Promise.reject(new Error("iptal")));
    mount(<CinemaBingoScreen navigation={navigation()} route={{}} />);
    const button = renderer.root.findAllByType("GlassPressable").find((n) => n.props.accessibilityLabel === BINGO_COPY.tr.share);
    await act(async () => { await button.props.onPress(); });
    expect(mockTrack).not.toHaveBeenCalledWith("bingo_shared", expect.anything());
  });

  test("kademeli Bingo rozetini ekran içinde gösterir", () => {
    az();
    const badge = { id: "bingo_3", family: "bingo", aileKademe: 2, aileToplam: 4 };
    mockBadgeCards = [badge];
    mount(<CinemaBingoScreen navigation={navigation()} route={{}} />);
    expect(hasText(BINGO_COPY.tr.badgeTitle)).toBe(true);
    expect(hasText(BINGO_COPY.tr.badgeHint)).toBe(true);
    expect(renderer.root.findByType("WatchBadgeCard").props.badge).toBe(badge);
  });

  test("beş dilde sayfa metni çizilir (anahtar sızıntısı / undefined yok)", () => {
    kalabalik();
    for (const lang of ["tr", "en", "es", "pt", "de"]) {
      mockLang = lang;
      mount(<CinemaBingoScreen navigation={navigation()} route={{}} />);
      expect(renderer.root.findByType("Shell").props.title).toBe(BINGO_COPY[lang].title);
      expect(allTexts().some((t) => t.includes("undefined") || t.includes("NaN") || t.includes("[object"))).toBe(false);
      act(() => renderer.unmount());
      renderer = null;
    }
  });
});

describe("metin tablosu", () => {
  test("her kare türü, her dilde, kısa ve uzun metin üretir; simge adı tanımlı", () => {
    const kinds = new Set();
    for (let i = 0; i < 300; i += 1) {
      const d = new Date(2026, 0, 5 + i * 7);
      const id = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      buildBingoCard(id).forEach((cell) => kinds.add(JSON.stringify(cell)));
    }
    expect(kinds.size).toBeGreaterThan(20);
    for (const lang of Object.keys(BINGO_COPY)) {
      kinds.forEach((json) => {
        const cell = JSON.parse(json);
        const text = bingoCellText(BINGO_COPY[lang], cell);
        expect(text.short).toBeTruthy();
        expect(text.long).toBeTruthy();
        expect(`${text.short}${text.long}`).not.toMatch(/undefined|NaN/);
        expect(bingoCellIcon(cell)).toMatch(/-outline$/);
      });
    }
  });

  test("simge adları Ionicons sözlüğünde var (bilinmeyen ad kırmızı üçgen basar)", () => {
    const glyphs = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json"),
        "utf8",
      ),
    );
    const source = fs.readFileSync(path.join(__dirname, "../utils/cinemaBingoCopy.js"), "utf8");
    const names = [...source.matchAll(/"([a-z-]+-outline)"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(15);
    names.forEach((name) => expect(glyphs[name]).toBeDefined());
  });

  test("kaynak bekçisi: metin tablosundaki her üst düzey anahtar bir yerde kullanılıyor", () => {
    const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    const used = [
      read("components/hub/BingoWidget.js"),
      read("screens/bingo/CinemaBingoScreen.js"),
      read("utils/cinemaBingoCopy.js"),
    ].join("\n");
    const unused = Object.keys(BINGO_COPY.tr).filter(
      (key) => !["genres", "cells"].includes(key) && !new RegExp(`copy\\.${key}\\b`).test(used),
    );
    expect(unused).toEqual([]);
  });

  test("kaynak bekçisi: ekran rotada ve Eğlence'ye bağlı", () => {
    const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    expect(read("App.js")).toMatch(/name="CinemaBingoScreen"/);
    expect(read("screens/tabs/HubScreen.js")).toMatch(/show\("bingo"\)/);
    expect(read("components/hub/BingoWidget.js")).toMatch(/navigate\("CinemaBingoScreen"/);
  });
});
