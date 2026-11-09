// SplashLensIntro'nun GERÇEK bağlantısı: bileşen react-test-renderer ile çizilir,
// sürücüler elle `setValue` ile zamanda ilerletilir ve çözülmüş stiller okunur.
//
// `react-native` taklidinde yalnız Animated DÜĞÜMLERİ gerçek (AnimatedValue,
// AnimatedMultiplication, AnimatedAddition → interpolate doğrulaması, çarpım/toplam
// zinciri, "12deg" biçimli çıktılar gerçekten çalışır); zamanlayıcılar
// (`timing/loop`) kayıt tutar, çalıştırılmaz. Tam `Animated` import'u RN'in
// renderer'ını çeker (nativeFabricUIManager hatası) — düğüm sınıfları tek tek alınır.
// (jest.config.js transformIgnorePatterns: RN kaynağı Flow tipli, dönüştürülmeli.)
//
// NEDEN VAR: saf tablolar doğru olsa da yanlış sürücünün yanlış tabloya bağlanması,
// kapalı özelliğin düğümünün yine de kurulması ya da hata sınırı yedeğinin çöken
// sahneyi yeniden çizmesi ancak burada görünür.

import React from "react";
import { act, create } from "react-test-renderer";
import SplashLensIntro from "../components/SplashLensIntro";
import { captureError } from "../services/crashReporting";
import { getEffectMode } from "../services/effectSettings";
import {
  BLINK_WINDOW,
  DRIFT_MS,
  EXIT_GUARD_MS,
  EXIT_MS,
  IDLE_MS,
  INTRO_MS,
  INTRO_S,
  INTRO_TO_FINAL,
  LENS,
  LENS_COLORS,
  STILL_WIPE_S,
  T,
  TWINKLE_MS,
  WIPE_S,
} from "../utils/splashMotion";
import { layoutSplash, nativeViewCount, planSplash, splashQualityFor } from "../utils/splashPlan";
import { WORDMARK_LETTERS } from "../data/splashWordmark";

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
  const nodes = "react-native/Libraries/Animated/nodes/";
  const AnimatedValue = jest.requireActual(`${nodes}AnimatedValue`).default;
  const AnimatedMultiplication = jest.requireActual(`${nodes}AnimatedMultiplication`).default;
  const AnimatedAddition = jest.requireActual(`${nodes}AnimatedAddition`).default;
  const registry = [];
  const host = (name) => {
    const Component = (props) => {
      if (name === "AView" && props.testID === "splash-mark") global.__splashMarkRenders += 1;
      return mockReact.createElement(name, props, props.children);
    };
    Component.displayName = name;
    return Component;
  };
  return {
    __registry: registry,
    Animated: {
      Value: AnimatedValue,
      multiply: (a, b) => new AnimatedMultiplication(a, b),
      add: (a, b) => new AnimatedAddition(a, b),
      View: host("AView"),
      Image: host("AImage"),
      timing: (value, config) => {
        const entry = { value, config, cb: null, loop: false, stopped: false };
        return {
          start: (cb) => {
            entry.cb = cb;
            registry.push(entry);
          },
          stop: () => {
            entry.stopped = true;
          },
          __entry: entry,
        };
      },
      loop: (inner) => ({
        start: () => {
          inner.__entry.loop = true;
          inner.start();
        },
        stop: () => inner.stop(),
      }),
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
jest.mock("react-native-svg", () => {
  const mockReact = require("react");
  const host = (name) => (props) => mockReact.createElement(name, props, props.children);
  return { __esModule: true, default: host("Svg"), Path: host("Path") };
});
jest.mock("expo-status-bar", () => {
  const mockReact = require("react");
  return { StatusBar: (props) => mockReact.createElement("StatusBar", props) };
});
jest.mock("../hooks/useReduceMotion", () => ({
  __esModule: true,
  default: () => {
    if (global.__splashCrash) throw new Error("boom");
    return global.__splashReduced === true;
  },
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

function all(tree, predicate) {
  const out = [];
  (function walk(n) {
    if (!n || typeof n === "string") return;
    if (predicate(n)) out.push(n);
    (n.children || []).forEach(walk);
  })(tree);
  return out;
}
const byId = (id) => all(renderer.toJSON(), (n) => n.props && n.props.testID === id);
const one = (id) => {
  const found = byId(id);
  if (found.length !== 1) throw new Error(`${id}: ${found.length} düğüm`);
  return found[0];
};
const styleOf = (id) => flatten(one(id).props.style);
const opacity = (id) => {
  const v = resolve(styleOf(id).opacity);
  return v === undefined ? 1 : v;
};
function transformOf(id) {
  const out = {};
  for (const entry of styleOf(id).transform || []) {
    const [key, value] = Object.entries(entry)[0];
    out[key] = resolve(value);
  }
  return out;
}
const deg = (v) => parseFloat(v);

const entryBy = (duration) => registry.find((e) => e.config.duration === duration && !e.stopped);
const clock = () => entryBy(INTRO_MS).value;
const setClock = (s) => act(() => clock().setValue(s));
function finishIntro() {
  setClock(INTRO_S);
  act(() => entryBy(INTRO_MS).cb({ finished: true }));
}

let renderer;
let consoleError;
beforeEach(() => {
  registry.length = 0;
  mockScreen = { width: 390, height: 844 };
  global.__splashReduced = false;
  global.__splashCrash = false;
  global.__splashMarkRenders = 0;
  getEffectMode.mockReturnValue("full");
  captureError.mockClear();
  const original = console.error;
  consoleError = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    const text = [message, ...args].map(String).join(" ");
    if (text.includes("react-test-renderer is deprecated")) return;
    if (global.__splashCrash && (text.includes("boom") || text.includes("error boundary"))) return;
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
  <SplashLensIntro exiting={false} onExited={() => {}} {...props}>
    {children}
  </SplashLensIntro>
);
function mount(props, children) {
  act(() => {
    renderer = create(element(props, children));
  });
  return renderer;
}
const startExit = (onExited, props = {}) =>
  act(() => renderer.update(element({ ...props, exiting: true, onExited })));

// ── Testler ──────────────────────────────────────────────────────────────────

describe("SplashLensIntro — giriş", () => {
  test("ilk kare yerel splash'le aynı: yalnız mürekkep zemin, hiçbir şey görünmüyor", () => {
    mount();
    setClock(0);
    expect(styleOf("splash-backdrop").backgroundColor).toBe(LENS_COLORS.ink);
    expect(opacity("splash-backdrop")).toBe(1);
    expect(opacity("splash-stars")).toBe(0);
    expect(transformOf("splash-orb-cyan").scale).toBeLessThan(0.001);
    expect(transformOf("splash-orb-red").scale).toBeLessThan(0.001);
    expect(transformOf("splash-eye").scaleX).toBeLessThan(0.001);
    expect(transformOf("splash-pupil").scale).toBeLessThan(0.001);
    expect(opacity("splash-halo-cyan")).toBe(0);
    for (let i = 0; i < WORDMARK_LETTERS.length; i++) expect(opacity(`splash-letter-${i}`)).toBe(0);
  });

  test("onIntroStart mount anında bir kez çağrılır; saat native ve etkileşim dışı", () => {
    const onIntroStart = jest.fn();
    mount({ onIntroStart });
    expect(onIntroStart).toHaveBeenCalledTimes(1);
    const config = entryBy(INTRO_MS).config;
    expect(config.toValue).toBe(INTRO_S);
    expect(config.useNativeDriver).toBe(true);
    expect(config.isInteraction).toBe(false);
  });

  test("sarmal: yıldızlar çarpışmaya dek dönerek yaklaşır ve büyür", () => {
    mount();
    const u = layoutSplash(mockScreen).unit;
    let prev = null;
    for (let t = T.appear + 0.05; t < T.collide; t += 0.1) {
      setClock(t);
      const cyan = transformOf("splash-orb-cyan");
      const red = transformOf("splash-orb-red");
      expect(red.translateX).toBeCloseTo(-cyan.translateX, 6);
      expect(red.rotate).toBe(cyan.rotate);
      if (prev) {
        expect(cyan.translateX).toBeLessThan(prev.half);
        expect(cyan.scale).toBeGreaterThanOrEqual(prev.scale);
        expect(deg(cyan.rotate)).not.toBeCloseTo(deg(prev.rotate), 1);
      }
      prev = { half: cyan.translateX, scale: cyan.scale, rotate: cyan.rotate };
    }
    // Çarpışma anında daireler değer (ayrılık 2r).
    setClock(T.collide);
    expect(transformOf("splash-orb-cyan").translateX).toBeCloseTo(LENS.r * u, 1);
    expect(opacity("splash-halo-cyan")).toBeGreaterThan(0.4);
  });

  test("çarpışma: parlama, şok halkaları ve kıvılcımlar yalnız çarpışmadan sonra görünür", () => {
    mount();
    setClock(T.collide - 0.01);
    expect(opacity("splash-flash")).toBe(0);
    byId("splash-ring").forEach((n) => expect(resolve(flatten(n.props.style).opacity)).toBe(0));
    byId("splash-spark").forEach((n) => expect(resolve(flatten(n.props.style).opacity)).toBe(0));
    setClock(T.collide + 0.1);
    expect(opacity("splash-flash")).toBeGreaterThan(0.2);
    expect(byId("splash-ring").some((n) => resolve(flatten(n.props.style).opacity) > 0.1)).toBe(true);
    expect(byId("splash-spark").some((n) => resolve(flatten(n.props.style).opacity) > 0.3)).toBe(true);
    setClock(INTRO_S);
    expect(opacity("splash-flash")).toBe(0);
    byId("splash-ring").forEach((n) => expect(resolve(flatten(n.props.style).opacity)).toBe(0));
    byId("splash-spark").forEach((n) => expect(resolve(flatten(n.props.style).opacity)).toBe(0));
    byId("splash-trail").forEach((n) => expect(resolve(flatten(n.props.style).opacity)).toBe(0));
  });

  test("son kare Lens işaretinin kendisi: dikey, d aralıklı daireler, tam göz, bebek, yazı", () => {
    mount();
    setClock(INTRO_S);
    const layout = layoutSplash(mockScreen);
    const u = layout.unit;
    const cyan = transformOf("splash-orb-cyan");
    expect(deg(cyan.rotate)).toBeCloseTo(-90, 1);
    expect(cyan.translateX).toBeCloseTo((LENS.d / 2) * u, 2);
    expect(cyan.scale).toBe(1);
    expect(transformOf("splash-orb-red").translateX).toBeCloseTo((-LENS.d / 2) * u, 2);
    const eye = transformOf("splash-eye");
    expect(deg(eye.rotate)).toBeCloseTo(-90, 1);
    expect(eye.scaleX).toBeCloseTo(1, 3);
    expect(eye.scaleY).toBeCloseTo(1, 3);
    expect(transformOf("splash-pupil").scale).toBeCloseTo(1, 3);
    expect(opacity("splash-glint")).toBe(1);
    const mark = transformOf("splash-mark");
    expect(mark.translateY).toBeCloseTo(layout.markDy, 2);
    expect(mark.scale).toBeCloseTo(INTRO_TO_FINAL, 4);
    for (let i = 0; i < WORDMARK_LETTERS.length; i++) {
      expect(opacity(`splash-letter-${i}`)).toBe(1);
      expect(transformOf(`splash-letter-${i}`).translateY).toBe(0);
    }
    expect(opacity("splash-halo-cyan")).toBe(0);
  });

  test("harfler sırayla yükselir (soldaki önce)", () => {
    mount();
    setClock(T.lettersAt + 0.32);
    const values = WORDMARK_LETTERS.map((_, i) => opacity(`splash-letter-${i}`));
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThan(values[i - 1]);
    expect(transformOf("splash-letter-0").translateY).toBeGreaterThan(0);
  });
});

describe("SplashLensIntro — bekleme döngüsü", () => {
  test("giriş bitince başlar; kırpışta göz kapanır ve bebek solar, sonra açılır", () => {
    mount();
    expect(entryBy(IDLE_MS)).toBeUndefined();
    finishIntro();
    const idle = entryBy(IDLE_MS);
    expect(idle).toBeDefined();
    expect(idle.loop).toBe(true);
    expect(idle.config.useNativeDriver).toBe(true);
    const mid = (BLINK_WINDOW[0] + BLINK_WINDOW[1]) / 2;
    act(() => idle.value.setValue(mid));
    expect(transformOf("splash-eye").scaleX).toBeLessThan(0.05);
    expect(opacity("splash-pupil")).toBe(0);
    act(() => idle.value.setValue(0.95));
    expect(transformOf("splash-eye").scaleX).toBeCloseTo(1, 3);
    expect(opacity("splash-pupil")).toBe(1);
  });

  test("bakış: bebek bir yana kayar (Tam kademede)", () => {
    mount();
    finishIntro();
    act(() => entryBy(IDLE_MS).value.setValue(0.19));
    expect(transformOf("splash-pupil").translateX).toBeLessThan(-1);
  });

  test("çıkış başladıktan sonra giriş bitse de bekleme döngüsü başlamaz", () => {
    mount();
    startExit(() => {});
    finishIntro();
    expect(entryBy(IDLE_MS)).toBeUndefined();
  });
});

describe("SplashLensIntro — çıkış", () => {
  test("opak girişte logo için ekran dışı birleştirme kapalı, solan çıkışta açık", () => {
    mount();
    expect(one("splash-mark").props.needsOffscreenAlphaCompositing).toBe(false);
    startExit(() => {});
    expect(one("splash-mark").props.needsOffscreenAlphaCompositing).toBe(true);
  });

  test("çıkış her şeyi çözer; tamamlanma bir kez bildirilir; yarıda kesilen çıkış overlay'i sökmez", () => {
    mount();
    setClock(INTRO_S);
    const onExited = jest.fn();
    startExit(onExited);
    const exit = entryBy(EXIT_MS);
    act(() => exit.value.setValue(1));
    expect(opacity("splash-backdrop")).toBe(0);
    expect(opacity("splash-mark")).toBe(0);
    expect(opacity("splash-stars")).toBe(0);
    for (let i = 0; i < WORDMARK_LETTERS.length; i++) expect(opacity(`splash-letter-${i}`)).toBe(0);
    act(() => exit.cb({ finished: false }));
    expect(onExited).not.toHaveBeenCalled();
    act(() => exit.cb({ finished: true }));
    act(() => exit.cb({ finished: true }));
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  test("zemin en son açılır: içerik gitmeden uygulama görünmez", () => {
    mount();
    setClock(INTRO_S);
    startExit(() => {});
    act(() => entryBy(EXIT_MS).value.setValue(0.3));
    expect(opacity("splash-backdrop")).toBe(1);
    expect(opacity("splash-mark")).toBeLessThan(0.5);
  });

  test("native 'bitti' kaybolursa güvence zamanlayıcısı overlay'i söker, çift tetiklenmez", () => {
    jest.useFakeTimers();
    mount();
    const onExited = jest.fn();
    startExit(onExited);
    act(() => jest.advanceTimersByTime(EXIT_MS + EXIT_GUARD_MS));
    expect(onExited).toHaveBeenCalledTimes(1);
    act(() => entryBy(EXIT_MS).cb({ finished: true }));
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  test("giriş bitmeden başlayan çıkış saat sürücüsüne dokunmaz", () => {
    mount();
    setClock(0.6);
    startExit(() => {});
    expect(clock().__getValue()).toBe(0.6);
    expect(entryBy(INTRO_MS)).toBeDefined();
  });
});

describe("SplashLensIntro — kademeler", () => {
  test("Kapalı: hikâye oynar ama yıldız alanı, iz, kıvılcım ve süs döngüleri yok", () => {
    getEffectMode.mockReturnValue("off");
    mount();
    expect(byId("splash-stars")).toHaveLength(0);
    expect(byId("splash-trail")).toHaveLength(0);
    expect(byId("splash-spark")).toHaveLength(0);
    expect(byId("splash-ring")).toHaveLength(1);
    expect(entryBy(TWINKLE_MS)).toBeUndefined();
    expect(entryBy(DRIFT_MS)).toBeUndefined();
    finishIntro();
    expect(entryBy(IDLE_MS)).toBeUndefined();
    expect(deg(transformOf("splash-orb-cyan").rotate)).toBeCloseTo(-90, 1);
  });

  test("Tam: pırıltı döngüsü ve duran yıldız alanı dönüşü çalışır", () => {
    mount();
    expect(entryBy(TWINKLE_MS).loop).toBe(true);
    expect(entryBy(DRIFT_MS).loop).toBe(false);
    expect(byId("splash-trail").length).toBe(2 * splashQualityFor("full").trail);
  });

  test("Hareketi Azalt: dönme/uçma yok, işaret ve yazı yerinde solarak belirir", () => {
    global.__splashReduced = true;
    mount();
    const layout = layoutSplash(mockScreen);
    expect(byId("splash-trail")).toHaveLength(0);
    expect(byId("splash-flash")).toHaveLength(0);
    expect(byId("splash-halo-cyan")).toHaveLength(0);
    expect(entryBy(TWINKLE_MS)).toBeUndefined();
    const cyan = transformOf("splash-orb-cyan");
    expect(cyan.rotate).toBe("-90deg");
    expect(cyan.translateX).toBeCloseTo((LENS.d / 2) * layout.unit, 4);
    expect(transformOf("splash-mark").translateY).toBeCloseTo(layout.markDy, 4);
    setClock(0);
    expect(opacity("splash-mark")).toBe(0);
    setClock(INTRO_S);
    expect(opacity("splash-mark")).toBe(1);
    expect(styleOf("splash-letter-0").transform).toBeUndefined();
    finishIntro();
    expect(entryBy(IDLE_MS)).toBeUndefined();
  });

  test("ekran ölçümü yok: hiçbir düğümde onLayout yok", () => {
    mount();
    expect(all(renderer.toJSON(), (n) => n.props && n.props.onLayout)).toHaveLength(0);
  });

  test("native view bütçesi: çizilen view sayısı plan tahminiyle uyumlu, Kapalı'da 40'ın altında", () => {
    for (const mode of ["full", "balanced", "off"]) {
      registry.length = 0;
      getEffectMode.mockReturnValue(mode);
      mount();
      const views = all(renderer.toJSON(), (n) => ["View", "AView", "Image", "AImage", "Svg"].includes(n.type)).length;
      const quality = splashQualityFor(mode);
      const estimate = nativeViewCount(planSplash({ ...mockScreen, quality }), quality);
      expect(Math.abs(views - estimate)).toBeLessThanOrEqual(2);
      if (mode === "off") expect(views).toBeLessThan(40);
      act(() => renderer.unmount());
      renderer = null;
    }
  });
});

describe("SplashLensIntro — sağlamlık", () => {
  test("sahne çökerse statik yedek (zemin + Lens) çizilir, hata raporlanır ve çıkış yine çalışır", () => {
    jest.useFakeTimers();
    global.__splashCrash = true;
    const onIntroStart = jest.fn();
    mount({ onIntroStart });
    const tree = renderer.toJSON();
    expect(flatten(tree.props.style).backgroundColor).toBe(LENS_COLORS.ink);
    expect(all(tree, (n) => n.type === "Image")).toHaveLength(1);
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ tags: { boundary: "splash" } }));
    expect(onIntroStart).toHaveBeenCalledTimes(1);
    const onExited = jest.fn();
    act(() => renderer.update(element({ exiting: true, onExited, onIntroStart })));
    act(() => jest.advanceTimersByTime(200));
    expect(onExited).toHaveBeenCalledTimes(1);
  });
});

describe("SplashLensIntro — tema zemini", () => {
  const LIGHT = "#F1F5F9"; // themes.light.primary
  const NAVY = "#0B1A33";
  const statusBar = () => all(renderer.toJSON(), (n) => n.type === "StatusBar")[0].props.style;
  const letterFill = () => all(renderer.toJSON(), (n) => n.type === "Path" && n.props.fill)
    .filter((n) => WORDMARK_LETTERS.includes(n.props.d))
    .map((n) => n.props.fill);

  test("tema zemini mürekkepse dalga katmanı hiç kurulmaz, yazı kâğıt renginde", () => {
    mount({ background: LENS_COLORS.ink });
    expect(byId("splash-wipe")).toHaveLength(0);
    expect(new Set(letterFill())).toEqual(new Set([LENS_COLORS.paper]));
  });

  test("ilk kare her temada yerel splash'le aynı (mürekkep), dalga çarpışmada başlar ve ekranı örter", () => {
    mount({ background: NAVY });
    setClock(0);
    expect(styleOf("splash-backdrop").backgroundColor).toBe(LENS_COLORS.ink);
    expect(opacity("splash-wipe")).toBe(0);
    setClock(T.collide - 0.01);
    expect(opacity("splash-wipe")).toBe(0);
    setClock(T.collide + WIPE_S * 0.4);
    const mid = transformOf("splash-wipe").scale;
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(1);
    setClock(T.collide + WIPE_S);
    expect(opacity("splash-wipe")).toBe(1);
    expect(transformOf("splash-wipe").scale).toBe(1);
    const style = styleOf("splash-wipe");
    expect(style.backgroundColor).toBe(NAVY);
    // Çember merkezden en uzak köşeye yetişir.
    expect(style.width / 2).toBeGreaterThanOrEqual(Math.hypot(mockScreen.width, mockScreen.height) / 2);
  });

  test("koyu tema (lacivert): yıldızlar kalır, yazı ve beyaz süsler kâğıt, durum çubuğu açık", () => {
    mount({ background: NAVY });
    setClock(T.collide + WIPE_S + 0.1);
    expect(opacity("splash-stars")).toBeGreaterThan(0.3);
    expect(new Set(letterFill())).toEqual(new Set([LENS_COLORS.paper]));
    expect(statusBar()).toBe("light");
  });

  test("açık tema: yıldızlar dalgayla söner, yazı ve beyaz halka/kıvılcım mürekkebe döner", () => {
    mount({ background: LIGHT });
    setClock(T.collide - 0.05);
    expect(opacity("splash-stars")).toBeGreaterThan(0.3); // uzay sahnesi aynı
    setClock(T.collide + WIPE_S);
    expect(opacity("splash-stars")).toBeCloseTo(0, 5);
    expect(new Set(letterFill())).toEqual(new Set([LENS_COLORS.ink]));
    const colors = byId("splash-ring").map((n) => flatten(n.props.style).borderColor);
    expect(colors).toContain(LENS_COLORS.ink);
    expect(colors).not.toContain(LENS_COLORS.paper);
    const sparks = byId("splash-spark").map((n) => flatten(n.props.style).backgroundColor);
    expect(sparks).not.toContain(LENS_COLORS.paper);
    // İşaretin kendisi marka renklerinde kalır.
    expect(styleOf("splash-orb-cyan").backgroundColor).toBe(LENS_COLORS.cyan);
    expect(flatten(one("splash-pupil").props.style).backgroundColor).toBe(LENS_COLORS.paper);
  });

  test("açık tema: durum çubuğu mürekkep uzayda açık simgeyle başlar, dalgayla koyuya geçer", () => {
    jest.useFakeTimers();
    mount({ background: LIGHT });
    expect(statusBar()).toBe("light");
    const markRenders = global.__splashMarkRenders;
    act(() => jest.advanceTimersByTime(T.collide * 1000 - 50));
    expect(statusBar()).toBe("light");
    act(() => jest.advanceTimersByTime(WIPE_S * 1000));
    expect(statusBar()).toBe("dark");
    expect(global.__splashMarkRenders).toBe(markRenders);
  });

  test("Hareketi Azalt + açık tema: dalga yok, zemin kısa bir geçişle temaya döner", () => {
    global.__splashReduced = true;
    mount({ background: LIGHT });
    expect(one("splash-mark").props.needsOffscreenAlphaCompositing).toBe(true);
    setClock(0);
    expect(opacity("splash-wipe")).toBe(0);
    expect(transformOf("splash-wipe").scale).toBeUndefined();
    setClock(STILL_WIPE_S);
    expect(opacity("splash-wipe")).toBe(1);
    expect(styleOf("splash-wipe").backgroundColor).toBe(LIGHT);
  });

  test("geçersiz zemin mürekkebe düşer (dalga yok); çıkışta dalga zeminle birlikte solar", () => {
    mount({ background: "nope" });
    expect(byId("splash-wipe")).toHaveLength(0);
    act(() => renderer.unmount());
    registry.length = 0;
    mount({ background: LIGHT });
    setClock(INTRO_S);
    startExit(() => {}, { background: LIGHT });
    act(() => entryBy(EXIT_MS).value.setValue(0.5));
    expect(opacity("splash-wipe")).toBe(1); // içerik solarken zemin hâlâ tema renginde
    expect(opacity("splash-backdrop")).toBeGreaterThan(0.5);
    act(() => entryBy(EXIT_MS).value.setValue(1));
    expect(byId("splash-wipe")).toHaveLength(1);
    expect(opacity("splash-backdrop")).toBe(0); // dalga zeminin çocuğu: birlikte açılır
  });

  test("statik yedek tema zeminini ve uygun durum çubuğunu kullanır", () => {
    global.__splashCrash = true;
    mount({ background: LIGHT });
    expect(styleOf("splash-static").backgroundColor).toBe(LIGHT);
    expect(statusBar()).toBe("dark");
  });
});
