import { NativeModules, Platform } from "react-native";

// Android: klasik köprü modülü (android/.../widget/ReminderWidgetModule.kt).
// iOS: yerel Expo modülü (modules/reminder-widget) — paylaşılan App Group'a
// yazıp WidgetKit zaman çizelgelerini yeniler.
const androidWidget = NativeModules.ReminderWidgetModule;

let iosWidgetResolved = false;
let iosWidget = null;
const getIosWidget = () => {
  if (iosWidgetResolved) return iosWidget;
  iosWidgetResolved = true;
  try {
    // Tembel yüklenir: non-iOS platformlar ve Jest (bkz. jest.config.js — saf
    // JS testleri) asla expo-modules-core'u import etmez.
    const { requireOptionalNativeModule } = require("expo-modules-core");
    iosWidget = requireOptionalNativeModule("ReminderWidget");
  } catch (error) {
    iosWidget = null;
  }
  return iosWidget;
};

const getWidget = () => (Platform.OS === "ios" ? getIosWidget() : androidWidget);

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
  const widget = getWidget();
  if (!widget?.updateReminders) return;
  const items = buildReminderWidgetItems(reminders, language);
  try {
    await widget.updateReminders(JSON.stringify(items), language);
  } catch (error) {
    if (__DEV__) console.warn("[ReminderWidget] sync failed:", error?.message);
  }
};

export const clearReminderWidget = async () => {
  const widget = getWidget();
  if (!widget?.clearReminders) return;
  try {
    await widget.clearReminders();
  } catch (error) {
    if (__DEV__) console.warn("[ReminderWidget] clear failed:", error?.message);
  }
};
