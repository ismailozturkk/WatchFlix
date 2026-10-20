// __tests__/yearlyGoalButton.test.js
//
// Profil başlığındaki yıllık hedef halka düğmesi + hedef sayfası (özet, film/dizi kartları, aylık
// plan) + useYearlyGoal kancasının BAĞLANTISI, GERÇEK depoyla (bellek-içi MMKV).
// Görsel parçalar (SVG halka, çubuk, cam düğme, alt sayfa kabuğu, anahtar, simgeler) ana makinede
// çizilemediği için taklit edilir; props'ları doğrudan okunup tetiklenir.
//
// Sabit "bugün": 1 Temmuz 2026 (182. gün, 183 gün kaldı). Veri: 25 film (Şubat), 6 dizi × 4 bölüm
// = 24 bölüm (Mart). 50 hedefte beklenen = 24,93.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  AppState: { addEventListener: () => ({ remove: () => {} }) },
}));
// Babel `Text` içe aktarmalarını AppText'e çeviriyor (tipografi sistemi); ana makinede host.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
const mockHost = (name) => ({ __esModule: true, default: ({ children, ...props }) => require("react").createElement(name, props, children) });
// Halka ve cam düğme ÇOCUKLARINI çizer (yüzde / simge halkanın içinde).
jest.mock("../components/profile/YearlyGoalRing", () => mockHost("Ring"));
jest.mock("../components/profile/YearlyGoalBar", () => mockHost("Bar"));
jest.mock("../components/common/GlassIconButton", () => mockHost("GlassButton"));
jest.mock("../components/common/GlassCloseButton", () => mockHost("CloseButton"));
jest.mock("../components/common/SheetScroll", () => mockHost("Scroll"));
jest.mock("../components/SwitchToggle", () => mockHost("Switch"));
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) => (visible ? children : null),
}));

const mockTrack = jest.fn();
jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: { YEARLY_GOAL: "yearly_goal" },
  trackEvent: (...args) => mockTrack(...args),
}));
const mockHaptic = jest.fn();
jest.mock("../services/hapticsService", () => ({ triggerHaptic: (...args) => mockHaptic(...args) }));

let mockLang = "tr";
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", between: "#222222", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
let mockStats;
jest.mock("../context/ProfileStatsContext", () => ({ useProfileStats: () => mockStats }));
let mockLists;
jest.mock("../context/ListStatusContext", () => ({ useListStatusContext: () => mockLists }));

const fs = require("fs");
const path = require("path");
const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get, set, getStore, physicalKey } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const YearlyGoalButton = require("../components/profile/YearlyGoalButton").default;
const { YEARLY_GOAL_COPY, fillCopy } = require("../components/profile/yearlyGoalCopy");
const { getYearlyGoal, setYearlyGoal } = require("../utils/yearlyGoal");

global.IS_REACT_ACT_ENVIRONMENT = true;

const YEAR = 2026;
let renderer;
let warn;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-01T12:00:00"));
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  mockTrack.mockClear();
  mockHaptic.mockClear();
  mockLang = "tr";
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

const film = (id, dateAdded) => ({ id, dateAdded });
const bolum = (showId, episodeWatchTime, seasonNumber, episodeNumber) => ({
  showId, episodeWatchTime, seasonNumber, episodeNumber,
});

/** 25 film (Şubat) + 6 dizi × 4 bölüm = 24 bölüm (Mart). */
const veri = () => {
  mockStats = {
    movieHistoryItems: Array.from({ length: 25 }, (_, i) => film(i + 1, "2026-02-10")),
    flatEpisodesTv: Array.from({ length: 6 }, (_, s) =>
      Array.from({ length: 4 }, (_, e) => bolum(`s${s}`, "2026-03-03", 1, e + 1)),
    ).flat(),
  };
};
const kaydet = (goal) => set(Keys.yearlyGoals, setYearlyGoal(null, YEAR, goal), { uid: "u1" });
const stored = () => get(Keys.yearlyGoals, { uid: "u1" });
const storedGoal = () => getYearlyGoal(stored(), YEAR);

