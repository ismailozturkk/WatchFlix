import {
  DEVICE_TIER_PRESETS,
  DEVICE_TIERS,
  getTierPreset,
  resolveDeviceTier,
} from "../utils/deviceTier";

const GIB = 1024 * 1024 * 1024;

describe("resolveDeviceTier", () => {
  test("emülatör/simülatör üst katman sayılır (geliştirmede görsel gerileme olmasın)", () => {
    expect(
      resolveDeviceTier({ totalMemoryBytes: 1 * GIB, platform: "android", isDevice: false }),
    ).toBe("high");
  });

  test("Android: RAM eşikleri", () => {
    const android = (gib) =>
      resolveDeviceTier({ totalMemoryBytes: gib * GIB, platform: "android" });
    expect(android(2)).toBe("low");
    expect(android(2.9)).toBe("low");
    expect(android(3)).toBe("mid");
    expect(android(5.9)).toBe("mid");
    expect(android(6)).toBe("high");
    expect(android(12)).toBe("high");
  });

  test("Android: eski yıl sınıfı RAM'e bakılmaksızın düşük katman", () => {
    expect(
      resolveDeviceTier({
        totalMemoryBytes: 8 * GIB,
        deviceYearClass: 2015,
        platform: "android",
      }),
    ).toBe("low");
    // 2017 ve sonrası yıl sınıfı tek başına düşürmez — karar RAM'e kalır.
    expect(
      resolveDeviceTier({
        totalMemoryBytes: 8 * GIB,
        deviceYearClass: 2017,
        platform: "android",
      }),
    ).toBe("high");
  });

  test("iOS: eski işletim sistemi sürümü düşük katman", () => {
    expect(
      resolveDeviceTier({ totalMemoryBytes: 4 * GIB, osMajorVersion: 14, platform: "ios" }),
    ).toBe("low");
    expect(
      resolveDeviceTier({ totalMemoryBytes: 4 * GIB, osMajorVersion: 17, platform: "ios" }),
    ).toBe("high");
    expect(
      resolveDeviceTier({ totalMemoryBytes: 3 * GIB, osMajorVersion: 17, platform: "ios" }),
    ).toBe("mid");
    expect(
      resolveDeviceTier({ totalMemoryBytes: 2 * GIB, osMajorVersion: 17, platform: "ios" }),
    ).toBe("low");
  });

  test("bilgi yoksa güvenli orta yol", () => {
    expect(resolveDeviceTier()).toBe("mid");
    expect(resolveDeviceTier({ totalMemoryBytes: 0, platform: "android" })).toBe("mid");
    expect(resolveDeviceTier({ totalMemoryBytes: null, platform: "ios" })).toBe("mid");
  });
});

describe("tier presetleri", () => {
  test("yalnız düşük katman dekoratif yükü kısar", () => {
    const low = getTierPreset("low");
    const mid = getTierPreset("mid");
    const high = getTierPreset("high");

    expect(low.iconBackgroundCols * low.iconBackgroundRows).toBeLessThan(
      mid.iconBackgroundCols * mid.iconBackgroundRows,
    );
    expect(mid).toEqual(high);
    expect(low.spriteFpsScale).toBeLessThan(1);
    expect(mid.spriteFpsScale).toBe(1);
    expect(low.blurEnabled).toBe(false);
    expect(mid.blurEnabled).toBe(true);
  });

  test("her katmanda tüm bütçe alanları tanımlı (eksik alan sessizce undefined kalmasın)", () => {
    const fields = Object.keys(DEVICE_TIER_PRESETS.mid);
    DEVICE_TIERS.forEach((tier) => {
      expect(Object.keys(DEVICE_TIER_PRESETS[tier]).sort()).toEqual(fields.sort());
    });
  });

  test("bilinmeyen katman mid'e düşer", () => {
    expect(getTierPreset("bilinmeyen")).toBe(DEVICE_TIER_PRESETS.mid);
    expect(getTierPreset(undefined)).toBe(DEVICE_TIER_PRESETS.mid);
  });
});
