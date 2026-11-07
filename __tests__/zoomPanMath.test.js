// Tam ekran eleme agaci yakinlastirma/kaydirma hesabi (components/tournament/zoomPanMath.js).
const {
  fitScale, clampOffset, offsetBounds, clampScale, zoomAround,
} = require("../components/tournament/zoomPanMath");

const content = { w: 1000, h: 680 };
const view = { w: 760, h: 300 };

describe("fitScale", () => {
  test("agacin tamami sigar, buyutmez", () => {
    const s = fitScale(content, view);
    expect(content.w * s).toBeLessThanOrEqual(view.w + 1e-9);
    expect(content.h * s).toBeLessThanOrEqual(view.h + 1e-9);
    expect(fitScale({ w: 100, h: 100 }, view)).toBe(1);
  });

  test("olcu yoksa 1", () => {
    expect(fitScale({ w: 0, h: 0 }, view)).toBe(1);
  });
});

describe("clampOffset / offsetBounds", () => {
  test("kucuk icerik ortalanir", () => {
    expect(clampOffset(-500, 200, 760)).toBe(280);
    expect(offsetBounds(200, 760)).toEqual([280, 280]);
  });

  test("buyuk icerik kenar bosluk birakmaz", () => {
    expect(clampOffset(50, 1000, 760)).toBe(0);
    expect(clampOffset(-900, 1000, 760)).toBe(-240);
    expect(clampOffset(-100, 1000, 760)).toBe(-100);
    expect(offsetBounds(1000, 760)).toEqual([-240, 0]);
  });
});

describe("clampScale", () => {
  test("araliga kistirir", () => {
    expect(clampScale(0.1, 0.4, 2)).toBe(0.4);
    expect(clampScale(3, 0.4, 2)).toBe(2);
    expect(clampScale(1, 0.4, 2)).toBe(1);
  });
});

describe("zoomAround", () => {
  test("odak noktasinin altindaki tuval noktasi yerinde kalir", () => {
    const start = { s: 1, x: -100, y: -100 };
    const focal = { x: 300, y: 150 };
    const next = zoomAround(start, focal, focal, 1.5, content, view);
    const before = { x: (focal.x - start.x) / start.s, y: (focal.y - start.y) / start.s };
    const after = { x: (focal.x - next.x) / next.s, y: (focal.y - next.y) / next.s };
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  test("odak kayarsa icerik de kayar (iki parmakla surukleme)", () => {
    const start = { s: 1, x: -100, y: -100 };
    const next = zoomAround(start, { x: 300, y: 150 }, { x: 260, y: 130 }, 1, content, view);
    expect(next.x).toBe(-140);
    expect(next.y).toBe(-120);
  });

  test("sonuc her zaman sinir icinde", () => {
    const start = { s: 1, x: 0, y: 0 };
    const next = zoomAround(start, { x: 0, y: 0 }, { x: 700, y: 290 }, 1, content, view);
    expect(next.x).toBe(0);
    expect(next.y).toBe(0);
  });
});