const render = () => {
  act(() => { renderer = create(<YearlyGoalButton />); });
};
const host = (testID) => renderer.root.findAll((n) => typeof n.type === "string" && n.props.testID === testID);
const one = (testID) => {
  const found = host(testID);
  if (found.length !== 1) throw new Error(`${testID}: ${found.length} düğüm`);
  return found[0];
};
const press = (testID) => act(() => one(testID).props.onPress());
const text = (testID) => {
  const node = one(testID);
  const parts = node.type === "Text" ? [node] : node.findAllByType("Text");
  return parts.map((n) => [].concat(n.props.children).join("")).join("");
};
// Stil dizi olarak gelir ([sabit, dinamik]); düz nesneye indir.
const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));
const allTexts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
const hasText = (value) => allTexts().includes(value);
const percentText = () => {
  const found = host("yearly-goal-percent");
  return found.length ? [].concat(found[0].props.children).join("") : null;
};
const iconNames = () => renderer.root.findAllByType("Icon").map((n) => n.props.name);
const copy = (lang = "tr") => YEARLY_GOAL_COPY[lang];
const open = () => press("yearly-goal-button");
const targetOf = (track) => one(`yearly-goal-target-${track}`).props.children;
const toggle = (track, value) => act(() => one(`yearly-goal-toggle-${track}`).props.onValueChange(value));
const tap = (testID) => {
  act(() => { one(testID).props.onPressIn(); });
  act(() => { one(testID).props.onPressOut(); });
};

describe("düğme hâlleri", () => {
  test("listeler gelmeden: boş halka, yüzde YOK, bayrak YOK, dokunulamaz", () => {
    mockLists = { loading: true, watchedTvLoaded: false };
    kaydet({ movies: { target: 50 } });
    render();
    expect(percentText()).toBeNull();
    expect(iconNames()).not.toContain("flag-outline");
    expect(renderer.root.findByType("Ring").props.ratio).toBe(0);
    expect(one("yearly-goal-button").props.disabled).toBe(true);
  });

  test("dizi alt koleksiyonu gelmediyse de yüzde yazılmaz (yarım veriyle yüzde gösterilmez)", () => {
    mockLists = { loading: false, watchedTvLoaded: false };
    kaydet({ movies: { target: 50 } });
    render();
    expect(percentText()).toBeNull();
    expect(one("yearly-goal-button").props.disabled).toBe(true);
  });

  test("hedef yokken boş halka + bayrak; yüzde yok; dokununca sayfa açılır", () => {
    render();
    expect(percentText()).toBeNull();
    expect(iconNames()).toContain("flag-outline");
    expect(renderer.root.findByType("Ring").props.ratio).toBe(0);
    expect(one("yearly-goal-button").props.accessibilityLabel).toBe(fillCopy(copy().emptyTitle, { year: YEAR }));
    expect(host("yearly-goal-save")).toHaveLength(0);
    open();
    expect(host("yearly-goal-save")).toHaveLength(1);
  });

  test("yalnız film hedefi: ortada YALNIZ yüzde (25/50 → %50)", () => {
    veri();
    kaydet({ movies: { target: 50 } });
    render();
    expect(percentText()).toBe("%50");
    expect(renderer.root.findByType("Ring").props.ratio).toBeCloseTo(0.5, 5);
    expect(iconNames()).not.toContain("flag-outline");
    expect(allTexts()).toEqual(["%50"]);
  });

  test("yalnız dizi hedefi, 'dizi sayısı' ölçüsü (6/12 → %50)", () => {
    veri();
    kaydet({ shows: { target: 12, measure: "shows" } });
    render();
    expect(percentText()).toBe("%50");
  });

  test("yalnız dizi hedefi, 'bölüm sayısı' ölçüsü (24/48 → %50)", () => {
    veri();
    kaydet({ shows: { target: 48, measure: "episodes" } });
    render();
    expect(percentText()).toBe("%50");
  });

  test("iki hat birden: yüzde oranların ORTALAMASI ((%50 + %25) / 2 → %37)", () => {
    veri();
    kaydet({ movies: { target: 50 }, shows: { target: 24, measure: "shows" } });
    render();
    expect(percentText()).toBe("%37");
  });

  test("hat sayıları birbirine karışmaz: bölüm hedefi film sayısını değil bölüm sayısını okur", () => {
    veri();
    kaydet({ shows: { target: 100, measure: "episodes" } });
    render();
    expect(percentText()).toBe("%24");   // 24 bölüm / 100 (6 dizi / 100 olsaydı %6)
  });

  test("ESKİ biçimde kaydedilmiş hedef (film, 50) hâlâ çalışır", () => {
    veri();
    set(Keys.yearlyGoals, { [YEAR]: { target: 50, unit: "movie" } }, { uid: "u1" });
    render();
    expect(percentText()).toBe("%50");
  });

  test("TÜM açık hedefler tamamsa %100 ve ALTIN halka", () => {
    veri();
    kaydet({ movies: { target: 5 }, shows: { target: 2, measure: "shows" } });
    render();
    expect(percentText()).toBe("%100");
    expect(renderer.root.findByType("Ring").props.ratio).toBe(1);
    expect(renderer.root.findByType("Ring").props.color).toBe("#FBBF24");
  });

  test("biri tamam diğeri değilse altın DEĞİL, yüzde ortalama (%75)", () => {
    veri();
    kaydet({ movies: { target: 5 }, shows: { target: 12, measure: "shows" } });
    render();
    expect(percentText()).toBe("%75");
    expect(renderer.root.findByType("Ring").props.color).toBe(mockTheme.accent);
  });

  test("geçen yılın izlemesi bu yılın yüzdesine girmez", () => {
    mockStats = { movieHistoryItems: [film(1, "2025-12-31")], flatEpisodesTv: [bolum("a", "2025-06-01", 1, 1)] };
    kaydet({ movies: { target: 10 } });
    render();
    expect(percentText()).toBe("%0");
  });

  test("hesabın bozuk kaydı düğmeyi bozmaz: hedef yok görünümüne döner", () => {
    getStore(Keys.yearlyGoals.store).set(physicalKey(Keys.yearlyGoals, "u1"), "{bozuk json");
    render();
    expect(percentText()).toBeNull();
    expect(iconNames()).toContain("flag-outline");
  });

  test.each([["en", "%50".replace("%", "") + "%"], ["es", "50%"], ["tr", "%50"]])("%s: yüzde biçimi %s", (dil, beklenen) => {
    mockLang = dil;
    veri();
    kaydet({ movies: { target: 50 } });
    render();
    expect(percentText()).toBe(beklenen);
  });

  test("erişilebilirlik: dolu düğme her hattın sayısını okur (yüzde tek başına yetmez)", () => {
    veri();
    kaydet({ movies: { target: 50 }, shows: { target: 48, measure: "episodes" } });
    render();
    const label = one("yearly-goal-button").props.accessibilityLabel;
    expect(label).toContain(fillCopy(copy().editLabel, { year: YEAR }));
    expect(label).toContain("Film 25 / 50, Dizi 24 / 48");
  });

  test.each(["en", "es"])("%s: hedef yokken erişilebilirlik etiketi o dilde", (dil) => {
    mockLang = dil;
    render();
    expect(one("yearly-goal-button").props.accessibilityLabel).toBe(fillCopy(copy(dil).emptyTitle, { year: YEAR }));
  });
});

