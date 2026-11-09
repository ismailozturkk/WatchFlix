// utils/splashPlan.js — açılış ekranının kalite kademeleri, yerleşimi ve view bütçesi.
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import { EFFECT_MODES } from "../utils/deviceTier";
import { LENS, LENS_COLORS, MARK_HEIGHT, NATIVE_SPLASH_BG } from "../utils/splashMotion";
import {
  SPLASH_QUALITY,
  layoutSplash,
  nativeViewCount,
  planSparks,
  planSplash,
  planStars,
  splashPaletteFor,
  splashQualityFor,
} from "../utils/splashPlan";
import { THEME_FAMILIES, THEME_NAMES, themes } from "../theme/colors";
import { contrastRatio } from "../utils/colorUtils";

const root = path.join(__dirname, "..");
const SCREENS = [
  [360, 800],
  [375, 667],
  [390, 844],
  [430, 932],
  [820, 1180],
];
const CONTINUOUS = ["twinkle", "drift", "look", "blink"];

describe("kalite kademeleri kullanıcının efekt ayarını izler", () => {
  test("her efekt modunun bir kademesi var (yeni mod sessizce düşmesin)", () => {
    for (const mode of EFFECT_MODES) expect(SPLASH_QUALITY[mode]).toBeDefined();
  });

  test("bilinmeyen mod ortaya düşer", () => {
    expect(splashQualityFor("nope")).toBe(SPLASH_QUALITY.balanced);
  });

  test("kademeler sürekli iş bakımından sıralı: Tam ⊇ Orta ⊇ Kapalı", () => {
    const order = ["full", "balanced", "off"];
    for (let i = 1; i < order.length; i++) {
      const hi = SPLASH_QUALITY[order[i - 1]];
      const lo = SPLASH_QUALITY[order[i]];
      for (const key of Object.keys(hi)) {
        if (typeof hi[key] === "number") expect(lo[key]).toBeLessThanOrEqual(hi[key]);
        else if (!hi[key]) expect(lo[key]).toBe(false);
      }
    }
  });

  test("Kapalı (zayıf cihaz varsayılanı) HİÇBİR sürekli animasyon çalıştırmaz ama hikâye kalır", () => {
    const off = SPLASH_QUALITY.off;
    for (const key of CONTINUOUS) expect(off[key]).toBe(false);
    expect(off.stars).toBe(0);
    expect(off.spiral).toBe(true);
  });

  test("Hareketi Azalt: dönme, uçma, döngü yok; yıldız sayısı moddan gelir", () => {
    for (const mode of EFFECT_MODES) {
      const q = splashQualityFor(mode, true);
      expect(q.spiral).toBe(false);
      for (const key of CONTINUOUS) expect(q[key]).toBe(false);
      expect(q.sparks).toBe(0);
      expect(q.trail).toBe(0);
      expect(q.stars).toBe(SPLASH_QUALITY[mode].stars);
    }
  });

  test("kademeler dondurulmuş", () => {
    expect(Object.isFrozen(SPLASH_QUALITY)).toBe(true);
    Object.values(SPLASH_QUALITY).forEach((q) => expect(Object.isFrozen(q)).toBe(true));
  });
});

describe("yerleşim", () => {
  test.each(SCREENS)("%ix%i: işaret + yazı ekrana sığar ve ortalanır", (width, height) => {
    const l = layoutSplash({ width, height });
    expect(l.word.width).toBeLessThanOrEqual(width * 0.6 + 0.01);
    const top = l.markDy - (MARK_HEIGHT / 2) * l.finalUnit;
    const bottom = l.word.top + l.word.height;
    expect(top + bottom).toBeCloseTo(0, 1); // grup ekran merkezinde
    expect(bottom - top).toBeLessThanOrEqual(height * 0.36 + 0.5);
    expect(l.word.top).toBeGreaterThan(l.markDy + (MARK_HEIGHT / 2) * l.finalUnit); // yazı işaretin altında
    expect(l.unit).toBeGreaterThan(l.finalUnit); // giriş daha büyük
    // İşaret kabı son göz + bebek aşımını içerir.
    expect(l.markBox).toBeGreaterThanOrEqual(2 * (LENS.r + LENS.d / 2) * l.unit);
  });

  test("telefonda işaret okunur boyda (en az 110 dp yüksek)", () => {
    const l = layoutSplash({ width: 360, height: 800 });
    expect(MARK_HEIGHT * l.finalUnit).toBeGreaterThan(110);
  });
});

