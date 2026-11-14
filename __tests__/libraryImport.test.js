// __tests__/libraryImport.test.js
//
// Kütüphane İÇE AKTARMA çekirdeği: dışa aktarılan JSON → doğrulama → yazım planı (uçtan uca dönüş),
// bozuk/kötü niyetli dosyalar, dizi geçmişinin bölüm bölüm birleşmesi (tekrar aktarımda çoğalmaz),
// Seelogd kimliğiyle ağsız eşleştirme ve ekranın aşama takibi.

jest.mock("axios", () => ({ get: jest.fn() }));

const axios = require("axios");
const { buildLibrarySnapshot } = require("../utils/libraryExport");
const {
  backupCounts,
  buildImportPlan,
  cleanDate,
  parseLibraryBackup,
  planStages,
  reduceStages,
} = require("../utils/libraryImport");
const { mergeRestoredTv } = require("../services/import/importMerge");
const { resolveImportItem, attachSourceData } = require("../services/import/tmdbResolver");
const { LIBRARY_IMPORT_COPY } = require("../screens/tabs/settings/libraryImportCopy");

const NOW = new Date(Date.UTC(2026, 10, 13, 12));

const ep = (episodeNumber, watchedAt, extra = {}) => ({
  episodeNumber,
  episodeMinutes: 45,
  episodeName: `Bölüm ${episodeNumber}`,
  watchEvents: [{ id: `x${episodeNumber}${watchedAt}`, watchedAt, scope: "episode" }],
  ...extra,
});

const exported = () =>
  buildLibrarySnapshot(
    {
      lists: {
        watchedMovies: [
          {
            id: 1,
            type: "movie",
            name: "Alfa",
            poster_path: "/alfa.jpg",
            genres: ["Drama"],
            minutes: 120,
            watchEvents: [
              { id: "a", watchedAt: "2025-03-01", scope: "movie" },
              { id: "b", watchedAt: "2026-02-02", scope: "movie" },
            ],
          },
        ],
        watchedTv: [
          {
            id: 10,
            type: "tv",
            name: "Dizi",
            poster_path: "/dizi.jpg",
            showSeasonCount: 2,
            showEpisodeCount: 16,
            seasons: [{ seasonNumber: 1, episodes: [ep(1, "2026-04-01"), ep(2, "2026-04-01"), ep(3, "2026-04-03")] }],
          },
        ],
        watchList: [{ id: 2, type: "movie", name: "Bekleyen", poster_path: "/b.jpg" }],
        favorites: [{ id: 1, type: "movie", name: "Alfa", poster_path: "/alfa.jpg" }],
        "Benim Listem": [{ id: 3, type: "movie", name: "Özel" }],
      },
      ratings: { movie_1: 8, tv_10: 9, movie_2: 6, movie_404: 5 },
      comments: [
        { id: "c1", kind: "movie", targetId: 1, text: "Harika", createdAt: "2026-02-02T20:00:00.000Z" },
        { id: "c2", kind: "tv", targetId: 10, text: "Yanıt", parentId: "p1", createdAt: "2026-04-03T20:00:00.000Z" },
      ],
    },
    { now: NOW, appVersion: "1.5.0", platform: "android" },
  );

describe("parseLibraryBackup", () => {
  it("dışa aktarılan dosyayı (BOM'lu bile) okur ve sayar", () => {
    const res = parseLibraryBackup(`﻿${JSON.stringify(exported())}`, { now: NOW });
    expect(res.ok).toBe(true);
    expect(res.invalid).toBe(0);
    expect(res.counts).toMatchObject({
      films: 1,
      filmWatches: 2,
      shows: 1,
      episodes: 3,
      watchList: 1,
      favorites: 1,
      customLists: 1,
      customListItems: 1,
      ratings: 4,
      comments: 1,
      replies: 1,
    });
    expect(res.backup).toMatchObject({ appVersion: "1.5.0", platform: "android" });
    expect(backupCounts(res.backup)).toEqual(res.counts);
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["{bozuk", "not-json"],
    ["[1,2]", "not-backup"],
    [JSON.stringify({ app: "baska", kind: "library-export", version: 2 }), "not-backup"],
    [JSON.stringify({ app: "seelogd", kind: "library-export", version: 99 }), "too-new"],
    [JSON.stringify({ app: "seelogd", kind: "library-export", version: 2, watchedMovies: [] }), "nothing"],
  ])("geçersiz dosya: %j → %s", (text, error) => {
    expect(parseLibraryBackup(text, { now: NOW })).toEqual({ ok: false, error });
  });

  it("bozuk kayıtları atlar ve sayar; tehlikeli alanları taşımaz", () => {
    const file = {
      app: "seelogd",
      kind: "library-export",
      version: 1,
      watchedMovies: [
        { tmdbId: 7, type: "movie", title: "İyi", watchedDates: ["2026-01-01", "2026-13-40", "2999-01-01"], poster: "javascript:x", __proto__evil: 1 },
        { tmdbId: -1, type: "movie", title: "Kimliksiz" },
        { tmdbId: "abc", type: "movie" },
        null,
      ],
      comments: [{ id: "../../users/x", type: "movie", tmdbId: 7, text: "kaçış" }],
    };
    const res = parseLibraryBackup(JSON.stringify(file), { now: NOW });
    expect(res.ok).toBe(true);
    expect(res.invalid).toBeGreaterThanOrEqual(3);
    const [movie] = res.backup.watchedMovies;
    expect(movie.watchedDates).toEqual(["2026-01-01"]);
    expect(movie.poster).toBeNull();
    expect(movie).not.toHaveProperty("__proto__evil");
    expect(res.backup.comments).toEqual([]);
  });

  it("cleanDate gerçek günleri kabul eder, geleceği ve sahte günü reddeder", () => {
    expect(cleanDate("2024-02-29", NOW)).toBe("2024-02-29");
    expect(cleanDate("2023-02-29", NOW)).toBeNull();
    expect(cleanDate("2027-01-01", NOW)).toBeNull();
    expect(cleanDate("1800-01-01", NOW)).toBeNull();
    expect(cleanDate(20260101, NOW)).toBeNull();
  });
});

