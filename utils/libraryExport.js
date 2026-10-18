// utils/libraryExport.js
//
// Kütüphane DIŞA AKTARMA — SAF çekirdek (RN/Firebase importu yok; jest ile test edilir).
// Giriş: ListStatusContext'in zaten bellekte tuttuğu listeler (ek okuma yok). Çıkış: bir "anlık görüntü"
// (JSON) ve ondan türeyen CSV dosyaları.
//
// ÜÇ ÇIKTI
//   • JSON (library.json)     : EKSİKSİZ kopya — tüm listeler, izleme tarihleri, dizilerde bölüm bölüm
//                               geçmiş, puanlar. Taşınabilirlik hakkının asıl çıktısı.
//   • library.csv             : tek tablo; Excel / Sheets için (UTF-8 BOM, formül enjeksiyonuna karşı koruma).
//   • letterboxd-*.csv        : Letterboxd'a aktarılabilir (film YALNIZ). Sütunlar Letterboxd'ın belgelediği
//                               içe aktarma biçimi: tmdbID, Title, Year, WatchedDate, Rating10, Rewatch
//                               (https://letterboxd.com/about/importing-data/). tmdbID kesin eşleşme sağlar.
//                               Dosya başına 1 MB sınırı olduğundan büyük kütüphane PARÇALANIR, her parçada başlık satırı var.
//
// NEDEN YIL YOK: Seelogd liste öğeleri yayın yılını taşımıyor; Letterboxd tmdbID ile kesin eşleştiği için gerekmiyor
// (Title/Year yalnız eşleşme yardımcısı).
//
// DİZİLER Letterboxd'a gitmez (Letterboxd yalnız film tanır); JSON ve library.csv'de tam yer alır.
// REWATCH: aynı filmin ilk izlemesi normal, sonrakiler `Rewatch=true` (Letterboxd yalnız WatchedDate varken uygular).

import { materializeTvWatchState, movieWatchEvents, normalizeWatchDate } from "./watchHistory";

export const EXPORT_VERSION = 1;
/** Letterboxd dosya başına 1 MB der; sınırın altında kalmak için 900 KB'ta böl. */
export const LETTERBOXD_MAX_BYTES = 900 * 1024;

const isPlainObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const asArray = (value) => (Array.isArray(value) ? value : []);
const idOf = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};
const textOf = (value) => (typeof value === "string" ? value.trim() : "");
const genresOf = (item) => asArray(item?.genres).filter((g) => typeof g === "string" && g.trim());
const minutesOf = (item) => (Number.isFinite(item?.minutes) && item.minutes > 0 ? item.minutes : null);
const uniqueSorted = (dates) => [...new Set(dates.filter(Boolean))].sort();

/** Puan 0–10 aralığına sıkıştırılır; geçersiz ya da 0 → null. */
export function cleanRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(Math.min(10, n) * 10) / 10;
}

const ratingFor = (ratings, type, id) => cleanRating(ratings?.[`${type}_${id}`]);

function listEntry(item, ratings) {
  const tmdbId = idOf(item?.id);
  const title = textOf(item?.name || item?.title);
  if (!tmdbId || !title) return null;
  const type = item?.type === "tv" || item?.media_type === "tv" ? "tv" : "movie";
  return {
    tmdbId,
    type,
    title,
    genres: genresOf(item),
    addedAt: normalizeWatchDate(item?.dateAdded),
    rating: ratingFor(ratings, type, tmdbId),
  };
}

function movieEntry(item, ratings) {
  const base = listEntry({ ...item, type: "movie" }, ratings);
  if (!base) return null;
  return {
    ...base,
    type: "movie",
    minutes: minutesOf(item),
    watchedDates: uniqueSorted(movieWatchEvents(item).map((event) => event.watchedAt)),
  };
}

function showEntry(show, ratings) {
  const base = listEntry({ ...show, type: "tv" }, ratings);
  if (!base) return null;
  const episodes = [];
  for (const season of asArray(materializeTvWatchState(show).seasons)) {
    const seasonNumber = Number(season?.seasonNumber);
    for (const episode of asArray(season?.episodes)) {
      const episodeNumber = Number(episode?.episodeNumber);
      episodes.push({
        season: Number.isFinite(seasonNumber) ? seasonNumber : null,
        episode: Number.isFinite(episodeNumber) ? episodeNumber : null,
        watchedDates: uniqueSorted(asArray(episode?.watchEvents).map((event) => event.watchedAt)),
      });
    }
  }
  episodes.sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0));
  return { ...base, type: "tv", episodesWatched: episodes.length, episodes };
}

