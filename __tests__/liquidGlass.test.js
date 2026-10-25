// __tests__/liquidGlass.test.js
//
// iOS Liquid Glass karar tablosu (utils/liquidGlass.js). Saf mantık: cam çizilip
// çizilmeyeceği, camın hangi görünümde çizileceği ve hap köşe yarıçapı.
// Native yoklama (services/liquidGlass.js) ve çizim (GlassSurface) bu testin
// kapsamı dışında — burada kilitlenen şey iOS 18–25 kullanıcısının ESKİ, Android
// kullanıcısının buzlu cam (resolveGlassMode) görünümüne geçmesi.
import {
  GLASS_MODES,
  LIQUID_GLASS_MIN_IOS,
  capsuleRadius,
  glassSchemeFor,
  resolveGlassMode,
  resolveGlassPlan,
} from "../utils/liquidGlass";

describe("resolveGlassPlan", () => {
  it("iOS + destekli + efektler açık → gerçek cam", () => {
    expect(resolveGlassPlan({ platform: "ios", supported: true, effectsEnabled: true })).toEqual({
      native: true,
      reason: "ios-glass",
    });
  });

  it("efektler hiç verilmezse açık sayılır (varsayılan: açık)", () => {
    expect(resolveGlassPlan({ platform: "ios", supported: true }).native).toBe(true);
  });

  it("Android hiçbir koşulda cam çizmez (eski görünüm aynen kalır)", () => {
    expect(resolveGlassPlan({ platform: "android", supported: true, effectsEnabled: true }).native).toBe(false);
    expect(resolveGlassPlan({ platform: "android", supported: true }).reason).toBe("ios-degil");
  });

  it("web ve bilinmeyen platform cam çizmez", () => {
    expect(resolveGlassPlan({ platform: "web", supported: true }).native).toBe(false);
    expect(resolveGlassPlan({ platform: undefined, supported: true }).native).toBe(false);
  });

  it("iOS ama cam desteklenmiyor (iOS 18–25 / eski ikili / opt-out) → eski görünüm", () => {
    expect(resolveGlassPlan({ platform: "ios", supported: false, effectsEnabled: true })).toEqual({
      native: false,
      reason: "desteklenmiyor",
    });
  });

  it("kullanıcı efektleri KAPATTIYSA cam desteklense bile düz görünüm", () => {
    expect(resolveGlassPlan({ platform: "ios", supported: true, effectsEnabled: false })).toEqual({
      native: false,
      reason: "efektler-kapali",
    });
  });

  it("desteklenmeme, efekt kapalı olmasından önce raporlanır", () => {
    expect(resolveGlassPlan({ platform: "ios", supported: false, effectsEnabled: false }).reason).toBe("desteklenmiyor");
  });

  it("argümansız çağrı güvenli: cam yok", () => {
    expect(resolveGlassPlan().native).toBe(false);
  });
});

describe("glassSchemeFor", () => {
  it("açık yüzey → light, koyu yüzey → dark", () => {
    expect(glassSchemeFor(true)).toBe("light");
    expect(glassSchemeFor(false)).toBe("dark");
  });
});

describe("capsuleRadius", () => {
  it("yüksekliğin yarısı", () => {
    expect(capsuleRadius(48)).toBe(24);
    expect(capsuleRadius(40)).toBe(20);
    expect(capsuleRadius(41)).toBe(20.5);
  });

  it("bilinmeyen / geçersiz yükseklikte null (çağıran kendi yarıçapını kullanır)", () => {
    expect(capsuleRadius(undefined)).toBeNull();
    expect(capsuleRadius(null)).toBeNull();
    expect(capsuleRadius(0)).toBeNull();
    expect(capsuleRadius(-8)).toBeNull();
    expect(capsuleRadius("48")).toBeNull();
  });
});

describe("LIQUID_GLASS_MIN_IOS", () => {
  it("Liquid Glass iOS 26 ile başlar", () => {
    expect(LIQUID_GLASS_MIN_IOS).toBe(26);
  });
});

describe("resolveGlassMode", () => {
  it("iOS 26+ cam → native", () => {
    expect(resolveGlassMode({ platform: "ios", supported: true })).toBe(GLASS_MODES.native);
  });

  it("Android + efektler açık → buzlu cam", () => {
    expect(resolveGlassMode({ platform: "android", effectsEnabled: true })).toBe(GLASS_MODES.frosted);
    expect(resolveGlassMode({ platform: "android" })).toBe(GLASS_MODES.frosted);
  });

  it("Android + Efektler Kapalı → eski düz görünüm", () => {
    expect(resolveGlassMode({ platform: "android", effectsEnabled: false })).toBe(GLASS_MODES.off);
  });

  it("iOS 18–25 ve efektleri kapalı iOS eski görünümde kalır", () => {
    expect(resolveGlassMode({ platform: "ios", supported: false })).toBe(GLASS_MODES.off);
    expect(resolveGlassMode({ platform: "ios", supported: true, effectsEnabled: false })).toBe(GLASS_MODES.off);
  });

  it("web / bilinmeyen / argümansız → off", () => {
    expect(resolveGlassMode({ platform: "web" })).toBe(GLASS_MODES.off);
    expect(resolveGlassMode()).toBe(GLASS_MODES.off);
  });
});
