// __tests__/blurSupport.test.js
// "Bu blur gercekten cizilecek mi?" karar tablosunun sozlesmesi.
//
// REGRESYON KILIDI: proje SDK 54 -> 57'ye atlarken expo-blur 55'in kirici
// degisikligi (Android'de `blurTarget` zorunlulugu) fark edilmedi; Android'de
// blur veren 19 cagri yeri cokmeden, log basmadan duz karartmaya dustu. Karar
// artik burada ACIKCA veriliyor ve test ediliyor.

const {
  ANDROID_BLUR_METHOD,
  ANDROID_BLUR_MIN_API,
  androidSupportsNativeBlur,
  blurFallbackAlpha,
  isUserDisabledBlur,
  resolveBlurPlan,
  unavailableBlurLayer,
} = require("../utils/blurSupport");

describe("androidSupportsNativeBlur", () => {
  test("API 31 ve ustu destekler", () => {
    expect(androidSupportsNativeBlur(31)).toBe(true);
    expect(androidSupportsNativeBlur(34)).toBe(true);
  });

  test("API 30 ve altinda RenderScript'e duserdi; desteklemiyoruz", () => {
    expect(androidSupportsNativeBlur(30)).toBe(false);
    expect(androidSupportsNativeBlur(21)).toBe(false);
  });

  test("sayi olmayan surum (iOS'ta Platform.Version bir string) destek saymaz", () => {
    expect(androidSupportsNativeBlur("17.0")).toBe(false);
    expect(androidSupportsNativeBlur(null)).toBe(false);
    expect(androidSupportsNativeBlur(undefined)).toBe(false);
  });

  test("esik sabiti degismediyse 31", () => {
    expect(ANDROID_BLUR_MIN_API).toBe(31);
  });
});

describe("resolveBlurPlan — efekt modu", () => {
  test("mod kapaliyken hicbir platformda native blur yok", () => {
    for (const platform of ["ios", "android"]) {
      const plan = resolveBlurPlan({
        platform,
        apiLevel: 34,
        blurEnabled: false,
        hasTarget: true,
      });
      expect(plan.native).toBe(false);
      expect(plan.reason).toBe("mod-kapali");
    }
  });
});

describe("resolveBlurPlan — iOS", () => {
  test("hedef gerekmez, API sinirlamasi yok", () => {
    const plan = resolveBlurPlan({ platform: "ios", blurEnabled: true, hasTarget: false });
    expect(plan.native).toBe(true);
    // iOS'ta blurMethod ANLAMSIZ; gonderirsek expo-blur'e olu prop geciririz.
    expect(plan.blurMethod).toBeUndefined();
  });
});

describe("resolveBlurPlan — Android", () => {
  test("API 31+ VE hedef varsa gercek blur", () => {
    const plan = resolveBlurPlan({
      platform: "android",
      apiLevel: 34,
      blurEnabled: true,
      hasTarget: true,
    });
    expect(plan.native).toBe(true);
    expect(plan.blurMethod).toBe(ANDROID_BLUR_METHOD);
  });

  // BU TESTIN VARLIK SEBEBI: expo-blur 55'ten beri hedefsiz BlurView blur
  // CIZMEZ, sessizce duz katmana duser ve her mount'ta uyari basar. O yola hic
  // girmiyoruz.
  test("hedef YOKSA native blur kurulmaz", () => {
    const plan = resolveBlurPlan({
      platform: "android",
      apiLevel: 34,
      blurEnabled: true,
      hasTarget: false,
    });
    expect(plan.native).toBe(false);
    expect(plan.reason).toBe("android-hedef-yok");
  });

  test("API 31 altinda hedef olsa bile native blur kurulmaz", () => {
    const plan = resolveBlurPlan({
      platform: "android",
      apiLevel: 30,
      blurEnabled: true,
      hasTarget: true,
    });
    expect(plan.native).toBe(false);
    expect(plan.reason).toBe("android-eski-api");
  });

  test("tam esikte (31) blur acilir", () => {
    expect(
      resolveBlurPlan({
        platform: "android",
        apiLevel: ANDROID_BLUR_MIN_API,
        blurEnabled: true,
        hasTarget: true,
      }).native,
    ).toBe(true);
  });
});

describe("resolveBlurPlan — bilinmeyen platform", () => {
  test("web/diger duz katmana duser", () => {
    const plan = resolveBlurPlan({ platform: "web", blurEnabled: true, hasTarget: true });
    expect(plan.native).toBe(false);
  });

  test("argumansiz cagri patlamaz", () => {
    expect(resolveBlurPlan().native).toBe(false);
  });
});

