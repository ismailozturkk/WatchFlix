import {
  MIN_SHEET_BUDGET,
  keyboardFitOverrides,
  keyboardLift,
  keyboardOverlap,
  keyboardSheetBudget,
  nextBaseOverlay,
  nextNaturalHeight,
  resolveSheetLength,
  sheetExitDistance,
} from "../utils/sheetKeyboardFit";

describe("keyboardOverlap", () => {
  it("iOS'ta pencereyle örtüşmeyi screenY'den hesaplar", () => {
    expect(keyboardOverlap({ screenY: 464, height: 336 }, 800, true)).toBe(336);
  });

  it("iOS'ta ekranın altına inen klavye 0 verir (height sıfırdan büyük kalsa da)", () => {
    expect(keyboardOverlap({ screenY: 800, height: 336 }, 800, true)).toBe(0);
    expect(keyboardOverlap({ screenY: 900, height: 336 }, 800, true)).toBe(0);
  });

  it("Android'de çerçeve yüksekliğini pencereyle sınırlar", () => {
    expect(keyboardOverlap({ height: 300 }, 800, false)).toBe(300);
    expect(keyboardOverlap({ height: 1200 }, 800, false)).toBe(800);
    expect(keyboardOverlap({ height: 0 }, 800, false)).toBe(0);
  });

  it("eksik/bozuk veride 0", () => {
    expect(keyboardOverlap(null, 800, true)).toBe(0);
    expect(keyboardOverlap({ height: NaN }, 800, false)).toBe(0);
    expect(keyboardOverlap({ height: 300 }, 0, false)).toBe(0);
  });
});

describe("nextBaseOverlay", () => {
  const empty = { height: 0, window: 0 };

  it("ilk ölçüm tabandır", () => {
    expect(nextBaseOverlay(empty, 800, 800)).toEqual({ height: 800, window: 800 });
  });

  it("pencere klavyeyle daralınca taban küçülmez (onLayout olaydan önce gelse bile)", () => {
    const base = nextBaseOverlay(empty, 800, 800);
    expect(nextBaseOverlay(base, 500, 800).height).toBe(800);
  });

  it("pencere klavye inince geri büyürse taban en büyük ölçüyü izler", () => {
    // Taban yanlışlıkla daralmış boyla başladıysa (klavye açıkken açılış) düzelir.
    const shrunkStart = nextBaseOverlay(empty, 500, 800);
    expect(nextBaseOverlay(shrunkStart, 800, 800).height).toBe(800);
  });

  it("pencere yüksekliği değiştiyse (döndürme) taban yeniden başlar", () => {
    const base = nextBaseOverlay(empty, 800, 800);
    expect(nextBaseOverlay(base, 360, 390)).toEqual({ height: 360, window: 390 });
  });

  it("geçersiz ölçüm tabana dokunmaz", () => {
    const base = nextBaseOverlay(empty, 800, 800);
    expect(nextBaseOverlay(base, 0, 800)).toBe(base);
  });
});

describe("sheetExitDistance", () => {
  it("sayfa boyu + klavye yükselmesi (sayfa ekranda asılı kalmaz)", () => {
    expect(sheetExitDistance(520, 336)).toBe(856);
  });

  it("klavye yokken yalnız sayfa boyu", () => {
    expect(sheetExitDistance(520, 0)).toBe(520);
    expect(sheetExitDistance(520, undefined)).toBe(520);
  });

  it("negatif/boş girdide taşmaz", () => {
    expect(sheetExitDistance(-5, -5)).toBe(0);
    expect(sheetExitDistance(undefined, undefined)).toBe(0);
  });
});

describe("nextNaturalHeight", () => {
  it("klavye kapalıyken ölçü doğal boydur (içerik küçülebilir)", () => {
    expect(nextNaturalHeight(720, 520, false)).toBe(520);
    expect(nextNaturalHeight(520, 400, false)).toBe(400);
  });

  it("klavye açıkken kısılmış ölçü doğal boyu küçültmez, büyüyeni kabul eder", () => {
    expect(nextNaturalHeight(520, 406, true)).toBe(520);
    expect(nextNaturalHeight(520, 560, true)).toBe(560);
  });

  it("geçersiz ölçümde mevcut değer kalır", () => {
    expect(nextNaturalHeight(520, 0, true)).toBe(520);
    expect(nextNaturalHeight(520, NaN, false)).toBe(520);
  });
});

describe("resolveSheetLength", () => {
  it("sayıyı olduğu gibi, yüzdeyi tabana göre çözer", () => {
    expect(resolveSheetLength(320, 800)).toBe(320);
    expect(resolveSheetLength("80%", 800)).toBe(640);
    expect(resolveSheetLength(" 12.5% ", 800)).toBe(100);
  });

  it("çözülemeyen değerde null verir", () => {
    expect(resolveSheetLength(undefined, 800)).toBeNull();
    expect(resolveSheetLength("auto", 800)).toBeNull();
    expect(resolveSheetLength("80%", 0)).toBeNull();
    expect(resolveSheetLength(NaN, 800)).toBeNull();
    expect(resolveSheetLength({ __getValue: () => 3 }, 800)).toBeNull();
  });
});

