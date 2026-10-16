// __tests__/reminderQuickDelete.test.js
//
// Profil > Hatırlatıcılar: "Yayınlandı" kartındaki çöp düğmesinin yazma tarafı
// (utils/reminderQuickDelete). GERÇEK yerel-öncelikli alan + sahte bulut: silme yerelde
// anında olmalı, toast'ta "Geri Al" çıkmalı, geri alma silineni AYNI belgeyle (ve
// dizinin son bölümüyse dizi belgesiyle) yeniden yazmalı.

const { boot } = require("./helpers/userDataHarness");

jest.useFakeTimers();
afterEach(() => jest.clearAllTimers());

const mockToast = { show: jest.fn() };

const movie = (id, extra = {}) => ({
  movieId: id,
  movieName: `Film ${id}`,
  releaseDate: "2026-09-01",
  posterPath: "/p.jpg",
  type: "movie",
  ...extra,
});
const episode = (showId, epId, extra = {}) => ({
  episodeId: String(epId),
  episodeNumber: 1,
  showId,
  showName: `Dizi ${showId}`,
  showPosterPath: "/s.jpg",
  seasonNumber: 1,
  airDate: "2026-09-01",
  ...extra,
});

async function setup() {
  const h = boot();
  jest.doMock("react-native-toast-message", () => ({ __esModule: true, default: mockToast }));
  jest.doMock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
  jest.doMock("../services/userData", () => ({ remindersActions: h.mods.remindersActions }));
  const util = require("../utils/reminderQuickDelete");

  await h.mods.reminders.ensureHydrated("u1");
  h.mods.worker.start("u1");
  await jest.advanceTimersByTimeAsync(0);
  return { h, util, actions: h.mods.remindersActions };
}
const flush = () => jest.advanceTimersByTimeAsync(500);
const lastToast = () => mockToast.show.mock.calls[mockToast.show.mock.calls.length - 1][0];

beforeEach(() => mockToast.show.mockClear());

describe("film hatırlatıcısı", () => {
  test("kaldırır, toast'ta Geri Al çıkar; geri alma aynı belgeyi yeniden yazar", async () => {
    const { h, util, actions } = await setup();
    const doc = movie(603, { movieMinutes: 136, createdAt: "2026-08-01" });
    actions.setMovie("u1", doc);
    await flush();

    expect(util.removeMovieReminderWithUndo("u1", doc)).toBe(true);

    // Yerelde ANINDA: ağ beklenmez.
    expect(actions.hasMovie("u1", 603)).toBe(false);
    const toast = lastToast();
    expect(toast).toMatchObject({ type: "info", text1: "Hatırlatma kaldırıldı" });
    expect(toast.visibilityTime).toBeGreaterThan(3000); // dokunmaya yetecek süre
    expect(toast.props.action.label).toBe("Geri Al");
    await flush();
    expect(h.remote.db.has("Reminders/u1/movies/603")).toBe(false);

    toast.props.action.onPress();

    expect(actions.hasMovie("u1", 603)).toBe(true);
    expect(h.mods.reminders.getSnapshot("u1").lists.movies).toEqual([doc]);
    await flush();
    expect(h.remote.db.get("Reminders/u1/movies/603")).toMatchObject({
      movieId: 603,
      movieMinutes: 136,
      createdAt: "2026-08-01",
    });
  });

  test("kullanıcı ya da kimlik yoksa hiçbir şey yapmaz, toast da çıkmaz", async () => {
    const { util, actions } = await setup();
    actions.setMovie("u1", movie(1));

    expect(util.removeMovieReminderWithUndo("", movie(1))).toBe(false);
    expect(util.removeMovieReminderWithUndo("u1", null)).toBe(false);
    expect(util.removeMovieReminderWithUndo("u1", { movieName: "x" })).toBe(false);

    expect(actions.hasMovie("u1", 1)).toBe(true);
    expect(mockToast.show).not.toHaveBeenCalled();
  });
});

describe("bölüm hatırlatıcısı", () => {
  test("dizinin başka bölümü kaldıysa dizi belgesi KALIR; geri alma bölümü geri getirir", async () => {
    const { h, util, actions } = await setup();
    const a = episode(7, "e1");
    const b = episode(7, "e2", { episodeNumber: 2 });
    actions.setEpisode("u1", a);
    actions.setEpisode("u1", b);
    await flush();

    expect(util.removeEpisodeReminderWithUndo("u1", a)).toBe(true);
    await flush();
    expect(actions.hasEpisode("u1", 7, "e1")).toBe(false);
    expect(actions.hasEpisode("u1", 7, "e2")).toBe(true);
    expect(h.remote.db.has("Reminders/u1/tvShows/7")).toBe(true);

    lastToast().props.action.onPress();
    await flush();
    expect(actions.hasEpisode("u1", 7, "e1")).toBe(true);
    expect(h.remote.db.has("Reminders/u1/tvShows/7/episodes/e1")).toBe(true);
  });

  test("son bölüm silinince dizi belgesi de gider; geri alma onu da yeniden yazar", async () => {
    const { h, util, actions } = await setup();
    const only = episode(9, "x1");
    actions.setEpisode("u1", only);
    await flush();
    expect(h.remote.db.has("Reminders/u1/tvShows/9")).toBe(true);

    expect(util.removeEpisodeReminderWithUndo("u1", only)).toBe(true);
    await flush();
    expect(h.remote.db.has("Reminders/u1/tvShows/9")).toBe(false);
    expect(h.remote.db.has("Reminders/u1/tvShows/9/episodes/x1")).toBe(false);

    lastToast().props.action.onPress();
    await flush();
    expect(actions.hasEpisode("u1", 9, "x1")).toBe(true);
    expect(h.remote.db.get("Reminders/u1/tvShows/9")).toMatchObject({
      showId: 9,
      showName: "Dizi 9",
    });
    expect(h.remote.db.has("Reminders/u1/tvShows/9/episodes/x1")).toBe(true);
  });

  test("showId ya da episodeId eksikse reddeder", async () => {
    const { util } = await setup();

    expect(util.removeEpisodeReminderWithUndo("u1", { showId: 1 })).toBe(false);
    expect(util.removeEpisodeReminderWithUndo("u1", { episodeId: "e" })).toBe(false);
    expect(util.removeEpisodeReminderWithUndo("", episode(1, "e"))).toBe(false);
    expect(mockToast.show).not.toHaveBeenCalled();
  });
});
