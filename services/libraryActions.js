// services/libraryActions.js
//
// "Listeye ekle / çıkar" ve "izlendi işaretle / geri al" için TEK kapı.
// Ekranlar yazma servislerini (listItemsService, watchedTvService) DOĞRUDAN
// çağırmaz; buradan geçer. Servisler depolama ve muhasebeyi bilir, bu katman
// "işlem sürerken ve ters giderse ne olur"u bilir:
//
//   1. SIRA        Aynı esere ait işlemler art arda çalışır (utils/libraryCore
//                  createKeyedQueue). Hızlı ekle→çıkar, art arda bölüm işaretleme
//                  artık yarışmaz; sonuç dokunuş sırasını izler.
//   2. İYİMSER     İşlemin niyeti anında statusIndex'in üstüne bindirilir
//                  (services/libraryOverlay) — o eseri gösteren HER ekran aynı
//                  anda güncellenir. Favori/izlenecek yerel listesi de anında
//                  yazılır; hata olursa eski hâline döner.
//   3. HATA        Katmandan çıkan her hata `LibraryError`dır (kararlı `code`).
//                  Ekran `error.message`'ı değil kodu yerelleştirir
//                  (utils/libraryErrorText).
//   4. KAPILAR     Yayınlanmamış içerik, geçersiz tarih gibi kapılar ağa/yazıma
//                  çıkmadan ÖNCE kontrol edilir; bindirme hiç açılmaz, sezonlar
//                  boşuna çekilmez.
//   5. GÜNLÜK SINIR Bir güne en fazla 1440 dk izleme yazılır (utils/dailyWatchLimit).
//                  Film / tek bölüm sığmazsa DAILY_LIMIT fırlatılır; sezon / dizi
//                  sığmazsa bölümler sırayla günlere yayılır ve sonuçta `spread`
//                  döner. Denetim kullanıcı başına TEK sırada, yazımla birlikte
//                  yapılır: iki eşzamanlı işlem aynı günün son dakikasını paylaşamaz.
//
// Bu dosya Firestore'a doğrudan dokunmaz.

import {
  LIBRARY_ERROR,
  LibraryError,
  MEMBERSHIP_FLAG,
  createKeyedQueue,
  isCustomListName,
  isMembershipList,
  mediaKey,
  normalizeMediaType,
  showMetaFromDetails,
  toLibraryError,
} from "../utils/libraryCore";
import { normalizeWatchDate } from "../utils/watchHistory";
import { MAX_SPREAD_DAYS, dayUsage, planDailyWatch } from "../utils/dailyWatchLimit";
import { assertWatchable } from "../utils/watchState";
import {
  addItemsToList,
  addToCustomRootList,
  addToList,
  markMovieWatch,
  normalizeItem,
  removeFromCustomRootList,
  removeFromList,
  removeMovieWatchEvent,
  removeWatchedMovie,
  reorderCustomRootList,
} from "./listItemsService";
import {
  markEpisodes,
  markSeason,
  markShow,
  removeTvWatchEvent,
  unmarkShow,
} from "./watchedTvService";
import { deleteLocalItem, getLocalList, updateLocalItem } from "./listSyncService";
import { beginOverlay, failOverlay, settleOverlay } from "./libraryOverlay";
import { fetchSeasonEpisodes, fetchShowSeasons } from "./showSeasons";

const queue = createKeyedQueue();

/** Bir esere ait TÜM işlemler (üyelik, izleme, geri alma) tek sırada. */
const itemKey = (uid, type, id) => `${uid}:${mediaKey(type, id)}`;
/** Özel listeler kök dokümanın dizi alanlarında: tek kullanıcının hepsi tek sırada. */
const customListsKey = (uid) => `${uid}:custom-lists`;

const invalid = (message) => new LibraryError(LIBRARY_ERROR.INVALID, message);

// ── Günlük izleme sınırı (1440 dk) ───────────────────────────────────────────

/** Tüm izleme yazımları kullanıcı başına tek sırada: denetim ile yazım arası boşluk kalmaz. */
const watchDaysKey = (uid) => `${uid}:watch-days`;

