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

// Aktarımın eklediği izleme olayı kaynağını taşır ("letterboxd" | "imdb"): kaynak bazında
// sıfırlama yalnız bu olayları geri alır, kullanıcının kendi izlemelerine dokunmaz.
const sourceExtra = (item) => (item?.importSource ? { source: item.importSource } : {});

export function mergeImportedMovie(existing = {}, item = {}, options = {}) {
  const dates = importDates(item, options.fallbackDate);
  const currentEvents = materializeMovieWatchEvents(existing);
  const merged = mergeImportedWatchEvents(currentEvents, dates, {
    scope: "movie",
    idPrefix: `import_movie_${item.id}`,
    now: options.now,
    extra: sourceExtra(item),
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
      ...sourceExtra(item),
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

const tvEpisodeKey = (season, episode) => `${Number(season)}:${Number(episode)}`;
const safeIdPart = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "_");

/**
 * Seelogd yedeğinden BÖLÜM BÖLÜM dizi geçmişi (item.episodes: [{ season, episode, watchedDates, minutes, name }]).
 * Uygulamanın kendi modeliyle birebir (services/watchedTvService): sezon/bölüm iskeleti belgeye gömülür, izleme
 * olayları üst düzeyde TEK kez durur ve episodeKeys taşır. Aynı gün aynı bölüm zaten varsa eklenmez → aynı dosya
 * ikinci kez aktarılınca hiçbir şey değişmez. Tarihsiz bölüm (eski kayıt) dizinin ekleme gününe yazılır.
 * Olay kapsamı "episode": tam dizi izleme sayacı (stats.tv.shows) şişmez.
 */
export function mergeRestoredTv(existing = {}, item = {}, options = {}) {
  const current = materializeTvWatchState({ ...existing, id: existing?.id ?? item.id });
  const fallbackDate = normalizeWatchDate(item.dateAdded) || normalizeWatchDate(options.fallbackDate);
  const have = new Set();
  current.watchEvents.forEach((event) => {
    (event.episodeKeys || []).forEach((key) => have.add(`${key}@${event.watchedAt}`));
  });

  const seasons = new Map(
    current.seasons.map((season) => [
      Number(season.seasonNumber),
      {
        ...season,
        episodes: new Map(
          (season.episodes || []).map(({ watchEvents: _derived, ...episode }) => [Number(episode.episodeNumber), episode]),
        ),
      },
    ]),
  );

  const byDate = new Map();
  for (const ep of Array.isArray(item.episodes) ? item.episodes : []) {
    const seasonNumber = Number(ep?.season);
    const episodeNumber = Number(ep?.episode);
    if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) continue;
    const key = tvEpisodeKey(seasonNumber, episodeNumber);
    const dates = (Array.isArray(ep.watchedDates) && ep.watchedDates.length ? ep.watchedDates : [fallbackDate])
      .map(normalizeWatchDate)
      .filter(Boolean);
    for (const date of [...new Set(dates)]) {
      if (have.has(`${key}@${date}`)) continue;
      have.add(`${key}@${date}`);
      const list = byDate.get(date) || [];
      list.push({ seasonNumber, episodeNumber, key });
      byDate.set(date, list);
    }
    // İskelet: mevcut bölüm bilgisi (ad, süre, afiş, bölüm puanı) ezilmez, yalnız eksikler dolar.
    if (!seasons.has(seasonNumber)) {
      seasons.set(seasonNumber, {
        seasonNumber,
        seasonPosterPath: null,
        seasonEpisodes: 0,
        addedSeasonDate: dates.slice().sort()[0] || fallbackDate || null,
        episodes: new Map(),
      });
    }
    const season = seasons.get(seasonNumber);
    const previous = season.episodes.get(episodeNumber);
    const latest = dates.slice().sort().pop() || null;
    const previousName = previous?.episodeName && previous.episodeName !== "Unknown" ? previous.episodeName : null;
    season.episodes.set(episodeNumber, {
      ...(previous || {}),
      episodeNumber,
      episodePosterPath: previous?.episodePosterPath ?? null,
      episodeName: previousName || ep.name || "Unknown",
      episodeRatings: previous?.episodeRatings || 0,
      episodeMinutes: Number(previous?.episodeMinutes) || Number(ep.minutes) || 0,
      episodeWatchTime: [previous?.episodeWatchTime, latest].filter(Boolean).sort().pop() || null,
    });
  }

  const compactSeasons = [...seasons.values()]
    .map((season) => {
      const episodes = [...season.episodes.values()].sort((a, b) => Number(a.episodeNumber) - Number(b.episodeNumber));
      return { ...season, seasonEpisodes: Math.max(Number(season.seasonEpisodes) || 0, episodes.length), episodes };
    })
    .sort((a, b) => Number(a.seasonNumber) - Number(b.seasonNumber));
  const minutesByKey = new Map();
  compactSeasons.forEach((season) =>
    season.episodes.forEach((episode) =>
      minutesByKey.set(tvEpisodeKey(season.seasonNumber, episode.episodeNumber), Number(episode.episodeMinutes) || 0),
    ),
  );

  const extra = item?.importSource ? { source: item.importSource } : {};
  const events = [...current.watchEvents];
  const byId = new Map(events.map((event, index) => [event.id, index]));
  let addedEpisodes = 0;
  let addedMinutes = 0;
  let addedSeasons = 0;
  let addedEvents = 0;
  for (const date of [...byDate.keys()].sort()) {
    const targets = byDate.get(date);
    const keys = [...new Set(targets.map((target) => target.key))];
    const seasonNumbers = [...new Set(targets.map((target) => target.seasonNumber))];
    const minutes = keys.reduce((sum, key) => sum + (minutesByKey.get(key) || 0), 0);
    const id = `restore_tv_${safeIdPart(item.id)}_${date}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    addedEpisodes += keys.length;
    addedMinutes += minutes;
    if (byId.has(id)) {
      // Önceki bir geri yüklemenin aynı günkü olayı: bölümler ona eklenir (iki ayrı olay olmaz).
      const index = byId.get(id);
      const prev = events[index];
      const mergedKeys = [...new Set([...(prev.episodeKeys || []), ...keys])];
      const mergedSeasons = [...new Set([...(prev.seasonNumbers || []), ...seasonNumbers])];
      events[index] = {
        ...prev,
        episodeKeys: mergedKeys,
        seasonNumbers: mergedSeasons,
        episodeCount: mergedKeys.length,
        seasonCount: mergedSeasons.length,
        minutes: mergedKeys.reduce((sum, key) => sum + (minutesByKey.get(key) || 0), 0),
      };
      continue;
    }
    addedEvents += 1;
    addedSeasons += seasonNumbers.length;
    byId.set(id, events.length);
    events.push({
      id,
      watchedAt: date,
      scope: "episode",
      recordedAt: options.now || new Date().toISOString(),
      episodeKeys: keys,
      seasonNumbers,
      episodeCount: keys.length,
      seasonCount: seasonNumbers.length,
      minutes,
      ...extra,
    });
  }
  events.sort((a, b) => String(b?.watchedAt || "").localeCompare(String(a?.watchedAt || "")));

  const watchedEpisodeCount = compactSeasons.reduce((sum, season) => sum + season.episodes.length, 0);
  const totalMinutes = compactSeasons.reduce(
    (sum, season) => sum + season.episodes.reduce((part, episode) => part + (Number(episode.episodeMinutes) || 0), 0),
    0,
  );
  const firstDate = [...byDate.keys()].sort()[0] || fallbackDate;
  const metadata = fillMissingFields(existing, {
    id: item.id,
    type: "tv",
    name: item.title || item.original_title || "",
    imagePath: item.poster_path || null,
    dateAdded: firstDate,
    addedShowDate: firstDate,
    genres: Array.isArray(item.genres) ? item.genres : [],
  });
  const showSeasonCount = Math.max(Number(existing.showSeasonCount) || 0, Number(item.seasonCount) || 0, compactSeasons.length);
  const showEpisodeCount = Math.max(Number(existing.showEpisodeCount) || 0, Number(item.episodeCount) || 0, watchedEpisodeCount);

  return {
    document: {
      ...existing,
      ...metadata,
      showSeasonCount,
      showEpisodeCount,
      seasons: compactSeasons,
      watchEvents: events,
      watchCount: events.length,
      watchedSeasonCount: compactSeasons.length,
      watchedEpisodeCount,
      totalMinutes,
    },
    addedEvents,
    wasWatched: current.watchEvents.length > 0,
    addedEpisodes,
    addedSeasons,
    addedMinutes,
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
