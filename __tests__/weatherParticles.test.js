import {
  BURST_SIZE,
  ORBIT_RADII,
  SOLAR_PHASES,
  orbitScale,
  COLORED_SPRITES,
  FIREWORK_SPARKS,
  FIREWORK_TRAIL,
  SPECIAL_DAYS,
  specialDayOf,
  COMPOSITES,
  GENRE_EFFECT,
  GENRE_FAMILIES,
  genreFamilyOf,
  GENRE_MIX_MAX,
  INTERNAL_EFFECTS,
  KIND,
  OVERLAY,
  OVERLAY_FRONT,
  OVERLAY_UNDER,
  EFFECT_SCENE,
  equalizerLevel,
  hazeLine,
  overlayFrame,
  overlaySlot,
  overlayStyle,
  SPRITE,
  SPRITE_CELL,
  SPRITE_COLS,
  SPRITE_COUNT,
  SPRITE_RECT,
  SPRITE_ROWS,
  BOLT_VARIANTS,
  TMDB_GENRE_IDS,
  WEATHER_CHOICES,
  WEATHER_EFFECTS,
  WEATHER_GROUPS,
  WEATHER_GROUP_MAX,
  autoWeatherEffect,
  boltStrike,
  buildBoltShape,
  buildParticles,
  isVectorParticle,
  shoreGeometry,
  shoreLayerOffset,
  shoreMetrics,
  shoreStyle,
  swashAt,
  buildPlanParticles,
  frameIntervalMs,
  genreEffectsFor,
  getWeatherSpec,
  growthAt,
  needsAnimatedAlpha,
  needsAnimatedSprites,
  normalizeWeatherChoice,
  normalizeWeatherDensity,
  particleAlpha,
  particlePose,
  particleSprite,
  previewParticleCount,
  resolveParticleCount,
  resolvePlan,
  resolveWeatherEffect,
  seasonalWeatherEffect,
  specialDayEffect,
  spriteOrigin,
  weatherGroupOf,
} from "../utils/weatherParticles";
import { GENRE_IDS } from "../utils/genreCanon";
import { SCENE_BUILDERS, UNIVERSE_IDS } from "../utils/weatherUniverses";
import { Keys } from "../services/storage";

const W = 400;
const H = 860;
const TIMES = [0, 0.016, 1, 2.3, 7.5, 60, 3600, 86400 * 3 + 0.123];
const ALL = [...WEATHER_EFFECTS, ...INTERNAL_EFFECTS];

// Şekil dikdörtgeninin (yerel u, v) noktasının ekrandaki yeri.
const local = (pose, u, v) => ({
  x: pose.scos * u - pose.ssin * v + pose.tx,
  y: pose.ssin * u + pose.scos * v + pose.ty,
});

describe("weatherParticles — katalog", () => {
  it("7 grup (4 + film/dizi/anime), 59 efekt + auto; grup başına en çok 17, her seçim tek grupta, her efektin kendi tanımı var", () => {
    expect(WEATHER_GROUPS.map((g) => g.id)).toEqual(["seasons", "sky", "nature", "festive", "films", "series", "anime"]);
    for (const g of WEATHER_GROUPS) expect(g.effects.length).toBeLessThanOrEqual(WEATHER_GROUP_MAX);
    expect(WEATHER_CHOICES[0]).toBe("auto");
    expect(WEATHER_EFFECTS).toHaveLength(59);
    expect(new Set(WEATHER_CHOICES).size).toBe(WEATHER_CHOICES.length);
    for (const e of ALL) {
      expect(getWeatherSpec(e)).toBeTruthy();
      if (e !== "snow") expect(getWeatherSpec(e)).not.toBe(getWeatherSpec("snow"));
    }
    expect(weatherGroupOf("popcorn")).toBe("festive");
    expect(weatherGroupOf("auto")).toBe("seasons");
    expect(weatherGroupOf("aurora")).toBe("sky");
  });

  it("kaldırılan efektler (film tozu, bokeh, sis, projektör, kabarcık) seçilemez, eski kayıt kara düşer", () => {
    for (const gone of ["filmDust", "bokeh", "fog", "projector", "bubbles"]) {
      expect(WEATHER_CHOICES).not.toContain(gone);
      expect(normalizeWeatherChoice(gone)).toBe("snow");
      expect(Keys.weatherEffect.validate(gone)).toBe(false);
    }
  });

  it("iç efektler seçicide görünmez", () => {
    for (const e of INTERNAL_EFFECTS) expect(WEATHER_CHOICES).not.toContain(e);
  });

  it("depo doğrulayıcısı kataloğun tamamını kabul eder (registry ile senkron)", () => {
    for (const c of WEATHER_CHOICES) expect(Keys.weatherEffect.validate(c)).toBe(true);
    expect(Keys.weatherEffect.validate("tornado")).toBe(false);
    expect(Keys.atmosphereByGenre.default).toBe(true);
  });

  it("şekil tablosu: kanat çırpanların kapalı karesi hemen sonra, hepsi ızgara içinde", () => {
    expect(SPRITE.butterflyClosed).toBe(SPRITE.butterflyOpen + 1);
    expect(SPRITE.batClosed).toBe(SPRITE.batOpen + 1);
    expect(SPRITE.gullClosed).toBe(SPRITE.gullOpen + 1);
    const ids = Object.values(SPRITE);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.max(...ids)).toBe(SPRITE_COUNT - 1);
    expect(SPRITE_COLS * SPRITE_ROWS).toBeGreaterThanOrEqual(SPRITE_COUNT);
    for (const s of ids) {
      const o = spriteOrigin(s);
      expect(o.x).toBe((s % SPRITE_COLS) * SPRITE_CELL);
      expect(o.y).toBe(Math.floor(s / SPRITE_COLS) * SPRITE_CELL);
      expect(o.x + SPRITE_CELL).toBeLessThanOrEqual(SPRITE_COLS * SPRITE_CELL);
      expect(o.y + SPRITE_CELL).toBeLessThanOrEqual(SPRITE_ROWS * SPRITE_CELL);
    }
    // ızgara 2048 px doku sınırının altında
    expect(SPRITE_COLS * SPRITE_CELL).toBeLessThanOrEqual(2048);
  });

  it("dar dikdörtgenler hücre içinde ve yatayda ortalı (dönüş ekseni şeklin ekseni)", () => {
    for (const [sprite, [x, y, w, h]] of Object.entries(SPRITE_RECT)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(100);
      expect(y + h).toBeLessThanOrEqual(100);
      expect(x + w / 2).toBe(50);
      expect(Number(sprite)).toBeLessThan(SPRITE_COUNT);
    }
  });
});

