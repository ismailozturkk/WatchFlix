// __tests__/reminderReleasedActions.test.js
//
// Profil > Hatırlatıcılar: "Yayınlandı" kartının seçim sayfasındaki üç yol
// (utils/reminderReleasedActions). Kilitlenenler:
//   • izleme listesi / izlendi yazımı libraryActions'tan geçer, doğru kimlik ve tarihle,
//   • hatırlatıcı ANCAK yazım başarılıysa kaldırılır (düşen yazımda kaybolmaz),
//   • TMDB detayı gelmezse (çevrimdışı) hatırlatıcının kendi verisiyle yazılır,
//   • "Yalnız sil" eski Geri Al'lı silmeye gider.

const mockToast = { show: jest.fn() };
const mockDetails = { byUrl: {} };

jest.mock("@components/AppToast", () => ({ __esModule: true, default: mockToast }), { virtual: true });
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
jest.mock("../utils/cachedRead", () => ({
  cachedTmdb: jest.fn(async (url) => {
    const data = mockDetails.byUrl[url.split("?")[0]];
    if (!data) throw new Error("offline");
    return { data };
  }),
}));
jest.mock("../services/libraryActions", () => ({
  setListMembership: jest.fn(async () => ({ status: "added" })),
  markMovieWatched: jest.fn(async () => ({ event: { id: "ev" } })),
  markEpisodeWatched: jest.fn(async () => ({ status: "added", event: { id: "ev" } })),
}));
jest.mock("../services/userData", () => ({
  remindersActions: { removeMovie: jest.fn(() => true), removeEpisode: jest.fn(() => true) },
}));
jest.mock("../utils/libraryErrorText", () => ({ showLibraryError: jest.fn() }));
jest.mock("../utils/reminderQuickDelete", () => ({
  removeMovieReminderWithUndo: jest.fn(() => true),
  removeEpisodeReminderWithUndo: jest.fn(() => true),
}));

const library = require("../services/libraryActions");
const { remindersActions } = require("../services/userData");
const { showLibraryError } = require("../utils/libraryErrorText");
const quickDelete = require("../utils/reminderQuickDelete");
const { todayListDate } = require("../utils/mediaFacts");
const { finishReleasedReminder, episodeWatchParams } = require("../utils/reminderReleasedActions");

const TMDB = "https://api.themoviedb.org/3";
const movie = {
  movieId: 603,
  movieName: "Matrix",
  releaseDate: "2026-09-01",
  movieMinutes: 136,
  posterPath: "/m.jpg",
};
const episode = {
  episodeId: "e1",
  episodeNumber: 3,
  episodeName: "Üçüncü",
  airDate: "2026-09-02",
  stillPath: "/still.jpg",
  episodeMinutes: 48,
  showId: 7,
  showName: "Dizi",
  showPosterPath: "/s.jpg",
  seasonNumber: 2,
};
const run = (action, kind, reminder) =>
  finishReleasedReminder({ action, uid: "u1", kind, reminder, apiKey: "key", language: "tr" });

beforeEach(() => {
  jest.clearAllMocks();
  mockDetails.byUrl = {};
});

describe("izleme listesine ekle", () => {
  test("film: TMDB detayıyla izleme listesine yazılır, sonra hatırlatıcı (Geri Al'sız) kalkar", async () => {
    mockDetails.byUrl[`${TMDB}/movie/603`] = {
      id: 603,
      title: "The Matrix",
      poster_path: "/tmdb.jpg",
      release_date: "1999-03-31",
      runtime: 136,
      genres: [{ name: "Bilim Kurgu" }],
    };

    await expect(run("watchlist", "movie", movie)).resolves.toBe(true);

    expect(library.setListMembership).toHaveBeenCalledTimes(1);
    const call = library.setListMembership.mock.calls[0][0];
    expect(call).toMatchObject({ uid: "u1", listKey: "watchList", desired: true });
    expect(call.item).toMatchObject({ id: 603, type: "movie" });
    expect(remindersActions.removeMovie).toHaveBeenCalledWith("u1", 603);
    expect(quickDelete.removeMovieReminderWithUndo).not.toHaveBeenCalled();
    expect(mockToast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", text1: "İzleme listesine eklendi" }),
    );
  });

  test("dizi: bölüm değil DİZİ izleme listesine girer; bölüm hatırlatıcısı kalkar", async () => {
    await expect(run("watchlist", "tv", episode)).resolves.toBe(true);

    const call = library.setListMembership.mock.calls[0][0];
    expect(call.item).toMatchObject({ id: 7, type: "tv" });
    expect(remindersActions.removeEpisode).toHaveBeenCalledWith("u1", 7, "e1");
  });

  test("yazım düşerse hata gösterilir ve hatırlatıcı KALIR", async () => {
    library.setListMembership.mockRejectedValueOnce(new Error("boom"));

    await expect(run("watchlist", "movie", movie)).resolves.toBe(false);

    expect(showLibraryError).toHaveBeenCalledWith(expect.any(Error), { source: "reminders_watchlist" });
    expect(remindersActions.removeMovie).not.toHaveBeenCalled();
  });
});

