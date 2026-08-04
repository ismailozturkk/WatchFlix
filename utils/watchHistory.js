// İzleme geçmişi için Firestore'dan bağımsız, geriye uyumlu yardımcılar.
// Eski kayıtlardaki dateAdded / episodeWatchTime alanları ilk izleme olayı
// olarak materialize edilir; yeni şema her tekrar izlemeyi ayrı kimlikle saklar.

const cleanPart = (value) =>
  String(value ?? "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");

export const normalizeWatchDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  const raw = value?.toDate?.() ||
    (value?.seconds ? new Date(value.seconds * 1000) : value);
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const createWatchEventId = (prefix = "watch") =>
  `${cleanPart(prefix)}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;

const normalizeEvent = (event, fallback = {}) => {
  const watchedAt = normalizeWatchDate(event?.watchedAt || event?.date || fallback.watchedAt);
  if (!watchedAt) return null;
  return {
    ...event,
    id: String(event?.id || fallback.id || createWatchEventId("watch")),
    watchedAt,
    scope: event?.scope || fallback.scope || "movie",
  };
};

export function movieWatchEvents(item) {
  const explicit = (Array.isArray(item?.watchEvents) ? item.watchEvents : [])
    .map((event) => normalizeEvent(event, { scope: "movie" }))
    .filter(Boolean)
    .sort((a, b) => String(b.watchedAt).localeCompare(String(a.watchedAt)));
  if (explicit.length) return explicit;
  const watchedAt = normalizeWatchDate(item?.dateAdded);
  if (!watchedAt) return [];
  return [{
    id: `legacy_movie_${cleanPart(item?.id)}_${watchedAt}`,
    watchedAt,
    scope: "movie",
    legacy: true,
  }];
}

export const materializeMovieWatchEvents = (item) => movieWatchEvents(item);

const episodeKey = (seasonNumber, episodeNumber) =>
  `${Number(seasonNumber)}:${Number(episodeNumber)}`;

const eventSort = (a, b) =>
  String(b?.watchedAt || "").localeCompare(String(a?.watchedAt || ""));

/**
 * TV belgesini yeni olay şemasına dönüştürür. Fonksiyon saf olduğu için hem
 * transaction içinde hem de henüz migrate edilmemiş snapshot'larda kullanılabilir.
 */
export function materializeTvWatchState(show) {
  const showId = show?.id ?? "unknown";
  const topById = new Map();

  (Array.isArray(show?.watchEvents) ? show.watchEvents : []).forEach((raw) => {
    const event = normalizeEvent(raw, { scope: "episode" });
    if (!event) return;
    topById.set(event.id, {
      ...event,
      episodeKeys: [...new Set(raw?.episodeKeys || [])],
      seasonNumbers: [...new Set(raw?.seasonNumbers || [])],
    });
  });

  const seasons = (show?.seasons || []).map((season) => {
    const seasonNumber = Number(season?.seasonNumber);
    const episodes = (season?.episodes || []).map((episode) => {
      const key = episodeKey(seasonNumber, episode?.episodeNumber);
      let events = (Array.isArray(episode?.watchEvents) ? episode.watchEvents : [])
        .map((raw) => normalizeEvent(raw, {
          scope: "episode",
          watchedAt: episode?.episodeWatchTime || season?.addedSeasonDate || show?.addedShowDate,
        }))
        .filter(Boolean);

      if (!events.length) {
        // Yeni kompakt şemada olay yalnız üst düzeyde tutulur; bölüm geçmişi
        // event.episodeKeys üzerinden anlık türetilir (binlerce bölümlü dizide
        // aynı event'i her bölümün içine kopyalayıp belgeyi şişirmeyiz).
        events = [...topById.values()]
          .filter((event) => (event.episodeKeys || []).includes(key))
          .map((event) => ({
            id: event.id,
            watchedAt: event.watchedAt,
            scope: event.scope,
            recordedAt: event.recordedAt,
          }));
      }

      if (!events.length) {
        const watchedAt = normalizeWatchDate(
          episode?.episodeWatchTime || season?.addedSeasonDate || show?.addedShowDate,
        );
        if (watchedAt) {
          events = [{
            id: `legacy_tv_${cleanPart(showId)}_${watchedAt}`,
            watchedAt,
            scope: "legacy",
            legacy: true,
          }];
        }
      }

      events.forEach((event) => {
        const current = topById.get(event.id) || {
          ...event,
          episodeKeys: [],
          seasonNumbers: [],
        };
        if (!current.episodeKeys.includes(key)) current.episodeKeys.push(key);
        if (!current.seasonNumbers.includes(seasonNumber)) {
          current.seasonNumbers.push(seasonNumber);
        }
        current.episodeCount = current.episodeKeys.length;
        topById.set(event.id, current);
      });

      return {
        ...episode,
        episodeWatchTime: events.slice().sort(eventSort)[0]?.watchedAt || null,
        watchEvents: events.sort(eventSort),
      };
    });
    return { ...season, episodes };
  });

  const minutesByKey = new Map();
  seasons.forEach((season) =>
    (season.episodes || []).forEach((episode) => {
      minutesByKey.set(
        episodeKey(season.seasonNumber, episode.episodeNumber),
        Number(episode.episodeMinutes) || 0,
      );
    }),
  );

  const watchEvents = [...topById.values()]
    .map((event) => ({
      ...event,
      episodeKeys: [...new Set(event.episodeKeys || [])],
      seasonNumbers: [...new Set(event.seasonNumbers || [])],
      episodeCount: (event.episodeKeys || []).length,
      seasonCount: (event.seasonNumbers || []).length,
      minutes: (event.episodeKeys || []).reduce(
        (sum, key) => sum + (minutesByKey.get(key) || 0),
        0,
      ),
    }))
    .sort(eventSort);

  return { seasons, watchEvents };
}

export function tvWatchEvents(show, filter = {}) {
  const state = materializeTvWatchState(show || {});
  const seasonNumber = filter.seasonNumber == null ? null : Number(filter.seasonNumber);
  const epKey = filter.episodeNumber == null || seasonNumber == null
    ? null
    : episodeKey(seasonNumber, filter.episodeNumber);
  return state.watchEvents.filter((event) => {
    if (epKey) return (event.episodeKeys || []).includes(epKey);
    if (seasonNumber != null) return (event.seasonNumbers || []).includes(seasonNumber);
    return true;
  });
}

export function flattenMovieWatchEntries(items = []) {
  return items.flatMap((item) => movieWatchEvents(item).map((event) => ({
    ...item,
    dateAdded: event.watchedAt,
    watchEvent: event,
    watchEventId: event.id,
    historyId: `${item?.type || "movie"}_${item?.id}_${event.id}`,
  })));
}

export function flattenTvEpisodeWatchEntries(shows = []) {
  return shows.flatMap((show) => {
    const state = materializeTvWatchState(show);
    return state.seasons.flatMap((season) =>
      (season.episodes || []).flatMap((episode) =>
        (episode.watchEvents || []).map((event) => ({
          showId: show.id,
          showName: show.name,
          showImage: show.imagePath,
          genres: show.genres,
          seasonNumber: season.seasonNumber,
          seasonPosterPath: season.seasonPosterPath,
          episodeNumber: episode.episodeNumber,
          episodeName: episode.episodeName,
          episodeWatchTime: event.watchedAt,
          episodeMinutes: episode.episodeMinutes,
          episodeRatings: episode.episodeRatings,
          id: `${show.id}_${season.seasonNumber}_${episode.episodeNumber}_${event.id}`,
          historyId: `${show.id}_${season.seasonNumber}_${episode.episodeNumber}_${event.id}`,
          watchEvent: event,
          watchEventId: event.id,
          addedShowDate: show.addedShowDate,
          addedSeasonDate: season.addedSeasonDate,
        })),
      ),
    );
  });
}

// ── Profil sayaçları ────────────────────────────────────────────────────────
//
// Her ölçünün İKİ karşılığı var ve ikisi de doğru:
//   total  → her izleme olayı ayrı sayılır (tekrarlı). 100 filmi 5'er kez
//            izleyen kullanıcı 500 görür; harcanan emeğin karşılığı budur.
//   unique → kaç FARKLI eser izlendiği (tekrarsız). "İzlenen Filmler"
//            etiketinin gerçekte söylediği sayı ve rozet motorunun
//            (watchScoring.js) kullandığı tanım.
// Hangisinin gösterileceğini kullanıcı profildeki anahtarla seçer. Süre
// hesapları bu ayrımın dışında: o dakikalar her iki kipte de harcandı.

export function countMovieWatchStats(movieHistoryItems = []) {
  // Kimliksiz eski kayıt indeksle ayrışır; aksi halde hepsi tek filme çökerdi.
  const unique = new Set(
    movieHistoryItems.map((movie, index) => String(movie?.id ?? `#${index}`)),
  );
  return { total: movieHistoryItems.length, unique: unique.size };
}

