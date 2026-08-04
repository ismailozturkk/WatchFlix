jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

jest.mock("../services/widgetBridge", () => ({
  callWidget: jest.fn(() => Promise.resolve()),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_WIDGET_PREFERENCES,
  loadWidgetPreferences,
  normalizeWidgetPreferences,
  saveWidgetPreferences,
} from "../services/widgetPreferencesService";
import { callWidget } from "../services/widgetBridge";

describe("widgetPreferencesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("bozuk tercihleri güvenli varsayılanlara normalize eder", () => {
    expect(
      normalizeWidgetPreferences({
        background: "unknown",
        accent: "#ffffff",
        reminders: { content: "person", maxItems: 99, showDates: false },
        stats: { showMovies: false },
      }),
    ).toEqual({
      ...DEFAULT_WIDGET_PREFERENCES,
      reminders: {
        ...DEFAULT_WIDGET_PREFERENCES.reminders,
        appearance: {
          ...DEFAULT_WIDGET_PREFERENCES.reminders.appearance,
          themeId: "legacy",
          themeName: "Önceki görünüm",
          accent: "#FFFFFF",
          bold: "#FFFFFF",
        },
        showDates: false,
      },
      lists: {
        ...DEFAULT_WIDGET_PREFERENCES.lists,
        appearance: {
          ...DEFAULT_WIDGET_PREFERENCES.lists.appearance,
          themeId: "legacy",
          themeName: "Önceki görünüm",
          accent: "#FFFFFF",
          bold: "#FFFFFF",
        },
      },
      stats: {
        ...DEFAULT_WIDGET_PREFERENCES.stats,
        appearance: {
          ...DEFAULT_WIDGET_PREFERENCES.stats.appearance,
          themeId: "legacy",
          themeName: "Önceki görünüm",
          accent: "#FFFFFF",
          bold: "#FFFFFF",
        },
        showMovies: false,
      },
    });
  });

  it("kaydı yükler ve normalize eder", async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify({
        density: "compact",
        lists: {
          maxPosters: 18,
          appearance: { themeId: "custom:test", accent: "#123456" },
        },
      }),
    );
    const result = await loadWidgetPreferences();
    expect(result.reminders.density).toBe("compact");
    expect(result.lists.maxPosters).toBe(18);
    expect(result.lists.appearance.themeId).toBe("custom:test");
    expect(result.lists.appearance.accent).toBe("#123456");
  });

  it("kaydedince native widgetları yeniler", async () => {
    await saveWidgetPreferences({
      ...DEFAULT_WIDGET_PREFERENCES,
      reminders: {
        ...DEFAULT_WIDGET_PREFERENCES.reminders,
        appearance: {
          ...DEFAULT_WIDGET_PREFERENCES.reminders.appearance,
          accent: "#EC4899",
        },
      },
    });
    expect(AsyncStorage.setItem).toHaveBeenCalled();
    expect(callWidget).toHaveBeenCalled();
  });
});
