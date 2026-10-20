const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const episodeKey = (seasonNumber, episodeNumber) =>
  `${toNumber(seasonNumber)}:${toNumber(episodeNumber)}`;

/** Sezon/bölüm çiftini tek bir sıralanabilir sayıya indirger. */
export const getEpisodeOrder = (seasonNumber, episodeNumber) =>
  toNumber(seasonNumber) * 100000 + toNumber(episodeNumber);

export function getWatchedEpisodeKeys(show) {
  const keys = new Set();
  (show?.seasons || []).forEach((season) => {
    (season?.episodes || []).forEach((episode) => {
      if (episode?.episodeNumber == null) return;
      keys.add(episodeKey(season?.seasonNumber, episode.episodeNumber));
    });
  });
  return keys;
}

export function getFurthestWatchedPosition(show) {
  let position = { seasonNumber: 0, episodeNumber: 0, order: 0 };
  (show?.seasons || []).forEach((season) => {
    (season?.episodes || []).forEach((episode) => {
      const seasonNumber = toNumber(season?.seasonNumber);
      const episodeNumber = toNumber(episode?.episodeNumber);
      const order = getEpisodeOrder(seasonNumber, episodeNumber);
      if (order > position.order) {
        position = { seasonNumber, episodeNumber, order };
      }
    });
  });
  return position;
}

export function isEpisodeAired(airDate, now = new Date()) {
  if (!airDate) return false;
  const endOfAirDate = new Date(`${airDate}T23:59:59`);
  return Number.isFinite(endOfAirDate.getTime()) && endOfAirDate <= now;
}

/**
 * Bir sezon yanıtından ilerlemenin ardından gelen ilk izlenmemiş bölümü bulur.
 * `afterOrder` verilirse taban izleme ilerlemesi yerine o konum olur; sıradaki
 * bölümün ardındakini önden hazırlamak için kullanılır.
 */
export function findNextEpisodeInSeason({
  show,
  seasonNumber,
  episodes,
  now = new Date(),
  afterOrder,
}) {
  const watched = getWatchedEpisodeKeys(show);
  const floor = Number.isFinite(afterOrder)
    ? afterOrder
    : 0;
  let firstUpcoming = null;

  for (const episode of [...(episodes || [])].sort(
    (a, b) => toNumber(a?.episode_number) - toNumber(b?.episode_number)
  )) {
    const episodeNumber = toNumber(episode?.episode_number);
    const order = getEpisodeOrder(seasonNumber, episodeNumber);
    if (!episodeNumber || order <= floor) continue;
    if (watched.has(episodeKey(seasonNumber, episodeNumber))) continue;

    const candidate = {
      ...episode,
      seasonNumber: toNumber(seasonNumber),
      episodeNumber,
      isAired: isEpisodeAired(episode?.air_date, now),
    };
    if (candidate.isAired) return candidate;
    if (!firstUpcoming) firstUpcoming = candidate;
  }

  return firstUpcoming;
}

/**
 * İşaretlenen bölümün yerine önden hazırlanmış sıradaki bölümü koyar. Sunucu
 * doğrulaması gelene kadar kart beklemesin diye izlenen bölüm sayısı ve
 * etkinlik zamanı yerel olarak ilerletilir. Sıradaki bölüm yoksa null döner
 * (dizinin eldeki bölümleri bitmiştir).
 */
export function advanceUpNextItem(item, { watchedAt = Date.now() } = {}) {
  if (!item?.nextUp) return null;
  return {
    ...item.nextUp,
    watchedEpisodeCount: toNumber(item.watchedEpisodeCount) + 1,
    activityTime: watchedAt,
  };
}

export function getUpNextSeasonNumbers(show, showDetails) {
  const furthest = getFurthestWatchedPosition(show);
  const watchedBySeason = new Map();
  (show?.seasons || []).forEach((season) => {
    const seasonNumber = toNumber(season?.seasonNumber);
    if (seasonNumber <= 0) return;
    watchedBySeason.set(
      seasonNumber,
      new Set(
        (season?.episodes || [])
          .map((episode) => toNumber(episode?.episodeNumber))
          .filter(Boolean),
      ).size,
    );
  });

  const catalog = (showDetails?.seasons || [])
    .map((season) => toNumber(season?.season_number))
    .filter((seasonNumber) => seasonNumber > 0)
    .sort((a, b) => a - b);

  // Yeni model tek tek ve sırasız bölüm işaretlemeye izin verir. İlk eksik
  // sezonu bulup oradan başlamak, S1B1 + S1B3 izlenmişken S1B2'nin atlanmasını
  // engeller. TMDB toplamı yoksa gömülü seasonEpisodes geriye dönüş olur.
  const embeddedTotals = new Map(
    (show?.seasons || []).map((season) => [
      toNumber(season?.seasonNumber),
      toNumber(season?.seasonEpisodes),
    ]),
  );
  const firstIncomplete = (showDetails?.seasons || [])
    .map((season) => ({
      seasonNumber: toNumber(season?.season_number),
      total: toNumber(season?.episode_count),
    }))
    .filter(({ seasonNumber }) => seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .find(({ seasonNumber, total }) => {
      const knownTotal = total || embeddedTotals.get(seasonNumber) || 0;
      return knownTotal > 0 && (watchedBySeason.get(seasonNumber) || 0) < knownTotal;
    })?.seasonNumber;

  const start = Math.max(1, firstIncomplete || furthest.seasonNumber || 1);
  return catalog.filter((seasonNumber) => seasonNumber >= start);
}
