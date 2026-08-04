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
  collection,
  runTransaction,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  createWatchEventId,
  materializeTvWatchState,
  normalizeWatchDate,
} from "../utils/watchHistory";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";
import { trackFirstContentActivation } from "./activationAnalytics";

// Doküman id şeması: `tv_${showId}` — TÜM liste öğesi koleksiyonlarıyla aynı
// (`${type}_${id}`). favorites/watchList film+dizi karışık tuttuğu için type
// prefix'i zorunlu; tutarlılık için watchedTv de aynı şemayı kullanır.
const showRef = (uid, showId) =>
  doc(db, "Lists", uid, "watchedTv", `tv_${showId}`);
// Eski ayrı seasons alt-koleksiyonu BARE id altındaydı (`watchedTv/${id}/seasons`);
// legacy okuma için bare path korunur (migrateSeasonSubdocs).
const seasonsCol = (uid, showId) =>
  collection(db, "Lists", uid, "watchedTv", String(showId), "seasons");

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

// İki sezon dizisini BİRLEŞTİRİR (seasonNumber'a göre; bölümler episodeNumber
// union'ı). İkilenen bare+tv_ doküman birleştirmesinde veri kaybını önler.
function mergeSeasons(a, b) {
  const bySeason = new Map();
  [...(a || []), ...(b || [])].forEach((s) => {
    if (!s || s.seasonNumber == null) return;
    const existing = bySeason.get(s.seasonNumber);
    if (!existing) {
      bySeason.set(s.seasonNumber, { ...s, episodes: [...(s.episodes || [])] });
      return;
    }
    const epNums = new Set(existing.episodes.map((e) => e.episodeNumber));
    (s.episodes || []).forEach((e) => {
      if (!epNums.has(e.episodeNumber)) {
        existing.episodes.push(e);
        epNums.add(e.episodeNumber);
      } else {
        const episodeIndex = existing.episodes.findIndex(
          (episode) => episode.episodeNumber === e.episodeNumber,
        );
        const previousEpisode = existing.episodes[episodeIndex];
        existing.episodes[episodeIndex] = {
          ...e,
          ...previousEpisode,
          watchEvents: mergeWatchEvents(
            previousEpisode?.watchEvents || [],
            e?.watchEvents || [],
          ),
        };
      }
    });
    existing.seasonPosterPath =
      existing.seasonPosterPath ?? s.seasonPosterPath ?? null;
    existing.seasonEpisodes =
      existing.seasonEpisodes || s.seasonEpisodes || existing.episodes.length;
    existing.addedSeasonDate =
      existing.addedSeasonDate || s.addedSeasonDate || null;
  });
  return [...bySeason.values()]
    .map((s) => ({
      ...s,
      episodes: (s.episodes || []).sort((x, y) => x.episodeNumber - y.episodeNumber),
    }))
    .sort((x, y) => x.seasonNumber - y.seasonNumber);
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
  const ref = showRef(uid, showMeta.id);
  let createdEvent = null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : null;
    const result = appendWatchEvent(
      data,
      showMeta,
      [{ seasonMeta, episodes }],
      watchDate,
      options.scope || "episode",
    );
    if (!result) return;
    createdEvent = result.event;

    tx.set(
      ref,
      {
        ...(snap.exists() ? {} : buildShowMeta(showMeta, watchDate)),
        ...(snap.exists() && !data.name ? { name: showMeta.name || "" } : {}),
        seasons: result.seasons,
        watchEvents: result.watchEvents,
        watchCount: result.watchEvents.length,
        addedShowDate: data?.addedShowDate || normalizeWatchDate(watchDate),
        ...recomputeAggregates(result.seasons),
      },
      { merge: true },
    );
  });

  // markSeason da buraya delege ediyor; `scope` hangisi olduğunu ayırır.
  // (markShow ayrı bir transaction kuruyor, kendi olayını kendisi gönderir.)
  if (createdEvent) {
    trackEvent(ANALYTICS_EVENTS.CONTENT_TRACKED, {
      content_type: "tv",
      content_id: String(showMeta.id),
      scope: options.scope || "episode",
      episode_count: episodes.length,
      season_number: seasonMeta.seasonNumber,
    });
    trackFirstContentActivation(uid, {
      content_type: "tv",
      content_id: String(showMeta.id),
      source: options.source || options.scope || "episode",
    });
  }

  return createdEvent;
}

