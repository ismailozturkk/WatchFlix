import { nestedSummaryFields } from "../utils/firestoreNestedFields";
// services/watchedTvService.js
//
// İzlenen DİZİLER için TEK yazma kaynağı. Kanonik model: HER DİZİ İÇİN TEK DOKÜMAN
//   Lists/{uid}/watchedTv/{showId}
//     id, name, showEpisodeCount, showSeasonCount, imagePath, addedShowDate,
//     genres[], type:"tv", listOrder, watchedSeasonCount, watchedEpisodeCount,
//     totalMinutes,
//     watchEvents:[{ id, watchedAt, scope, episodeKeys[], seasonNumbers[],
//                    episodeCount, seasonCount, minutes, recordedAt }],
//     seasons: [{ seasonNumber, seasonPosterPath, seasonEpisodes, addedSeasonDate,
//                 episodes:[{ episodeNumber, episodePosterPath, episodeName,
//                             episodeRatings, episodeMinutes, episodeWatchTime }] }]
// watchEvents üst düzeyde TEK kez saklanır. Bölüm geçmişi episodeKeys üzerinden
// türetilir; tam dizi tekrarında aynı olayı yüzlerce bölümün içine kopyalamayız.
//
// Sezonlar/bölümler doküman İÇİNE gömülüdür (ayrı alt-koleksiyon YOK): tek koleksiyon
// listener'ı (ListStatusContext, ProfileStatsContext) tüm detayı verir → istatistik ve
// liste ekranları ek okuma olmadan çalışır. Eski kök-dizi `watchedTv[]` modelinin
// problemi TÜM dizileri tek devasa array'de tutup her dokunuşta hepsini yeniden
// yazmaktı; burada yalnızca ilgili DİZİNİN dokümanı yazılır.
//
// Bölüm dizisi güncellemeleri `runTransaction` ile yapılır (oku→değiştir→yaz):
// aynı dizide eşzamanlı işaretlemede read-modify-write yarışı (veri kaybı) olmaz.

import {
  doc,
  runTransaction,
  writeBatch,
  deleteField,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  createWatchEventId,
  materializeTvWatchState,
  normalizeWatchDate,
} from "../utils/watchHistory";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";
import { trackFirestoreDelete } from "./usageTrackerService";
import { trackFirstContentActivation } from "./activationAnalytics";
import {
  assertWatchable,
  filterWatchableEpisodes,
} from "../utils/watchState";
import { LIBRARY_ERROR, LibraryError } from "../utils/libraryCore";
import { updateLocalItem, deleteLocalItem } from "./listSyncService";

// Doküman id şeması: `tv_${showId}` — TÜM liste öğesi koleksiyonlarıyla aynı
// (`${type}_${id}`). favorites/watchList film+dizi karışık tuttuğu için type
// prefix'i zorunlu; tutarlılık için watchedTv de aynı şemayı kullanır.
const showRef = (uid, showId) =>
  doc(db, "Lists", uid, "watchedTv", `tv_${showId}`);

function normalizeEpisode(ep, watchDate) {
  return {
    episodeNumber: ep.episodeNumber,
    episodePosterPath: ep.episodePosterPath || null,
    episodeName: ep.episodeName || "Unknown",
    episodeRatings: ep.episodeRatings || 0,
    episodeMinutes: ep.episodeMinutes || 0,
    episodeWatchTime: watchDate || ep.episodeWatchTime || null,
  };
}

const episodeKey = (seasonNumber, episodeNumber) =>
  `${Number(seasonNumber)}:${Number(episodeNumber)}`;

