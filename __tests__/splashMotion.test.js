// utils/splashMotion.js — Lens açılış animasyonunun saf hareket modeli.
// Bileşen bağlantısı __tests__/splashLensIntro.render.test.js'te.
import fs from "fs";
import path from "path";
import {
  BLINK_WINDOW,
  CONTACT_SEP,
  EXIT_GUARD_MS,
  EXIT_MS,
  EYE_LENGTH,
  EYE_WIDTH,
  FALLBACK_EXIT_MS,
  INTRO_MS,
  INTRO_S,
  INTRO_TO_FINAL,
  KEY_TIMES,
  LENS,
  LENS_COLORS,
  LOOK_WINDOW,
  MIN_VISIBLE_MS,
  NATIVE_SPLASH_BG,
  SHOCK_RINGS,
  START_SEP,
  T,
  TURNS,
  WOBBLE_S,
  blinkFadeAt,
  blinkSepAt,
  ease,
  exitBackdropOpacityAt,
  exitContentOpacityAt,
  eyeScaleForSep,
  flashOpacityAt,
  glowAt,
  isFiniteTable,
  letterAt,
  lookAt,
  markScaleAt,
  pupilAt,
  sampleTable,
  sepAt,
  shockOpacityAt,
  sizeAt,
  sparkOpacityAt,
  thetaAt,
  toDeg,
  trailAt,
  twinkleAt,
} from "../utils/splashMotion";
import { WORDMARK_LETTERS } from "../data/splashWordmark";

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const range = (from, to, step) => {
  const out = [];
  for (let x = from; x <= to + 1e-9; x += step) out.push(x);
  return out;
};

describe("Lens ölçüleri ve renkleri (marka setiyle aynı)", () => {
  test("renkler marketing/marka/yeni-logo/README.md ile aynı", () => {
    const readme = read("marketing/marka/yeni-logo/README.md");
    for (const hex of Object.values(LENS_COLORS)) expect(readme).toContain(`\`${hex}\``);
  });

  test("ölçüler: r 132, d 120, bebek 40, parıltı 9,6; göz kesişimden türer", () => {
    expect(LENS).toMatchObject({ r: 132, d: 120, pupil: 40, glint: 9.6 });
    expect(EYE_LENGTH).toBe(144);
    expect(EYE_WIDTH).toBeCloseTo(235.16, 1);
    expect(eyeScaleForSep(LENS.d)).toEqual([1, 1]);
  });

  test("ikon üreticisi aynı ölçüleri kullanır (splash ile simge aynı işaret)", () => {
    const py = read("scripts/generate-app-icons.py");
    expect(py).toMatch(/"r": 132, "d": 120, "pupil": 40, "glint": 9\.6/);
  });
});

