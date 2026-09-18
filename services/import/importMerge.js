import {
  countMovieWatchStats,
  countTvWatchStats,
  materializeMovieWatchEvents,
  materializeTvWatchState,
  normalizeWatchDate,
} from "../../utils/watchHistory";

const hasValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

export function fillMissingFields(existing = {}, incoming = {}) {
  return Object.entries(incoming).reduce((patch, [key, value]) => {
    if (!hasValue(existing?.[key]) && hasValue(value)) patch[key] = value;
    return patch;
  }, {});
}

const eventKey = (event, fallbackScope) => {
  const watchedAt = normalizeWatchDate(event?.watchedAt || event?.date);
  if (!watchedAt) return null;
  const scope = event?.scope || fallbackScope;
  return `${scope}:${watchedAt}`;
};

export function mergeImportedWatchEvents(
  existingEvents = [],
  importedDates = [],
  { scope = "movie", idPrefix = "import", now = new Date().toISOString(), extra = {} } = {},
) {
  const merged = [];
  const seen = new Set();

  (existingEvents || []).forEach((event) => {
    const key = eventKey(event, scope);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(event);
  });

  let addedCount = 0;
  (importedDates || []).forEach((rawDate) => {
    const watchedAt = normalizeWatchDate(rawDate);
    if (!watchedAt) return;
    const key = `${scope}:${watchedAt}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      id: `${idPrefix}_${watchedAt}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
      watchedAt,
      scope,
      recordedAt: now,
      ...extra,
    });
    addedCount += 1;
  });

  merged.sort((a, b) => String(b?.watchedAt || "").localeCompare(String(a?.watchedAt || "")));
  return { events: merged, addedCount };
}

const importDates = (item, fallbackDate) => {
  const raw = Array.isArray(item?.watchDates) && item.watchDates.length
    ? item.watchDates
    : [item?.watchedDate || item?.dateAdded || fallbackDate];
  return [...new Set(raw.map(normalizeWatchDate).filter(Boolean))];
};

export function mergeImportedMovie(existing = {}, item = {}, options = {}) {
  const dates = importDates(item, options.fallbackDate);
  const currentEvents = materializeMovieWatchEvents(existing);
  const merged = mergeImportedWatchEvents(currentEvents, dates, {
    scope: "movie",
    idPrefix: `import_movie_${item.id}`,
    now: options.now,
  });
  const cleanDate = dates[dates.length - 1] || options.fallbackDate;
  const metadata = fillMissingFields(existing, {
    id: item.id,
    type: "movie",
    name: item.title || item.original_title || "",
    imagePath: item.poster_path || null,
    dateAdded: cleanDate,
    genres: Array.isArray(item.genres) ? item.genres : [],
    minutes: Number(item.minutes) > 0 ? Number(item.minutes) : null,
  });

  return {
    document: { ...existing, ...metadata, watchEvents: merged.events, watchCount: merged.events.length },
    addedEvents: merged.addedCount,
    wasWatched: currentEvents.length > 0,
  };
}

export function mergeImportedTv(existing = {}, item = {}, options = {}) {
  const dates = importDates(item, options.fallbackDate);
  const current = materializeTvWatchState(existing);
  // Kompakt importer olaylarında episodeKeys bilinmez; materializer bu durumda
  // dakikayı bölüm anahtarlarından yeniden hesaplayıp 0'a düşürür. Ham olayın
  // kaynak özetini koru, legacy bölüm kayıtlarında ise materialize edilmiş hâli kullan.
  const currentEvents = Array.isArray(existing.watchEvents) && existing.watchEvents.length > 0
    ? existing.watchEvents
    : current.watchEvents;
  const episodeCount = Math.max(1, Number(item.episodeCount) || 1);
  const seasonCount = Math.max(1, Number(item.seasonCount) || 1);
  const episodeMinutes = Math.max(0, Number(item.episodeMinutes) || 0);
  const totalMinutes = episodeMinutes * episodeCount;
  const merged = mergeImportedWatchEvents(currentEvents, dates, {
    scope: "show",
    idPrefix: `import_tv_${item.id}`,
    now: options.now,
    extra: {
      episodeKeys: [],
      seasonNumbers: Array.from({ length: seasonCount }, (_, index) => index + 1),
      episodeCount,
      seasonCount,
      minutes: totalMinutes,
    },
  });
  const cleanDate = dates[dates.length - 1] || options.fallbackDate;
  const metadata = fillMissingFields(existing, {
    id: item.id,
    type: "tv",
    name: item.title || item.original_title || "",
    imagePath: item.poster_path || null,
    dateAdded: cleanDate,
    addedShowDate: cleanDate,
    showSeasonCount: seasonCount,
    showEpisodeCount: episodeCount,
    watchedSeasonCount: seasonCount,
    watchedEpisodeCount: episodeCount,
    totalMinutes,
    genres: Array.isArray(item.genres) ? item.genres : [],
    seasons: [],
  });

  return {
    document: { ...existing, ...metadata, watchEvents: merged.events, watchCount: merged.events.length },
    addedEvents: merged.addedCount,
    wasWatched: currentEvents.length > 0,
    addedEpisodes: merged.addedCount * episodeCount,
    addedSeasons: merged.addedCount * seasonCount,
    addedMinutes: merged.addedCount * totalMinutes,
  };
}

