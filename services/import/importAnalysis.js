// services/import/importAnalysis.js
//
// Seçilen dosyanın İÇERİK ANALİZİ (saf): aktarımdan önce kullanıcıya ne bulunduğunu
// gösterir — sayılar, puan dağılımı, yıllara göre izleme, en çok izlenen dönemler, tarih
// aralığı ve tahmini süre. Ağ ya da yazım yok; önizleme ekranı bu özetle çizilir.

import { isBundleResult } from "./importSources";

// Tahmini süre katsayıları (ölçümle kabaca): eşleştirme 5 paralel istek, kayıt sıralı.
const MATCH_MS_PER_ITEM = 420 / 5;
const SAVE_MS_PER_ITEM = 260;
const LIST_MS = 700;
const YEARS_SHOWN = 6;
const DECADES_SHOWN = 4;

const yearOfDate = (value) => {
  const year = parseInt(String(value || "").slice(0, 4), 10);
  return Number.isFinite(year) && year > 1870 && year < 2200 ? year : null;
};

const dayOf = (value) => {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const datesOf = (item) => {
  const list = Array.isArray(item?.watchDates) && item.watchDates.length ? item.watchDates : [item?.watchedDate];
  return list.map(dayOf).filter(Boolean);
};

const identity = (item) =>
  item?.imdbId || `${String(item?.title || "").trim().toLowerCase()}__${item?.year || "any"}`;

/**
 * @param {Object} parsed  importSources çıktısı (tek dosya ya da paket)
 * @returns {{
 *   origins: string[], isBundle: boolean,
 *   totals: { titles:number, watched:number, watchlist:number, lists:number, listItems:number,
 *     ratings:number, reviews:number, rewatches:number, watchEvents:number, series:number },
 *   ratingHistogram: number[], ratingAverage: number|null,
 *   byYear: Array<{ year:number, count:number }>, decades: Array<{ decade:number, count:number }>,
 *   dateRange: { from:string, to:string }|null, estimateMs: number,
 *   skippedCount: number, unknownFilesCount: number,
 * }}
 */
export function analyzeImport(parsed) {
  const bundle = isBundleResult(parsed);
  const watched = bundle
    ? parsed.watchedItems || []
    : (parsed?.items || []).filter((item) => item.targetList !== "watchList");
  const watchlist = bundle
    ? parsed.watchlistItems || []
    : (parsed?.items || []).filter((item) => item.targetList === "watchList");
  const customLists = bundle ? parsed.customLists || [] : [];
  const listItems = customLists.flatMap((list) => list.items || []);
  const everything = [...watched, ...watchlist, ...listItems];

  const histogram = Array.from({ length: 10 }, () => 0);
  let ratingSum = 0;
  let ratingCount = 0;
  const yearCounts = new Map();
  const decadeCounts = new Map();
  let from = null;
  let to = null;
  let watchEvents = 0;
  let rewatches = 0;

  watched.forEach((item) => {
    const rating = Number(item.rating);
    if (Number.isFinite(rating) && rating >= 1 && rating <= 10) {
      histogram[Math.round(rating) - 1] += 1;
      ratingSum += rating;
      ratingCount += 1;
    }
    const dates = datesOf(item);
    watchEvents += Math.max(1, dates.length);
    if (item.isRewatch || dates.length > 1) rewatches += 1;
    dates.forEach((date) => {
      const year = yearOfDate(date);
      if (year) yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
      if (!from || date < from) from = date;
      if (!to || date > to) to = date;
    });
  });

  const seen = new Set();
  everything.forEach((item) => {
    const key = identity(item);
    if (seen.has(key)) return;
    seen.add(key);
    const release = Number(item.year);
    if (Number.isFinite(release) && release > 1870) {
      const decade = Math.floor(release / 10) * 10;
      decadeCounts.set(decade, (decadeCounts.get(decade) || 0) + 1);
    }
  });

  const byYear = [...yearCounts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year)
    .slice(-YEARS_SHOWN);
  const decades = [...decadeCounts.entries()]
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => b.count - a.count || b.decade - a.decade)
    .slice(0, DECADES_SHOWN);

  const saveCount = watched.length + watchlist.length;
  const estimateMs = Math.round(
    seen.size * MATCH_MS_PER_ITEM + saveCount * SAVE_MS_PER_ITEM + customLists.length * LIST_MS,
  );

  return {
    origins: bundle ? parsed.origins || ["letterboxd"] : [parsed?.source].filter(Boolean),
    isBundle: bundle,
    totals: {
      titles: seen.size,
      watched: watched.length,
      watchlist: watchlist.length,
      lists: customLists.length,
      listItems: listItems.length,
      ratings: ratingCount,
      reviews: watched.filter((item) => typeof item.review === "string" && item.review.trim()).length,
      rewatches,
      watchEvents: watched.length ? watchEvents : 0,
      series: everything.filter((item) => item.mediaType === "tv").length,
    },
    ratingHistogram: histogram,
    ratingAverage: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    byYear,
    decades,
    dateRange: from && to ? { from, to } : null,
    estimateMs,
    skippedCount: Number(parsed?.skippedCount) || 0,
    unknownFilesCount: Number(parsed?.unknownFilesCount) || 0,
  };
}
