const {
  flattenMovieWatchEntries,
  flattenTvEpisodeWatchEntries,
  materializeTvWatchState,
  movieWatchEvents,
  mostRewatched,
  buildRecentWatchChartData,
  buildWatchChartData,
  tvWatchEvents,
} = require("../utils/watchHistory");

describe("movie watch history", () => {
  test("legacy dateAdded becomes a stable first event", () => {
    expect(movieWatchEvents({ id: 12, dateAdded: "2026-01-04" })).toEqual([
      expect.objectContaining({
        id: "legacy_movie_12_2026-01-04",
        watchedAt: "2026-01-04",
      }),
    ]);
  });

  test("two watches create two history entries", () => {
    const entries = flattenMovieWatchEntries([{
      id: 12,
      type: "movie",
      name: "Film",
      watchEvents: [
        { id: "jan", watchedAt: "2026-01-04", scope: "movie" },
        { id: "mar", watchedAt: "2026-03-09", scope: "movie" },
      ],
    }]);
    expect(entries.map((entry) => entry.dateAdded)).toEqual([
      "2026-03-09",
      "2026-01-04",
    ]);
    expect(new Set(entries.map((entry) => entry.historyId)).size).toBe(2);
  });
});

describe("tv watch history", () => {
  const show = {
    id: 44,
    name: "Dizi",
    seasons: [{
      seasonNumber: 1,
      episodes: [
        { episodeNumber: 1, episodeMinutes: 42, episodeWatchTime: "2026-01-01" },
        { episodeNumber: 2, episodeMinutes: 45, episodeWatchTime: "2026-01-01" },
      ],
    }],
  };

  test("same legacy date is one removable action affecting both episodes", () => {
    const state = materializeTvWatchState(show);
    expect(state.watchEvents).toHaveLength(1);
    expect(state.watchEvents[0]).toEqual(expect.objectContaining({
      id: "legacy_tv_44_2026-01-01",
      episodeCount: 2,
      minutes: 87,
    }));
    expect(tvWatchEvents(show, { seasonNumber: 1, episodeNumber: 2 })).toHaveLength(1);
  });

  test("episode events are flattened separately for statistics", () => {
    const repeated = {
      ...show,
      watchEvents: [
        { id: "first", watchedAt: "2026-01-01", scope: "show", episodeKeys: ["1:1", "1:2"] },
        { id: "again", watchedAt: "2026-03-01", scope: "show", episodeKeys: ["1:1", "1:2"] },
      ],
      seasons: [{
        ...show.seasons[0],
        episodes: show.seasons[0].episodes.map((episode) => ({
          ...episode,
          watchEvents: [
            { id: "first", watchedAt: "2026-01-01", scope: "show" },
            { id: "again", watchedAt: "2026-03-01", scope: "show" },
          ],
        })),
      }],
    };
    const entries = flattenTvEpisodeWatchEntries([repeated]);
    expect(entries).toHaveLength(4);
    expect(entries.filter((entry) => entry.episodeWatchTime === "2026-03-01")).toHaveLength(2);
  });

  test("compact top-level events hydrate episode history without copies", () => {
    const compact = {
      ...show,
      watchEvents: [
        { id: "first", watchedAt: "2026-01-01", scope: "show", episodeKeys: ["1:1", "1:2"] },
        { id: "again", watchedAt: "2026-03-01", scope: "show", episodeKeys: ["1:1", "1:2"] },
      ],
      seasons: [{
        ...show.seasons[0],
        episodes: show.seasons[0].episodes.map(({ episodeWatchTime, ...episode }) => episode),
      }],
    };
    expect(flattenTvEpisodeWatchEntries([compact])).toHaveLength(4);
    expect(tvWatchEvents(compact, { seasonNumber: 1, episodeNumber: 1 })).toHaveLength(2);
  });
});

test("most rewatched only returns repeated titles", () => {
  const result = mostRewatched(
    [{ id: 1 }, { id: 1 }, { id: 1 }, { id: 2 }],
    (item) => item.id,
  );
  expect(result).toEqual([{ item: { id: 1 }, count: 3 }]);
});

test("watch chart anchors to latest history date and fills missing days", () => {
  const chart = buildRecentWatchChartData(
    [
      { title: "2026-03-10", data: [{ minutes: 100 }, { minutes: 20 }] },
      { title: "2026-03-08", data: [{ minutes: 45 }] },
    ],
    (item) => item.minutes,
    "tr-TR",
    4,
  );
  expect(chart.map(({ key, value }) => [key, value])).toEqual([
    ["2026-03-07", 0],
    ["2026-03-08", 45],
    ["2026-03-09", 0],
    ["2026-03-10", 120],
  ]);
});

test("watch chart aggregates monthly and yearly periods", () => {
  const source = [
    { title: "2025-12-20", data: [{ minutes: 30 }] },
    { title: "2026-01-03", data: [{ minutes: 40 }] },
    { title: "2026-01-18", data: [{ minutes: 20 }] },
    { title: "2026-03-10", data: [{ minutes: 120 }] },
  ];
  const monthly = buildWatchChartData(source, (item) => item.minutes, "tr-TR", "monthly");
  expect(monthly).toHaveLength(31);
  expect(monthly[9]).toEqual(expect.objectContaining({
    key: "2026-03-10",
    dayLabel: "10",
    value: 120,
  }));
  expect(monthly.reduce((sum, point) => sum + point.value, 0)).toBe(120);

  const yearly = buildWatchChartData(source, (item) => item.minutes, "tr-TR", "yearly");
  expect(yearly).toHaveLength(12);
  expect(yearly[0]).toEqual(expect.objectContaining({ key: "2026-01", value: 60 }));
  expect(yearly[2]).toEqual(expect.objectContaining({ key: "2026-03", value: 120 }));
  expect(yearly.reduce((sum, point) => sum + point.value, 0)).toBe(180);
});
