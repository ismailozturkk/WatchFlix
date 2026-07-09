jest.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "android" },
}));

import { buildReminderWidgetItems } from "../services/reminderWidgetService";

const futureDate = (days) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

describe("buildReminderWidgetItems", () => {
  test("film ve bölümleri tarihe göre tek yaklaşan listede birleştirir", () => {
    const items = buildReminderWidgetItems(
      {
        movieReminders: [
          {
            movieId: 10,
            movieName: "Film A",
            movieMinutes: 120,
            releaseDate: futureDate(3),
          },
        ],
        tvReminders: [
          {
            showId: 20,
            showName: "Dizi B",
            seasons: [
              {
                seasonNumber: 2,
                episodes: [
                  {
                    episodeId: 30,
                    episodeNumber: 4,
                    airDate: futureDate(1),
                  },
                ],
              },
            ],
          },
        ],
      },
      "tr",
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "tv-30",
      type: "tv",
      title: "Dizi B",
      subtitle: "S2 · 4. Bölüm",
    });
    expect(items[1]).toMatchObject({
      id: "movie-10",
      type: "movie",
      title: "Film A",
      subtitle: "120 dk",
    });
  });

  test("geçmiş ve geçersiz tarihleri widget verisinden çıkarır", () => {
    expect(
      buildReminderWidgetItems({
        movieReminders: [
          { movieId: 1, movieName: "Eski", releaseDate: "2020-01-01" },
          { movieId: 2, movieName: "Geçersiz", releaseDate: "-" },
        ],
        tvReminders: [],
      }),
    ).toEqual([]);
  });
});
