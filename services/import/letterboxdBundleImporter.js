// services/import/letterboxdBundleImporter.js
//
// Letterboxd ZIP arşivi veya çoklu CSV dosyalarını otomatik olarak tarayan,
// izlenenler, puanlar, izleme listesi, incelemeler ve tekrar izleme tarihlerini
// akıllıca birleştiren servis.
//
// Letterboxd dışa aktarımının bilinmesi gereken üç özelliği:
//  1) Kökteki dosyaların yanında `deleted/` (silinen günlük/inceleme/listeler),
//     `orphaned/` ve `likes/` klasörleri vardır. `deleted/diary.csv` alfabede
//     `diary.csv`'den ÖNCE gelir; "adı diary.csv ile biten ilk dosya" araması
//     kullanıcının SİLDİĞİ kayıtları içeri alıyordu. Yalnız kök dosyalar okunur.
//  2) `lists/*.csv` dosyaları üstte bir bilgi bloğuyla başlar
//     ("Letterboxd list export v7" → "Date,Name,Tags,URL,Description" → değerler →
//     boş satır → "Position,Name,Year,URL,Description" → öğeler). İlk satırı başlık
//     sanan ayrıştırıcı bu listeleri hiç okuyamıyordu.
//  3) Tarihlerin anlamı farklıdır: diary/reviews "Watched Date" GERÇEK izleme günüdür;
//     watched.csv "Date" günlüğe EKLENME günü, ratings.csv "Date" PUANLAMA günüdür.
//     Hepsini izleme olayı saymak, ertesi gün günlüğe yazılan her filmi "iki kez
//     izlendi" gösteriyordu. Günlük tarihi varsa yalnız o kullanılır.

import JSZip from "jszip";
import { parseCsv, parseCsvRows } from "./csvParser";
import { ImportError } from "./importErrors";

// Telefon belleğini korumak için açılmış toplam metin sınırı (Letterboxd dışa aktarımı
// tipik olarak birkaç MB'tır).
export const MAX_ZIP_TEXT_BYTES = 80 * 1024 * 1024;

const EXCLUDED_DIRS = new Set(["deleted", "orphaned", "likes", "__macosx"]);
const LIST_EXPORT_HEADER = /^﻿?\s*letterboxd list export/i;

const pathSegments = (key) => String(key || "").replace(/\\/g, "/").split("/").filter(Boolean);

/** deleted/ · orphaned/ · likes/ · __MACOSX/ altındaki ya da gizli (._x.csv) dosya mı? */
export function isIgnoredExportPath(key) {
  const segments = pathSegments(key).map((segment) => segment.toLowerCase());
  const fileName = segments[segments.length - 1] || "";
  return fileName.startsWith(".") || segments.slice(0, -1).some((segment) => EXCLUDED_DIRS.has(segment));
}

export const isLetterboxdListExport = (text) =>
  typeof text === "string" && LIST_EXPORT_HEADER.test(text.slice(0, 64));

/** Adı tam eşleşen, yok sayılan klasörlerde olmayan en sığ dosya. */
function findRootFile(keys, baseName) {
  return keys
    .filter((key) => pathSegments(key).pop() === baseName && !isIgnoredExportPath(key))
    .sort((a, b) => pathSegments(a).length - pathSegments(b).length || a.length - b.length)[0];
}

const parseYear = (raw) => {
  const year = parseInt(raw, 10);
  return Number.isNaN(year) ? null : year;
};

const cleanDate = (raw) => {
  const value = String(raw || "").trim();
  return value || null;
};

const rowUri = (row) => row["letterboxd uri"] || row["letterboxd_uri"] || row["uri"] || row["url"] || null;

const titleKey = (title, year) => `${(title || "").trim().toLowerCase()}__${year || "any"}`;

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

