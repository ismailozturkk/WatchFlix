// __tests__/ambientBackground.test.js
//
// Ambiyans arka planının saf mantığı: leke paleti, hareket yolu, hız, degrade.
// Çizim (SVG + Animated) jest'te çalışmaz; burada korunan şey GÖRÜNÜMÜN
// kurallarıdır: renkler gerçekten ayrışık mı, döngü atlıyor mu, leke ekrandan
// kaçıyor mu.

const {
  AMBIENT_LOOP_MS,
  AMBIENT_MAX_BLOBS,
  AMBIENT_PATH_STEPS,
  ambientLoopMs,
  ambientStops,
  buildAmbientBlobs,
  sampleAmbientPath,
} = require("../utils/ambientBackground");
const { EFFECT_MODE_PRESETS } = require("../utils/deviceTier");
const { hexToHsl } = require("../utils/colorUtils");

// Tohumlu üreteç (mulberry32): rastgele mantığı tekrarlanabilir sınar.
const seeded = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 13);

// Dairesel ton farkı (0..180).
const hueGap = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

describe("buildAmbientBlobs", () => {
  test("istenen sayıda leke üretir, sınırlar dışına taşmaz", () => {
    expect(buildAmbientBlobs(seeded(1), 3)).toHaveLength(3);
    expect(buildAmbientBlobs(seeded(1))).toHaveLength(AMBIENT_MAX_BLOBS);
    expect(buildAmbientBlobs(seeded(1), 99)).toHaveLength(AMBIENT_MAX_BLOBS);
    expect(buildAmbientBlobs(seeded(1), 0)).toEqual([]);
    expect(buildAmbientBlobs(seeded(1), -4)).toEqual([]);
    expect(buildAmbientBlobs(seeded(1), "abc")).toEqual([]);
  });

  test("aynı tohum aynı seti verir; farklı tohum farklı renk verir", () => {
    expect(buildAmbientBlobs(seeded(5))).toEqual(buildAmbientBlobs(seeded(5)));
    const renkler = new Set(SEEDS.map((s) => buildAmbientBlobs(seeded(s))[0].color));
    expect(renkler.size).toBeGreaterThan(30);
  });

  test("renkler geçerli hex ve her zaman birbirinden AYRIŞIK (rengârenk)", () => {
    for (const seed of SEEDS) {
      const blobs = buildAmbientBlobs(seeded(seed));
      for (const b of blobs) expect(b.color).toMatch(/^#[0-9a-f]{6}$/i);
      for (let i = 0; i < blobs.length; i++) {
        for (let j = i + 1; j < blobs.length; j++) {
          // Altın açıda en yakın çift ~52° ayrık; ±12° sapmayla bile hiçbir
          // çift 25°'den yakın olamaz.
          expect(hueGap(blobs[i].hue, blobs[j].hue)).toBeGreaterThan(25);
        }
      }
    }
  });

  test("Kapalı modunun 3 lekesi bile üç ayrı bölgeye dağılır", () => {
    for (const seed of SEEDS) {
      const ilkUc = buildAmbientBlobs(seeded(seed)).slice(0, 3);
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          // Altın açıda ilk üçün en yakın çifti ~85° ayrık (−24° sapma payı).
          expect(hueGap(ilkUc[i].hue, ilkUc[j].hue)).toBeGreaterThan(55);
          const dx = ilkUc[i].cx - ilkUc[j].cx;
          const dy = ilkUc[i].cy - ilkUc[j].cy;
          expect(Math.hypot(dx, dy)).toBeGreaterThan(0.3);
        }
      }
    }
  });

  test("çapalar ekran içinde, salınım frekansları TAM SAYI", () => {
    for (const seed of SEEDS) {
      for (const b of buildAmbientBlobs(seeded(seed))) {
        expect(b.cx).toBeGreaterThanOrEqual(0);
        expect(b.cx).toBeLessThanOrEqual(1);
        expect(b.cy).toBeGreaterThanOrEqual(0);
        expect(b.cy).toBeLessThanOrEqual(1);
        for (const f of [b.cyclesX, b.cyclesY, b.scaleCycles]) {
          expect(Number.isInteger(f)).toBe(true);
          expect(f).toBeGreaterThanOrEqual(1);
        }
        // Loş görünüm: merkez opaklığı üst sınırı sabit (yeniden parlatma testte patlasın).
        expect(b.alpha).toBeGreaterThan(0.25);
        expect(b.alpha).toBeLessThanOrEqual(0.45);
        // Renk de loş: doygunluk/açıklık canlı palete geri kaçmasın.
        const { s, l } = hexToHsl(b.color);
        expect(s).toBeLessThanOrEqual(82);
        expect(l).toBeLessThanOrEqual(58);
      }
    }
  });

  test("ön dilim kararlı: sayı değişince renkler yer değiştirmez", () => {
    const hepsi = buildAmbientBlobs(seeded(77), 5);
    const uc = buildAmbientBlobs(seeded(77), 3);
    // Aynı tohumla ilk üç leke aynı rengi alır. (Çizen taraf zaten tek set
    // üretip dilimliyor; bu, üreticinin sayıya bağımlı olmadığını sabitler.)
    expect(uc.map((b) => b.hue)).toEqual(hepsi.slice(0, 3).map((b) => b.hue));
  });
});