/**
 * Anlık görüntüyü kurar.
 *
 * @param {object} input
 * @param {Record<string, Array>} input.lists  ListStatusContext.combinedLists: favorites, watchList,
 *   watchedMovies, watchedTv (dizi dizisi) + özel listeler (öteki her dizi anahtarı)
 * @param {Record<string, number>} [input.ratings]  activityIndex.ratings ("movie_550": 8)
 * @param {object} [meta] { now, appVersion, platform }
 */
export function buildLibrarySnapshot(input, meta) {
  const { lists, ratings } = input || {};
  const { now = new Date(), appVersion = null, platform = null } = meta || {};
  const all = isPlainObject(lists) ? lists : {};
  const rate = isPlainObject(ratings) ? ratings : {};
  const reserved = new Set(["favorites", "watchList", "watchedMovies", "watchedTv"]);

  const watchedMovies = asArray(all.watchedMovies).map((item) => movieEntry(item, rate)).filter(Boolean);
  const watchedShows = asArray(all.watchedTv).map((show) => showEntry(show, rate)).filter(Boolean);
  const watchList = asArray(all.watchList).map((item) => listEntry(item, rate)).filter(Boolean);
  const favorites = asArray(all.favorites).map((item) => listEntry(item, rate)).filter(Boolean);
  const customLists = Object.keys(all)
    .filter((name) => !reserved.has(name) && Array.isArray(all[name]))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, items: all[name].map((item) => listEntry(item, rate)).filter(Boolean) }));

  const ratingList = Object.entries(rate)
    .map(([key, value]) => {
      const match = /^(movie|tv)_(\d+)$/.exec(key);
      const rating = cleanRating(value);
      return match && rating ? { type: match[1], tmdbId: Number(match[2]), rating } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.type.localeCompare(b.type) || a.tmdbId - b.tmdbId);

  return {
    app: "seelogd",
    kind: "library-export",
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    appVersion,
    platform,
    counts: {
      watchedMovies: watchedMovies.length,
      watchedShows: watchedShows.length,
      watchedEpisodes: watchedShows.reduce((sum, show) => sum + show.episodesWatched, 0),
      watchList: watchList.length,
      favorites: favorites.length,
      customLists: customLists.length,
      customListItems: customLists.reduce((sum, list) => sum + list.items.length, 0),
      ratings: ratingList.length,
    },
    watchedMovies,
    watchedShows,
    watchList,
    favorites,
    customLists,
    ratings: ratingList,
  };
}

/** Dışa aktarılacak bir şey var mı? */
export const isSnapshotEmpty = (snapshot) => {
  const c = snapshot?.counts;
  if (!c) return true;
  return (
    c.watchedMovies + c.watchedShows + c.watchList + c.favorites + c.customListItems + c.ratings === 0
  );
};

export const serializeSnapshot = (snapshot) => JSON.stringify(snapshot, null, 2);

/* ── CSV ─────────────────────────────────────────────────────────────────── */

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Tek hücre. Virgül / tırnak / satır sonu içeren değer tırnağa alınır, tırnak ikilenir (RFC 4180).
 * `guard`: elektronik tablo için formül enjeksiyonu koruması — "=", "+", "-", "@" ile başlayan METİN
 * başına kesme işareti alır (Excel/Sheets formül saymasın). Sayılar korunmaz (zaten sayı).
 */
