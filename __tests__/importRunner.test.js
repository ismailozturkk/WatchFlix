// __tests__/importRunner.test.js
// Aktarım yürütücüsü (aşama sırası, kaldığı yerden sürdürme, durdurma, birikimli istatistik)
// ve ilerleme durum modeli (ağırlıklı oran, geri gitmeyen çubuk, kalan süre).

jest.mock("../services/import/tmdbResolver", () => ({ resolveImportItems: jest.fn() }));
jest.mock("../services/import/importWriter", () => ({
  writeImportedItems: jest.fn(),
  writeImportedCustomLists: jest.fn(),
  rebuildImportedProfileStats: jest.fn(async () => ({})),
}));
jest.mock("../services/import/importStats", () => ({ recordImportStats: jest.fn(async () => ({})) }));

const { resolveImportItems } = require("../services/import/tmdbResolver");
const { writeImportedItems, writeImportedCustomLists, rebuildImportedProfileStats } = require("../services/import/importWriter");
const { recordImportStats } = require("../services/import/importStats");
const { ImportError } = require("../services/import/importErrors");
const {
  createImportJob,
  createRetryJob,
  estimateJobTotals,
  jobProgressSummary,
  runImportJob,
} = require("../services/import/importRunner");
const {
  computeOverallRatio,
  createImportProgress,
  estimateRemainingMs,
  reduceImportProgress,
  stageStatus,
  visibleStages,
} = require("../services/import/importProgress");

const source = (title, extra = {}) => ({ title, year: 2000, importSource: "letterboxd", targetList: "watchedMovies", ...extra });
const resolved = (id, extra = {}) => ({ id, mediaType: "movie", title: `T${id}`, poster_path: `/p${id}.jpg`, importSource: "letterboxd", ...extra });

const saveStats = (count, extra = {}) => ({
  count,
  watchedCount: count,
  watchlistCount: 0,
  favoritesCount: 0,
  ratingsCount: 0,
  reviewsCount: 0,
  addedWatchEventsCount: count,
  unchangedCount: 0,
  preservedRatingsCount: 0,
  preservedReviewsCount: 0,
  failedCount: 0,
  failedItems: [],
  bySource: { letterboxd: { titles: count, watchEvents: count, ratings: 0, reviews: 0 } },
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  writeImportedCustomLists.mockResolvedValue({ customListsCount: 0, customListItemsCount: 0, failedListsCount: 0, failedLists: [], createdLists: [], bySource: {} });
});