function appendWatchEvent(data, showMeta, seasonTargets, watchDate, scope) {
  const watchedAt = normalizeWatchDate(watchDate);
  if (!watchedAt) return null;
  const current = materializeTvWatchState({
    ...(data || {}),
    id: data?.id ?? showMeta?.id,
  });
  const event = {
    id: createWatchEventId(`tv_${showMeta?.id}`),
    watchedAt,
    scope,
    recordedAt: new Date().toISOString(),
    episodeKeys: [],
    seasonNumbers: [],
  };
  const seasons = current.seasons.map((season) => ({
    ...season,
    episodes: [...(season.episodes || [])],
  }));

  (seasonTargets || []).forEach(({ seasonMeta, episodes }) => {
    const seasonNumber = Number(seasonMeta.seasonNumber);
    let seasonIndex = seasons.findIndex(
      (season) => Number(season.seasonNumber) === seasonNumber,
    );
    if (seasonIndex === -1) {
      seasons.push({
        seasonNumber,
        seasonPosterPath: seasonMeta.seasonPosterPath || null,
        seasonEpisodes: seasonMeta.seasonEpisodes || episodes.length,
        addedSeasonDate: watchedAt,
        episodes: [],
      });
      seasonIndex = seasons.length - 1;
    }
    const season = seasons[seasonIndex];
    const byEpisode = new Map(
      (season.episodes || []).map((episode) => [Number(episode.episodeNumber), episode]),
    );
    (episodes || []).forEach((rawEpisode) => {
      if (rawEpisode?.episodeNumber == null) return;
      const normalized = normalizeEpisode(rawEpisode, watchedAt);
      const previous = byEpisode.get(Number(rawEpisode.episodeNumber));
      const { watchEvents: _previousEvents, ...previousCompact } = previous || {};
      byEpisode.set(Number(rawEpisode.episodeNumber), {
        ...normalized,
        ...previousCompact,
        episodePosterPath:
          previous?.episodePosterPath ?? normalized.episodePosterPath,
        episodeName: previous?.episodeName || normalized.episodeName,
        episodeRatings: previous?.episodeRatings || normalized.episodeRatings,
        episodeMinutes: previous?.episodeMinutes || normalized.episodeMinutes,
        episodeWatchTime: watchedAt,
      });
      event.episodeKeys.push(episodeKey(seasonNumber, rawEpisode.episodeNumber));
    });
    event.seasonNumbers.push(seasonNumber);
    seasons[seasonIndex] = {
      ...season,
      seasonPosterPath: season.seasonPosterPath ?? seasonMeta.seasonPosterPath ?? null,
      seasonEpisodes: season.seasonEpisodes || seasonMeta.seasonEpisodes || byEpisode.size,
      addedSeasonDate: season.addedSeasonDate || watchedAt,
      episodes: [...byEpisode.values()].sort(
        (a, b) => Number(a.episodeNumber) - Number(b.episodeNumber),
      ),
    };
  });

  event.episodeKeys = [...new Set(event.episodeKeys)];
  event.seasonNumbers = [...new Set(event.seasonNumbers)];
  event.episodeCount = event.episodeKeys.length;
  event.seasonCount = event.seasonNumbers.length;
  event.minutes = seasons.reduce(
    (total, season) => total + (season.episodes || []).reduce((sum, episode) =>
      event.episodeKeys.includes(episodeKey(season.seasonNumber, episode.episodeNumber))
        ? sum + (Number(episode.episodeMinutes) || 0)
        : sum,
    0),
    0,
  );
  seasons.sort((a, b) => Number(a.seasonNumber) - Number(b.seasonNumber));
  const compactSeasons = seasons.map((season) => ({
    ...season,
    episodes: (season.episodes || []).map(({ watchEvents: _events, ...episode }) => episode),
  }));
  return {
    event,
    seasons: compactSeasons,
    watchEvents: [...current.watchEvents, event],
  };
}

function recomputeAggregates(seasons) {
  let watchedEpisodeCount = 0;
  let totalMinutes = 0;
  seasons.forEach((s) => {
    const eps = s.episodes || [];
    watchedEpisodeCount += eps.length;
    totalMinutes += eps.reduce((a, e) => a + (e.episodeMinutes || 0), 0);
  });
  return {
    watchedSeasonCount: seasons.length,
    watchedEpisodeCount,
    totalMinutes,
  };
}

function mergeWatchEvents(...groups) {
  const byId = new Map();
  groups.flat().filter(Boolean).forEach((event) => {
    if (!event?.id) return;
    const previous = byId.get(event.id) || {};
    byId.set(event.id, {
      ...previous,
      ...event,
      episodeKeys: [...new Set([...(previous.episodeKeys || []), ...(event.episodeKeys || [])])],
      seasonNumbers: [...new Set([...(previous.seasonNumbers || []), ...(event.seasonNumbers || [])])],
    });
  });
  return [...byId.values()];
}