const slugToName = (fileName) =>
  fileName
    .replace(/\.(csv|tsv|txt)$/i, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * Tek bir Letterboxd liste dosyasını okur. Hem gerçek dışa aktarım biçimini (üstte
 * "Letterboxd list export" bilgi bloğu) hem de düz "Position,Name,Year,..." CSV'yi tanır.
 * @returns {{ name: string, items: Array<{ title: string, year: number|null, letterboxdUri: string|null }> }}
 */
export function parseLetterboxdListCsv(text, fallbackName = "") {
  const rows = parseCsvRows(text);
  const lower = (row) => row.map((cell) => String(cell || "").trim().toLowerCase());
  const headerIndex = rows.findIndex((row) => {
    const cells = lower(row);
    return cells.includes("name") && cells.includes("year");
  });
  if (headerIndex === -1) return { name: fallbackName, items: [] };

  // Bilgi bloğu: "Date,Name,Tags,URL,Description" + altında tek değer satırı.
  let name = "";
  const metaIndex = rows.findIndex((row, index) => index < headerIndex && lower(row).includes("name"));
  if (metaIndex !== -1 && metaIndex + 1 < headerIndex) {
    const nameColumn = lower(rows[metaIndex]).indexOf("name");
    name = String(rows[metaIndex + 1][nameColumn] || "").trim();
  }

  const headers = lower(rows[headerIndex]);
  const seen = new Set();
  const items = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    const title = (record.name || record.title || "").trim();
    if (!title) continue;
    const year = parseYear(record.year);
    const key = titleKey(title, year);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title, year, letterboxdUri: rowUri(record) });
  }
  return { name: name || fallbackName, items };
}

// Puan önceliği: ratings.csv filmin GÜNCEL puanıdır; günlük satırları geçmiş puanlardır.
const RATING_RANK = { ratings: 3, diary: 2, reviews: 1 };

function applyRating(entry, rating, source, date) {
  if (rating == null) return;
  const rank = RATING_RANK[source];
  const newer = String(date || "") >= String(entry.ratingDate || "");
  if (rank > entry.ratingRank || (rank === entry.ratingRank && newer)) {
    entry.rating = rating;
    entry.ratingRank = rank;
    entry.ratingDate = date || entry.ratingDate;
  }
}

const addUnique = (list, value) => {
  if (value && !list.includes(value)) list.push(value);
};

/**
 * Çoklu CSV dosya haritasından Letterboxd verilerini birleştirip normalize eder.
 * @param {Record<string, string>} filesMap - { "watched.csv": content, "diary.csv": content, ... }
 * @param {{ allowEmpty?: boolean }} [options]
 * @returns {{
 *   kind: "bundle",
 *   source: "letterboxd_bundle",
 *   origins: string[],
 *   stats: {
 *     watchedCount: number,
 *     watchlistCount: number,
 *     ratingsCount: number,
 *     reviewsCount: number,
 *     listsCount: number,
 *     listItemsCount: number,
 *     totalUniqueItems: number
 *   },
 *   watchedItems: Array<Object>,
 *   watchlistItems: Array<Object>,
 *   customLists: Array<{ name: string, items: Array<Object> }>,
 *   allItems: Array<Object>
 * }}
 */