export function csvCell(value, { guard = false } = {}) {
  if (value === null || value === undefined) return "";
  let text = typeof value === "string" ? value : String(value);
  if (guard && typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const csvRow = (cells, options) => cells.map((cell) => csvCell(cell, options)).join(",");

/** UTF-8 bayt uzunluğu (TextEncoder her ortamda yok). */
export function utf8Length(text) {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4; // vekil çift: iki birim = 4 bayt
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Satırları, her biri en çok `maxBytes` olan ve HER BİRİNDE başlık satırı bulunan parçalara böler.
 * Bir satır tek başına sınırı aşsa bile kendi parçasına konur (veri kaybı yok).
 * @returns {string[]} CSV metinleri (satır sonu \n); satır yoksa tek parça yalnız başlık
 */
export function csvChunks(headers, rows, { maxBytes = LETTERBOXD_MAX_BYTES, options } = {}) {
  const head = csvRow(headers, options);
  const chunks = [];
  let lines = [];
  let size = utf8Length(head) + 1;
  const flush = () => {
    chunks.push([head, ...lines].join("\n") + "\n");
    lines = [];
    size = utf8Length(head) + 1;
  };
  for (const row of rows) {
    const line = csvRow(row, options);
    const lineSize = utf8Length(line) + 1;
    if (lines.length > 0 && size + lineSize > maxBytes) flush();
    lines.push(line);
    size += lineSize;
  }
  if (lines.length > 0 || chunks.length === 0) flush();
  return chunks;
}

const joinList = (values) => values.join("; ");

/** library.csv: tüm listeler tek tabloda. */
export function buildLibraryCsv(snapshot) {
  const headers = ["list", "type", "tmdb_id", "title", "rating", "added", "watched_dates", "episodes_watched", "genres", "minutes"];
  const rows = [];
  const add = (list, entry, extra = {}) =>
    rows.push([
      list,
      entry.type,
      entry.tmdbId,
      entry.title,
      entry.rating,
      entry.addedAt,
      extra.watchedDates ? joinList(extra.watchedDates) : "",
      extra.episodesWatched ?? "",
      joinList(entry.genres),
      entry.minutes ?? "",
    ]);
  for (const movie of snapshot.watchedMovies) add("watchedMovies", movie, { watchedDates: movie.watchedDates });
  for (const show of snapshot.watchedShows) {
    add("watchedTv", show, {
      watchedDates: uniqueSorted(show.episodes.flatMap((episode) => episode.watchedDates)),
      episodesWatched: show.episodesWatched,
    });
  }
  for (const entry of snapshot.watchList) add("watchList", entry);
  for (const entry of snapshot.favorites) add("favorites", entry);
  for (const list of snapshot.customLists) for (const entry of list.items) add(list.name, entry);
  return "﻿" + csvChunks(headers, rows, { maxBytes: Infinity, options: { guard: true } })[0];
}

/**
 * Letterboxd "izlenenler" içe aktarma dosyaları (yalnız FİLM). İzleme tarihi başına bir satır;
 * ilk izleme normal, sonrakiler Rewatch=true. Tarihi olmayan film tarihsiz tek satır olur
 * (Letterboxd izlendi sayar, günlük girişi açmaz). Puan 1–10'a yuvarlanır.
 * @returns {string[]} 1 MB altı parçalar
 */
export function buildLetterboxdWatched(snapshot) {
  const rows = [];
  for (const movie of snapshot.watchedMovies) {
    const rating10 = movie.rating ? Math.max(1, Math.min(10, Math.round(movie.rating))) : "";
    if (movie.watchedDates.length === 0) {
      rows.push([movie.tmdbId, movie.title, "", "", rating10, ""]);
      continue;
    }
    movie.watchedDates.forEach((date, index) => {
      rows.push([movie.tmdbId, movie.title, "", date, rating10, index > 0 ? "true" : ""]);
    });
  }
  return csvChunks(["tmdbID", "Title", "Year", "WatchedDate", "Rating10", "Rewatch"], rows);
}

/** Letterboxd izleme listesi içe aktarma dosyaları (yalnız FİLM). */
export function buildLetterboxdWatchlist(snapshot) {
  const rows = snapshot.watchList
    .filter((entry) => entry.type === "movie")
    .map((entry) => [entry.tmdbId, entry.title, ""]);
  return csvChunks(["tmdbID", "Title", "Year"], rows);
}

/** Parçalara numara verir: tek parça "ad.csv", çoksa "ad-1.csv", "ad-2.csv"… */
export const chunkFileNames = (base, count) =>
  count <= 1 ? [`${base}.csv`] : Array.from({ length: count }, (_, i) => `${base}-${i + 1}.csv`);

/**
 * ZIP içeriği: [{ name, text }]. Boş Letterboxd dosyaları (hiç film yok) eklenmez.
 * @param {string} readme kullanıcı dilinde kısa açıklama (README.txt)
 */
export function buildCsvBundle(snapshot, { readme = "" } = {}) {
  const files = [{ name: "library.csv", text: buildLibraryCsv(snapshot) }];
  const addChunks = (base, chunks, hasRows) => {
    if (!hasRows) return;
    chunkFileNames(base, chunks.length).forEach((name, i) => files.push({ name, text: chunks[i] }));
  };
  addChunks("letterboxd-watched", buildLetterboxdWatched(snapshot), snapshot.watchedMovies.length > 0);
  addChunks(
    "letterboxd-watchlist",
    buildLetterboxdWatchlist(snapshot),
    snapshot.watchList.some((entry) => entry.type === "movie"),
  );
  if (readme) files.push({ name: "README.txt", text: readme });
  return files;
}

/** "seelogd-library-2026-10-18.json" */
export function exportFileName(extension, now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `seelogd-library-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${extension}`;
}
