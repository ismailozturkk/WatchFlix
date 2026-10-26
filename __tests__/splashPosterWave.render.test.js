// SplashPosterWave'in GERÇEK bağlantısı: bileşen react-test-renderer ile çizilir,
// sürücüler elle `setValue` ile zamanda ilerletilir ve çözülmüş stiller okunur.
//
// `react-native` taklidinde yalnız Animated DÜĞÜMLERİ gerçek (AnimatedValue,
// AnimatedMultiplication → interpolate doğrulaması, çarpım zinciri, "12deg"
// biçimli çıktılar gerçekten çalışır); zamanlayıcılar (`timing/loop`) kayıt tutar,
// çalıştırılmaz. Tam `Animated` import'u RN'in renderer'ını çeker
// (nativeFabricUIManager hatası) — düğüm sınıfları bu yüzden tek tek alınır.
// (jest.config.js transformIgnorePatterns: RN kaynağı Flow tipli, dönüştürülmeli.)
//
// NEDEN VAR: saf tablolar doğru olsa da yanlış sürücünün yanlış tabloya bağlanması,
// kapalı özelliğin düğümünün yine de kurulması ya da hata sınırı yedeğinin çöken
// sahneyi yeniden çizmesi ancak burada görünür.

import React from "react";
import { act, create } from "react-test-renderer";
import SplashPosterWave from "../components/SplashPosterWave";
import { captureError } from "../services/crashReporting";
import { getEffectMode } from "../services/effectSettings";
import {
  EXIT_GUARD_MS,
  EXIT_MS,
  GLOW_SPIN_MS,
  INTRO_MS,
  BREATH_MS,
  ORBIT_MS,
  ORBIT_SWEEP_DEG,
  POSTER_WAIT_MS,
  STATIC_LEVEL,
  WAVE_PERIOD_MS,
  ringPeakOpacity,
} from "../utils/splashMotion";
import { nativeViewCount, planSplash, splashQualityFor } from "../utils/splashPlan";

jest.mock("react-native/Libraries/TurboModule/TurboModuleRegistry", () => ({
  get: () => null,
  getEnforcing: () => new Proxy({}, { get: () => () => {} }),
}));
jest.mock("react-native/Libraries/Utilities/Platform", () => ({
  __esModule: true,
  default: { OS: "ios", select: (o) => (o.ios !== undefined ? o.ios : o.default), Version: 17 },
}));

let mockScreen = { width: 390, height: 844 };
jest.mock("react-native", () => {
  const mockReact = require("react");
  const AnimatedValue = jest.requireActual("react-native/Libraries/Animated/nodes/AnimatedValue").default;
  const AnimatedMultiplication = jest.requireActual(
    "react-native/Libraries/Animated/nodes/AnimatedMultiplication",
  ).default;
  const registry = [];
  const host = (name) => {
    const Component = (props) => mockReact.createElement(name, props, props.children);
    Component.displayName = name;
    return Component;
  };
  return {
    __registry: registry,
    Animated: {
      Value: AnimatedValue,
      multiply: (a, b) => new AnimatedMultiplication(a, b),
      View: host("AView"),
      Image: host("AImage"),
      timing: (value, config) => ({
        start: (cb) => registry.push({ value, config, cb }),
        stop: () => {},
      }),
      loop: (inner) => ({ start: () => inner.start(), stop: () => {} }),
    },
    View: host("View"),
    Image: host("Image"),
    Easing: { linear: (x) => x },
    StyleSheet: {
      create: (o) => o,
      absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
    },
    Dimensions: { get: () => mockScreen },
  };
});
jest.mock("../hooks/useAppLogo", () => ({ __esModule: true, default: () => ({ logo: "logo" }) }));
jest.mock("../hooks/useReduceMotion", () => ({
  __esModule: true,
  default: () => global.__splashReduced === true,
}));
jest.mock("../services/effectSettings", () => ({ getEffectMode: jest.fn(() => "full") }));
jest.mock("../services/crashReporting", () => ({ captureError: jest.fn() }));

const registry = require("react-native").__registry;
global.IS_REACT_ACT_ENVIRONMENT = true;