describe("sampleAmbientPath", () => {
  test("döngü atlamasız: tur sonu başlangıçla BİREBİR aynı", () => {
    for (const seed of SEEDS) {
      for (const b of buildAmbientBlobs(seeded(seed))) {
        const p = sampleAmbientPath(b);
        expect(p.x[AMBIENT_PATH_STEPS]).toBe(p.x[0]);
        expect(p.y[AMBIENT_PATH_STEPS]).toBe(p.y[0]);
        expect(p.scale[AMBIENT_PATH_STEPS]).toBe(p.scale[0]);
      }
    }
  });

  test("girdi aralığı 0..1 ve artan (native interpolasyon şartı)", () => {
    const p = sampleAmbientPath(buildAmbientBlobs(seeded(3))[0]);
    expect(p.input).toHaveLength(AMBIENT_PATH_STEPS + 1);
    expect(p.input[0]).toBe(0);
    expect(p.input[AMBIENT_PATH_STEPS]).toBe(1);
    for (let k = 1; k < p.input.length; k++) {
      expect(p.input[k]).toBeGreaterThan(p.input[k - 1]);
    }
    expect(p.x).toHaveLength(p.input.length);
    expect(p.y).toHaveLength(p.input.length);
    expect(p.scale).toHaveLength(p.input.length);
  });

  test("sapma genlikle sınırlı, ölçek 1 çevresinde ve hiç sıfıra inmez", () => {
    for (const seed of SEEDS) {
      for (const b of buildAmbientBlobs(seeded(seed))) {
        const p = sampleAmbientPath(b);
        for (const v of p.x) expect(Math.abs(v)).toBeLessThanOrEqual(b.ampX + 1e-9);
        for (const v of p.y) expect(Math.abs(v)).toBeLessThanOrEqual(b.ampY + 1e-9);
        for (const v of p.scale) {
          expect(v).toBeGreaterThan(0.75);
          expect(v).toBeLessThan(1.25);
        }
      }
    }
  });

  test("leke gerçekten HAREKET ediyor (donuk yol değil)", () => {
    for (const seed of SEEDS) {
      for (const b of buildAmbientBlobs(seeded(seed))) {
        const p = sampleAmbientPath(b);
        const yayilim = Math.max(...p.x) - Math.min(...p.x);
        expect(yayilim).toBeGreaterThan(b.ampX); // en az yarım genlik tarar
      }
    }
  });
});

describe("hız ve degrade", () => {
  test("tur süresi hızla ters orantılı ve sınırlı", () => {
    expect(ambientLoopMs(1)).toBe(AMBIENT_LOOP_MS);
    expect(ambientLoopMs(0.5)).toBe(AMBIENT_LOOP_MS * 2);
    expect(ambientLoopMs(2)).toBe(AMBIENT_LOOP_MS / 2);
    // Aşırı değerler sıkıştırılır: 0/NaN sonsuz tur, çok büyük değer 0 ms'lik
    // döngü (kilitlenme) üretmesin.
    expect(ambientLoopMs(0.001)).toBe(AMBIENT_LOOP_MS * 4);
    expect(ambientLoopMs(1000)).toBe(AMBIENT_LOOP_MS / 2);
    expect(ambientLoopMs(NaN)).toBe(AMBIENT_LOOP_MS);
    expect(ambientLoopMs(undefined)).toBe(AMBIENT_LOOP_MS);
  });

  test("her efekt modunda tur kesin uzar: Tam < Orta < Kapalı", () => {
    const sureler = ["full", "balanced", "off"].map((m) =>
      ambientLoopMs(EFFECT_MODE_PRESETS[m].spriteFpsScale),
    );
    expect(sureler[0]).toBeLessThan(sureler[1]);
    expect(sureler[1]).toBeLessThan(sureler[2]);
  });

  test("efekt modlarının leke sayısı üretilebilecek en fazlayı aşmaz", () => {
    for (const mod of Object.values(EFFECT_MODE_PRESETS)) {
      expect(mod.ambientBlobCount).toBeGreaterThanOrEqual(1);
      expect(mod.ambientBlobCount).toBeLessThanOrEqual(AMBIENT_MAX_BLOBS);
    }
  });

  test("degrade kenarı SIFIRA iner (sert kenar = bulanık görünmez) ve tek yönlü söner", () => {
    const stops = ambientStops(0.5);
    expect(stops[0]).toEqual({ offset: 0, opacity: 0.5 });
    expect(stops[stops.length - 1]).toEqual({ offset: 1, opacity: 0 });
    for (let k = 1; k < stops.length; k++) {
      expect(stops[k].offset).toBeGreaterThan(stops[k - 1].offset);
      expect(stops[k].opacity).toBeLessThanOrEqual(stops[k - 1].opacity);
    }
  });

  test("degrade opaklığı [0,1] aralığında kalır", () => {
    expect(ambientStops(5)[0].opacity).toBe(1);
    expect(ambientStops(-1)[0].opacity).toBe(0);
    expect(ambientStops(NaN).every((s) => Number.isFinite(s.opacity))).toBe(true);
  });
});
