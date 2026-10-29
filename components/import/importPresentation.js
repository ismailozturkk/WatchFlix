// ImportDataModal'ın saf sunum kararları. İşlem/yazma mantığına dokunmadan
// aşama başlıklarını, kalan süre / geçen süre metnini ve başarı özetinde
// gösterilecek satırları üretir.

import { estimateRemainingMs } from "../../services/import/importProgress";

export const STAGE_ICONS = Object.freeze({
  matching: "scan-outline",
  saving: "library-outline",
  lists: "albums-outline",
  finalizing: "stats-chart-outline",
});

const STAGE_COPY_KEYS = {
  matching: { title: "stageMatching", hero: "heroMatching", now: "nowMatching" },
  saving: { title: "stageSaving", hero: "heroSaving", now: "nowSaving" },
  lists: { title: "stageLists", hero: "heroLists", now: "nowLists" },
  finalizing: { title: "stageFinalizing", hero: "heroFinalizing", now: null },
};

/** Aşamanın adı, büyük başlığı, "şimdi …" etiketi ve sayaç/ayrıntı satırı. */
export function describeStage(state, stage, copy) {
  const run = copy.run;
  const keys = STAGE_COPY_KEYS[stage];
  const counter =
    stage === "matching" ? state.match : stage === "saving" ? state.save : stage === "lists" ? state.lists : null;
  let detail = run.detailFinalizing;
  if (stage === "matching") detail = run.detailMatching(state.match.matched, state.match.unmatched);
  if (stage === "saving") detail = run.detailSaving(state.save.added, state.save.unchanged);
  if (stage === "lists") detail = run.detailLists(state.lists.added);
  return {
    icon: STAGE_ICONS[stage],
    title: run[keys.title],
    hero: run[keys.hero],
    now: keys.now ? run[keys.now] : null,
    counter: counter ? run.counter(Math.min(counter.done, counter.total), counter.total) : null,
    ratio: counter && counter.total > 0 ? Math.min(1, counter.done / counter.total) : stage === "finalizing" && state.finalized ? 1 : 0,
    detail,
  };
}

/** Durum kartındaki küçük rozetin metni ve tonu. */
export function statusBadge(status, copy) {
  const run = copy.run;
  switch (status) {
    case "matched":
      return { text: run.statusMatched, tone: "accent", icon: "checkmark" };
    case "unmatched":
      return { text: run.statusUnmatched, tone: "warning", icon: "help" };
    case "failed":
      return { text: run.statusFailed, tone: "danger", icon: "cloud-offline-outline" };
    case "added":
      return { text: run.statusAdded, tone: "safe", icon: "add" };
    case "unchanged":
      return { text: run.statusUnchanged, tone: "muted", icon: "checkmark-done" };
    case "list":
      return { text: run.statusList, tone: "violet", icon: "albums-outline" };
    default:
      return { text: "", tone: "muted", icon: "ellipse-outline" };
  }
}

/** Kalan süre metni; tahmin yoksa "hesaplanıyor". */
export function etaText(state, copy, now = Date.now()) {
  const ms = estimateRemainingMs(state, now);
  if (ms == null) return copy.run.etaCalculating;
  if (ms < 60000) return copy.run.etaUnderMinute;
  return copy.run.etaMinutes(Math.ceil(ms / 60000));
}

/** Geçen süre: "2 dk 14 sn" / "48 sn". */
export function durationText(ms, copy) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? copy.result.minSec(minutes, seconds) : copy.result.sec(seconds);
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
  add("failedMatched", "cloud-offline-outline", "warning", stats.failedMatchCount > 0, copy.result.failedMatched(stats.failedMatchCount));
  add("failedSaved", "warning-outline", "warning", stats.failedCount > 0, copy.result.failedSaved(stats.failedCount));
  add("failedLists", "warning-outline", "warning", stats.failedListsCount > 0, copy.result.failedLists(stats.failedListsCount));
  return rows;
}
