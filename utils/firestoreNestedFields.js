// set(..., { merge: true }) takes nested objects, unlike update() field paths.
// Only expand known summary fields; custom list names may contain dots.
export function nestedSummaryFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!/^(statusIndex\.(movie|tv)\.[^.]+\.(inWatchList|inFavorites|isWatched|isInOtherLists)|activityIndex\.ratings\.[^.]+|counts\.(favorites|watchList|watchedMovies|watchedTv)|stats\.(totalMinutes|genreCounts\..+|movies\.(uniqueCount|totalRewatchCount|totalMinutes)|tv\.(totalMinutes|(shows|seasons|episodes)\.(unique|total))))$/.test(key)) {
      out[key] = value;
      continue;
    }
    const parts = key.startsWith("stats.genreCounts.")
      ? ["stats", "genreCounts", key.slice("stats.genreCounts.".length)]
      : key.split(".");
    let cursor = out;
    for (const part of parts.slice(0, -1)) cursor = cursor[part] ||= {};
    cursor[parts[parts.length - 1]] = value;
  }
  return out;
}
