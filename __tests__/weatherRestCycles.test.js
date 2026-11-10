// Seyreklik (rest) döngüleri: olay döngünün ilk 1/rest kadarında; kalanında rota ve saçılma görünmez.
import { KIND, buildParticles, particleAlpha } from "../utils/weatherParticles";

const H = 844;
const SCENES = [
  "swScene", "matrixScene", "hpScene", "lotrScene", "duneScene", "batScene", "spiderScene", "gotScene", "vikScene",
  "shScene", "aotScene", "narScene", "opScene", "rmScene",
];

describe("evren sahneleri — seyreklik", () => {
  for (const e of SCENES) {
    it(`${e}: dinlenme aralığında olay parçacıkları görünmez`, () => {
      const list = buildParticles(e, { count: 50, seed: 4 });
      const resting = list.filter((p) => (p.kind === KIND.track || p.kind === KIND.emit) && p.rest > 1);
      for (const p of resting) {
        // ters yön: olay penceresinin dışındaki u'larda alfa 0 olmalı
        for (let s = 0; s < 40; s += 1) {
          const uFull = 1 / p.rest + (1 - 1 / p.rest) * (0.04 + (s / 40) * 0.92);
          // t: (uFull - y0 + tlag) * period (mod period)
          const t = (uFull - p.y0 + p.tlag) * p.period + p.period * 3;
          if (p.kind === KIND.emit && p.loop) continue;
          if (p.kind === KIND.track && p.sprite < 0) continue;
          const a = particleAlpha(p, t, H);
          if (a > 0.011 && p.a > 0.02) throw new Error(`${e}: u=${uFull.toFixed(3)} rest=${p.rest} alfa=${a}`);
        }
      }
      expect(resting.length).toBeGreaterThan(0);
    });
  }
});