/**
 * watchedTv doküman girdilerini show id'sine göre TEKİLLEŞTİRİR (ikileme önleme).
 * Aynı dizi hem bare (`1399`) hem yeni (`tv_1399`) doküman olarak durduğunda
 * tek kayda indirir: `tv_` (yeni şema) önceliklidir, ikisi de aynıysa daha çok
 * bölümlü olan seçilir. Migration ikilemeyi kalıcı temizleyene kadar UI'da
 * çiftlenmeyi engeller. entries: [[docId, data], ...] → temiz data[] döner.
 */
export function dedupeWatchedTvEntries(entries) {
  const byId = new Map();
  (entries || []).forEach(([docId, data]) => {
    if (!data) return;
    const bareId = String(docId).replace(/^tv_/, "");
    const id = data.id ?? bareId;
    const key = String(id);
    const isTv = String(docId).startsWith("tv_");
    const cur = { ...data, id, _isTv: isTv };
    const prev = byId.get(key);
    if (!prev) {
      byId.set(key, cur);
      return;
    }
    const epCount = (x) =>
      (x.seasons || []).reduce((a, s) => a + (s.episodes?.length || 0), 0);
    const kazanan = (isTv && !prev._isTv) || (isTv === prev._isTv && epCount(cur) > epCount(prev))
      ? cur : prev;
    const kaybeden = kazanan === cur ? prev : cur;
    // Kazananı OLDUĞU GİBİ almak metadata kaybettiriyordu: göç sırasında
    // üretilen `tv_` dokümanı yalnızca sezon/bölüm taşıyabiliyor (name, genres,
    // imagePath, showEpisodeCount boş). Kazanan `tv_` olduğu için dizi adsız,
    // türsüz ve "showEpisodeCount: 0" kalıyor — yani hem listede isimsiz
    // görünüyor hem de tür puanına ve dizi bitirme bonusuna hiç giremiyor.
    // Bölümler kazanandan gelir, EKSİK üst düzey alanlar diğerinden doldurulur.
    const birlesik = { ...kazanan };
    for (const alan of ["name", "imagePath", "genres", "showEpisodeCount", "showSeasonCount", "addedShowDate", "dateAdded", "listOrder"]) {
      const bos = birlesik[alan] == null
        || birlesik[alan] === ""
        || birlesik[alan] === 0
        || (Array.isArray(birlesik[alan]) && birlesik[alan].length === 0);
      if (bos && kaybeden[alan] != null) birlesik[alan] = kaybeden[alan];
    }
    birlesik.watchEvents = mergeWatchEvents(
      kazanan.watchEvents || [],
      kaybeden.watchEvents || [],
    );
    byId.set(key, birlesik);
  });
  // `id` her zaman BARE (öneksiz) ve STRING döner: tüketiciler bunu Set
  // karşılaştırmasında ve keyExtractor'da kullanıyor, tip kayması iki kaydı
  // yeniden ayrıştırırdı.
  return [...byId.values()].map(({ _isTv, ...s }) => ({ ...s, id: String(s.id) }));
}

function buildShowMeta(showMeta, watchDate) {
  return {
    id: showMeta.id,
    name: showMeta.name || "",
    showEpisodeCount: showMeta.showEpisodeCount || 0,
    showSeasonCount: showMeta.showSeasonCount || 0,
    imagePath: showMeta.imagePath || null,
    addedShowDate: watchDate || null,
    genres: showMeta.genres || [],
    type: "tv",
  };
}

/**
 * Ortak yazma çekirdeği: bir dizi için verilen sezon/bölüm hedeflerini TEK
 * olay olarak ekler (transaction; bölümler episodeNumber'a göre tekilleşir).
 *
 * `markEpisodes` (tek bölüm / sezon) ile `markShow` (tüm dizi) eskiden bu
 * gövdeyi birebir kopyalıyordu; ikisinin sapması (ör. biri kök özeti, diğeri
 * yerel önbelleği unutursa) izleme sayaçlarını sessizce bozardı. Şimdi tek yer.
 *
 * @returns {Promise<object|null>} oluşturulan izleme olayı
 */
