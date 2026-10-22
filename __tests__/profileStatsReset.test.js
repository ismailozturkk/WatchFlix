// İstatistik sayaçları hesap değişince SIFIRLANIR.
//
// Hata: ProfileStatsProvider uygulamanın kökünde durur; çıkış / hesap silme onu
// sökmez. Sayaçlar (film/dizi/bölüm sayısı, toplam süre) yalnız açılışta önbellek
// tohumundan doluyordu ve uid değişince geri alınmıyordu. Hesabı silip aynı e-postayla
// yeniden kayıt olan kullanıcı, içi boş listelerin yanında ESKİ sayıları görüyordu —
// üstelik "liste boş + tohumda sayı var → sayaçlara dokunma" koruması, bayat tohumla
// yeni hesapta da devreye girip sayıları sonsuza dek tutuyordu.

global.__DEV__ = false;

const mockAuth = { user: { uid: "eski" } };
const mockLists = { combinedLists: null, stats: null };
const mockSeeds = {
  // Eski hesabın önbelleğe yazdığı sayaçlar.
  eski: {
    watchedMovieCount: 120,
    uniqueMovieCount: 90,
    totalMinutesTime: 14400,
    totalWatchedTime: { years: 0, months: 0, days: 10, hours: 0, minutes: 0 },
    watchedTvCount: 14,
    uniqueTvCount: 11,
    totalEpisodesCount: 400,
    uniqueEpisodesCount: 380,
    totalSeasonsCount: 30,
    uniqueSeasonsCount: 28,
    totalMinutesTimeTv: 18000,
    totalWatchedTimeTv: { years: 0, months: 0, days: 12, hours: 12, minutes: 0 },
  },
};

jest.mock("react-native", () => ({
  Animated: {
    Value: class {
      constructor(v) { this.v = v; }
    },
    timing: () => ({ start: () => {} }),
  },
}));
jest.mock("../services/storage", () => ({
  Keys: { statsCountMode: "statsCountMode" },
  get: () => "total",
  set: () => {},
  getActiveUser: () => "eski",
}));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mockAuth.user }) }));
jest.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({ t: { profileScreen: {} }, language: "tr" }),
}));
jest.mock("../context/ListStatusContext", () => ({
  useListStatusContext: () => ({ combinedLists: mockLists.combinedLists, stats: mockLists.stats }),
}));
jest.mock("../services/listsWidgetService", () => ({ clearListsWidget: jest.fn(), syncListsWidget: jest.fn() }));
jest.mock("../services/statsWidgetService", () => ({ clearStatsWidget: jest.fn(), syncStatsWidget: jest.fn() }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_k, fallback) => fallback }));
jest.mock("../services/snapshotCache", () => ({
  publish: jest.fn(),
  seed: ([ns, uid]) => {
    const data = ns === "stats" ? mockSeeds[uid] ?? null : null;
    return { data, hasCache: !!data };
  },
}));

const React = require("react");
const { create, act } = require("react-test-renderer");
const { ProfileStatsProvider, useProfileStats } = require("../context/ProfileStatsContext");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let seen;
function Probe() {
  seen = useProfileStats();
  return null;
}
const mount = () =>
  act(() => {
    renderer = create(
      React.createElement(ProfileStatsProvider, null, React.createElement(Probe)),
    );
  });
const rerender = () =>
  act(() => {
    renderer.update(React.createElement(ProfileStatsProvider, null, React.createElement(Probe)));
  });

beforeEach(() => {
  mockAuth.user = { uid: "eski" };
  mockLists.combinedLists = null;
  mockLists.stats = null;
  const original = console.error;
  jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  jest.restoreAllMocks();
});

describe("ProfileStatsProvider: hesap değişimi", () => {
  it("açılışta kendi hesabının önbellek tohumuyla başlar", () => {
    mount();
    expect(seen.watchedMovieCount).toBe(120);
    expect(seen.totalMinutesTime).toBe(14400);
    expect(seen.watchedTvCount).toBe(14);
    expect(seen.totalEpisodesCount).toBe(400);
  });

  it("çıkış (hesap silme) sayaçları sıfırlar", () => {
    mount();
    mockAuth.user = null;
    rerender();
    expect(seen.watchedMovieCount).toBe(0);
    expect(seen.uniqueMovieCount).toBe(0);
    expect(seen.totalMinutesTime).toBe(0);
    expect(seen.watchedTvCount).toBe(0);
    expect(seen.totalSeasonsCount).toBe(0);
    expect(seen.totalEpisodesCount).toBe(0);
    expect(seen.totalMinutesTimeTv).toBe(0);
    expect(seen.displayMovieCount).toBe(0);
  });

  it("aynı oturumda yeni hesap açılınca eski hesabın sayıları görünmez", () => {
    mount();
    mockAuth.user = null;
    rerender();
    mockAuth.user = { uid: "yeni" };
    rerender();
    expect(seen.watchedMovieCount).toBe(0);
    expect(seen.totalMinutesTime).toBe(0);
    expect(seen.watchedTvCount).toBe(0);
    expect(seen.totalEpisodesCount).toBe(0);
    expect(seen.listItems).toEqual([]);
  });

  it("çıkış yapmadan doğrudan başka hesaba geçişte de sıfırlanır", () => {
    mount();
    mockAuth.user = { uid: "yeni" };
    rerender();
    expect(seen.watchedMovieCount).toBe(0);
    expect(seen.watchedTvCount).toBe(0);
  });

  it("yeni hesap izleme yaptıkça kendi sayıları oluşur", () => {
    mount();
    mockAuth.user = null;
    rerender();
    mockAuth.user = { uid: "yeni" };
    mockLists.stats = {
      movies: { totalRewatchCount: 2, uniqueCount: 2, totalMinutes: 240 },
      tv: {
        shows: { total: 1, unique: 1 },
        seasons: { total: 1, unique: 1 },
        episodes: { total: 8, unique: 8 },
        totalMinutes: 320,
      },
    };
    rerender();
    expect(seen.watchedMovieCount).toBe(2);
    expect(seen.totalMinutesTime).toBe(240);
    expect(seen.watchedTvCount).toBe(1);
    expect(seen.totalEpisodesCount).toBe(8);
  });

  it("uid hiç değişmezse sayaçlara dokunulmaz (gereksiz sıfırlama yok)", () => {
    mount();
    mockAuth.user = { uid: "eski" };
    rerender();
    expect(seen.watchedMovieCount).toBe(120);
  });
});
