// Turnuva geri sayim hucre olculeri (components/tournament/countdownLayout.js).
const {
  countdownDims, sepWidth, unitBoxWidth, DIGIT_RATIO, LINE_RATIO,
} = require("../components/tournament/countdownLayout");

describe("countdownDims", () => {
  test("rakam kutusu yazi boyutundan turer (genis yazi tipine pay)", () => {
    for (const d of [countdownDims("lg", 390), countdownDims("lg", 340), countdownDims("sm", 390)]) {
      expect(d.w).toBeGreaterThanOrEqual(d.font * DIGIT_RATIO);
      expect(d.h).toBeGreaterThanOrEqual(d.font * LINE_RATIO);
    }
  });

  test("dar ekranda lg bir kademe kucuk", () => {
    expect(countdownDims("lg", 340).font).toBeLessThan(countdownDims("lg", 390).font);
  });

  test("satir genisligi verilirse 4 kutu + 3 ayrac satira sigar", () => {
    for (const rowW of [220, 260, 290, 320, 400]) {
      const d = countdownDims("lg", 390, rowW);
      const total = 4 * unitBoxWidth(d) + 3 * sepWidth(d.font);
      // MIN_FONT tabanina dayanmadikca sigar
      if (d.font > 13) expect(total).toBeLessThanOrEqual(rowW + 1);
    }
  });

  test("genis satirda yazi buyutulmez", () => {
    expect(countdownDims("lg", 390, 2000).font).toBe(countdownDims("lg", 390).font);
  });
});