describe("runImportJob", () => {
  test("aşamalar sırayla akar, profil özeti BİR kez hesaplanır, istatistik kaydedilir", async () => {
    resolveImportItems.mockImplementation(async (items, { onProgress }) => {
      items.forEach((item, index) => onProgress(index + 1, items.length, { item, status: "matched", media: resolved(index + 1) }));
      return {
        resolved: [resolved(1), resolved(2), resolved(3, { customListName: "Seçki" })],
        unmatched: [source("Kayıp")],
        failed: [],
      };
    });
    writeImportedItems.mockImplementation(async (uid, items, { onProgress }) => {
      items.forEach((item, index) => onProgress(index + 1, items.length, { item, outcome: "added" }));
      return saveStats(items.length);
    });
    writeImportedCustomLists.mockImplementation(async (uid, groups, { onProgress }) => {
      onProgress(1, 1, { name: "Seçki", added: 1 });
      return { customListsCount: 1, customListItemsCount: 1, failedListsCount: 0, failedLists: [], createdLists: ["Seçki"], bySource: { letterboxd: { lists: 1, listItems: 1, createdLists: ["Seçki"] } } };
    });

    const job = createImportJob({
      uid: "u",
      items: [source("A"), source("B"), source("Kayıp")],
      customItems: [source("C", { customListName: "Seçki" })],
      language: "tr-TR",
    });
    const events = [];
    const result = await runImportJob(job, { onEvent: (event) => events.push(event) });

    expect(events.filter((event) => event.type === "stage").map((event) => event.stage)).toEqual(["matching", "saving", "lists", "finalizing"]);
    expect(events.at(-1)).toEqual({ type: "finalized" });
    expect(writeImportedItems.mock.calls[0][2]).toMatchObject({ rebuildStats: false });
    expect(writeImportedCustomLists.mock.calls[0][1]).toEqual([{ name: "Seçki", items: [resolved(3, { customListName: "Seçki" })] }]);
    expect(rebuildImportedProfileStats).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ count: 3, unmatchedCount: 1, customListsCount: 1, retryableCount: 0 });
    expect(result.unmatchedItems).toEqual([{ title: "Kayıp", year: 2000, poster_path: null }]);
    expect(result.posters).toEqual(["/p1.jpg", "/p2.jpg", "/p3.jpg"]);
    expect(recordImportStats).toHaveBeenCalledWith(
      "u",
      { letterboxd: { titles: 2, watchEvents: 2, ratings: 0, reviews: 0, lists: 1, listItems: 1, createdLists: ["Seçki"] } },
      { newSession: true },
    );
  });

  test("kayıt yarıda kalınca kaldığı yerden sürer; istatistik aynı oturuma eklenir", async () => {
    resolveImportItems.mockResolvedValue({ resolved: [resolved(1), resolved(2), resolved(3)], unmatched: [], failed: [] });
    writeImportedItems
      .mockImplementationOnce(async () => {
        throw Object.assign(new ImportError("network"), { stats: saveStats(1), processed: 1 });
      })
      .mockImplementationOnce(async (uid, items) => saveStats(items.length));

    const job = createImportJob({ uid: "u", items: [source("A"), source("B"), source("C")] });
    await expect(runImportJob(job)).rejects.toMatchObject({ code: "network" });
    expect(jobProgressSummary(job)).toEqual({ saved: 1, lists: 0, matched: 3 });
    expect(recordImportStats).toHaveBeenLastCalledWith("u", { letterboxd: expect.objectContaining({ titles: 1 }) }, { newSession: true });

    const result = await runImportJob(job);
    expect(resolveImportItems).toHaveBeenCalledTimes(1); // eşleştirme tekrarlanmadı
    expect(writeImportedItems.mock.calls[1][1].map((item) => item.id)).toEqual([2, 3]);
    expect(result.count).toBe(3);
    expect(recordImportStats).toHaveBeenLastCalledWith("u", { letterboxd: expect.objectContaining({ titles: 2 }) }, { newSession: false });
  });

  test("durdurulunca o ana dek yazılanların profil özeti yine hesaplanır", async () => {
    resolveImportItems.mockResolvedValue({ resolved: [resolved(1), resolved(2)], unmatched: [], failed: [] });
    writeImportedItems.mockImplementationOnce(async () => {
      throw Object.assign(new ImportError("cancelled"), { stats: saveStats(1), processed: 1 });
    });
    const job = createImportJob({ uid: "u", items: [source("A"), source("B")] });
    await expect(runImportJob(job)).rejects.toMatchObject({ code: "cancelled" });
    expect(rebuildImportedProfileStats).toHaveBeenCalledTimes(1);
  });

  test("hiçbiri eşleşmezse: bağlantı sorunu ile 'TMDB'de yok' ayrılır, oturum sayılmaz", async () => {
    resolveImportItems.mockResolvedValueOnce({ resolved: [], unmatched: [source("A")], failed: [] });
    await expect(runImportJob(createImportJob({ uid: "u", items: [source("A")] }))).rejects.toMatchObject({ code: "noTmdbMatch" });
    resolveImportItems.mockResolvedValueOnce({ resolved: [], unmatched: [], failed: [source("A")] });
    await expect(runImportJob(createImportJob({ uid: "u", items: [source("A")] }))).rejects.toMatchObject({ code: "network" });
    expect(recordImportStats).not.toHaveBeenCalled();
  });

  test("yeniden deneme işi: bağlantıdan eşleşemeyenler + kaydı düşenler", async () => {
    resolveImportItems.mockResolvedValue({ resolved: [resolved(1), resolved(2)], unmatched: [], failed: [source("Ağ")] });
    writeImportedItems.mockResolvedValue(saveStats(1, { failedCount: 1, failedItems: [{ id: 2, mediaType: "movie", title: "T2" }] }));
    const job = createImportJob({ uid: "u", items: [source("A"), source("B"), source("Ağ")] });
    const result = await runImportJob(job);
    expect(result).toMatchObject({ retryableCount: 2, failedMatchCount: 1, failedCount: 1 });
    const retry = createRetryJob(job);
    expect(retry.sourceItems.map((item) => item.title)).toEqual(["Ağ"]);
    expect(retry.preResolved.map((item) => item.id)).toEqual([2]);
    expect(estimateJobTotals(retry)).toEqual({ matchTotal: 1, saveTotal: 2, listTotal: 0 });
  });
});