describe("sayfa: özet", () => {
  test("hedef yokken öneriyle açılır: iki hat da açık, film 24 / dizi 12, 'Önizleme' etiketi", () => {
    veri();
    render();
    open();
    expect(targetOf("movies")).toBe(24);
    expect(targetOf("shows")).toBe(12);
    expect(one("yearly-goal-toggle-movies").props.value).toBe(true);
    expect(one("yearly-goal-toggle-shows").props.value).toBe(true);
    expect(host("yearly-goal-preview")).toHaveLength(1);
    expect(host("yearly-goal-remove")).toHaveLength(0);
    // 25/24 film (tamam) + 6/12 dizi (%50) → ortalama %75
    expect(text("yearly-goal-hero-percent")).toBe("%75");
  });

  test("kayıtlı hedefle açılır: özet, yılın saati ve hat rozetleri", () => {
    veri();
    kaydet({ movies: { target: 50 } });
    render();
    open();
    expect(text("yearly-goal-hero-percent")).toBe("%50");
    expect(text("yearly-goal-hero-title")).toBe(copy().overall.onTrack);
    expect(text("yearly-goal-hero-clock")).toBe("Yıl %49 tamamlandı · 183 gün kaldı");
    expect(text("yearly-goal-pill-movies")).toBe("Film 25 / 50");
    expect(host("yearly-goal-pill-shows")).toHaveLength(0);
    expect(host("yearly-goal-preview")).toHaveLength(0);
    expect(host("yearly-goal-remove")).toHaveLength(1);
  });

  test("tamamlanınca başlık 'Hedefe ulaştın' ve halka altın", () => {
    veri();
    kaydet({ movies: { target: 5 } });
    render();
    open();
    expect(text("yearly-goal-hero-title")).toBe(copy().overall.done);
    expect(text("yearly-goal-hero-percent")).toBe("%100");
    const heroRing = renderer.root.findAllByType("Ring").find((r) => r.props.size === 84);
    expect(heroRing.props.color).toBe("#FBBF24");
  });

  test("geride kalınca başlık 'Tempoda geridesin'", () => {
    mockStats = { movieHistoryItems: [film(1, "2026-01-10")], flatEpisodesTv: [] };
    kaydet({ movies: { target: 50 } });
    render();
    open();
    expect(text("yearly-goal-hero-title")).toBe(copy().overall.behind);
  });

  test("hiç hat açık değilken özet yerine açıklama, Kaydet kapalı, 'bir hat aç' notu", () => {
    veri();
    kaydet({ movies: { target: 50 } });
    render();
    open();
    toggle("movies", false);
    expect(host("yearly-goal-hero")).toHaveLength(0);
    expect(host("yearly-goal-no-summary")).toHaveLength(1);
    expect(host("yearly-goal-need-track")).toHaveLength(1);
    expect(one("yearly-goal-save").props.disabled).toBe(true);
    toggle("shows", false);
    expect(host("yearly-goal-chart")).toHaveLength(0);
  });
});

