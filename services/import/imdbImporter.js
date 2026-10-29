// services/import/imdbImporter.js
//
// IMDb dışa aktarım (CSV) formatını tanıyan ve normalleştiren servis.
// ratings.csv ve watchlist/liste dışa aktarımlarını, dizi/film ayrımını ve süre/tür alanlarını destekler.
//
// IMDb'nin iki başlık yazımı vardır: eski dışa aktarım "tvSeries", "tvMovie"; yenisi
// "TV Series", "TV Movie". "tv" içeren her türü dizi saymak TV filmlerini ve TV
// özel yayınlarını DİZİ olarak arıyordu; bölüm/oyun/podcast kayıtları da yanlış
// eşleşmelerle kütüphaneye giriyordu. Tür artık tabloyla çözülür, desteklenmeyenler atlanır.

import { parseCsv } from "./csvParser";
import { ImportError } from "./importErrors";

const TV_TYPES = new Set(["tvseries", "tvminiseries"]);
const UNSUPPORTED_TYPES = new Set(["tvepisode", "videogame", "podcastseries", "podcastepisode"]);

/** IMDb "Title Type" → "movie" | "tv"; desteklenmeyen tür (bölüm, oyun, podcast) → null. */
export function imdbMediaType(rawType) {
  const key = String(rawType || "movie").toLowerCase().replace(/[\s_-]+/g, "");
  if (UNSUPPORTED_TYPES.has(key)) return null;
  return TV_TYPES.has(key) ? "tv" : "movie";
}

/**
 * Verilen CSV'nin IMDb formatında olup olmadığını belirler.
 * @param {string[]} headers
 * @returns {boolean}
 */
export function isImdbCsv(headers) {
  if (!Array.isArray(headers)) return false;
  const hSet = new Set(headers.map((h) => h.toLowerCase()));
  return (
    hSet.has("const") &&
    (hSet.has("title") || hSet.has("your rating") || hSet.has("imdb rating") || hSet.has("title type"))
  );
}

/**
 * IMDb CSV metnini normalize edilmiş film/dizi listesine dönüştürür.
 * @param {string} csvText
 * @returns {{
 *   source: "imdb",
 *   type: "watched" | "watchlist",
 *   skippedCount: number,
 *   items: Array<{
 *     imdbId: string,
 *     title: string,
 *     originalTitle: string | null,
 *     year: number | null,
 *     titleType: string | null,
 *     mediaType: "movie" | "tv",
 *     rating: number | null,
 *     watchedDate: string | null,
 *     dateAdded: string | null,
 *     rawMinutes: number | null,
 *     rawGenres: string[],
 *     targetList: "watchedMovies" | "watchList"
 *   }>
 * }}
 */
export function parseImdbCsv(csvText) {
  const { headers, data } = parseCsv(csvText);

  if (!isImdbCsv(headers)) {
    throw new ImportError("notImdbCsv", "No valid IMDb CSV format was found.");
  }

  const hSet = new Set(headers);
  // Liste/izleme listesi dışa aktarımı "Position" ve "Created" sütunlarını taşır. Yeni
  // biçimde listelerde de "Your Rating" sütunu bulunduğundan ona bakmak izleme listesini
  // "izlenenler" sanıyordu.
  const isWatchlist = hSet.has("position") || hSet.has("created");
  const type = isWatchlist ? "watchlist" : "watched";
  let skippedCount = 0;

  const items = data
    .map((row) => {
      const imdbId = (row["const"] || "").trim();
      const title = (row["title"] || "").trim();
      const originalTitle = (row["original title"] || "").trim() || null;
      const rawYear = parseInt(row["year"], 10);
      const year = Number.isNaN(rawYear) ? null : rawYear;
      const titleType = (row["title type"] || "movie").trim().toLowerCase();

      if (!imdbId && !title) return null;

      // Dizi veya Film tespiti
      const mediaType = imdbMediaType(titleType);
      if (!mediaType) {
        skippedCount += 1;
        return null;
      }

      // Puan (1-10 arası)
      let rating = null;
      if (row["your rating"] !== undefined && row["your rating"] !== "") {
        const rawRating = parseFloat(row["your rating"]);
        if (!Number.isNaN(rawRating) && rawRating > 0) {
          rating = Math.round(Math.min(10, Math.max(1, rawRating)));
        }
      }

      const dateRated = row["date rated"] || null;
      const dateAdded = row["created"] || dateRated || null;

      // IMDb dosyasındaki süre (Runtime mins)
      const rawRuntime = parseInt(row["runtime (mins)"] || row["runtime"] || "", 10);
      const rawMinutes = Number.isFinite(rawRuntime) && rawRuntime > 0 ? rawRuntime : null;

      // IMDb dosyasındaki türler (Genres: "Drama, Crime")
      const rawGenresStr = row["genres"] || "";
      const rawGenres = rawGenresStr
        .split(",")
        .map((g) => g.trim())
        .filter((g) => g.length > 0);

      return {
        imdbId,
        title,
        originalTitle,
        year,
        titleType,
        mediaType,
        rating,
        watchedDate: type === "watchlist" ? null : dateRated,
        dateAdded,
        rawMinutes,
        rawGenres,
        targetList: type === "watchlist" ? "watchList" : "watchedMovies",
        importSource: "imdb",
      };
    })
    .filter(Boolean);

  return {
    source: "imdb",
    type,
    skippedCount,
    items,
  };
}
