import { TASTE_HEAT_THRESHOLDS, tasteMatchHeat } from "../utils/tasteMatchVisuals";

describe("tasteMatchHeat", () => {
  test("60 / 70 / 80 / 90 eşiklerinde görsel yoğunluğu artırır", () => {
    expect(TASTE_HEAT_THRESHOLDS).toEqual([60, 70, 80, 90]);
    expect([59, 60, 70, 80, 90].map((score) => tasteMatchHeat(score).level)).toEqual([0, 1, 2, 3, 4]);
  });

  test("puanı güvenli aralığa sıkıştırır ve düşük puanda tema rengini korur", () => {
    expect(tasteMatchHeat(-20, "#123")).toMatchObject({ score: 0, level: 0, accent: "#123" });
    expect(tasteMatchHeat(140).score).toBe(100);
  });
});
