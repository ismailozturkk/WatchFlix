// utils/libraryImport.js
//
// Kütüphane İÇE AKTARMA — SAF çekirdek (RN/Firebase importu yok; jest ile test edilir).
// Girdi: Kütüphaneni Dışa Aktar'ın JSON dosyası (utils/libraryExport.js, v1 ya da v2).
// Çıktı: (1) doğrulanmış, temizlenmiş bir yedek; (2) seçilen bölümlere göre YAZIM PLANI:
//   • items    : services/import/importRunner'ın beklediği kaynak öğeler (tmdbId'li → eşleştirme kesin)
//   • comments : geri yazılacak üst seviye yorumlar (services/libraryCommentsIO.restoreTitleComments)
//
// GÜVENLİK: dosya kullanıcının cihazından gelir ama başka birinden de gelebilir. Her alan tür ve sınır
// denetiminden geçer; bilinmeyen alan taşınmaz; sayı/uzunluk sınırları belgeyi şişirip yazımı düşürmesin.
// Bozuk tek kayıt dosyayı reddettirmez, ATLANIR ve sayılır (önizlemede "geçersiz kayıt" diye görünür).
//
// BİRLEŞTİRME (yazım katmanı, services/import/importWriter): mevcut kütüphane SİLİNMEZ ve EZİLMEZ.
// İzleme tarihleri birleşir (aynı gün tekrar eklenmez), mevcut puan korunur, yorumlar özgün kimlikle
// yazılır (aynı dosya ikinci kez aktarılınca hiçbir şey çoğalmaz).

import { EXPORT_VERSION, COMMENT_ID_RE, COMMENT_TEXT_MAX, cleanRating, posterOf } from "./libraryExport";

/** Dosya boyutu sınırı (karakter). Çok büyük dosya belleği zorlamasın. */
export const MAX_IMPORT_CHARS = 40 * 1024 * 1024;
export const IMPORT_SOURCE = "seelogd";
export const IMPORT_SECTIONS = Object.freeze(["films", "shows", "watchList", "favorites", "customLists", "ratings", "comments"]);

const LIMITS = Object.freeze({
  titlesPerSection: 20000,
  datesPerTitle: 400,
  episodesPerShow: 6000,
  customLists: 300,
  listName: 80,
  title: 300,
  genres: 12,
  comments: 10000,
});

