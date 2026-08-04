const {
  countMovieWatchStats,
  countTvWatchStats,
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

describe("tekrarlı / tekrarsız sayaçlar", () => {
  test("aynı filmin beş izlemesi tek film sayılır", () => {
    const entries = flattenMovieWatchEntries([
      {
        id: 12,
        type: "movie",
        watchEvents: [1, 2, 3, 4, 5].map((n) => ({
          id: `w${n}`,
          watchedAt: `2026-0${n}-01`,
          scope: "movie",
        })),
      },
      { id: 13, type: "movie", dateAdded: "2026-02-02" },
    ]);

    expect(countMovieWatchStats(entries)).toEqual({ total: 6, unique: 2 });
  });

  test("kimliksiz eski kayıtlar tek filme çökmez", () => {
    expect(countMovieWatchStats([{ name: "A" }, { name: "B" }])).toEqual({
      total: 2,
      unique: 2,
    });
  });

  test("boş girdi sıfır döner", () => {
    expect(countMovieWatchStats()).toEqual({ total: 0, unique: 0 });
    expect(countTvWatchStats()).toEqual({
      shows: { total: 0, unique: 0 },
      seasons: { total: 0, unique: 0 },
      episodes: { total: 0, unique: 0 },
    });
  });

  test("iki kez baştan izlenen dizi tekrarsız sayımda tek kalır", () => {
    const show = {
      id: 44,
      seasons: [{
        seasonNumber: 1,
        episodes: [
          {
            episodeNumber: 1,
            episodeMinutes: 40,
            watchEvents: [
              { id: "a", watchedAt: "2026-01-01", scope: "show" },
              { id: "b", watchedAt: "2026-05-01", scope: "show" },
            ],
          },
          {
            episodeNumber: 2,
            episodeMinutes: 40,
            watchEvents: [
              { id: "a", watchedAt: "2026-01-01", scope: "show" },
              { id: "b", watchedAt: "2026-05-01", scope: "show" },
            ],
          },
        ],
      }],
    };
    const counts = countTvWatchStats([materializeTvWatchState(show)]);

    expect(counts.shows).toEqual({ total: 2, unique: 1 });
    expect(counts.seasons).toEqual({ total: 2, unique: 1 });
    expect(counts.episodes).toEqual({ total: 4, unique: 2 });
  });

  test("tek tek işaretlenen bölümler diziyi ve sezonu şişirmez", () => {
    const show = {
      id: 45,
      seasons: [{
        seasonNumber: 1,
        episodes: [
          { episodeNumber: 1, episodeWatchTime: "2026-01-01" },
          { episodeNumber: 2, episodeWatchTime: "2026-01-08" },
          { episodeNumber: 3, episodeWatchTime: "2026-01-15" },
        ],
      }],
    };
    const counts = countTvWatchStats([materializeTvWatchState(show)]);

    expect(counts.shows).toEqual({ total: 1, unique: 1 });
    expect(counts.seasons).toEqual({ total: 1, unique: 1 });
    expect(counts.episodes).toEqual({ total: 3, unique: 3 });
  });

  test("tekrarlı bölüm toplamı flatten çıktısıyla birebir aynı", () => {
    const shows = [
      {
        id: 46,
        seasons: [{
          seasonNumber: 1,
          episodes: [{
            episodeNumber: 1,
            watchEvents: [
              { id: "x", watchedAt: "2026-01-01", scope: "episode" },
              { id: "y", watchedAt: "2026-02-01", scope: "episode" },
            ],
          }],
        }],
      },
      { id: 47, seasons: [{ seasonNumber: 2, episodes: [{ episodeNumber: 5, episodeWatchTime: "2026-03-03" }] }] },
    ];

    expect(countTvWatchStats(shows.map(materializeTvWatchState)).episodes.total)
      .toBe(flattenTvEpisodeWatchEntries(shows).length);
  });
});
