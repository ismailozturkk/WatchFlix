// Game of Thrones sahnesi zaman çizelgesi (gotFrame): olay sırası, değer aralıkları, dinlenme.
import { KIND, OVERLAY, buildParticles, gotFrame } from "../utils/weatherParticles";

const wallOf = () => buildParticles("got", { count: 60, seed: 5 }).find((q) => q.kind === KIND.overlay && q.part === OVERLAY.iceWall);

const tAt = (p, u) => {
  let c = u / p.rest - p.y0;
  c -= Math.floor(c);
  return c * p.period + p.period * 3;
};

describe("gotFrame", () => {
  const p = wallOf();

  it("değerler sonlu ve 0–1", () => {
    for (let u = 0; u <= 1; u += 0.0025) {
      for (const [key, v] of Object.entries(gotFrame(p, tAt(p, u)))) {
        expect(Number.isFinite(v)).toBe(true);
        if (key === "u") continue;
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("sıra: gelir → nefes → ateş → ısınma → çöküş → gider → ordu → duvar onarılır", () => {
    const first = (pred) => {
      for (let u = 0; u <= 1; u += 0.001) if (pred(gotFrame(p, tAt(p, u)))) return u;
      return 2;
    };
    const arrived = first((f) => f.fly > 0.99);
    const inhale = first((f) => f.inhale > 0.5);
    const breath = first((f) => f.breath > 0.9);
    const heat = first((f) => f.heat > 0.9);
    const fall = first((f) => f.fall > 0.5);
    const gone = first((f) => f.leave > 0.99);
    const army = first((f) => f.armyO > 0.9);
    expect(arrived).toBeLessThan(inhale);
    expect(inhale).toBeLessThan(breath);
    expect(breath).toBeLessThan(heat);
    expect(heat).toBeLessThan(fall);
    expect(fall).toBeLessThan(gone);
    // ordu çöküşten sonra, ejderha uzaklaşırken akmaya başlar
    expect(fall).toBeLessThan(army);
    expect(first((f) => f.leave > 0.05)).toBeLessThan(army);
    expect(gone).toBeGreaterThan(fall);
    // ateş yalnız ejderha havada dururken; ejderha giderken ateş sönmüş
    expect(gotFrame(p, tAt(p, 0.2)).breath).toBe(0);
    expect(gotFrame(p, tAt(p, 0.6)).breath).toBeLessThan(0.01);
    // döngü sonunda duvar sağlam, moloz yok
    const end = gotFrame(p, tAt(p, 0.995));
    expect(end.vis).toBeGreaterThan(0.95);
    expect(end.fall).toBe(0);
    expect(end.rubble).toBeLessThan(0.1);
  });

  it("dinlenmede ejderha, ateş ve ordu yok; duvar sağlam", () => {
    const f = gotFrame(p, tAt(p, 1.8));
    expect(f.u).toBeGreaterThan(1);
    expect(f.dvis + f.breath + f.heat + f.fall + f.armyO + f.shake + f.dust).toBe(0);
    expect(f.vis).toBe(1);
  });
});