describe("keyboardLift", () => {
  it("klavye kapalıyken sıfır", () => {
    expect(
      keyboardLift({ keyboardHeight: 0, baseOverlayHeight: 800, overlayHeight: 800 }),
    ).toBe(0);
  });

  it("pencere daralmadıysa klavyenin tamamı", () => {
    expect(
      keyboardLift({ keyboardHeight: 300, baseOverlayHeight: 800, overlayHeight: 800 }),
    ).toBe(300);
  });

  it("pencere klavyeyle daraldıysa emilen kısım düşülür", () => {
    expect(
      keyboardLift({ keyboardHeight: 300, baseOverlayHeight: 800, overlayHeight: 500 }),
    ).toBe(0);
    expect(
      keyboardLift({ keyboardHeight: 300, baseOverlayHeight: 800, overlayHeight: 650 }),
    ).toBe(150);
  });

  it("ölçüm yokken klavyenin tamamı kaydırılır", () => {
    expect(
      keyboardLift({ keyboardHeight: 300, baseOverlayHeight: 0, overlayHeight: 0 }),
    ).toBe(300);
  });
});

describe("keyboardSheetBudget", () => {
  const base = { baseOverlayHeight: 800, overlayHeight: 800, windowHeight: 800, topGap: 40 };

  it("klavye kapalıyken sınır yok", () => {
    expect(keyboardSheetBudget({ ...base, keyboardHeight: 0 })).toBeNull();
  });

  it("ekran − klavye − üst pay", () => {
    expect(keyboardSheetBudget({ ...base, keyboardHeight: 300 })).toBe(460);
  });

  it("kaplayıcı ölçülmediyse pencere yüksekliğini kullanır", () => {
    expect(
      keyboardSheetBudget({
        keyboardHeight: 300,
        baseOverlayHeight: 0,
        overlayHeight: 0,
        windowHeight: 700,
        topGap: 40,
      }),
    ).toBe(360);
  });

  it("pencere klavyeyle daraldıysa bütçe daralmış pencereden hesaplanır", () => {
    // 800 → 500 daraldı (300 emildi): ek kaydırma yok, alan 500 − pay.
    expect(
      keyboardSheetBudget({
        keyboardHeight: 300,
        baseOverlayHeight: 800,
        overlayHeight: 500,
        windowHeight: 800,
        topGap: 40,
      }),
    ).toBe(460);
  });

  it("klavye ekranı neredeyse kaplarsa taban değerin altına inmez", () => {
    expect(
      keyboardSheetBudget({ ...base, windowHeight: 360, overlayHeight: 360, baseOverlayHeight: 360, keyboardHeight: 300 }),
    ).toBe(MIN_SHEET_BUDGET);
  });
});

describe("keyboardFitOverrides", () => {
  it("bütçe yoksa sınır eklenmez", () => {
    expect(keyboardFitOverrides({ maxHeight: "88%" }, null, 800)).toBeNull();
  });

  it("çağıranın maxHeight'ı yoksa bütçe uygulanır", () => {
    expect(keyboardFitOverrides({}, 460, 800)).toEqual({ maxHeight: 460 });
    expect(keyboardFitOverrides(undefined, 460, 800)).toEqual({ maxHeight: 460 });
  });

  it("yüzdeli maxHeight bütçeyi aşıyorsa bütçeye iner", () => {
    // 88% × 800 = 704 > 460
    expect(keyboardFitOverrides({ maxHeight: "88%" }, 460, 800)).toEqual({ maxHeight: 460 });
  });

  it("çağıranın maxHeight'ı zaten küçükse ona dokunulmaz", () => {
    // 40% × 800 = 320 < 460
    expect(keyboardFitOverrides({ maxHeight: "40%" }, 460, 800)).toEqual({ maxHeight: 320 });
    expect(keyboardFitOverrides({ maxHeight: 300 }, 460, 800)).toEqual({ maxHeight: 300 });
  });

  it("bütçeyi aşan minHeight indirilir (Yoga'da min, max'a baskın)", () => {
    // minHeight 52% × 800 = 416 < 460 → dokunulmaz
    expect(
      keyboardFitOverrides({ maxHeight: "78%", minHeight: "52%" }, 460, 800),
    ).toEqual({ maxHeight: 460 });
    // minHeight 70% × 800 = 560 > 460 → 460'a iner
    expect(
      keyboardFitOverrides({ maxHeight: "90%", minHeight: "70%" }, 460, 800),
    ).toEqual({ maxHeight: 460, minHeight: 460 });
  });
});
