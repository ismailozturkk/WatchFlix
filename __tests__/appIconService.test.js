// services/appIconService.js — destek durumu.
//
// Ayar kartı yalnız "supported" iken çizilir; diğer iki durum geliştirme
// build'inde kartın NEDEN yok olduğunu söyler (eski native build / eski
// android/ prebuild'i). Yanlış sınıflandırma, kullanıcıyı yanlış çözüme (ör.
// zaten yeni olan binary'yi yeniden derletmeye) götürür.

const loadService = (nativeModule) => {
  jest.resetModules();
  jest.doMock("react-native", () => ({ Platform: { OS: "android" } }));
  jest.doMock("expo-modules-core", () => ({
    requireOptionalNativeModule: () => nativeModule,
  }));
  // Widget servisi RN/Firebase zincirine bağlı; bu testte yalnız yan etki olarak
  // çağrılır (setActiveAppIcon) — durum fonksiyonlarıyla ilgisi yok.
  jest.doMock("../services/widgetPreferencesService", () => ({
    loadWidgetPreferences: jest.fn(() => Promise.resolve({})),
    syncWidgetPreferences: jest.fn(() => Promise.resolve()),
  }));
  jest.doMock("../services/appIconStore", () => ({ setAppIconId: jest.fn() }));
  return require("../services/appIconService");
};

afterEach(() => jest.resetModules());

describe("getAppIconSupportStatus", () => {
  test("native modül yoksa no-module (Expo Go / modülden önce alınmış build)", async () => {
    const { getAppIconSupportStatus } = loadService(null);
    await expect(getAppIconSupportStatus()).resolves.toBe("no-module");
  });

  test("modül var ama alias/cihaz desteği yoksa unsupported", async () => {
    const { getAppIconSupportStatus } = loadService({
      isSupportedAsync: jest.fn(() => Promise.resolve(false)),
    });
    await expect(getAppIconSupportStatus()).resolves.toBe("unsupported");
  });

  test("destek sorgusu hata verirse unsupported (kart çökmez)", async () => {
    const { getAppIconSupportStatus } = loadService({
      isSupportedAsync: jest.fn(() => Promise.reject(new Error("boom"))),
    });
    await expect(getAppIconSupportStatus()).resolves.toBe("unsupported");
  });

  test("modül ve destek varsa supported", async () => {
    const { getAppIconSupportStatus } = loadService({
      isSupportedAsync: jest.fn(() => Promise.resolve(true)),
    });
    await expect(getAppIconSupportStatus()).resolves.toBe("supported");
  });
});

// Katalog (JS, OTA ile gelir) native build'den önce büyüyebilir. Eski Android modülü
// listedeki HER alias'ı kapatmaya çalışıyor ve bulamadığında tüm değişimi düşürüyordu:
// yeni simgeler eklenince Cam/Varsayılan bile "Simge değiştirilemedi" verdi.
describe("bu yapıda olmayan simgeler native'e gönderilmez", () => {
  const nativeWith = (extra) => ({
    isSupportedAsync: jest.fn(() => Promise.resolve(true)),
    getAppIconNameAsync: jest.fn(() => Promise.resolve("Default")),
    setAppIconNameAsync: jest.fn((name) => Promise.resolve(name)),
    ...extra,
  });

  test("eski build (sorgu yok): yalnız Default + Glass gönderilir", async () => {
    const native = nativeWith();
    const { setActiveAppIcon, getAvailableAppIconIds } = loadService(native);
    await expect(getAvailableAppIconIds()).resolves.toEqual(["default", "glass"]);
    await expect(setActiveAppIcon("glass")).resolves.toBe("glass");
    expect(native.setAppIconNameAsync).toHaveBeenCalledWith("Glass", ["Default", "Glass"]);
  });

  test("eski build: olmayan simge native'e ulaşmadan reddedilir", async () => {
    const native = nativeWith();
    const { setActiveAppIcon } = loadService(native);
    await expect(setActiveAppIcon("flat")).rejects.toThrow(/Flat/);
    expect(native.setAppIconNameAsync).not.toHaveBeenCalled();
  });

  test("yeni build: native'in bildirdiği küme kullanılır (katalog sırasıyla)", async () => {
    const native = nativeWith({
      getAvailableNamesAsync: jest.fn(() => Promise.resolve(["Flat", "Default", "Glass"])),
    });
    const { setActiveAppIcon, getAvailableAppIconIds } = loadService(native);
    await expect(getAvailableAppIconIds()).resolves.toEqual(["default", "glass", "flat"]);
    await setActiveAppIcon("flat");
    expect(native.setAppIconNameAsync).toHaveBeenCalledWith("Flat", ["Default", "Glass", "Flat"]);
  });

  test("sorgu hata verirse eski küme varsayılır", async () => {
    const native = nativeWith({ getAvailableNamesAsync: jest.fn(() => Promise.reject(new Error("x"))) });
    const { getAvailableAppIconIds } = loadService(native);
    await expect(getAvailableAppIconIds()).resolves.toEqual(["default", "glass"]);
  });
});
