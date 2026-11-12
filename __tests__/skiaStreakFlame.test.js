// __tests__/skiaStreakFlame.test.js
//
// Seri alevinin Skia shader çizimi (11 Kas):
//   • utils/streakFlameShader.js — uniform hesapları (saf)
//   • FLAME_SKSL GERÇEK Skia'da (canvaskit-wasm) derlenir ve çizer: alev görünür,
//     köşeler saydam, ihtişam arttıkça efektler tuvali doldurur, mola gri
//   • SkiaStreakFlame bileşeni: tuval yerleşimi, saat, Hareketi Azalt
//   • StreakFlame çizici seçimi: Skia ↔ SVG yedeği

import {
  FLAME_ASPECT,
  FLAME_SKSL,
  flameCanvasBox,
  flameRamp,
  flameTimeScale,
  flameUniforms,
  hexToRgb,
} from "../utils/streakFlameShader";
import { streakLook, streakPalette } from "../utils/streakFlame";

const UNIFORM_NAMES = [...FLAME_SKSL.matchAll(/uniform\s+\w+\s+(\w+);/g)].map((m) => m[1]);
const flat = (u) => UNIFORM_NAMES.flatMap((n) => (Array.isArray(u[n]) ? u[n] : [u[n]]));

describe("uniform hesapları", () => {
  test("shader'ın istediği her uniform üretilir (zaman hariç), fazlası yok", () => {
    const u = flameUniforms(streakLook(6, 4), { width: 78, height: 100 });
    expect(Object.keys(u).sort()).toEqual(UNIFORM_NAMES.filter((n) => n !== "time").sort());
    expect(flat({ ...u, time: 1 }).every(Number.isFinite)).toBe(true);
  });

  test("kademe, biçim, efekt bayrakları ve küçük boy ayrıntısı", () => {
    // Kıvılcım biçimi 4 haftada bir: 5. hafta yıldız (1), 9. hafta elmas (2).
    const u = flameUniforms(streakLook(5, 7), { width: 31, height: 40 });
    expect(u).toMatchObject({ stage: 7, shape: 1, effects: 1, detail: 1 });
    expect(u.rainbow).toBeUndefined();
    expect(flameUniforms(streakLook(9, 4), { width: 20, height: 26 })).toMatchObject({ shape: 2, detail: 0.55 });
    expect(flameUniforms(streakLook(200, 7), { width: 78, height: 100 }).rainbow).toBeUndefined();
    // Yalnız Efsane (16. hafta ve sonrası) rengarenk.
    expect(flameUniforms(streakLook(15, 7), { width: 78, height: 100 }).spectrum).toBe(0);
    expect(flameUniforms(streakLook(16, 7), { width: 78, height: 100 }).spectrum).toBe(1);
    expect(flameUniforms(streakLook(5, 3), { width: 78, height: 100, dimmed: true })).toMatchObject({ dim: 0.45 });
  });

  test("tuval alev kutusundan büyük ve ortalı; piksel oranı res/box'a yansır", () => {
    expect(flameCanvasBox(78, 100)).toEqual({ width: 160, height: 200, left: -41, top: -50 });
    const u = flameUniforms(streakLook(1, 1), { width: 78, height: 100, pixelRatio: 2 });
    expect(u.res).toEqual([320, 400]);
    expect(u.box).toEqual([156, 200]);
    expect(FLAME_ASPECT).toBeCloseTo(0.78, 2);
  });

  test("renk rampası paletten: koyu dış → beyaz-sıcak çekirdek; bozuk renk beyaz", () => {
    const p = streakPalette(0);
    expect(flameRamp(p)).toEqual([p.outer[0], p.outer[1], p.mid[1], p.core[0], p.core[1]].map(hexToRgb));
    expect(hexToRgb("#FF8000")).toEqual([1, 0.502, 0]);
    expect(hexToRgb("kırmızı")).toEqual([1, 1, 1]);
    expect(flameTimeScale({ dimmed: true })).toBeLessThan(flameTimeScale());
  });
});