/** İzlenen film + dizi olaylarından gün → dakika haritası (yerel kopya, ağ yok). */
const currentUsage = (uid) =>
  dayUsage({
    watchedMovies: getLocalList(uid, "watchedMovies"),
    watchedTv: getLocalList(uid, "watchedTv"),
  });

function dailyLimitError(plan) {
  return new LibraryError(LIBRARY_ERROR.DAILY_LIMIT, "Günlük 1440 dakikalık izleme sınırı", {
    details: {
      reason: plan.reason,
      day: plan.day,
      used: plan.used,
      remaining: plan.remaining,
      requested: plan.requested,
      days: MAX_SPREAD_DAYS,
    },
  });
}

/** Tek bir film / bölüm o güne sığmıyorsa DAILY_LIMIT fırlatır (yayılma yok). */
function assertFitsDay(uid, watchDate, minutes) {
  const plan = planDailyWatch({
    items: [{ minutes }],
    watchDate,
    usage: currentUsage(uid),
    allowSpread: false,
  });
  if (!plan.ok) throw dailyLimitError(plan);
}

/**
 * Toplu ekleme (sezon / dizi) için servise verilen planlayıcı: sığmazsa günlere
 * yayar, `MAX_SPREAD_DAYS`ı da aşarsa fırlatır (HİÇBİR ŞEY yazılmaz). Planı `sink`e bırakır.
 */
function spreadPlanner(uid, watchDate, sink) {
  return (items) => {
    const plan = planDailyWatch({ items, watchDate, usage: currentUsage(uid) });
    if (!plan.ok) throw dailyLimitError(plan);
    sink.plan = plan;
    return plan.chunks;
  };
}

/** Sonuçta dönen yayılma özeti (yayılmadıysa null). */
const spreadOf = (plan) =>
  plan?.spread
    ? { days: plan.chunks.length, startDate: plan.startDate, endDate: plan.endDate }
    : null;

/**
 * İşi sıraya koyar; bitince bindirmeyi bırakır, hatayı sınıflayıp yeniden fırlatır.
 * `token` 0 ise (bindirme yok) settle/fail zararsız no-op.
 */
function enqueue(key, token, task) {
  return queue.run(key, async () => {
    try {
      const result = await task();
      settleOverlay(token);
      return result;
    } catch (error) {
      failOverlay(token);
      throw toLibraryError(error);
    }
  });
}

/**
 * Kapı kontrolleri SENKRON fırlatsa bile çağıran her zaman reddedilmiş bir promise
 * görür (`try/await` ile yakalanabilir) ve hata her koldan `LibraryError` çıkar.
 */
function guarded(fn) {
  try {
    return Promise.resolve(fn()).catch((error) => {
      throw toLibraryError(error);
    });
  } catch (error) {
    return Promise.reject(toLibraryError(error));
  }
}

function requireWatchDate(watchDate) {
  if (!normalizeWatchDate(watchDate)) throw invalid("Geçersiz izleme tarihi");
}

// ── Üyelik listeleri: favoriler / izlenecekler / özel listeler ───────────────

/**
 * Bir eseri listeye ekler ya da listeden çıkarır — İSTENEN durum verilir, "tersine
 * çevir" DEĞİL. Çağıran ekran hedefi görünen (bindirmeli) durumdan hesaplar;
 * böylece art arda iki dokunuş ekle→çıkar olur, ekle→ekle olmaz.
 *
 * @param {object}  p
 * @param {string}  p.uid
 * @param {string}  p.listKey  "favorites" | "watchList" | özel liste adı
 * @param {object}  p.item     liste öğesi ({ id, type, name, imagePath, … }); çıkarmada { id, type } yeter
 * @param {boolean} p.desired  true = listede olsun
 * @returns {Promise<{status:"added"|"removed"|"unchanged", item:object}>}
 */