async function commitWatch(uid, showMeta, targets, watchDate, scope) {
  const ref = showRef(uid, showMeta.id);
  const rootRef = doc(db, "Lists", uid);
  const docKey = `tv_${showMeta.id}`;
  let createdEvent = null;
  let localDocument = null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : null;
    const result = appendWatchEvent(data, showMeta, targets, watchDate, scope);
    if (!result) return;
    createdEvent = result.event;

    const isFirstShowWatch = !snap.exists();
    const showData = {
      ...(snap.exists() ? {} : buildShowMeta(showMeta, watchDate)),
      ...(snap.exists() && !data?.name ? { name: showMeta.name || "" } : {}),
      // showEpisodeCount/showSeasonCount: yeni sezon çıktığında eski donmuş
      // değerin güncellenmesi için mevcut dokümanda da yazılır (Math.max →
      // dil farkından kaynaklanan düşük TMDB tutarsızlıkları eski değeri ezemez).
      ...(snap.exists() && showMeta.showEpisodeCount > 0
        ? {
            showEpisodeCount: Math.max(
              data?.showEpisodeCount || 0,
              showMeta.showEpisodeCount,
            ),
            showSeasonCount: Math.max(
              data?.showSeasonCount || 0,
              showMeta.showSeasonCount || 0,
            ),
          }
        : {}),
      seasons: result.seasons,
      watchEvents: result.watchEvents,
      watchCount: result.watchEvents.length,
      addedShowDate: data?.addedShowDate || normalizeWatchDate(watchDate),
      ...recomputeAggregates(result.seasons),
      updatedAt: serverTimestamp(),
    };
    localDocument = {
      ...data,
      ...showData,
      updatedAt: new Date().toISOString(),
    };

    tx.set(ref, showData, { merge: true });

    const rootUpdates = {
      [`statusIndex.tv.${showMeta.id}.isWatched`]: true,
      "stats.tv.episodes.total": increment(result.event.episodeCount),
      "stats.tv.totalMinutes": increment(result.event.minutes),
      "stats.totalMinutes": increment(result.event.minutes),
      updatedAt: serverTimestamp(),
      _schemaVersion: 3,
    };

    if (isFirstShowWatch) {
      rootUpdates["counts.watchedTv"] = increment(1);
      rootUpdates["stats.tv.shows.unique"] = increment(1);
      if (Array.isArray(showMeta.genres)) {
        showMeta.genres.forEach((genreId) => {
          if (genreId != null) {
            rootUpdates[`stats.genreCounts.${genreId}`] = increment(1);
          }
        });
      }
    }

    tx.set(rootRef, nestedSummaryFields(rootUpdates), { merge: true });
  });

  if (localDocument) updateLocalItem(uid, "watchedTv", docKey, localDocument);
  return createdEvent;
}

/** Geçersiz tarihle yazmak sessizce hiçbir şey yapmazdı; arayüz yine "başarılı" derdi. */
function assertWatchDate(watchDate) {
  if (normalizeWatchDate(watchDate)) return;
  throw new LibraryError(LIBRARY_ERROR.INVALID, "Geçersiz izleme tarihi");
}

/**
 * Bir sezona bir veya daha çok bölüm ekler (transaction; dedupe episodeNumber).
 * showMeta: { id, name, showEpisodeCount, showSeasonCount, imagePath, genres }
 * seasonMeta: { seasonNumber, seasonPosterPath, seasonEpisodes }
 */
export async function markEpisodes(
  uid,
  showMeta,
  seasonMeta,
  episodes,
  watchDate,
  options = {},
) {
  if (!uid || showMeta?.id == null || seasonMeta?.seasonNumber == null) return;
  if (!Array.isArray(episodes) || episodes.length === 0) return;
  const releasedEpisodes = filterWatchableEpisodes(episodes);
  if (releasedEpisodes.length === 0) {
    const first = episodes[0] || {};
    assertWatchable(first.releaseDate ?? first.airDate, first.status);
    return null;
  }
  assertWatchDate(watchDate);

  const scope = options.scope || "episode";
  const createdEvent = await commitWatch(
    uid,
    showMeta,
    [{ seasonMeta, episodes: releasedEpisodes }],
    watchDate,
    scope,
  );

  // markSeason da buraya delege ediyor; `scope` hangisi olduğunu ayırır.
  if (createdEvent) {
    trackEvent(ANALYTICS_EVENTS.CONTENT_TRACKED, {
      content_type: "tv",
      content_id: String(showMeta.id),
      scope,
      episode_count: releasedEpisodes.length,
      season_number: seasonMeta.seasonNumber,
    });
    trackFirstContentActivation(uid, {
      content_type: "tv",
      content_id: String(showMeta.id),
      source: options.source || scope,
    });
  }

  return createdEvent;
}

