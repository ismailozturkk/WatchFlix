import {
  KIND,
  SPRITE,
  SPRITE_COUNT,
  buildParticles,
  isVectorParticle,
  particleAlpha,
  particlePose,
  particleSprite,
  resolvePlan,
  sparkSlot,
  tetherFrame,
  WEATHER_EFFECTS,
} from "../utils/weatherParticles";
import { UNIVERSE_GROUPS, UNIVERSE_IDS, universeFor, universeTitleKey } from "../utils/weatherUniverses";

const W = 390;
const H = 844;
const wrap = (v) => v - Math.floor(v);

describe("evren eşlemesi (detay ekranı)", () => {
  it("koleksiyon, film ve dizi kimlikleri doğru evrene gider; tür karışmaz", () => {
    expect(universeFor({ type: "movie", id: 11, collectionId: 10 })).toBe("starWars");
    expect(universeFor({ type: "movie", id: 841 })).toBe("dune");
    expect(universeFor({ type: "movie", id: 999999, collectionId: 119 })).toBe("lotr");
    expect(universeFor({ type: "tv", id: 1399 })).toBe("got");
    expect(universeFor({ type: "tv", id: "1396" })).toBe("breakingBad");
    expect(universeFor({ type: "tv", id: 31911 })).toBe("fma");
    // film kimliği dizi olarak sorulursa eşleşmez (TMDB kimlik uzayları ayrı)
    expect(universeFor({ type: "tv", id: 841 })).toBeNull();
    expect(universeFor({ type: "movie", id: 1399 })).toBeNull();
    expect(universeFor({ type: "movie", id: 550 })).toBeNull();
    expect(universeFor(null)).toBeNull();
    expect(universeFor({ type: "movie" })).toBeNull();
  });

  it("19 evren, 3 grup (7 + 6 + 6); hepsi seçicide", () => {
    expect(UNIVERSE_IDS).toHaveLength(19);
    expect(UNIVERSE_GROUPS.map((g) => g.effects.length)).toEqual([7, 6, 6]);
    for (const id of UNIVERSE_IDS) expect(WEATHER_EFFECTS).toContain(id);
  });

  it("bellek anahtarı kararlı", () => {
    expect(universeTitleKey({ type: "movie", id: 1, collectionId: 10 })).toBe("movie:1:10");
    expect(universeTitleKey(null)).toBe("");
  });
});

describe("evren sahneleri", () => {
  const TIMES = Array.from({ length: 48 }, (_, i) => i * 2.71 + 0.11);

  it.each(UNIVERSE_IDS)("%s: her yoğunlukta kurulur; duruş sonlu, opaklık 0–1, hücre geçerli", (id) => {
    for (const density of ["low", "medium", "high"]) {
      const plan = resolvePlan([id], density, "full");
      expect(plan.length).toBeGreaterThan(0);
      for (const [effect, count] of plan) {
        const ps = buildParticles(effect, { count, seed: 7 });
        expect(ps.length).toBeGreaterThan(0);
        for (const p of ps) {
          if (isVectorParticle(p)) continue;
          for (const t of TIMES) {
            const a = particleAlpha(p, t, H);
            expect(a).toBeGreaterThanOrEqual(0);
            expect(a).toBeLessThanOrEqual(1);
            const pose = particlePose(p, t, W, H);
            for (const v of [pose.scos, pose.ssin, pose.tx, pose.ty]) expect(Number.isFinite(v)).toBe(true);
            const cell = particleSprite(p, t);
            expect(cell).toBeGreaterThanOrEqual(0);
            expect(cell).toBeLessThan(SPRITE_COUNT);
          }
        }
      }
    }
  });

  it("GoT: ejderha ateşi yalnız havada durduğu pencerede, döngü sonunda ejderha görünmez", () => {
    const ps = buildParticles("got", { count: 105, seed: 3 });
    const dragon = ps.find((p) => p.kind === KIND.track && p.sprite === SPRITE.dragonOpen);
    expect(dragon).toBeTruthy();
    const fire = ps.filter((p) => p.kind === KIND.emit && p.kf === dragon.kf && p.w0 * dragon.rest > 0.3 && p.w0 * dragon.rest < 0.4);
    expect(fire.length).toBeGreaterThanOrEqual(16);
    let seen = 0;
    for (let t = 0; t < dragon.period; t += 0.05) {
      const u = wrap(t / dragon.period + dragon.y0 - dragon.tlag) * dragon.rest;
      for (const f of fire) {
        if (particleAlpha(f, t, H) > 0.001) {
          seen += 1;
          expect(u).toBeGreaterThanOrEqual(0.33);
          expect(u).toBeLessThanOrEqual(0.48 + f.life * dragon.rest + 0.01);
        }
      }
      if (u > 0.75) expect(particleAlpha(dragon, t, H)).toBe(0);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("ipler: ağ ve ODM halatı yalnız kendi penceresinde, saat zinciri sürekli", () => {
    for (const id of ["spiderMan", "aot", "fma"]) {
      const ps = buildParticles(id, { count: 60, seed: 5 });
      const tethers = ps.filter((p) => p.kind === KIND.overlay && p.part === 29);
      expect(tethers.length).toBeGreaterThan(0);
      for (const p of tethers) {
        let on = 0;
        let off = 0;
        for (let t = 0; t < 240; t += 0.25) {
          const f = tetherFrame(p, t, W, H);
          if (f.a > 0) {
            on += 1;
            for (const v of [f.x1, f.y1, f.x2, f.y2]) expect(Number.isFinite(v)).toBe(true);
          } else off += 1;
        }
        expect(on).toBeGreaterThan(0);
        if (id === "fma") expect(off).toBe(0);
        else expect(off).toBeGreaterThan(0);
      }
    }
  });
});

describe("ışığa duyarlılık", () => {
  it("simya şimşekleri: herhangi 1 sn'de en çok 3 çakma", () => {
    const p = { period: 18, y0: 0 };
    const onsets = [];
    for (let i = 0; i < 3; i += 1) {
      let prev = 0;
      for (let t = 0; t < 72; t += 1 / 120) {
        const a = sparkSlot(p, t, i).a;
        if (a > 0 && prev === 0) onsets.push(t);
        prev = a;
      }
    }
    onsets.sort((a, b) => a - b);
    expect(onsets.length).toBeGreaterThan(0);
    for (let i = 0; i + 3 < onsets.length; i += 1) expect(onsets[i + 3] - onsets[i]).toBeGreaterThanOrEqual(1);
  });
});
