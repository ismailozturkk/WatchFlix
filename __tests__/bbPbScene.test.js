import { bbFrame, pbFrame, buildParticles, KIND, OVERLAY, SPRITE } from "../utils/weatherParticles";

const scene = { period: 75, rest: 2.5, y0: 0 };
const at = (u) => u * 30; // olay 30 sn (75 / 2,5)

describe("Breaking Bad and Prison Break scenes", () => {
  it("uses one vector scene clock for each story", () => {
    const bb = buildParticles("breakingBad", { count: 75, seed: 4 });
    const pb = buildParticles("prisonBreak", { count: 75, seed: 4 });
    expect(bb.find(p => p.kind === KIND.overlay && p.part === OVERLAY.mesa)).toMatchObject(scene);
    expect(pb.find(p => p.kind === KIND.overlay && p.part === OVERLAY.prison)).toMatchObject(scene);
    expect(bb.some(p => p.sprite === SPRITE.rv)).toBe(false);
    expect(bb.some(p => p.sprite === SPRITE.hat || p.sprite === SPRITE.flask)).toBe(false);
  });

  it("Breaking Bad: pants fall, RV arrives, cooks, Walter and Jesse step out, then leave", () => {
    expect(bbFrame(scene, at(0.05)).pants).toBeGreaterThanOrEqual(0);
    expect(bbFrame(scene, at(0.12)).drive).toBeGreaterThan(0);
    expect(bbFrame(scene, at(0.12)).dust).toBeGreaterThan(0);
    expect(bbFrame(scene, at(0.4)).smoke).toBeGreaterThan(0.9);
    expect(bbFrame(scene, at(0.4)).door).toBeGreaterThan(0.9);
    const mid = bbFrame(scene, at(0.6));
    expect(mid.outJ).toBe(1);
    expect(mid.outW).toBe(1);
    expect(mid.hold).toBe(1);
    expect(mid.glint).toBeGreaterThan(0);
    // içeri döndükten sonra kapı kapanır, karavan gider
    const late = bbFrame(scene, at(0.9));
    expect(late.visJ + late.visW).toBe(0);
    expect(late.depart).toBeGreaterThan(0);
    const rest = bbFrame(scene, 48);
    expect(rest.u).toBeGreaterThan(1);
    expect(rest.pants).toBe(-1);
    expect(rest.drive + rest.dust + rest.smoke + rest.door + rest.visJ + rest.visW).toBe(0);
  });

  it("Prison Break: the plan is drawn before the escape, alarm after", () => {
    expect(pbFrame(scene, at(0.08)).plan).toBeGreaterThan(0);
    expect(pbFrame(scene, at(0.13)).plan).toBe(1);
    expect(pbFrame(scene, at(0.3)).planO).toBe(0);
    expect(pbFrame(scene, at(0.5)).alarm).toBe(0);
    expect(pbFrame(scene, at(0.85)).alarm).toBe(1);
    const rest = pbFrame(scene, 48);
    expect(rest.plan + rest.planO + rest.alarm).toBe(0);
  });
});
