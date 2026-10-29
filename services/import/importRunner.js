// services/import/importRunner.js
//
// İçe aktarma işini dört aşamada yürütür: TMDB eşleştirme → kayıt → özel listeler →
// profil istatistikleri. İş nesnesi (`job`) her aşamanın nerede kaldığını tutar; bağlantı
// koptuğunda ya da kullanıcı durdurduğunda aynı `job` ile `runImportJob` yeniden çağrılınca
// tamamlanan kısımlar atlanır. Yazımlar zaten idempotent olduğu için kaldığı yerden
// sürdürmek ya da baştan almak kayıtları çoğaltmaz; atlamak yalnız ZAMAN kazandırır.
//
// Eşleştirme yarıda kalırsa baştan koşar: çözülmüş öğeler önbellekten anında döner.

import { ImportError, isCancelledImport } from "./importErrors";
import { resolveImportItems } from "./tmdbResolver";
import { rebuildImportedProfileStats, writeImportedCustomLists, writeImportedItems } from "./importWriter";
import { isTransientFirestoreError, withRetry } from "./importRetry";
import { recordImportStats } from "./importStats";

const SAVE_NUMBERS = [
  "count",
  "watchedCount",
  "watchlistCount",
  "favoritesCount",
  "ratingsCount",
  "reviewsCount",
  "addedWatchEventsCount",
  "unchangedCount",
  "preservedRatingsCount",
  "preservedReviewsCount",
  "failedCount",
];

const emptySaveStats = () => ({
  ...Object.fromEntries(SAVE_NUMBERS.map((key) => [key, 0])),
  failedItems: [],
  bySource: {},
});

const emptyListStats = () => ({ customListsCount: 0, customListItemsCount: 0, failedListsCount: 0, failedLists: [], bySource: {} });

// Kaynak bazında eklenenleri toplar (sayılar toplanır, liste adları birleşir).
function mergeBySource(target, incoming) {
  Object.entries(incoming || {}).forEach(([source, values]) => {
    const entry = (target[source] = target[source] || {});
    Object.entries(values || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) entry[key] = [...new Set([...(entry[key] || []), ...value])];
      else entry[key] = (Number(entry[key]) || 0) + (Number(value) || 0);
    });
  });
}

function mergeSaveStats(target, stats) {
  if (!stats) return;
  SAVE_NUMBERS.forEach((key) => {
    target[key] += Number(stats[key]) || 0;
  });
  target.failedItems.push(...(stats.failedItems || []));
  mergeBySource(target.bySource, stats.bySource);
}

function mergeListStats(target, stats) {
  if (!stats) return;
  target.customListsCount += Number(stats.customListsCount) || 0;
  target.customListItemsCount += Number(stats.customListItemsCount) || 0;
  target.failedListsCount += Number(stats.failedListsCount) || 0;
  target.failedLists.push(...(stats.failedLists || []));
  mergeBySource(target.bySource, stats.bySource);
}

const mediaKey = (item) => `${item?.mediaType === "tv" ? "tv" : "movie"}_${item?.id}`;

/**
 * @param {{ uid:string, items:Object[], customItems?:Object[], userProfile?:Object,
 *   language?:string, preResolved?:Object[] }} input
 *   `preResolved`: eşleştirmesi zaten yapılmış öğeler (başarısız kayıtları yeniden denerken).
 */
export function createImportJob({ uid, items = [], customItems = [], userProfile = {}, language, preResolved = [] }) {
  return {
    uid,
    language,
    userProfile,
    sourceItems: [...items, ...customItems],
    preResolved,
    resolved: null,
    unmatched: [],
    failedMatches: [],
    savedOffset: 0,
    saveStats: emptySaveStats(),
    listsOffset: 0,
    listStats: emptyListStats(),
    finalized: false,
    recordedBySource: {},
    sessionRecorded: false,
    startedAt: null,
    finishedAt: null,
  };
}

/** Kayıt/liste aşamasına girecek toplamların ilk tahmini (ilerleme çubuğu için). */
export function estimateJobTotals(job) {
  const customLists = new Set(job.sourceItems.filter((item) => item.customListName).map((item) => item.customListName));
  return {
    matchTotal: job.sourceItems.length,
    saveTotal: job.sourceItems.filter((item) => !item.customListName).length + job.preResolved.length,
    listTotal: customLists.size,
  };
}