/** Girdi: materializeTvWatchState() çıktılarının listesi. */
export function countTvWatchStats(states = []) {
  let showTotal = 0;
  let seasonTotal = 0;
  let seasonUnique = 0;
  let episodeTotal = 0;
  let episodeUnique = 0;

  states.forEach((state) => {
    const seasons = state?.seasons || [];
    const watchEvents = state?.watchEvents || [];

    // Tekrarlı dizi sayısı = baştan sona izleme adedi; hiç tam izleme
    // kaydı yoksa dizi yine de bir kez sayılır (kısmi izlemeler kaybolmasın).
    showTotal += Math.max(
      1,
      watchEvents.filter((event) => event?.scope === "show").length,
    );

    // Sezon tekrarları yalnızca sezon/dizi kapsamlı olaylardan gelir; tek tek
    // işaretlenen bölümler sezonu ikinci kez saydırmaz.
    const repeatsBySeason = new Map();
    watchEvents
      .filter((event) => event?.scope === "show" || event?.scope === "season")
      .forEach((event) => (event?.seasonNumbers || []).forEach((seasonNumber) => {
        repeatsBySeason.set(seasonNumber, (repeatsBySeason.get(seasonNumber) || 0) + 1);
      }));
    const seasonExtras = [...repeatsBySeason.values()].reduce(
      (count, watches) => count + Math.max(0, watches - 1),
      0,
    );
    seasonTotal += seasons.length + seasonExtras;
    seasonUnique += seasons.length;

    seasons.forEach((season) => {
      const episodes = season?.episodes || [];
      episodeUnique += episodes.length;
      episodeTotal += episodes.reduce(
        (sum, episode) => sum + (episode?.watchEvents?.length || 0),
        0,
      );
    });
  });

  return {
    shows:    { total: showTotal,    unique: states.length },
    seasons:  { total: seasonTotal,  unique: seasonUnique },
    episodes: { total: episodeTotal, unique: episodeUnique },
  };
}

