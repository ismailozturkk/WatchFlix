import {
  advanceUpNextItem,
  findNextEpisodeInSeason,
  getEpisodeOrder,
  getFurthestWatchedPosition,
  getUpNextSeasonNumbers,
  getWatchedEpisodeKeys,
} from "../utils/upNext";
import { getWatchedShowActivityTime } from "../utils/watchState";

const show = {
  seasons: [
    {
      seasonNumber: 1,
      episodes: [{ episodeNumber: 1 }, { episodeNumber: 2 }],
    },
  ],
};

test("izlenen bölüm anahtarlarını ve en ileri konumu çıkarır", () => {
  expect([...getWatchedEpisodeKeys(show)]).toEqual(["1:1", "1:2"]);
  expect(getFurthestWatchedPosition(show)).toEqual({
    seasonNumber: 1,
    episodeNumber: 2,
    order: 100002,
  });
});

test("ilk yayınlanmış izlenmemiş bölümü seçer", () => {
  const next = findNextEpisodeInSeason({
    show,
    seasonNumber: 1,
    episodes: [
      { episode_number: 2, air_date: "2026-01-01" },
      { episode_number: 3, air_date: "2026-01-08", name: "Üç" },
      { episode_number: 4, air_date: "2027-01-01" },
    ],
    now: new Date("2026-08-01T12:00:00"),
  });
  expect(next).toMatchObject({ episodeNumber: 3, name: "Üç", isAired: true });
});

test("yalnız gelecek bölüm varsa yakında olarak döndürür", () => {
  const next = findNextEpisodeInSeason({
    show,
    seasonNumber: 1,
    episodes: [{ episode_number: 3, air_date: "2027-01-01" }],
    now: new Date("2026-08-01T12:00:00"),
  });
  expect(next).toMatchObject({ episodeNumber: 3, isAired: false });
});

test("afterOrder verilince o bölümün ardındakini seçer (ön yükleme)", () => {
  const episodes = [
    { episode_number: 3, air_date: "2026-01-08" },
    { episode_number: 4, air_date: "2026-01-15", name: "Dört" },
  ];
  const next = findNextEpisodeInSeason({
    show,
    seasonNumber: 1,
    episodes,
    now: new Date("2026-08-01T12:00:00"),
    afterOrder: getEpisodeOrder(1, 3),
  });
  expect(next).toMatchObject({ episodeNumber: 4, name: "Dört", isAired: true });
});

test("işaretlenen bölümün yerine hazırdaki bölümü koyar", () => {
  const item = {
    id: "9:1:3",
    episodeNumber: 3,
    watchedEpisodeCount: 12,
    activityTime: 1,
    nextUp: { id: "9:1:4", episodeNumber: 4, watchedEpisodeCount: 12 },
  };

  expect(advanceUpNextItem(item, { watchedAt: 5000 })).toMatchObject({
    id: "9:1:4",
    episodeNumber: 4,
    watchedEpisodeCount: 13,
    activityTime: 5000,
  });
  expect(advanceUpNextItem({ ...item, nextUp: null })).toBeNull();
});

test("ilerlemenin bulunduğu sezondan sonraki sezonları sıralar", () => {
  expect(
    getUpNextSeasonNumbers(show, {
      seasons: [
        { season_number: 0 },
        { season_number: 3 },
        { season_number: 1 },
        { season_number: 2 },
      ],
    })
  ).toEqual([1, 2, 3]);
});

test("dizi sırası için en son gerçek izleme zamanını kullanır", () => {
  const older = {
    seasons: [
      {
        seasonNumber: 1,
        episodes: [
          { episodeNumber: 1, episodeWatchTime: "2026-05-01" },
          { episodeNumber: 2, episodeWatchTime: "2026-06-01" },
        ],
      },
    ],
    addedShowDate: "2026-07-01",
  };
  const newer = {
    seasons: [
      {
        seasonNumber: 1,
        episodes: [{ episodeNumber: 1, episodeWatchTime: "2026-07-15" }],
      },
    ],
  };

  expect(getWatchedShowActivityTime(newer)).toBeGreaterThan(
    getWatchedShowActivityTime(older)
  );
});