/** Tek bir bölümün işaretini kaldırır (boş sezon→çıkar, son bölüm→show'u sil). */
export async function unmarkEpisode(uid, showId, seasonNumber, episodeNumber) {
  if (!uid || showId == null || seasonNumber == null) return;
  const ref = showRef(uid, showId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const seasons = snap.data().seasons || [];
    const idx = seasons.findIndex((s) => s.seasonNumber === seasonNumber);
    if (idx === -1) return;

    const remainingEps = (seasons[idx].episodes || []).filter(
      (e) => e.episodeNumber !== episodeNumber,
    );
    if (remainingEps.length === (seasons[idx].episodes || []).length) return; // yok

    let newSeasons;
    if (remainingEps.length === 0) {
      newSeasons = seasons.filter((s) => s.seasonNumber !== seasonNumber);
    } else {
      newSeasons = seasons.map((s, i) =>
        i === idx ? { ...s, episodes: remainingEps } : s,
      );
    }

    if (newSeasons.length === 0) {
      tx.delete(ref);
      return;
    }
    tx.update(ref, {
      seasons: newSeasons,
      ...recomputeAggregates(newSeasons),
    });
  });
}

/** Bir sezonun tüm bölümlerini işaretler (markEpisodes wrapper'ı). */
export async function markSeason(uid, showMeta, seasonMeta, episodes, watchDate) {
  return markEpisodes(uid, showMeta, seasonMeta, episodes, watchDate, {
    scope: "season",
  });
}

/** Bir sezonun işaretini komple kaldırır. */
export async function unmarkSeason(uid, showId, seasonNumber) {
  if (!uid || showId == null || seasonNumber == null) return;
  const ref = showRef(uid, showId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const seasons = snap.data().seasons || [];
    const newSeasons = seasons.filter((s) => s.seasonNumber !== seasonNumber);
    if (newSeasons.length === seasons.length) return; // yok

    if (newSeasons.length === 0) {
      tx.delete(ref);
      return;
    }
    tx.update(ref, {
      seasons: newSeasons,
      ...recomputeAggregates(newSeasons),
    });
  });
}

/**
 * Diziyi komple işaretler (tüm sezonların bölümleriyle — üzerine yazar).
 * seasonsWithEpisodes: [{ seasonNumber, seasonPosterPath, seasonEpisodes, episodes:[...] }]
 */
export async function markShow(uid, showMeta, seasonsWithEpisodes, watchDate) {
  if (!uid || showMeta?.id == null || !Array.isArray(seasonsWithEpisodes)) return;
  const targets = seasonsWithEpisodes
    .filter((season) => season?.seasonNumber != null && (season.episodes || []).length)
    .map((season) => ({ seasonMeta: season, episodes: season.episodes }));
  if (!targets.length) return null;
  const ref = showRef(uid, showMeta.id);
  let createdEvent = null;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : null;
    const result = appendWatchEvent(data, showMeta, targets, watchDate, "show");
    if (!result) return;
    createdEvent = result.event;
    tx.set(ref, {
      ...(snap.exists() ? {} : buildShowMeta(showMeta, watchDate)),
      ...(snap.exists() && !data.name ? { name: showMeta.name || "" } : {}),
      seasons: result.seasons,
      watchEvents: result.watchEvents,
      watchCount: result.watchEvents.length,
      addedShowDate: data?.addedShowDate || normalizeWatchDate(watchDate),
      ...recomputeAggregates(result.seasons),
    }, { merge: true });
  });

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
 * Tam dizi olayı bölüm ekranından silinse dahi aynı occurrence'ın bütün
 * bölümleri birlikte kaldırılır; böylece istatistiklerde yarım olay kalmaz.
 */
export async function removeTvWatchEvent(uid, showId, eventId) {
  if (!uid || showId == null || !eventId) return;
  const ref = showRef(uid, showId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const current = materializeTvWatchState({ ...data, id: data.id ?? showId });
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
              .sort((a, b) => String(b.watchedAt).localeCompare(String(a.watchedAt)))[0];
            const { watchEvents: _storedEvents, ...compactEpisode } = episode;
            return { ...compactEpisode, episodeWatchTime: latest.watchedAt };
          })
          .filter(Boolean),
      }))
      .filter((season) => season.episodes.length);
    const watchEvents = current.watchEvents.filter((event) => event.id !== eventId);
    if (!seasons.length || !watchEvents.length) {
      tx.delete(ref);
      return;
    }
    tx.update(ref, {
      seasons,
      watchEvents,
      watchCount: watchEvents.length,
      ...recomputeAggregates(seasons),
    });
  });
}

