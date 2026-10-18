// __tests__/libraryExport.test.js
//
// Kütüphane dışa aktarma: saf çekirdek (utils/libraryExport.js).
const {
  LETTERBOXD_MAX_BYTES,
  buildCsvBundle,
  buildLetterboxdWatched,
  buildLetterboxdWatchlist,
  buildLibraryCsv,
  buildLibrarySnapshot,
  chunkFileNames,
  cleanRating,
  csvCell,
  csvChunks,
  csvRow,
  exportFileName,
  isSnapshotEmpty,
  serializeSnapshot,
  utf8Length,
} = require("../utils/libraryExport");
const { parseCsv } = require("../services/import/csvParser");

const NOW = new Date(2026, 9, 18, 12);

// Projenin okuyucusu başlıkları KÜÇÜK harfe çevirir; ham başlık satırını ayrıca doğrularız.
const headerLine = (csv) => csv.slice(0, csv.indexOf("\n"));

const movie = (id, name, extra = {}) => ({ id, type: "movie", name, genres: ["Drama"], minutes: 120, ...extra });
const watched = (id, name, dates, extra = {}) =>
  movie(id, name, { dateAdded: dates[dates.length - 1], watchEvents: dates.map((d, i) => ({ id: `e${id}${i}`, watchedAt: d, scope: "movie" })), ...extra });
const show = (id, name, seasons, extra = {}) => ({ id, name, type: "tv", genres: ["Dizi"], seasons, ...extra });
const ep = (episodeNumber, watchedAt) => ({ episodeNumber, watchEvents: [{ id: `x${episodeNumber}${watchedAt}`, watchedAt, scope: "episode" }] });

const library = () =>
  buildLibrarySnapshot(
    {
      lists: {
        watchedMovies: [
          watched(1, "Alfa", ["2026-01-05"]),
          watched(2, "Beta, Gamma", ["2025-03-01", "2026-02-02"]),
          movie(3, "Tarihsiz", { dateAdded: undefined }),
        ],
        watchedTv: [show(10, "Dizi Bir", [{ seasonNumber: 1, episodes: [ep(2, "2026-04-02"), ep(1, "2026-04-01")] }, { seasonNumber: 2, episodes: [ep(1, "2026-05-01")] }])],
        watchList: [movie(20, "Bekleyen"), { id: 21, type: "tv", name: "Bekleyen Dizi" }],
        favorites: [movie(30, "Sevilen")],
        "Benim Listem": [movie(40, "Özel"), { id: 41, type: "tv", name: "Özel Dizi" }],
      },
      ratings: { movie_1: 8, movie_2: 7.5, tv_10: 9, movie_999: 6, bozuk: 5, movie_3: 0 },
    },
    { now: NOW, appVersion: "1.4.8", platform: "ios" },
  );