function splitResolved(job) {
  const all = [...(job.resolved || []), ...job.preResolved];
  const standard = all.filter((item) => !item.customListName);
  const groups = new Map();
  all.filter((item) => item.customListName).forEach((item) => {
    const list = groups.get(item.customListName) || [];
    list.push(item);
    groups.set(item.customListName, list);
  });
  return { standard, customGroups: [...groups.entries()].map(([name, items]) => ({ name, items })) };
}

async function finalize(job, signal) {
  await withRetry(() => rebuildImportedProfileStats(job.uid), {
    retries: 3,
    baseMs: 500,
    signal,
    isRetryable: isTransientFirestoreError,
  });
  job.finalized = true;
}

const SOURCE_COUNTERS = ["titles", "watchEvents", "ratings", "reviews", "lists", "listItems"];

/** İşin şimdiye dek kaynak bazında EKLEDİKLERİ (kayıt + liste aşamaları birlikte). */
export function jobSourceTotals(job) {
  const totals = {};
  const sources = new Set(job.sourceItems.map((item) => item.importSource).filter(Boolean));
  job.preResolved.forEach((item) => item.importSource && sources.add(item.importSource));
  sources.forEach((source) => {
    totals[source] = { ...Object.fromEntries(SOURCE_COUNTERS.map((key) => [key, 0])), createdLists: [] };
  });
  mergeBySource(totals, job.saveStats.bySource);
  mergeBySource(totals, job.listStats.bySource);
  return totals;
}

/**
 * Son kayıttan bu yana eklenenleri birikimli istatistiğe işler. Kesintide de çağrılır;
 * kayıt başarısız olursa (çevrimdışı) fark bir sonraki çalışmada yeniden denenir.
 */
async function recordJobStats(job) {
  const totals = jobSourceTotals(job);
  const delta = {};
  Object.entries(totals).forEach(([source, total]) => {
    const previous = job.recordedBySource[source] || {};
    const entry = Object.fromEntries(
      SOURCE_COUNTERS.map((key) => [key, Math.max(0, (total[key] || 0) - (previous[key] || 0))]),
    );
    entry.createdLists = (total.createdLists || []).filter((name) => !(previous.createdLists || []).includes(name));
    const changed = SOURCE_COUNTERS.some((key) => entry[key] > 0) || entry.createdLists.length > 0;
    // Hiçbir şey eklemeden biten oturum (aynı dosya yeniden) de geçmişe "0 yeni" diye
    // girer; ama hiçbir şey yazılmadan düşen deneme oturum sayılmaz.
    if (changed || (!job.sessionRecorded && job.finalized)) delta[source] = entry;
  });
  if (Object.keys(delta).length === 0) return;
  await recordImportStats(job.uid, delta, { newSession: !job.sessionRecorded });
  job.sessionRecorded = true;
  job.recordedBySource = JSON.parse(JSON.stringify(totals));
}

/**
 * İşi yürütür (ya da kaldığı yerden sürdürür). Her çalışmanın sonunda — başarı ya da
 * kesinti — eklenenler birikimli aktarım istatistiğine işlenir.
 * @param {ReturnType<typeof createImportJob>} job
 * @param {{ signal?: object, onEvent?: (event:Object)=>void, concurrency?: number }} options
 * @returns {Promise<ReturnType<typeof buildImportResult>>}
 */
export async function runImportJob(job, options = {}) {
  try {
    return await executeImportJob(job, options);
  } finally {
    try {
      await recordJobStats(job);
    } catch {
      // İstatistik kaydı aktarımı bozmasın; fark sonraki çalışmada işlenir.
    }
  }
}