describe("yıldızlar, kıvılcımlar ve bütçe", () => {
  test("plan deterministik (her açılışta aynı gökyüzü)", () => {
    expect(planStars({ width: 390, height: 844, count: 20 })).toEqual(planStars({ width: 390, height: 844, count: 20 }));
    expect(planSparks(12)).toEqual(planSparks(12));
  });

  test("yıldızlar ekranı kaplar, hepsi görünür boyda", () => {
    const stars = planStars({ width: 390, height: 844, count: 44 });
    expect(stars.some((s) => Math.abs(s.dy) > 300)).toBe(true);
    stars.forEach((s) => {
      expect(s.size).toBeGreaterThan(0.5);
      expect(s.alpha).toBeGreaterThan(0);
      expect(s.alpha).toBeLessThanOrEqual(1);
    });
  });

  test("native view bütçesi (390×844): Kapalı < 40, Tam < 120", () => {
    const count = (mode) => {
      const q = splashQualityFor(mode);
      return nativeViewCount(planSplash({ width: 390, height: 844, quality: q }), q);
    };
    expect(count("off")).toBeLessThan(40);
    expect(count("balanced")).toBeLessThan(count("full"));
    expect(count("full")).toBeLessThan(120);
  });
});

describe("splash görselleri (assets/splash)", () => {
  const load = (name) => PNG.sync.read(fs.readFileSync(path.join(root, "assets/splash", name)));

  test.each(["glow-cyan.png", "glow-red.png", "glow-paper.png"])("%s küçük, kare, kenarları tam saydam", (name) => {
    const png = load(name);
    expect(png.width).toBe(png.height);
    expect(png.width).toBeLessThanOrEqual(256);
    const alpha = (x, y) => png.data[(y * png.width + x) * 4 + 3];
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(png.width - 1, png.height >> 1)).toBe(0);
    expect(alpha(png.width >> 1, png.height >> 1)).toBeGreaterThan(240);
  });

  test("yerel splash görseli tamamen saydam", () => {
    const png = load("native-blank.png");
    for (let i = 3; i < png.data.length; i += 4) expect(png.data[i]).toBe(0);
  });

  test("her splash görseli yalnız kullanıldığı yerde require edilir", () => {
    const src = fs.readFileSync(path.join(root, "components/SplashLensIntro.js"), "utf8");
    for (const name of ["glow-cyan", "glow-red", "glow-paper"]) {
      expect(src).toContain(`require("../assets/splash/${name}.png")`);
    }
  });
});

describe("tema zemini (splashPaletteFor)", () => {
  test("ailelerin açık tonu açık, orta ve koyu tonu koyu sayılır", () => {
    for (const family of THEME_FAMILIES) {
      expect(splashPaletteFor(themes[family.tones.light].primary).light).toBe(true);
      expect(splashPaletteFor(themes[family.tones.mid].primary).light).toBe(false);
      expect(splashPaletteFor(themes[family.tones.dark].primary).light).toBe(false);
    }
  });

  test.each(THEME_NAMES)("%s: yazı zeminde okunur, durum çubuğu zemine uyar", (name) => {
    const p = splashPaletteFor(themes[name].primary);
    expect(contrastRatio(p.word, p.background)).toBeGreaterThanOrEqual(4.5);
    expect(p.contrast).toBe(p.word);
    expect(p.statusBar).toBe(p.light ? "dark" : "light");
    expect(p.starsStay).toBe(!p.light);
  });

  test("açık zeminde mürekkep, koyuda kâğıt; işaret renkleri hiç değişmez", () => {
    expect(splashPaletteFor("#F1F5F9").word).toBe(LENS_COLORS.ink);
    expect(splashPaletteFor("#0B1A33").word).toBe(LENS_COLORS.paper);
  });

  test("geçersiz / eksik zemin yerel splash mürekkebine düşer, dalga kurulmaz", () => {
    for (const bad of [undefined, null, "", "nope", 42]) {
      const p = splashPaletteFor(bad);
      expect(p.background).toBe(NATIVE_SPLASH_BG);
      expect(p.wipe).toBe(false);
    }
    expect(splashPaletteFor(NATIVE_SPLASH_BG.toLowerCase()).wipe).toBe(false);
  });

  test("zemin her zaman opak hex (yarı saydam özel tema altındaki uygulamayı göstermez)", () => {
    expect(splashPaletteFor("rgba(241, 245, 249, 0.5)").background).toBe("#F1F5F9");
    expect(splashPaletteFor("#abc").background).toBe("#AABBCC");
  });

  test("dalga view bütçeye bir view ekler", () => {
    const q = splashQualityFor("off");
    const ink = nativeViewCount(planSplash({ width: 390, height: 844, quality: q }), q);
    const light = nativeViewCount(planSplash({ width: 390, height: 844, quality: q, background: "#F1F5F9" }), q);
    expect(light).toBe(ink + 1);
    expect(light).toBeLessThan(40);
  });
});