const asArray = (value) => (Array.isArray(value) ? value : []);
const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const idOf = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 1e10 ? n : null;
};
const intIn = (value, min, max) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const textOf = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** "YYYY-MM-DD" ve gerçek bir gün (1900'den yarına kadar); değilse null. */
export function cleanDate(value, now = new Date()) {
  if (typeof value !== "string") return null;
  const m = DATE_RE.exec(value.slice(0, 10));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  if (y < 1900) return null;
  const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return date.getTime() > tomorrow ? null : m[0];
}

const cleanDates = (list, now) =>
  [...new Set(asArray(list).slice(0, LIMITS.datesPerTitle * 2).map((d) => cleanDate(d, now)).filter(Boolean))]
    .sort()
    .slice(-LIMITS.datesPerTitle);

const cleanGenres = (list) =>
  asArray(list)
    .filter((g) => typeof g === "string" && g.trim())
    .map((g) => g.trim().slice(0, 40))
    .slice(0, LIMITS.genres);

function cleanEntry(raw, now, forcedType = null) {
  if (!isPlainObject(raw)) return null;
  const tmdbId = idOf(raw.tmdbId);
  const type = forcedType || (raw.type === "tv" ? "tv" : raw.type === "movie" ? "movie" : null);
  const title = textOf(raw.title, LIMITS.title);
  if (!tmdbId || !type || !title) return null;
  return {
    tmdbId,
    type,
    title,
    genres: cleanGenres(raw.genres),
    poster: posterOf(raw.poster),
    addedAt: cleanDate(raw.addedAt, now),
    rating: cleanRating(raw.rating),
  };
}

function cleanMovie(raw, now) {
  const base = cleanEntry(raw, now, "movie");
  if (!base) return null;
  return { ...base, minutes: intIn(raw.minutes, 1, 2000), watchedDates: cleanDates(raw.watchedDates, now) };
}

function cleanShow(raw, now) {
  const base = cleanEntry(raw, now, "tv");
  if (!base) return null;
  const byKey = new Map();
  for (const ep of asArray(raw.episodes).slice(0, LIMITS.episodesPerShow)) {
    if (!isPlainObject(ep)) continue;
    const season = intIn(ep.season, 0, 500);
    const episode = intIn(ep.episode, 0, 20000);
    if (season == null || episode == null) continue;
    const key = `${season}:${episode}`;
    const prev = byKey.get(key);
    const dates = cleanDates([...(prev?.watchedDates || []), ...asArray(ep.watchedDates)], now);
    byKey.set(key, {
      season,
      episode,
      watchedDates: dates,
      minutes: prev?.minutes ?? intIn(ep.minutes, 1, 600),
      name: prev?.name ?? (textOf(ep.name, 200) || null),
    });
  }
  const episodes = [...byKey.values()].sort((a, b) => a.season - b.season || a.episode - b.episode);
  return {
    ...base,
    seasonCount: intIn(raw.seasonCount, 1, 500),
    episodeCount: intIn(raw.episodeCount, 1, 50000),
    episodesWatched: episodes.length,
    episodes,
  };
}

function cleanComment(raw, now) {
  if (!isPlainObject(raw)) return null;
  const id = typeof raw.id === "string" && COMMENT_ID_RE.test(raw.id) ? raw.id : null;
  const tmdbId = idOf(raw.tmdbId);
  const type = raw.type === "tv" ? "tv" : raw.type === "movie" ? "movie" : null;
  const text = textOf(raw.text, COMMENT_TEXT_MAX);
  if (!id || !tmdbId || !type || !text) return null;
  const created = typeof raw.createdAt === "string" ? new Date(raw.createdAt) : null;
  const createdOk = created && !Number.isNaN(created.getTime()) && created.getTime() <= now.getTime() + 864e5;
  const scopeRaw = isPlainObject(raw.scope) ? raw.scope : null;
  const scopeName = scopeRaw?.scope === "season" || scopeRaw?.scope === "episode" ? scopeRaw.scope : null;
  return {
    id,
    type,
    tmdbId,
    title: textOf(raw.title, LIMITS.title),
    poster: posterOf(raw.poster),
    text,
    isSpoiler: raw.isSpoiler === true,
    createdAt: createdOk ? created.toISOString() : null,
    parentId: typeof raw.parentId === "string" && COMMENT_ID_RE.test(raw.parentId) ? raw.parentId : null,
    scope:
      type === "tv" && scopeName
        ? {
            scope: scopeName,
            seasonNumber: intIn(scopeRaw.seasonNumber, 0, 500),
            episodeNumber: scopeName === "episode" ? intIn(scopeRaw.episodeNumber, 0, 20000) : null,
            title: textOf(scopeRaw.title, 200) || null,
          }
        : null,
  };
}

/** Bir bölümü temizler; bozuk kayıtları sayar, aynı yapımın ikinci kaydını birleştirmeden atar. */
function cleanSection(list, cleaner, now, counters, keyOf = (e) => `${e.type}_${e.tmdbId}`) {
  const out = [];
  const seen = new Set();
  const source = asArray(list);
  for (const raw of source.slice(0, LIMITS.titlesPerSection)) {
    const entry = cleaner(raw, now);
    if (!entry) {
      counters.invalid += 1;
      continue;
    }
    const key = keyOf(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  counters.invalid += Math.max(0, source.length - LIMITS.titlesPerSection);
  return out;
}

/** Yedekteki bölüm sayıları (önizleme ve seçim satırları). */
export function backupCounts(backup) {
  const b = backup || {};
  const customItems = asArray(b.customLists).reduce((sum, list) => sum + list.items.length, 0);
  return {
    films: asArray(b.watchedMovies).length,
    filmWatches: asArray(b.watchedMovies).reduce((sum, m) => sum + Math.max(1, m.watchedDates.length), 0),
    shows: asArray(b.watchedShows).length,
    episodes: asArray(b.watchedShows).reduce((sum, s) => sum + s.episodesWatched, 0),
    watchList: asArray(b.watchList).length,
    favorites: asArray(b.favorites).length,
    customLists: asArray(b.customLists).length,
    customListItems: customItems,
    ratings: asArray(b.ratings).length,
    comments: asArray(b.comments).filter((c) => !c.parentId).length,
    replies: asArray(b.comments).filter((c) => c.parentId).length,
  };
}

/** Önizlemede gösterilen her bölümün "miktarı" (0 olan bölüm gösterilmez). */
export const sectionAmount = (counts, id) =>
  ({
    films: counts.films,
    shows: counts.shows,
    watchList: counts.watchList,
    favorites: counts.favorites,
    customLists: counts.customListItems,
    ratings: counts.ratings,
    comments: counts.comments,
  })[id] || 0;

/**
 * JSON metnini doğrular ve temizler. ASLA fırlatmaz.
 * Hata kodları: empty | too-large | not-json | not-backup | too-new | nothing
 * @returns {{ ok: true, backup: object, counts: object, invalid: number } | { ok: false, error: string }}
 */
export function parseLibraryBackup(text, { now = new Date() } = {}) {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "empty" };
  if (text.length > MAX_IMPORT_CHARS) return { ok: false, error: "too-large" };
  let data;
  try {
    data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    return { ok: false, error: "not-json" };
  }
  if (!isPlainObject(data) || data.app !== "seelogd" || data.kind !== "library-export") {
    return { ok: false, error: "not-backup" };
  }
  const version = Number(data.version);
  if (!Number.isInteger(version) || version < 1) return { ok: false, error: "not-backup" };
  if (version > EXPORT_VERSION) return { ok: false, error: "too-new" };

  const counters = { invalid: 0 };
  const watchedMovies = cleanSection(data.watchedMovies, cleanMovie, now, counters);
  const watchedShows = cleanSection(data.watchedShows, cleanShow, now, counters);
  const watchList = cleanSection(data.watchList, (raw) => cleanEntry(raw, now), now, counters);
  const favorites = cleanSection(data.favorites, (raw) => cleanEntry(raw, now), now, counters);

  const customLists = [];
  const listNames = new Set();
  for (const raw of asArray(data.customLists).slice(0, LIMITS.customLists)) {
    const name = textOf(raw?.name, LIMITS.listName);
    if (!name || listNames.has(name)) {
      counters.invalid += 1;
      continue;
    }
    listNames.add(name);
    const items = cleanSection(raw?.items, (r) => cleanEntry(r, now), now, counters);
    if (items.length) customLists.push({ name, items });
  }

  const ratingSeen = new Set();
  const ratings = [];
  for (const raw of asArray(data.ratings).slice(0, LIMITS.titlesPerSection * 2)) {
    const type = raw?.type === "tv" ? "tv" : raw?.type === "movie" ? "movie" : null;
    const tmdbId = idOf(raw?.tmdbId);
    const rating = cleanRating(raw?.rating);
    if (!type || !tmdbId || !rating) {
      counters.invalid += 1;
      continue;
    }
    const key = `${type}_${tmdbId}`;
    if (ratingSeen.has(key)) continue;
    ratingSeen.add(key);
    ratings.push({ type, tmdbId, rating });
  }

  const comments = cleanSection(
    asArray(data.comments).slice(0, LIMITS.comments),
    cleanComment,
    now,
    counters,
    (c) => c.id,
  );

  const backup = {
    version,
    exportedAt: typeof data.exportedAt === "string" && !Number.isNaN(new Date(data.exportedAt).getTime()) ? data.exportedAt : null,
    appVersion: typeof data.appVersion === "string" ? data.appVersion.slice(0, 20) : null,
    platform: typeof data.platform === "string" ? data.platform.slice(0, 12) : null,
    watchedMovies,
    watchedShows,
    watchList,
    favorites,
    customLists,
    ratings,
    comments,
  };
  const counts = backupCounts(backup);
  const total = IMPORT_SECTIONS.reduce((sum, id) => sum + sectionAmount(counts, id), 0);
  if (total === 0) return { ok: false, error: "nothing" };
  return { ok: true, backup, counts, invalid: counters.invalid };
}

/** Ortak kaynak öğesi (importRunner → tmdbResolver.resolveImportItem → importWriter). */
function sourceItem(entry, extra) {
  return {
    tmdbId: entry.tmdbId,
    mediaType: entry.type,
    title: entry.title,
    poster_path: entry.poster,
    rawGenres: entry.genres,
    rawMinutes: entry.minutes ?? null,
    dateAdded: entry.addedAt || null,
    rating: null,
    importSource: IMPORT_SOURCE,
    ...extra,
  };
}

/**
 * Seçili bölümlerden yazım planı kurar.
 * Puan: "Puanlar" seçiliyse yapımın İLK yazılan kaydına (izlenen > izleme listesi > favori) eklenir;
 * kütüphanede hiçbir yerde olmayan puan (dosyada tek başına duran) yazılmaz, `orphanRatings` olarak sayılır —
 * importWriter her puanı bir liste kaydıyla birlikte yazar, kayıtsız puan profilde görünmez kalırdı.
 * @returns {{ items: object[], comments: object[], skipped: { replies: number, orphanRatings: number }, totals: object }}
 */
export function buildImportPlan(backup, sectionIds = IMPORT_SECTIONS) {
  const keep = new Set(Array.isArray(sectionIds) ? sectionIds : []);
  const b = backup || {};
  const items = [];
  const ratingByKey = new Map(keep.has("ratings") ? asArray(b.ratings).map((r) => [`${r.type}_${r.tmdbId}`, r.rating]) : []);
  const rated = new Set();
  const takeRating = (entry) => {
    const key = `${entry.type}_${entry.tmdbId}`;
    if (!ratingByKey.has(key) || rated.has(key)) return null;
    rated.add(key);
    return ratingByKey.get(key);
  };

  if (keep.has("films")) {
    for (const movie of asArray(b.watchedMovies)) {
      items.push(
        sourceItem(movie, {
          targetList: "watchedMovies",
          rating: takeRating(movie),
          watchDates: movie.watchedDates.length ? movie.watchedDates : null,
          watchedDate: movie.watchedDates[movie.watchedDates.length - 1] || movie.addedAt || null,
        }),
      );
    }
  }
  if (keep.has("shows")) {
    for (const show of asArray(b.watchedShows)) {
      const dates = [...new Set(show.episodes.flatMap((e) => e.watchedDates))].sort();
      items.push(
        sourceItem(show, {
          targetList: "watchedTv",
          rating: takeRating(show),
          seasonCount: show.seasonCount,
          episodeCount: show.episodeCount,
          episodes: show.episodes,
          watchedDate: dates[dates.length - 1] || show.addedAt || null,
        }),
      );
    }
  }
  for (const [section, targetList] of [["watchList", "watchList"], ["favorites", "favorites"]]) {
    if (!keep.has(section)) continue;
    for (const entry of asArray(b[section])) items.push(sourceItem(entry, { targetList, rating: takeRating(entry) }));
  }
  if (keep.has("customLists")) {
    for (const list of asArray(b.customLists)) {
      for (const entry of list.items) {
        // Özel liste yazımı (writeImportedCustomLists) puan taşımaz: puan burada eklenmez.
        items.push(sourceItem(entry, { targetList: "custom", customListName: list.name }));
      }
    }
  }

  const allComments = keep.has("comments") ? asArray(b.comments) : [];
  const comments = allComments.filter((c) => !c.parentId);
  const orphanRatings = [...ratingByKey.keys()].filter((key) => !rated.has(key)).length;
  return {
    items,
    comments,
    skipped: { replies: allComments.length - comments.length, orphanRatings },
    totals: {
      items: items.length,
      ratings: rated.size,
      comments: comments.length,
      lists: new Set(items.filter((i) => i.customListName).map((i) => i.customListName)).size,
    },
  };
}

/* ── Geri yükleme ekranı: aşama takibi (saf) ─────────────────────────────────── */

/** Olay türü → aşama kimliği. */
const EVENT_STAGE = { match: "matching", save: "saving", list: "lists", comment: "comments" };

/** Plana göre görünecek aşamalar (boş aşama gösterilmez). */
export function planStages(plan) {
  const stages = [];
  if (plan?.items?.length) {
    stages.push("matching", "saving");
    if (plan.totals?.lists) stages.push("lists");
    stages.push("finalizing");
  }
  if (plan?.comments?.length) stages.push("comments");
  return stages;
}

/** Olayları aşama durumuna işler (saf; test edilir). */
export function reduceStages(state, event) {
  const order = state.order;
  if (event?.type === "stage") {
    if (event.stage === "done") return { ...state, current: null, done: [...order] };
    const index = order.indexOf(event.stage);
    if (index === -1) return state;
    return {
      ...state,
      current: event.stage,
      // Sonraki bir aşama başladıysa öncekilerin hepsi bitmiştir (sürdürmede atlananlar da).
      done: order.slice(0, index),
      progress: event.total ? { ...state.progress, [event.stage]: { done: event.done || 0, total: event.total } } : state.progress,
    };
  }
  if (event?.type === "finalized") {
    return { ...state, done: [...new Set([...state.done, "finalizing"])] };
  }
  const stage = EVENT_STAGE[event?.type];
  if (stage && event.total) {
    return { ...state, progress: { ...state.progress, [stage]: { done: event.done || 0, total: event.total } } };
  }
  return state;
}
