// services/import/imdbImporter.js
//
// IMDb dışa aktarım (CSV) formatını tanıyan ve normalleştiren servis.
// ratings.csv ve watchlist.csv formatlarını, dizi/film ayrımını ve süre/tür alanlarını destekler.

import { parseCsv } from "./csvParser";

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
 *   items: Array<{
 *     imdbId: string,
 *     title: string,
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
    throw new Error("Geçerli bir IMDb CSV formatı bulunamadı.");
  }

  const hSet = new Set(headers);
  const isWatchlist = !hSet.has("your rating") && (hSet.has("created") || hSet.has("description"));
  const type = isWatchlist ? "watchlist" : "watched";

  const items = data
    .map((row) => {
      const imdbId = (row["const"] || "").trim();
      const title = (row["title"] || "").trim();
      const rawYear = parseInt(row["year"], 10);
      const year = Number.isNaN(rawYear) ? null : rawYear;
      const titleType = (row["title type"] || "movie").trim().toLowerCase();

      // Dizi veya Film tespiti
      const isTv =
        titleType.includes("tv") ||
        titleType.includes("series") ||
        titleType.includes("miniseries");
      const mediaType = isTv ? "tv" : "movie";

      // Puan (1-10 arası)
      let rating = null;
      if (row["your rating"] !== undefined && row["your rating"] !== "") {
        const rawRating = parseFloat(row["your rating"]);
        if (!Number.isNaN(rawRating) && rawRating > 0) {
          rating = Math.round(Math.min(10, Math.max(1, rawRating)));
        }
      }

      const dateRated = row["date rated"] || row["created"] || null;

      // IMDb dosyasındaki süre (Runtime mins)
      const rawRuntime = parseInt(row["runtime (mins)"] || row["runtime"] || "", 10);
      const rawMinutes = Number.isFinite(rawRuntime) && rawRuntime > 0 ? rawRuntime : null;

      // IMDb dosyasındaki türler (Genres: "Drama, Crime")
      const rawGenresStr = row["genres"] || "";
      const rawGenres = rawGenresStr
        .split(",")
        .map((g) => g.trim())
        .filter((g) => g.length > 0);

      if (!imdbId && !title) return null;

      return {
        imdbId,
        title,
        year,
        titleType,
        mediaType,
        rating,
        watchedDate: type === "watchlist" ? null : dateRated,
        dateAdded: dateRated,
        rawMinutes,
        rawGenres,
        targetList: type === "watchlist" ? "watchList" : "watchedMovies",
      };
    })
    .filter(Boolean);

  return {
    source: "imdb",
    type,
    items,
  };
}
