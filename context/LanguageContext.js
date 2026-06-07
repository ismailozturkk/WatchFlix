import React, { createContext, useContext, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "../translations"; // i18next yapılandırmasını başlatır
import { useLanguageSettings } from "./AppSettingsContext";

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const { selectedLanguage, changeLanguage } = useLanguageSettings();
  const { i18n } = useTranslation();

  // Keep i18n in sync with AppSettings (covers the initial load case where
  // AppSettings resolves after i18n has already initialized with its default).
  useEffect(() => {
    if (selectedLanguage && selectedLanguage !== i18n.language) {
      i18n.changeLanguage(selectedLanguage);
    }
  }, [selectedLanguage, i18n]);

  const toggleLanguage = useCallback((newLanguage) => {
    changeLanguage(newLanguage);      // writes to AsyncStorage via AppSettings
    i18n.changeLanguage(newLanguage); // immediate UI update
  }, [changeLanguage, i18n]);

  const value = useMemo(() => ({
    language: selectedLanguage,
    toggleLanguage,
    t: i18n.getResourceBundle(selectedLanguage, "translation") || {},
  }), [selectedLanguage, toggleLanguage, i18n]);

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
