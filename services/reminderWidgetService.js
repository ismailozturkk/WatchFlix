import { parseAirDate, startOfDay } from "../utils/airDate";
import { callWidget, widgetPosterUrl } from "./widgetBridge";

// Android: klasik köprü modülü (android/.../widget/ReminderWidgetModule.kt).
// iOS: yerel Expo modülü (modules/reminder-widget) — paylaşılan App Group'a
// yazıp WidgetKit zaman çizelgelerini yeniler. İkisinin seçimi widgetBridge'de.
const ANDROID_MODULE = "ReminderWidgetModule";

// parseAirDate: Date / Firestore Timestamp / ISO / "YYYY-MM-DD" hepsini çözer.
// Tarih-only değerler YEREL gece yarısına oturur — aksi halde negatif UTC
// ofsetli cihazlarda bugünkü bölüm "dün"e düşüp widget'tan eleniyordu.
const toEpoch = (value) => {
  const date = parseAirDate(value);
  return date ? date.getTime() : null;
};

// w185: satırdaki 34×50dp poster için küçük ve hızlı.
const posterUrl = (path) => widgetPosterUrl(path, "w185");

export const buildReminderWidgetItems = (reminders, language = "tr") => {
  const startOfToday = startOfDay(new Date());
  const movieItems = (reminders?.movieReminders || []).map((movie) => ({
    id: `movie-${movie.movieId}`,
    type: "movie",
    title: movie.movieName || (language === "tr" ? "Film" : "Movie"),
    subtitle:
      Number(movie.movieMinutes) > 0
        ? `${movie.movieMinutes} ${language === "tr" ? "dk" : "min"}`
        : "",
    poster: posterUrl(movie.posterPath),
    dateEpoch: toEpoch(movie.releaseDate),
  }));

  const tvItems = (reminders?.tvReminders || []).flatMap((show) =>
    (show.seasons || []).flatMap((season) =>
      (season.episodes || []).map((episode) => ({
        id: `tv-${episode.episodeId || `${show.showId}-${season.seasonNumber}-${episode.episodeNumber}`}`,
        type: "tv",
        title: show.showName || (language === "tr" ? "Dizi" : "TV Show"),
        subtitle:
          language === "tr"
            ? `S${season.seasonNumber} · ${episode.episodeNumber}. Bölüm`
            : `S${season.seasonNumber} · Episode ${episode.episodeNumber}`,
        // Sezon posteri varsa onu, yoksa dizi posterini kullan.
        poster: posterUrl(season.seasonPosterPath || show.showPosterPath),
        dateEpoch: toEpoch(episode.airDate),
      })),
    ),
  );

  return [...movieItems, ...tvItems]
    .filter(
      (item) =>
        item.dateEpoch !== null && item.dateEpoch >= startOfToday.getTime(),
    )
    .sort((a, b) => a.dateEpoch - b.dateEpoch)
    .slice(0, 20);
};

export const syncReminderWidget = (reminders, language = "tr") =>
  callWidget(
    ANDROID_MODULE,
    "updateReminders",
    JSON.stringify(buildReminderWidgetItems(reminders, language)),
    language,
  );

export const clearReminderWidget = () =>
  callWidget(ANDROID_MODULE, "clearReminders");