/** Bir sezonun tüm bölümlerini işaretler (markEpisodes wrapper'ı). */
export async function markSeason(uid, showMeta, seasonMeta, episodes, watchDate) {
  return markEpisodes(uid, showMeta, seasonMeta, episodes, watchDate, {
    scope: "season",
  });
}

/**
 * Diziyi komple işaretler (tüm sezonların bölümleriyle — üzerine yazar).
 */
export async function markShow(uid, showMeta, seasonsWithEpisodes, watchDate) {
  if (!uid || showMeta?.id == null || !Array.isArray(seasonsWithEpisodes)) return;
  assertWatchable(showMeta?.firstAirDate, showMeta?.status);
  const targets = seasonsWithEpisodes
    .filter((season) => season?.seasonNumber != null)
    .map((season) => ({
      seasonMeta: season,
      episodes: filterWatchableEpisodes(season.episodes),
    }))
    .filter((target) => target.episodes.length > 0);
  if (!targets.length) return null;
  assertWatchDate(watchDate);

  const createdEvent = await commitWatch(uid, showMeta, targets, watchDate, "show");

  if (createdEvent) {
    trackEvent(ANALYTICS_EVENTS.CONTENT_TRACKED, {
      content_type: "tv",
      content_id: String(showMeta.id),
      scope: "show",
      season_count: targets.length,
      episode_count: targets.reduce((sum, s) => sum + s.episodes.length, 0),
    });
    trackFirstContentActivation(uid, {
      content_type: "tv",
      content_id: String(showMeta.id),
      source: "show",
    });
  }

  return createdEvent;
}

/**
 * Tek bir izleme olayını dizi, sezon ve bölüm geçmişinden birlikte kaldırır.
 * Başka bir olayın da kapsadığı bölümler belgede kalır; yalnız bu olaya ait
 * bölümler son geçmiş kaydıyla birlikte temizlenir.
 */
export async function removeTvWatchEvent(uid, showId, eventId) {
  if (!uid || showId == null || !eventId) return;
  const ref = showRef(uid, showId);
  const rootRef = doc(db, "Lists", uid);
  const docKey = `tv_${showId}`;
  let nextLocalDocument = null;
  let shouldDeleteLocal = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const current = materializeTvWatchState({ ...data, id: data.id ?? showId });
    const removedEvent = current.watchEvents.find((event) => event.id === eventId);
    if (!removedEvent) return;

    const seasons = current.seasons
      .map((season) => ({
        ...season,
        episodes: (season.episodes || [])
          .map((episode) => {
            const watchEvents = (episode.watchEvents || []).filter(
              (event) => event.id !== eventId,
            );
            if (!watchEvents.length) return null;
            const latest = watchEvents
              .slice()
              .sort((a, b) =>
                String(b.watchedAt).localeCompare(String(a.watchedAt)),
              )[0];
            const { watchEvents: _storedEvents, ...compactEpisode } = episode;
            return { ...compactEpisode, episodeWatchTime: latest.watchedAt };
          })
          .filter(Boolean),
      }))
      .filter((season) => season.episodes.length);
    const watchEvents = current.watchEvents.filter((event) => event.id !== eventId);
    const removedMinutes = Number(removedEvent.minutes) || 0;
    const removedEpisodes = Number(removedEvent.episodeCount) || 0;

    const rootUpdates = {
      "stats.tv.episodes.total": increment(-removedEpisodes),
      "stats.tv.totalMinutes": increment(-removedMinutes),
      "stats.totalMinutes": increment(-removedMinutes),
      updatedAt: serverTimestamp(),
      _schemaVersion: 3,
    };

    if (!seasons.length || !watchEvents.length) {
      tx.delete(ref);
      rootUpdates[`statusIndex.tv.${showId}.isWatched`] = false;
      rootUpdates["counts.watchedTv"] = increment(-1);
      rootUpdates["stats.tv.shows.unique"] = increment(-1);
      if (Array.isArray(data.genres)) {
        data.genres.forEach((genreId) => {
          if (genreId != null) {
            rootUpdates[`stats.genreCounts.${genreId}`] = increment(-1);
          }
        });
      }
      tx.set(rootRef, nestedSummaryFields(rootUpdates), { merge: true });
      shouldDeleteLocal = true;
      return;
    }

    const next = {
      ...data,
      seasons: seasons.map((season) => {
        const { episodes, ...seasonMeta } = season;
        return {
          ...seasonMeta,
          episodes: episodes.map(({ watchEvents: _events, ...episode }) => episode),
        };
      }),
      watchEvents,
      watchCount: watchEvents.length,
      ...recomputeAggregates(seasons),
    };
    tx.update(ref, { ...next, updatedAt: serverTimestamp() });
    tx.set(rootRef, nestedSummaryFields(rootUpdates), { merge: true });
    nextLocalDocument = { ...next, updatedAt: new Date().toISOString() };
  });

  if (shouldDeleteLocal) deleteLocalItem(uid, "watchedTv", docKey);
  else if (nextLocalDocument) {
    updateLocalItem(uid, "watchedTv", docKey, nextLocalDocument);
  }
}

