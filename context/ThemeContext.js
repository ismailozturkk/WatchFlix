import React, { createContext, useContext, useMemo } from "react";
import { getThemeColors } from "../theme/colors";
import { useThemeSettings } from "./AppSettingsContext";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const { selectedTheme, changeTheme } = useThemeSettings();

  const value = useMemo(() => ({
    theme: getThemeColors(selectedTheme),
    selectedTheme,
    changeTheme,
  }), [selectedTheme, changeTheme]);

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
