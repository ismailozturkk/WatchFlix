import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import "../translations"; // i18next yapılandırmasını başlatır

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState(i18n.language || "tr");

  // React Native açıldığında i18n default dil atamasını bekle ve state'e eşitle
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem("selectedLanguage");
        if (savedLanguage && savedLanguage !== i18n.language) {
          setLanguage(savedLanguage);
          i18n.changeLanguage(savedLanguage);
        }
      } catch (error) {
        console.error("Language load error:", error);
      }
    };
    loadSettings();
  }, [i18n]);

  const toggleLanguage = (newLanguage) => {
    setLanguage(newLanguage);
    i18n.changeLanguage(newLanguage);
    AsyncStorage.setItem("selectedLanguage", newLanguage).catch((error) => {
      console.error("Language save error:", error);
    });
  };

  const value = {
    language,
    toggleLanguage,
    t: i18n.getResourceBundle(language, 'translation') || {},
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

