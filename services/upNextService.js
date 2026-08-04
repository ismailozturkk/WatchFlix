import {
  findNextEpisodeInSeason,
  getEpisodeOrder,
  getFurthestWatchedPosition,
  getUpNextSeasonNumbers,
} from "../utils/upNext";
import {
  getWatchedEpisodeCount,
  getWatchedShowActivityTime,
} from "../utils/watchState";
import { cachedTmdb } from "../utils/cachedRead";

const TMDB_BASE = "https://api.themoviedb.org/3";

// Sıradaki bölüm işaretlenince kart beklemeden ilerlesin diye bir sonraki
// bölümler de aynı geçişte çözülür. Sezon yanıtları önbelleğe alındığı için
// bu genelde ek istek doğurmaz.
const DEFAULT_LOOKAHEAD = 2;

// TMDB dizi/sezon yanıtları disk cache'inde bu kadar taze sayılır. Yayın
// tarihi karşılaştırması yerel saatle yapıldığı için bayat sayılan tek şey
// TMDB'ye YENİ eklenen bölümlerdir; 6 saat bunun için fazlasıyla yeter ve
// TV ana ekranındaki ray her açılışta ağa çıkmaz.
const TMDB_TTL = 6 * 60 * 60 * 1000;

// Aynı dizinin sıradaki bölümü artık iki yerden isteniyor: TV ana ekranındaki
// "Devam Eden Dizilerim" rayı ve Sıradaki ekranı. Çözümleme sonucu burada
// paylaşılır — ikinci tüketici ne ağa ne de diske gider. SÖZ (promise)
// saklanır, böylece aynı anda gelen iki istek tek çözümlemeye düşer.
const RESOLUTION_TTL = 30 * 60 * 1000;
const RESOLUTION_LIMIT = 60;
const resolutionCache = new Map();

const tmdbUrl = (path, language) =>
  `${TMDB_BASE}${path}?language=${encodeURIComponent(language || "en-US")}`;

/**
 * Dil URL'in parçasıdır (axios `params` değil): cache anahtarı URL olduğu için
 * tr/en yanıtları aynı kaydın üstüne yazmasın.
 */
async function fetchTmdb(path, { apiKey, language, forceRefresh }) {
  const { data } = await cachedTmdb(
    tmdbUrl(path, language),
    { headers: { accept: "application/json", Authorization: apiKey } },
    { maxAge: TMDB_TTL, category: "tvContent", forceRefresh },
  );
  // Çevrimdışıyken ve cache boşken cachedRead null döner. Bunu "sıradaki bölüm
  // yok" saymak yanlış olurdu; çağıran hata sayacını işletsin diye fırlatıyoruz.
  if (!data) throw new Error(`upNext: veri alınamadı (${path})`);
  return data;
}

/**
 * İzleme ilerlemesinden sonraki ilk bölümü çözer. Önce mevcut sezonu, sonra
 * ilerideki sezonları dener; ilk yayınlanmış bölüm önceliklidir. Yalnızca
 * gelecekteki bölüm varsa onu "yakında" olarak döndürür. Dönen bölümün
 * `nextUp` alanı, kendisinden sonraki bölümü hazırda tutar.
 */
