// __tests__/csvParser.test.js
// Letterboxd ve IMDb CSV / ZIP ayrıştırma, birleştirme, süre/tür ve dayanıklılık testleri

import JSZip from "jszip";
import { parseCsvRows, parseCsv, detectDelimiter, decodeHtmlEntities } from "../services/import/csvParser";
import { isLetterboxdCsv, parseLetterboxdCsv } from "../services/import/letterboxdImporter";
import { isImdbCsv, parseImdbCsv } from "../services/import/imdbImporter";
import {
  parseLetterboxdBundle,
  parseLetterboxdZip,
  normalizeLetterboxdRating,
} from "../services/import/letterboxdBundleImporter";

describe("CSV Parser Core & Resilience", () => {
  test("temel virgülle ayrılmış satırları doğru ayrıştırır", () => {
    const raw = "Name,Year,Rating\nInception,2010,4.5\nInterstellar,2014,5";
    const { headers, data } = parseCsv(raw);

    expect(headers).toEqual(["name", "year", "rating"]);
    expect(data.length).toBe(2);
    expect(data[0].name).toBe("Inception");
    expect(data[0].year).toBe("2010");
    expect(data[0].rating).toBe("4.5");
  });

  test("noktalı virgül (;) ve tab (\\t) ayırıcılarını otomatik tespit eder", () => {
    expect(detectDelimiter("Name;Year;Rating\nInception;2010;4.5")).toBe(";");
    expect(detectDelimiter("Name\tYear\tRating\nInception\t2010\t4.5")).toBe("\t");
    expect(detectDelimiter("Name,Year,Rating\nInception,2010,4.5")).toBe(",");

    const semiRaw = "Name;Year;Rating\nInception;2010;4.5\nInterstellar;2014;5";
    const { data } = parseCsv(semiRaw);
    expect(data.length).toBe(2);
    expect(data[0].name).toBe("Inception");
    expect(data[1].year).toBe("2014");
  });

  test("HTML karakter varlıklarını (&amp;, &#39;, &quot;) temizler", () => {
    expect(decodeHtmlEntities("Fast &amp; Furious")).toBe("Fast & Furious");
    expect(decodeHtmlEntities("Schindler&#39;s List")).toBe("Schindler's List");
    expect(decodeHtmlEntities("&quot;Her&quot;")).toBe('"Her"');

    const raw = 'Name,Year\n"Fast &amp; Furious",2009\n"Schindler&#39;s List",1993';
    const { data } = parseCsv(raw);
    expect(data[0].name).toBe("Fast & Furious");
    expect(data[1].name).toBe("Schindler's List");
  });

  test("tırnak içi virgül ve kaçışlı çift tırnakları (\"\" ) doğru işler", () => {
    const raw = 'Title,Year,Comment\n"Mission: Impossible, Part 1",1996,"Great ""action"" movie"\nAvatar,2009,Good';
    const { data } = parseCsv(raw);

    expect(data.length).toBe(2);
    expect(data[0].title).toBe("Mission: Impossible, Part 1");
    expect(data[0].comment).toBe('Great "action" movie');
  });

  test("UTF-8 BOM önekini temizler", () => {
    const raw = "\uFEFFName,Year\nMatrix,1999";
    const { headers, data } = parseCsv(raw);

    expect(headers).toEqual(["name", "year"]);
    expect(data[0].name).toBe("Matrix");
  });
});