describe("yörünge: sarmal, çarpışma, oturma", () => {
  test("ayrılık giriş boyunca START_SEP'ten d'ye iner; çarpışmada tam temas (2r)", () => {
    expect(sepAt(0)).toBe(START_SEP);
    expect(sepAt(T.collide - 1e-9)).toBeCloseTo(CONTACT_SEP, 3);
    expect(sepAt(T.collide)).toBeCloseTo(CONTACT_SEP, 6);
    expect(sepAt(T.settle)).toBeCloseTo(LENS.d, 6);
    expect(sepAt(INTRO_S)).toBeCloseTo(LENS.d, 6);
    // Çarpışmaya dek hiç yaklaşmayı bırakmaz.
    const xs = range(T.appear, T.collide, 0.01);
    for (let i = 1; i < xs.length; i++) expect(sepAt(xs[i])).toBeLessThan(sepAt(xs[i - 1]));
  });

  test("toplam dönüş TURNS tur; son açı tam -90° (cyan üstte, dikey kilit)", () => {
    const turned = thetaAt(T.settle) - thetaAt(0);
    expect(turned / (2 * Math.PI)).toBeCloseTo(TURNS, 3);
    expect(thetaAt(T.settle)).toBeCloseTo(-Math.PI / 2, 6);
    expect(thetaAt(T.settle + WOBBLE_S)).toBeCloseTo(-Math.PI / 2, 9);
    expect(thetaAt(INTRO_S)).toBeCloseTo(-Math.PI / 2, 9);
  });

  test("yaklaştıkça hızlanır (Kepler): son çeyrekteki açısal hız ilk çeyreğinkinden büyük", () => {
    const speed = (t) => (thetaAt(t + 0.01) - thetaAt(t)) / 0.01;
    const quarter = (T.collide - T.appear) / 4;
    expect(speed(T.collide - quarter)).toBeGreaterThan(1.5 * speed(T.appear + quarter));
  });

  test("yıldızlar küçük başlar, çarpışmada tam boy; hale yanar sonra söner", () => {
    expect(sizeAt(0)).toBe(0);
    expect(sizeAt(T.grow)).toBeCloseTo(0.3, 6);
    expect(sizeAt(T.collide)).toBe(1);
    expect(glowAt(T.collide - 0.01)).toBe(1);
    expect(glowAt(T.collide + 0.5)).toBeCloseTo(0, 9);
    expect(trailAt(T.collide + 0.25)).toBe(0);
  });

  test("çarpışma yumruğu kısa ve küçük; işaret son ölçeğe oturur", () => {
    const punches = range(T.collide, INTRO_S, 0.005).map((t) => markScaleAt(t));
    expect(Math.max(...punches)).toBeLessThan(1.08);
    expect(markScaleAt(INTRO_S)).toBeCloseTo(INTRO_TO_FINAL, 9);
  });

  test("bebek ve yazı işaret oturduktan sonra gelir; harfler soldan sağa", () => {
    expect(pupilAt(T.collide)).toBe(0);
    expect(pupilAt(INTRO_S)).toBe(1);
    expect(T.pupilAt).toBeGreaterThan(T.collide);
    expect(T.lettersAt).toBeGreaterThan(T.settle);
    for (let i = 0; i < WORDMARK_LETTERS.length; i++) expect(letterAt(INTRO_S, i)).toBe(1);
    expect(letterAt(T.lettersAt + 0.1, 0)).toBeGreaterThan(letterAt(T.lettersAt + 0.1, 1));
  });

  test("çarpışma efektleri çarpışmadan önce görünmez, giriş bitmeden söner", () => {
    for (const t of [0, T.collide - 0.001, INTRO_S]) {
      expect(flashOpacityAt(t)).toBe(0);
      SHOCK_RINGS.forEach((_, i) => expect(shockOpacityAt(t, i)).toBe(0));
      expect(sparkOpacityAt(t, 0.95)).toBe(0);
    }
    expect(flashOpacityAt(T.collide + 0.05)).toBeGreaterThan(0.4);
  });
});

describe("bekleme döngüsü", () => {
  test("döngü dikişsiz: 0 ve 1'de bakış, kırpma, solma yok", () => {
    for (const b of [0, 1]) {
      expect(lookAt(b)).toBeCloseTo(0, 9);
      expect(blinkSepAt(b)).toBeCloseTo(0, 9);
      expect(blinkFadeAt(b)).toBeCloseTo(0, 9);
    }
  });

  test("kırpışta daireler ayrılır ve göz tamamen kapanır; bebek ondan önce solar", () => {
    const mid = (BLINK_WINDOW[0] + BLINK_WINDOW[1]) / 2;
    const [along] = eyeScaleForSep(LENS.d + blinkSepAt(mid));
    expect(along).toBe(0);
    expect(blinkFadeAt(mid)).toBe(1);
  });

  test("bakış ve kırpma çakışmaz", () => {
    expect(LOOK_WINDOW[1]).toBeLessThan(BLINK_WINDOW[0]);
  });

  test("pırıltı döngüsü dikişsiz ve hiç tamamen sönmez", () => {
    for (const phase of [0, 1 / 3, 2 / 3]) {
      expect(twinkleAt(0, phase)).toBeCloseTo(twinkleAt(1, phase), 9);
      for (const x of range(0, 1, 0.05)) expect(twinkleAt(x, phase)).toBeGreaterThanOrEqual(0.35);
    }
  });
});

describe("çıkış", () => {
  test("sonunda her şey tamamen saydam; zemin en son açılır", () => {
    expect(exitContentOpacityAt(1)).toBe(0);
    expect(exitBackdropOpacityAt(1)).toBe(0);
    expect(exitBackdropOpacityAt(0.3)).toBe(1);
    expect(exitContentOpacityAt(0.3)).toBeLessThan(0.5);
    const xs = range(0, 1, 0.02);
    for (let i = 1; i < xs.length; i++) {
      expect(exitContentOpacityAt(xs[i])).toBeLessThanOrEqual(exitContentOpacityAt(xs[i - 1]));
      expect(exitBackdropOpacityAt(xs[i])).toBeLessThanOrEqual(exitBackdropOpacityAt(xs[i - 1]));
    }
  });
});

