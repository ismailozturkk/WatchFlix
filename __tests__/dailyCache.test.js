// __tests__/dailyCache.test.js
// Günlük (24 saatlik) TTL döngüsü ve pull-to-refresh testleri.

jest.mock("react-native-reanimated", () => ({
  useSharedValue: jest.fn((val) => ({ value: val })),
  useAnimatedScrollHandler: jest.fn((handler) => handler),
  useAnimatedStyle: jest.fn((fn) => fn()),
  withSpring: jest.fn((val) => val),
  withTiming: jest.fn((val) => val),
  interpolate: jest.fn(),
  Extrapolation: { CLAMP: "clamp" },
}));

const load = () => {
  jest.resetModules();
  return require("../utils/apiCache");
};

afterEach(() => {
  jest.resetModules();
  jest.useRealTimers();
});

describe("TTL constants", () => {
  test("tüm günlük anahtarlar 24 saat olarak tanımlı", () => {
    const { TTL } = load();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    expect(TTL.DAILY).toBe(ONE_DAY_MS);
    expect(TTL.TREND).toBe(ONE_DAY_MS);
    expect(TTL.NOW_PLAYING).toBe(ONE_DAY_MS);
    expect(TTL.PROVIDERS).toBe(ONE_DAY_MS);
    expect(TTL.CALENDAR).toBe(ONE_DAY_MS);
  });
});

describe("Daily Cache SWR Cycle", () => {
  test("24 saat içindeki veri her zaman fresh:true döner (ağ isteği atlanmalı)", () => {
    jest.useFakeTimers();
    const api = load();
    api.setCachedValue("movie_trends_daily", [{ id: 101, title: "Test Film" }], { force: true });

    // 12 saat sonra kontrol et
    jest.advanceTimersByTime(12 * 60 * 60 * 1000);

    const result = api.getSwr("movie_trends_daily", { maxAge: api.TTL.TREND });
    expect(result.data).toEqual([{ id: 101, title: "Test Film" }]);
    expect(result.fresh).toBe(true);
  });

  test("24 saat geçtikten sonra veri bayat kabul edilir (fresh:false), ama silinmez", () => {
    jest.useFakeTimers();
    const api = load();
    api.setCachedValue("movie_trends_daily_stale", [{ id: 102 }], { force: true });

    // 25 saat sonra kontrol et
    jest.advanceTimersByTime(25 * 60 * 60 * 1000);

    const result = api.getSwr("movie_trends_daily_stale", { maxAge: api.TTL.TREND });
    expect(result.data).toEqual([{ id: 102 }]);
    expect(result.fresh).toBe(false);
    expect(result.age).toBeGreaterThanOrEqual(25 * 60 * 60 * 1000);
  });
});

describe("Auth initial route caching", () => {
  test("cachedInitialRoute Keys registry'de tanımlı ve default TabScreen", () => {
    const { Keys } = require("../services/storage");
    expect(Keys.cachedInitialRoute).toBeDefined();
    expect(Keys.cachedInitialRoute.default).toBe("TabScreen");
  });
});

describe("Pull to refresh hook & resilience", () => {
  test("usePullToRefresh hook doğru yapıda export edilmiş", () => {
    const usePullToRefresh = require("../hooks/usePullToRefresh").default;
    expect(typeof usePullToRefresh).toBe("function");
  });

  test("çevrimdışıyken bile veri döndürülür ve hata fırlatmaz", () => {
    jest.useFakeTimers();
    const api = load();
    api.setCachedValue("daily_offline_test", [{ id: 999 }], { force: true });

    jest.advanceTimersByTime(30 * 60 * 60 * 1000); // 30 saat sonra

    // SWR bayat döner ama veri silinmez
    const res = api.getSwr("daily_offline_test", { maxAge: api.TTL.DAILY });
    expect(res.data).toEqual([{ id: 999 }]);
    expect(res.fresh).toBe(false);
  });
});