/** Dizinin tüm izlenme kaydını siler. */
export async function unmarkShow(uid, showId) {
  if (!uid || showId == null) return;
  const docKey = `tv_${showId}`;
  const ref = showRef(uid, showId);
  const rootRef = doc(db, "Lists", uid);
  let removed = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    removed = true;
    const data = snap.data() || {};
    const current = materializeTvWatchState({ ...data, id: data.id ?? showId });
    const removedEpisodes = current.watchEvents.reduce(
      (sum, event) => sum + (Number(event.episodeCount) || 0),
      0,
    );
    const removedMinutes = current.watchEvents.reduce(
      (sum, event) => sum + (Number(event.minutes) || 0),
      0,
    );
    const rootUpdates = {
      [`statusIndex.tv.${showId}.isWatched`]: false,
      "counts.watchedTv": increment(-1),
      "stats.tv.shows.unique": increment(-1),
      "stats.tv.episodes.total": increment(-removedEpisodes),
      "stats.tv.totalMinutes": increment(-removedMinutes),
      "stats.totalMinutes": increment(-removedMinutes),
      updatedAt: serverTimestamp(),
      _schemaVersion: 3,
    };
    if (Array.isArray(data.genres)) {
      data.genres.forEach((genreId) => {
        if (genreId != null) {
          rootUpdates[`stats.genreCounts.${genreId}`] = increment(-1);
        }
      });
    }
    tx.delete(ref);
    tx.set(rootRef, nestedSummaryFields(rootUpdates), { merge: true });
  });
  if (!removed) return;
  trackFirestoreDelete("watchedTv", 1);
  deleteLocalItem(uid, "watchedTv", docKey);
}

/**
 * İzlenen diziler ekranındaki manuel sırayı show belgelerinde saklar.
 *
 * Eski model tek bir watchedTv[] dizisini yeniden yazıyordu. Yeni modelde her
 * dizi ayrı belge olduğu için taşınan aralıktaki belgelerin `listOrder` alanı
 * batch ile güncellenir. İlk sıralamada eski belgelerde listOrder bulunmuyorsa
 * bütün liste bir kez normalize edilir.
 */
