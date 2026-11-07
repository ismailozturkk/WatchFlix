// __tests__/galleryGeometry.test.js
//
// Galeri paylaşılan öğe geçişinin geometrisi (components/modals/gallery/galleryGeometry).
// Uçan kopya ile listedeki görsel AYNI hesabı kullanır; burada iniş noktasının,
// eşit ölçeğin ve köşe yarıçapı telafisinin doğru olduğu sınanır.

const {
  FLIGHT_COVER_AT,
  VIEW_RADIUS,
  centeredRect,
  flightOpacity,
  flightRadius,
  flightStart,
  heroViewSize,
  isFlightCovering,
} = require("../components/modals/gallery/galleryGeometry");

describe("heroViewSize", () => {
  test("afiş 2:3, arka plan 16:9 (detay yuvalarıyla aynı oran → eşit ölçek)", () => {
    const poster = heroViewSize(true, 390, 844);
    expect(poster).toEqual({ width: 300, height: 450 });
    const backdrop = heroViewSize(false, 390, 844);
    expect(backdrop.width).toBe(374);
    expect(backdrop.height / backdrop.width).toBeCloseTo(9 / 16);
  });

  test("dar ve kısa ekranlarda taşmaz, oranı korur", () => {
    const narrow = heroViewSize(false, 320, 640);
    expect(narrow.width).toBeLessThanOrEqual(320);
    const short = heroViewSize(true, 420, 600);
    expect(short.height).toBeLessThanOrEqual(600 * 0.62 + 0.001);
    expect(short.height / short.width).toBeCloseTo(1.5);
  });

  test("geçersiz ölçüde güvenli varsayılan", () => {
    const s = heroViewSize(true, NaN, 0);
    expect(s.width).toBeGreaterThan(0);
    expect(s.height).toBeGreaterThan(0);
  });
});

describe("flightStart", () => {
  const target = centeredRect({ width: 300, height: 450 }, 390, 844);

  test("hedef sayfanın tam ortasında", () => {
    expect(target).toEqual({ x: 45, y: 197, width: 300, height: 450 });
  });

  test("başlangıç transformu görünümü kaynağın tam üstüne oturtur", () => {
    const from = { x: 20, y: 300, width: 110, height: 165 };
    const start = flightStart(from, target);
    expect(start.scale).toBeCloseTo(110 / 300);
    // Merkez hizası: hedef merkezi + öteleme = kaynak merkezi.
    expect(target.x + target.width / 2 + start.dx).toBeCloseTo(from.x + from.width / 2);
    expect(target.y + target.height / 2 + start.dy).toBeCloseTo(from.y + from.height / 2);
    // Ölçeklenmiş boyut kaynağın boyutu.
    expect(target.width * start.scale).toBeCloseTo(from.width);
    expect(target.height * start.scale).toBeCloseTo(from.height);
  });

  test("kaynak ya da hedef yoksa null (düz solmaya düşülür)", () => {
    expect(flightStart(null, target)).toBeNull();
    expect(flightStart({ x: 0, y: 0, width: 0, height: 0 }, target)).toBeNull();
    expect(flightStart({ x: 0, y: 0, width: 10, height: 10 }, null)).toBeNull();
  });
});

describe("flightRadius", () => {
  const start = { scale: 0.4 };

  test("uçlarda görünen yarıçap kaynak ve hedefle birebir", () => {
    // progress 0: görünüm 0.4 ölçekte; görünen yarıçap = r * 0.4 = 14
    expect(flightRadius(0, start, 14, VIEW_RADIUS) * 0.4).toBeCloseTo(14);
    expect(flightRadius(1, start, 14, VIEW_RADIUS)).toBeCloseTo(VIEW_RADIUS);
  });

  test("yay taşmasında (progress > 1) sıfıra bölmez, sonlu kalır", () => {
    expect(Number.isFinite(flightRadius(1.08, start, 14, VIEW_RADIUS))).toBe(true);
    expect(Number.isFinite(flightRadius(-0.5, { scale: 0 }, 14, VIEW_RADIUS))).toBe(true);
  });
});

describe("yuva ile çapraz solma", () => {
  test("yuvada saydam, eşikte tam opak; kapanışta aynı eğri tersine", () => {
    expect(flightOpacity(0)).toBe(0);
    expect(flightOpacity(FLIGHT_COVER_AT / 2)).toBeCloseTo(0.5);
    expect(flightOpacity(FLIGHT_COVER_AT)).toBe(1);
    expect(flightOpacity(1)).toBe(1);
    // Yay aşımı / taşma kırpılır.
    expect(flightOpacity(1.08)).toBe(1);
    expect(flightOpacity(-0.02)).toBe(0);
  });

  test("yuva yalnız kopya TAM opakken gizlenir (boşluk karesi yok)", () => {
    expect(isFlightCovering(FLIGHT_COVER_AT - 0.001)).toBe(false);
    expect(isFlightCovering(FLIGHT_COVER_AT)).toBe(true);
    for (let p = 0; p <= 1.0001; p += 0.01) {
      if (isFlightCovering(p)) expect(flightOpacity(p)).toBe(1);
    }
  });
});
