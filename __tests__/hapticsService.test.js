// __tests__/hapticsService.test.js
//
// İki ayrı sözleşme:
//
// 1) TERCİH (MMKV geçişi): tercih SENKRON okunuyor — modül yüklenir yüklenmez
//    doğru değer geçerli, eskisi gibi bir promise beklenmiyor. Servis anahtarın
//    TEK sahibi: AppSettingsContext yalnız yazıyor, buradaki abonelik yakalıyor.
//
// 2) POLİTİKA ("titreşim az olsun"): sıradan dokunuşlar (selection, Light impact)
//    SESSİZ; yalnız baskı (Medium+), başarı, uyarı ve hata titreşir; art arda
//    gelenler tek vuruşa iner; Android'de önce cihazın kendi efekti denenir.

const { withSeededStorage } = require("./helpers/storageTestKit");

const loadService = ({ stored = true, os = "ios", native = {} } = {}) => {
  jest.resetModules();
  const nativeHaptics = {
    ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
    NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
    AndroidHaptics: {},
    selectionAsync: jest.fn(() => Promise.resolve()),
    impactAsync: jest.fn(() => Promise.resolve()),
    notificationAsync: jest.fn(() => Promise.resolve()),
    performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
    ...native,
  };
  jest.doMock("expo-haptics", () => nativeHaptics);
  jest.doMock("react-native", () => ({ Platform: { OS: os } }));

  const service = withSeededStorage(
    (Keys) => [[Keys.haptics, stored]],
    () => require("../services/hapticsService"),
  );

  return { service, nativeHaptics, storage: require("../services/storage") };
};

// Kısma kapısı `Date.now()`'a bakar; testler saati elle ilerletir.
let nowMs;
beforeEach(() => {
  nowMs = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => nowMs);
});
const advance = (ms) => {
  nowMs += ms;
};

describe("hapticsService — tercih", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    jest.dontMock("expo-haptics");
    jest.dontMock("react-native");
  });

  test("kayıtlı tercih kapalıyken hiçbir native haptic çağrısı yapmaz", async () => {
    const { service, nativeHaptics } = loadService({ stored: false });

    await service.selectionAsync();
    await service.impactAsync(service.ImpactFeedbackStyle.Heavy);
    advance(1000);
    await service.notificationAsync(service.NotificationFeedbackType.Error);

    expect(nativeHaptics.selectionAsync).not.toHaveBeenCalled();
    expect(nativeHaptics.impactAsync).not.toHaveBeenCalled();
    expect(nativeHaptics.notificationAsync).not.toHaveBeenCalled();
    expect(nativeHaptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });

  test("kayıt yokken varsayılan KAPALI", async () => {
    jest.resetModules();
    jest.doMock("expo-haptics", () => ({
      ImpactFeedbackStyle: { Medium: "medium" },
      NotificationFeedbackType: { Success: "success" },
      AndroidHaptics: {},
    }));
    jest.doMock("react-native", () => ({ Platform: { OS: "ios" } }));
    const service = require("../services/hapticsService");
    expect(service.isHapticsEnabled()).toBe(false);
  });

  test("ayar açılınca ortak servis üzerinden titreşime izin verir", async () => {
    const { service, nativeHaptics } = loadService({ stored: false });

    service.setHapticsEnabled(true);
    await service.impactAsync(service.ImpactFeedbackStyle.Medium);

    expect(nativeHaptics.impactAsync).toHaveBeenCalledWith("medium");
  });

  test("ayar tekrar kapatılınca sonraki çağrıları anında engeller", async () => {
    const { service, nativeHaptics } = loadService({ stored: true });

    await service.impactAsync(service.ImpactFeedbackStyle.Medium);
    service.setHapticsEnabled(false);
    advance(1000);
    await service.impactAsync(service.ImpactFeedbackStyle.Medium);

    expect(nativeHaptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  test("anahtar BASKA bir yerden degisirse abonelik yakalar", async () => {
    // AppSettingsContext dogrudan depoya yaziyor; servis kendi aynasini
    // tazelemeli. Eski kodda bunun icin ayrica setHapticsEnabled itmesi vardi.
    const { service, nativeHaptics, storage } = loadService({ stored: false });

    storage.set(storage.Keys.haptics, true);
    await service.impactAsync(service.ImpactFeedbackStyle.Medium);

    expect(nativeHaptics.impactAsync).toHaveBeenCalledTimes(1);
  });
});

describe("hapticsService — ne titreşir", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    jest.dontMock("expo-haptics");
    jest.dontMock("react-native");
  });

  test("sıradan dokunuşlar SESSİZ: selection ve Light impact", async () => {
    const { service, nativeHaptics } = loadService();

    await service.selectionAsync();
    advance(1000);
    await service.impactAsync(service.ImpactFeedbackStyle.Light);
    advance(1000);
    await service.triggerHaptic("selection");

    expect(nativeHaptics.selectionAsync).not.toHaveBeenCalled();
    expect(nativeHaptics.impactAsync).not.toHaveBeenCalled();
  });

  test("baskı, başarı, uyarı ve hata titreşir (iOS)", async () => {
    const { service, nativeHaptics } = loadService();
    const { ImpactFeedbackStyle: I, NotificationFeedbackType: N } = service;

    await service.impactAsync(I.Medium);
    advance(1000);
    await service.impactAsync(I.Heavy);
    advance(1000);
    await service.notificationAsync(N.Success);
    advance(1000);
    await service.notificationAsync(N.Warning);
    advance(1000);
    await service.notificationAsync(N.Error);

    expect(nativeHaptics.impactAsync.mock.calls).toEqual([["medium"], ["heavy"]]);
    expect(nativeHaptics.notificationAsync.mock.calls).toEqual([
      ["success"],
      ["warning"],
      ["error"],
    ]);
  });

  test("triggerHaptic eski adlarını korur, hata yolu için 'error' var", async () => {
    const { service, nativeHaptics } = loadService();

    await service.triggerHaptic("impact");
    advance(1000);
    await service.triggerHaptic("notification");
    advance(1000);
    await service.triggerHaptic("error");
    advance(1000);
    await service.triggerHaptic("warning");

    expect(nativeHaptics.impactAsync).toHaveBeenCalledWith("medium");
    expect(nativeHaptics.notificationAsync.mock.calls).toEqual([
      ["success"],
      ["error"],
      ["warning"],
    ]);
  });

  test("roleForImpact / roleForNotification politika tablosunu açıkça söyler", () => {
    const { service } = loadService();

    expect(service.roleForImpact("light")).toBeNull();
    expect(service.roleForImpact("soft")).toBeNull();
    expect(service.roleForImpact("medium")).toBe("press");
    expect(service.roleForImpact("rigid")).toBe("press");
    expect(service.roleForImpact("heavy")).toBe("press");
    expect(service.roleForNotification("success")).toBe("success");
    expect(service.roleForNotification("warning")).toBe("warning");
    expect(service.roleForNotification("error")).toBe("error");
  });
});