describe("FLAME_SKSL gerçek Skia'da (canvaskit-wasm)", () => {
  let CK;
  let effect;
  beforeAll(async () => {
    CK = await require("canvaskit-wasm")();
    effect = CK.RuntimeEffect.Make(FLAME_SKSL, (err) => {
      throw new Error(`SkSL derlenemedi: ${err}`);
    });
  }, 30000);

  // Tek alevi 156 × 200 tuvale çizer, piksel dizisini (RGBA, önçarpımlı) döndürür.
  const draw = (look, time = 1.7) => {
    const H = 100;
    const W = Math.round(H * FLAME_ASPECT);
    const box = flameCanvasBox(W, H);
    const surf = CK.MakeSurface(box.width, box.height);
    const paint = new CK.Paint();
    paint.setShader(effect.makeShader(flat({ ...flameUniforms(look, { width: W, height: H }), time })));
    surf.getCanvas().clear(CK.TRANSPARENT);
    surf.getCanvas().drawRect(CK.LTRBRect(0, 0, box.width, box.height), paint);
    const img = surf.makeImageSnapshot();
    const px = img.readPixels(0, 0, {
      width: box.width, height: box.height, colorType: CK.ColorType.RGBA_8888,
      alphaType: CK.AlphaType.Premul, colorSpace: CK.ColorSpace.SRGB,
    });
    surf.delete();
    const at = (x, y) => px.slice((y * box.width + x) * 4, (y * box.width + x) * 4 + 4);
    let covered = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 24) covered += 1;
    return { at, box, covered, px };
  };

  test("derlenir; alev gövdesi dolu, köşeler saydam", () => {
    expect(effect).toBeTruthy();
    const { at, box } = draw(streakLook(1, 3));
    // Alev dibi tuval merkezinin 0,42·H altında; gövdenin içi.
    const body = at(Math.round(box.width / 2), Math.round(box.height / 2 + 100 * 0.42 - 20));
    expect(body[3]).toBeGreaterThan(200);
    expect(at(2, 2)[3]).toBe(0);
    expect(at(box.width - 3, box.height - 3)[3]).toBe(0);
  });

  test("önçarpımlı çıktı geçerli: hiçbir kanal alfayı aşmaz", () => {
    const { px } = draw(streakLook(53, 7), 2.9);
    let bad = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] > px[i + 3] + 1 || px[i + 1] > px[i + 3] + 1 || px[i + 2] > px[i + 3] + 1) bad += 1;
    }
    expect(bad).toBe(0);
  });

  test("ihtişam büyüdükçe çizilen alan artar", () => {
    const s1 = draw(streakLook(6, 1)).covered;
    const s5 = draw(streakLook(6, 5)).covered;
    const s7 = draw(streakLook(6, 7)).covered;
    expect(s5).toBeGreaterThan(s1 * 1.5);
    expect(s7).toBeGreaterThanOrEqual(s5 * 0.95);
  });

  // Görünür piksellerin ton (hue) kovaları: 12 dilim, en az 40 pikseli olanlar sayılır.
  const hueBuckets = (px) => {
    const kova = new Array(12).fill(0);
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3];
      if (a < 120) continue;
      const r = px[i] / a, g = px[i + 1] / a, b = px[i + 2] / a;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn < 0.25) continue; // beyaz/gri sayılmaz
      let h;
      if (mx === r) h = ((g - b) / (mx - mn) + 6) % 6;
      else if (mx === g) h = (b - r) / (mx - mn) + 2;
      else h = (r - g) / (mx - mn) + 4;
      kova[Math.floor((h / 6) * 12) % 12] += 1;
    }
    return kova.filter((n) => n >= 40).length;
  };

  test("Efsane rengarenk: gövdede çok sayıda ton; önceki kademe tek renk ailesi", () => {
    const efsane = hueBuckets(draw(streakLook(16, 7), 2.3).px);
    const onceki = hueBuckets(draw(streakLook(1, 7), 2.3).px);
    expect(efsane).toBeGreaterThanOrEqual(5);
    expect(onceki).toBeLessThanOrEqual(3);
  });

  test("zaman ilerleyince alev kıpırdar (aynı kare değil)", () => {
    const a = draw(streakLook(1, 3), 1.0).px;
    const b = draw(streakLook(1, 3), 1.4).px;
    let diff = 0;
    for (let i = 3; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 30) diff += 1;
    expect(diff).toBeGreaterThan(100);
  });
});

