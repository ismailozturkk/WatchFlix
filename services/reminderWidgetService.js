import { NativeModules, Platform } from "react-native";

const nativeWidget = NativeModules.ReminderWidgetModule;

const toEpoch = (value) => {
  if (!value) return null;
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  const epoch = date.getTime();
  return Number.isFinite(epoch) ? epoch : null;
};

export const buildReminderWidgetItems = (reminders, language = "tr") => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const movieItems = (reminders?.movieReminders || []).map((movie) => ({
    id: `movie-${movie.movieId}`,
    type: "movie",
    title: movie.movieName || (language === "tr" ? "Film" : "Movie"),
    subtitle:
      Number(movie.movieMinutes) > 0
        ? `${movie.movieMinutes} ${language === "tr" ? "dk" : "min"}`
        : "",
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

export const syncReminderWidget = async (reminders, language = "tr") => {
  if (Platform.OS !== "android" || !nativeWidget?.updateReminders) return;
  const items = buildReminderWidgetItems(reminders, language);
  try {
    await nativeWidget.updateReminders(JSON.stringify(items), language);
  } catch (error) {
    if (__DEV__) console.warn("[ReminderWidget] sync failed:", error?.message);
  }
};

export const clearReminderWidget = async () => {
  if (Platform.OS !== "android" || !nativeWidget?.clearReminders) return;
  try {
    await nativeWidget.clearReminders();
  } catch (error) {
    if (__DEV__) console.warn("[ReminderWidget] clear failed:", error?.message);
  }
};
