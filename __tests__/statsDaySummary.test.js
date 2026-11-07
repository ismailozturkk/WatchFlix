// __tests__/statsDaySummary.test.js
//
// İstatistik ekranlarındaki "gün özeti" sayfasının (StatsDayModal) sayıları.

import { summarizeStatsDay } from "../utils/statsDaySummary";

const item = (mediaId, minutes, genres = [], extra = {}) => ({ mediaId, minutes, genres, ...extra });

describe("summarizeStatsDay", () => {
  it("toplam, adet, ortalama ve farklı başlık sayısı", () => {
    const summary = summarizeStatsDay([
      item(1, 45, ["Dram"]),
      item(1, 50, ["Dram"]),
      item(2, 25, ["Komedi"]),
    ]);
    expect(summary).toMatchObject({ count: 3, totalMinutes: 120, avgMinutes: 40, distinctTitles: 2 });
    expect(summary.longest.minutes).toBe(50);
  });

  it("süresiz öğe ortalamayı düşürmez ama adede girer", () => {
    const summary = summarizeStatsDay([item(1, 100), item(2, 0), item(3, undefined)]);
    expect(summary).toMatchObject({ count: 3, totalMinutes: 100, avgMinutes: 100 });
  });

  it("türler sıklığa göre, pay öğe sayısına göre; aynı öğedeki yinelenen tür bir kez", () => {
    const { genres } = summarizeStatsDay([
      item(1, 90, ["Dram", "Gerilim", "Dram"]),
      item(2, 90, ["Dram"]),
      item(3, 90, ["Animasyon"]),
      item(4, 90, ["Gerilim"]),
    ]);
    expect(genres.map((g) => [g.name, g.count])).toEqual([
      ["Dram", 2],
      ["Gerilim", 2],
      ["Animasyon", 1],
    ]);
    expect(genres[0].share).toBe(0.5);
  });

  it("tür sınırı uygulanır", () => {
    const many = ["A", "B", "C", "D", "E", "F", "G", "H"].map((g, i) => item(i, 10, [g]));
    expect(summarizeStatsDay(many).genres).toHaveLength(6);
    expect(summarizeStatsDay(many, { genreLimit: 3 }).genres).toHaveLength(3);
  });

  it("boş/bozuk girdide sıfırlar", () => {
    expect(summarizeStatsDay()).toEqual({
      count: 0,
      totalMinutes: 0,
      avgMinutes: 0,
      distinctTitles: 0,
      genres: [],
      longest: null,
    });
    expect(summarizeStatsDay(null).count).toBe(0);
    expect(summarizeStatsDay([null, item(1, 30)]).count).toBe(1);
  });
});