describe("buildLibrarySnapshot", () => {
  it("üst bilgi ve sayaçlar", () => {
    const snap = library();
    expect(snap).toMatchObject({ app: "seelogd", kind: "library-export", version: 1, appVersion: "1.4.8", platform: "ios" });
    expect(snap.exportedAt).toBe(NOW.toISOString());
    expect(snap.counts).toEqual({
      watchedMovies: 3,
      watchedShows: 1,
      watchedEpisodes: 3,
      watchList: 2,
      favorites: 1,
      customLists: 1,
      customListItems: 2,
      ratings: 4, // 0 ve bozuk anahtar elenir; listede olmayan movie_999 KALIR (puan tek başına bilgi)
    });
  });

  it("izlenen film: tekrar izleme tarihleri artan, puan eşleşir", () => {
    const [alfa, beta, tarihsiz] = library().watchedMovies;
    expect(alfa).toMatchObject({ tmdbId: 1, type: "movie", title: "Alfa", rating: 8, watchedDates: ["2026-01-05"], minutes: 120 });
    expect(beta.watchedDates).toEqual(["2025-03-01", "2026-02-02"]);
    expect(beta.rating).toBe(7.5);
    expect(tarihsiz.watchedDates).toEqual([]);
    expect(tarihsiz.rating).toBeNull();
  });

  it("dizi: bölümler sezon/bölüm sırasıyla, tarihleriyle", () => {
    const [dizi] = library().watchedShows;
    expect(dizi).toMatchObject({ tmdbId: 10, type: "tv", episodesWatched: 3, rating: 9 });
    expect(dizi.episodes).toEqual([
      { season: 1, episode: 1, watchedDates: ["2026-04-01"] },
      { season: 1, episode: 2, watchedDates: ["2026-04-02"] },
      { season: 2, episode: 1, watchedDates: ["2026-05-01"] },
    ]);
  });

  it("özel listeler ayrı, reserved adlar özel sayılmaz", () => {
    const snap = library();
    expect(snap.customLists).toEqual([
      expect.objectContaining({ name: "Benim Listem", items: [expect.objectContaining({ tmdbId: 40 }), expect.objectContaining({ tmdbId: 41, type: "tv" })] }),
    ]);
  });

  it("puanlar sıralı ve temiz", () => {
    expect(library().ratings).toEqual([
      { type: "movie", tmdbId: 1, rating: 8 },
      { type: "movie", tmdbId: 2, rating: 7.5 },
      { type: "movie", tmdbId: 999, rating: 6 },
      { type: "tv", tmdbId: 10, rating: 9 },
    ]);
  });

  it("kimliği ya da adı olmayan öğeyi atar; bozuk girdide çökmez", () => {
    const snap = buildLibrarySnapshot({ lists: { watchList: [null, {}, { id: 0, name: "x" }, { id: 5 }, movie(6, "Tamam")] } }, { now: NOW });
    expect(snap.watchList.map((e) => e.tmdbId)).toEqual([6]);
    for (const input of [undefined, null, {}, { lists: null }, { lists: { watchedTv: "x" } }]) {
      expect(isSnapshotEmpty(buildLibrarySnapshot(input, { now: NOW }))).toBe(true);
    }
  });

  it("JSON gidiş-dönüş kayıpsız", () => {
    const snap = library();
    expect(JSON.parse(serializeSnapshot(snap))).toEqual(snap);
  });

  it("boşluk denetimi: yalnız puan bile içerik sayılır", () => {
    expect(isSnapshotEmpty(buildLibrarySnapshot({ lists: {}, ratings: { movie_1: 5 } }, { now: NOW }))).toBe(false);
  });
});

describe("CSV hücre ve satır", () => {
  it("özel karakterleri tırnaklar, tırnağı ikiler", () => {
    expect(csvCell("düz")).toBe("düz");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('o "ok"')).toBe('"o ""ok"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(7)).toBe("7");
  });

  it("formül koruması yalnız istenince ve yalnız metinde", () => {
    expect(csvCell("=HYPERLINK()")).toBe("=HYPERLINK()");
    expect(csvCell("=HYPERLINK()", { guard: true })).toBe("'=HYPERLINK()");
    expect(csvCell("-5 derece", { guard: true })).toBe("'-5 derece");
    expect(csvCell("+1", { guard: true })).toBe("'+1");
    expect(csvCell("@kullanici", { guard: true })).toBe("'@kullanici");
    expect(csvCell(-3, { guard: true })).toBe("-3"); // sayı: metin değil
    expect(csvCell("normal", { guard: true })).toBe("normal");
  });

  it("satır ve ayrıştırıcı gidiş-dönüşü (projenin kendi okuyucusuyla)", () => {
    const text = [csvRow(["a", "b", "c"]), csvRow(["1", 'x, "y"', "z"])].join("\n");
    const { headers, data } = parseCsv(text);
    expect(headers).toEqual(["a", "b", "c"]);
    expect(data[0]).toEqual({ a: "1", b: 'x, "y"', c: "z" });
  });

  it("UTF-8 bayt uzunluğu", () => {
    expect(utf8Length("abc")).toBe(3);
    expect(utf8Length("çğış")).toBe(8);
    expect(utf8Length("€")).toBe(3);
    expect(utf8Length("🎬")).toBe(4);
  });
});

