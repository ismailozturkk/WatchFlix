// "Kullanım verisi" tercihi (yayın denetimi 9 Kas, G-2): kapatınca analitik ve
// hata raporu gerçekten durmalı, açılışta kayıtlı tercih uygulanmalı.
const mockStore = new Map();
jest.mock("../services/storage", () => ({
  Keys: { usageSharing: "usageSharing" },
  get: (key) => (mockStore.has(key) ? mockStore.get(key) : true),
  set: (key, value) => mockStore.set(key, value),
}));

const mockAnalytics = {
  getAnalytics: () => ({}),
  logEvent: jest.fn(),
  setUserId: jest.fn(() => Promise.resolve()),
  setUserProperties: jest.fn(() => Promise.resolve()),
  logScreenView: jest.fn(() => Promise.resolve()),
  setAnalyticsCollectionEnabled: jest.fn(() => Promise.resolve()),
};
jest.mock("@react-native-firebase/analytics", () => mockAnalytics, { virtual: true });

const mockSentry = {
  init: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
};
jest.mock("@sentry/react-native", () => mockSentry, { virtual: true });

function load() {
  let mods;
  jest.isolateModules(() => {
    /* eslint-disable global-require */
    mods = {
      sharing: require("../services/usageSharing"),
      analytics: require("../services/analytics"),
      crash: require("../services/crashReporting"),
    };
    /* eslint-enable global-require */
  });
  return mods;
}

beforeEach(() => {
  mockStore.clear();
  Object.values(mockAnalytics).forEach((fn) => fn.mockClear?.());
  Object.values(mockSentry).forEach((fn) => fn.mockClear?.());
});

test("varsayılan açık: açılışta Sentry başlar, olaylar gider", () => {
  const { sharing, analytics, crash } = load();
  expect(sharing.applyUsageSharingPreference()).toBe(true);
  expect(crash.initCrashReporting()).toBe(true);
  expect(mockSentry.init).toHaveBeenCalledTimes(1);
  // Açıkken native toplama ayarına dokunulmaz.
  expect(mockAnalytics.setAnalyticsCollectionEnabled).not.toHaveBeenCalled();

  expect(analytics.trackEvent(analytics.ANALYTICS_EVENTS.APP_OPEN ?? Object.values(analytics.ANALYTICS_EVENTS)[0])).toBe(true);
  expect(mockAnalytics.logEvent).toHaveBeenCalledTimes(1);
});

test("kayıtlı tercih kapalıysa: Sentry hiç başlamaz, analitik kapatılır, olay çıkmaz", () => {
  mockStore.set("usageSharing", false);
  const { sharing, analytics, crash } = load();
  expect(sharing.applyUsageSharingPreference()).toBe(false);
  expect(crash.initCrashReporting()).toBe(false);
  expect(mockSentry.init).not.toHaveBeenCalled();
  expect(mockAnalytics.setAnalyticsCollectionEnabled).toHaveBeenCalledWith(expect.anything(), false);

  expect(analytics.trackEvent(Object.values(analytics.ANALYTICS_EVENTS)[0])).toBe(false);
  expect(analytics.setAnalyticsUser("u1")).toBe(false);
  expect(analytics.trackScreen?.("Home") ?? false).toBe(false);
  expect(mockAnalytics.logEvent).not.toHaveBeenCalled();
  expect(mockAnalytics.setUserId).not.toHaveBeenCalled();
  expect(mockAnalytics.logScreenView).not.toHaveBeenCalled();
});

test("oturum içinde kapatma: kaydedilir, kimlik bağı kopar, sonraki hata ve olay gönderilmez", () => {
  const { sharing, analytics, crash } = load();
  sharing.applyUsageSharingPreference();
  crash.initCrashReporting();
  const options = mockSentry.init.mock.calls[0][0];
  expect(options.beforeSend({ id: 1 })).toEqual({ id: 1 });

  expect(sharing.setUsageSharingEnabled(false, "u1")).toBe(false);
  expect(mockStore.get("usageSharing")).toBe(false);
  expect(sharing.isUsageSharingEnabled()).toBe(false);
  expect(mockAnalytics.setUserId).toHaveBeenLastCalledWith(expect.anything(), null);
  expect(mockAnalytics.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), false);
  expect(mockSentry.setUser).toHaveBeenLastCalledWith(null);

  mockSentry.captureException.mockClear();
  crash.captureError(new Error("x"));
  crash.addBreadcrumb("y");
  expect(mockSentry.captureException).not.toHaveBeenCalled();
  expect(mockSentry.addBreadcrumb).not.toHaveBeenCalled();
  // SDK'nın kendi yakaladığı olaylar (işlenmemiş hata, performans) da düşer.
  expect(options.beforeSend({ id: 2 })).toBeNull();
  expect(options.beforeSendTransaction({ id: 3 })).toBeNull();

  mockAnalytics.logEvent.mockClear();
  expect(analytics.trackEvent(Object.values(analytics.ANALYTICS_EVENTS)[0])).toBe(false);
  expect(mockAnalytics.logEvent).not.toHaveBeenCalled();
});

test("yeniden açma: analitik açılır, Sentry başlar ve kullanıcı yeniden bağlanır", () => {
  mockStore.set("usageSharing", false);
  const { sharing, crash } = load();
  sharing.applyUsageSharingPreference();
  crash.initCrashReporting();
  expect(mockSentry.init).not.toHaveBeenCalled();

  expect(sharing.setUsageSharingEnabled(true, "u1")).toBe(true);
  expect(mockStore.get("usageSharing")).toBe(true);
  expect(mockAnalytics.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), true);
  expect(mockSentry.init).toHaveBeenCalledTimes(1);
  expect(mockAnalytics.setUserId).toHaveBeenLastCalledWith(expect.anything(), "u1");
  expect(mockSentry.setUser).toHaveBeenLastCalledWith({ id: "u1" });
});

test("Gizlilik Ayarları anahtarı bağlı ve App.js tercihi raporlamadan ÖNCE uyguluyor", () => {
  /* eslint-disable global-require */
  const fs = require("fs");
  const path = require("path");
  /* eslint-enable global-require */
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const screen = read("screens/tabs/profile/PrivacySettingsScreen.js");
  expect(screen).toMatch(/testID="usage-sharing-toggle"/);
  expect(screen).toMatch(/setUsageSharingEnabled\(value/);
  const app = read("App.js");
  const apply = app.indexOf("\napplyUsageSharingPreference();");
  const init = app.indexOf("\ninitCrashReporting();");
  expect(apply).toBeGreaterThan(-1);
  expect(init).toBeGreaterThan(apply);
});
