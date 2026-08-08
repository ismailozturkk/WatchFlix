import { Platform } from "react-native";
import { callWidget } from "./widgetBridge";
import { Keys, get, set } from "./storage";

export const WIDGET_PREFERENCES_KEY = Keys.widgetPreferences.key;

const PURPLE_APPEARANCE = Object.freeze({
  themeId: "purple",
  themeName: "Gece Moru",
  background: "#16131E",
  surface: "#211C2E",
  surfaceAlt: "#1B1726",
  border: "#332C46",
  text: "#F4F2F9",
  secondaryText: "#CFC9DE",
  muted: "#7E7694",
  accent: "#8B5CF6",
  bold: "#7C3AED",
});

const BLUE_APPEARANCE = Object.freeze({
  themeId: "blue",
  themeName: "Lacivert",
  background: "#141C33",
  surface: "#23324B",
  surfaceAlt: "#1B2440",
  border: "#2A3E63",
  text: "#EFF5FA",
  secondaryText: "#8BAFD0",
  muted: "#5F7694",
  accent: "#4C8DFF",
  bold: "#2D6BDF",
});

export const DEFAULT_WIDGET_PREFERENCES = Object.freeze({
  reminders: Object.freeze({
    appearance: PURPLE_APPEARANCE,
    density: "comfortable",
    showTitle: true,
    content: "all",
    showPosters: true,
    showDates: true,
    maxItems: 5,
  }),
  lists: Object.freeze({
    appearance: PURPLE_APPEARANCE,
    density: "comfortable",
    showTitle: true,
    showCount: true,
    showNavigation: true,
    maxPosters: 12,
  }),
  stats: Object.freeze({
    appearance: BLUE_APPEARANCE,
    density: "comfortable",
    showTitle: false,
    showMovies: true,
    showTv: true,
    showDuration: true,
  }),
});

const DENSITIES = new Set(["compact", "comfortable"]);
const CONTENT_FILTERS = new Set(["all", "movie", "tv"]);
const REMINDER_LIMITS = new Set([3, 5, 8]);
const POSTER_LIMITS = new Set([6, 12, 18]);
const HEX_COLOR = /^#[0-9A-F]{6}$/;
const APPEARANCE_COLOR_KEYS = [
  "background",
  "surface",
  "surfaceAlt",
  "border",
  "text",
  "secondaryText",
  "muted",
  "accent",
  "bold",
];

const bool = (value, fallback) =>
  typeof value === "boolean" ? value : fallback;

const color = (value, fallback) => {
  const normalized = String(value || "").toUpperCase();
  return HEX_COLOR.test(normalized) ? normalized : fallback;
};

const normalizeAppearance = (value, fallback) => {
  const source = value && typeof value === "object" ? value : {};
  const result = {
    themeId:
      typeof source.themeId === "string" && source.themeId.trim()
        ? source.themeId.trim()
        : fallback.themeId,
    themeName:
      typeof source.themeName === "string" && source.themeName.trim()
        ? source.themeName.trim()
        : fallback.themeName,
  };
  APPEARANCE_COLOR_KEYS.forEach((key) => {
    result[key] = color(source[key], fallback[key]);
  });
  return result;
};

const legacyAppearance = (source, fallback) => {
  const hasLegacy =
    typeof source?.background === "string" ||
    typeof source?.accent === "string";
  if (!hasLegacy) return fallback;
  const legacyBackgrounds = {
    midnight: "#0B0E16",
    amoled: "#000000",
    plum: "#21142E",
  };
  return normalizeAppearance(
    {
      ...fallback,
      themeId: "legacy",
      themeName: "Önceki görünüm",
      background:
        legacyBackgrounds[source.background] || fallback.background,
      accent: source.accent,
      bold: source.accent,
    },
    fallback,
  );
};

