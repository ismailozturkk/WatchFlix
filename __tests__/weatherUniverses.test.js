import {
  KIND,
  OVERLAY,
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
    // 12 Kas eklenenler (TMDB'den doğrulandı)
    expect(universeFor({ type: "movie", id: 157336 })).toBe("interstellar");
    expect(universeFor({ type: "movie", id: 335984 })).toBe("bladeRunner");
    expect(universeFor({ type: "movie", id: 78, collectionId: 422837 })).toBe("bladeRunner");
    expect(universeFor({ type: "tv", id: 66732 })).toBe("strangerThings");
    expect(universeFor({ type: "tv", id: 100088 })).toBe("lastOfUs");
    expect(universeFor({ type: "tv", id: 85937 })).toBe("demonSlayer");
    expect(universeFor({ type: "movie", id: 635302 })).toBe("demonSlayer");
    expect(universeFor({ type: "movie", id: 129 })).toBe("ghibli");
    expect(universeFor({ type: "movie", id: 8392 })).toBe("ghibli");
    // 12 Kas ikinci paket (TMDB sayfalarından doğrulandı)
    expect(universeFor({ type: "movie", id: 329, collectionId: 328 })).toBe("jurassicPark");
    expect(universeFor({ type: "movie", id: 19995, collectionId: 87096 })).toBe("avatar");
    expect(universeFor({ type: "movie", id: 76341, collectionId: 8945 })).toBe("madMax");
    expect(universeFor({ type: "movie", id: 22, collectionId: 295 })).toBe("pirates");
    expect(universeFor({ type: "movie", id: 27205 })).toBe("inception");
    expect(universeFor({ type: "movie", id: 597 })).toBe("titanic");
    expect(universeFor({ type: "tv", id: 70523 })).toBe("dark");
    expect(universeFor({ type: "tv", id: 93405 })).toBe("squidGame");
    expect(universeFor({ type: "tv", id: 46298 })).toBe("hunterXHunter");
    expect(universeFor({ type: "tv", id: 95479 })).toBe("jujutsuKaisen");
    expect(universeFor({ type: "movie", id: 810693 })).toBe("jujutsuKaisen");
    expect(universeFor({ type: "movie", id: 1399 })).toBeNull();
    expect(universeFor({ type: "movie", id: 550 })).toBeNull();
    expect(universeFor(null)).toBeNull();
    expect(universeFor({ type: "movie" })).toBeNull();
  });

  it("40 evren, 3 grup (17 + 12 + 11); hepsi seçicide (Sopranos 12 Kas'ta kaldırıldı, 13 Kas'ta 6 yeni)", () => {
    expect(UNIVERSE_IDS).toHaveLength(40);
    expect(UNIVERSE_IDS).not.toContain("sopranos");
    expect(UNIVERSE_GROUPS.map((g) => g.effects.length)).toEqual([17, 12, 11]);
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

  it("GoT: ejderha artık atlas sprite'ı değil (vektör sahne), duvar katmanı olay saatiyle kurulur", () => {
    const ps = buildParticles("got", { count: 105, seed: 3 });
    expect(ps.some((p) => p.kind === KIND.track && p.sprite === SPRITE.dragonOpen)).toBe(false);
    const wall = ps.find((p) => p.kind === KIND.overlay && p.part === OVERLAY.iceWall);
    expect(wall.period).toBe(75);
    expect(wall.rest).toBe(2.5);
  });
  // Spider-Man ağ ipi artık vektör sahnede (components/decor/spiderScene.js)
  // FMA cep saati zinciri artık vektör sahnede (components/decor/fmaScene.js)
  it("ipler: ODM halatı yalnız kendi penceresinde", () => {
    for (const id of ["aot"]) {
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
        expect(off).toBeGreaterThan(0);
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