export async function resolveUpNextEpisode(
  show,
  {
    apiKey,
    language,
    now,
    lookahead = DEFAULT_LOOKAHEAD,
    forceRefresh = false,
  } = {}
) {
  if (!show?.id || !apiKey) return null;

  const fetchOptions = { apiKey, language, forceRefresh };
  const details = await fetchTmdb(`/tv/${show.id}`, fetchOptions);
  const seasonNumbers = getUpNextSeasonNumbers(show, details);
  const seasonCache = new Map();

  const loadSeason = async (seasonNumber) => {
    if (!seasonCache.has(seasonNumber)) {
      seasonCache.set(
        seasonNumber,
        await fetchTmdb(`/tv/${show.id}/season/${seasonNumber}`, fetchOptions)
      );
    }
    return seasonCache.get(seasonNumber);
  };

  const buildItem = (candidate, seasonNumber, seasonDetails) => ({
    id: `${show.id}:${seasonNumber}:${candidate.episodeNumber}`,
    showId: show.id,
    showName: details.name || show.name || "",
    showPosterPath: details.poster_path || show.imagePath || null,
    showEpisodeCount: details.number_of_episodes || show.showEpisodeCount || 0,
    showSeasonCount: details.number_of_seasons || show.showSeasonCount || 0,
    genres: (details.genres || show.genres || [])
      .map((genre) => (typeof genre === "string" ? genre : genre?.name))
      .filter(Boolean),
    seasonNumber,
    seasonPosterPath: seasonDetails.poster_path || null,
    seasonEpisodes: seasonDetails.episodes?.length || 0,
    episodeNumber: candidate.episodeNumber,
    episodeName: candidate.name || "",
    episodePosterPath: candidate.still_path || null,
    episodeRatings: candidate.vote_average || 0,
    episodeMinutes: candidate.runtime || details.episode_run_time?.[0] || 0,
    airDate: candidate.air_date || null,
    overview: candidate.overview || "",
    isAired: candidate.isAired,
    watchedEpisodeCount: show.watchedEpisodeCount || 0,
    // Kart sırası belge eklenme tarihine değil, gerçek son izleme olayına
    // dayanır. Timestamp/string ayrımını ortak watchState yardımcısı çözer.
    activityTime: getWatchedShowActivityTime(show),
    nextUp: null,
  });

  // `maxFetches` yalnızca ön yükleme adımlarında kullanılır: hazırda tutulan
  // bölüm uğruna sezon sezon istek atılmasın diye tarama önbellekteki
  // sezonlarla ve en fazla bir yeni sezonla sınırlanır.
  const findAfter = async (afterOrder, maxFetches = Infinity) => {
    let upcoming = null;
    let fetches = 0;
    for (const seasonNumber of seasonNumbers) {
      if (!seasonCache.has(seasonNumber)) {
        if (fetches >= maxFetches) break;
        fetches += 1;
      }
      const seasonDetails = await loadSeason(seasonNumber);
      const candidate = findNextEpisodeInSeason({
        show,
        seasonNumber,
        episodes: seasonDetails.episodes,
        now,
        afterOrder,
      });
      if (!candidate) continue;

      const resolved = buildItem(candidate, seasonNumber, seasonDetails);
      if (resolved.isAired) return resolved;
      if (!upcoming) upcoming = resolved;
    }
    return upcoming;
  };

  let head = null;
  let tail = null;
  let afterOrder;

  for (let step = 0; step <= Math.max(0, lookahead); step += 1) {
    let resolved = null;
    try {
      resolved = await findAfter(afterOrder, step === 0 ? Infinity : 1);
    } catch (error) {
      // Asıl bölüm çözülemediyse hata yukarı taşınır; ön yükleme en iyi çabadır.
      if (step === 0) throw error;
      break;
    }
    if (!resolved) break;

    if (tail) tail.nextUp = resolved;
    else head = resolved;
    tail = resolved;

    // Yayınlanmamış bölüm işaretlenemeyeceği için zincirin devamı gereksiz.
    if (!resolved.isAired) break;
    afterOrder = getEpisodeOrder(resolved.seasonNumber, resolved.episodeNumber);
  }

  return head;
}

/**
 * Paylaşılan çözümleme önbelleğinin anahtarı. Bir dizinin sıradaki bölümü
 * yalnızca izleme ilerlemesi ya da dil değişince başkalaşır; bu yüzden anahtar
 * "en ileri izlenen konum + izlenen bölüm sayısı" üzerine kurulu. Bölüm
 * işaretlenince anahtar kendiliğinden geçersizleşir.
 */
const resolutionKey = (show, language) =>
  show?.id == null
    ? null
    : [
        show.id,
        language || "",
        getFurthestWatchedPosition(show).order,
        getWatchedEpisodeCount(show),
      ].join("|");

/** Test ve oturum kapatma için: paylaşılan çözümlemeleri unut. */
export function clearUpNextResolutionCache() {
  resolutionCache.clear();
}

/**
 * `resolveUpNextEpisode`in paylaşımlı sarmalayıcısı. Ray ve Sıradaki ekranı
 * aynı diziyi istediğinde ikincisi hazır sonucu alır.
 *
 * @param {object} show
 * @param {object} [options] resolveUpNextEpisode seçenekleri + `refresh`
 * @param {boolean} [options.refresh] önbelleği atla, TMDB'ye yeniden git
 */
export function resolveUpNextEpisodeCached(show, options = {}) {
  const { refresh = false, ...rest } = options;
  const key = resolutionKey(show, rest.language);
  if (!key) return resolveUpNextEpisode(show, rest);

  const cached = resolutionCache.get(key);
  if (!refresh && cached && Date.now() - cached.at < RESOLUTION_TTL) {
    return cached.promise;
  }

  const promise = resolveUpNextEpisode(show, {
    ...rest,
    forceRefresh: refresh,
  }).catch((error) => {
    // Hatalı sonuç saklanmaz: bir sonraki deneme yeniden ağa çıkabilsin.
    if (resolutionCache.get(key)?.promise === promise) {
      resolutionCache.delete(key);
    }
    throw error;
  });

  resolutionCache.set(key, { at: Date.now(), promise });
  // Map ekleme sırasını koruduğu için en eski kayıt baştan düşer.
  while (resolutionCache.size > RESOLUTION_LIMIT) {
    resolutionCache.delete(resolutionCache.keys().next().value);
  }
  return promise;
}

export async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, limit), items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        try {
          results[index] = await mapper(items[index], index);
        } catch {
          results[index] = null;
        }
      }
    }
  );
  await Promise.all(workers);
  return results;
}
