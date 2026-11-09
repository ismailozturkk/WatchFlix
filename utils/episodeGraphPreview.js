// utils/episodeGraphPreview.js
//
// Dizi detayındaki "Bölüm puanları grafiği" düğmesinin önizleme modeli (saf, testli).
// Grafik ekranındaki ızgarayı küçük ölçekte taklit eder: sütun = sezon, hücre = bölüm
// dilimi. Veri yalnız dizi detayının ZATEN gelen `seasons[]` alanından (vote_average +
// episode_count) gelir; ek TMDB isteği yok. Hücre rengi o SEZONUN ortalaması
// (bölüm bölüm puan grafik ekranında).

export const PREVIEW_MAX_COLUMNS = 14;
export const PREVIEW_MAX_ROWS = 5;

const finite = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param {Array<{season_number:number, episode_count?:number, vote_average?:number}>} seasons
 * @param {{maxColumns?:number, maxRows?:number}} [options]
 * @returns {{
 *   columns: Array<{season:number, rows:number, rating:number|null}>,
 *   hiddenCount: number,       // sığmayan sezon sayısı ("+N")
 *   seasonCount: number,
 *   episodeCount: number,
 *   best: {season:number, rating:number}|null
 * }}
 */
export function buildEpisodeGraphPreview(seasons, options = {}) {
  const maxColumns = options.maxColumns ?? PREVIEW_MAX_COLUMNS;
  const maxRows = options.maxRows ?? PREVIEW_MAX_ROWS;
  const real = (Array.isArray(seasons) ? seasons : [])
    .filter((s) => finite(s?.season_number) > 0)
    .sort((a, b) => finite(a.season_number) - finite(b.season_number));

  const episodeCount = real.reduce((sum, s) => sum + Math.max(0, finite(s.episode_count)), 0);
  const longest = real.reduce((m, s) => Math.max(m, finite(s.episode_count)), 0);

  let best = null;
  for (const s of real) {
    const rating = finite(s.vote_average);
    // Eşitlikte ilk sezon kalır.
    if (rating > 0 && (!best || rating > best.rating)) {
      best = { season: finite(s.season_number), rating };
    }
  }

  const visible = real.slice(0, maxColumns);
  const columns = visible.map((s) => {
    const episodes = Math.max(0, finite(s.episode_count));
    // Sütun boyu sezonun bölüm sayısıyla orantılı (en uzun sezon = maxRows), en az 1.
    const rows = longest > 0 ? Math.max(1, Math.round((episodes / longest) * maxRows)) : 1;
    const rating = finite(s.vote_average);
    return { season: finite(s.season_number), rows, rating: rating > 0 ? rating : null };
  });

  return {
    columns,
    hiddenCount: Math.max(0, real.length - visible.length),
    seasonCount: real.length,
    episodeCount,
    best,
  };
}
