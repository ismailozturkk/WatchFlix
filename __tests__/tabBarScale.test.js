// services/tabBarScale.js — yerel sekme çubuğu ölçekleme köprüsünün JS yüzü.
// Modül import anında yoklandığı için her senaryo yalıtılmış modül kaydıyla yüklenir.

const { TAB_BAR_MIN_SCALE } = require("../utils/tabBarCollapse");

function load({ os = "ios", native, enabled = true } = {}) {
  const requireOptional = jest.fn(() => native);
  let mod;
  jest.isolateModules(() => {
    jest.doMock("react-native", () => ({ Platform: { OS: os } }));
    jest.doMock("expo-modules-core", () => ({ requireOptionalNativeModule: requireOptional }));
    jest.doMock("../utils/tabBarCollapse", () => ({
      ...jest.requireActual("../utils/tabBarCollapse"),
      TAB_BAR_NATIVE_SCALE_ENABLED: enabled,
    }));
    mod = require("../services/tabBarScale");
  });
  return { ...mod, requireOptional };
}

const fakeNative = (overrides = {}) => ({
  isSupported: jest.fn(() => true),
  setProgress: jest.fn(),
  reset: jest.fn(),
  ...overrides,
});

describe("tabBarScale service", () => {
  it("is available on iOS when the module exists and says the OS supports it", () => {
    const { nativeTabBarScaleAvailable, requireOptional } = load({ native: fakeNative() });
    expect(requireOptional).toHaveBeenCalledWith("SeelogdTabBarScale");
    expect(nativeTabBarScaleAvailable).toBe(true);
  });

  it("is off — and the app unaffected — when the binary predates the module", () => {
    const mod = load({ native: null });
    expect(mod.nativeTabBarScaleAvailable).toBe(false);
    expect(() => mod.setNativeTabBarProgress(0.5)).not.toThrow();
    expect(() => mod.resetNativeTabBarScale()).not.toThrow();
  });

  it("is off when the OS is too old for the floating bar (module says unsupported)", () => {
    const native = fakeNative({ isSupported: jest.fn(() => false) });
    const mod = load({ native });
    expect(mod.nativeTabBarScaleAvailable).toBe(false);
    mod.setNativeTabBarProgress(0.5);
    mod.resetNativeTabBarScale();
    expect(native.setProgress).not.toHaveBeenCalled();
    expect(native.reset).not.toHaveBeenCalled();
  });

  it("is off if the support probe itself throws", () => {
    const native = fakeNative({ isSupported: jest.fn(() => { throw new Error("boom"); }) });
    expect(load({ native }).nativeTabBarScaleAvailable).toBe(false);
  });

  it("never looks for the module on Android", () => {
    const { nativeTabBarScaleAvailable, requireOptional } = load({ os: "android", native: fakeNative() });
    expect(requireOptional).not.toHaveBeenCalled();
    expect(nativeTabBarScaleAvailable).toBe(false);
  });

  it("can be rolled back with the single JS flag, even when the module is present", () => {
    const native = fakeNative();
    const mod = load({ native, enabled: false });
    expect(mod.nativeTabBarScaleAvailable).toBe(false);
    mod.setNativeTabBarProgress(1);
    expect(native.setProgress).not.toHaveBeenCalled();
  });

  it("forwards progress together with the shared 20% minimum scale", () => {
    const native = fakeNative();
    const mod = load({ native });
    mod.setNativeTabBarProgress(0.5);
    expect(native.setProgress).toHaveBeenCalledWith(0.5, TAB_BAR_MIN_SCALE);
    expect(TAB_BAR_MIN_SCALE).toBeCloseTo(0.8, 10);
  });

  it("forwards reset", () => {
    const native = fakeNative();
    load({ native }).resetNativeTabBarScale();
    expect(native.reset).toHaveBeenCalledTimes(1);
  });

  it("swallows bridge errors — a cosmetic effect must never break the tab bar", () => {
    const native = fakeNative({
      setProgress: jest.fn(() => { throw new Error("bridge"); }),
      reset: jest.fn(() => { throw new Error("bridge"); }),
    });
    const mod = load({ native });
    expect(() => mod.setNativeTabBarProgress(0.3)).not.toThrow();
    expect(() => mod.resetNativeTabBarScale()).not.toThrow();
  });
});
