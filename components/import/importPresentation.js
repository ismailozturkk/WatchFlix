// ImportDataModal'ın saf sunum kararları. İşlem/yazma mantığına dokunmadan
// ilerleme aşamasını ve başarı özetinde gösterilecek satırları üretir.

export const IMPORT_PHASES = Object.freeze({ MATCHING: 0, SAVING: 1, LISTS: 2 });

export function getImportPhase(progress) {
  const value = Math.max(0, Math.min(1, Number(progress) || 0));
  if (value < 0.65) return IMPORT_PHASES.MATCHING;
  if (value < 0.94) return IMPORT_PHASES.SAVING;
  return IMPORT_PHASES.LISTS;
}

export function buildImportResultRows(stats = {}, copy) {
  const rows = [];
  const add = (key, icon, tone, show, value) => {
    if (show) rows.push({ key, icon, tone, text: value });
  };

  add("watchEvents", "film-outline", "accent", stats.addedWatchEventsCount > 0, copy.addedWatchEvents(stats.addedWatchEventsCount));
  add("ratings", "star-outline", "gold", stats.ratingsCount > 0, copy.addedRatings(stats.ratingsCount));
  add("reviews", "create-outline", "accent", stats.reviewsCount > 0, copy.addedReviews(stats.reviewsCount));
  add("preserved", "shield-checkmark-outline", "safe", stats.preservedRatingsCount > 0 || stats.preservedReviewsCount > 0, copy.preserved);
  add("unchanged", "checkmark-done-outline", "muted", stats.unchangedCount > 0, copy.unchanged(stats.unchangedCount));
  add("watchlist", "bookmark-outline", "blue", stats.watchlistCount > 0, copy.checkedWatchlist(stats.watchlistCount));
  add("favorites", "heart-outline", "rose", stats.favoritesCount > 0, copy.checkedFavorites(stats.favoritesCount));
  add("customLists", "albums-outline", "violet", stats.customListsCount > 0, copy.mergedCustomLists(stats.customListsCount, stats.customListItemsCount));
  add("unmatched", "alert-circle-outline", "warning", stats.unmatchedCount > 0, copy.skippedUnmatched(stats.unmatchedCount));
  return rows;
}