describe("buildImportPlan", () => {
  const backup = () => parseLibraryBackup(JSON.stringify(exported()), { now: NOW }).backup;

  it("tüm bölümler: kimlikli öğeler, puan bir kez, yanıt ve sahipsiz puan atlanır", () => {
    const plan = buildImportPlan(backup());
    const film = plan.items.find((i) => i.targetList === "watchedMovies");
    expect(film).toMatchObject({
      tmdbId: 1,
      mediaType: "movie",
      title: "Alfa",
      poster_path: "/alfa.jpg",
      rating: 8,
      importSource: "seelogd",
      watchDates: ["2025-03-01", "2026-02-02"],
      watchedDate: "2026-02-02",
    });
    // Aynı film favoride de var: puan ikinci kez yazılmaz.
    expect(plan.items.find((i) => i.targetList === "favorites")).toMatchObject({ tmdbId: 1, rating: null });
    const show = plan.items.find((i) => i.targetList === "watchedTv");
    expect(show).toMatchObject({ tmdbId: 10, rating: 9, seasonCount: 2, episodeCount: 16, watchedDate: "2026-04-03" });
    expect(show.episodes).toHaveLength(3);
    expect(plan.items.find((i) => i.customListName)).toMatchObject({ tmdbId: 3, customListName: "Benim Listem" });
    expect(plan.totals).toEqual({ items: 5, ratings: 3, comments: 1, lists: 1 });
    expect(plan.skipped).toEqual({ replies: 1, orphanRatings: 1 });
    expect(plan.comments.map((c) => c.id)).toEqual(["c1"]);
  });

  it("yalnız seçilen bölümler; puanlar seçilmezse puan taşınmaz", () => {
    const plan = buildImportPlan(backup(), ["shows", "comments"]);
    expect(plan.items.map((i) => i.targetList)).toEqual(["watchedTv"]);
    expect(plan.items[0].rating).toBeNull();
    expect(plan.comments).toHaveLength(1);
    expect(plan.skipped.orphanRatings).toBe(0);
  });
});

describe("mergeRestoredTv", () => {
  const item = {
    id: 10,
    importSource: "seelogd",
    seasonCount: 2,
    episodeCount: 16,
    episodes: [
      { season: 1, episode: 1, watchedDates: ["2026-04-01"], minutes: 45, name: "Pilot" },
      { season: 1, episode: 2, watchedDates: ["2026-04-01"], minutes: 50, name: null },
      { season: 2, episode: 1, watchedDates: ["2026-05-01"], minutes: 40, name: "Dönüş" },
    ],
  };

  it("bölüm iskeletini kurar, aynı günün bölümlerini tek olayda toplar", () => {
    const res = mergeRestoredTv({}, item, { now: "2026-11-13T00:00:00.000Z" });
    expect(res.addedEpisodes).toBe(3);
    expect(res.addedEvents).toBe(2);
    expect(res.addedMinutes).toBe(135);
    const events = res.document.watchEvents;
    expect(events).toHaveLength(2);
    const april = events.find((event) => event.watchedAt === "2026-04-01");
    expect(april).toMatchObject({ scope: "episode", episodeKeys: ["1:1", "1:2"] });
    expect(res.document.seasons.map((s) => s.seasonNumber)).toEqual([1, 2]);
    expect(res.document.seasons[0].episodes[0]).toMatchObject({ episodeNumber: 1, episodeName: "Pilot", episodeMinutes: 45 });
  });

  it("aynı dosya ikinci kez aktarılınca hiçbir şey çoğalmaz", () => {
    const first = mergeRestoredTv({}, item, { now: "2026-11-13T00:00:00.000Z" });
    const second = mergeRestoredTv(first.document, item, { now: "2026-11-14T00:00:00.000Z" });
    expect(second.addedEpisodes).toBe(0);
    expect(second.addedEvents).toBe(0);
    expect(second.document.watchEvents).toHaveLength(first.document.watchEvents.length);
  });

  it("mevcut bölüm bilgisini ezmez, yalnız eksikleri doldurur", () => {
    const existing = {
      id: 10,
      seasons: [
        {
          seasonNumber: 1,
          episodes: [{ episodeNumber: 1, episodeName: "Kendi Adım", episodeMinutes: 60, episodeRatings: 7 }],
        },
      ],
      watchEvents: [],
    };
    const res = mergeRestoredTv(existing, item, { now: "2026-11-13T00:00:00.000Z" });
    const first = res.document.seasons[0].episodes[0];
    expect(first).toMatchObject({ episodeName: "Kendi Adım", episodeMinutes: 60, episodeRatings: 7 });
  });
});