describe("blurFallbackAlpha", () => {
  test("intensity ile artar", () => {
    expect(blurFallbackAlpha(25)).toBeLessThan(blurFallbackAlpha(60));
    expect(blurFallbackAlpha(60)).toBeLessThan(blurFallbackAlpha(90));
  });

  test("taban 0.30'un altina inmez (zayif blur'da bile metin okunur)", () => {
    expect(blurFallbackAlpha(1)).toBeGreaterThanOrEqual(0.3);
    expect(blurFallbackAlpha(10)).toBeGreaterThanOrEqual(0.3);
  });

  test("tavan 0.85'i asmaz (altindaki icerik sezilir kalir)", () => {
    expect(blurFallbackAlpha(100)).toBeLessThanOrEqual(0.85);
    expect(blurFallbackAlpha(999)).toBeLessThanOrEqual(0.85);
  });

  test("gecersiz/eksik deger 50 varsayilir", () => {
    const v = blurFallbackAlpha(50);
    expect(blurFallbackAlpha()).toBe(v);
    expect(blurFallbackAlpha(0)).toBe(v);
    expect(blurFallbackAlpha(-10)).toBe(v);
    expect(blurFallbackAlpha("60")).toBe(v);
  });
});

describe("blur KAPATILDI ile KULLANILAMIYOR ayrimi", () => {
  // REGRESYON KILIDI — bildirilen hata: ilk surumde bu ayrim yoktu, iki durumda
  // da "efektler kapali" egrisi kullanildi ve Android'deki TUM yari saydam cam
  // yuzeyler bir anda mat panele dondu ("blur kayboldu").
  test("kullanilamiyor katmani, kapatildi katmanindan DAHA SAYDAM", () => {
    for (const i of [18, 25, 28, 40, 50, 60, 80]) {
      expect(unavailableBlurLayer(i, "dark").alpha).toBeLessThan(blurFallbackAlpha(i));
    }
  });

  // Katsayilar expo-blur'un Android tarafindan (TintStyle.toColorInt) birebir
  // alindi; ekran gorunumu yukseltme oncesiyle ayni kalmali.
  test("expo-blur'un kendi katmanini birebir taklit eder", () => {
    expect(unavailableBlurLayer(50, "dark")).toEqual({
      color: "#191919",
      alpha: 0.5 * 0.69,
    });
    expect(unavailableBlurLayer(50, "light")).toEqual({
      color: "#F9F9F9",
      alpha: 0.5 * 0.78,
    });
  });

  test("bilinmeyen tint dark'a duser", () => {
    expect(unavailableBlurLayer(50, "yokBoyleTint")).toEqual(
      unavailableBlurLayer(50, "dark"),
    );
  });

  test("alfa 1'i asmaz", () => {
    expect(unavailableBlurLayer(999, "dark").alpha).toBeLessThanOrEqual(1);
  });

  test("gecersiz/eksik intensity 50 varsayilir", () => {
    expect(unavailableBlurLayer()).toEqual(unavailableBlurLayer(50, "dark"));
    expect(unavailableBlurLayer(0, "dark")).toEqual(unavailableBlurLayer(50, "dark"));
  });

  test("sebep ayrimi yalniz kullanici tercihinde true", () => {
    expect(isUserDisabledBlur("mod-kapali")).toBe(true);
    expect(isUserDisabledBlur("android-hedef-yok")).toBe(false);
    expect(isUserDisabledBlur("android-eski-api")).toBe(false);
    expect(isUserDisabledBlur("platform-bilinmiyor")).toBe(false);
  });

  // Sebep degerleri bu ayrimin dayanagi; degisirlerse sessizce yanlis katman
  // cizilir.
  test("resolveBlurPlan sebepleri sozlesmeye uygun", () => {
    expect(
      resolveBlurPlan({ platform: "android", apiLevel: 34, blurEnabled: false }).reason,
    ).toBe("mod-kapali");
    expect(
      resolveBlurPlan({ platform: "android", apiLevel: 34, blurEnabled: true }).reason,
    ).toBe("android-hedef-yok");
    expect(
      resolveBlurPlan({
        platform: "android",
        apiLevel: 30,
        blurEnabled: true,
        hasTarget: true,
      }).reason,
    ).toBe("android-eski-api");
  });
});
