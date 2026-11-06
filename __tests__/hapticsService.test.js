// __tests__/hapticsService.test.js
//
// İki ayrı sözleşme:
//
// 1) TERCİH (MMKV geçişi): tercih SENKRON okunuyor — modül yüklenir yüklenmez
//    doğru değer geçerli, eskisi gibi bir promise beklenmiyor. Servis anahtarın
//    TEK sahibi: AppSettingsContext yalnız yazıyor, buradaki abonelik yakalıyor.
//
// 2) POLİTİKA: "Az" (minimal) düzeyi 15 Eki'deki "titreşim az olsun" kuralının
//    aynısı — sıradan dokunuşlar (selection, Light impact) SESSİZ; yalnız baskı
//    (Medium+), başarı, uyarı ve hata titreşir; art arda gelenler tek vuruşa iner;
//    Android'de önce cihazın kendi efekti denenir. Bu bloklar `level: "minimal"`
//    ile yüklenir. Dengeli/Bol düzeyleri, kategoriler, güç kademesi ve anlamsal
//    desenler (`haptic("like")`) dosyanın sonundaki bloklarda.

const { withSeededStorage } = require("./helpers/storageTestKit");

const loadService = ({
  stored = true,
  os = "ios",
  native = {},
  level = "minimal",
  intensity = null,
  categories = null,
  vibration = null,
} = {}) => {
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
  const Vibration = vibration || { vibrate: jest.fn(), cancel: jest.fn() };
  jest.doMock("react-native", () => ({ Platform: { OS: os }, Vibration }));

  const service = withSeededStorage(
    (Keys) =>
      [
        [Keys.haptics, stored],
        level ? [Keys.hapticsLevel, level] : null,
        intensity ? [Keys.hapticsIntensity, intensity] : null,
        categories ? [Keys.hapticsCategories, categories] : null,
      ].filter(Boolean),
    () => require("../services/hapticsService"),
  );

  return { service, nativeHaptics, Vibration, storage: require("../services/storage") };
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
      ["long-press"],
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

describe("hapticsService — düzey, kategori, güç ve desenler", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    jest.dontMock("expo-haptics");
    jest.dontMock("react-native");
    jest.useRealTimers();
  });

  test("Dengeli (varsayılan) düzeyde seçim tiki çalar, hafif dokunuş susar", async () => {
    const { service, nativeHaptics } = loadService({ level: null });
    expect(service.getHapticPrefs().level).toBe("balanced");

    await service.selectionAsync();
    advance(1000);
    await service.impactAsync(service.ImpactFeedbackStyle.Light);

    expect(nativeHaptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(nativeHaptics.impactAsync).not.toHaveBeenCalled();
  });

  test("Bol düzeyde hafif dokunuş da çalar", async () => {
    const { service, nativeHaptics } = loadService({ level: "rich" });
    await service.impactAsync(service.ImpactFeedbackStyle.Light);
    expect(nativeHaptics.impactAsync).toHaveBeenCalledWith("light");
  });

  test("kapatılan kategori susar, ana anahtar açık olsa da", async () => {
    const { service, nativeHaptics } = loadService({ level: "rich", categories: { games: false } });
    await service.haptic("wrong");
    advance(1000);
    await service.haptic("success");
    expect(nativeHaptics.notificationAsync.mock.calls).toEqual([["success"]]);
  });

  test("setHapticCategory / setHapticLevel / setHapticIntensity anında etkili ve kalıcı", async () => {
    const { service, nativeHaptics, storage } = loadService({ level: "minimal" });

    expect(service.setHapticLevel("rich")).toBe(true);
    expect(service.setHapticLevel("abartı")).toBe(false);
    await service.impactAsync(service.ImpactFeedbackStyle.Light);
    expect(nativeHaptics.impactAsync).toHaveBeenCalledWith("light");

    service.setHapticCategory("social", false);
    expect(storage.get(storage.Keys.hapticsCategories)).toMatchObject({ social: false });
    service.setHapticCategory("social", true);
    expect(storage.get(storage.Keys.hapticsCategories)).toBeNull(); // hepsi açık = varsayılan

    service.setHapticIntensity("strong");
    advance(1000);
    await service.impactAsync(service.ImpactFeedbackStyle.Medium);
    expect(nativeHaptics.impactAsync).toHaveBeenLastCalledWith("heavy");
  });

  test("çok adımlı desen: ilk vuruş hemen, sonrakiler zamanlayıcıyla", async () => {
    jest.useFakeTimers({ doNotFake: ["Date"] });
    const { service, nativeHaptics } = loadService({ level: "balanced" });

    await service.haptic("like");
    expect(nativeHaptics.impactAsync.mock.calls).toEqual([["light"]]);
    jest.advanceTimersByTime(90);
    await Promise.resolve();
    expect(nativeHaptics.impactAsync.mock.calls).toEqual([["light"], ["medium"]]);
  });

  test("yüksek öncelikli desen düşük öncelikli olanın kalan adımlarını iptal eder", async () => {
    jest.useFakeTimers({ doNotFake: ["Date"] });
    const { service, nativeHaptics } = loadService({ level: "balanced" });

    await service.haptic("like"); // light @0, medium @90
    advance(20);
    await service.haptic("error"); // öncelik 4 > 2 → keser
    jest.advanceTimersByTime(200);
    await Promise.resolve();

    expect(nativeHaptics.impactAsync.mock.calls).toEqual([["light"]]);
    expect(nativeHaptics.notificationAsync.mock.calls).toEqual([["error"]]);
  });

  test("düşük öncelikli istek kutlamanın penceresinde düşer", async () => {
    jest.useFakeTimers({ doNotFake: ["Date"] });
    const { service, nativeHaptics } = loadService({ level: "balanced" });

    await service.haptic("badge");
    advance(100);
    await service.selectionAsync();
    expect(nativeHaptics.selectionAsync).not.toHaveBeenCalled();
  });

  test("tikler kısa arayla akar (sürükleme/kaydırıcı)", async () => {
    const { service, nativeHaptics } = loadService({ level: "balanced" });
    for (let i = 0; i < 5; i += 1) {
      await service.haptic("sliderTick");
      advance(35);
    }
    expect(nativeHaptics.selectionAsync).toHaveBeenCalledTimes(5);
  });

  test("triggerHaptic desen adlarını da kabul eder", async () => {
    const { service, nativeHaptics } = loadService({ level: "balanced" });
    await service.triggerHaptic("reaction");
    expect(nativeHaptics.impactAsync).toHaveBeenCalledWith("light");
  });

  test("previewPattern düzey/kategori filtresini atlar ama ana anahtara uyar", async () => {
    const acik = loadService({ level: "minimal", categories: { navigation: false } });
    await acik.service.previewPattern("select");
    expect(acik.nativeHaptics.selectionAsync).toHaveBeenCalledTimes(1);

    const kapali = loadService({ stored: false });
    await kapali.service.previewPattern("select");
    expect(kapali.nativeHaptics.selectionAsync).not.toHaveBeenCalled();
  });

  test("previewPattern verilen güçle çalar (seçim yaparken hissettirmek için)", async () => {
    const { service, nativeHaptics } = loadService({ intensity: "normal" });
    await service.previewPattern("press", { intensity: "soft" });
    expect(nativeHaptics.impactAsync).toHaveBeenCalledWith("light");
  });

  test("bilinmeyen desen adı sessizce yok sayılır", async () => {
    const { service, nativeHaptics } = loadService({ level: "rich" });
    await expect(service.haptic("yok-boyle")).resolves.toBeUndefined();
    expect(nativeHaptics.impactAsync).not.toHaveBeenCalled();
  });

  test("tercih aboneliği anahtar değişince haber verir", () => {
    const { service, storage } = loadService();
    const listener = jest.fn();
    const off = service.subscribeHapticPrefs(listener);
    storage.set(storage.Keys.hapticsLevel, "rich");
    expect(listener).toHaveBeenCalled();
    expect(service.getHapticPrefs().level).toBe("rich");
    off();
  });
});

