import { buildStatusIndex } from "../../utils/listStatusIndex";
import { calculateImportedProfileSummary } from "./importMerge";

// Derived fields only; never rewrite history, ratings, comments or list items.
export function buildImportedSummary(root = {}, lists = {}) {
  const values = (key) => {
    const byId = new Map();
    const fallback = key === "watchedTv" ? "tv" : "movie";
    const items = [...(Array.isArray(root[key]) ? root[key] : []), ...Object.values(lists[key] || {})];
    items.forEach((item) => {
      if (item?.id != null) byId.set(`${item.type || fallback}_${item.id}`, item);
    });
    return [...byId.values()];
  };
  const movies = values("watchedMovies");
  const shows = values("watchedTv");
  const summary = calculateImportedProfileSummary(movies, shows, values("watchList"));
  const ratings = {};
  for (const [key, rating] of Object.entries(lists.myRatings || {})) {
    const mediaKey = rating?.mediaType && rating?.mediaId != null ? `${rating.mediaType}_${rating.mediaId}` : key;
    if (/^(movie|tv)_/.test(mediaKey) && rating?.rating != null) ratings[mediaKey] = rating.rating;
  }
  const comments = [...new Set(Object.values(lists.myComments || {})
    .filter((item) => ["movie", "tv"].includes(item?.kind) && item.targetId != null)
    .map((item) => `${item.kind}_${item.targetId}`))];
  const genreCounts = {};
  [...movies, ...shows].forEach((item) => {
    for (const genre of new Set(Array.isArray(item.genres) ? item.genres : [])) {
      if (genre != null && String(genre).trim()) genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    }
  });
  return {
    statusIndex: buildStatusIndex({
      allLists: root,
      favoritesMap: lists.favorites,
      watchListMap: lists.watchList,
      watchedMoviesMap: lists.watchedMovies,
      watchedTvMap: lists.watchedTv,
      customItemsMap: lists.customItems,
    }),
    activityIndex: { ...root.activityIndex, ratings, comments },
    counts: { ...root.counts, favorites: values("favorites").length, watchedMovies: summary.watchedMovies, watchedTv: summary.watchedTv, watchList: summary.watchList },
    stats: {
      ...root.stats,
      movies: { ...root.stats?.movies, uniqueCount: summary.movieCounts.unique, totalRewatchCount: summary.movieCounts.total, totalMinutes: summary.movieMinutes },
      tv: { ...root.stats?.tv, shows: summary.tvCounts.shows, seasons: summary.tvCounts.seasons, episodes: summary.tvCounts.episodes, totalMinutes: summary.tvMinutes },
      totalMinutes: summary.movieMinutes + summary.tvMinutes,
      genreCounts,
    },
  };
}