describe("Letterboxd CSV Importer (Single)", () => {
  test("Letterboxd başlıklarını tanır", () => {
    const validHeaders = ["Date", "Name", "Year", "Letterboxd URI", "Rating"];
    expect(isLetterboxdCsv(validHeaders)).toBe(true);

    const invalidHeaders = ["id", "title", "user_score"];
    expect(isLetterboxdCsv(invalidHeaders)).toBe(false);
  });

  test("Letterboxd izleme günlüğünü normalize eder ve 5 yıldızı 10'luk sisteme çevirir", () => {
    const rawLetterboxd = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2024-01-10,Inception,2010,https://boxd.it/123,4.5,,,2024-01-09
2024-01-12,Oppenheimer,2023,https://boxd.it/456,5,,,2024-01-11
2024-01-15,Tenet,2020,https://boxd.it/789,3.5,,,2024-01-14`;

    const result = parseLetterboxdCsv(rawLetterboxd);
    expect(result.source).toBe("letterboxd");
    expect(result.type).toBe("diary");
    expect(result.items.length).toBe(3);

    // Inception: 4.5 * 2 = 9
    expect(result.items[0].title).toBe("Inception");
    expect(result.items[0].year).toBe(2010);
    expect(result.items[0].rating).toBe(9);
    expect(result.items[0].watchedDate).toBe("2024-01-09");
    expect(result.items[0].targetList).toBe("watchedMovies");

    // Oppenheimer: 5 * 2 = 10
    expect(result.items[1].rating).toBe(10);

    // Tenet: 3.5 * 2 = 7
    expect(result.items[2].rating).toBe(7);
  });

  test("Letterboxd reviews CSV'sini ve inceleme metnini doğru ayıklar", () => {
    const rawReviews = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date
2026-06-08,The Prestige,2006,https://boxd.it/eHicpH,5,Yes,"Masterpiece storytelling.",,2026-06-08`;

    const result = parseLetterboxdCsv(rawReviews);
    expect(result.type).toBe("reviews");
    expect(result.items[0].title).toBe("The Prestige");
    expect(result.items[0].rating).toBe(10);
    expect(result.items[0].isRewatch).toBe(true);
    expect(result.items[0].review).toBe("Masterpiece storytelling.");
  });

  test("Letterboxd watchlist CSV'sini dosya ipucu ile algılar", () => {
    const rawWatchlist = `Date,Name,Year,Letterboxd URI
2024-02-01,Dune: Part Two,2024,https://boxd.it/abc`;

    const result = parseLetterboxdCsv(rawWatchlist, "watchlist.csv");
    expect(result.source).toBe("letterboxd");
    expect(result.type).toBe("watchlist");
    expect(result.items[0].targetList).toBe("watchList");
  });
});

describe("Letterboxd Bundle & ZIP Importer", () => {
  test("ratings 0.5-5.0 aralığını 1-10 skalasına doğru çevirir", () => {
    expect(normalizeLetterboxdRating(0.5)).toBe(1);
    expect(normalizeLetterboxdRating("2.5")).toBe(5);
    expect(normalizeLetterboxdRating(5)).toBe(10);
    expect(normalizeLetterboxdRating("")).toBe(null);
    expect(normalizeLetterboxdRating(null)).toBe(null);
  });

  test("watched, diary, ratings, watchlist ve reviews dosyalarını tekilleştirip birleştirir", () => {
    const filesMap = {
      "watched.csv": `Date,Name,Year,Letterboxd URI
2024-01-01,Inception,2010,https://boxd.it/123
2024-01-02,Interstellar,2014,https://boxd.it/456
2024-01-03,Memento,2000,https://boxd.it/789`,

      "ratings.csv": `Date,Name,Year,Letterboxd URI,Rating
2024-01-01,Inception,2010,https://boxd.it/123,4.5
2024-01-02,Interstellar,2014,https://boxd.it/456,5`,

      "diary.csv": `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2024-01-10,Inception,2010,https://boxd.it/123,4.5,Yes,,2024-01-09
2025-06-15,Inception,2010,https://boxd.it/123,5,Yes,,2025-06-14`,

      "reviews.csv": `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date
2024-01-10,Inception,2010,https://boxd.it/123,4.5,Yes,"Incredible film",,2024-01-09`,

      "watchlist.csv": `Date,Name,Year,Letterboxd URI
2024-02-01,Oppenheimer,2023,https://boxd.it/999`,

      "lists/my-favorites.csv": `Position,Name,Year,URL,Description
1,Inception,2010,https://boxd.it/123,
2,Interstellar,2014,https://boxd.it/456,`,
    };

    const bundle = parseLetterboxdBundle(filesMap);
    expect(bundle.source).toBe("letterboxd_bundle");
    expect(bundle.stats.watchedCount).toBe(3); // Inception, Interstellar, Memento
    expect(bundle.stats.watchlistCount).toBe(1); // Oppenheimer
    expect(bundle.stats.ratingsCount).toBe(2); // Inception (10/10), Interstellar (10/10)
    expect(bundle.stats.reviewsCount).toBe(1); // Inception review
    expect(bundle.stats.listsCount).toBe(1); // My Favorites

    // Inception'ın harmanlanmış zengin kaydı:
    const inception = bundle.watchedItems.find((i) => i.title === "Inception");
    expect(inception).toBeDefined();
    // ratings.csv filmin GÜNCEL puanıdır (4.5 → 9); günlükteki eski/yeni puanlar onu ezmez.
    expect(inception.rating).toBe(9);
    expect(inception.watchedDate).toBe("2025-06-14"); // en son izleme tarihi
    // Günlük tarihleri varsa yalnız onlar izlemedir; watched.csv'nin "Date"i günlüğe ekleme günü.
    expect(inception.watchDates).toEqual(["2024-01-09", "2025-06-14"]);
    expect(inception.isRewatch).toBe(true);
    expect(inception.review).toBe("Incredible film");
    expect(inception.targetList).toBe("watchedMovies");

    // Watchlist kaydı:
    const oppenheimer = bundle.watchlistItems.find((i) => i.title === "Oppenheimer");
    expect(oppenheimer).toBeDefined();
    expect(oppenheimer.targetList).toBe("watchList");
  });

  test("ZIP arşivini (JSZip simülasyonu) bellek içinde açıp verileri ayrıştırır", async () => {
    const zip = new JSZip();
    zip.file("watched.csv", `Date,Name,Year,Letterboxd URI\n2024-01-01,The Dark Knight,2008,https://boxd.it/tdk`);
    zip.file("ratings.csv", `Date,Name,Year,Letterboxd URI,Rating\n2024-01-01,The Dark Knight,2008,https://boxd.it/tdk,5`);
    zip.file("watchlist.csv", `Date,Name,Year,Letterboxd URI\n2024-02-01,Avatar 3,2025,https://boxd.it/av3`);

    const base64Zip = await zip.generateAsync({ type: "base64" });
    const bundle = await parseLetterboxdZip(base64Zip, { isBase64: true });

    expect(bundle.source).toBe("letterboxd_bundle");
    expect(bundle.stats.watchedCount).toBe(1);
    expect(bundle.stats.watchlistCount).toBe(1);
    expect(bundle.watchedItems[0].title).toBe("The Dark Knight");
    expect(bundle.watchedItems[0].rating).toBe(10);
    expect(bundle.watchlistItems[0].title).toBe("Avatar 3");
  });
});