export function setListMembership({ uid, listKey, item, desired }) {
  return guarded(() => {
    if (!uid) throw invalid("setListMembership: uid yok");
    if (!listKey) throw invalid("setListMembership: liste yok");
    if (item?.id == null) throw invalid("setListMembership: öğe yok");
    const type = normalizeMediaType(item.type);
    const entry = { ...item, type };
    const want = !!desired;

    // Özel liste: kök dokümanda dizi; yerel harita yok, bindirme yok (statusIndex'te
    // `isInOtherLists` TÜM özel listelerin bileşkesi — tek bir listeden çıkarmak
    // bayrağı belirlemez). Hepsi tek sırada: aynı kök dokümanı okuyup yazıyorlar.
    if (!isMembershipList(listKey)) {
      if (!isCustomListName(listKey)) {
        throw new LibraryError(LIBRARY_ERROR.LIST_RESERVED, `"${listKey}" bir özel liste değil`);
      }
      return enqueue(customListsKey(uid), 0, async () => {
        if (want) {
          const added = await addToCustomRootList(uid, listKey, entry);
          return { status: added ? "added" : "unchanged", item: entry };
        }
        const removed = await removeFromCustomRootList(uid, listKey, type, entry.id);
        return { status: removed ? "removed" : "unchanged", item: entry };
      });
    }

    const token = beginOverlay(uid, type, entry.id, { [MEMBERSHIP_FLAG[listKey]]: want });
    return enqueue(itemKey(uid, type, entry.id), token, async () => {
      const docKey = mediaKey(type, entry.id);
      const previous = getLocalList(uid, listKey)[docKey];

      // Liste ekranları yerel haritadan okur: sunucuyu beklemeden güncelle.
      if (want) {
        updateLocalItem(uid, listKey, docKey, {
          ...normalizeItem(entry),
          updatedAt: new Date().toISOString(),
        });
      } else {
        deleteLocalItem(uid, listKey, docKey);
      }

      try {
        if (want) await addToList(uid, listKey, entry);
        else await removeFromList(uid, listKey, type, entry.id);
      } catch (error) {
        // Yazım düştü: yerel harita eski hâline dönsün (ekran gerçeği göstersin).
        if (previous) updateLocalItem(uid, listKey, docKey, previous);
        else deleteLocalItem(uid, listKey, docKey);
        throw error;
      }
      return { status: want ? "added" : "removed", item: entry };
    });
  });
}

/**
 * Birçok eseri favorilere / izlenecekler listesine TEK işlemde ekler (CineSwipe
 * sepeti). Tek tek `setListMembership` çağırmaktan farkı: 100'lük parçalar hâlinde
 * tek transaction ve tek yerel yazım. Mevcut öğeler korunur, sayaç yalnız yeniler
 * için artar.
 *
 * @returns {Promise<{ added: number, existing: number }>}
 */
export function addManyToMembership({ uid, listKey, items }) {
  return guarded(() => {
    if (!uid) throw invalid("addManyToMembership: uid yok");
    if (!isMembershipList(listKey)) throw invalid("addManyToMembership: yalnız favorites/watchList");
    const entries = (Array.isArray(items) ? items : [])
      .filter((item) => item?.id != null)
      .map((item) => ({ ...item, type: normalizeMediaType(item.type) }));
    if (entries.length === 0) return Promise.resolve({ added: 0, existing: 0 });

    const flag = MEMBERSHIP_FLAG[listKey];
    const tokens = entries.map((entry) => beginOverlay(uid, entry.type, entry.id, { [flag]: true }));
    const release = (fn) => tokens.forEach((token) => fn(token));
    // Tek sıra: toplu yazım kendi içinde parçalara bölünür, birbirleriyle yarışmasın.
    return queue
      .run(`${uid}:bulk:${listKey}`, () => addItemsToList(uid, listKey, entries))
      .then(
        (result) => {
          release(settleOverlay);
          return result;
        },
        (error) => {
          release(failOverlay);
          throw error;
        },
      );
  });
}

/** Özel listede manuel sıra (ekrandaki nihai sıra: [{ id, type }, …]). */
export function reorderCustomList({ uid, listName, orderedItems }) {
  return guarded(() => {
    if (!uid || !isCustomListName(listName)) throw invalid("reorderCustomList: geçersiz liste");
    return enqueue(customListsKey(uid), 0, () =>
      reorderCustomRootList(uid, listName, orderedItems),
    );
  });
}

