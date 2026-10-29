// __tests__/importSources.test.js
// Letterboxd / IMDb dosya tanıma ve paket birleştirme: gerçek dışa aktarım biçiminin
// tuzakları (deleted/ klasörü, liste bilgi bloğu, IMDb tür adları, yeniden adlandırılan dosyalar).

import JSZip from "jszip";
import {
  buildBundleFromFiles,
  detectImportFileKind,
  isBundleResult,
  letterboxdFileRole,
  parseImportText,
} from "../services/import/importSources";
import {
  isIgnoredExportPath,
  parseLetterboxdBundle,
  parseLetterboxdListCsv,
  parseLetterboxdZip,
} from "../services/import/letterboxdBundleImporter";
import { imdbMediaType, parseImdbCsv } from "../services/import/imdbImporter";
import { analyzeImport } from "../services/import/importAnalysis";

const LIST_V7 = `Letterboxd list export v7
Date,Name,Tags,URL,Description
2021-03-14,Hafta Sonu Seçkisi,,https://letterboxd.com/u/list/weekend/,"Çok satırlı
açıklama"

Position,Name,Year,URL,Description
1,Parasite,2019,https://letterboxd.com/film/parasite-2019/,
2,Amélie,2001,https://letterboxd.com/film/amelie/,
2,Amélie,2001,https://letterboxd.com/film/amelie/,`;

describe("Letterboxd dışa aktarım klasörleri", () => {
  test("deleted/ orphaned/ likes/ __MACOSX/ ve gizli dosyalar yok sayılır", () => {
    expect(isIgnoredExportPath("deleted/diary.csv")).toBe(true);
    expect(isIgnoredExportPath("export/orphaned/diary.csv")).toBe(true);
    expect(isIgnoredExportPath("likes/films.csv")).toBe(true);
    expect(isIgnoredExportPath("__MACOSX/._diary.csv")).toBe(true);
    expect(isIgnoredExportPath("._watched.csv")).toBe(true);
    expect(isIgnoredExportPath("diary.csv")).toBe(false);
    expect(isIgnoredExportPath("letterboxd-user/lists/my-list.csv")).toBe(false);
  });

  test("alfabede önce gelen deleted/diary.csv kökteki günlüğün yerine GEÇMEZ", () => {
    const bundle = parseLetterboxdBundle({
      "deleted/diary.csv": "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2020-01-01,Silinen Film,1999,u,5,,,2020-01-01",
      "diary.csv": "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2024-02-02,Gerçek Film,2010,u,4,,,2024-02-01",
      "deleted/lists/eski.csv": LIST_V7,
    });
    expect(bundle.watchedItems.map((item) => item.title)).toEqual(["Gerçek Film"]);
    expect(bundle.customLists).toHaveLength(0);
  });

  test("ertesi gün günlüğe yazılan film iki kez izlenmiş sayılmaz", () => {
    const bundle = parseLetterboxdBundle({
      "watched.csv": "Date,Name,Year,Letterboxd URI\n2024-05-02,Dune,2021,u",
      "ratings.csv": "Date,Name,Year,Letterboxd URI,Rating\n2024-05-02,Dune,2021,u,4",
      "diary.csv": "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2024-05-02,Dune,2021,u,4,,,2024-05-01",
    });
    expect(bundle.watchedItems[0]).toMatchObject({ watchDates: ["2024-05-01"], isRewatch: false, rating: 8 });
  });

  test("günlüğü olmayan film watched.csv tarihine düşer", () => {
    const bundle = parseLetterboxdBundle({ "watched.csv": "Date,Name,Year,Letterboxd URI\n2023-01-01,Heat,1995,u" });
    expect(bundle.watchedItems[0].watchDates).toEqual(["2023-01-01"]);
  });

  test("ratings.csv güncel puandır; eski günlük puanı onu ezmez", () => {
    const bundle = parseLetterboxdBundle({
      "ratings.csv": "Date,Name,Year,Letterboxd URI,Rating\n2023-01-01,Heat,1995,u,4.5",
      "diary.csv": "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2020-01-01,Heat,1995,u,3,,,2020-01-01",
    });
    expect(bundle.watchedItems[0].rating).toBe(9);
  });
});

