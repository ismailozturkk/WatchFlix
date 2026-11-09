// __tests__/episodeGraphPreview.test.js
//
// Dizi detayındaki bölüm grafiği düğmesinin önizleme modeli (utils/episodeGraphPreview.js):
// özel bölümler (sezon 0) atlanır, sütunlar sezon sırasında, sütun boyu bölüm sayısıyla
// orantılı, sığmayan sezonlar "+N", en iyi sezon doğru.

const { buildEpisodeGraphPreview } = require("../utils/episodeGraphPreview");

const S = (season_number, episode_count, vote_average) => ({ season_number, episode_count, vote_average });

test("özel bölümler atlanır, sezonlar sıralanır, boy bölüm sayısıyla orantılı", () => {
  const p = buildEpisodeGraphPreview([S(2, 5, 8.1), S(0, 3, 9.9), S(1, 10, 7.4)], { maxRows: 5 });
  expect(p.seasonCount).toBe(2);
  expect(p.episodeCount).toBe(15);
  expect(p.columns.map((c) => c.season)).toEqual([1, 2]);
  expect(p.columns.map((c) => c.rows)).toEqual([5, 3]); // 10→5, 5→2.5→3
  expect(p.best).toEqual({ season: 2, rating: 8.1 });
});

test("puansız sezon null renk alır ve en iyiye sayılmaz; tek bölüm en az bir hücre", () => {
  const p = buildEpisodeGraphPreview([S(1, 20, 0), S(2, 1, 6.2)], { maxRows: 5 });
  expect(p.columns[0].rating).toBeNull();
  expect(p.columns[1].rows).toBe(1);
  expect(p.best).toEqual({ season: 2, rating: 6.2 });
});

test("sığmayan sezonlar gizlenir ve sayılır; en iyi tüm sezonlardan seçilir", () => {
  const seasons = Array.from({ length: 20 }, (_, i) => S(i + 1, 10, i === 17 ? 9.4 : 7));
  const p = buildEpisodeGraphPreview(seasons, { maxColumns: 14 });
  expect(p.columns).toHaveLength(14);
  expect(p.hiddenCount).toBe(6);
  expect(p.best).toEqual({ season: 18, rating: 9.4 });
});

test("boş / geçersiz girdi", () => {
  for (const input of [null, undefined, [], [S(0, 4, 8)]]) {
    const p = buildEpisodeGraphPreview(input);
    expect(p.seasonCount).toBe(0);
    expect(p.columns).toEqual([]);
    expect(p.best).toBeNull();
  }
});