describe("zaman çizelgesi", () => {
  test("en kısa görünme süresi çarpışmayı, gözü ve yazının çoğunu kapsar", () => {
    const visible = MIN_VISIBLE_MS / 1000;
    expect(visible).toBeGreaterThan(T.pupilAt + T.pupilDur);
    expect(letterAt(visible, WORDMARK_LETTERS.length - 1)).toBeGreaterThan(0.75);
    expect(MIN_VISIBLE_MS).toBeLessThanOrEqual(INTRO_MS);
  });

  test("süreler makul (yanlışlıkla çok saniyelik bir splash olmasın)", () => {
    expect(INTRO_MS).toBeLessThanOrEqual(2600);
    expect(MIN_VISIBLE_MS + EXIT_MS).toBeLessThanOrEqual(3000);
    expect(EXIT_GUARD_MS).toBeGreaterThan(0);
    expect(FALLBACK_EXIT_MS).toBeGreaterThan(MIN_VISIBLE_MS + EXIT_MS);
  });

  test("easing yardımcıları uçlara oturur", () => {
    for (const fn of Object.values(ease)) {
      expect(fn(0)).toBeCloseTo(0, 9);
      expect(fn(1)).toBeCloseTo(1, 9);
    }
  });
});

describe("tablolar", () => {
  test("örneklenen tablolar geçerli native interpolate tablosu (artan giriş, sonlu çıkış)", () => {
    const tables = [
      sampleTable(sepAt),
      sampleTable(thetaAt, { map: toDeg }),
      sampleTable(sizeAt, { to: T.collide }),
      sampleTable(lookAt, { from: 0, to: 1, step: 1 / 90 }),
      sampleTable((x) => x, { from: 0.3, to: 0.31 }),
    ];
    tables.forEach((t) => expect(isFiniteTable(t)).toBe(true));
  });

  test("kırılma anları ızgaraya düşmese de tabloda yer alır", () => {
    const { inputRange, outputRange } = sampleTable(sepAt, { from: T.appear, to: T.settle });
    for (const k of KEY_TIMES.filter((x) => x > T.appear && x < T.settle)) {
      expect(inputRange).toContain(k);
    }
    expect(outputRange[inputRange.indexOf(T.collide)]).toBeCloseTo(CONTACT_SEP, 3);
  });

  test("dönüş çıktısı native'in tanıdığı biçimde", () => {
    expect(toDeg(-Math.PI / 2)).toBe("-90deg");
    expect(toDeg(0.1)).toMatch(/^-?\d+(\.\d+)?deg$/);
  });
});

describe("yerel splash devri", () => {
  const appJson = JSON.parse(read("app.json"));
  const config = appJson.expo.plugins.find((p) => Array.isArray(p) && p[0] === "expo-splash-screen")[1];

  test("JS splash yerel splash'in rengiyle başlar (mürekkep)", () => {
    expect(config.backgroundColor.toLowerCase()).toBe(NATIVE_SPLASH_BG.toLowerCase());
  });

  test("yerel splash görseli boş: yıldızlar JS'te doğar, ilk karede logo sıçraması olmaz", () => {
    expect(config.image).toBe("./assets/splash/native-blank.png");
    expect(fs.existsSync(path.join(root, "assets/splash/native-blank.png"))).toBe(true);
  });
});

describe("SplashLensIntro kaynak bekçileri", () => {
  const src = read("components/SplashLensIntro.js")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

  test("her Animated.timing native ve InteractionManager dışında", () => {
    const blocks = src.split("Animated.timing(").slice(1);
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    for (const block of blocks) {
      const config = block.slice(0, block.indexOf("})"));
      expect(config).toContain("useNativeDriver: true");
      expect(config).toContain("isInteraction: false");
    }
  });

  test("ekran ölçümü yok: onLayout ya da ölçü state'i yok", () => {
    expect(src).not.toMatch(/onLayout/);
  });

  test("Android görsel tuhaflıkları her Animated.Image'da nötr (fadeDuration 0)", () => {
    const images = src.split("<Animated.Image").slice(1);
    expect(images.length).toBeGreaterThan(0);
    images.forEach((img) => expect(img.slice(0, img.indexOf("/>"))).toContain("fadeDuration={0}"));
  });

  test("çıkış saat sürücüsüne dokunmaz", () => {
    expect(src).not.toMatch(/clock\.setValue|clock\.stopAnimation/);
  });

  test("sahne AYRI statik yedekli hata sınırıyla sarılı", () => {
    expect(src).toMatch(/fallback=\{<StaticSplash/);
    expect(src).toMatch(/this\.state\.failed \? this\.props\.fallback : this\.props\.children/);
  });
});