async function executeImportJob(job, { signal, onEvent, concurrency } = {}) {
  const emit = (event) => onEvent?.(event);
  job.startedAt = job.startedAt || Date.now();

  // 1) TMDB eşleştirme
  if (!job.resolved) {
    if (job.sourceItems.length > 0) {
      emit({ type: "stage", stage: "matching", total: job.sourceItems.length, done: 0 });
      const result = await resolveImportItems(job.sourceItems, {
        language: job.language,
        signal,
        concurrency,
        onProgress: (done, total, detail) => emit({ type: "match", done, total, ...detail }),
      });
      if (result.resolved.length === 0 && job.preResolved.length === 0) {
        // Hiçbiri eşleşmediyse: bağlantı sorunu mu, gerçekten yok mu?
        if (result.failed.length > 0) throw new ImportError("network", "All lookups failed.");
        throw new ImportError("noTmdbMatch");
      }
      job.resolved = result.resolved;
      job.unmatched = result.unmatched;
      job.failedMatches = result.failed;
    } else {
      job.resolved = [];
    }
  }

  const { standard, customGroups } = splitResolved(job);
  let wroteSomething = job.saveStats.count > 0 || job.listStats.customListsCount > 0;

  try {
    // 2) Kütüphaneye kayıt
    if (job.savedOffset < standard.length) {
      const offset = job.savedOffset;
      emit({ type: "stage", stage: "saving", total: standard.length, done: offset });
      try {
        const stats = await writeImportedItems(job.uid, standard.slice(offset), {
          userProfile: job.userProfile,
          signal,
          rebuildStats: false,
          onProgress: (processed, total, detail) =>
            emit({ type: "save", done: offset + processed, total: standard.length, ...detail }),
        });
        mergeSaveStats(job.saveStats, stats);
        job.savedOffset = standard.length;
      } catch (error) {
        mergeSaveStats(job.saveStats, error?.stats);
        job.savedOffset = offset + (Number(error?.processed) || 0);
        throw error;
      } finally {
        wroteSomething = wroteSomething || job.saveStats.count > 0;
      }
    }

    // 3) Özel listeler
    if (job.listsOffset < customGroups.length) {
      const offset = job.listsOffset;
      emit({ type: "stage", stage: "lists", total: customGroups.length, done: offset });
      try {
        const stats = await writeImportedCustomLists(job.uid, customGroups.slice(offset), {
          signal,
          rebuildStats: false,
          onProgress: (processed, total, detail) =>
            emit({ type: "list", done: offset + processed, total: customGroups.length, ...detail }),
        });
        mergeListStats(job.listStats, stats);
        job.listsOffset = customGroups.length;
      } catch (error) {
        mergeListStats(job.listStats, error?.stats);
        job.listsOffset = offset + (Number(error?.processed) || 0);
        throw error;
      } finally {
        wroteSomething = wroteSomething || job.listStats.customListsCount > 0;
      }
    }
  } catch (error) {
    // Kullanıcı durdurduysa o ana dek yazılanların profil özeti yine tutarlı olsun.
    if (isCancelledImport(error) && wroteSomething) {
      try {
        await finalize(job);
      } catch {
        // Özet bir sonraki aktarımda / liste yenilemede onarılır.
      }
    }
    throw error;
  }

  // 4) Profil istatistikleri
  if (!job.finalized) {
    emit({ type: "stage", stage: "finalizing" });
    await finalize(job, signal);
  }
  emit({ type: "finalized" });
  job.finishedAt = Date.now();
  return buildImportResult(job);
}

const summaryOf = (item) => ({
  title: item?.title || item?.sourceTitle || item?.imdbId || "",
  year: item?.year ?? item?.sourceYear ?? null,
  poster_path: item?.poster_path || null,
});

/** Başarı ekranının özeti (eski `importStats` alanlarıyla uyumlu). */
export function buildImportResult(job) {
  const { standard, customGroups } = splitResolved(job);
  const customItemsCount = customGroups.reduce((sum, group) => sum + group.items.length, 0);
  const posters = [...standard, ...customGroups.flatMap((group) => group.items)]
    .map((item) => item.poster_path)
    .filter(Boolean);
  return {
    success: true,
    ...job.saveStats,
    ...job.listStats,
    count: job.saveStats.count + customItemsCount,
    unmatchedCount: job.unmatched.length,
    unmatchedItems: job.unmatched.map(summaryOf),
    failedMatchCount: job.failedMatches.length,
    failedCount: job.saveStats.failedCount,
    failedItems: job.saveStats.failedItems,
    retryableCount: job.failedMatches.length + job.saveStats.failedCount,
    posters: [...new Set(posters)].slice(0, 12),
    durationMs: job.finishedAt && job.startedAt ? job.finishedAt - job.startedAt : null,
  };
}

/** Bağlantı nedeniyle eşleşemeyen ve kaydı düşen öğeler için yeni iş. */
export function createRetryJob(job) {
  const { standard } = splitResolved(job);
  const failedKeys = new Set(job.saveStats.failedItems.map((item) => mediaKey(item)));
  return createImportJob({
    uid: job.uid,
    language: job.language,
    userProfile: job.userProfile,
    items: job.failedMatches,
    preResolved: standard.filter((item) => failedKeys.has(mediaKey(item))),
  });
}

/** Kesintide kullanıcıya gösterilen "şu ana dek" özeti. */
export function jobProgressSummary(job) {
  return {
    saved: job.saveStats.count,
    lists: job.listStats.customListsCount,
    matched: job.resolved ? job.resolved.length : 0,
  };
}