/** Dizinin tüm izlenme kaydını siler. */
export async function unmarkShow(uid, showId) {
  if (!uid || showId == null) return;
  await deleteDoc(showRef(uid, showId));
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
 * Eski BARE doc id'li (`watchedTv/1399`) show doküman'larını yeni `tv_${id}`
 * şemasına taşır VE bare+tv_ İKİLEMESİNİ giderir (ikileme = listelerde/
 * istatistikte aynı dizinin iki kez görünmesi).
 *
 * pendingRekey: [{ docId (bare), data (bare doc), existing (tv_ doc | null) }]
 *   - existing yok  → bare'i tv_ olarak kopyala, bare'i sil.
 *   - existing var  → tv_ kanonik; bare'in sezonlarını tv_'ye BİRLEŞTİR
 *                     (veri kaybı yok), bare'i sil.
 */
export async function migrateWatchedTvDocIds(uid, pendingRekey) {
  if (!uid || !Array.isArray(pendingRekey) || pendingRekey.length === 0) return false;
  for (let i = 0; i < pendingRekey.length; i += 200) {
    const batch = writeBatch(db);
    pendingRekey.slice(i, i + 200).forEach(({ docId, data, existing }) => {
      const id = data?.id ?? docId;
      const tvRef = doc(db, "Lists", uid, "watchedTv", `tv_${id}`);
      if (existing) {
        const seasons = mergeSeasons(existing.seasons || [], data?.seasons || []);
        batch.set(
          tvRef,
          {
            ...data, // bare metadata (eksik alanlar için)
            ...existing, // tv_ metadata öncelikli (daha güncel)
            seasons,
            watchEvents: mergeWatchEvents(
              existing.watchEvents || [],
              data?.watchEvents || [],
            ),
            ...recomputeAggregates(seasons),
          },
          { merge: true },
        );
      } else {
        batch.set(tvRef, data, { merge: true });
      }
      batch.delete(doc(db, "Lists", uid, "watchedTv", docId));
    });
    await batch.commit();
  }
  return true;
}

/**
 * Eski kök-dizi modelindeki ({ ..., seasons:[{ seasonNumber, episodes:[...] }] })
 * tek bir diziyi tek-doküman modeline taşır (yalnız subcollection'da olmayanlar için).
 */
export async function migrateLegacyShow(uid, legacyShow) {
  if (!uid || legacyShow?.id == null || !Array.isArray(legacyShow.seasons)) return;
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
  if (seasons.length === 0) return; // taşınacak gerçek veri yok
  seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

  await setDoc(showRef(uid, legacyShow.id), {
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
}

/**
 * Eski SeasonItem'ın yazdığı `watchedTv/{showId}/seasons/{n}` AYRI alt-koleksiyon
 * doküman'larını show doküman'ına GÖMER (yeni model) ve alt-koleksiyonu siler.
 * `seasons` alanı zaten varsa hiçbir şey yapmaz. Bir şey taşındıysa true döner.
 */
export async function migrateSeasonSubdocs(uid, showId) {
  if (!uid || showId == null) return false;
  const ref = showRef(uid, showId);
  const seasonsSnap = await getDocs(seasonsCol(uid, showId));
  if (seasonsSnap.empty) return false;

  const seasons = seasonsSnap.docs
    .map((d) => d.data())
    .filter((s) => s && s.seasonNumber != null && (s.episodes || []).length > 0)
    .map((s) => ({
      seasonNumber: s.seasonNumber,
      seasonPosterPath: s.seasonPosterPath || null,
      seasonEpisodes: s.seasonEpisodes || (s.episodes || []).length,
      addedSeasonDate: s.addedSeasonDate || null,
      episodes: (s.episodes || [])
        .map((e) => ({
          episodeNumber: e.episodeNumber,
          episodePosterPath: e.episodePosterPath || null,
          episodeName: e.episodeName || "Unknown",
          episodeRatings: e.episodeRatings || 0,
          episodeMinutes: e.episodeMinutes || 0,
          episodeWatchTime: e.episodeWatchTime || s.addedSeasonDate || null,
        }))
        .sort((a, b) => a.episodeNumber - b.episodeNumber),
    }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);

  const batch = writeBatch(db);
  if (seasons.length > 0) {
    batch.set(ref, { seasons, ...recomputeAggregates(seasons) }, { merge: true });
  }
  seasonsSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return seasons.length > 0;
}
