// Attack on Titan sahnesi zaman çizelgesi (aotFrame): olay sırası ve değer aralıkları.
import { AOT_KICK_U, KIND, OVERLAY, aotFrame, buildParticles } from "../utils/weatherParticles";

const wallOf = (light = false) =>
  buildParticles("aot", { count: 60, seed: 5, lightSurface: light }).find((q) => q.kind === KIND.overlay && q.part === OVERLAY.titanWall);

// u (olay saati) → t
const tAt = (p, u) => {
  // çift döngü = olay A (tek döngülerde sahnenin olay B'si oynar: eventU)
  return (4 + u / p.rest - p.y0) * p.period;
};

describe("aotFrame", () => {
  const p = wallOf();

  it("duvar katmanı olay saatiyle kurulur; dev artık atlas sprite'ı değil", () => {
    expect(p.period).toBe(80);
    expect(p.rest).toBe(2.5);
    const list = buildParticles("aot", { count: 60, seed: 5 });
    expect(list.some((q) => q.kind === KIND.track && q.size >= 150)).toBe(false);
  });

  it("tüm değerler sonlu ve 0–1 (deb: −1 ya da 0–1)", () => {
    for (let u = 0; u <= 1; u += 0.0025) {
      const f = aotFrame(p, tAt(p, u));
      for (const [key, v] of Object.entries(f)) {
        expect(Number.isFinite(v)).toBe(true);
        if (key === "u") continue;
        if (key === "deb") expect(v === -1 || (v >= 0 && v <= 1)).toBe(true);
        else if (key === "lean") expect(Math.abs(v)).toBeLessThanOrEqual(1);
        else {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("sıra: şimşek → yükseliş → el → tekme (kapı kırılır, ayak görünür) → kayboluş", () => {
    const first = (pred) => {
      for (let u = 0; u <= 1; u += 0.001) if (pred(aotFrame(p, tAt(p, u)))) return u;
      return 2;
    };
    const flash = first((f) => f.flash > 0.5);
    const risen = first((f) => f.rise > 0.95);
    const hand = first((f) => f.hand > 0.95);
    const broken = first((f) => f.broken > 0.5);
    const foot = first((f) => f.foot > 0.9);
    const gone = first((f) => f.vanish > 0.95);
    expect(flash).toBeLessThan(risen);
    expect(risen).toBeLessThan(hand);
    expect(hand).toBeLessThan(broken);
    expect(broken).toBeGreaterThanOrEqual(AOT_KICK_U - 0.001);
    expect(foot).toBeLessThan(AOT_KICK_U + 0.03);
    expect(gone).toBeGreaterThan(foot);
    // tekmeden önce kapı sağlam, tekmede sahne sarsılır
    expect(aotFrame(p, tAt(p, AOT_KICK_U - 0.02)).broken).toBe(0);
    expect(aotFrame(p, tAt(p, AOT_KICK_U + 0.005)).shake).toBeGreaterThan(0.5);
    // döngü sonunda kapı onarılmış
    expect(aotFrame(p, tAt(p, 0.995)).broken).toBeLessThan(0.05);
  });

  it("sakin aralıkta (dinlenme) her şey kapalı, kapı sağlam", () => {
    const f = aotFrame(p, tAt(p, 1.6));
    expect(f.u).toBeGreaterThan(1);
    expect(f.rise + f.hand + f.broken + f.foot + f.dust + f.flash + f.burst + f.shake).toBe(0);
    expect(f.deb).toBe(-1);
  });

  it("şimşek tek ve kısa (ışığa duyarlılık): olay başına bir çakma, < 2 sn", () => {
    let onsets = 0;
    let lit = 0;
    let prev = 0;
    // iki döngü: biri olay A (şimşekli), öbürü olay B (sahne sakin)
    for (let t = 0; t < 2 * p.period; t += 1 / 60) {
      const a = aotFrame(p, t).flash;
      if (a > 0.05 && prev <= 0.05) onsets += 1;
      if (a > 0.05) lit += 1 / 60;
      prev = a;
    }
    expect(onsets).toBe(1);
    expect(lit).toBeLessThan(2);
  });
});
