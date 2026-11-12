// Evren sahnelerinin rota bütünlüğü: anahtar kareler artan ve sonlu, pencereler geçerli.
// (Aynı u'lu iki satır ya da sırasız satır, ara değerde 0'a bölme/sıçrama üretir.)
import { KF_STRIDE, KIND, buildParticles } from "../utils/weatherParticles";

const SCENES = [
  "swScene", "matrixScene", "hpScene", "lotrScene", "duneScene", "batScene", "spiderScene", "bbScene", "gotScene",
  "vikScene", "pbScene", "aotScene", "rmScene",
];

describe("evren sahneleri — rota bütünlüğü", () => {
  for (const e of SCENES) {
    it(`${e}: anahtar kareler [0,1] aralığında artan ve sonlu; saçılma pencereleri geçerli`, () => {
      for (const light of [false, true]) {
        const list = buildParticles(e, { count: 50, seed: 3, lightSurface: light });
        expect(list.length).toBeGreaterThan(0);
        list.forEach((p, i) => {
          if (p.kf) {
            const n = p.kf.length / KF_STRIDE;
            expect(p.kf[0]).toBe(0);
            expect(p.kf[(n - 1) * KF_STRIDE]).toBe(1);
            for (let r = 0; r < n; r += 1) {
              for (let c = 0; c < KF_STRIDE; c += 1) expect(Number.isFinite(p.kf[r * KF_STRIDE + c])).toBe(true);
              if (r > 0) {
                const ok = p.kf[r * KF_STRIDE] > p.kf[(r - 1) * KF_STRIDE];
                if (!ok) throw new Error(`${e}#${i}: satır ${r} sırasız (u=${p.kf[r * KF_STRIDE]})`);
              }
            }
          }
          if (p.kind === KIND.emit && !p.loop) {
            expect(p.w0).toBeGreaterThanOrEqual(0);
            expect(p.w1).toBeLessThanOrEqual(1.0001);
            expect(p.w1).toBeGreaterThan(p.w0);
            expect(p.life).toBeGreaterThan(0);
          }
        });
      }
    });
  }
});