describe("weatherParticles — seçim çözümü", () => {
  it("bilinmeyen seçim kara, bilinmeyen yoğunluk auto'ya düşer", () => {
    expect(normalizeWeatherChoice("tornado")).toBe("snow");
    expect(normalizeWeatherChoice(undefined)).toBe("snow");
    expect(normalizeWeatherDensity("max")).toBe("auto");
  });

  it("mevsime göre: Ara–Şub kar, Mar–May bahar bahçesi, Haz–Ağu yaz kıyısı, Eyl–Kas yaprak", () => {
    const at = (m) => seasonalWeatherEffect(new Date(2026, m, 15));
    expect([11, 0, 1].map(at)).toEqual(["snow", "snow", "snow"]);
    expect([2, 3, 4].map(at)).toEqual(["springGarden", "springGarden", "springGarden"]);
    expect([5, 6, 7].map(at)).toEqual(["summerShore", "summerShore", "summerShore"]);
    expect([8, 9, 10].map(at)).toEqual(["leaves", "leaves", "leaves"]);
    expect(resolveWeatherEffect("rain", new Date(2026, 0, 15))).toBe("rain");
  });

  it("sabit tarihli özel günler mevsimi ezer, yalnız o gün", () => {
    const d = (m, day) => new Date(2027, m, day, 12);
    expect(specialDayEffect(d(11, 31))).toBe("fireworks");
    expect(specialDayEffect(d(0, 1))).toBe("fireworks");
    expect(specialDayEffect(d(1, 14))).toBe("hearts");
    expect(specialDayEffect(d(9, 31))).toBe("halloween");
    expect(specialDayEffect(d(0, 2))).toBeNull();
    expect(specialDayEffect(d(1, 13))).toBeNull();
    expect(specialDayEffect(d(10, 1))).toBeNull();
    expect(autoWeatherEffect(d(1, 14))).toBe("hearts");
    expect(autoWeatherEffect(d(1, 15))).toBe("snow");
    expect(autoWeatherEffect(d(9, 30))).toBe("leaves");
    expect(resolveWeatherEffect("auto", d(9, 31))).toBe("halloween");
    // "Özel günler" açıkken (varsayılan) seçim ne olursa olsun günün efekti çizilir
    expect(resolveWeatherEffect("rain", d(9, 31))).toBe("halloween");
    // kapalıyken seçim korunur, auto yalnız mevsime bakar
    expect(resolveWeatherEffect("rain", d(9, 31), false)).toBe("rain");
    expect(resolveWeatherEffect("auto", d(9, 31), false)).toBe("leaves");
    expect(autoWeatherEffect(d(1, 14), false)).toBe("snow");
    expect(specialDayEffect(new Date("x"))).toBeNull();
  });

  it("özel gün tablosu: dünyada bilinen sabit günler, geçerli tarih ve efekt", () => {
    const ids = SPECIAL_DAYS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const seen = new Set();
    for (const s of SPECIAL_DAYS) {
      expect(ALL).toContain(s.effect);
      for (const [m, day] of s.dates) {
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThanOrEqual(11);
        expect(day).toBeGreaterThanOrEqual(1);
        expect(day).toBeLessThanOrEqual(31);
        expect(seen.has(m * 40 + day)).toBe(false); // aynı gün iki özel güne ait olamaz
        seen.add(m * 40 + day);
      }
    }
    const d = (m, day) => new Date(2027, m, day, 12);
    expect(specialDayOf(d(11, 25)).id).toBe("christmas");
    expect(specialDayEffect(d(11, 25))).toBe("christmas");
    expect(specialDayEffect(d(11, 28))).toBe("cinema");
    expect(specialDayEffect(d(2, 8))).toBe("rosePetals");
    expect(specialDayOf(d(5, 10))).toBeNull();
  });

  it("Noel: vektör köy sahnesi (OVERLAY.xmasVillage) + önünde kar; kızak sahnenin olayında", () => {
    expect(weatherGroupOf("christmas")).toBe("festive");
    const x = buildParticles("christmas", { count: 52, seed: 4 });
    const scene = x.filter((p) => p.kind === KIND.overlay);
    expect(scene.map((p) => p.part)).toEqual([OVERLAY.xmasVillage]);
    expect(x.filter((p) => p.kind !== KIND.overlay)).toHaveLength(51); // kalan her şey kar
    expect(x.some((p) => p.sprite === SPRITE.flake)).toBe(true);
    expect(x.some((p) => p.kind === KIND.glide)).toBe(false); // eski kızak parçacığı yok
    const p = scene[0];
    expect(p.y0).toBe(0);
    expect(p.period / p.rest).toBeGreaterThan(20); // kızak geçişi ~26 sn
    expect(p.period / p.rest).toBeLessThan(30);
  });

  it("Cadılar Bayramı: vektör perili köşk sahnesi (OVERLAY.haunted) + önünde yarasalar", () => {
    const x = buildParticles("halloween", { count: 14, seed: 6 });
    const scene = x.filter((p) => p.kind === KIND.overlay);
    expect(scene.map((p) => p.part)).toEqual([OVERLAY.haunted]);
    const rest = x.filter((p) => p.kind !== KIND.overlay);
    expect(rest.length).toBe(13);
    expect(rest.every((p) => p.sprite === SPRITE.batOpen || p.sprite === SPRITE.batClosed)).toBe(true);
    // eski mezar / örümcek / hayalet parçacıkları sahnede vektör
    for (const sp of [SPRITE.tombstone, SPRITE.spider, SPRITE.thread, SPRITE.ghost]) {
      expect(x.some((p) => p.sprite === sp)).toBe(false);
    }
  });

  it("Sinema Günü: patlamış mısır ve bilet birlikte", () => {
    const x = buildParticles("cinema", { count: 40, seed: 2 });
    expect(x.some((p) => p.sprite === SPRITE.popcorn)).toBe(true);
    expect(x.some((p) => p.sprite === SPRITE.ticket)).toBe(true);
  });

  it("renkli şekiller beyaza boyanır (doku renkleri korunur), diğerleri paletle", () => {
    expect(COLORED_SPRITES).toContain(SPRITE.sleigh);
    for (const light of [false, true]) {
      const x = ["xmasGoodies", "xmasScene", "sleigh"].flatMap((e) =>
        buildParticles(e, { count: 12, seed: 4, lightSurface: light }),
      );
      for (const q of x) {
        const white = q.r === 1 && q.g === 1 && q.b === 1;
        if (COLORED_SPRITES.includes(q.sprite)) expect(white).toBe(true);
      }
      expect(x.some((q) => q.sprite === SPRITE.xmasTree && !(q.r === 1 && q.g === 1 && q.b === 1))).toBe(true);
    }
  });

  it("Güneş sistemi: yıldız parçacıkları + tek vektör sahne (Güneş, gezegenler, kuşak, kara delik, pulsar, kuyruklu yıldız)", () => {
    expect(weatherGroupOf("solarSystem")).toBe("sky");
    const x = buildParticles("solarSystem", { count: 75, seed: 3 });
    const scene = x.filter((q) => q.kind === KIND.overlay && q.part === OVERLAY.orbits);
    expect(scene).toHaveLength(1);
    // sahne Atlas'ın önünde: yıldızlar Güneş'in ve gezegenlerin arkasında kalır
    expect(OVERLAY_FRONT).toContain(OVERLAY.orbits);
    // 75 sn döngü, 30 sn olay (kuyruklu yıldız + Güneş patlaması), faz 0
    expect(scene[0].period).toBe(75);
    expect(scene[0].rest).toBe(2.5);
    expect(scene[0].y0).toBe(0);
    // eski sprite cisimler yok; geri kalan hepsi yıldız
    expect(x.some((q) => q.kind === KIND.orbit)).toBe(false);
    for (const sp of [SPRITE.sun, SPRITE.earth, SPRITE.pulsar, SPRITE.blackHole, SPRITE.trail]) expect(x.some((q) => q.sprite === sp)).toBe(false);
    expect(x.filter((q) => q.kind !== KIND.overlay).every((q) => q.sprite === SPRITE.star || q.sprite === SPRITE.dot)).toBe(true);
  });

  it("yörüngeler: yarıçap sırası artar ve en dış yörünge ekrana sığar; başlangıç açıları sabit", () => {
    for (let i = 1; i < ORBIT_RADII.length; i += 1) expect(ORBIT_RADII[i]).toBeGreaterThan(ORBIT_RADII[i - 1]);
    for (const w of [320, 390, 430, 820]) expect(ORBIT_RADII[7] * orbitScale(w)).toBeLessThan(w / 2);
    expect(SOLAR_PHASES).toHaveLength(11);
    for (const a of SOLAR_PHASES) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(Math.PI * 2);
    }
  });

  it("karahindiba seçicide yok, bahar bahçesinin parçası; eski seçim bahara döner", () => {
    expect(WEATHER_CHOICES).not.toContain("dandelion");
    expect(normalizeWeatherChoice("dandelion")).toBe("springGarden");
    const garden = buildParticles("springGarden", { count: 52, seed: 2 });
    expect(garden.some((p) => p.sprite === SPRITE.dandelion)).toBe(true);
  });

  it("havai fişek: her grupta roket + kuyruk alttan çıkıp üst yarıda patlar, sonra kıvılcım saçılır", () => {
    const fw = buildParticles("fireworks", { count: BURST_SIZE, seed: 5 });
    const trail = fw.filter((p) => p.part === 1);
    const sparks = fw.filter((p) => p.part === 0);
    expect(trail).toHaveLength(FIREWORK_TRAIL);
    expect(sparks).toHaveLength(FIREWORK_SPARKS);
    const W = 400;
    const H = 800;
    const head = trail.find((p) => p.lag === 0);
    const spark = sparks[0];
    for (let n = 0; n < 6; n += 1) {
      const start = (n + 1 - head.y0) * head.period; // döngü n'nin başı (c = n + 1 → faz 0)
      const at = (p, k) => particlePose(p, start + k * p.duty * p.period, W, H);
      // yükseliş: başta altta, patlama anında üst yarıda
      expect(at(head, 0.02).y).toBeGreaterThan(H * 0.8);
      expect(at(head, head.launch - 0.005).y).toBeLessThan(H * 0.5);
      // roket yükselirken kıvılcım gizli; patlayınca kıvılcım görünür, roket gizli
      expect(particleAlpha(spark, start + 0.1 * head.duty * head.period, H)).toBe(0);
      expect(particleAlpha(head, start + 0.8 * head.duty * head.period, H)).toBe(0);
      expect(particleAlpha(spark, start + 0.45 * head.duty * head.period, H)).toBeGreaterThan(0);
    }
    // kuyruk geride: aynı anda başın altında
    const t = (1 - head.y0) * head.period + 0.15 * head.duty * head.period + head.period;
    const ys = trail.sort((a, b) => a.lag - b.lag).map((p) => particlePose(p, t, W, H).y);
    for (let i = 1; i < ys.length; i += 1) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1]);
  });

  it("auto yoğunluk efekt modunda her basamakta ayrışır", () => {
    for (const e of WEATHER_EFFECTS) {
      const full = resolveParticleCount(e, "auto", "full");
      const balanced = resolveParticleCount(e, "auto", "balanced");
      const off = resolveParticleCount(e, "auto", "off");
      expect(full).toBeGreaterThan(balanced);
      expect(balanced).toBeGreaterThan(off);
      expect(resolveParticleCount(e, "high", "off")).toBeGreaterThan(full);
    }
  });

  it("önizleme sayısı alanla orantılı, en az 6, en çok tam ekran", () => {
    expect(previewParticleCount(70, 0, W * H)).toBe(6);
    expect(previewParticleCount(70, W * H, W * H)).toBe(70);
    expect(previewParticleCount(70, W * 70, W * H)).toBeGreaterThanOrEqual(6);
  });

  it("Tam/Orta 60 fps, Kapalı 30 fps", () => {
    expect(frameIntervalMs("full")).toBeCloseTo(1000 / 60);
    expect(frameIntervalMs("balanced")).toBeCloseTo(1000 / 60);
    expect(frameIntervalMs("off")).toBeCloseTo(1000 / 30);
  });
});