describe("hapticsService — Android ince ayar", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    jest.dontMock("expo-haptics");
    jest.dontMock("react-native");
  });

  test("hafif atomun zinciri biterse Vibrator'a DÜŞMEZ (zırlama yok)", async () => {
    const { service, nativeHaptics } = loadService({
      os: "android",
      level: "balanced",
      native: { performAndroidHapticsAsync: jest.fn(() => Promise.reject(new Error("yok"))) },
    });
    await service.selectionAsync();
    expect(nativeHaptics.performAndroidHapticsAsync.mock.calls).toEqual([["segment-tick"], ["clock-tick"]]);
    expect(nativeHaptics.selectionAsync).not.toHaveBeenCalled();
    expect(nativeHaptics.impactAsync).not.toHaveBeenCalled();
  });

  test("desteklenmeyen sabit önbelleğe alınır, ikinci seferde doğrudan yedeğe geçer", async () => {
    const perform = jest.fn((type) =>
      type === "segment-tick" ? Promise.reject(new Error("API < 34")) : Promise.resolve(),
    );
    const { service } = loadService({ os: "android", level: "balanced", native: { performAndroidHapticsAsync: perform } });
    await service.selectionAsync();
    advance(1000);
    await service.selectionAsync();
    expect(perform.mock.calls).toEqual([["segment-tick"], ["clock-tick"], ["clock-tick"]]);
  });

  test("strong güç tüm deseni tek Vibration dalga formuyla çalar", async () => {
    const { service, nativeHaptics, Vibration } = loadService({
      os: "android",
      level: "balanced",
      intensity: "strong",
    });
    await service.haptic("like");
    expect(Vibration.cancel).toHaveBeenCalled();
    expect(Vibration.vibrate).toHaveBeenCalledWith([0, 12, 78, 18]);
    expect(nativeHaptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });
});
