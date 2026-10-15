// Sistem anahtarı (UISwitch) yerleşimi: iOS 26'nın daha geniş anahtarı `size`a göre
// kurulu satırlardan TAŞMAMALI (eski hata: ölçek yalnız yüksekliğe bakıyor, kutu
// sabit size×1.61 kalıyordu).
import {
  CLASSIC_SWITCH_BOX,
  GLASS_SWITCH_BOX,
  MAX_SWITCH_ASPECT,
  guessNativeSwitchBox,
  iosMajorVersion,
  planNativeSwitch,
  sameSwitchBox,
} from "../utils/nativeSwitchLayout";

// Uygulamada kullanılan tüm `size` değerleri (SwitchToggle çağrıları).
const USED_SIZES = [20, 24, 28, 36];

describe("planNativeSwitch", () => {
  test.each(USED_SIZES)("size %i: iki sürümde de kutu genişliği bütçeyi aşmaz", (size) => {
    for (const box of [CLASSIC_SWITCH_BOX, GLASS_SWITCH_BOX]) {
      const plan = planNativeSwitch({ size, native: box });
      expect(plan.width).toBeLessThanOrEqual(size * MAX_SWITCH_ASPECT + 1e-6);
      expect(plan.height).toBeLessThanOrEqual(size + 1e-6);
      // Ölçek oranı korur: ne yatay ne dikey basılır.
      expect(plan.width / plan.height).toBeCloseTo(box.width / box.height, 6);
    }
  });

  test("kutu, ölçekli anahtarın gerçek genişliğidir (transform yerleşimi değiştirmez)", () => {
    const plan = planNativeSwitch({ size: 36, native: GLASS_SWITCH_BOX });
    expect(plan.width).toBeCloseTo(GLASS_SWITCH_BOX.width * plan.scale, 6);
  });

  test("iOS ≤25: eski görünüm korunur (yüksekliğe göre size/31 ölçeği)", () => {
    const plan = planNativeSwitch({ size: 36, native: CLASSIC_SWITCH_BOX });
    expect(plan.scale).toBeCloseTo(36 / 31, 6);
    expect(plan.height).toBeCloseTo(36, 6);
  });

  test("iOS 26: geniş anahtar genişliğe göre kısılır, size 36'da 63 pt'i aşmaz", () => {
    const plan = planNativeSwitch({ size: 36, native: GLASS_SWITCH_BOX });
    expect(plan.width).toBeCloseTo(63, 6);
    expect(plan.scale).toBeLessThan(36 / GLASS_SWITCH_BOX.height);
  });

  test("satır yüksekliği özel anahtarla aynı kalır: dış kutu en az size", () => {
    expect(planNativeSwitch({ size: 36, native: GLASS_SWITCH_BOX }).boxHeight).toBe(36);
    expect(planNativeSwitch({ size: 20, native: CLASSIC_SWITCH_BOX }).boxHeight).toBe(
      Math.max(20, (20 / 31) * 31),
    );
  });

  test("ölçüm yok/bozuk ise çökmez, klasik kutuya düşer", () => {
    for (const native of [undefined, null, {}, { width: 0, height: 31 }, { width: NaN, height: 28 }]) {
      const plan = planNativeSwitch({ size: 36, native });
      expect(plan.scale).toBeCloseTo(36 / 31, 6);
    }
    expect(Number.isFinite(planNativeSwitch().width)).toBe(true);
  });
});

describe("tahmin ve ölçüm yardımcıları", () => {
  test("iosMajorVersion", () => {
    expect(iosMajorVersion("26.0")).toBe(26);
    expect(iosMajorVersion("18.5.1")).toBe(18);
    expect(iosMajorVersion(17)).toBe(17);
    expect(iosMajorVersion(undefined)).toBe(0);
    expect(iosMajorVersion("x")).toBe(0);
  });

  test("ilk kare tahmini: iOS 26+ geniş, öncesi klasik", () => {
    expect(guessNativeSwitchBox(26)).toBe(GLASS_SWITCH_BOX);
    expect(guessNativeSwitchBox(27)).toBe(GLASS_SWITCH_BOX);
    expect(guessNativeSwitchBox(18)).toBe(CLASSIC_SWITCH_BOX);
    expect(guessNativeSwitchBox(0)).toBe(CLASSIC_SWITCH_BOX);
  });

  test("sameSwitchBox yarım pt altı farkı aynı sayar (onLayout döngüsünü keser)", () => {
    expect(sameSwitchBox({ width: 65, height: 28 }, { width: 65.2, height: 28 })).toBe(true);
    expect(sameSwitchBox({ width: 65, height: 28 }, { width: 53, height: 31 })).toBe(false);
    expect(sameSwitchBox(null, { width: 65, height: 28 })).toBe(false);
  });
});
