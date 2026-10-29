// services/import/letterboxdImporter.js
//
// Letterboxd dışa aktarım (CSV) formatını tanıyan ve normalleştiren servis.
// watched.csv, diary.csv, ratings.csv, watchlist.csv ve reviews.csv formatlarını destekler.

import { parseCsv } from "./csvParser";
import { ImportError } from "./importErrors";

/**
 * Verilen CSV'nin Letterboxd formatında olup olmadığını belirler.
 * @param {string[]} headers
 * @returns {boolean}
 */
export function isLetterboxdCsv(headers) {
  if (!Array.isArray(headers)) return false;
  const hSet = new Set(headers.map((h) => h.toLowerCase()));
  return (
    hSet.has("name") &&
    hSet.has("year") &&
    (hSet.has("letterboxd uri") || hSet.has("letterboxd_uri") || hSet.has("uri") || hSet.has("date"))
  );
}

/**
 * Letterboxd CSV metnini normalize edilmiş film listesine dönüştürür.
 * @param {string} csvText
 * @param {string|null} fileNameHint - örn: "watchlist.csv", "watched.csv", "diary.csv"
 * @returns {{
 *   source: "letterboxd",
 *   type: "watched" | "watchlist" | "diary" | "ratings" | "reviews",
 *   items: Array<{
 *     title: string,
 *     year: number | null,
 *     rating: number | null, // 1-10 skalasına çevrilmiş
 *     watchedDate: string | null,
 *     isRewatch?: boolean,
 *     review?: string | null,
 *     letterboxdUri: string | null,
 *     targetList: "watchedMovies" | "watchList"
 *   }>
 * }}
 */
export function parseLetterboxdCsv(csvText, fileNameHint = null) {
  const { headers, data } = parseCsv(csvText);

  if (!isLetterboxdCsv(headers)) {
    throw new ImportError("notLetterboxdCsv", "No valid Letterboxd CSV format was found.");
  }

  const hSet = new Set(headers);
  const lowerFileName = (fileNameHint || "").toLowerCase();

  // Dosya adı veya sütun başlıklarına göre tür belirleme
  let type = "watched";
  if (lowerFileName.includes("watchlist")) {
    type = "watchlist";
  } else if (lowerFileName.includes("diary")) {
    type = "diary";
  } else if (lowerFileName.includes("rating")) {
    type = "ratings";
  } else if (lowerFileName.includes("review")) {
    type = "reviews";
  } else if (hSet.has("review")) {
    type = "reviews";
  } else if (hSet.has("watched date")) {
    type = "diary";
  } else if (hSet.has("rating")) {
    type = "ratings";
  } else if (lowerFileName.includes("watched")) {
    type = "watched";
  }

  const targetList = type === "watchlist" ? "watchList" : "watchedMovies";

  const items = data
    .map((row) => {
      const title = (row["name"] || row["title"] || "").trim();
      const rawYear = parseInt(row["year"], 10);
      const year = Number.isNaN(rawYear) ? null : rawYear;

      // Rating (0.5 ile 5.0 arası yıldız -> 1 ile 10 skalasına çevir)
      let rating = null;
      if (row["rating"] !== undefined && row["rating"] !== "") {
        const rawRating = parseFloat(row["rating"]);
        if (!Number.isNaN(rawRating) && rawRating > 0) {
          rating = Math.round(Math.min(10, Math.max(1, rawRating * 2)));
        }
      }

      const watchedDate = row["watched date"] || row["date"] || null;
      const isRewatch = (row["rewatch"] || "").trim().toLowerCase() === "yes";
      const review = (row["review"] || "").trim() || null;
      const letterboxdUri = row["letterboxd uri"] || row["letterboxd_uri"] || row["uri"] || null;

      if (!title) return null;

      return {
        title,
        year,
        rating,
        watchedDate: type === "watchlist" ? null : watchedDate,
        dateAdded: type === "watchlist" ? (row["date"] || null) : null,
        isRewatch,
        review,
        letterboxdUri,
        targetList,
        importSource: "letterboxd",
      };
    })
    .filter(Boolean);

  return {
    source: "letterboxd",
    type,
    items,
  };
}