describe("Letterboxd liste dosyaları", () => {
  test("v7 bilgi bloğu: gerçek liste adı okunur, öğeler tekilleşir", () => {
    const parsed = parseLetterboxdListCsv(LIST_V7, "fallback");
    expect(parsed.name).toBe("Hafta Sonu Seçkisi");
    expect(parsed.items.map((item) => item.title)).toEqual(["Parasite", "Amélie"]);
    expect(parsed.items[0]).toMatchObject({ year: 2019 });
  });

  test("düz Position,Name,Year listesi dosya adından adlandırılır", () => {
    const parsed = parseLetterboxdListCsv("Position,Name,Year,URL\n1,Heat,1995,u", "Gece Filmleri");
    expect(parsed).toEqual({ name: "Gece Filmleri", items: [{ title: "Heat", year: 1995, letterboxdUri: "u" }] });
  });

  test("tek başına seçilen liste dosyası özel liste paketi olur", () => {
    const parsed = parseImportText(LIST_V7, "weekend.csv");
    expect(isBundleResult(parsed)).toBe(true);
    expect(parsed.customLists[0]).toMatchObject({ name: "Hafta Sonu Seçkisi" });
    expect(parsed.customLists[0].items[0]).toMatchObject({ customListName: "Hafta Sonu Seçkisi", importSource: "letterboxd" });
    expect(parsed.stats).toMatchObject({ listsCount: 1, listItemsCount: 2, totalUniqueItems: 0 });
  });

  test("klasörden seçilen (lists/ öneki olmayan) liste dosyası da tanınır", () => {
    const bundle = buildBundleFromFiles({
      "watched.csv": "Date,Name,Year,Letterboxd URI\n2023-01-01,Heat,1995,u",
      "weekend.csv": LIST_V7,
    });
    expect(bundle.stats.listsCount).toBe(1);
    expect(bundle.stats.watchedCount).toBe(1);
  });
});

describe("İçerik tanıma ve karışık paketler", () => {
  const IMDB_RATINGS = `Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres
tt0111161,8,2023-05-10,The Shawshank Redemption,The Shawshank Redemption,u,Movie,9.3,142,1994,Drama`;

  test("dosya türü adına değil içeriğine göre bulunur", () => {
    expect(detectImportFileKind(LIST_V7)).toBe("letterboxdList");
    expect(detectImportFileKind(IMDB_RATINGS)).toBe("imdb");
    expect(detectImportFileKind("Date,Name,Year,Letterboxd URI\n2023,Heat,1995,u")).toBe("letterboxd");
    expect(detectImportFileKind("a,b\n1,2")).toBe("unknown");
    expect(detectImportFileKind("bin\0ary")).toBe("invalid");
  });

  test("Android'in yeniden adlandırdığı dosyalar rolünü korur", () => {
    expect(letterboxdFileRole("watched (1).csv")).toBe("watched");
    expect(letterboxdFileRole("watchlist-2.csv")).toBe("watchlist");
    expect(letterboxdFileRole("x.csv", ["date", "name", "year", "letterboxd uri", "rating", "rewatch", "watched date"])).toBe("diary");
    expect(letterboxdFileRole("films.csv", ["date", "name", "year", "letterboxd uri"])).toBeNull();
  });

  test("IMDb ratings.csv Letterboxd puanı sanılıp iki katına çıkmaz; kaynaklar birleşir", () => {
    const bundle = buildBundleFromFiles({
      "ratings.csv": IMDB_RATINGS,
      "watched (1).csv": "Date,Name,Year,Letterboxd URI\n2023-01-01,Heat,1995,u",
      "notes.txt": "rastgele",
    });
    expect(bundle.origins).toEqual(["letterboxd", "imdb"]);
    expect(bundle.source).toBe("mixed_bundle");
    const shawshank = bundle.watchedItems.find((item) => item.imdbId === "tt0111161");
    expect(shawshank).toMatchObject({ rating: 8, importSource: "imdb" });
    expect(bundle.unknownFilesCount).toBe(1);
  });

  test("hiç tanınan dosya yoksa anlaşılır hata", () => {
    expect(() => buildBundleFromFiles({ "a.csv": "x,y\n1,2" })).toThrow(expect.objectContaining({ code: "unrecognizedCsv" }));
  });
});

