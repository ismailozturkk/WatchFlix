// __tests__/appCheck.test.js
//
// services/appCheck.js: yayın build'inde gerçek sağlayıcılar + web SDK köprüsü, jeton alınamayınca Sentry'ye
// oturum başına BİR KEZ bildirim, geliştirme build'inde varsayılan kapalı / EXPO_PUBLIC_APPCHECK_DEBUG=1 ile
// debug sağlayıcı. Native ve web App Check modülleri taklit.

const mockConfigure = jest.fn();
const mockNativeInit = jest.fn(() => ({ native: true }));
const mockNativeGetToken = jest.fn();
const mockWebInit = jest.fn();
const mockCaptureError = jest.fn();

jest.mock("@react-native-firebase/app-check", () => ({
  initializeAppCheck: (...args) => mockNativeInit(...args),
  getToken: (...args) => mockNativeGetToken(...args),
  ReactNativeFirebaseAppCheckProvider: class {
    configure(options) {
      mockConfigure(options);
    }
  },
}));
jest.mock("firebase/app-check", () => ({
  initializeAppCheck: (...args) => mockWebInit(...args),
  CustomProvider: class {
    constructor(options) {
      this.options = options;
    }
  },
}));
jest.mock("../services/crashReporting", () => ({ captureError: (...args) => mockCaptureError(...args) }));

/** Modülü taze yükler (DEV_DEBUG_PROVIDER yüklemede okunur; `initialized` modül durumudur). */
function loadAppCheck({ dev = false, debugFlag } = {}) {
  global.__DEV__ = dev;
  if (debugFlag === undefined) delete process.env.EXPO_PUBLIC_APPCHECK_DEBUG;
  else process.env.EXPO_PUBLIC_APPCHECK_DEBUG = debugFlag;
  let mod;
  jest.isolateModules(() => {
    mod = require("../services/appCheck");
  });
  return mod;
}
/** Web SDK'ya verilen CustomProvider'ın getToken'ı. */
const webGetToken = () => mockWebInit.mock.calls[0][1].provider.options.getToken;

beforeEach(() => {
  jest.clearAllMocks();
});
afterAll(() => {
  global.__DEV__ = false;
  delete process.env.EXPO_PUBLIC_APPCHECK_DEBUG;
});

describe("yayın build'i", () => {
  test("gerçek sağlayıcılar kurulur ve web SDK köprüsü bağlanır", () => {
    const { initAppCheck } = loadAppCheck();
    expect(initAppCheck({ app: "web" })).toBe(true);
    expect(mockConfigure).toHaveBeenCalledWith({
      android: { provider: "playIntegrity" },
      apple: { provider: "appAttestWithDeviceCheckFallback" },
    });
    expect(mockNativeInit).toHaveBeenCalledTimes(1);
    expect(mockWebInit).toHaveBeenCalledTimes(1);
    expect(mockWebInit.mock.calls[0][0]).toEqual({ app: "web" });
  });

  test("yerel jeton web SDK'ya geçer; hata yoksa Sentry'ye bir şey gitmez", async () => {
    const { initAppCheck } = loadAppCheck();
    initAppCheck({});
    mockNativeGetToken.mockResolvedValueOnce({ token: "tok-123" });
    const out = await webGetToken()(true);
    expect(out.token).toBe("tok-123");
    expect(out.expireTimeMillis).toBeGreaterThan(Date.now());
    expect(mockNativeGetToken).toHaveBeenCalledWith({ native: true }, true);
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  test("yerel jeton alınamazsa fırlatır ve sebep oturum başına BİR KEZ bildirilir", async () => {
    const { initAppCheck } = loadAppCheck();
    initAppCheck({});
    const integrity = Object.assign(new Error("App is not installed by Google Play"), { code: "app-check/unknown" });
    mockNativeGetToken.mockRejectedValue(integrity);
    await expect(webGetToken()(false)).rejects.toThrow("AppCheck token unavailable");
    await expect(webGetToken()(false)).rejects.toThrow("AppCheck token unavailable");
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
    const [error, { tags }] = mockCaptureError.mock.calls[0];
    expect(error.message).toContain("App is not installed by Google Play");
    expect(tags).toEqual({ label: "AppCheck/getToken", appCheckCode: "app-check/unknown" });

    // Farklı bir sebep ayrıca bildirilir.
    mockNativeGetToken.mockRejectedValueOnce(new Error("network"));
    await expect(webGetToken()(false)).rejects.toThrow();
    expect(mockCaptureError).toHaveBeenCalledTimes(2);
    expect(mockCaptureError.mock.calls[1][1].tags.appCheckCode).toBe("none");
  });

  test("boş jeton da hata sayılır ve bildirilir (sahte jeton gönderilmez)", async () => {
    const { initAppCheck } = loadAppCheck();
    initAppCheck({});
    mockNativeGetToken.mockResolvedValueOnce({ token: "   " });
    await expect(webGetToken()(false)).rejects.toThrow("AppCheck token unavailable");
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
    expect(mockCaptureError.mock.calls[0][0].message).toContain("empty token");
  });

  test("ikinci çağrı yeniden kurmaz", () => {
    const { initAppCheck } = loadAppCheck();
    initAppCheck({});
    expect(initAppCheck({})).toBe(true);
    expect(mockNativeInit).toHaveBeenCalledTimes(1);
  });
});

describe("geliştirme build'i", () => {
  test("varsayılan: App Check kurulmaz (jetonsuz istek; davranış eskisi gibi)", () => {
    const { initAppCheck } = loadAppCheck({ dev: true });
    expect(initAppCheck({})).toBe(true);
    expect(mockConfigure).not.toHaveBeenCalled();
    expect(mockNativeInit).not.toHaveBeenCalled();
    expect(mockWebInit).not.toHaveBeenCalled();
  });

  test("EXPO_PUBLIC_APPCHECK_DEBUG=1: iki platformda debug sağlayıcı + web köprüsü", () => {
    const { initAppCheck } = loadAppCheck({ dev: true, debugFlag: "1" });
    expect(initAppCheck({})).toBe(true);
    expect(mockConfigure).toHaveBeenCalledWith({
      android: { provider: "debug" },
      apple: { provider: "debug" },
    });
    expect(mockWebInit).toHaveBeenCalledTimes(1);
  });

  test("bayrak yayın build'ini etkilemez", () => {
    const { initAppCheck } = loadAppCheck({ dev: false, debugFlag: "1" });
    initAppCheck({});
    expect(mockConfigure.mock.calls[0][0].android.provider).toBe("playIntegrity");
  });
});
