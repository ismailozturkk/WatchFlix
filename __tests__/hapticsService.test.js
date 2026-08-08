// __tests__/hapticsService.test.js
//
// MMKV GECISI: tercih artik SENKRON okunuyor, yani modul yuklenir yuklenmez
// dogru deger gecerli — eskiden bir promise (hydrationPromise) bekleniyordu ve
// acilistaki ilk dokunus gecikmeli titresiyordu. Ayrica bu servis anahtarin TEK
// sahibi oldu: AppSettingsContext artik ayri bir hidrasyon yapmiyor, sadece
// yaziyor ve buradaki abonelik degisimi yakaliyor.

const { withSeededStorage } = require("./helpers/storageTestKit");

const loadService = (storedValue = true) => {
  jest.resetModules();
  const nativeHaptics = {
    ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
    NotificationFeedbackType: { Success: "success", Error: "error" },
    AndroidHaptics: {},
    selectionAsync: jest.fn(() => Promise.resolve()),
    impactAsync: jest.fn(() => Promise.resolve()),
    notificationAsync: jest.fn(() => Promise.resolve()),
    performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  };
  jest.doMock("expo-haptics", () => nativeHaptics);

  const service = withSeededStorage(
    (Keys) => [[Keys.haptics, storedValue]],
    () => require("../services/hapticsService"),
  );

  return { service, nativeHaptics, storage: require("../services/storage") };
};

describe("hapticsService", () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock("expo-haptics");
  });

  test("kayıtlı tercih kapalıyken hiçbir native haptic çağrısı yapmaz", async () => {
    const { service, nativeHaptics } = loadService(false);

    await service.selectionAsync();
    await service.impactAsync(service.ImpactFeedbackStyle.Light);
    await service.notificationAsync(service.NotificationFeedbackType.Error);

    expect(nativeHaptics.selectionAsync).not.toHaveBeenCalled();
    expect(nativeHaptics.impactAsync).not.toHaveBeenCalled();
    expect(nativeHaptics.notificationAsync).not.toHaveBeenCalled();
  });

  test("kayıt yokken varsayılan KAPALI", async () => {
    jest.resetModules();
    jest.doMock("expo-haptics", () => ({
      ImpactFeedbackStyle: { Medium: "medium" },
      NotificationFeedbackType: { Success: "success" },
      AndroidHaptics: {},
      selectionAsync: jest.fn(() => Promise.resolve()),
    }));
    const service = require("../services/hapticsService");
    expect(service.isHapticsEnabled()).toBe(false);
  });

  test("ayar açılınca ortak servis üzerinden titreşime izin verir", async () => {
    const { service, nativeHaptics } = loadService(false);

    service.setHapticsEnabled(true);
    await service.selectionAsync();
    await service.impactAsync(service.ImpactFeedbackStyle.Light);

    expect(nativeHaptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(nativeHaptics.impactAsync).toHaveBeenCalledWith("light");
  });

  test("ayar tekrar kapatılınca sonraki çağrıları anında engeller", async () => {
    const { service, nativeHaptics } = loadService(true);

    await service.selectionAsync();
    service.setHapticsEnabled(false);
    await service.selectionAsync();

    expect(nativeHaptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  // REGRESYON KILIDI: MMKV gecisinde bekleme kalkinca bu sarmalayicilar bir ara
  // sade fonksiyona cevrilmisti ve titresim KAPALIYKEN `undefined` donuyordu.
  // 16 dosyada ~40 cagri yeri `Haptics.selectionAsync().catch(() => {})` yaziyor;
  // tema secmek bile "Cannot read property 'catch' of undefined" ile patliyordu.
  test.each([true, false])(
    "tercih %s iken de HER ZAMAN zincirlenebilir bir Promise doner",
    async (tercih) => {
      const { service } = loadService(tercih);

      for (const cagri of [
        () => service.selectionAsync(),
        () => service.impactAsync(service.ImpactFeedbackStyle.Light),
        () => service.notificationAsync(service.NotificationFeedbackType.Success),
        () => service.performAndroidHapticsAsync("tick"),
      ]) {
        const sonuc = cagri();
        expect(typeof sonuc?.then).toBe("function");
        expect(typeof sonuc?.catch).toBe("function");
        await expect(sonuc).resolves.not.toThrow();
      }
    },
  );

  test("native katman senkron firlatsa bile reddedilme olur, ortaligi yikmaz", async () => {
    jest.resetModules();
    jest.doMock("expo-haptics", () => ({
      ImpactFeedbackStyle: { Medium: "medium" },
      NotificationFeedbackType: { Success: "success" },
      AndroidHaptics: {},
      selectionAsync: () => {
        throw new Error("native modul yok");
      },
    }));
    const service = withSeededStorage(
      (Keys) => [[Keys.haptics, true]],
      () => require("../services/hapticsService"),
    );

    const sonuc = service.selectionAsync();
    expect(typeof sonuc?.catch).toBe("function");
    await expect(sonuc).rejects.toThrow("native modul yok");
  });

  test("anahtar BASKA bir yerden degisirse abonelik yakalar", async () => {
    // AppSettingsContext dogrudan depoya yaziyor; servis kendi aynasini
    // tazelemeli. Eski kodda bunun icin ayrica setHapticsEnabled itmesi vardi.
    const { service, nativeHaptics, storage } = loadService(false);

    storage.set(storage.Keys.haptics, true);
    await service.selectionAsync();

    expect(nativeHaptics.selectionAsync).toHaveBeenCalledTimes(1);
  });
});
