import { RESERVED_LIST_NAMES } from "./listShare";

export const EMPTY_LIST_STATUS = Object.freeze({
  inWatchList: false,
  inFavorites: false,
  isWatched: false,
  isInOtherLists: false,
});
const isMap = (value) => value != null && typeof value === "object" && !Array.isArray(value);

// Later sources override individual flags, including explicit removals (false).
export function mergeStatusIndexes(...sources) {
  const result = { movie: {}, tv: {} };
  for (const source of sources) {
    for (const type of ["movie", "tv"]) {
      if (!isMap(source?.[type])) continue;
      for (const [id, status] of Object.entries(source[type])) {
        if (!isMap(status)) continue;
        const next = { ...(result[type][id] || EMPTY_LIST_STATUS) };
        for (const flag of Object.keys(EMPTY_LIST_STATUS)) {
          if (typeof status[flag] === "boolean") next[flag] = status[flag];
        }
        result[type][id] = next;
      }
    }
  }
  return result;
}

export function resolveStatusIndex(root, fallback, cached) {
  const index = mergeStatusIndexes(cached, fallback, root?.statusIndex);
  // Legacy custom lists live entirely in the root. Their arrays are the
  // current membership source, even if an old status flag was never cleared.
  if (root && !root.customLists?.length) {
    for (const type of ["movie", "tv"]) {
      Object.entries(index[type]).forEach(([id, status]) => {
        status.isInOtherLists = !!fallback?.[type]?.[id]?.isInOtherLists;
      });
    }
  }
  return index;
}

export function buildStatusIndex({ allLists, favoritesMap = {}, watchListMap = {}, watchedMoviesMap = {}, watchedTvMap = {}, customItemsMap = {} } = {}) {
  const index = { movie: {}, tv: {} };
  const mark = (item, flag, fallback = "movie") => {
    if (!item || item.id == null) return;
    const type = (item.type || fallback) === "tv" ? "tv" : "movie";
    index[type][item.id] = { ...(index[type][item.id] || EMPTY_LIST_STATUS), [flag]: true };
  };
  for (const [key, map, flag, type] of [
    ["favorites", favoritesMap, "inFavorites", "movie"],
    ["watchList", watchListMap, "inWatchList", "movie"],
    ["watchedMovies", watchedMoviesMap, "isWatched", "movie"],
    ["watchedTv", watchedTvMap, "isWatched", "tv"],
    ["customItems", customItemsMap, "isInOtherLists", "movie"],
  ]) {
    Object.values(map || {}).forEach((item) => mark(item, flag, type));
    if (Array.isArray(allLists?.[key])) allLists[key].forEach((item) => mark(item, flag, type));
  }
  Object.entries(allLists || {}).forEach(([key, items]) => {
    if (!RESERVED_LIST_NAMES.includes(key) && Array.isArray(items)) {
      items.forEach((item) => mark(item, "isInOtherLists"));
    }
  });
  return index;
}
