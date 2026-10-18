// __tests__/discoverHeaderLayout.test.js
//
// Film/Dizi ana ekranının üst satırı [keşfet] [Film/Dizi anahtarı] [arama] için yerleşim hesabı
// (utils/discoverHeaderLayout.js): 344 pt tutan satır 320–367 pt'lik ekranlara sığsın diye anahtarın bölmeleri
// daralır, çok daralırsa kompakt (simgesiz) olur.
const {
  COMPACT_BELOW,
  ROW_GAP,
  ROW_MIN_GUTTER,
  SEGMENT_MAX,
  SEGMENT_MIN,
  SWITCH_PAD,
  discoverRowLayout,
} = require("../utils/discoverHeaderLayout");

const GLASS = { buttonSize: 46, switchHeight: 46 };
const FALLBACK = { buttonSize: 48, switchHeight: 46 };
const layout = (width, path = GLASS) => discoverRowLayout({ width, ...path });

describe("bölme genişliği", () => {
  test.each([
    [430, 112],
    [412, 112],
    [390, 112],
    [375, 112],
    [368, 112], // tam sınır: 12 + 344 + 12
    [367, 111],
    [360, 108],
    [344, 100],
    [320, 88],
    [300, 78],
  ])("cam yolu, ekran %s pt → bölme %s", (width, segment) => {
    expect(layout(width).segmentWidth).toBe(segment);
  });

  test("cam olmayan yolda (düğme 48, anahtar çerçevesi +2) aynı ekranda 3 pt daha dar", () => {
    expect(layout(360, FALLBACK).segmentWidth).toBe(105);
    expect(layout(320, FALLBACK).segmentWidth).toBe(85);
    expect(layout(390, FALLBACK).segmentWidth).toBe(112);
  });

  test("hiçbir ekranda üst sınırı aşmaz, alt sınırın altına inmez", () => {
    for (let width = 0; width <= 1200; width += 7) {
      const { segmentWidth } = layout(width);
      expect(segmentWidth).toBeGreaterThanOrEqual(SEGMENT_MIN);
      expect(segmentWidth).toBeLessThanOrEqual(SEGMENT_MAX);
    }
  });

  test("ekran genişledikçe bölme küçülmez (tekdüze)", () => {
    let previous = 0;
    for (let width = 200; width <= 600; width += 1) {
      const { segmentWidth } = layout(width);
      expect(segmentWidth).toBeGreaterThanOrEqual(previous);
      previous = segmentWidth;
    }
  });
});

describe("satırın ekrana sığması", () => {
  test("satır genişliği = iki düğme + iki boşluk + anahtar (iç boşluk + iki bölme [+ çerçeve])", () => {
    const { segmentWidth, rowWidth } = layout(390);
    expect(rowWidth).toBe(2 * 46 + 2 * ROW_GAP + 2 * SWITCH_PAD + 2 * segmentWidth);
    expect(layout(390, FALLBACK).rowWidth).toBe(2 * 48 + 2 * ROW_GAP + 2 * SWITCH_PAD + 2 + 2 * layout(390, FALLBACK).segmentWidth);
  });

  test.each([320, 330, 344, 360, 375, 390, 412, 430])(
    "ekran %s pt (iki çizim yolunda da): sığıyorsa satır kenar boşluklarını korur",
    (width) => {
      for (const path of [GLASS, FALLBACK]) {
        const result = layout(width, path);
        expect(result.fits).toBe(true);
        expect(result.rowWidth).toBeLessThanOrEqual(width - 2 * ROW_MIN_GUTTER + 1); // bölme tamsayıya yuvarlanır
      }
    },
  );

  test("çok dar ekranda (≈290 pt) en dar bölmeyle bile sığmaz: fits=false, bölme yine en dar hâl", () => {
    const result = layout(280);
    expect(result.fits).toBe(false);
    expect(result.segmentWidth).toBe(SEGMENT_MIN);
  });
});

describe("kompakt kip", () => {
  test("bölme eşiğin altındaysa kompakt (320–343 pt), eşikte ve üstünde değil", () => {
    expect(layout(320).compact).toBe(true);
    expect(layout(343).compact).toBe(true);
    expect(layout(344).segmentWidth).toBe(COMPACT_BELOW);
    expect(layout(344).compact).toBe(false);
    expect(layout(390).compact).toBe(false);
  });
});

describe("bozuk girdi", () => {
  test.each([undefined, null, NaN, -5, 0, "x"])("ekran genişliği %p fırlatmaz, en dar bölmeyi verir", (width) => {
    const result = layout(width);
    expect(result.segmentWidth).toBe(SEGMENT_MIN);
    expect(result.compact).toBe(true);
  });
});