describe("IMDb CSV Importer", () => {
  test("IMDb başlıklarını tanır", () => {
    const validHeaders = ["Const", "Your Rating", "Date Rated", "Title", "Year", "Title Type"];
    expect(isImdbCsv(validHeaders)).toBe(true);
  });

  test("IMDb puan listesini, süre (runtime) ve türleri (genres) normalize eder", () => {
    const rawImdb = `Const,Your Rating,Date Rated,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors
tt0111161,10,2023-05-10,The Shawshank Redemption,https://www.imdb.com/title/tt0111161/,movie,9.3,142,1994,Drama,2800000,1994-09-22,Frank Darabont
tt0903747,9,2023-06-15,Breaking Bad,https://www.imdb.com/title/tt0903747/,tvSeries,9.5,49,2008,"Crime, Drama, Thriller",2000000,2008-01-20,Vince Gilligan`;

    const result = parseImdbCsv(rawImdb);
    expect(result.source).toBe("imdb");
    expect(result.type).toBe("watched");
    expect(result.items.length).toBe(2);

    // Film kaydı
    expect(result.items[0].imdbId).toBe("tt0111161");
    expect(result.items[0].title).toBe("The Shawshank Redemption");
    expect(result.items[0].mediaType).toBe("movie");
    expect(result.items[0].year).toBe(1994);
    expect(result.items[0].rating).toBe(10);
    expect(result.items[0].rawMinutes).toBe(142);
    expect(result.items[0].rawGenres).toEqual(["Drama"]);
    expect(result.items[0].targetList).toBe("watchedMovies");

    // Dizi kaydı
    expect(result.items[1].imdbId).toBe("tt0903747");
    expect(result.items[1].title).toBe("Breaking Bad");
    expect(result.items[1].mediaType).toBe("tv");
    expect(result.items[1].rawMinutes).toBe(49);
    expect(result.items[1].rawGenres).toEqual(["Crime", "Drama", "Thriller"]);
  });
});

describe("CSV Validation & Error Handling", () => {
  test("Uyumsuz başlıkları olan CSV dosyalarını reddeder", () => {
    const invalidCsv = "Product,Price,Quantity\nApple,5,10\nOrange,8,3";
    const { headers } = parseCsv(invalidCsv);

    expect(isLetterboxdCsv(headers)).toBe(false);
    expect(isImdbCsv(headers)).toBe(false);
  });

  test("Boş satırları veya tek başlıklı geçersiz verileri doğru işler", () => {
    const emptyCsv = "";
    const { headers, data } = parseCsv(emptyCsv);
    expect(headers).toEqual([]);
    expect(data).toEqual([]);
  });
});