// ── Yardımcılar ──────────────────────────────────────────────────────────────
const isAnimated = (v) => v && typeof v === "object" && typeof v.__getValue === "function";
const resolve = (v) => (isAnimated(v) ? v.__getValue() : v);

function flatten(style) {
  const out = {};
  (function walk(s) {
    if (Array.isArray(s)) s.forEach(walk);
    else if (s) Object.assign(out, s);
  })(style);
  return out;
}

function hasAnimated(value) {
  if (isAnimated(value)) return true;
  if (Array.isArray(value)) return value.some(hasAnimated);
  if (value && typeof value === "object") return Object.values(value).some(hasAnimated);
  return false;
}

function countTree(tree) {
  const out = { nativeViews: 0, animatedViews: 0, images: 0, onLayout: 0 };
  (function walk(n) {
    if (!n || typeof n === "string") return;
    if (["View", "AView", "Image", "AImage"].includes(n.type)) out.nativeViews += 1;
    if (["Image", "AImage"].includes(n.type)) out.images += 1;
    if (n.props && n.props.onLayout) out.onLayout += 1;
    if (hasAnimated(n.props && n.props.style)) out.animatedViews += 1;
    (n.children || []).forEach(walk);
  })(tree);
  return out;
}

const timingBy = (duration) => registry.find((entry) => entry.config.duration === duration);
const driverBy = (duration) => (timingBy(duration) || {}).value;
const durations = () => registry.map((entry) => entry.config.duration).sort((a, b) => a - b);

/** Sürücüleri t ms'ye getirir (var olanları). */
function setTime(t) {
  driverBy(INTRO_MS).setValue(Math.min(1, t / INTRO_MS));
  const loops = [
    [WAVE_PERIOD_MS, (t / WAVE_PERIOD_MS) % 1],
    [BREATH_MS, (t / BREATH_MS) % 1],
    [GLOW_SPIN_MS, (t / GLOW_SPIN_MS) % 1],
    [ORBIT_MS, Math.min(1, t / ORBIT_MS)],
  ];
  for (const [duration, value] of loops) driverBy(duration)?.setValue(value);
}

const scaleOf = (style) => {
  const entry = (style.transform || []).find((t) => "scale" in t);
  return entry ? resolve(entry.scale) : undefined;
};
const rotateOf = (style) => {
  const entry = (style.transform || []).find((t) => "rotate" in t);
  return entry ? resolve(entry.rotate) : undefined;
};

// Sıra: zemin kabı, ışıma, halka kapları…, logo, (çocuk kabı)
function readState(tree) {
  const root = tree.children;
  const logoIndex = root.findIndex((n, i) => i > 1 && n.type === "AImage");
  const style = (n) => flatten(n.props.style);
  const logo = style(root[logoIndex]);
  return {
    backdropOpacity: resolve(style(root[0]).opacity),
    glowOpacity: resolve(style(root[1]).opacity),
    logoOpacity: resolve(logo.opacity),
    logoScale: scaleOf(logo),
    rings: root.slice(2, logoIndex).map((ring) => {
      const container = style(ring);
      const tile = style(ring.children[0]);
      return {
        scale: scaleOf(container),
        rotate: rotateOf(container),
        tiles: ring.children.length,
        tileOpacity: resolve(tile.opacity),
        tileScale: scaleOf(tile),
        tileRotate: rotateOf(tile),
      };
    }),
  };
}

let renderer;
let consoleError;
beforeEach(() => {
  registry.length = 0;
  mockScreen = { width: 390, height: 844 };
  global.__splashReduced = false;
  getEffectMode.mockReturnValue("full");
  captureError.mockClear();
  const original = console.error;
  consoleError = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  consoleError.mockRestore();
  jest.useRealTimers();
});

