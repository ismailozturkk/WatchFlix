// __tests__/libraryExportFiles.test.js
//
// services/libraryExportFiles.js: dosyaya yazma + paylaşım. Dosya sistemi ve paylaşım taklit edilir;
// ZIP gerçek JSZip ile açılıp içeriği doğrulanır.
const mockWrites = {};
let mockExists = false;
const mockDelete = jest.fn();
jest.mock("expo-file-system", () => ({
  Paths: { cache: "cache://" },
  File: class {
    constructor(dir, name) {
      this.uri = `${dir}${name}`;
      this.name = name;
    }
    get exists() {
      return mockExists;
    }
    delete() {
      mockDelete(this.name);
    }
    write(content) {
      if (mockWrites.fail) throw new Error("disk dolu");
      mockWrites[this.name] = content;
    }
  },
}));
const mockShare = jest.fn(async () => {});
let mockSharingAvailable = true;
jest.mock("expo-sharing", () => ({
  isAvailableAsync: async () => mockSharingAvailable,
  shareAsync: (...args) => mockShare(...args),
}));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { version: "1.4.9" } } }));
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));

const JSZip = require("jszip");
const { exportLibraryJson, exportLibraryZip, snapshotFromLibrary } = require("../services/libraryExportFiles");

const lists = {
  watchedMovies: [{ id: 1, type: "movie", name: "Alfa", watchEvents: [{ id: "a", watchedAt: "2026-01-05", scope: "movie" }] }],
  watchList: [{ id: 2, type: "movie", name: "Beta" }],
};
const snapshot = () => snapshotFromLibrary({ lists, ratings: { movie_1: 9 } });

beforeEach(() => {
  Object.keys(mockWrites).forEach((k) => delete mockWrites[k]);
  mockExists = false;
  mockSharingAvailable = true;
  mockShare.mockClear();
  mockDelete.mockClear();
});

it("anlık görüntü uygulama sürümünü ve platformu taşır", () => {
  expect(snapshot()).toMatchObject({ appVersion: "1.4.9", platform: "ios" });
});

describe("JSON", () => {
  it("dosyayı yazar ve paylaşım sayfasını açar", async () => {
    const res = await exportLibraryJson(snapshot(), { dialogTitle: "Başlık" });
    expect(res.ok).toBe(true);
    expect(res.fileName).toMatch(/^seelogd-library-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = JSON.parse(mockWrites[res.fileName]);
    expect(parsed.watchedMovies[0]).toMatchObject({ tmdbId: 1, title: "Alfa", rating: 9, watchedDates: ["2026-01-05"] });
    expect(mockShare).toHaveBeenCalledWith(`cache://${res.fileName}`, expect.objectContaining({ mimeType: "application/json", dialogTitle: "Başlık" }));
  });

  it("aynı adlı eski dosyayı siler", async () => {
    mockExists = true;
    await exportLibraryJson(snapshot());
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("boş kütüphanede yazmaz", async () => {
    const res = await exportLibraryJson(snapshotFromLibrary({ lists: {} }));
    expect(res).toEqual({ ok: false, error: "empty" });
    expect(Object.keys(mockWrites)).toHaveLength(0);
    expect(mockShare).not.toHaveBeenCalled();
  });

  it("yazma hatası fırlatmaz", async () => {
    mockWrites.fail = true;
    expect(await exportLibraryJson(snapshot())).toEqual({ ok: false, error: "write-failed" });
    delete mockWrites.fail;
  });

  it("paylaşım yoksa kod döner", async () => {
    mockSharingAvailable = false;
    expect(await exportLibraryJson(snapshot())).toEqual({ ok: false, error: "sharing-unavailable" });
  });

  it("paylaşım sayfası hata verirse fırlatmaz", async () => {
    mockShare.mockRejectedValueOnce(new Error("iptal"));
    expect(await exportLibraryJson(snapshot())).toEqual({ ok: false, error: "sharing-unavailable" });
  });
});

describe("ZIP", () => {
  it("gerçek ZIP: library.csv + Letterboxd dosyaları + README", async () => {
    const res = await exportLibraryZip(snapshot(), { dialogTitle: "T", readme: "okubeni" });
    expect(res.ok).toBe(true);
    expect(res.fileName).toMatch(/\.zip$/);
    const bytes = mockWrites[res.fileName];
    expect(bytes).toBeInstanceOf(Uint8Array);
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files).sort()).toEqual(["README.txt", "letterboxd-watched.csv", "letterboxd-watchlist.csv", "library.csv"]);
    expect(await zip.file("README.txt").async("string")).toBe("okubeni");
    expect(await zip.file("letterboxd-watched.csv").async("string")).toBe(
      "tmdbID,Title,Year,WatchedDate,Rating10,Rewatch\n1,Alfa,,2026-01-05,9,\n",
    );
    expect(await zip.file("letterboxd-watchlist.csv").async("string")).toBe("tmdbID,Title,Year\n2,Beta,\n");
    expect(mockShare).toHaveBeenCalledWith(`cache://${res.fileName}`, expect.objectContaining({ mimeType: "application/zip" }));
  });

  it("boş kütüphanede ZIP üretmez", async () => {
    expect(await exportLibraryZip(snapshotFromLibrary({ lists: {} }))).toEqual({ ok: false, error: "empty" });
  });

  it("yazma hatası ve paylaşım hatası ayrı kodlar", async () => {
    mockWrites.fail = true;
    expect(await exportLibraryZip(snapshot())).toEqual({ ok: false, error: "write-failed" });
    delete mockWrites.fail;
    mockSharingAvailable = false;
    expect(await exportLibraryZip(snapshot())).toEqual({ ok: false, error: "sharing-unavailable" });
  });
});