describe("ilerleme modeli", () => {
  test("oran işe göre ağırlıklı, aşama değişince geri gitmez, bitişte 1", () => {
    let state = createImportProgress({ matchTotal: 10, saveTotal: 10, now: 0 });
    for (let i = 1; i <= 10; i += 1) {
      state = reduceImportProgress(state, { type: "match", done: i, total: 10, status: i === 10 ? "unmatched" : "matched", item: { title: `F${i}` }, media: i === 10 ? null : { id: i, poster_path: `/p${i}.jpg` } }, i);
    }
    const afterMatching = state.ratio;
    expect(afterMatching).toBeGreaterThan(0.2);
    expect(afterMatching).toBeLessThan(0.35); // eşleştirme ucuz: çubuk %65'e fırlamaz
    state = reduceImportProgress(state, { type: "stage", stage: "saving", total: 9, done: 0 }, 20);
    expect(state.ratio).toBeGreaterThanOrEqual(afterMatching);
    expect(state.recent).toEqual([]); // kayıt aşaması kendi afiş akışıyla başlar
    state = reduceImportProgress(state, { type: "save", done: 1, total: 9, outcome: "added", item: { id: 1, poster_path: "/p1.jpg", title: "F1" } }, 21);
    expect(state.save).toMatchObject({ added: 1, done: 1 });
    expect(state.current).toMatchObject({ title: "F1", status: "added", poster: "/p1.jpg" });
    state = reduceImportProgress(state, { type: "finalized" });
    expect(state.ratio).toBe(1);
    expect(stageStatus(state, "matching")).toBe("done");
  });

  test("son afişler tekil ve sınırlı; afişsiz kart şeride girmez", () => {
    let state = createImportProgress({ matchTotal: 20 });
    for (let i = 1; i <= 12; i += 1) {
      state = reduceImportProgress(state, { type: "match", done: i, total: 20, status: "matched", item: { title: `F${i}` }, media: { id: i, poster_path: `/p${i}.jpg` } });
    }
    state = reduceImportProgress(state, { type: "match", done: 13, total: 20, status: "unmatched", item: { title: "Yok" } });
    expect(state.recent).toHaveLength(8);
    expect(state.recent[0].title).toBe("F12");
    expect(state.current).toMatchObject({ title: "Yok", status: "unmatched" });
  });

  test("yeniden koşan eşleştirme sayaçları çift saymaz", () => {
    let state = createImportProgress({ matchTotal: 2 });
    state = reduceImportProgress(state, { type: "match", done: 1, total: 2, status: "matched", item: {}, media: { id: 1 } });
    state = reduceImportProgress(state, { type: "stage", stage: "matching", total: 2, done: 0 });
    state = reduceImportProgress(state, { type: "match", done: 1, total: 2, status: "matched", item: {}, media: { id: 1 } });
    expect(state.match.matched).toBe(1);
  });

  test("kalan süre: ısınmadan önce yok, sonra ölçülen hızdan", () => {
    let state = createImportProgress({ matchTotal: 100, saveTotal: 0, now: 0 });
    expect(estimateRemainingMs(state, 1000)).toBeNull();
    for (let i = 1; i <= 10; i += 1) state = reduceImportProgress(state, { type: "match", done: i, total: 100, status: "matched", item: {}, media: { id: i } }, i * 100);
    expect(estimateRemainingMs(state, 5000)).toBe(45000); // 500 ms/öğe × 90 öğe
  });

  test("özel liste yoksa 'Listeler' adımı gösterilmez", () => {
    expect(visibleStages(createImportProgress({ listTotal: 0 }))).toEqual(["matching", "saving", "finalizing"]);
    expect(visibleStages(createImportProgress({ listTotal: 2 }))).toContain("lists");
    expect(computeOverallRatio(createImportProgress({}))).toBe(0);
  });
});