describe("weatherParticles — türe göre", () => {
  it("20 kanonik türün her birinin kendi efekti var", () => {
    expect(Object.keys(GENRE_EFFECT).sort()).toEqual([...GENRE_IDS].sort());
    for (const e of Object.values(GENRE_EFFECT)) expect(ALL).toContain(e);
  });

  it("TMDB'nin 27 tür id'sinin (19 film + 16 dizi) hepsi bir efekte iner", () => {
    expect(TMDB_GENRE_IDS).toHaveLength(27);
    for (const id of TMDB_GENRE_IDS) expect(genreEffectsFor([id]).length).toBeGreaterThan(0);
  });

  it("her kanonik tür tam bir ailede; aile id'leri TMDB'nin tamamını kapsar", () => {
    for (const g of GENRE_IDS) {
      expect(GENRE_FAMILIES.filter((f) => f.genres.includes(g))).toHaveLength(1);
      expect(genreFamilyOf(g)).toBeTruthy();
    }
    const ids = GENRE_FAMILIES.flatMap((f) => [...f.movie, ...f.tv]);
    for (const id of TMDB_GENRE_IDS) expect(ids).toContain(id);
  });

  it("film ve dizi adı farklı olsa da aynı aile aynı atmosferi kullanır", () => {
    for (const f of GENRE_FAMILIES) {
      for (const id of [...f.movie, ...f.tv]) expect(genreEffectsFor([id])).toEqual([f.effect]);
    }
    // filmde Bilim Kurgu = dizide Bilim Kurgu & Fantazi = Fantastik
    expect(genreEffectsFor([878])).toEqual(genreEffectsFor([10765]));
    expect(genreEffectsFor([14])).toEqual(genreEffectsFor([10765]));
    expect(genreEffectsFor([28])).toEqual(genreEffectsFor([10759]));
    expect(genreEffectsFor([10752])).toEqual(genreEffectsFor([10768]));
    expect(genreEffectsFor(["Bilim Kurgu"])).toEqual(genreEffectsFor(["Bilim Kurgu & Fantazi"]));
    expect(genreEffectsFor(["Sci-Fi & Fantasy"])).toEqual(genreEffectsFor(["Science Fiction"]));
    expect(genreEffectsFor(["Çocuk"])).toEqual(genreEffectsFor(["Aile"]));
    expect(genreEffectsFor(["Haber"])).toEqual(genreEffectsFor(["Belgesel"]));
  });

  it("aksiyon + bilimkurgu + korku üç ayrı efektin karışımı; sıra TMDB sırası", () => {
    expect(genreEffectsFor([28, 12, 878, 27])).toEqual(["genreAction", "genreScifi", "genreHorror"]);
    expect(genreEffectsFor([{ id: 10749, name: "Romantik" }, { id: 27, name: "Korku" }])).toEqual(["genreRomance", "genreHorror"]);
  });

  it("bileşik dizi türleri tek aileye iner, tekrar eden efekt bir kez", () => {
    expect(genreEffectsFor([10759])).toEqual(["genreAction"]);
    expect(genreEffectsFor([10765, 878])).toEqual(["genreScifi"]);
    expect(genreEffectsFor([35, 10770])).toEqual(["genreComedy"]); // komedi + TV filmi aynı efekt
  });

  it(`en fazla ${GENRE_MIX_MAX} efekt`, () => {
    expect(genreEffectsFor([28, 878, 35, 18, 27])).toHaveLength(GENRE_MIX_MAX);
  });

  it("ad ile gelen türler (sezon/bölüm ekranı) da çözülür, bileşik ad dahil", () => {
    expect(genreEffectsFor(["Aksiyon & Macera"])).toEqual(["genreAction"]);
    expect(genreEffectsFor(["Action & Adventure", "Drama"])).toEqual(["genreAction", "genreDrama"]);
    expect(genreEffectsFor(["Sci-Fi & Fantasy"])).toEqual(["genreScifi"]);
    expect(genreEffectsFor(["Komedi"])).toEqual(["genreComedy"]);
    expect(genreEffectsFor(["Korku", "Gizem"])).toEqual(["genreHorror", "genreMystery"]);
  });

  it("her aile kendi bileşik atmosferini kullanır; parçaları gerçek efekt", () => {
    const seen = new Set();
    for (const f of GENRE_FAMILIES) {
      expect(f.effect.startsWith("genre")).toBe(true);
      expect(INTERNAL_EFFECTS).toContain(f.effect);
      expect(seen.has(f.effect)).toBe(false); // tarih ≠ belgesel artık
      seen.add(f.effect);
      const parts = COMPOSITES[f.effect];
      expect(parts.length).toBeGreaterThanOrEqual(2);
      for (const [sub] of parts) expect(getWeatherSpec(sub)).toBeTruthy();
      for (const level of ["low", "medium", "high"]) {
        const list = buildParticles(f.effect, { count: resolveParticleCount(f.effect, level, "full"), seed: 3 });
        expect(list.length).toBeGreaterThan(2);
      }
    }
  });

  it("aile bileşiklerinde ışık katmanı tam sayıda: sis 2, diğerleri 1; yoğunluk değiştirmez", () => {
    const lights = (effect, level) =>
      buildParticles(effect, { count: resolveParticleCount(effect, level, "full"), seed: 4 })
        .filter((p) => p.kind === KIND.overlay)
        .map((p) => p.part)
        .sort((a, b) => a - b);
    expect(lights("genreHorror", "low")).toEqual([OVERLAY.fog, OVERLAY.fog, OVERLAY.lamp].sort((a, b) => a - b));
    expect(lights("genreHorror", "high")).toEqual(lights("genreHorror", "low"));
    expect(lights("genreMusic", "medium")).toEqual([OVERLAY.equalizer]);
    expect(lights("genreReality", "medium")).toEqual([OVERLAY.spotlight, OVERLAY.paparazzi].sort((a, b) => a - b));
    expect(lights("genreDrama", "medium")).toEqual([]);
    const thriller = buildParticles("genreThriller", { count: 60, seed: 4 });
    expect(thriller.filter((p) => p.kind === KIND.bolt)).toHaveLength(1);
    expect(thriller.filter((p) => p.kind === KIND.screenFlash)).toHaveLength(1);
  });

  it("tanınmayan / boş tür atlanır", () => {
    expect(genreEffectsFor(null)).toEqual([]);
    expect(genreEffectsFor([])).toEqual([]);
    expect(genreEffectsFor([999999, "Bilinmeyen", null, ""])).toEqual([]);
  });

  it("plan: tek efekt tam sayı, karışımda her efekt payını alır", () => {
    const single = resolvePlan(["dandelion"], "medium", "full");
    expect(single).toEqual([["dandelion", resolveParticleCount("dandelion", "medium", "full")]]);
    // tek başına seçilen temel efekt sahnesiyle (arkada, ilk sırada); karışımda sahne yok
    expect(resolvePlan(["embers"], "medium", "full")).toEqual([
      ["campfireScene", 1],
      ["embers", resolveParticleCount("embers", "medium", "full")],
    ]);
    const mix = resolvePlan(["embers", "dandelion", "stardust"], "medium", "full");
    expect(mix.map(([e]) => e)).toEqual(["embers", "dandelion", "stardust"]); // sahne yok
    mix.forEach(([e, c]) => {
      expect(c).toBeLessThan(resolveParticleCount(e, "medium", "full"));
      expect(c).toBeGreaterThan(0);
    });
    expect(resolvePlan(["nope"], "medium", "full")).toEqual([]);
  });

  it("plan parçacıkları tek dizide, her efekt kendi şekliyle", () => {
    const plan = resolvePlan(genreEffectsFor([28, 27, 878]), "low", "full");
    const list = buildPlanParticles(plan, { seed: 5 });
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((p) => p.sprite === SPRITE.glow)).toBe(true); // kıvılcım
    expect(list.some((p) => p.sprite === SPRITE.batOpen)).toBe(true); // yarasa
    expect(list.some((p) => p.kind === KIND.meteor)).toBe(true); // yıldız tozu
    expect(buildPlanParticles(plan, { seed: 5 })).toEqual(list);
  });
});