// ── İzlenen filmler ──────────────────────────────────────────────────────────

/**
 * Filmi izlendi işaretler (her çağrı bir izleme olayı — tekrar izleme desteklenir).
 * @param {object} p.movie  utils/libraryCore.movieWatchItemFromDetails çıktısı
 * @returns {Promise<{event:object}>}
 */
export function markMovieWatched({ uid, movie, watchDate }) {
  return guarded(() => {
    if (!uid || movie?.id == null) throw invalid("markMovieWatched: eksik parametre");
    requireWatchDate(watchDate);
    assertWatchable(movie.releaseDate, movie.status);

    const token = beginOverlay(uid, "movie", movie.id, { isWatched: true });
    return queue.run(watchDaysKey(uid), () =>
      enqueue(itemKey(uid, "movie", movie.id), token, async () => {
        assertFitsDay(uid, watchDate, movie.minutes);
        const event = await markMovieWatch(uid, { ...movie, type: "movie" }, watchDate);
        return { event };
      }),
    );
  });
}

/** Tek bir izleme olayını siler (son olayı silmek filmi izlenenlerden çıkarır). */
export function removeMovieWatch({ uid, movieId, eventId }) {
  return guarded(() => {
    if (!uid || movieId == null || !eventId) throw invalid("removeMovieWatch: eksik parametre");
    return enqueue(itemKey(uid, "movie", movieId), 0, async () => {
      await removeMovieWatchEvent(uid, movieId, eventId);
      return { status: "removed" };
    });
  });
}

// ── İzlenen diziler ──────────────────────────────────────────────────────────

/**
 * Tüm diziyi izlendi işaretler: sezonlar TMDB'den çekilir (biri düşerse işlem
 * HİÇ yazılmaz), sonra tek olay olarak yazılır.
 *
 * @param {object} p.details  TMDB /tv/{id} gövdesi (seasons[] dahil)
 * @returns {Promise<{status:"added"|"empty-show", event:object|null}>}
 */
export function markShowWatched({ uid, details, watchDate, apiKey, language }) {
  return guarded(() => {
    if (!uid || details?.id == null) throw invalid("markShowWatched: eksik parametre");
    requireWatchDate(watchDate);
    const showMeta = showMetaFromDetails(details);
    // Kapı AĞDAN ÖNCE: yayınlanmamış dizi için sezonları çekmenin anlamı yok.
    assertWatchable(showMeta.firstAirDate, showMeta.status);

    return fetchShowSeasons({ details, apiKey, language }).then((seasons) => {
      if (seasons.length === 0) return { status: "empty-show", event: null };
      const token = beginOverlay(uid, "tv", details.id, { isWatched: true });
      return queue.run(watchDaysKey(uid), () =>
        enqueue(itemKey(uid, "tv", details.id), token, async () => {
          const sink = { plan: null };
          const event = await markShow(uid, showMeta, seasons, watchDate, {
            planSchedule: spreadPlanner(uid, watchDate, sink),
          });
          // Hiçbir bölüm yayınlanmamışsa servis hiçbir şey yazmaz (null).
          return event
            ? { status: "added", event, spread: spreadOf(sink.plan) }
            : { status: "empty-show", event: null, spread: null };
        }),
      );
    });
  });
}

/**
 * Bir sezonu izlendi işaretler. Sezonun bölümleri burada çekilir.
 * @param {object} p.details  TMDB /tv/{id} gövdesi
 * @param {object} p.season   details.seasons[] girdisi ({ season_number, poster_path, episode_count })
 */
