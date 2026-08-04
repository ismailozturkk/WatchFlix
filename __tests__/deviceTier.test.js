import {
  DEVICE_TIER_PRESETS,
  DEVICE_TIERS,
  EFFECT_MODES,
  EFFECT_MODE_PRESETS,
  defaultEffectMode,
  getEffectPreset,
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

describe("efekt modları (kullanıcı tercihi)", () => {
  test("üç mod var ve hepsinde tüm bütçe alanları tanımlı", () => {
    expect(EFFECT_MODES).toEqual(["full", "balanced", "off"]);
    const alanlar = Object.keys(EFFECT_MODE_PRESETS.full).sort();
    EFFECT_MODES.forEach((mod) => {
      expect([mod, Object.keys(EFFECT_MODE_PRESETS[mod]).sort()]).toEqual([mod, alanlar]);
    });
  });

  test("HER basamak görünür: yoğunluk ve kare hızı kesin azalır", () => {
    // Orta ile kapalı aynı yoğunluğu paylaşırsa "orta" seçeneği varsayılan
    // kurulumda hiçbir şeyi değiştirmeyen bir yalan olur — bu testin varlık
    // sebebi o: iki lever de her basamakta KESİN azalmalı.
    const [tam, orta, kapali] = EFFECT_MODES.map(getEffectPreset);
    const desen = (p) => p.iconBackgroundCols * p.iconBackgroundRows;
    expect(desen(tam)).toBeGreaterThan(desen(orta));
    expect(desen(orta)).toBeGreaterThan(desen(kapali));
    expect(tam.spriteFpsScale).toBeGreaterThan(orta.spriteFpsScale);
    expect(orta.spriteFpsScale).toBeGreaterThan(kapali.spriteFpsScale);
  });

  test("preset DEĞERLERİ sabitlenir (sessiz kayma testte patlasın)", () => {
    expect(getEffectPreset("full")).toEqual({
      iconBackgroundCols: 5,
      iconBackgroundRows: 9,
      spriteFpsScale: 1,
      blurEnabled: true,
    });
    expect(getEffectPreset("balanced")).toEqual({
      iconBackgroundCols: 4,
      iconBackgroundRows: 7,
      spriteFpsScale: 0.7,
      blurEnabled: true,
    });
    expect(getEffectPreset("off")).toEqual({
      iconBackgroundCols: 3,
      iconBackgroundRows: 5,
      spriteFpsScale: 0.5,
      blurEnabled: false,
    });
  });

  test("ORTA blur'u KORUR, KAPALI kapatır (modların ayırt edici farkı)", () => {
    // "Orta"nın sözü şu: arayüzün kimliği (bulanıklık) kalsın, sürekli maliyet
    // kısılsın. Blur burada kapanırsa "Kapalı"dan ayrı bir moda gerek kalmaz.
    expect(getEffectPreset("full").blurEnabled).toBe(true);
    expect(getEffectPreset("balanced").blurEnabled).toBe(true);
    expect(getEffectPreset("off").blurEnabled).toBe(false);
  });

  test("bilinmeyen mod güvenli ortaya düşer", () => {
    expect(getEffectPreset("turbo")).toBe(EFFECT_MODE_PRESETS.balanced);
    expect(getEffectPreset(undefined)).toBe(EFFECT_MODE_PRESETS.balanced);
  });

  test("varsayılan mod cihaz sınıfından türer — bugünkü davranış korunur", () => {
    expect(defaultEffectMode("low")).toBe("off");
    expect(defaultEffectMode("mid")).toBe("full");
    expect(defaultEffectMode("high")).toBe("full");
    // Katman presetleri mod tablosundan türetilir; ikisi ayrışamaz.
    DEVICE_TIERS.forEach((tier) => {
      expect([tier, getTierPreset(tier)]).toEqual([
        tier,
        getEffectPreset(defaultEffectMode(tier)),
      ]);
    });
  });
});
