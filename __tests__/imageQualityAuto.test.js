// Otomatik görsel kalitesi (utils/imageQuality + tmdbImageUtils "auto").
jest.mock("react-native", () => ({ PixelRatio: { get: () => 3 } }));

const fs = require("fs");
const path = require("path");
const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

const { getOptimalTmdbSize } = require("../utils/tmdbImageUtils");
const {
  IMAGE_QUALITY_LEVELS,
  DEFAULT_IMAGE_QUALITY,
  normalizeImageQuality,
  autoImageDensity,
  describeAutoQuality,
  approxImageKb,
} = require("../utils/imageQuality");
const { railPosterWidth } = require("../utils/posterSizes");

const WIFI = { metered: false, tier: "high" };
const CELL = { metered: true, tier: "high" };

describe("kademeler", () => {
  test("auto varsayılan ve geçerli; bilinmeyen değer auto'ya düşer", () => {
    expect(DEFAULT_IMAGE_QUALITY).toBe("auto");
    expect(IMAGE_QUALITY_LEVELS).toEqual(["auto", "low", "medium", "good", "high", "original"]);
    expect(normalizeImageQuality("w500")).toBe("auto");
    expect(normalizeImageQuality("high")).toBe("high");
  });
});

describe("autoImageDensity", () => {
  test("Wi‑Fi'de cihaz yoğunluğu", () => {
    expect(autoImageDensity({ pixelRatio: 3 }, 150)).toBe(3);
  });
  test("mobil veride ve düşük cihazda 2× tavanı", () => {
    expect(autoImageDensity({ pixelRatio: 3, metered: true }, 150)).toBe(2);
    expect(autoImageDensity({ pixelRatio: 3, tier: "low" }, 150)).toBe(2);
  });
  test("büyük görselde 2.5× tavanı; düşük yoğunluklu ekran yükseltilmez", () => {
    expect(autoImageDensity({ pixelRatio: 3 }, 400)).toBe(2.5);
    expect(autoImageDensity({ pixelRatio: 1.5 }, 400)).toBe(1.5);
  });
  test("ayar ekranı özeti nedeni söyler", () => {
    expect(describeAutoQuality({ pixelRatio: 3 })).toEqual({ density: 3, reason: "full" });
    expect(describeAutoQuality({ pixelRatio: 3, metered: true }).reason).toBe("metered");
    expect(describeAutoQuality({ pixelRatio: 3, tier: "low" }).reason).toBe("lowTier");
  });
});

describe("getOptimalTmdbSize auto", () => {
  test("poster boyutu küçüldükçe inen türev küçülür (393pt ekran, mobil veri)", () => {
    const sizes = ["normal", "small", "xsmall"].map((s) =>
      getOptimalTmdbSize("poster", railPosterWidth(393, s), "auto", CELL),
    );
    // 157→314 w342 · 134→267 w342 · 113→226 w342; Wi-Fi'de fark açılır:
    expect(sizes).toEqual(["w342", "w342", "w342"]);
    const wifi = ["normal", "small", "xsmall"].map((s) =>
      getOptimalTmdbSize("poster", railPosterWidth(393, s), "auto", WIFI),
    );
    expect(wifi).toEqual(["w500", "w500", "w342"]);
  });
  test("küçük ızgara hücresi küçük türev", () => {
    expect(getOptimalTmdbSize("poster", 60, "auto", WIFI)).toBe("w185");
    expect(getOptimalTmdbSize("poster", 60, "auto", CELL)).toBe("w154");
  });
  test("auto asla original indirmez", () => {
    expect(getOptimalTmdbSize("backdrop", 2000, "auto", WIFI)).toBe("w1280");
    expect(getOptimalTmdbSize("poster", undefined, "auto", WIFI)).toBe("w780");
  });
  test("bilinçli tam boy isteği korunur", () => {
    expect(getOptimalTmdbSize("poster", "original", "auto", WIFI)).toBe("original");
  });
  test("bağlam verilmezse cihaz yoğunluğu (good ile aynı)", () => {
    expect(getOptimalTmdbSize("poster", 157, "auto")).toBe(getOptimalTmdbSize("poster", 157, "good"));
  });
  test("tahmini boyut tablosu", () => {
    expect(approxImageKb("w342")).toBeGreaterThan(approxImageKb("w185"));
    expect(approxImageKb("bilinmeyen")).toBeNull();
  });
});

describe("kaynak bekçileri", () => {
  test("PosterImage ekrandaki genişliği ister", () => {
    expect(read("components/PosterImage.js")).toMatch(/getTmdbUrl\(path, "poster", displayWidth\)/);
  });
  test("registry ve yedek auto'yu kabul eder", () => {
    expect(read("services/storage/registry.js")).toMatch(/default: "auto"/);
    expect(read("utils/settingsBackup.js")).toMatch(/IMAGE_QUALITY_LEVELS\.includes\(v\)/);
  });
  test("Ayarlar ve Poster görünümü aynı paneli kullanır", () => {
    expect(read("screens/tabs/SettingsScreen.js")).toMatch(/<ImageQualityPanel/);
    expect(read("screens/tabs/settings/PosterSettingsScreen.js")).toMatch(/<ImageQualityPanel colors=\{C\} \/>/);
  });
  test("tüm dillerde panel anahtarları var", () => {
    const keys = Object.keys(JSON.parse(read("translations/tr.json")).autoI18n).filter((k) =>
      k.startsWith("gorsel_kalite_"),
    );
    expect(keys.length).toBeGreaterThanOrEqual(20);
    for (const lang of ["en", "es", "pt", "de"]) {
      const dict = JSON.parse(read(`translations/${lang}.json`)).autoI18n;
      for (const k of keys) expect(dict[k]).toBeTruthy();
    }
  });
});
