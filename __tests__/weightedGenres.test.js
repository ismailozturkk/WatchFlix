// genreCanon.weightedGenres: içerik başına toplam 1 tür ağırlığı, ana tür önde.
const { weightedGenres, GENRE_POSITION_DECAY } = require("../utils/genreCanon");

const sum = (m) => [...m.values()].reduce((a, b) => a + b, 0);

test("1–4 türde toplam 1, sıra azalarak", () => {
  for (const names of [["Dram"], ["Dram", "Komedi"], ["Dram", "Komedi", "Korku"], ["Aksiyon", "Macera", "Bilim Kurgu", "Gerilim"]]) {
    const w = weightedGenres(names);
    expect(sum(w)).toBeCloseTo(1, 10);
    const values = [...w.values()];
    for (let i = 1; i < values.length; i += 1) expect(values[i] / values[i - 1]).toBeCloseTo(GENRE_POSITION_DECAY, 10);
  }
  expect(weightedGenres(["Dram"]).get("drama")).toBe(1);
});

test("dil bağımsız, aynı kanonik türe düşenler birleşir, tanınmayan atlanır (istenirse tutulur)", () => {
  expect([...weightedGenres([{ name: "Drama" }, "Dram"]).keys()]).toEqual(["drama"]);
  expect([...weightedGenres(["Xyz", "Dram"]).keys()]).toEqual(["drama"]);
  expect([...weightedGenres(["Xyz", "Dram"], { keepUnknown: true }).keys()]).toEqual(["raw:Xyz", "drama"]);
  expect(weightedGenres(null).size).toBe(0);
});
