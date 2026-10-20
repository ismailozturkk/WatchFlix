jest.mock("../context/ListStatusContext", () => ({ useListStatusContext: jest.fn() }));
jest.mock("../context/MediaActivityContext", () => ({ useMediaActivityContext: jest.fn() }));

import { buildStatusIndex, mergeStatusIndexes, resolveStatusIndex, EMPTY_LIST_STATUS } from "../utils/listStatusIndex";
import { buildActivityFromRoot } from "../utils/mediaActivityIndex";
import { nestedSummaryFields } from "../utils/firestoreNestedFields";
import { buildImportedSummary } from "../services/import/importSummary";
import { useListStatus } from "../hooks/useListStatus";
import { useListStatusContext } from "../context/ListStatusContext";
import { useMediaActivity } from "../hooks/useMediaActivity";
import { useMediaActivityContext } from "../context/MediaActivityContext";

test.each([undefined, null, {}, { movie: {} }, { tv: {} }, { movie: null, tv: null }])("hooks tolerate incomplete startup/import indexes: %p", (statusIndex) => {
  useListStatusContext.mockReturnValue({ statusIndex, loading: true });
  useMediaActivityContext.mockReturnValue({ activityIndex: statusIndex });
  for (const type of ["movie", "tv"]) {
    expect(useListStatus(42, type)).toEqual({ ...EMPTY_LIST_STATUS, loading: true });
    expect(useMediaActivity(42, type)).toEqual({ hasRating: false, hasComment: false, rating: null });
  }
});

test("partial remote flags preserve locally known memberships and explicit removals", () => {
  const local = buildStatusIndex({ favoritesMap: { movie_1: { id: 1 } }, watchedTvMap: { tv_2: { id: 2 } } });
  const result = mergeStatusIndexes(local, { movie: { 1: { isWatched: true }, 3: { inWatchList: false } } });
  expect(result.movie[1]).toMatchObject({ inFavorites: true, isWatched: true });
  expect(result.tv[2].isWatched).toBe(true);
  expect(mergeStatusIndexes(result, { movie: { 1: { inFavorites: false } } }).movie[1].inFavorites).toBe(false);
});

test("legacy arrays and custom collections contribute without malformed entries crashing", () => {
  const result = buildStatusIndex({ allLists: { watchedTv: [null, { id: 2 }], Picks: [undefined, { id: 3 }], customLists: [{ id: 99 }] }, customItemsMap: { a: { id: 4, type: "tv" } }, favoritesMap: { bad: null } });
  expect(result.tv[2].isWatched).toBe(true);
  expect(result.movie[3].isInOtherLists).toBe(true);
  expect(result.tv[4].isInOtherLists).toBe(true);
  expect(result.movie[99]).toBeUndefined();
});

test("set payloads nest summary paths but preserve dotted list and genre names and sentinels", () => {
  const increment = { sentinel: "increment" };
  const result = nestedSummaryFields({ "statusIndex.tv.2.isWatched": true, "stats.tv.shows.total": increment, "stats.genreCounts.A.B": increment, "My.List": [{ id: 2 }] });
  expect(result.statusIndex.tv[2].isWatched).toBe(true);
  expect(result.stats.tv.shows.total).toBe(increment);
  expect(result.stats.genreCounts["A.B"]).toBe(increment);
  expect(result["My.List"]).toEqual([{ id: 2 }]);
  expect(result["statusIndex.tv.2.isWatched"]).toBeUndefined();
});

test("typed comments do not light up a different media type with the same ID", () => {
  const result = buildActivityFromRoot({ comments: ["movie_1", "tv_2"], ratings: { tv_1: 8 } });
  expect(result.movie[1].hasComment).toBe(true);
  expect(result.tv[1]).toEqual({ hasRating: true, hasComment: false, rating: 8 });
  expect(result.tv[2].hasComment).toBe(true);
  expect(result.movie[2]).toBeUndefined();
});

test("removing an imported item from its last custom list clears its stale badge", () => {
  const root = { Picks: [], statusIndex: { movie: { 1: { isInOtherLists: true, isWatched: true } } } };
  expect(resolveStatusIndex(root, buildStatusIndex({ allLists: root })).movie[1])
    .toMatchObject({ isInOtherLists: false, isWatched: true });
  root.Other = [{ id: 1 }];
  expect(resolveStatusIndex(root, buildStatusIndex({ allLists: root })).movie[1].isInOtherLists).toBe(true);
});

test("summary rebuild restores all memberships, counts and typed activity without changing source documents", () => {
  const root = { Picks: [{ id: 8 }], counts: { other: 5 }, stats: { other: 2 } };
  const lists = {
    favorites: { movie_1: { id: 1 } }, watchList: { tv_1: { id: 1, type: "tv" } },
    watchedMovies: { movie_2: { id: 2, minutes: 90, dateAdded: "2026-01-01", genres: ["Drama"] } },
    myRatings: { tv_1: { rating: 8 } }, myComments: { a: { kind: "movie", targetId: "2" }, b: { kind: "post", targetId: "3" } },
  };
  const before = JSON.stringify({ root, lists });
  const patch = buildImportedSummary(root, lists);
  expect(patch.counts).toEqual({ other: 5, favorites: 1, watchedMovies: 1, watchedTv: 0, watchList: 1 });
  expect(patch.statusIndex.movie[1].inFavorites).toBe(true);
  expect(patch.statusIndex.tv[1].inWatchList).toBe(true);
  expect(patch.statusIndex.movie[8].isInOtherLists).toBe(true);
  expect(patch.activityIndex).toEqual({ ratings: { tv_1: 8 }, comments: ["movie_2"] });
  expect(patch.stats).toMatchObject({ totalMinutes: 90, other: 2, genreCounts: { Drama: 1 } });
  expect(JSON.stringify({ root, lists })).toBe(before);
});