describe("resolveImportItem — Seelogd kimliği", () => {
  beforeEach(() => axios.get.mockReset());

  it("ad ve afiş dosyada varsa ağa çıkmadan eşleşir", async () => {
    const media = await resolveImportItem({
      tmdbId: 10,
      mediaType: "tv",
      title: "Dizi",
      poster_path: "/dizi.jpg",
      seasonCount: 2,
      episodeCount: 16,
      rawGenres: ["Dram"],
    });
    expect(axios.get).not.toHaveBeenCalled();
    expect(media).toMatchObject({ id: 10, mediaType: "tv", title: "Dizi", poster_path: "/dizi.jpg", seasonCount: 2, episodeCount: 16 });
  });

  it("afiş yoksa TMDB'den tamamlar; 404'te dosyadaki bilgiye düşer", async () => {
    axios.get.mockRejectedValue(Object.assign(new Error("HTTP 404"), { response: { status: 404, headers: {} } }));
    const media = await resolveImportItem({ tmdbId: 77, mediaType: "movie", title: "Eski Film", rawMinutes: 95 });
    expect(axios.get).toHaveBeenCalled();
    expect(media).toMatchObject({ id: 77, mediaType: "movie", title: "Eski Film", minutes: 95 });
  });

  it("bölüm listesi kaynak verisine eklenir", () => {
    const episodes = [{ season: 1, episode: 1, watchedDates: ["2026-04-01"] }];
    const out = attachSourceData({ id: 10, mediaType: "tv", genres: [] }, { episodes, rawGenres: [] });
    expect(out.episodes).toEqual(episodes);
  });
});

describe("aşama takibi", () => {
  it("plana göre yalnız iş olan aşamalar görünür", () => {
    expect(planStages({ items: [1], comments: [], totals: { lists: 0 } })).toEqual(["matching", "saving", "finalizing"]);
    expect(planStages({ items: [1], comments: [1], totals: { lists: 2 } })).toEqual([
      "matching",
      "saving",
      "lists",
      "finalizing",
      "comments",
    ]);
    expect(planStages({ items: [], comments: [1], totals: {} })).toEqual(["comments"]);
  });

  it("sonraki aşama başlayınca öncekiler biter; ilerleme ve bitiş işlenir", () => {
    let state = { order: ["matching", "saving", "finalizing", "comments"], current: null, done: [], progress: {} };
    state = reduceStages(state, { type: "stage", stage: "matching", total: 4, done: 0 });
    state = reduceStages(state, { type: "match", done: 2, total: 4 });
    expect(state).toMatchObject({ current: "matching", done: [], progress: { matching: { done: 2, total: 4 } } });
    state = reduceStages(state, { type: "stage", stage: "comments", total: 1, done: 0 });
    expect(state.done).toEqual(["matching", "saving", "finalizing"]);
    state = reduceStages(state, { type: "stage", stage: "done" });
    expect(state).toMatchObject({ current: null, done: ["matching", "saving", "finalizing", "comments"] });
    expect(reduceStages(state, { type: "bilinmeyen" })).toBe(state);
  });
});

describe("libraryImportCopy", () => {
  const shape = (value) =>
    value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, Array.isArray(v) ? `array:${v.length}` : shape(v)]))
      : typeof value;

  it("yedi dilde aynı anahtarlar ve türler; işlevler metin döndürür", () => {
    const langs = Object.keys(LIBRARY_IMPORT_COPY);
    expect(langs.sort()).toEqual(["de", "en", "es", "fr", "it", "ja", "pt", "tr"]);
    const reference = shape(LIBRARY_IMPORT_COPY.tr);
    for (const lang of langs) {
      expect(shape(LIBRARY_IMPORT_COPY[lang])).toEqual(reference);
      const copy = LIBRARY_IMPORT_COPY[lang];
      for (const [key, value] of Object.entries(copy)) {
        if (typeof value === "function") expect(typeof value(3, 7)).toBe("string");
        else if (typeof value === "string") expect(value.trim().length).toBeGreaterThan(0);
        else expect(value).toBeTruthy();
        if (typeof value === "function") expect(value(3, 7)).not.toMatch(/undefined|NaN/);
        expect(key).toBeTruthy();
      }
    }
  });
});