describe("SkiaStreakFlame bileşeni", () => {
  let mockFrame;
  beforeEach(() => {
    jest.resetModules();
    jest.unmock("../components/streak/SkiaStreakFlame");
    mockFrame = { setActive: jest.fn(), cb: null };
    jest.doMock("react-native", () => ({ View: "View" }));
    jest.doMock("react-native-reanimated", () => ({
      useSharedValue: (v) => ({ value: v }),
      useDerivedValue: (fn) => ({ value: fn() }),
      useFrameCallback: (cb) => {
        mockFrame.cb = cb;
        return mockFrame;
      },
    }));
    jest.doMock("@shopify/react-native-skia", () => ({
      Canvas: "Canvas",
      Fill: "Fill",
      Shader: "Shader",
      Skia: { RuntimeEffect: { Make: (src) => (src.includes("half4 main") ? { src } : null) } },
    }));
  });

  // jest.resetModules sonrası React ve test renderer da yeniden yüklenmeli: bileşen
  // ile renderer aynı React kopyasını görmezse kancalar null döner.
  const render = (props) => {
    const R = require("react");
    const TR = require("react-test-renderer");
    const { default: SkiaStreakFlame, SKIA_FLAME_READY } = require("../components/streak/SkiaStreakFlame");
    const el = (extra) => R.createElement(SkiaStreakFlame, { look: streakLook(6, 5), size: 100, ...props, ...extra });
    let tree;
    TR.act(() => {
      tree = TR.create(el());
    });
    const update = (extra) => TR.act(() => tree.update(el(extra)));
    return { tree, update, SKIA_FLAME_READY };
  };

  test("tuval kutunun dışına taşar, shader uniform'ları + dinlenme saati", () => {
    const { tree, SKIA_FLAME_READY } = render();
    expect(SKIA_FLAME_READY).toBe(true);
    const root = tree.root.findByType("View");
    expect(root.props.style[0]).toMatchObject({ width: 78, height: 100 });
    expect(tree.root.findByType("Canvas").props.style).toMatchObject({ width: 160, height: 200, left: -41, top: -50 });
    const u = tree.root.findByType("Shader").props.uniforms.value;
    expect(u).toMatchObject({ stage: 5, time: 1.7 });
    expect(mockFrame.setActive).toHaveBeenLastCalledWith(true);
  });

  test("renderScale: küçük tuval aynı merkezde büyütülür, ayrıntı gerçek boydan", () => {
    const { tree } = render({ renderScale: 0.5 });
    const style = tree.root.findByType("Canvas").props.style;
    expect(style).toMatchObject({ width: 80, height: 100, left: -1, top: 0, transform: [{ scale: 2 }] });
    const u = tree.root.findByType("Shader").props.uniforms.value;
    expect(u.res).toEqual([80, 100]);
    expect(u.detail).toBe(1);
  });

  test("saat 60 fps'te, geçen süreyle ilerler (takılmada sıçramaz); Hareketi Azalt'ta durur", () => {
    const time = { value: 1.7 };
    jest.doMock("react-native-reanimated", () => ({
      useSharedValue: (v) => (v === 1.7 ? time : { value: v }),
      useDerivedValue: (fn) => ({ value: fn() }),
      useFrameCallback: (cb) => {
        mockFrame.cb = cb;
        return mockFrame;
      },
    }));
    const { update } = render();
    mockFrame.cb({ timestamp: 1000 }); // ilk kare: yalnız referans alınır
    expect(time.value).toBe(1.7);
    mockFrame.cb({ timestamp: 1008 }); // 120 Hz'in sonraki karesi: 60 fps sınırı atlar
    expect(time.value).toBe(1.7);
    mockFrame.cb({ timestamp: 1017 }); // 17 ms geçti → ilerler
    expect(time.value).toBeCloseTo(1.7 + 0.017, 5);
    mockFrame.cb({ timestamp: 1517 }); // takılma: en fazla 64 ms sayılır
    expect(time.value).toBeCloseTo(1.7 + 0.017 + 0.064, 5);
    update({ animated: false });
    expect(mockFrame.setActive).toHaveBeenLastCalledWith(false);
  });

  test("shader derlenemezse hazır değil ve hiçbir şey çizmez", () => {
    jest.doMock("@shopify/react-native-skia", () => ({
      Canvas: "Canvas", Fill: "Fill", Shader: "Shader",
      Skia: { RuntimeEffect: { Make: () => null } },
    }));
    const { tree, SKIA_FLAME_READY } = render();
    expect(SKIA_FLAME_READY).toBe(false);
    expect(tree.toJSON()).toBeNull();
  });
});

describe("StreakFlame çizici seçimi", () => {
  const pick = ({ ready, renderer, locked = false }) => {
    jest.resetModules();
    jest.doMock("../components/streak/SkiaStreakFlame", () => ({ __esModule: true, default: "SkiaStreakFlame", SKIA_FLAME_READY: ready }));
    jest.doMock("../services/devLab", () => ({ useFlameRenderer: () => renderer }));
    jest.doMock("react-native", () => ({ StyleSheet: { create: (s) => s, absoluteFill: {} }, View: "View" }));
    jest.doMock("react-native-reanimated", () => ({ __esModule: true, default: { View: "AnimatedView" } }));
    jest.doMock("react-native-svg", () => ({ __esModule: true, default: "Svg" }));
    const { default: StreakFlame, StreakFlameSvg } = require("../components/streak/StreakFlame");
    const el = StreakFlame.type({ look: streakLook(3, 3), locked });
    return el.type === "SkiaStreakFlame" ? "skia" : el.type === StreakFlameSvg ? "svg" : "?";
  };

  test("varsayılan Skia; laboratuvarda SVG seçilirse, kilitli basamakta ya da shader yoksa SVG", () => {
    expect(pick({ ready: true, renderer: "skia" })).toBe("skia");
    expect(pick({ ready: true, renderer: "svg" })).toBe("svg");
    expect(pick({ ready: true, renderer: "skia", locked: true })).toBe("svg");
    expect(pick({ ready: false, renderer: "skia" })).toBe("svg");
  });
});