describe("izlendi olarak işaretle", () => {
  test("film çevrimdışı: hatırlatıcının kendi verisiyle BUGÜN izlendi yazılır", async () => {
    await expect(run("watched", "movie", movie)).resolves.toBe(true);

    const call = library.markMovieWatched.mock.calls[0][0];
    expect(call.uid).toBe("u1");
    expect(call.watchDate).toBe(todayListDate());
    expect(call.movie).toMatchObject({ id: 603, type: "movie", releaseDate: "2026-09-01" });
    expect(remindersActions.removeMovie).toHaveBeenCalledWith("u1", 603);
  });

  test("bölüm: sezon bölüm sayısı dizi detayından, bölüm alanları hatırlatıcıdan", async () => {
    mockDetails.byUrl[`${TMDB}/tv/7`] = {
      id: 7,
      name: "Dizi",
      number_of_episodes: 20,
      number_of_seasons: 2,
      poster_path: "/tv.jpg",
      genres: [{ name: "Dram" }],
      seasons: [
        { season_number: 1, episode_count: 10 },
        { season_number: 2, episode_count: 10, poster_path: "/s2.jpg" },
      ],
    };

    await expect(run("watched", "tv", episode)).resolves.toBe(true);

    const call = library.markEpisodeWatched.mock.calls[0][0];
    expect(call).toMatchObject({
      uid: "u1",
      watchDate: todayListDate(),
      source: "reminders",
      showMeta: { id: 7, showEpisodeCount: 20, showSeasonCount: 2, genres: ["Dram"] },
      seasonMeta: { seasonNumber: 2, seasonEpisodes: 10, seasonPosterPath: "/s2.jpg" },
      episode: {
        episodeNumber: 3,
        episodeName: "Üçüncü",
        episodeMinutes: 48,
        episodePosterPath: "/still.jpg",
        releaseDate: "2026-09-02",
      },
    });
    expect(remindersActions.removeEpisode).toHaveBeenCalledWith("u1", 7, "e1");
  });

  test("bölüm yazılmazsa (empty-episode) uyarı çıkar, hatırlatıcı KALIR", async () => {
    library.markEpisodeWatched.mockResolvedValueOnce({ status: "empty-episode", event: null });

    await expect(run("watched", "tv", episode)).resolves.toBe(false);

    expect(remindersActions.removeEpisode).not.toHaveBeenCalled();
    expect(mockToast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "warning" }));
  });

  test("günlük süre sınırı gibi kapı hataları gösterilir, hatırlatıcı KALIR", async () => {
    library.markMovieWatched.mockRejectedValueOnce(new Error("day-limit"));

    await expect(run("watched", "movie", movie)).resolves.toBe(false);

    expect(showLibraryError).toHaveBeenCalledWith(expect.any(Error), { source: "reminders_watched" });
    expect(remindersActions.removeMovie).not.toHaveBeenCalled();
  });

  test("dizi detayı yoksa hatırlatıcıdaki ad/afişle yazılır", () => {
    const params = episodeWatchParams(episode, null);
    expect(params.showMeta).toMatchObject({ id: 7, name: "Dizi", imagePath: "/s.jpg", showEpisodeCount: 0 });
    expect(params.seasonMeta).toMatchObject({ seasonNumber: 2, seasonEpisodes: 0 });
  });
});

describe("yalnız sil", () => {
  test("eski Geri Al'lı silmeye gider, kütüphaneye dokunmaz", async () => {
    await expect(run("delete", "movie", movie)).resolves.toBe(true);
    await expect(run("delete", "tv", episode)).resolves.toBe(true);

    expect(quickDelete.removeMovieReminderWithUndo).toHaveBeenCalledWith("u1", movie);
    expect(quickDelete.removeEpisodeReminderWithUndo).toHaveBeenCalledWith("u1", episode);
    expect(library.setListMembership).not.toHaveBeenCalled();
    expect(library.markMovieWatched).not.toHaveBeenCalled();
  });

  test("kullanıcı yoksa ya da bilinmeyen eylemde hiçbir şey yapılmaz", async () => {
    await expect(finishReleasedReminder({ action: "watched", uid: "", kind: "movie", reminder: movie })).resolves.toBe(false);
    await expect(run("bogus", "movie", movie)).resolves.toBe(false);
    expect(library.markMovieWatched).not.toHaveBeenCalled();
    expect(remindersActions.removeMovie).not.toHaveBeenCalled();
  });
});