describe("csvChunks", () => {
  it("sınır altında tek parça; her parça başlık taşır", () => {
    const rows = Array.from({ length: 50 }, (_, i) => [i, `Film ${i}`]);
    const one = csvChunks(["id", "name"], rows);
    expect(one).toHaveLength(1);
    const many = csvChunks(["id", "name"], rows, { maxBytes: 120 });
    expect(many.length).toBeGreaterThan(2);
    many.forEach((chunk) => expect(chunk.startsWith("id,name\n")).toBe(true));
    // Hiçbir satır kaybolmaz / tekrarlanmaz
    const ids = many.flatMap((chunk) => chunk.trim().split("\n").slice(1).map((l) => Number(l.split(",")[0])));
    expect(ids).toEqual(rows.map((r) => r[0]));
    many.forEach((chunk) => expect(utf8Length(chunk)).toBeLessThanOrEqual(120));
  });

  it("sınırı tek başına aşan satır kendi parçasına konur", () => {
    const chunks = csvChunks(["a"], [["x".repeat(500)], ["y"]], { maxBytes: 100 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain("xxxx");
    expect(chunks[1]).toContain("y");
  });

  it("satır yoksa yalnız başlık", () => {
    expect(csvChunks(["a", "b"], [])).toEqual(["a,b\n"]);
  });

  it("dosya adları: tek parça yalın, çoksa numaralı", () => {
    expect(chunkFileNames("x", 1)).toEqual(["x.csv"]);
    expect(chunkFileNames("x", 3)).toEqual(["x-1.csv", "x-2.csv", "x-3.csv"]);
  });
});

describe("Letterboxd dosyaları", () => {
  it("izlenenler: sütunlar Letterboxd belgesindeki gibi; tekrar izleme Rewatch=true; tarihsiz tek satır", () => {
    const [csv] = buildLetterboxdWatched(library());
    const { data } = parseCsv(csv);
    expect(headerLine(csv)).toBe("tmdbID,Title,Year,WatchedDate,Rating10,Rewatch");
    expect(data).toEqual([
      { tmdbid: "1", title: "Alfa", year: "", watcheddate: "2026-01-05", rating10: "8", rewatch: "" },
      { tmdbid: "2", title: "Beta, Gamma", year: "", watcheddate: "2025-03-01", rating10: "8", rewatch: "" },
      { tmdbid: "2", title: "Beta, Gamma", year: "", watcheddate: "2026-02-02", rating10: "8", rewatch: "true" },
      { tmdbid: "3", title: "Tarihsiz", year: "", watcheddate: "", rating10: "", rewatch: "" },
    ]);
  });

  it("Rating10 tam sayı 1–10 (7,5 → 8; 0,4 → 1)", () => {
    const snap = buildLibrarySnapshot(
      { lists: { watchedMovies: [watched(1, "A", ["2026-01-01"]), watched(2, "B", ["2026-01-01"])] }, ratings: { movie_1: 7.5, movie_2: 0.4 } },
      { now: NOW },
    );
    const { data } = parseCsv(buildLetterboxdWatched(snap)[0]);
    expect(data.map((r) => r.rating10)).toEqual(["8", "1"]);
  });

  it("dizi Letterboxd dosyalarında YOK", () => {
    const text = buildLetterboxdWatched(library()).join("") + buildLetterboxdWatchlist(library()).join("");
    expect(text).not.toContain("Dizi Bir");
    expect(text).not.toContain("Bekleyen Dizi");
  });

  it("izleme listesi dosyası yalnız film", () => {
    const csv = buildLetterboxdWatchlist(library())[0];
    const { data } = parseCsv(csv);
    expect(headerLine(csv)).toBe("tmdbID,Title,Year");
    expect(data.map((r) => r.title)).toEqual(["Bekleyen"]);
  });

  it("büyük kütüphane 1 MB altı parçalara bölünür", () => {
    const many = Array.from({ length: 40000 }, (_, i) => watched(i + 1, `Çok Uzun Bir Film Adı Numara ${i + 1}`, ["2026-01-01", "2026-02-01"]));
    const chunks = buildLetterboxdWatched(buildLibrarySnapshot({ lists: { watchedMovies: many } }, { now: NOW }));
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(utf8Length(chunk)).toBeLessThanOrEqual(LETTERBOXD_MAX_BYTES);
      expect(chunk.startsWith("tmdbID,Title,Year,WatchedDate,Rating10,Rewatch\n")).toBe(true);
    });
    const rows = chunks.reduce((sum, chunk) => sum + chunk.trim().split("\n").length - 1, 0);
    expect(rows).toBe(80000);
  });
});

