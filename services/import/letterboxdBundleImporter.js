// services/import/letterboxdBundleImporter.js
//
// Letterboxd ZIP arşivi veya çoklu CSV dosyalarını otomatik olarak tarayan,
// izlenenler, puanlar, izleme listesi, incelemeler ve tekrar izleme tarihlerini
// akıllıca birleştiren servis.

import JSZip from "jszip";
import { parseCsv } from "./csvParser";
import { ImportError } from "./importErrors";

/**
 * Letterboxd 0.5-5.0 yıldız puanını 1-10 skalasına çevirir.
 * @param {string|number} rawRating
 * @returns {number|null}
 */
export function normalizeLetterboxdRating(rawRating) {
  if (rawRating === undefined || rawRating === null || rawRating === "") return null;
  const parsed = parseFloat(rawRating);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return Math.round(Math.min(10, Math.max(1, parsed * 2)));
}

/**
 * Çoklu CSV dosya haritasından Letterboxd verilerini birleştirip normalize eder.
 * @param {Record<string, string>} filesMap - { "watched.csv": content, "diary.csv": content, ... }
 * @returns {{
 *   source: "letterboxd_bundle",
 *   stats: {
 *     watchedCount: number,
 *     watchlistCount: number,
 *     ratingsCount: number,
 *     reviewsCount: number,
 *     listsCount: number,
 *     totalUniqueItems: number
 *   },
 *   watchedItems: Array<Object>,
 *   watchlistItems: Array<Object>,
 *   customLists: Array<{ name: string, items: Array<Object> }>,
 *   allItems: Array<Object>
 * }}
 */
