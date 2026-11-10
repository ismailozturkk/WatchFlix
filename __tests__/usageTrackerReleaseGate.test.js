// Maliyet sayacı yayın build'inde çalışmamalı (yayın denetimi 9 Kas, P-1):
// tüketicisi yalnız geliştirmede açılıyor, kapı olmadan her okuma diske yazıyordu.
const mockSet = jest.fn();
jest.mock("../services/storage", () => ({
  Keys: { usageStats: "usageStats" },
  get: jest.fn(() => null),
  set: (...args) => mockSet(...args),
}));

// Kapı çağrı anında okunur; her test kendi __DEV__ değeriyle yeni bir modül örneği alır.
const previousDev = global.__DEV__;
afterEach(() => { global.__DEV__ = previousDev; });

function loadTracker(dev) {
  global.__DEV__ = dev;
  let tracker;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    tracker = require("../services/usageTrackerService");
  });
  return tracker;
}

function callAll(tracker) {
  tracker.trackFirestoreRead("Users", 3);
  tracker.trackFirestoreWrite("Users", 1);
  tracker.trackFirestoreDelete("Users", 1);
  tracker.trackTmdbRequest("/movie/1", false);
  tracker.trackFunctionCall("callGemini", 10);
  tracker.trackGeminiUsage({ promptTokens: 5, outputTokens: 5 });
  tracker.trackRtdbEvent("presence", "x");
  tracker.trackNetworkRequest("/x", false);
}

beforeEach(() => mockSet.mockClear());

it("yayın build'inde hiçbir sayaç diske yazmaz ve istatistik değişmez", () => {
  const tracker = loadTracker(false);
  callAll(tracker);
  expect(mockSet).not.toHaveBeenCalled();
  const stats = tracker.getUsageStats();
  expect(stats.firestore.reads).toBe(0);
  expect(stats.recentLogs).toHaveLength(0);
});

it("geliştirme build'inde saymaya devam eder", () => {
  const tracker = loadTracker(true);
  callAll(tracker);
  expect(mockSet).toHaveBeenCalled();
  expect(tracker.getUsageStats().firestore.reads).toBe(3);
});