export function mostRewatched(items = [], idOf = (item) => item?.id, limit = 5) {
  const grouped = new Map();
  items.forEach((item) => {
    const id = idOf(item);
    if (id == null) return;
    const key = String(id);
    const current = grouped.get(key) || { item, count: 0 };
    current.count += 1;
    grouped.set(key, current);
  });
  return [...grouped.values()]
    .filter(({ count }) => count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Günlük/aylık/yıllık istatistik sütunlarını son kayıt dönemine göre üretir. */
export function buildWatchChartData(
  groupedData = [],
  minutesOf = (item) => item?.minutes,
  locale = "tr-TR",
  period = "daily",
  requestedPointCount,
) {
  const dailyTotals = new Map();
  (groupedData || []).forEach((section) => {
    const dateKey = normalizeWatchDate(section?.title);
    if (!dateKey) return;
    const minutes = (section?.data || []).reduce(
      (sum, item) => sum + (Number(minutesOf(item)) || 0),
      0,
    );
    dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + minutes);
  });
  const keys = [...dailyTotals.keys()].sort();
  if (!keys.length) return [];
  const latestDate = keys[keys.length - 1];
  const totals = new Map();
  keys.forEach((dateKey) => {
    const aggregateKey = period === "yearly" ? dateKey.slice(0, 7) : dateKey;
    totals.set(aggregateKey, (totals.get(aggregateKey) || 0) + (dailyTotals.get(dateKey) || 0));
  });
  const latest = period === "yearly" ? latestDate.slice(0, 7) : latestDate;
  const [year, month = 1, day = 1] = latest.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));
  const daysInActiveMonth = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  const defaults = { daily: 7, monthly: daysInActiveMonth, yearly: 12 };
  const count = Math.max(
    1,
    Math.floor(requestedPointCount) || defaults[period] || defaults.daily,
  );
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(anchor);
    const offset = count - 1 - index;
    if (period === "yearly") {
      date.setUTCMonth(index);
      date.setUTCDate(1);
    } else if (period === "monthly") {
      date.setUTCDate(index + 1);
    } else {
      date.setUTCDate(anchor.getUTCDate() - offset);
    }
    const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    const key = period === "yearly" ? dateKey.slice(0, 7) : dateKey;
    let dayLabel;
    let dateLabel;
    if (period === "yearly") {
      dayLabel = new Intl.DateTimeFormat(locale, {
        month: "narrow",
        timeZone: "UTC",
      }).format(date);
      dateLabel = new Intl.DateTimeFormat(locale, {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
    } else if (period === "monthly") {
      dayLabel = String(date.getUTCDate());
      dateLabel = new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(date);
    } else {
      dayLabel = new Intl.DateTimeFormat(locale, {
        weekday: "narrow",
        timeZone: "UTC",
      }).format(date);
      dateLabel = new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(date);
    }
    return {
      key,
      value: totals.get(key) || 0,
      dayLabel,
      dateLabel,
    };
  });
}

/** Önceki günlük grafik çağrıları için geriye uyumlu kısa yol. */
export function buildRecentWatchChartData(
  groupedData = [],
  minutesOf = (item) => item?.minutes,
  locale = "tr-TR",
  pointCount = 7,
) {
  return buildWatchChartData(groupedData, minutesOf, locale, "daily", pointCount);
}
