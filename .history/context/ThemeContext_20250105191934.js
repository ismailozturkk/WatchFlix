import React, { createContext, useState, useContext, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getThemeColors } from "../theme/colors";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [selectedTheme, setSelectedTheme] = useState("dark");
  const currentTheme = getThemeColors(selectedTheme);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem("selectedTheme");
        if (savedTheme) {
          setSelectedTheme(savedTheme);
        }
      } catch (error) {
        console.error("Tema yüklenemedi:", error);
      }
    };
    loadTheme();
  }, []);

  const changeTheme = async (newTheme) => {
    setSelectedTheme(newTheme);
    try {
      await AsyncStorage.setItem("selectedTheme", newTheme);
    } catch (error) {
      console.error("Tema kaydedilemedi:", error);
    }
  };

  const value = {
    theme: currentTheme,
    selectedTheme,
    changeTheme,
  };

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