export function parseLetterboxdBundle(filesMap) {
  if (!filesMap || typeof filesMap !== "object") {
    throw new ImportError("noBundle", "No valid Letterboxd file bundle was found.");
  }

  // Dosya adlarını küçük harfe göre normalize et
  const normalizedFiles = {};
  for (const [rawName, content] of Object.entries(filesMap)) {
    const key = rawName.replace(/\\/g, "/").toLowerCase().trim();
    normalizedFiles[key] = content;
  }

  // Anahtar dosyaları bul
  const diaryKey = Object.keys(normalizedFiles).find((k) => k.endsWith("diary.csv"));
  const ratingsKey = Object.keys(normalizedFiles).find((k) => k.endsWith("ratings.csv"));
  const watchedKey = Object.keys(normalizedFiles).find((k) => k.endsWith("watched.csv"));
  const watchlistKey = Object.keys(normalizedFiles).find((k) => k.endsWith("watchlist.csv"));
  const reviewsKey = Object.keys(normalizedFiles).find((k) => k.endsWith("reviews.csv"));

  // 1. İZLENEN FİLMLER & PUANLAR & GÜNLÜK BİRLEŞTİRME HARİTASI
  const watchedMap = new Map();

  const getMediaKey = (title, year) =>
    `${(title || "").trim().toLowerCase()}__${year || "any"}`;

  // A) watched.csv'den temel listeyi çek
  if (watchedKey && normalizedFiles[watchedKey]) {
    const { data } = parseCsv(normalizedFiles[watchedKey]);
    for (const row of data) {
      const title = (row["name"] || row["title"] || "").trim();
      const rawYear = parseInt(row["year"], 10);
      const year = Number.isNaN(rawYear) ? null : rawYear;
      const date = row["date"] || null;
      const uri = row["letterboxd uri"] || row["letterboxd_uri"] || row["uri"] || null;

      if (!title) continue;
      const key = getMediaKey(title, year);

      if (!watchedMap.has(key)) {
        watchedMap.set(key, {
          title,
          year,
          rating: null,
          watchedDate: date,
          watchDates: date ? [date] : [],
          isRewatch: false,
          review: null,
          letterboxdUri: uri,
          targetList: "watchedMovies",
        });
      }
    }
  }

  // B) ratings.csv'den puanları entegre et
  if (ratingsKey && normalizedFiles[ratingsKey]) {
    const { data } = parseCsv(normalizedFiles[ratingsKey]);
    for (const row of data) {
      const title = (row["name"] || row["title"] || "").trim();
      const rawYear = parseInt(row["year"], 10);
      const year = Number.isNaN(rawYear) ? null : rawYear;
      const rating = normalizeLetterboxdRating(row["rating"]);
      const date = row["date"] || null;
      const uri = row["letterboxd uri"] || row["letterboxd_uri"] || row["uri"] || null;

      if (!title) continue;
      const key = getMediaKey(title, year);

      if (watchedMap.has(key)) {
        const item = watchedMap.get(key);
        if (rating != null) item.rating = rating;
        if (!item.watchedDate && date) item.watchedDate = date;
        if (date && !item.watchDates.includes(date)) item.watchDates.push(date);
        if (!item.letterboxdUri && uri) item.letterboxdUri = uri;
      } else {
        watchedMap.set(key, {
          title,
          year,
          rating,
          watchedDate: date,
          watchDates: date ? [date] : [],
          isRewatch: false,
          review: null,
          letterboxdUri: uri,
          targetList: "watchedMovies",
        });
      }
    }
  }

  // C) diary.csv'den gerçek izleme tarihlerini, puanları ve tekrar izlemeleri entegre et
  if (diaryKey && normalizedFiles[diaryKey]) {
    const { data } = parseCsv(normalizedFiles[diaryKey]);
    for (const row of data) {
      const title = (row["name"] || row["title"] || "").trim();
      const rawYear = parseInt(row["year"], 10);
      const year = Number.isNaN(rawYear) ? null : rawYear;
      const rating = normalizeLetterboxdRating(row["rating"]);
      const watchedDate = row["watched date"] || row["date"] || null;
      const isRewatch = (row["rewatch"] || "").trim().toLowerCase() === "yes";
      const uri = row["letterboxd uri"] || row["letterboxd_uri"] || row["uri"] || null;

      if (!title) continue;
      const key = getMediaKey(title, year);

      if (watchedMap.has(key)) {
        const item = watchedMap.get(key);
        if (rating != null) item.rating = rating;
        if (watchedDate) {
          item.watchedDate = watchedDate; // en son izleme tarihi
          if (!item.watchDates.includes(watchedDate)) {
            item.watchDates.push(watchedDate);
          }
        }
        if (isRewatch || item.watchDates.length > 1) item.isRewatch = true;
        if (!item.letterboxdUri && uri) item.letterboxdUri = uri;
      } else {
        watchedMap.set(key, {
          title,
          year,
          rating,
          watchedDate,
          watchDates: watchedDate ? [watchedDate] : [],
          isRewatch,
          review: null,
          letterboxdUri: uri,
          targetList: "watchedMovies",
        });
      }
    }
  }

  // D) reviews.csv'den inceleme metinlerini ve puanları entegre et
  if (reviewsKey && normalizedFiles[reviewsKey]) {
    const { data } = parseCsv(normalizedFiles[reviewsKey]);
    for (const row of data) {
      const title = (row["name"] || row["title"] || "").trim();
      const rawYear = parseInt(row["year"], 10);
      const year = Number.isNaN(rawYear) ? null : rawYear;
      const reviewText = (row["review"] || "").trim();
      const rating = normalizeLetterboxdRating(row["rating"]);
      const watchedDate = row["watched date"] || row["date"] || null;
      const uri = row["letterboxd uri"] || row["letterboxd_uri"] || row["uri"] || null;

      if (!title) continue;
      const key = getMediaKey(title, year);

      if (watchedMap.has(key)) {
        const item = watchedMap.get(key);
        if (reviewText) item.review = reviewText;
        if (rating != null && item.rating == null) item.rating = rating;
        if (!item.watchedDate && watchedDate) item.watchedDate = watchedDate;
        if (watchedDate && !item.watchDates.includes(watchedDate)) item.watchDates.push(watchedDate);
        if (!item.letterboxdUri && uri) item.letterboxdUri = uri;
      } else {
        watchedMap.set(key, {
          title,
          year,
          rating,
          watchedDate,
          watchDates: watchedDate ? [watchedDate] : [],
          isRewatch: false,
          review: reviewText || null,
          letterboxdUri: uri,
          targetList: "watchedMovies",
        });
      }
    }
  }

  const watchedItems = Array.from(watchedMap.values());

  // 2. İZLEME LİSTESİ (watchlist.csv)
  const watchlistItems = [];
  if (watchlistKey && normalizedFiles[watchlistKey]) {
    const { data } = parseCsv(normalizedFiles[watchlistKey]);
    for (const row of data) {
      const title = (row["name"] || row["title"] || "").trim();
      const rawYear = parseInt(row["year"], 10);
      const year = Number.isNaN(rawYear) ? null : rawYear;
      const dateAdded = row["date"] || null;
      const uri = row["letterboxd uri"] || row["letterboxd_uri"] || row["uri"] || null;

      if (!title) continue;

      watchlistItems.push({
        title,
        year,
        rating: null,
        watchedDate: null,
        dateAdded,
        letterboxdUri: uri,
        targetList: "watchList",
      });
    }
  }

  // 3. ÖZEL LİSTELER (lists/*.csv)
  const customLists = [];
  const listFileKeys = Object.keys(normalizedFiles).filter(
    (k) => k.includes("lists/") && k.endsWith(".csv") && !k.endsWith("lists.csv")
  );

  for (const listKey of listFileKeys) {
    const content = normalizedFiles[listKey];
    const { data } = parseCsv(content);
    const fileName = listKey.split("/").pop().replace(".csv", "");
    const listName = fileName
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    const listItems = [];
    for (const row of data) {
      const title = (row["name"] || row["title"] || "").trim();
      const rawYear = parseInt(row["year"], 10);
      const year = Number.isNaN(rawYear) ? null : rawYear;
      if (!title) continue;
      listItems.push({
        title,
        year,
        targetList: "customList",
        customListName: listName,
      });
    }

    if (listItems.length > 0) {
      customLists.push({
        name: listName,
        items: listItems,
      });
    }
  }

  // İstatistikler
  const ratingsCount = watchedItems.filter((i) => i.rating != null).length;
  const reviewsCount = watchedItems.filter((i) => typeof i.review === "string" && i.review.trim()).length;
  const allItems = [...watchedItems, ...watchlistItems];

  if (allItems.length === 0) {
    throw new ImportError("noBundleItems", "The bundle has no valid movie data to import.");
  }

  return {
    source: "letterboxd_bundle",
    stats: {
      watchedCount: watchedItems.length,
      watchlistCount: watchlistItems.length,
      ratingsCount,
      reviewsCount,
      listsCount: customLists.length,
      totalUniqueItems: allItems.length,
    },
    watchedItems,
    watchlistItems,
    customLists,
    allItems,
  };
}

/**
 * JSZip ile ZIP dosyasını (Base64 veya ArrayBuffer) bellek içinde açar ve ayrıştırır.
 * @param {string|ArrayBuffer} zipData
 * @param {Object} options - { isBase64: boolean }
 * @returns {Promise<ReturnType<typeof parseLetterboxdBundle>>}
 */
export async function parseLetterboxdZip(zipData, { isBase64 = true } = {}) {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipData, { base64: isBase64 });

  const filesMap = {};
  const entries = Object.keys(loadedZip.files);

  for (const relativePath of entries) {
    const file = loadedZip.files[relativePath];
    if (file.dir) continue;

    const lowerPath = relativePath.toLowerCase();
    if (lowerPath.endsWith(".csv") || lowerPath.endsWith(".tsv") || lowerPath.endsWith(".txt")) {
      const text = await file.async("string");
      filesMap[relativePath] = text;
    }
  }

  if (Object.keys(filesMap).length === 0) {
    throw new ImportError("zipNoCsv", "No CSV files were found inside the ZIP archive.");
  }

  return parseLetterboxdBundle(filesMap);
}
