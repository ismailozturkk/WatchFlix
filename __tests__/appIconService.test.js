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