export function markSeasonWatched({ uid, details, season, watchDate, apiKey, language }) {
  return guarded(() => {
    if (!uid || details?.id == null || season?.season_number == null) {
      throw invalid("markSeasonWatched: eksik parametre");
    }
    requireWatchDate(watchDate);

    return fetchSeasonEpisodes({
      showId: details.id,
      seasonNumber: season.season_number,
      apiKey,
      language,
    }).then((episodes) => {
      if (episodes.length === 0) return { status: "empty-season", event: null };
      const token = beginOverlay(uid, "tv", details.id, { isWatched: true });
      return queue.run(watchDaysKey(uid), () =>
        enqueue(itemKey(uid, "tv", details.id), token, async () => {
          const sink = { plan: null };
          const event = await markSeason(
            uid,
            showMetaFromDetails(details),
            {
              seasonNumber: season.season_number,
              seasonPosterPath: season.poster_path || null,
              seasonEpisodes: season.episode_count,
            },
            episodes,
            watchDate,
            { planSchedule: spreadPlanner(uid, watchDate, sink) },
          );
          return {
            status: event ? "added" : "empty-season",
            event: event || null,
            spread: spreadOf(sink.plan),
          };
        }),
      );
    });
  });
}

/**
 * Tek bir bölümü izlendi işaretler. Bölüm/sezon/dizi meta'sını çağıran verir
 * (bölüm kartı, "Sıradaki" kuyruğu ve takvim farklı veri taşıyor).
 *
 * @param {object} p.showMeta    { id, name, showEpisodeCount, showSeasonCount, imagePath, genres }
 * @param {object} p.seasonMeta  { seasonNumber, seasonPosterPath, seasonEpisodes }
 * @param {object} p.episode     utils/libraryCore.episodeFromTmdb şekli (releaseDate alanı dahil)
 * @param {string} [p.source]    analitik kaynağı ("up_next" …)
 */
export function markEpisodeWatched({ uid, showMeta, seasonMeta, episode, watchDate, source }) {
  return guarded(() => {
    if (!uid || showMeta?.id == null || seasonMeta?.seasonNumber == null || !episode) {
      throw invalid("markEpisodeWatched: eksik parametre");
    }
    requireWatchDate(watchDate);

    const token = beginOverlay(uid, "tv", showMeta.id, { isWatched: true });
    return queue.run(watchDaysKey(uid), () =>
      enqueue(itemKey(uid, "tv", showMeta.id), token, async () => {
        assertFitsDay(uid, watchDate, episode.episodeMinutes);
        const event = await markEpisodes(uid, showMeta, seasonMeta, [episode], watchDate, {
          scope: "episode",
          ...(source ? { source } : {}),
        });
        return { status: event ? "added" : "empty-episode", event: event || null };
      }),
    );
  });
}

/** Tek bir dizi izleme olayını siler (bölüm, sezon ya da tüm dizi kaydı). */
export function removeTvWatch({ uid, showId, eventId }) {
  return guarded(() => {
    if (!uid || showId == null || !eventId) throw invalid("removeTvWatch: eksik parametre");
    return enqueue(itemKey(uid, "tv", showId), 0, async () => {
      await removeTvWatchEvent(uid, showId, eventId);
      return { status: "removed" };
    });
  });
}

// ── Listeden kaldırma (liste ekranı) ─────────────────────────────────────────

/**
 * Liste ekranındaki "listeden kaldır": hangi liste olduğuna göre DOĞRU geri alma
 * yolunu seçer. İzlenen film/dizide tüm izleme kaydı ve istatistik geri alınır;
 * favori/izlenecekte üyelik; özel listede dizi girdisi silinir.
 */
export function removeFromListAny({ uid, listName, type, id }) {
  return guarded(() => {
    if (!uid || !listName || id == null) throw invalid("removeFromListAny: eksik parametre");
    const kind = normalizeMediaType(type);

    if (listName === "watchedTv") {
      const token = beginOverlay(uid, "tv", id, { isWatched: false });
      return enqueue(itemKey(uid, "tv", id), token, async () => {
        await unmarkShow(uid, id);
        return { status: "removed" };
      });
    }
    if (listName === "watchedMovies") {
      const token = beginOverlay(uid, "movie", id, { isWatched: false });
      return enqueue(itemKey(uid, "movie", id), token, async () => {
        await removeWatchedMovie(uid, id);
        return { status: "removed" };
      });
    }
    return setListMembership({ uid, listKey: listName, item: { id, type: kind }, desired: false });
  });
}
