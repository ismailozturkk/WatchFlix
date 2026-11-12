import { buildParticles, KIND, OVERLAY, particleAlpha, particlePose, starWarsLayout, swFrame } from "../utils/weatherParticles";

const clock = { period: 120, rest: 2, y0: 0 };

describe("Star Wars atmosphere choreography", () => {
  it("keeps the vector scene, chase and laser particles on valid clocks", () => {
    const ps = buildParticles("starWars", { count: 150, seed: 6 });
    expect(ps.find(p => p.kind === KIND.overlay && p.part === OVERLAY.swPlanet)).toMatchObject(clock);
    expect(ps.filter(p => p.kind === KIND.emit && p.dirFace && p.dirA === Math.PI).length).toBeGreaterThan(0);
    expect(ps.filter(p => p.kind === KIND.emit && p.dirFace && p.dirA === 0).length).toBeGreaterThan(0);
  });

  it("fades the planet into the blast and opens hyperspace before the jump", () => {
    const before = swFrame(clock, 31.1);
    const during = swFrame(clock, 32);
    const hyper = swFrame(clock, 53);
    const resting = swFrame(clock, 70);
    expect(before.planet).toBeGreaterThan(during.planet);
    expect(during.planet).toBeGreaterThan(0);
    expect(during.blast).toBe(true);
    expect(hyper.hyper).toBeGreaterThan(0);
    expect(hyper.fv).toBe(1);
    expect(resting.hyper).toBe(0);
    expect(resting.planet).toBe(0);
  });

  it("keeps the laser impact and charge particles aligned with the vector art", () => {
    for (const [width, height] of [[390, 844], [320, 720], [600, 800]]) {
      const L = starWarsLayout(width, height);
      expect(Math.hypot(L.hit[0] - L.pcx, L.hit[1] - L.pcy)).toBeCloseTo(L.Rp, 5);
      expect(L.dish[0]).toBeGreaterThan(L.pcx);
      expect(L.dish[1]).toBeLessThan(L.pcy);
      const charge = buildParticles("swScene", { count: 125, seed: 6 }).filter(
        p => p.kind === KIND.emit && p.speedV === 0 && p.ox === -56 * 0.32 && p.oy === -56 * 0.34,
      );
      expect(charge).toHaveLength(4);
      const active = Array.from({ length: 48 }, (_, i) => 25.8 + i * 0.1).flatMap(t =>
        charge.filter(p => particleAlpha(p, t, height) > 0.01).map(p => particlePose(p, t, width, height)),
      );
      expect(active.length).toBeGreaterThan(0);
      for (const pose of active) expect(Math.hypot(pose.x - L.dish[0], pose.y - L.dish[1])).toBeLessThan(0.01);
    }
  });
});
