import {
  MIN_SHEET_BUDGET,
  keyboardFitOverrides,
  keyboardLift,
  keyboardSheetBudget,
  resolveSheetLength,
} from "../utils/sheetKeyboardFit";

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