export function mergeImportedWatchlist(existing = {}, item = {}, fallbackDate) {
  const type = item.mediaType || "movie";
  return {
    ...existing,
    ...fillMissingFields(existing, {
      id: item.id,
      type,
      name: item.title || item.original_title || "",
      imagePath: item.poster_path || null,
      dateAdded: normalizeWatchDate(item.dateAdded || fallbackDate),
      genres: Array.isArray(item.genres) ? item.genres : [],
      minutes: type === "movie" && Number(item.minutes) > 0 ? Number(item.minutes) : null,
      episodeMinutes: type === "tv" && Number(item.episodeMinutes) > 0
        ? Number(item.episodeMinutes)
        : null,
      episodeCount: type === "tv" && Number(item.episodeCount) > 0
        ? Number(item.episodeCount)
        : null,
      seasonCount: type === "tv" && Number(item.seasonCount) > 0
        ? Number(item.seasonCount)
        : null,
    }),
  };
}

export function importedReviewId(uid, mediaType, mediaId) {
  const owner = String(uid || "user").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  return `import_review_${owner}_${mediaType}_${mediaId}`;
}

export function calculateImportedProfileSummary(movies = [], tvShows = [], watchlist = []) {
  const movieHistory = movies.flatMap((movie) =>
    materializeMovieWatchEvents(movie).map((event) => ({ ...movie, watchEvent: event })),
  );
  const tvStates = tvShows.map((show) => materializeTvWatchState(show));
  const movieCounts = countMovieWatchStats(movieHistory);
  const tvCounts = countTvWatchStats(tvStates);

  tvStates.forEach((state, index) => {
    if (state.seasons.length > 0) return;
    const show = tvShows[index] || {};
    const events = state.watchEvents || [];
    const fallbackSeasons = Math.max(0, Number(show.watchedSeasonCount || show.showSeasonCount) || 0);
    const fallbackEpisodes = Math.max(0, Number(show.watchedEpisodeCount || show.showEpisodeCount) || 0);
    tvCounts.seasons.unique += fallbackSeasons;
    tvCounts.episodes.unique += fallbackEpisodes;
    tvCounts.seasons.total += events.reduce(
      (sum, event) => sum + (Number(event.seasonCount) || fallbackSeasons),
      0,
    );
    tvCounts.episodes.total += events.reduce(
      (sum, event) => sum + (Number(event.episodeCount) || fallbackEpisodes),
      0,
    );
  });

  const movieMinutes = movieHistory.reduce((sum, movie) => sum + (Number(movie.minutes) || 0), 0);
  const tvMinutes = tvStates.reduce((sum, state, index) => {
    const show = tvShows[index] || {};
    const events = state.seasons.length === 0 && Array.isArray(show.watchEvents)
      ? show.watchEvents
      : state.watchEvents;
    return sum + events.reduce((part, event) => part + (Number(event.minutes) || 0), 0);
  }, 0);
  return {
    watchedMovies: movies.length,
    watchedTv: tvShows.length,
    watchList: watchlist.length,
    movieCounts,
    tvCounts,
    movieMinutes,
    tvMinutes,
  };
}