describe("library.csv", () => {
  it("BOM'lu, tüm listeler tek tabloda, diziler bölüm sayısıyla", () => {
    const text = buildLibraryCsv(library());
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const { headers, data } = parseCsv(text.slice(1));
    expect(headers).toEqual(["list", "type", "tmdb_id", "title", "rating", "added", "watched_dates", "episodes_watched", "genres", "minutes"]);
    expect(data.map((r) => r.list)).toEqual([
      "watchedMovies", "watchedMovies", "watchedMovies", "watchedTv", "watchList", "watchList", "favorites", "Benim Listem", "Benim Listem",
    ]);
    const beta = data.find((r) => r.tmdb_id === "2");
    expect(beta).toMatchObject({ title: "Beta, Gamma", watched_dates: "2025-03-01; 2026-02-02", rating: "7.5" });
    const dizi = data.find((r) => r.list === "watchedTv");
    expect(dizi).toMatchObject({ episodes_watched: "3", watched_dates: "2026-04-01; 2026-04-02; 2026-05-01" });
  });

  it("formül gibi başlayan başlık etkisizleşir", () => {
    const snap = buildLibrarySnapshot({ lists: { watchList: [movie(1, "=SUM(A1)"), movie(2, "@x")] } }, { now: NOW });
    const text = buildLibraryCsv(snap);
    expect(text).toContain("'=SUM(A1)");
    expect(text).toContain("'@x");
  });
});

describe("ZIP paketi", () => {
  it("dosyalar: library.csv + letterboxd + README", () => {
    const names = buildCsvBundle(library(), { readme: "merhaba" }).map((f) => f.name);
    expect(names).toEqual(["library.csv", "letterboxd-watched.csv", "letterboxd-watchlist.csv", "README.txt"]);
  });

  it("film yoksa Letterboxd dosyaları eklenmez; README boşsa eklenmez", () => {
    const onlyShows = buildLibrarySnapshot({ lists: { watchedTv: [show(1, "D", [{ seasonNumber: 1, episodes: [ep(1, "2026-01-01")] }])] } }, { now: NOW });
    expect(buildCsvBundle(onlyShows).map((f) => f.name)).toEqual(["library.csv"]);
  });

  it("dosya adı tarihli", () => {
    expect(exportFileName("json", NOW)).toBe("seelogd-library-2026-10-18.json");
    expect(exportFileName("zip", new Date(2026, 0, 5))).toBe("seelogd-library-2026-01-05.zip");
  });

  it("puan temizleme", () => {
    expect(cleanRating("8")).toBe(8);
    expect(cleanRating(11)).toBe(10);
    expect(cleanRating(0)).toBeNull();
    expect(cleanRating("x")).toBeNull();
    expect(cleanRating(7.55)).toBe(7.6);
  });
});
