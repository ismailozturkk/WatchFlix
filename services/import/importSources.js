// services/import/importSources.js
//
// Seçilen dosya(lar)ı ADINA değil İÇERİĞİNE bakarak tanır ve önizlemenin kullandığı tek
// sonuca çevirir:
//   • tek CSV            → { source: "letterboxd" | "imdb", type, items }  (hedef liste seçilir)
//   • ZIP / çoklu dosya  → { kind: "bundle", watchedItems, watchlistItems, customLists, ... }
//
// Neden içerik: dosya seçici yalnız dosya ADINI verir (klasör yok); Android ikinci
// indirmeyi "watched (1).csv" diye kaydeder; IMDb'nin ratings.csv'si Letterboxd'unkiyle
// aynı adı taşır. Ada bakan eski birleştirici IMDb puanlarını Letterboxd yıldızı sanıp
// iki katına çıkarıyor, "lists/" öneki olmayan liste dosyalarını hiç görmüyordu.

import { parseCsvHeaders } from "./csvParser";
import { isLetterboxdCsv, parseLetterboxdCsv } from "./letterboxdImporter";
import { isImdbCsv, parseImdbCsv } from "./imdbImporter";
import {
  isIgnoredExportPath,
  isLetterboxdListExport,
  parseLetterboxdBundle,
} from "./letterboxdBundleImporter";
import { ImportError } from "./importErrors";

export const isBundleResult = (parsed) => parsed?.kind === "bundle";

/** "letterboxd" | "letterboxdList" | "imdb" | "unknown" | "invalid" */
export function detectImportFileKind(text) {
  if (typeof text !== "string" || !text.trim() || text.includes("\0")) return "invalid";
  if (isLetterboxdListExport(text)) return "letterboxdList";
  const headers = parseCsvHeaders(text);
  if (!headers.length) return "unknown";
  if (isLetterboxdCsv(headers)) return "letterboxd";
  if (isImdbCsv(headers)) return "imdb";
  // Bilgi bloğu olmadan kaydedilmiş düz liste: "Position,Name,Year,URL,Description"
  if (headers.includes("position") && headers.includes("name") && headers.includes("year")) {
    return "letterboxdList";
  }
  return "unknown";
}

const baseName = (name) => String(name || "").replace(/\\/g, "/").split("/").pop() || "";

/**
 * Letterboxd CSV'sinin paketteki rolü. Ad ipucu önce ("watched (1).csv" de tutar), yoksa
 * ayırt edici sütunlar. watched ve watchlist aynı sütunları taşır: ipucu yoksa rol yok.
 */
export function letterboxdFileRole(name, headers = []) {
  const lower = baseName(name).toLowerCase();
  if (lower.includes("watchlist")) return "watchlist";
  if (lower.includes("watched")) return "watched";
  if (lower.includes("diary")) return "diary";
  if (lower.includes("review")) return "reviews";
  if (lower.includes("rating")) return "ratings";
  const set = new Set(headers);
  if (set.has("review")) return "reviews";
  if (set.has("watched date")) return "diary";
  if (set.has("rating")) return "ratings";
  return null;
}

function summarize(bundle, origins) {
  const { watchedItems, watchlistItems, customLists } = bundle;
  const listItemsCount = customLists.reduce((sum, list) => sum + list.items.length, 0);
  bundle.origins = origins;
  bundle.source = origins.length > 1 ? "mixed_bundle" : `${origins[0]}_bundle`;
  bundle.allItems = [...watchedItems, ...watchlistItems];
  bundle.stats = {
    watchedCount: watchedItems.length,
    watchlistCount: watchlistItems.length,
    ratingsCount: watchedItems.filter((item) => item.rating != null).length,
    reviewsCount: watchedItems.filter((item) => typeof item.review === "string" && item.review.trim()).length,
    listsCount: customLists.length,
    listItemsCount,
    totalUniqueItems: bundle.allItems.length,
  };
  return bundle;
}

/**
 * Birden çok dosyayı (klasörden seçim) tek pakete çevirir. Letterboxd ve IMDb
 * dosyaları birlikte seçilebilir; tanınmayan dosyalar sayılıp atlanır.
 * @param {Record<string, string>} filesMap  { dosyaAdı: içerik }
 */
export function buildBundleFromFiles(filesMap) {
  const letterboxdFiles = {};
  const imdbResults = [];
  let unknownFilesCount = 0;

  for (const [name, text] of Object.entries(filesMap || {})) {
    if (isIgnoredExportPath(name)) continue;
    const kind = detectImportFileKind(text);
    if (kind === "letterboxdList") {
      const listName = /(^|\/)lists\//i.test(name.replace(/\\/g, "/")) ? name : `lists/${baseName(name)}`;
      letterboxdFiles[listName] = text;
    } else if (kind === "letterboxd") {
      const role = letterboxdFileRole(name, parseCsvHeaders(text));
      // Aynı rolden ikinci dosya (ör. iki kez indirilen watched.csv) ilkini ezmez.
      if (role && !letterboxdFiles[`${role}.csv`]) letterboxdFiles[`${role}.csv`] = text;
      else unknownFilesCount += 1;
    } else if (kind === "imdb") {
      imdbResults.push(parseImdbCsv(text));
    } else {
      unknownFilesCount += 1;
    }
  }

  const hasLetterboxd = Object.keys(letterboxdFiles).length > 0;
  if (!hasLetterboxd && imdbResults.length === 0) {
    throw new ImportError(unknownFilesCount ? "unrecognizedCsv" : "noBundle", "No importable files.");
  }

  const bundle = parseLetterboxdBundle(letterboxdFiles, { allowEmpty: true });
  const origins = hasLetterboxd ? ["letterboxd"] : [];

  if (imdbResults.length) {
    origins.push("imdb");
    const seen = { watched: new Set(), watchlist: new Set() };
    for (const result of imdbResults) {
      const bucket = result.type === "watchlist" ? "watchlist" : "watched";
      const target = bucket === "watchlist" ? bundle.watchlistItems : bundle.watchedItems;
      for (const item of result.items) {
        const key = item.imdbId || `${item.title.toLowerCase()}__${item.year || "any"}`;
        if (seen[bucket].has(key)) continue;
        seen[bucket].add(key);
        target.push(item);
      }
    }
  }

  bundle.skippedCount = imdbResults.reduce((sum, result) => sum + (result.skippedCount || 0), 0);
  bundle.unknownFilesCount = unknownFilesCount;
  summarize(bundle, origins);

  if (bundle.stats.totalUniqueItems === 0 && bundle.stats.listItemsCount === 0) {
    throw new ImportError("noBundleItems", "The selected files have no importable titles.");
  }
  return bundle;
}

/**
 * Tek CSV metnini (dosya ya da yapıştırılan metin) ayrıştırır. Liste dışa aktarımı
 * tek başına seçilirse özel liste paketi olarak döner.
 */
export function parseImportText(text, fileName = null) {
  const kind = detectImportFileKind(text);
  if (kind === "letterboxdList") {
    return buildBundleFromFiles({ [`lists/${baseName(fileName) || "list.csv"}`]: text });
  }

  let parsed;
  if (kind === "letterboxd") parsed = parseLetterboxdCsv(text, fileName);
  else if (kind === "imdb") parsed = parseImdbCsv(text);
  else if (kind === "unknown" && parseCsvHeaders(text).length > 0) throw new ImportError("unrecognizedCsv");
  else throw new ImportError("emptyHeaders");

  if (!parsed.items || parsed.items.length === 0) throw new ImportError("noItemsInFile");
  return parsed;
}