export const normalizeWidgetPreferences = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const reminders =
    source.reminders && typeof source.reminders === "object"
      ? source.reminders
      : {};
  const lists =
    source.lists && typeof source.lists === "object" ? source.lists : {};
  const stats =
    source.stats && typeof source.stats === "object" ? source.stats : {};
  const reminderFallback = legacyAppearance(
    source,
    DEFAULT_WIDGET_PREFERENCES.reminders.appearance,
  );
  const listsFallback = legacyAppearance(
    source,
    DEFAULT_WIDGET_PREFERENCES.lists.appearance,
  );
  const statsFallback = legacyAppearance(
    source,
    DEFAULT_WIDGET_PREFERENCES.stats.appearance,
  );
  const legacyDensity = DENSITIES.has(source.density)
    ? source.density
    : null;
  const legacyShowTitle =
    typeof source.showTitle === "boolean" ? source.showTitle : null;

  return {
    reminders: {
      appearance: normalizeAppearance(
        reminders.appearance,
        reminderFallback,
      ),
      density: DENSITIES.has(reminders.density)
        ? reminders.density
        : legacyDensity || DEFAULT_WIDGET_PREFERENCES.reminders.density,
      showTitle: bool(
        reminders.showTitle,
        legacyShowTitle ?? DEFAULT_WIDGET_PREFERENCES.reminders.showTitle,
      ),
      content: CONTENT_FILTERS.has(reminders.content)
        ? reminders.content
        : DEFAULT_WIDGET_PREFERENCES.reminders.content,
      showPosters: bool(
        reminders.showPosters,
        DEFAULT_WIDGET_PREFERENCES.reminders.showPosters,
      ),
      showDates: bool(
        reminders.showDates,
        DEFAULT_WIDGET_PREFERENCES.reminders.showDates,
      ),
      maxItems: REMINDER_LIMITS.has(Number(reminders.maxItems))
        ? Number(reminders.maxItems)
        : DEFAULT_WIDGET_PREFERENCES.reminders.maxItems,
    },
    lists: {
      appearance: normalizeAppearance(lists.appearance, listsFallback),
      density: DENSITIES.has(lists.density)
        ? lists.density
        : legacyDensity || DEFAULT_WIDGET_PREFERENCES.lists.density,
      showTitle: bool(
        lists.showTitle,
        legacyShowTitle ?? DEFAULT_WIDGET_PREFERENCES.lists.showTitle,
      ),
      showCount: bool(
        lists.showCount,
        DEFAULT_WIDGET_PREFERENCES.lists.showCount,
      ),
      showNavigation: bool(
        lists.showNavigation,
        DEFAULT_WIDGET_PREFERENCES.lists.showNavigation,
      ),
      maxPosters: POSTER_LIMITS.has(Number(lists.maxPosters))
        ? Number(lists.maxPosters)
        : DEFAULT_WIDGET_PREFERENCES.lists.maxPosters,
    },
    stats: {
      appearance: normalizeAppearance(stats.appearance, statsFallback),
      density: DENSITIES.has(stats.density)
        ? stats.density
        : legacyDensity || DEFAULT_WIDGET_PREFERENCES.stats.density,
      showTitle: bool(
        stats.showTitle,
        legacyShowTitle ?? DEFAULT_WIDGET_PREFERENCES.stats.showTitle,
      ),
      showMovies: bool(
        stats.showMovies,
        DEFAULT_WIDGET_PREFERENCES.stats.showMovies,
      ),
      showTv: bool(stats.showTv, DEFAULT_WIDGET_PREFERENCES.stats.showTv),
      showDuration: bool(
        stats.showDuration,
        DEFAULT_WIDGET_PREFERENCES.stats.showDuration,
      ),
    },
  };
};

export const loadWidgetPreferences = async () =>
  normalizeWidgetPreferences(get(Keys.widgetPreferences));

export const syncWidgetPreferences = async (preferences) => {
  const payload = JSON.stringify(normalizeWidgetPreferences(preferences));
  if (Platform.OS === "ios") {
    await callWidget("ReminderWidgetModule", "updatePreferences", payload);
    return;
  }
  await Promise.all([
    callWidget("ReminderWidgetModule", "updatePreferences", payload),
    callWidget("ListsWidgetModule", "updatePreferences", payload),
    callWidget("StatsWidgetModule", "updatePreferences", payload),
  ]);
};

export const saveWidgetPreferences = async (preferences) => {
  const normalized = normalizeWidgetPreferences(preferences);
  set(Keys.widgetPreferences, normalized);
  await syncWidgetPreferences(normalized);
  return normalized;
};

export const resetWidgetPreferences = () =>
  saveWidgetPreferences(DEFAULT_WIDGET_PREFERENCES);