describe("sayfa: film kartı ve plan", () => {
  beforeEach(() => {
    veri();
    kaydet({ movies: { target: 50 } });
    render();
    open();
  });

  test("kapalı dizi kartında ayar yok; açıkken var", () => {
    expect(host("yearly-goal-decrease-shows")).toHaveLength(0);
    toggle("shows", true);
    expect(host("yearly-goal-decrease-shows")).toHaveLength(1);
  });

  test("ilerleme: 'Şu an 25 · %50', çubuk oranı ve BUGÜN İŞARETİ", () => {
    expect(text("yearly-goal-sofar-movies")).toBe("Şu an 25 · %50");
    const bar = renderer.root.findAllByType("Bar")[0];
    expect(bar.props.ratio).toBeCloseTo(0.5, 5);
    expect(bar.props.markerRatio).toBeCloseTo(182 / 365, 5);
    expect(text("yearly-goal-plan-movies")).toBe(fillCopy(copy().stats.planToday, { n: 25 }));
    expect(text("yearly-goal-pace-movies")).toBe(copy().pace.onTrack);
  });

  test("plan hücreleri: kalan, haftada, ayda, yıl sonu tahmini", () => {
    const metin = (id) => one(`yearly-goal-stat-movies-${id}`).findAllByType("Text").map((n) => n.props.children);
    expect(metin("remaining")).toEqual(["25", copy().stats.remaining]);
    expect(metin("perWeek")).toEqual(["~1", copy().stats.perWeek]);
    expect(metin("perMonth")).toEqual(["~4,2", copy().stats.perMonth]);
    expect(metin("projected")).toEqual(["~50", copy().stats.projected]);
  });

  test("hedef değişince plan ANINDA yeniden hesaplanır (kaydetmeden önizleme)", () => {
    act(() => { one("yearly-goal-preset-movies-100").props.onPress(); });
    expect(targetOf("movies")).toBe(100);
    const metin = (id) => one(`yearly-goal-stat-movies-${id}`).findAllByType("Text").map((n) => n.props.children)[0];
    expect(metin("remaining")).toBe("75");
    expect(text("yearly-goal-sofar-movies")).toBe("Şu an 25 · %25");
    expect(text("yearly-goal-pace-movies")).toBe(fillCopy(copy().pace.behind, { n: 25 }));
    expect(text("yearly-goal-hero-percent")).toBe("%25");
    expect(text("yearly-goal-hero-title")).toBe(copy().overall.behind);
    expect(host("yearly-goal-preview")).toHaveLength(1);
  });

  test("hedef sayıyı aşınca 'Tamam' rozeti, 'Fazla +N', plan satırı boş", () => {
    act(() => { one("yearly-goal-preset-movies-12").props.onPress(); });
    expect(text("yearly-goal-pace-movies")).toBe(copy().pace.done);
    expect(one("yearly-goal-stat-movies-over").findAllByType("Text")[0].props.children).toBe("+13");
    expect(host("yearly-goal-stat-movies-remaining")).toHaveLength(0);
    expect(text("yearly-goal-plan-movies")).toBe("");
    expect(renderer.root.findAllByType("Bar")[0].props.markerRatio).toBeNull();
  });

  test("+ / − tek dokunuşta 1 adım (film); alt sınırda düğme kapanır", () => {
    act(() => { one("yearly-goal-preset-movies-12").props.onPress(); });
    for (let i = 0; i < 11; i += 1) tap("yearly-goal-decrease-movies");
    expect(targetOf("movies")).toBe(1);
    expect(one("yearly-goal-decrease-movies").props.disabled).toBe(true);
    tap("yearly-goal-increase-movies");
    expect(targetOf("movies")).toBe(2);
  });

  test("hazır çip seçili görünür", () => {
    act(() => { one("yearly-goal-preset-movies-52").props.onPress(); });
    expect(one("yearly-goal-preset-movies-52").props.accessibilityState).toEqual({ selected: true });
    expect(one("yearly-goal-preset-movies-24").props.accessibilityState).toEqual({ selected: false });
  });
});

