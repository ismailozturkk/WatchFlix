import { buildImportResultRows, describeStage, durationText, etaText, statusBadge } from "../components/import/importPresentation";
import { getImportCopy } from "../components/import/importCopy";
import { createImportProgress, reduceImportProgress } from "../services/import/importProgress";

describe("import presentation", () => {
  const copy = getImportCopy("tr");

  test("başarı satırlarında yalnız gerçekleşen sonuçları ve eşleşmeyen uyarısını gösterir", () => {
    const rows = buildImportResultRows(
      {
        addedWatchEventsCount: 3,
        ratingsCount: 2,
        reviewsCount: 0,
        preservedRatingsCount: 1,
        preservedReviewsCount: 0,
        unchangedCount: 4,
        watchlistCount: 0,
        favoritesCount: 0,
        customListsCount: 1,
        customListItemsCount: 5,
        unmatchedCount: 2,
      },
      copy,
    );
    expect(rows.map((row) => row.key)).toEqual(["watchEvents", "ratings", "preserved", "unchanged", "customLists", "unmatched"]);
    expect(rows.at(-1)).toMatchObject({ tone: "warning", text: copy.skippedUnmatched(2) });
  });

  test("bağlantı/kayıt/liste hataları ayrı uyarı satırı olur", () => {
    const rows = buildImportResultRows({ failedMatchCount: 3, failedCount: 2, failedListsCount: 1 }, copy);
    expect(rows.map((row) => row.key)).toEqual(["failedMatched", "failedSaved", "failedLists"]);
    expect(rows.every((row) => row.tone === "warning")).toBe(true);
  });

  test("aşama açıklaması sayaç, ayrıntı ve oranı verir", () => {
    let state = createImportProgress({ matchTotal: 4, saveTotal: 4, now: 0 });
    state = reduceImportProgress(state, { type: "match", done: 1, total: 4, status: "matched", item: { title: "A" }, media: { id: 1, title: "A" } }, 10);
    state = reduceImportProgress(state, { type: "match", done: 2, total: 4, status: "unmatched", item: { title: "B" } }, 20);
    const info = describeStage(state, "matching", copy);
    expect(info.counter).toBe("2 / 4");
    expect(info.detail).toBe(copy.run.detailMatching(1, 1));
    expect(info.ratio).toBe(0.5);
    expect(describeStage(state, "finalizing", copy).counter).toBeNull();
  });

  test("durum rozetleri ve süre metinleri", () => {
    expect(statusBadge("unmatched", copy)).toMatchObject({ tone: "warning", text: copy.run.statusUnmatched });
    expect(statusBadge("added", copy).tone).toBe("safe");
    expect(durationText(134000, copy)).toBe(copy.result.minSec(2, 14));
    expect(durationText(48000, copy)).toBe(copy.result.sec(48));
    expect(durationText(0, copy)).toBeNull();
  });

  test("kalan süre yeterli veri yokken 'hesaplanıyor' der", () => {
    const state = createImportProgress({ matchTotal: 100, saveTotal: 100, now: 0 });
    expect(etaText(state, copy, 1000)).toBe(copy.run.etaCalculating);
  });
});
