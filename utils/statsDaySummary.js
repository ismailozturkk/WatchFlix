// utils/statsDaySummary.js
//
// Film / Dizi istatistik ekranlarında takvim yaprağına basınca açılan "gün
// özeti" sayfasının sayıları. SAF: RN/i18n import etmez, jest doğrudan çalıştırır.
//
// Girdi, ekranların gün kartı için zaten hazırladığı afiş öğeleridir:
//   { mediaId, minutes, genres: string[] (yerelleştirilmiş), title, subtitle }

/**
 * @param {Array<{mediaId?: any, minutes?: number, genres?: string[]}>} items
 * @param {{ genreLimit?: number }} [options]
 * @returns {{
 *   count: number,
 *   totalMinutes: number,
 *   avgMinutes: number,
 *   distinctTitles: number,
 *   genres: Array<{ name: string, count: number, share: number }>,
 *   longest: object | null,
 * }}
 */
export function summarizeStatsDay(items = [], { genreLimit = 6 } = {}) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  let totalMinutes = 0;
  let timed = 0;
  let longest = null;
  const titles = new Set();
  const genreCounts = new Map();

  list.forEach((item) => {
    const minutes = Number(item.minutes);
    if (Number.isFinite(minutes) && minutes > 0) {
      totalMinutes += minutes;
      timed += 1;
      if (!longest || minutes > longest.minutes) longest = item;
    }
    if (item.mediaId != null) titles.add(String(item.mediaId));
    // Bir öğe aynı türü iki kez taşırsa (yerelleştirme birleştirmesi) bir kez sayılır.
    new Set(item.genres || []).forEach((genre) => {
      if (!genre) return;
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    });
  });

  // Pay öğe sayısına göredir: "3 filmin 2'si Dram" → %67. Türler toplamı %100
  // etmez (bir film birden çok türde), çubuk "o günün ne kadarı" sorusunu yanıtlar.
  const genres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, genreLimit)
    .map(([name, count]) => ({ name, count, share: list.length ? count / list.length : 0 }));

  return {
    count: list.length,
    totalMinutes,
    avgMinutes: timed ? Math.round(totalMinutes / timed) : 0,
    distinctTitles: titles.size,
    genres,
    longest,
  };
}
