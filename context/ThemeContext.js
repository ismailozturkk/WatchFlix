import React, { createContext, useContext, useMemo } from "react";
import { buildCustomTheme, getThemeColors } from "../theme/colors";
import { useThemeSettings } from "./AppSettingsContext";

const ThemeContext = createContext();

// "custom:<id>" veya eski "custom" seçimine karşılık gelen özel temayı bulur.
const findCustomTheme = (selectedTheme, customThemes) => {
  if (!selectedTheme || !selectedTheme.startsWith("custom")) return null;
  const id = selectedTheme.includes(":") ? selectedTheme.split(":")[1] : null;
  if (id) return customThemes.find((t) => t.id === id) || null;
  return customThemes[0] || null; // legacy "custom" -> ilk özel tema
};

export const ThemeProvider = ({ children }) => {
  const { selectedTheme, changeTheme, customThemes = [], saveCustomTheme, deleteCustomTheme } = useThemeSettings();

  const value = useMemo(() => {
    // Bir özel tema seçiliyse token setinden tam tema üretilir; bulunamazsa
    // yerleşik temaya geri düşülür.
    const custom = findCustomTheme(selectedTheme, customThemes);
    return {
      theme: custom ? buildCustomTheme(custom.tokens) : getThemeColors(selectedTheme),
      selectedTheme,
      changeTheme,
      customThemes,
      saveCustomTheme,
      deleteCustomTheme,
    };
  }, [selectedTheme, changeTheme, customThemes, saveCustomTheme, deleteCustomTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
