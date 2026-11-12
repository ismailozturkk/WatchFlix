// Rick and Morty sahnesi zaman çizelgesi (rmFrame): olay sırası, değer aralıkları, dinlenme.
import { KIND, OVERLAY, buildParticles, rmFrame } from "../utils/weatherParticles";

const portalOf = (light = false) =>
  buildParticles("rickAndMorty", { count: 60, seed: 5, lightSurface: light }).find((q) => q.kind === KIND.overlay && q.part === OVERLAY.rmPortal);

const tAt = (p, u) => {
  let c = u / p.rest - p.y0;
  c -= Math.floor(c);
  return c * p.period + p.period * 3;
};

describe("rmFrame", () => {
  const p = portalOf();

  it("portal katmanı 66 sn döngü, 30 sn olay; büyük karakter sprite'ı yok", () => {
    expect(p.period).toBe(66);
    expect(p.rest).toBe(2.2);
    const list = buildParticles("rickAndMorty", { count: 60, seed: 5 });
    expect(list.some((q) => q.kind === KIND.track && q.size >= 40)).toBe(false);
  });

  it("değerler sonlu; açıklıklar 0–1,2, ilerlemeler 0–1, pencereler −1 ya da 0–1", () => {
    for (let u = 0; u <= 1; u += 0.0025) {
      const f = rmFrame(p, tAt(p, u));
      for (const [key, v] of Object.entries(f)) {
        expect(Number.isFinite(v)).toBe(true);
        if (key === "u") continue;
        if (["a", "b", "c"].includes(key)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1.2);
        } else if (["burp", "shot", "ship", "sa", "sb", "sc"].includes(key)) {
          expect(v === -1 || (v >= 0 && v <= 1)).toBe(true);
        } else {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("sıra: portal A → çıkış → A kapanır → içme → nişan/atış → portal B → giriş → B kapanır → araç", () => {
    const first = (pred) => {
      for (let u = 0; u <= 1; u += 0.001) if (pred(rmFrame(p, tAt(p, u)))) return u;
      return 2;
    };
    const aOpen = first((f) => f.a > 0.9);
    const rickOut = first((f) => f.r1 > 0.5);
    const aShut = first((f) => f.r1 >= 1 && f.a < 0.01);
    const swig = first((f) => f.swig > 0.9);
    const shot = first((f) => f.shot >= 0);
    const bOpen = first((f) => f.b > 0.9);
    const inB = first((f) => f.m2 >= 1);
    const bShut = first((f) => f.m2 >= 1 && f.b < 0.01);
    const ship = first((f) => f.ship >= 0);
    expect(aOpen).toBeLessThan(rickOut);
    expect(rickOut).toBeLessThan(aShut);
    expect(aShut).toBeLessThan(swig);
    expect(swig).toBeLessThan(shot);
    expect(shot).toBeLessThan(bOpen);
    expect(bOpen).toBeLessThan(first((f) => f.r2 > 0));
    expect(inB).toBeLessThanOrEqual(bShut);
    expect(bShut).toBeLessThanOrEqual(ship + 0.05);
    // karakterler portal açıkken geçer: çıkarken A, girerken B tam açık
    expect(rmFrame(p, tAt(p, 0.1)).a).toBeGreaterThan(0.95);
    expect(rmFrame(p, tAt(p, 0.66)).b).toBeGreaterThan(0.95);
    // araç gök portalından çıkarken portal açık
    expect(rmFrame(p, tAt(p, 0.8)).c).toBeGreaterThan(0.9);
  });

  it("dinlenmede her şey kapalı", () => {
    const f = rmFrame(p, tAt(p, 1.7));
    expect(f.u).toBeGreaterThan(1);
    expect(f.a + f.b + f.c + f.ampR + f.ampM + f.swig + f.aim).toBe(0);
    expect(f.ship).toBe(-1);
    expect(f.shot).toBe(-1);
  });
});