describe("weatherParticles — üretim", () => {
  it("aynı tohum aynı diziyi, farklı tohum farklı diziyi verir", () => {
    const a = buildParticles("snow", { count: 20, seed: 42 });
    const b = buildParticles("snow", { count: 20, seed: 42 });
    const c = buildParticles("snow", { count: 20, seed: 43 });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("her efekt geçerli şekil, boyut ve renk üretir; açık zeminde farklı palet", () => {
    const structural = new Set(["fireworks", "lightning", "waves", "sand", "flowers", ...Object.keys(COMPOSITES), ...Object.keys(SCENE_BUILDERS)]);
    for (const e of ALL) {
      const list = buildParticles(e, { count: 64, seed: 7 });
      if (structural.has(e)) expect(list.length).toBeGreaterThan(0);
      else expect(list).toHaveLength(64);
      for (const p of list) {
        expect(p.sprite).toBeGreaterThanOrEqual(0);
        expect(p.sprite + (p.flapFreq ? 1 : 0)).toBeLessThan(SPRITE_COUNT);
        expect(p.size).toBeGreaterThan(0);
        expect(p.a).toBeGreaterThan(0);
        expect(p.a).toBeLessThanOrEqual(1);
        expect(p.cw).toBeGreaterThan(0);
        expect(p.ch).toBeGreaterThan(0);
        expect(p.rx + p.cw).toBeLessThanOrEqual(SPRITE_CELL + 1e-9);
        expect(p.ry + p.ch).toBeLessThanOrEqual(SPRITE_CELL + 1e-9);
        for (const ch of [p.r, p.g, p.b]) {
          expect(ch).toBeGreaterThanOrEqual(0);
          expect(ch).toBeLessThanOrEqual(1);
        }
      }
      const dark = buildParticles(e, { count: 16, seed: 7 });
      // yalnız renkli şekil çizen efekt temaya göre renk değiştirmez
      if (dark.every((q) => COLORED_SPRITES.includes(q.sprite))) continue;
      const light = buildParticles(e, { count: 16, seed: 7, lightSurface: true });
      const rgb = (l) => l.map((p) => [p.r, p.g, p.b]);
      expect(rgb(light)).not.toEqual(rgb(dark));
    }
  });

  it("sayı 0–400 arasına kırpılır; havai fişek patlama katına yuvarlanır", () => {
    expect(buildParticles("rain", { count: -5 })).toHaveLength(0);
    expect(buildParticles("rain", { count: 9999 })).toHaveLength(400);
    expect(buildParticles("fireworks", { count: 50 })).toHaveLength(2 * BURST_SIZE);
    expect(buildParticles("fireworks", { count: 6 })).toHaveLength(BURST_SIZE);
    expect(buildParticles("fireworks", { count: 0 })).toHaveLength(0);
    expect(buildParticles("storm", { count: 0 })).toHaveLength(0);
  });

  it("kar tamamen kristal", () => {
    expect(buildParticles("snow", { count: 40 }).every((p) => p.sprite === SPRITE.flake)).toBe(true);
  });

  it("yıldız tozunda iki kayan yıldız, havai fişekte grup ortak (merkez/zaman/renk)", () => {
    const stars = buildParticles("stardust", { count: 30 });
    expect(stars.filter((p) => p.kind === KIND.meteor)).toHaveLength(2);
    const fw = buildParticles("fireworks", { count: 2 * BURST_SIZE });
    for (const g of [0, 1]) {
      const grp = fw.filter((p) => p.group === g);
      expect(grp).toHaveLength(BURST_SIZE);
      for (const key of ["period", "y0", "salt", "r", "g", "b"]) {
        expect(new Set(grp.map((p) => p[key])).size).toBe(1);
      }
    }
    expect(fw[0].salt).not.toBe(fw[BURST_SIZE].salt);
  });

  it("fırtına = yağmur + bir şimşek (aydınlık + çizgi, aynı zamanlama); düz yağmurda şimşek yok", () => {
    const storm = buildParticles("storm", { count: 92, seed: 3 });
    expect(storm).toHaveLength(92);
    // + fırtına sahnesi (bulutlar, şehir, ıslak sokak, şemsiyeli yaya)
    expect(storm.filter((p) => p.kind === KIND.overlay).map((p) => p.part)).toEqual([OVERLAY.storm]);
    const flash = storm.filter((p) => p.kind === KIND.screenFlash);
    const bolt = storm.filter((p) => p.kind === KIND.bolt);
    expect(flash).toHaveLength(1);
    expect(bolt).toHaveLength(1);
    for (const key of ["period", "y0", "salt", "duty"]) expect(bolt[0][key]).toBe(flash[0][key]);
    expect(storm.filter((p) => p.sprite === SPRITE.streak)).toHaveLength(89);
    expect(buildParticles("rain", { count: 90 }).some((p) => p.kind === KIND.screenFlash)).toBe(false);
  });

  it("bahar bahçesi: vektör çayır sahnesi + sakura + karahindiba + kelebek (çim/çiçek parçacığı yok)", () => {
    const g = buildParticles("springGarden", { count: 24, seed: 2 });
    expect(g).toHaveLength(24);
    expect(g.filter((p) => p.kind === KIND.overlay).map((p) => p.part)).toEqual([OVERLAY.spring]);
    expect(g.some((p) => p.kind === KIND.anchor || p.kind === KIND.grow)).toBe(false);
    expect(g.some((p) => p.sprite === SPRITE.petal)).toBe(true);
    expect(g.some((p) => p.sprite === SPRITE.dandelion)).toBe(true);
    expect(g.some((p) => p.sprite === SPRITE.butterflyOpen)).toBe(true);
  });

  it("yaz kıyısı: 3 katman dalga + kum döşemesi + parıltı + martı", () => {
    const s = buildParticles("summerShore", { count: 44, seed: 2 });
    expect(s).toHaveLength(44);
    // gök + ufuk denizi kıyının ALTINDA, palmiye/şemsiye kıyının önünde
    const scenes = s.filter((p) => p.kind === KIND.overlay).map((p) => p.part);
    expect(scenes).toEqual([OVERLAY.summerSky, OVERLAY.summerBeach]);
    expect(OVERLAY_UNDER).toEqual([OVERLAY.summerSky, OVERLAY.opSky]);
    const shore = s.filter((p) => p.kind === KIND.tile);
    expect(shore.map((p) => p.part).sort()).toEqual([0, 1, 2, 3]); // 3 dalga katmanı + kum
    expect(shore.every(isVectorParticle)).toBe(true);
    expect(s.some((p) => p.sprite === SPRITE.gullOpen && p.flapFreq > 0)).toBe(true);
    expect(s.some((p) => p.sprite === SPRITE.star)).toBe(true);
  });

  it("aurora: vektör perde sahnesi (ÖNDE) + sönük yıldızlar", () => {
    const a = buildParticles("aurora", { count: 36, seed: 2 });
    expect(a.filter((p) => p.kind === KIND.band)).toHaveLength(0);
    expect(a.filter((p) => p.kind === KIND.overlay).map((p) => p.part)).toEqual([OVERLAY.aurora]);
    expect(a.filter((p) => p.kind === KIND.float).length).toBe(35);
    expect(OVERLAY_FRONT).toEqual(expect.arrayContaining([OVERLAY.aurora, OVERLAY.stars]));
  });

  it("mevsim / gökyüzü sahneleri: seçilen temel efekt kendi sahnesiyle, olay saati restU", () => {
    expect(EFFECT_SCENE).toEqual({
      snow: "winterScene", leaves: "autumnScene", rain: "rainScene", stardust: "starScene", embers: "campfireScene",
      fireworks: "fireworksScene",
    });
    const parts = {
      winterScene: OVERLAY.winter, autumnScene: OVERLAY.autumn, rainScene: OVERLAY.rain, starScene: OVERLAY.stars,
      campfireScene: OVERLAY.campfire, fireworksScene: OVERLAY.fwCity,
    };
    for (const [effect, scene] of Object.entries(EFFECT_SCENE)) {
      const plan = resolvePlan([effect], "medium", "full");
      expect(plan[0]).toEqual([scene, 1]);
      // havai fişek tek başına yalnız sahne (vektör fişekler); diğerleri sahne + parçacık
      expect(plan).toHaveLength(effect === "fireworks" ? 1 : 2);
      const list = buildPlanParticles(plan, { seed: 4 });
      const overlays = list.filter((p) => p.kind === KIND.overlay);
      expect(overlays.map((p) => p.part)).toEqual([parts[scene]]);
      const p = overlays[0];
      expect(p.y0).toBe(0);
      expect(p.period).toBeGreaterThanOrEqual(50);
      expect(p.rest).toBeGreaterThan(2);
      // olay süresi 20–30 sn
      expect(p.period / p.rest).toBeGreaterThan(20);
      expect(p.period / p.rest).toBeLessThan(30);
      // tür karışımında / bileşik içinde sahne yok
      expect(buildParticles(effect, { count: 20 }).some((q) => q.kind === KIND.overlay)).toBe(false);
    }
  });

  it("statik tampon bayrakları: kar şekil/opaklık sabit, kelebek ve ateş böceği değil", () => {
    const snow = buildParticles("snow", { count: 30 });
    expect(needsAnimatedSprites(snow)).toBe(false);
    expect(needsAnimatedAlpha(snow)).toBe(false);
    expect(needsAnimatedSprites(buildParticles("butterflies", { count: 5 }))).toBe(true);
    expect(needsAnimatedAlpha(buildParticles("fireflies", { count: 5 }))).toBe(true);
    expect(needsAnimatedAlpha(buildParticles("storm", { count: 20 }))).toBe(true);
    expect(needsAnimatedAlpha(buildParticles("rain", { count: 20 }))).toBe(false);
  });
});

describe("weatherParticles — kare hesabı", () => {
  it("her efekt her anda sonlu duruş ve 0–1 opaklık üretir", () => {
    for (const e of ALL) {
      for (const p of buildParticles(e, { count: 32, seed: 3 })) {
        for (const t of TIMES) {
          const pose = particlePose(p, t, W, H);
          for (const v of [pose.scos, pose.ssin, pose.tx, pose.ty]) expect(Number.isFinite(v)).toBe(true);
          const a = particleAlpha(p, t, H);
          expect(a).toBeGreaterThanOrEqual(0);
          expect(a).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("düşen ve yükselen parçacıklar ekranın (taşma payıyla) içinde kalır", () => {
    for (const e of ["snow", "leaves", "rain", "sakura", "popcorn", "embers", "hearts", "balloons", "notes", "ash"]) {
      for (const p of buildParticles(e, { count: 40, seed: 3 })) {
        if (p.kind !== KIND.fall) continue;
        for (const t of TIMES) {
          const { x, y } = particlePose(p, t, W, H);
          expect(y).toBeGreaterThanOrEqual(-p.size * 1.5 - 1e-6);
          expect(y).toBeLessThanOrEqual(H + p.size * 1.5 + 1e-6);
          const m = p.size + p.swayAmp * 2;
          expect(x).toBeGreaterThanOrEqual(-m - 1e-6);
          expect(x).toBeLessThanOrEqual(W + m + 1e-6);
        }
      }
    }
  });

  it("kar aşağı iner, kıvılcım ve balon yukarı çıkar", () => {
    const step = (p) => {
      const a = particlePose(p, 10, W, H).y;
      const b = particlePose(p, 10.2, W, H).y;
      const travel = H + p.size * 3;
      return (b - a + travel * 1.5) % travel - travel / 2;
    };
    const [flake] = buildParticles("snow", { count: 1, seed: 11 });
    expect(step(flake)).toBeCloseTo(flake.speed * 0.2, 4);
    const [ember] = buildParticles("embers", { count: 1, seed: 11 });
    expect(step(ember)).toBeCloseTo(-ember.speed * 0.2, 4);
    const [balloon] = buildParticles("balloons", { count: 1, seed: 11 });
    expect(step(balloon)).toBeLessThan(0);
  });

  it("RSXform şekil dikdörtgeninin merkezini parçacık konumuna oturtur; uzun kenar = boyut", () => {
    for (const e of ["leaves", "rain", "balloons"]) {
      for (const p of buildParticles(e, { count: 10, seed: 5 })) {
        const pose = particlePose(p, 12.3, W, H);
        const c = local(pose, p.cw / 2, p.ch / 2);
        expect(c.x).toBeCloseTo(pose.x, 6);
        expect(c.y).toBeCloseTo(pose.y, 6);
        expect(Math.hypot(pose.scos, pose.ssin) * Math.max(p.cw, p.ch)).toBeCloseTo(p.size, 6);
      }
    }
  });

  it("yağmur damlası dar şeritten çizilir (kare hücrenin %16'sı)", () => {
    const [drop] = buildParticles("rain", { count: 1 });
    expect(drop.cw / drop.ch).toBeCloseTo(0.16, 6);
  });

  it("çim tabanı ekranın alt kenarında sabit, ucu sallanır", () => {
    for (const p of buildParticles("grass", { count: 12, seed: 4 })) {
      const tips = [];
      for (const t of [0, 0.7, 1.9, 4.2]) {
        const pose = particlePose(p, t, W, H);
        const base = local(pose, p.cw / 2, p.ch);
        expect(base.x).toBeCloseTo(p.x0 * W, 4);
        expect(base.y).toBeCloseTo(H + 2, 4);
        tips.push(local(pose, p.cw / 2, 0).x);
      }
      expect(Math.max(...tips) - Math.min(...tips)).toBeGreaterThan(0.1);
    }
  });

  it("çiçek büyür, açar ve solar; baş sapın ucunda, solunca gizli", () => {
    expect(growthAt(0)).toBe(0);
    expect(growthAt(0.5)).toBe(1);
    expect(growthAt(1)).toBe(0);
    const [stem, head] = buildParticles("flowers", { count: 2, seed: 8 });
    const tBloom = (0.5 - stem.y0 + 3) * stem.period; // döngünün ortası
    const sp = particlePose(stem, tBloom, W, H);
    const hp = particlePose(head, tBloom, W, H);
    const tip = local(sp, stem.cw / 2, 0);
    expect(hp.x).toBeCloseTo(tip.x, 3);
    expect(hp.y).toBeCloseTo(tip.y, 3);
    const tGone = (1 - 1e-6 - stem.y0 + 3) * stem.period; // döngü sonu: g → 0
    expect(particleAlpha(head, tGone, H)).toBeLessThan(0.01);
  });

  it("kıyı: dalga yolu dikişsiz (W'de tekrar eder), kayınca ekranı hep örter", () => {
    const g = shoreGeometry(W, H, 3);
    const m = g.metrics;
    expect(m.seaTop).toBeLessThan(m.sandTop);
    expect(m.bases[0]).toBeLessThan(m.bases[1]);
    expect(m.bases[1]).toBeLessThan(m.bases[2]);
    expect(m.bases[2]).toBeLessThan(m.sandTop);
    for (const layer of g.layers) {
      const xs = layer.crest.map(([x]) => x);
      expect(xs[0]).toBeCloseTo(0, 6);
      expect(xs[xs.length - 1]).toBeCloseTo(2 * W, 6);
      // x hep artar (trokoid kendini kesmez)
      for (let i = 1; i < xs.length; i += 1) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
      // dikişsiz: ilk ve son nokta aynı yükseklikte
      const ys = layer.crest.map(([, y]) => y);
      expect(ys[ys.length - 1]).toBeCloseTo(ys[0], 6);
      // tepe çizgisi ekranda, kumun üstünde
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(layer.top - 1e-6);
      expect(Math.max(...ys)).toBeLessThan(m.sandTop);
    }
    // kum taneleri kumun içinde
    for (const [x, y, r] of g.grains) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(W);
      expect(y).toBeGreaterThan(m.sandTop - 8 * m.k);
      expect(y).toBeLessThanOrEqual(H);
      expect(r).toBeGreaterThan(0);
    }
    const waves = buildParticles("waves", { count: 3, seed: 6 });
    expect(waves.map((p) => p.part)).toEqual([0, 1, 2]);
    for (const p of waves) {
      for (const t of TIMES) {
        const o = shoreLayerOffset(p, t, W, m.k);
        expect(o.dx).toBeGreaterThan(-W - 1e-6); // yol [dx, dx + 2W] ⊇ [0, W]
        expect(o.dx).toBeLessThanOrEqual(0);
        expect(Math.abs(o.dy)).toBeLessThanOrEqual(p.swayAmp * m.k + 1e-9);
      }
    }
    const [sand] = buildParticles("sand", { count: 1, seed: 6 });
    for (const t of TIMES) {
      const s = swashAt(sand, t, m.k);
      expect(s.dy).toBeGreaterThanOrEqual(0);
      expect(s.dy).toBeLessThanOrEqual(7 * m.k + 1e-9);
      expect(s.opacity).toBeGreaterThan(0.2);
      expect(s.opacity).toBeLessThanOrEqual(0.85);
    }
    // küçük önizlemede de sığar
    const small = shoreMetrics(160, 120);
    expect(small.seaTop).toBeGreaterThan(0);
    expect(shoreStyle(true).sea).toHaveLength(3);
    expect(shoreStyle(false).sea[0].crest).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("ışıltılar deniz bandında, vektör parçacık Atlas'ta görünmez", () => {
    const shore = buildParticles("summerShore", { count: 44, seed: 6 });
    const m = shoreMetrics(W, H);
    const glints = shore.filter((p) => p.seaBand);
    expect(glints.length).toBeGreaterThan(5);
    // kıyı sekme çubuğunun üstüne kalkık: ışıltılar da aynı payla yukarıda
    const kalk = (p) => p.lift * m.k;
    for (const p of glints) {
      expect(p.lift).toBeGreaterThan(0);
      for (const t of TIMES) {
        const { y } = particlePose(p, t, W, H);
        expect(y).toBeGreaterThan(m.seaTop - kalk(p) - 3);
        expect(y).toBeLessThan(m.sandTop - kalk(p) + 3);
      }
    }
    // dalga + kum döşemeleri de kalkık (ParticleField altını kumla doldurur)
    expect(shore.filter((p) => p.kind === KIND.tile).every((p) => p.lift > 0)).toBe(true);
    for (const p of shore.filter(isVectorParticle)) expect(particlePose(p, 1, W, H).x).toBeLessThan(-1000);
  });

  it("şimşek biçimi: tepeden iner, incelen çekirdek, 2–4 dal, aynı tohum aynı biçim", () => {
    const L = 420;
    const a = buildBoltShape(5, L, 1);
    expect(buildBoltShape(5, L, 1)).toEqual(a);
    expect(buildBoltShape(6, L, 1)).not.toEqual(a);
    const [trunk, ...rest] = a;
    expect(trunk.main).toBe(true);
    expect(trunk.spine[0]).toEqual([0, 0]);
    expect(trunk.spine[trunk.spine.length - 1][1]).toBeCloseTo(L, 6);
    expect(trunk.spine.length).toBe(65); // 6 seviye orta nokta kaydırma
    const mainBranches = rest.filter((p) => p.spine.length === 17);
    expect(mainBranches.length).toBeGreaterThanOrEqual(2);
    expect(mainBranches.length).toBeLessThanOrEqual(4);
    for (const piece of a) {
      expect(piece.outline).toHaveLength(piece.spine.length * 2);
      expect(piece.w0).toBeGreaterThan(piece.w1); // uca doğru incelir
      expect(piece.w0).toBeLessThanOrEqual(2.3);
      for (const [x, y] of piece.spine) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(Math.abs(x)).toBeLessThan(L * 0.8);
        expect(y).toBeGreaterThan(-L * 0.3);
        expect(y).toBeLessThan(L * 1.4);
      }
    }
    // çakma: biçim aralıkta, opaklık atlas formülüyle aynı
    const [, bolt] = buildParticles("lightning", { count: 2, seed: 1 });
    for (let i = 0; i < 400; i += 1) {
      const t = i * 0.37;
      const s = boltStrike(bolt, t, W);
      expect(s.variant).toBeGreaterThanOrEqual(0);
      expect(s.variant).toBeLessThan(BOLT_VARIANTS);
      expect([1, -1]).toContain(s.flip);
      expect(s.x).toBeGreaterThanOrEqual(0.15 * W);
      expect(s.x).toBeLessThanOrEqual(0.85 * W);
      expect(s.alpha).toBe(particleAlpha(bolt, t, H));
    }
  });

  it("şimşek: çoğu zaman gizli, en fazla 2 çakma/döngü, aydınlık ≤ %20 ve ekranı örter", () => {
    const [flash, bolt] = buildParticles("lightning", { count: 2, seed: 1 });
    const dt = 0.005;
    const n = Math.ceil(flash.period / dt);
    const alphas = Array.from({ length: n }, (_, i) => particleAlpha(flash, i * dt, H));
    const visible = alphas.filter((a) => a > 0).length / n;
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThan(0.1);
    expect(Math.max(...alphas)).toBeLessThanOrEqual(0.2 + 1e-9);
    // ışığa duyarlılık: bir döngüde tepe sayısı ≤ 2 (sn'de 3 çakma sınırının altında)
    let peaks = 0;
    for (let i = 1; i < n - 1; i += 1) {
      if (alphas[i] > 0.02 && alphas[i] >= alphas[i - 1] && alphas[i] > alphas[i + 1]) peaks += 1;
    }
    expect(peaks).toBeLessThanOrEqual(2);
    expect(flash.period).toBeGreaterThanOrEqual(7);
    // görünürken tam ekranı örter
    const iVis = alphas.findIndex((a) => a > 0);
    const pose = particlePose(flash, iVis * dt, W, H);
    const side = Math.hypot(pose.scos, pose.ssin) * flash.cw;
    expect(pose.x - side / 2).toBeLessThanOrEqual(0);
    expect(pose.x + side / 2).toBeGreaterThanOrEqual(W);
    expect(pose.y - side / 2).toBeLessThanOrEqual(0);
    expect(pose.y + side / 2).toBeGreaterThanOrEqual(H);
    // çizgi yalnız aydınlık penceresinde görünür
    const boltVis = Array.from({ length: n }, (_, i) => particleAlpha(bolt, i * dt, H) > 0);
    boltVis.forEach((v, i) => {
      if (v) expect(alphas[i]).toBeGreaterThan(0);
    });
    expect(boltVis.some(Boolean)).toBe(true);
  });

  it("ışık katmanları: her tür her anda sonlu, 0–1; vektör çizilir, Atlas'ta görünmez", () => {
    const W = 390;
    const H = 760;
    const types = new Set();
    const seasonScenes = ["storm", "springGarden", "summerShore", "aurora", "halloween", "christmas", ...Object.values(EFFECT_SCENE)];
    for (const effect of [...GENRE_FAMILIES.map((f) => f.effect), "solarSystem", ...seasonScenes, ...UNIVERSE_IDS]) {
      for (const lightSurface of [false, true]) {
        const list = buildParticles(effect, { count: 40, seed: 9, lightSurface }).filter((p) => p.kind === KIND.overlay);
        for (const p of list) {
          types.add(p.part);
          expect(isVectorParticle(p)).toBe(true);
          expect(particlePose(p, 3, W, H).x).toBeLessThan(-1000);
          const tone = overlayStyle(p.part, lightSurface);
          expect(tone.colors.length).toBeGreaterThan(0);
          expect(tone.alpha).toBeGreaterThan(0);
          // ışık katmanları sönük; evren silüetleri koyu tonda (titan duvarı onu örtecek kadar dolu)
          expect(tone.alpha).toBeLessThanOrEqual(p.part < OVERLAY.iceWall && p.part !== OVERLAY.orbits ? 0.7 : 0.95);
          for (let t = 0; t < 40; t += 0.37) {
            const fr = overlayFrame(p, t, W, H);
            for (const v of [fr.a, fr.x, fr.y, fr.r]) expect(Number.isFinite(v)).toBe(true);
            expect(fr.a).toBeGreaterThanOrEqual(0);
            expect(fr.a).toBeLessThanOrEqual(1);
          }
        }
      }
    }
    expect([...types].sort((a, b) => a - b)).toEqual(Object.values(OVERLAY).sort((a, b) => a - b));
    for (const front of OVERLAY_FRONT) expect(Object.values(OVERLAY)).toContain(front);
  });

  it("ışığa duyarlılık: flaş katmanları saniyede en çok 3 çakma, çoğu zaman sönük", () => {
    const W = 390;
    const H = 760;
    for (const [effect, part] of [["genreAction", OVERLAY.flare], ["genreWar", OVERLAY.farFlashes], ["genreReality", OVERLAY.paparazzi]]) {
      const p = buildParticles(effect, { count: 40, seed: 2 }).find((q) => q.part === part && q.kind === KIND.overlay);
      expect(p).toBeTruthy();
      const slots = part === OVERLAY.flare ? 1 : p.slots;
      const dt = 1 / 60;
      const onsets = [];
      let lit = 0;
      let frames = 0;
      const prev = new Array(slots).fill(0);
      for (let t = 0; t < 120; t += dt) {
        frames += 1;
        let any = false;
        for (let i = 0; i < slots; i += 1) {
          const a = overlaySlot(p, t, i, W, H).a;
          if (a > 0.05 && prev[i] <= 0.05) onsets.push(t);
          if (a > 0.05) any = true;
          prev[i] = a;
        }
        if (any) lit += 1;
      }
      expect(onsets.length).toBeGreaterThan(0);
      for (let k = 3; k < onsets.length; k += 1) expect(onsets[k] - onsets[k - 3]).toBeGreaterThanOrEqual(1);
      expect(lit / frames).toBeLessThan(0.5);
    }
    // kalp atışı vinyeti tam ekran: yavaş nabız, sönmez (0,3–1), ~1,5 sn
    const hb = buildParticles("genreThriller", { count: 60, seed: 2 }).find((q) => q.part === OVERLAY.heartbeat && q.kind === KIND.overlay);
    expect(hb.period).toBeGreaterThanOrEqual(1.4);
    for (let t = 0; t < 10; t += 0.05) {
      const a = overlayFrame(hb, t, W, H).a;
      expect(a).toBeGreaterThanOrEqual(0.3 - 1e-9);
      expect(a).toBeLessThanOrEqual(1);
    }
  });

  it("ekolayzer ve sıcak hava çizgileri 0–1 aralığında oynar", () => {
    const eq = buildParticles("genreMusic", { count: 20, seed: 1 }).find((q) => q.part === OVERLAY.equalizer);
    const haze = buildParticles("genreWestern", { count: 40, seed: 1 }).find((q) => q.part === OVERLAY.heatHaze);
    let lo = 1;
    let hi = 0;
    for (let t = 0; t < 8; t += 0.05) {
      for (let i = 0; i < 18; i += 1) {
        const v = equalizerLevel(eq, t, i);
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      for (let i = 0; i < 4; i += 1) {
        const h = hazeLine(haze, t, i);
        expect(h.a).toBeGreaterThanOrEqual(0);
        expect(h.a).toBeLessThanOrEqual(1);
        expect(h.dy).toBeLessThanOrEqual(0);
      }
    }
    expect(lo).toBeGreaterThanOrEqual(0.1);
    expect(hi).toBeLessThanOrEqual(1);
    expect(hi - lo).toBeGreaterThan(0.4); // gerçekten atıyor
  });

  it("yeni şekiller: çalı yuvarlanır (sağa giderken döner), uçak ve bulut yatay akar", () => {
    const tw = buildParticles("tumbleweed", { count: 3, seed: 1 });
    expect(tw.every((p) => p.sprite === SPRITE.tumbleweed && p.kind === KIND.drift && p.rotSpeed > 0)).toBe(true);
    expect(buildParticles("planes", { count: 3, seed: 1 }).every((p) => p.sprite === SPRITE.plane && p.windX > 0)).toBe(true);
    expect(buildParticles("clouds", { count: 4, seed: 1 }).every((p) => p.sprite === SPRITE.cloud && p.y0 <= 0.32)).toBe(true);
    expect(SPRITE_COUNT).toBe(128);
    expect(SPRITE_ROWS).toBe(16);
  });

  it("ateş böceği yanıp söner, kar sabit opaklıktadır", () => {
    const [fly] = buildParticles("fireflies", { count: 1, seed: 2 });
    const samples = Array.from({ length: 40 }, (_, i) => particleAlpha(fly, i * 0.25, H));
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.3);
    const [flake] = buildParticles("snow", { count: 1, seed: 2 });
    expect(particleAlpha(flake, 0, H)).toBe(particleAlpha(flake, 99, H));
  });

  it("kayan yıldız çoğu zaman gizli, ara sıra görünür; gizliyken ekran dışında", () => {
    const [meteor] = buildParticles("stardust", { count: 10, seed: 4 });
    const vis = Array.from({ length: 2000 }, (_, i) => particleAlpha(meteor, i * 0.01, H) > 0);
    const share = vis.filter(Boolean).length / vis.length;
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(0.5);
    const hiddenAt = vis.findIndex((v) => !v);
    expect(particlePose(meteor, hiddenAt * 0.01, W, H).x).toBeLessThan(-1000);
  });

  it("kelebek, yarasa ve martı iki kare arasında kanat çırpar, diğerleri sabit kare", () => {
    const [bf] = buildParticles("butterflies", { count: 1, seed: 9 });
    const frames = new Set(Array.from({ length: 60 }, (_, i) => particleSprite(bf, i * 0.02)));
    expect([...frames].sort()).toEqual([SPRITE.butterflyOpen, SPRITE.butterflyClosed].sort());
    const [bat] = buildParticles("bats", { count: 1, seed: 9 });
    expect(new Set(Array.from({ length: 60 }, (_, i) => particleSprite(bat, i * 0.02))).size).toBe(2);
    const [gull] = buildParticles("seagulls", { count: 1, seed: 9 });
    expect(new Set(Array.from({ length: 120 }, (_, i) => particleSprite(gull, i * 0.02))).size).toBe(2);
    const [leaf] = buildParticles("leaves", { count: 1, seed: 9 });
    expect(particleSprite(leaf, 0)).toBe(particleSprite(leaf, 5.5));
  });

  it("kıvılcım yükseldikçe söner", () => {
    const [ember] = buildParticles("embers", { count: 1, seed: 1 });
    const noPulse = { ...ember, pulseFreq: 0 };
    const alphas = Array.from({ length: 800 }, (_, i) => particleAlpha(noPulse, i * 0.05, H));
    expect(Math.min(...alphas)).toBeLessThan(noPulse.a * 0.3);
    expect(Math.max(...alphas)).toBeGreaterThan(noPulse.a * 0.8);
  });
});