const element = (props = {}, children = null) => (
  <SplashPosterWave backgroundColor="#1D1F23" light={false} exiting={false} onExited={() => {}} {...props}>
    {children}
  </SplashPosterWave>
);
// Native görüntü yükleyicinin "çözüldü" haberini taklit eder (giriş bunu bekler).
function settlePosters(predicate = () => true) {
  const tiles = [];
  (function walk(n) {
    if (!n || typeof n === "string") return;
    if (n.type === "AImage" && n.props.onLoadEnd) tiles.push(n);
    (n.children || []).forEach(walk);
  })(renderer.toJSON());
  act(() => tiles.filter(predicate).forEach((tile) => tile.props.onLoadEnd()));
}
function mount(props, children, { settle = true } = {}) {
  act(() => {
    renderer = create(element(props, children));
  });
  if (settle) settlePosters();
  return renderer;
}
function startExit(onExited) {
  act(() => renderer.update(element({ exiting: true, onExited })));
}

// ── Testler ──────────────────────────────────────────────────────────────────

describe("SplashPosterWave — gerçek Animated grafiği", () => {
  test("ilk kare yerel splash'le aynı (yalnız logo), sonra yerleşir; yörünge posterleri dik tutar ve DURUR", () => {
    mount();
    setTime(0);
    const first = readState(renderer.toJSON());
    expect(first.backdropOpacity).toBe(1);
    expect(first.glowOpacity).toBe(0);
    expect(first.logoOpacity).toBe(1);
    expect(first.logoScale).toBe(1);
    for (const ring of first.rings) expect(ring.tileOpacity).toBe(0);

    setTime(1000);
    const settled = readState(renderer.toJSON());
    for (const ring of settled.rings) expect(ring.scale).toBeCloseTo(1, 6);
    expect(settled.glowOpacity).toBeCloseTo(1, 6);

    setTime(ORBIT_MS / 2);
    const moving = readState(renderer.toJSON());
    expect(parseFloat(moving.rings[0].rotate)).toBeGreaterThan(0); // çift halka saat yönü
    expect(parseFloat(moving.rings[1].rotate)).toBeLessThan(0); // tek halka tersi
    for (const ring of moving.rings) {
      // kap + poster dönüşü aynı sürücüden: toplam her an sıfır → posterler dik
      expect(parseFloat(ring.rotate) + parseFloat(ring.tileRotate)).toBeCloseTo(0, 6);
    }

    setTime(ORBIT_MS * 3); // çok uzun süren açılış: yörünge ORBIT_SWEEP_DEG'de durmuş olmalı
    expect(Math.abs(parseFloat(readState(renderer.toJSON()).rings[0].rotate))).toBeCloseTo(ORBIT_SWEEP_DEG, 3);
  });

  test("ekran ölçümü YOK: hiçbir düğümde onLayout yok (ölçü gelince yeniden render/kayma olamaz)", () => {
    mount();
    expect(countTree(renderer.toJSON()).onLayout).toBe(0);
  });

  test("çıkış her şeyi çözer; tamamlanma bir kez bildirilir; yarıda kesilen çıkış overlay'i sökmez", () => {
    mount();
    const onExited = jest.fn();
    startExit(onExited);
    const exit = driverBy(EXIT_MS);
    setTime(1500);
    exit.setValue(0);
    expect(readState(renderer.toJSON()).logoOpacity).toBe(1);
    exit.setValue(1);
    const end = readState(renderer.toJSON());
    expect(end.logoOpacity).toBe(0);
    expect(end.backdropOpacity).toBe(0);
    for (const ring of end.rings) expect(ring.tileOpacity).toBe(0);

    const { cb } = timingBy(EXIT_MS);
    cb({ finished: false });
    expect(onExited).not.toHaveBeenCalled();
    cb({ finished: true });
    cb({ finished: true });
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  test("native 'bitti' geri çağrısı kaybolursa overlay yine de sökülür (güvence zamanlayıcısı), çift tetiklenmez", () => {
    jest.useFakeTimers();
    mount();
    const onExited = jest.fn();
    startExit(onExited);
    expect(onExited).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(EXIT_MS + EXIT_GUARD_MS + 50);
    });
    expect(onExited).toHaveBeenCalledTimes(1);
    timingBy(EXIT_MS).cb({ finished: true }); // geç gelen gerçek geri çağrı
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  test("giriş bitmeden başlayan çıkış kesintisiz (değerlerde sıçrama yok)", () => {
    mount();
    setTime(300);
    const before = readState(renderer.toJSON());
    startExit(() => {});
    driverBy(EXIT_MS).setValue(0);
    const after = readState(renderer.toJSON());
    expect(after.logoScale).toBeCloseTo(before.logoScale, 9);
    before.rings.forEach((ring, i) => {
      expect(after.rings[i].scale).toBeCloseTo(ring.scale, 9);
      expect(after.rings[i].tileOpacity).toBeCloseTo(ring.tileOpacity, 9);
    });
  });
});

describe("SplashPosterWave — afiş hazırlığı", () => {
  test("giriş, kullanılan afişlerin HEPSİ çözülene kadar başlamaz; sonra bir kez haber verir", () => {
    const onIntroStart = jest.fn();
    mount({ onIntroStart }, null, { settle: false });
    expect(timingBy(INTRO_MS)).toBeUndefined();
    // İlk yarı yüklendi: hâlâ bekler (halkalar boş karolarla açılmamalı).
    let n = 0;
    settlePosters(() => n++ % 2 === 0);
    expect(timingBy(INTRO_MS)).toBeUndefined();
    expect(onIntroStart).not.toHaveBeenCalled();
    settlePosters();
    expect(timingBy(INTRO_MS)).toBeDefined();
    expect(onIntroStart).toHaveBeenCalledTimes(1);
    settlePosters(); // geç gelen/tekrarlanan haberler girişi yeniden başlatmaz
    expect(registry.filter((e) => e.config.duration === INTRO_MS)).toHaveLength(1);
    expect(onIntroStart).toHaveBeenCalledTimes(1);
  });

  test("çözüm takılırsa giriş POSTER_WAIT_MS tavanında yine başlar", () => {
    jest.useFakeTimers();
    const onIntroStart = jest.fn();
    mount({ onIntroStart }, null, { settle: false });
    act(() => {
      jest.advanceTimersByTime(POSTER_WAIT_MS - 1);
    });
    expect(timingBy(INTRO_MS)).toBeUndefined();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(timingBy(INTRO_MS)).toBeDefined();
    expect(onIntroStart).toHaveBeenCalledTimes(1);
  });
});

describe("SplashPosterWave — kalite kademeleri", () => {
  const loopsFor = (mode, reduced = false) => {
    registry.length = 0;
    getEffectMode.mockReturnValue(mode);
    global.__splashReduced = reduced;
    mount();
    const list = durations();
    act(() => renderer.unmount());
    renderer = null;
    return list;
  };
  const sorted = (...list) => list.sort((a, b) => a - b);

  test("her kademe yalnız söz verdiği zamanlayıcıları başlatır", () => {
    expect(loopsFor("full")).toEqual(sorted(INTRO_MS, WAVE_PERIOD_MS, BREATH_MS, GLOW_SPIN_MS, ORBIT_MS));
    expect(loopsFor("balanced")).toEqual(sorted(INTRO_MS, WAVE_PERIOD_MS, BREATH_MS));
    // Zayıf cihaz varsayılanı: giriş dışında SÜREKLİ HİÇBİR animasyon çalışmaz.
    expect(loopsFor("off")).toEqual([INTRO_MS]);
    expect(loopsFor("full", true)).toEqual([INTRO_MS]); // Hareketi Azalt
    expect(loopsFor("balanced", true)).toEqual([INTRO_MS]);
    // Bilinmeyen/bozuk kayıt güvenli orta yola düşer.
    expect(loopsFor("bozuk-deger")).toEqual(sorted(INTRO_MS, WAVE_PERIOD_MS, BREATH_MS));
  });

  test("Kapalı: 2 halka, sabit parlaklıkta posterler, hiçbir yerde ölçek/dönüş düğümü yok", () => {
    getEffectMode.mockReturnValue("off");
    mount();
    for (const t of [0, 300, 900]) {
      setTime(t);
      const state = readState(renderer.toJSON());
      expect(state.rings).toHaveLength(2);
      for (const ring of state.rings) {
        expect(ring.rotate).toBeUndefined();
        expect(ring.tileRotate).toBeUndefined();
        expect(ring.tileScale).toBeUndefined();
      }
    }
    setTime(1000);
    expect(readState(renderer.toJSON()).rings[0].tileOpacity).toBeCloseTo(STATIC_LEVEL * ringPeakOpacity(0), 6);
  });

  test("Hareketi Azalt: ölçek ve dönüş hiçbir yerde yok, yalnız solma", () => {
    global.__splashReduced = true;
    mount();
    for (const t of [0, 400, 900]) {
      setTime(t);
      const state = readState(renderer.toJSON());
      expect(state.logoScale).toBeUndefined();
      for (const ring of state.rings) {
        expect(ring.scale).toBeUndefined();
        expect(ring.rotate).toBeUndefined();
        expect(ring.tileScale).toBeUndefined();
      }
    }
  });

  test("native view BÜTÇESİ: poster başına tek view; plan ölçüsüyle birebir; eski yapının (135) çok altında", () => {
    const rows = [];
    for (const [width, height] of [[360, 800], [390, 844], [430, 932], [820, 1180]]) {
      for (const mode of ["full", "balanced", "off"]) {
        mockScreen = { width, height };
        getEffectMode.mockReturnValue(mode);
        registry.length = 0;
        mount();
        const counted = countTree(renderer.toJSON());
        const plan = planSplash({ width, height, quality: splashQualityFor(mode) });
        // Harness çocuk vermiyor → çocuk kabı (1 view) sayımda yok.
        expect(counted.nativeViews).toBe(nativeViewCount(plan) - 1);
        // Her poster doğrudan Animated.Image: sarmalayıcı View + ayrı Image YOK.
        expect(counted.images).toBe(plan.tileCount + 2); // posterler + ışıma + logo
        rows.push({ width, height, mode, views: counted.nativeViews });
        act(() => renderer.unmount());
        renderer = null;
      }
    }
    const at = (w, h, mode) => rows.find((r) => r.width === w && r.height === h && r.mode === mode).views;
    expect(at(390, 844, "full")).toBeLessThanOrEqual(75);
    expect(at(390, 844, "balanced")).toBeLessThanOrEqual(75);
    expect(at(390, 844, "off")).toBeLessThanOrEqual(45);
    expect(at(820, 1180, "full")).toBeLessThanOrEqual(120);
    expect(at(390, 844, "off")).toBeLessThan(at(390, 844, "full"));
  });

  test("üst bileşen (tema/kar bağlamı) yeniden çizilince posterler yeniden kurulmaz", () => {
    mount();
    const firstTileStyle = () => renderer.toJSON().children[2].children[0].props.style;
    const before = firstTileStyle();
    act(() => renderer.update(element({}, React.createElement("Snow"))));
    expect(firstTileStyle()).toBe(before);
  });
});

describe("SplashPosterWave — hata sınırı", () => {
  test("animasyonlu sahne çökerse statik yedek (zemin + logo) çizilir, rapor edilir ve yine de sökülür", () => {
    jest.useFakeTimers();
    // Sahne her denemede patlar (React hatayı yakalamadan önce bir kez daha dener);
    // yedek getEffectMode'a dokunmaz.
    getEffectMode.mockImplementation(() => {
      throw new Error("boom");
    });
    // React 19 yakalanan hatayı console.error'a da yazar; bu testte beklenen.
    consoleError.mockImplementation(() => {});
    const onIntroStart = jest.fn();
    mount({ onIntroStart });
    // Yedekte beklenecek afiş yok: App.js'in görünme sayacı takılı kalmamalı.
    expect(onIntroStart).toHaveBeenCalledTimes(1);

    const tree = renderer.toJSON();
    const counted = countTree(tree);
    expect(counted.animatedViews).toBe(0); // animasyonlu hiçbir şey kalmadı
    expect(counted.images).toBe(1); // yalnız logo
    expect(captureError).toHaveBeenCalledTimes(1);
    expect(captureError.mock.calls[0][1].tags.boundary).toBe("splash");

    const onExited = jest.fn();
    startExit(onExited);
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(onExited).toHaveBeenCalledTimes(1);
  });
});