describe("IMDb biçimi", () => {
  test("tür tablosu: TV filmi film, dizi dizi, bölüm/oyun desteklenmez", () => {
    expect(imdbMediaType("TV Movie")).toBe("movie");
    expect(imdbMediaType("tvMovie")).toBe("movie");
    expect(imdbMediaType("TV Special")).toBe("movie");
    expect(imdbMediaType("TV Series")).toBe("tv");
    expect(imdbMediaType("tvMiniSeries")).toBe("tv");
    expect(imdbMediaType("TV Episode")).toBeNull();
    expect(imdbMediaType("Video Game")).toBeNull();
  });

  test("yeni izleme listesi dışa aktarımı ('Your Rating' sütunlu) izleme listesi olarak tanınır", () => {
    const result = parseImdbCsv(`Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated
1,tt1375666,2024-01-02,2024-01-02,,Başlangıç,Inception,u,Movie,8.8,148,2010,Sci-Fi,1,2010-07-16,Nolan,,
2,tt0944947,2024-01-03,2024-01-03,,Game of Thrones,Game of Thrones,u,TV Series,9.2,57,2011,Drama,1,2011-04-17,,,
3,tt1480055,2024-01-04,2024-01-04,,Winter Is Coming,Winter Is Coming,u,TV Episode,9,62,2011,Drama,1,2011-04-17,,,`);
    expect(result.type).toBe("watchlist");
    expect(result.skippedCount).toBe(1);
    expect(result.items.map((item) => [item.mediaType, item.targetList])).toEqual([
      ["movie", "watchList"],
      ["tv", "watchList"],
    ]);
    expect(result.items[0]).toMatchObject({ originalTitle: "Inception", dateAdded: "2024-01-02", importSource: "imdb" });
  });
});

describe("ZIP arşivi", () => {
  test("deleted/ ve __MACOSX/ açılmaz, dosya ilerlemesi bildirilir", async () => {
    const zip = new JSZip();
    zip.file("watched.csv", "Date,Name,Year,Letterboxd URI\n2024-01-01,Heat,1995,u");
    zip.file("deleted/diary.csv", "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2020-01-01,Silinen,1999,u,5,,,2020-01-01");
    zip.file("__MACOSX/._watched.csv", "\0\0bin");
    zip.file("lists/weekend.csv", LIST_V7);
    const progress = jest.fn();
    const bundle = await parseLetterboxdZip(await zip.generateAsync({ type: "base64" }), { onProgress: progress });
    expect(bundle.watchedItems.map((item) => item.title)).toEqual(["Heat"]);
    expect(bundle.customLists[0].name).toBe("Hafta Sonu Seçkisi");
    expect(progress).toHaveBeenLastCalledWith(2, 2, expect.any(String));
  });

  test("bozuk ZIP anlaşılır hata kodu verir", async () => {
    await expect(parseLetterboxdZip("bm90IGEgemlw", { isBase64: true })).rejects.toMatchObject({ code: "zipOpen" });
  });
});

describe("İçerik analizi", () => {
  test("sayılar, puan dağılımı, yıllar, dönemler ve tarih aralığı", () => {
    const bundle = parseLetterboxdBundle({
      "diary.csv": `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2023-01-02,Heat,1995,u,4.5,,,2023-01-01
2024-03-02,Heat,1995,u,5,Yes,,2024-03-01
2024-05-02,Dune,2021,u,3,,,2024-05-01`,
      "reviews.csv": "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n2024-05-02,Dune,2021,u,3,,Güzel,,2024-05-01",
      "watchlist.csv": "Date,Name,Year,Letterboxd URI\n2024-06-01,Alien,1979,u",
      "lists/x.csv": LIST_V7,
    });
    const analysis = analyzeImport(bundle);
    expect(analysis.totals).toMatchObject({
      watched: 2,
      watchlist: 1,
      lists: 1,
      listItems: 2,
      ratings: 2,
      reviews: 1,
      rewatches: 1,
      watchEvents: 3,
      titles: 5,
    });
    expect(analysis.ratingHistogram[9]).toBe(1); // Heat: 5★ → 10
    expect(analysis.ratingHistogram[5]).toBe(1); // Dune: 3★ → 6
    expect(analysis.ratingAverage).toBe(8);
    expect(analysis.byYear).toEqual([{ year: 2023, count: 1 }, { year: 2024, count: 2 }]);
    expect(analysis.dateRange).toEqual({ from: "2023-01-01", to: "2024-05-01" });
    expect(analysis.decades[0]).toEqual({ decade: 2020, count: 1 }); // eşitlikte yeni dönem önde
    expect(analysis.decades).toHaveLength(4);
    expect(analysis.estimateMs).toBeGreaterThan(0);
  });
});
