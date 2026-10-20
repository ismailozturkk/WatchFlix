import {
  calculateImportedProfileSummary,
  fillMissingFields,
  importedReviewId,
  mergeImportedMovie,
  mergeImportedTv,
} from "../services/import/importMerge";

describe("safe Letterboxd / IMDb import merge", () => {
  const now = "2026-09-04T10:00:00.000Z";

  test("fills only absent metadata and preserves current user fields", () => {
    expect(fillMissingFields(
      { name: "Kullanıcının başlığı", minutes: 121, genres: [18] },
      { name: "Imported title", minutes: 130, genres: [28], imagePath: "/poster.jpg" },
    )).toEqual({ imagePath: "/poster.jpg" });
  });

  test("reimporting a movie keeps event ids, dates, count, and metadata stable", () => {
    const existing = {
      id: 550,
      type: "movie",
      name: "Dövüş Kulübü",
      minutes: 139,
      dateAdded: "2024-01-02",
      watchEvents: [
        { id: "manual-event", watchedAt: "2024-01-02", scope: "movie", recordedAt: "old" },
      ],
      watchCount: 1,
    };
    const item = {
      id: 550,
      title: "Fight Club",
      minutes: 140,
      watchDates: ["2024-01-02"],
    };
    const first = mergeImportedMovie(existing, item, { now, fallbackDate: "2026-09-04" });
    const second = mergeImportedMovie(first.document, item, { now, fallbackDate: "2026-09-04" });

    expect(first.addedEvents).toBe(0);
    expect(second.addedEvents).toBe(0);
    expect(second.document.name).toBe("Dövüş Kulübü");
    expect(second.document.minutes).toBe(139);
    expect(second.document.watchEvents).toEqual(existing.watchEvents);
    expect(second.document.watchCount).toBe(1);
  });

  test("adds only missing diary dates and stays idempotent on the next pass", () => {
    const existing = {
      id: 27205,
      dateAdded: "2024-01-01",
      watchEvents: [{ id: "kept", watchedAt: "2024-01-01", scope: "movie" }],
    };
    const item = { id: 27205, title: "Inception", minutes: 148, watchDates: ["2024-01-01", "2025-02-03"] };
    const first = mergeImportedMovie(existing, item, { now, fallbackDate: "2026-09-04" });
    const second = mergeImportedMovie(first.document, item, { now, fallbackDate: "2026-09-04" });

    expect(first.addedEvents).toBe(1);
    expect(first.document.watchEvents.map((event) => event.id)).toContain("kept");
    expect(first.document.watchCount).toBe(2);
    expect(second.addedEvents).toBe(0);
    expect(second.document.watchCount).toBe(2);
  });

  test("uses one stable review id for the same user and media", () => {
    const id = importedReviewId("user.42", "movie", 550);
    expect(id).toBe(importedReviewId("user.42", "movie", 550));
    expect(id).not.toBe(importedReviewId("user.43", "movie", 550));
  });

  test("profile summary counts each imported watch once after repeated merge", () => {
    const movieItem = { id: 1, title: "Film", minutes: 100, watchDates: ["2024-01-01", "2025-01-01"] };
    const movie = mergeImportedMovie({}, movieItem, { now, fallbackDate: "2026-09-04" }).document;
    const movieAgain = mergeImportedMovie(movie, movieItem, { now, fallbackDate: "2026-09-04" }).document;
    const tvItem = {
      id: 2,
      title: "Dizi",
      episodeCount: 8,
      seasonCount: 1,
      episodeMinutes: 45,
      watchedDate: "2025-03-04",
    };
    const tv = mergeImportedTv({}, tvItem, { now, fallbackDate: "2026-09-04" }).document;
    const tvAgain = mergeImportedTv(tv, tvItem, { now, fallbackDate: "2026-09-04" }).document;
    const summary = calculateImportedProfileSummary([movieAgain], [tvAgain], [{ id: 3 }]);

    expect(summary.movieCounts).toEqual({ total: 2, unique: 1 });
    expect(summary.movieMinutes).toBe(200);
    expect(summary.tvCounts.shows).toEqual({ total: 1, unique: 1 });
    expect(summary.tvCounts.seasons).toEqual({ total: 1, unique: 1 });
    expect(summary.tvCounts.episodes).toEqual({ total: 8, unique: 8 });
    expect(summary.tvMinutes).toBe(360);
    expect(summary.watchList).toBe(1);
  });
});