export async function reorderWatchedShows(
  uid,
  orderedShows,
  fromIndex,
  toIndex,
) {
  if (!uid || !Array.isArray(orderedShows) || orderedShows.length === 0) return;

  const hasCompleteOrder = orderedShows.every((show) =>
    Number.isFinite(show?.listOrder),
  );
  const start = hasCompleteOrder ? Math.min(fromIndex, toIndex) : 0;
  const end = hasCompleteOrder
    ? Math.max(fromIndex, toIndex)
    : orderedShows.length - 1;
  const writes = orderedShows
    .map((show, index) => ({ id: show?.id, index }))
    .filter(({ id, index }) => id != null && index >= start && index <= end);

  // Firestore batch limiti 500; güvenli pay bırakarak büyük listeleri böl.
  const CHUNK_SIZE = 450;
  for (let offset = 0; offset < writes.length; offset += CHUNK_SIZE) {
    const batch = writeBatch(db);
    writes.slice(offset, offset + CHUNK_SIZE).forEach(({ id, index }) => {
      batch.update(showRef(uid, id), { listOrder: index });
    });
    await batch.commit();
  }
}

/**
 * Eski kök-dizi modelindeki ({ ..., seasons:[{ seasonNumber, episodes:[...] }] })
 * tek bir diziyi tek-doküman modeline taşır — YALNIZ yeni modelde belgesi
 * olmayanlar için.
 *
 * Eskiden merge'siz `setDoc` yapıyordu ve göç sonrası kök dizi silinmediği için
 * ListStatusContext her açılışta aynı diziyi eski verisiyle yeniden yazıyordu:
 * eski kökten gelen hesaplarda sonradan işaretlenen bölümler ve izleme olayları
 * her oturumda sıfırlanıyordu. Artık belge varsa dokunulmaz (transaction).
 *
 * @returns {Promise<boolean>} bu çağrı yazdıysa true
 */
export async function migrateLegacyShow(uid, legacyShow) {
  if (!uid || legacyShow?.id == null || !Array.isArray(legacyShow.seasons)) return false;
  const seasons = [];
  for (const sea of legacyShow.seasons) {
    if (sea?.seasonNumber == null) continue;
    const eps = (sea.episodes || []).map((e) => ({
      episodeNumber: e.episodeNumber,
      episodePosterPath: e.episodePosterPath || null,
      episodeName: e.episodeName || "Unknown",
      episodeRatings: e.episodeRatings || 0,
      episodeMinutes: e.episodeMinutes || 0,
      episodeWatchTime:
        e.episodeWatchTime || sea.addedSeasonDate || legacyShow.addedShowDate || null,
    }));
    if (eps.length === 0) continue;
    seasons.push({
      seasonNumber: sea.seasonNumber,
      seasonPosterPath: sea.seasonPosterPath || null,
      seasonEpisodes: sea.seasonEpisodes || eps.length,
      addedSeasonDate: sea.addedSeasonDate || legacyShow.addedShowDate || null,
      episodes: eps.sort((a, b) => a.episodeNumber - b.episodeNumber),
    });
  }
  if (seasons.length === 0) return false; // taşınacak gerçek veri yok
  seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

  const ref = showRef(uid, legacyShow.id);
  let migrated = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return; // yeni modelde zaten var: eski veriyle EZME
    tx.set(ref, {
      ...buildShowMeta(
        {
          id: legacyShow.id,
          name: legacyShow.name,
          showEpisodeCount: legacyShow.showEpisodeCount,
          showSeasonCount: legacyShow.showSeasonCount,
          imagePath: legacyShow.imagePath,
          genres: legacyShow.genres,
        },
        legacyShow.addedShowDate || null,
      ),
      seasons,
      ...recomputeAggregates(seasons),
    });
    migrated = true;
  });
  return migrated;
}

/**
 * Göç tamamlandıktan sonra kök dokümandaki eski `watchedTv[]` dizisini siler
 * (`migrateLegacyMovieLists` öntanımlı film listeleri için aynısını yapıyor).
 * Silinmezse her açılışta yeniden göç denenir. Yalnız alan GERÇEKTEN dizi ise
 * dokunur; alan yoksa/başka tipteyse hiçbir şey yazmaz.
 *
 * @returns {Promise<boolean>} alan silindiyse true
 */
export async function clearLegacyWatchedTv(uid) {
  if (!uid) return false;
  const rootRef = doc(db, "Lists", uid);
  let cleared = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(rootRef);
    if (!snap.exists() || !Array.isArray(snap.data()?.watchedTv)) return;
    tx.update(rootRef, { watchedTv: deleteField() });
    cleared = true;
  });
  return cleared;
}
