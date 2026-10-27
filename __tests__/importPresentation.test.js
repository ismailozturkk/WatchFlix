import { buildImportResultRows, getImportPhase, IMPORT_PHASES } from "../components/import/importPresentation";
import { getImportCopy } from "../components/import/importCopy";

describe("import presentation", () => {
  test("ilerleme yüzdesini üç gerçek işlem aşamasına ayırır", () => {
    expect(getImportPhase(0)).toBe(IMPORT_PHASES.MATCHING);
    expect(getImportPhase(0.649)).toBe(IMPORT_PHASES.MATCHING);
    expect(getImportPhase(0.65)).toBe(IMPORT_PHASES.SAVING);
    expect(getImportPhase(0.939)).toBe(IMPORT_PHASES.SAVING);
    expect(getImportPhase(0.94)).toBe(IMPORT_PHASES.LISTS);
  });

  test("başarı satırlarında yalnız gerçekleşen sonuçları ve eşleşmeyen uyarısını gösterir", () => {
    const copy = getImportCopy("tr");
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
});