describe("sayfa: dizi kartı (dizi sayısı | bölüm sayısı)", () => {
  beforeEach(() => {
    veri();
    kaydet({ shows: { target: 12, measure: "shows" } });
    render();
    open();
  });

  test("dizi sayısı: hedef 12 'dizi', 6 izlendi", () => {
    expect(targetOf("shows")).toBe(12);
    expect(text("yearly-goal-sofar-shows")).toBe("Şu an 6 · %50");
    expect(one("yearly-goal-measure-shows").props.accessibilityState).toEqual({ selected: true });
    expect(text("yearly-goal-hint")).toBe(copy().measures.shows.hint);
  });

  test("bölüm sayısına geçince: hedef 250, 24 bölüm, çipler 100/250/500/1000, açıklama değişir", () => {
    act(() => { one("yearly-goal-measure-episodes").props.onPress(); });
    expect(targetOf("shows")).toBe(250);
    expect(text("yearly-goal-sofar-shows")).toBe("Şu an 24 · %9");
    expect(text("yearly-goal-hint")).toBe(copy().measures.episodes.hint);
    for (const v of [100, 250, 500, 1000]) expect(host(`yearly-goal-preset-shows-${v}`)).toHaveLength(1);
    expect(host("yearly-goal-preset-shows-12")).toHaveLength(0);
  });

  test("iki ölçünün hedefi AYRI korunur (12 → bölümde 300 → geri dönünce 12)", () => {
    act(() => { one("yearly-goal-measure-episodes").props.onPress(); });
    act(() => { one("yearly-goal-preset-shows-500").props.onPress(); });
    expect(targetOf("shows")).toBe(500);
    act(() => { one("yearly-goal-measure-shows").props.onPress(); });
    expect(targetOf("shows")).toBe(12);
    act(() => { one("yearly-goal-measure-episodes").props.onPress(); });
    expect(targetOf("shows")).toBe(500);
  });

  test("bölüm hedefinde adım 5", () => {
    act(() => { one("yearly-goal-measure-episodes").props.onPress(); });
    tap("yearly-goal-increase-shows");
    expect(targetOf("shows")).toBe(255);
    tap("yearly-goal-decrease-shows");
    tap("yearly-goal-decrease-shows");
    expect(targetOf("shows")).toBe(245);
  });

  test("basılı tutunca tekrarlar, bırakınca durur", () => {
    act(() => { one("yearly-goal-increase-shows").props.onPressIn(); });
    expect(targetOf("shows")).toBe(13);
    act(() => { jest.advanceTimersByTime(380); });
    expect(targetOf("shows")).toBe(14);
    act(() => { jest.advanceTimersByTime(110); });
    expect(targetOf("shows")).toBe(15);
    act(() => { one("yearly-goal-increase-shows").props.onPressOut(); });
    act(() => { jest.advanceTimersByTime(2000); });
    expect(targetOf("shows")).toBe(15);
  });

  test("uzun basış hızlanır: 12 adımdan sonra adım × 5 (bölümde 25)", () => {
    act(() => { one("yearly-goal-measure-episodes").props.onPress(); });
    act(() => { one("yearly-goal-increase-shows").props.onPressIn(); });          // 255
    act(() => { jest.advanceTimersByTime(380 + 110 * 11); });                     // 12 tekrar → 315
    expect(targetOf("shows")).toBe(315);
    act(() => { jest.advanceTimersByTime(110); });                                // 13. adım hızlı → +25
    expect(targetOf("shows")).toBe(340);
    act(() => { jest.advanceTimersByTime(70); });
    expect(targetOf("shows")).toBe(365);
    act(() => { one("yearly-goal-increase-shows").props.onPressOut(); });
  });

  test("tutarken sayfa kapanırsa zamanlayıcı sızmaz", () => {
    act(() => { one("yearly-goal-increase-shows").props.onPressIn(); });
    act(() => renderer.unmount());
    renderer = null;
    expect(() => act(() => { jest.advanceTimersByTime(3000); })).not.toThrow();
    expect(jest.getTimerCount()).toBe(0);
  });

  test("bölüm hedefi 9999'a kadar çıkar, film hedefi 999'da kalır", () => {
    act(() => { one("yearly-goal-measure-episodes").props.onPress(); });
    act(() => { one("yearly-goal-preset-shows-1000").props.onPress(); });
    for (let i = 0; i < 2000; i += 1) {
      act(() => { one("yearly-goal-increase-shows").props.onPressIn(); });
      act(() => { one("yearly-goal-increase-shows").props.onPressOut(); });
      if (one("yearly-goal-increase-shows").props.disabled) break;
    }
    expect(targetOf("shows")).toBe(9999);
    expect(one("yearly-goal-increase-shows").props.disabled).toBe(true);
  });
});