describe("hapticsService — art arda titreşim tek vuruşa iner", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    jest.dontMock("expo-haptics");
    jest.dontMock("react-native");
  });

  test("aralık dolmadan gelen ikinci titreşim düşer, dolunca geçer", async () => {
    const { service, nativeHaptics } = loadService();
    const { ImpactFeedbackStyle: I, NotificationFeedbackType: N } = service;

    await service.impactAsync(I.Medium);
    advance(service.HAPTIC_MIN_GAP_MS - 1);
    await service.notificationAsync(N.Success); // aralık içinde → düşer
    expect(nativeHaptics.notificationAsync).not.toHaveBeenCalled();

    advance(1);
    await service.notificationAsync(N.Success); // tam aralıkta → geçer
    expect(nativeHaptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  test("sessiz çağrılar kapıyı tüketmez", async () => {
    const { service, nativeHaptics } = loadService();

    await service.selectionAsync();
    await service.impactAsync(service.ImpactFeedbackStyle.Light);
    await service.impactAsync(service.ImpactFeedbackStyle.Medium);

    expect(nativeHaptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  test("saat geri alınırsa kapı sonsuza dek kapalı kalmaz", async () => {
    const { service, nativeHaptics } = loadService();

    await service.impactAsync(service.ImpactFeedbackStyle.Medium);
    advance(-60 * 60 * 1000);
    await service.impactAsync(service.ImpactFeedbackStyle.Medium);

    expect(nativeHaptics.impactAsync).toHaveBeenCalledTimes(2);
  });

  test("previewHaptic kapıyı sıfırlar ve tercih kapalıysa susar", async () => {
    const acik = loadService();
    await acik.service.impactAsync(acik.service.ImpactFeedbackStyle.Medium);
    await acik.service.previewHaptic(); // aralık dolmadı ama önizleme geçer
    expect(acik.nativeHaptics.impactAsync).toHaveBeenCalledTimes(2);

    const kapali = loadService({ stored: false });
    await kapali.service.previewHaptic();
    expect(kapali.nativeHaptics.impactAsync).not.toHaveBeenCalled();
  });
});

describe("hapticsService — Android", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    jest.dontMock("expo-haptics");
    jest.dontMock("react-native");
  });

  test("önce cihazın kendi efektini kullanır, Vibrator yoluna inmez", async () => {
    const { service, nativeHaptics } = loadService({ os: "android" });
    const { ImpactFeedbackStyle: I, NotificationFeedbackType: N } = service;

    await service.impactAsync(I.Medium);
    advance(1000);
    await service.notificationAsync(N.Success);
    advance(1000);
    await service.notificationAsync(N.Error);
    advance(1000);
    await service.notificationAsync(N.Warning);

    expect(nativeHaptics.performAndroidHapticsAsync.mock.calls).toEqual([
      ["long-press"],
      ["confirm"],
      ["reject"],
      ["context-click"],
    ]);
    expect(nativeHaptics.impactAsync).not.toHaveBeenCalled();
    expect(nativeHaptics.notificationAsync).not.toHaveBeenCalled();
  });

  test("sessiz çağrılar Android'de de hiçbir şey çalmaz", async () => {
    const { service, nativeHaptics } = loadService({ os: "android" });

    await service.selectionAsync();
    await service.impactAsync(service.ImpactFeedbackStyle.Light);

    expect(nativeHaptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
    expect(nativeHaptics.impactAsync).not.toHaveBeenCalled();
  });

  test("cihaz efekti yoksa (Confirm/Reject < API 30) Vibrator yoluna düşer", async () => {
    const { service, nativeHaptics } = loadService({
      os: "android",
      native: {
        performAndroidHapticsAsync: jest.fn(() =>
          Promise.reject(new Error("This device doesn't support the selected haptic type")),
        ),
      },
    });

    await service.notificationAsync(service.NotificationFeedbackType.Success);

    expect(nativeHaptics.performAndroidHapticsAsync).toHaveBeenCalledWith("confirm");
    expect(nativeHaptics.notificationAsync).toHaveBeenCalledWith("success");
  });

  test("iOS'ta Android efektine hiç dokunmaz", async () => {
    const { service, nativeHaptics } = loadService({ os: "ios" });

    await service.notificationAsync(service.NotificationFeedbackType.Success);

    expect(nativeHaptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
    expect(nativeHaptics.notificationAsync).toHaveBeenCalledWith("success");
  });
});

describe("hapticsService — sözleşme", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    jest.dontMock("expo-haptics");
    jest.dontMock("react-native");
  });

  // REGRESYON KILIDI: MMKV gecisinde bekleme kalkinca bu sarmalayicilar bir ara
  // sade fonksiyona cevrilmisti ve titresim KAPALIYKEN `undefined` donuyordu.
  // ~40 cagri yeri `Haptics.selectionAsync().catch(() => {})` yaziyor; tema
  // secmek bile "Cannot read property 'catch' of undefined" ile patliyordu.
  // Politikayla birlikte bu dal genisledi: SESSIZ cagrilar da zincirlenebilmeli.
  test.each([true, false])(
    "tercih %s iken de HER ZAMAN zincirlenebilir bir Promise doner",
    async (tercih) => {
      const { service } = loadService({ stored: tercih });

      for (const cagri of [
        () => service.selectionAsync(),
        () => service.impactAsync(service.ImpactFeedbackStyle.Light),
        () => service.impactAsync(service.ImpactFeedbackStyle.Medium),
        () => service.notificationAsync(service.NotificationFeedbackType.Success),
        () => service.performAndroidHapticsAsync("tick"),
        () => service.triggerHaptic("selection"),
        () => service.triggerHaptic("error"),
        () => service.previewHaptic(),
      ]) {
        advance(1000);
        const sonuc = cagri();
        expect(typeof sonuc?.then).toBe("function");
        expect(typeof sonuc?.catch).toBe("function");
        await expect(sonuc).resolves.toBeUndefined();
      }
    },
  );

  test("native katman fırlatsa bile ASLA reddedilmez, ortalığı yıkmaz", async () => {
    // Eskiden reddedilirdi ve `.catch`siz çağrı yerleri (RatingInput, Comment,
    // ProfileScreen…) işlenmemiş promise reddi üretirdi.
    const throwing = () => {
      throw new Error("native modul yok");
    };
    const { service } = loadService({
      native: { impactAsync: throwing, notificationAsync: throwing },
    });

    await expect(service.impactAsync(service.ImpactFeedbackStyle.Medium)).resolves.toBeUndefined();
    advance(1000);
    await expect(
      service.notificationAsync(service.NotificationFeedbackType.Error),
    ).resolves.toBeUndefined();
  });
});