export function parseLetterboxdBundle(filesMap, { allowEmpty = false } = {}) {
  if (!filesMap || typeof filesMap !== "object") {
    throw new ImportError("noBundle", "No valid Letterboxd file bundle was found.");
  }

  // Dosya adlarını küçük harfe göre normalize et
  const normalizedFiles = {};
  const originalNames = {};
  for (const [rawName, content] of Object.entries(filesMap)) {
    const key = rawName.replace(/\\/g, "/").toLowerCase().trim();
    normalizedFiles[key] = content;
    originalNames[key] = rawName.replace(/\\/g, "/").trim();
  }
  const keys = Object.keys(normalizedFiles);

  // Anahtar dosyaları bul (yalnız kök: deleted/ orphaned/ likes/ yok sayılır)
  const diaryKey = findRootFile(keys, "diary.csv");
  const ratingsKey = findRootFile(keys, "ratings.csv");
  const watchedKey = findRootFile(keys, "watched.csv");
  const watchlistKey = findRootFile(keys, "watchlist.csv");
  const reviewsKey = findRootFile(keys, "reviews.csv");

  // 1. İZLENEN FİLMLER & PUANLAR & GÜNLÜK BİRLEŞTİRME HARİTASI
  const watchedMap = new Map();
  const entryFor = (title, year, uri) => {
    const key = titleKey(title, year);
    if (!watchedMap.has(key)) {
      watchedMap.set(key, {
        title,
        year,
        rating: null,
        ratingRank: 0,
        ratingDate: null,
        diaryDates: [],
        loggedDate: null,
        ratedDate: null,
        isRewatch: false,
        review: null,
        letterboxdUri: uri,
        targetList: "watchedMovies",
      });
    }
    const entry = watchedMap.get(key);
    if (!entry.letterboxdUri && uri) entry.letterboxdUri = uri;
    return entry;
  };
  const rowsOf = (key) => (key && normalizedFiles[key] ? parseCsv(normalizedFiles[key]).data : []);
  const rowTitle = (row) => (row["name"] || row["title"] || "").trim();

  // A) watched.csv: izlenen filmlerin temel listesi (tarih = günlüğe eklenme günü)
  for (const row of rowsOf(watchedKey)) {
    const title = rowTitle(row);
    if (!title) continue;
    const entry = entryFor(title, parseYear(row["year"]), rowUri(row));
    entry.loggedDate = entry.loggedDate || cleanDate(row["date"]);
  }

  // B) ratings.csv: filmin güncel puanı (tarih = puanlama günü)
  for (const row of rowsOf(ratingsKey)) {
    const title = rowTitle(row);
    if (!title) continue;
    const entry = entryFor(title, parseYear(row["year"]), rowUri(row));
    const date = cleanDate(row["date"]);
    applyRating(entry, normalizeLetterboxdRating(row["rating"]), "ratings", date);
    entry.ratedDate = entry.ratedDate || date;
  }

  // C) diary.csv: gerçek izleme tarihleri ve tekrar izlemeler
  for (const row of rowsOf(diaryKey)) {
    const title = rowTitle(row);
    if (!title) continue;
    const entry = entryFor(title, parseYear(row["year"]), rowUri(row));
    const watchedDate = cleanDate(row["watched date"]) || cleanDate(row["date"]);
    addUnique(entry.diaryDates, watchedDate);
    applyRating(entry, normalizeLetterboxdRating(row["rating"]), "diary", watchedDate);
    if ((row["rewatch"] || "").trim().toLowerCase() === "yes") entry.isRewatch = true;
  }

  // D) reviews.csv: inceleme metinleri (incelemeler de birer günlük kaydıdır)
  for (const row of rowsOf(reviewsKey)) {
    const title = rowTitle(row);
    if (!title) continue;
    const entry = entryFor(title, parseYear(row["year"]), rowUri(row));
    const reviewText = (row["review"] || "").trim();
    const watchedDate = cleanDate(row["watched date"]);
    if (reviewText) entry.review = reviewText;
    if (watchedDate) addUnique(entry.diaryDates, watchedDate);
    else entry.loggedDate = entry.loggedDate || cleanDate(row["date"]);
    applyRating(entry, normalizeLetterboxdRating(row["rating"]), "reviews", watchedDate);
    if ((row["rewatch"] || "").trim().toLowerCase() === "yes") entry.isRewatch = true;
  }

  const watchedItems = Array.from(watchedMap.values()).map((entry) => {
    const dates = entry.diaryDates.length
      ? [...entry.diaryDates].sort()
      : [entry.loggedDate || entry.ratedDate].filter(Boolean);
    return {
      title: entry.title,
      year: entry.year,
      rating: entry.rating,
      watchedDate: dates[dates.length - 1] || null, // en son izleme tarihi
      watchDates: dates,
      isRewatch: entry.isRewatch || dates.length > 1,
      review: entry.review,
      letterboxdUri: entry.letterboxdUri,
      targetList: "watchedMovies",
      importSource: "letterboxd",
    };
  });

  // 2. İZLEME LİSTESİ (watchlist.csv)
  const watchlistItems = [];
  const watchlistSeen = new Set();
  for (const row of rowsOf(watchlistKey)) {
    const title = rowTitle(row);
    if (!title) continue;
    const year = parseYear(row["year"]);
    const key = titleKey(title, year);
    if (watchlistSeen.has(key)) continue;
    watchlistSeen.add(key);
    watchlistItems.push({
      title,
      year,
      rating: null,
      watchedDate: null,
      dateAdded: cleanDate(row["date"]),
      letterboxdUri: rowUri(row),
      targetList: "watchList",
      importSource: "letterboxd",
    });
  }

  // 3. ÖZEL LİSTELER: lists/ klasöründeki ya da içeriği liste dışa aktarımı olan dosyalar
  const customLists = [];
  const listFileKeys = keys.filter((key) => {
    if (isIgnoredExportPath(key) || !/\.(csv|tsv|txt)$/.test(key)) return false;
    const segments = pathSegments(key);
    return segments[segments.length - 2] === "lists" || isLetterboxdListExport(normalizedFiles[key]);
  });

  for (const listKey of listFileKeys) {
    const fileName = pathSegments(originalNames[listKey]).pop() || "";
    const parsed = parseLetterboxdListCsv(normalizedFiles[listKey], slugToName(fileName));
    if (!parsed.items.length || !parsed.name) continue;
    customLists.push({
      name: parsed.name,
      items: parsed.items.map((item) => ({
        ...item,
        targetList: "customList",
        customListName: parsed.name,
        importSource: "letterboxd",
      })),
    });
  }

  // İstatistikler
  const ratingsCount = watchedItems.filter((i) => i.rating != null).length;
  const reviewsCount = watchedItems.filter((i) => typeof i.review === "string" && i.review.trim()).length;
  const listItemsCount = customLists.reduce((sum, list) => sum + list.items.length, 0);
  const allItems = [...watchedItems, ...watchlistItems];

  if (allItems.length === 0 && listItemsCount === 0 && !allowEmpty) {
    throw new ImportError("noBundleItems", "The bundle has no valid movie data to import.");
  }

  return {
    kind: "bundle",
    source: "letterboxd_bundle",
    origins: ["letterboxd"],
    stats: {
      watchedCount: watchedItems.length,
      watchlistCount: watchlistItems.length,
      ratingsCount,
      reviewsCount,
      listsCount: customLists.length,
      listItemsCount,
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
 * @param {{ isBase64?: boolean, onProgress?: (done:number, total:number, name:string)=>void }} options
 * @returns {Promise<ReturnType<typeof parseLetterboxdBundle>>}
 */
export async function parseLetterboxdZip(zipData, { isBase64 = true, onProgress } = {}) {
  const zip = new JSZip();
  let loadedZip;
  try {
    loadedZip = await zip.loadAsync(zipData, { base64: isBase64 });
  } catch (error) {
    throw new ImportError("zipOpen", error?.message || "ZIP could not be opened.");
  }

  const entries = Object.keys(loadedZip.files).filter((relativePath) => {
    const file = loadedZip.files[relativePath];
    return !file.dir && /\.(csv|tsv|txt)$/i.test(relativePath) && !isIgnoredExportPath(relativePath);
  });

  const declaredBytes = entries.reduce(
    (sum, relativePath) => sum + (Number(loadedZip.files[relativePath]?._data?.uncompressedSize) || 0),
    0,
  );
  if (declaredBytes > MAX_ZIP_TEXT_BYTES) {
    throw new ImportError("zipTooLarge", `ZIP text content is ${declaredBytes} bytes.`);
  }

  const filesMap = {};
  for (let index = 0; index < entries.length; index += 1) {
    const relativePath = entries[index];
    filesMap[relativePath] = await loadedZip.files[relativePath].async("string");
    onProgress?.(index + 1, entries.length, pathSegments(relativePath).pop() || relativePath);
  }

  if (Object.keys(filesMap).length === 0) {
    throw new ImportError("zipNoCsv", "No CSV files were found inside the ZIP archive.");
  }

  return parseLetterboxdBundle(filesMap);
}