describe("sayfa: kaydet / değiştir / kaldır", () => {
  test("açılışta değişiklik yokken Kaydet KAPALI; bir şey değişince açılır ve Önizleme çıkar", () => {
    veri();
    kaydet({ movies: { target: 50 } });
    render();
    open();
    expect(one("yearly-goal-save").props.disabled).toBe(true);
    expect(host("yearly-goal-preview")).toHaveLength(0);
    act(() => { one("yearly-goal-preset-movies-52").props.onPress(); });
    expect(one("yearly-goal-save").props.disabled).toBe(false);
    expect(host("yearly-goal-preview")).toHaveLength(1);
    // Eski değere dönünce yine "değişmedi"
    act(() => { one("yearly-goal-preset-movies-100").props.onPress(); });
    for (let i = 0; i < 50; i += 1) tap("yearly-goal-decrease-movies");
    expect(targetOf("movies")).toBe(50);
    expect(one("yearly-goal-save").props.disabled).toBe(true);
  });

  test("hedef yokken Kaydet açık (öneri kaydedilebilir)", () => {
    veri();
    render();
    open();
    expect(one("yearly-goal-save").props.disabled).toBe(false);
  });

  test("KAYDET (iki hat): diske yazar, sayfayı kapatır, 'set' olayı gider, düğme yeni yüzdeyi gösterir", () => {
    veri();
    render();
    open();
    act(() => { one("yearly-goal-preset-movies-52").props.onPress(); });
    act(() => { one("yearly-goal-measure-episodes").props.onPress(); });
    act(() => { one("yearly-goal-preset-shows-100").props.onPress(); });
    press("yearly-goal-save");
    expect(storedGoal()).toEqual({ movies: { target: 52 }, shows: { target: 100, measure: "episodes" } });
    expect(host("yearly-goal-save")).toHaveLength(0);
    expect(mockTrack).toHaveBeenCalledWith("yearly_goal", {
      action: "set", tracks: "both", movies_target: 52, shows_target: 100, shows_measure: "episodes",
    });
    // 25/52 = .4807, 24/100 = .24 → ortalama .3603 → %36
    expect(percentText()).toBe("%36");
  });

  test("KAYDET (yalnız dizi): film hattı kapalıysa ANAHTARI yazılmaz", () => {
    veri();
    render();
    open();
    toggle("movies", false);
    press("yearly-goal-save");
    expect(stored()[YEAR]).toEqual({ shows: { target: 12, measure: "shows" } });
    expect(mockTrack).toHaveBeenCalledWith("yearly_goal", {
      action: "set", tracks: "shows", shows_target: 12, shows_measure: "shows",
    });
  });

  test("KAYDET (yalnız film)", () => {
    veri();
    render();
    open();
    toggle("shows", false);
    press("yearly-goal-save");
    expect(stored()[YEAR]).toEqual({ movies: { target: 24 } });
    expect(mockTrack).toHaveBeenCalledWith("yearly_goal", { action: "set", tracks: "movies", movies_target: 24 });
  });

  test("DEĞİŞTİR: var olan hedefte olay 'changed'", () => {
    veri();
    kaydet({ movies: { target: 30 } });
    render();
    open();
    act(() => { one("yearly-goal-preset-movies-100").props.onPress(); });
    press("yearly-goal-save");
    expect(storedGoal().movies.target).toBe(100);
    expect(mockTrack).toHaveBeenCalledWith("yearly_goal", { action: "changed", tracks: "movies", movies_target: 100 });
  });

  test("hat kapatmak diğer hattın kaydını DEĞİŞTİRMEZ (kapalı hattın hedefi yalnız kapanır)", () => {
    veri();
    kaydet({ movies: { target: 30 }, shows: { target: 20, measure: "shows" } });
    render();
    open();
    toggle("shows", false);
    press("yearly-goal-save");
    expect(storedGoal()).toEqual({ movies: { target: 30 }, shows: null });
  });

  test("KALDIR: hedef ve anahtar silinir, 'cleared' olayı, düğme hedef yok görünümüne döner", () => {
    veri();
    kaydet({ movies: { target: 30 }, shows: { target: 200, measure: "episodes" } });
    render();
    open();
    press("yearly-goal-remove");
    expect(stored()).toBeNull();
    expect(mockTrack).toHaveBeenCalledWith("yearly_goal", {
      action: "cleared", tracks: "both", movies_target: 30, shows_target: 200, shows_measure: "episodes",
    });
    expect(percentText()).toBeNull();
    expect(iconNames()).toContain("flag-outline");
  });

  test("başka yılın hedefi kaldırmayla silinmez", () => {
    set(Keys.yearlyGoals, setYearlyGoal({ 2025: { movies: { target: 40 } } }, YEAR, { movies: { target: 30 } }), { uid: "u1" });
    render();
    open();
    press("yearly-goal-remove");
    expect(stored()).toEqual({ 2025: { movies: { target: 40 } } });
  });

  test("kaydedilmeden kapatmak hiçbir şey yazmaz ve olay göndermez", () => {
    veri();
    render();
    open();
    act(() => { one("yearly-goal-preset-movies-100").props.onPress(); });
    act(() => renderer.root.findByType("CloseButton").props.onPress());
    expect(stored()).toBeNull();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  test("sayfa yeniden açılınca kaydedilmemiş taslak KALMAZ", () => {
    veri();
    kaydet({ movies: { target: 30 } });
    render();
    open();
    act(() => { one("yearly-goal-preset-movies-100").props.onPress(); });
    act(() => renderer.root.findByType("CloseButton").props.onPress());
    open();
    expect(targetOf("movies")).toBe(30);
  });

  test("başka kullanıcının hedefi bu kullanıcıya görünmez", () => {
    set(Keys.yearlyGoals, setYearlyGoal(null, YEAR, { movies: { target: 99 } }), { uid: "baska" });
    render();
    expect(percentText()).toBeNull();
    expect(iconNames()).toContain("flag-outline");
  });

  test("geçen yılın hedefi bu yılın önerisi olur (hatlar ve ölçüyle)", () => {
    set(
      Keys.yearlyGoals,
      setYearlyGoal(null, 2025, { movies: { target: 40 }, shows: { target: 300, measure: "episodes" } }),
      { uid: "u1" },
    );
    render();
    open();
    expect(targetOf("movies")).toBe(40);
    expect(targetOf("shows")).toBe(300);
    expect(one("yearly-goal-measure-episodes").props.accessibilityState).toEqual({ selected: true });
  });

  test("geçen yıl yalnız film izlendiyse dizi hattı KAPALI önerilir", () => {
    mockStats = {
      movieHistoryItems: Array.from({ length: 40 }, (_, i) => film(i, "2025-05-05")),
      flatEpisodesTv: [],
    };
    render();
    open();
    expect(targetOf("movies")).toBe(45);
    expect(one("yearly-goal-toggle-movies").props.value).toBe(true);
    expect(one("yearly-goal-toggle-shows").props.value).toBe(false);
  });
});

describe("sayfa: aylık plan grafiği", () => {
  test("iki hat açıkken iki sekme; film seçili, Şubat çubuğu dolu, plan satırı", () => {
    veri();
    render();
    open();
    expect(host("yearly-goal-chart-tab-movies")).toHaveLength(1);
    expect(host("yearly-goal-chart-tab-shows")).toHaveLength(1);
    expect(one("yearly-goal-chart-tab-movies").props.accessibilityState).toEqual({ selected: true });
    expect(text("yearly-goal-chart-plan")).toBe(fillCopy(copy().chart.plan, { n: "2" }));
    // Şubat (1): 25 film → en yüksek çubuk; Mart (2): film yok
    expect(flat(one("yearly-goal-bar-1").props.style).height).toBeGreaterThan(70);
    expect(flat(one("yearly-goal-bar-2").props.style).height).toBe(0);
    expect(host("yearly-goal-chart-line")).toHaveLength(1);
    expect(host("yearly-goal-chart-empty")).toHaveLength(0);
  });

  test("gelecek aylar soluk ve en kısa, içinde bulunulan ay (Temmuz) tam opak", () => {
    veri();
    render();
    open();
    const gelecek = flat(one("yearly-goal-bar-9").props.style);
    expect(gelecek.height).toBe(3);
    expect(gelecek.backgroundColor).not.toBe("#FBBF24");
    expect(flat(one("yearly-goal-bar-1").props.style).opacity).toBe(0.78);
  });

  test("Dizi sekmesine geçince dizi serisi ve ONUN planı", () => {
    veri();
    render();
    open();
    act(() => { one("yearly-goal-chart-tab-shows").props.onPress(); });
    expect(one("yearly-goal-chart-tab-shows").props.accessibilityState).toEqual({ selected: true });
    expect(text("yearly-goal-chart-plan")).toBe(fillCopy(copy().chart.plan, { n: "1" }));
    // Mart (2): 6 dizi ilk kez izlendi
    expect(flat(one("yearly-goal-bar-2").props.style).height).toBeGreaterThan(70);
    expect(flat(one("yearly-goal-bar-1").props.style).height).toBe(0);
  });

  test("dizi 'bölüm sayısı'ndayken grafik bölümleri sayar", () => {
    veri();
    kaydet({ shows: { target: 240, measure: "episodes" } });
    render();
    open();
    expect(text("yearly-goal-chart-plan")).toBe(fillCopy(copy().chart.plan, { n: "20" }));
    expect(flat(one("yearly-goal-bar-2").props.style).height).toBeGreaterThan(0);
    const degerler = one("yearly-goal-bar-2").parent.findAllByType("Text").map((n) => n.props.children);
    expect(degerler).toContain(24);
  });

  test("tek hat açıkken sekme yok", () => {
    veri();
    kaydet({ movies: { target: 50 } });
    render();
    open();
    expect(host("yearly-goal-chart")).toHaveLength(1);
    expect(host("yearly-goal-chart-tab-movies")).toHaveLength(0);
  });

  test("seçili sekmenin hattı kapatılırsa diğerine düşer", () => {
    veri();
    render();
    open();
    act(() => { one("yearly-goal-chart-tab-shows").props.onPress(); });
    toggle("shows", false);
    expect(host("yearly-goal-chart-tab-shows")).toHaveLength(0);
    expect(text("yearly-goal-chart-plan")).toBe(fillCopy(copy().chart.plan, { n: "2" }));
  });

  test("hedef değişince plan çizgisi ve yazısı güncellenir", () => {
    veri();
    kaydet({ movies: { target: 50 } });
    render();
    open();
    expect(text("yearly-goal-chart-plan")).toBe(fillCopy(copy().chart.plan, { n: "4,2" }));
    act(() => { one("yearly-goal-preset-movies-100").props.onPress(); });
    expect(text("yearly-goal-chart-plan")).toBe(fillCopy(copy().chart.plan, { n: "8,3" }));
  });

  test("izleme yoksa boş durum yazısı (grafik yine çizilir)", () => {
    render();
    open();
    expect(host("yearly-goal-chart-empty")).toHaveLength(1);
    expect(host("yearly-goal-chart-line")).toHaveLength(1);
  });
});

describe("diller", () => {
  test.each(["en", "es"])("%s: sayfa o dilin metnini kullanır", (dil) => {
    mockLang = dil;
    veri();
    kaydet({ movies: { target: 50 } });
    render();
    open();
    expect(hasText(copy(dil).sheet.save)).toBe(true);
    expect(hasText(copy(dil).sheet.subtitle)).toBe(true);
    expect(text("yearly-goal-hero-title")).toBe(copy(dil).overall.onTrack);
    expect(text("yearly-goal-pill-movies")).toBe(`${copy(dil).tracks.movies.name} 25 ${dil === "en" ? "of" : "de"} 50`);
    expect(text("yearly-goal-hero-clock")).toBe(
      fillCopy(copy(dil).clock.line, {
        pct: "49%",
        days: fillCopy(copy(dil).clock.daysLeft, { n: 183 }),
      }),
    );
  });

  test("bir gün kala 'tekil' metin, son günde 'Son gün'", () => {
    jest.setSystemTime(new Date("2026-12-30T12:00:00"));
    veri();
    kaydet({ movies: { target: 50 } });
    render();
    open();
    expect(text("yearly-goal-hero-clock")).toContain(copy().clock.dayLeft);
    act(() => renderer.unmount());
    renderer = null;
    jest.setSystemTime(new Date("2026-12-31T12:00:00"));
    render();
    open();
    expect(text("yearly-goal-hero-clock")).toContain(copy().clock.lastDay);
  });
});

describe("metin tablosu: her anahtar kullanılıyor", () => {
  const KOK = path.join(__dirname, "..");
  const kaynak = [
    "components/profile/YearlyGoalButton.js",
    "components/profile/YearlyGoalSheet.js",
    "components/profile/YearlyGoalTrackCard.js",
    "components/profile/YearlyGoalMonthChart.js",
    "components/profile/yearlyGoalCopy.js",
  ]
    .map((dosya) => fs.readFileSync(path.join(KOK, dosya), "utf8"))
    .join("\n");

  // Dinamik erişilen gruplar: copy.pace[durum], copy.overall[durum], copy.measures[id].*,
  // copy.tracks[hat].name. Bunlar için "grup erişimi var" yeter.
  const DINAMIK = [/^pace\./, /^overall\./, /^measures\./, /^tracks\.[a-z]+\.name$/];

  function yapraklar(nesne, onek = "", toplam = []) {
    for (const [ad, deger] of Object.entries(nesne)) {
      const yol = onek ? `${onek}.${ad}` : ad;
      if (deger && typeof deger === "object") yapraklar(deger, yol, toplam);
      else toplam.push(yol);
    }
    return toplam;
  }

  test("tablodaki her yaprak kodda geçiyor (kullanılmayan metin birikmesin)", () => {
    const kullanilmayan = yapraklar(YEARLY_GOAL_COPY.tr).filter((yol) => {
      if (DINAMIK.some((kural) => kural.test(yol))) return false;
      return !kaynak.includes(`copy.${yol}`);
    });
    expect(kullanilmayan).toEqual([]);
  });

  test("dinamik gruplar gerçekten dinamik erişiliyor (muafiyet boş çek değil)", () => {
    expect(kaynak).toMatch(/copy\.pace\[/);
    expect(kaynak).toMatch(/copy\.overall\[/);
    expect(kaynak).toMatch(/copy\.measures\[/);
    expect(kaynak).toMatch(/copy\.tracks\[/);
  });
});
