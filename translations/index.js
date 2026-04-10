import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./en.json";
import tr from "./tr.json";

const STORE_LANGUAGE_KEY = "selectedLanguage";

const languageDetector = {
  type: "languageDetector",
  async: true,
  detect: async (callback) => {
    try {
      const savedLanguage = await AsyncStorage.getItem(STORE_LANGUAGE_KEY);
      if (savedLanguage) {
        return callback(savedLanguage);
      }
      return callback("tr"); // Varsayılan dil
    } catch (error) {
      return callback("tr");
    }
  },
  init: () => {},
  cacheUserLanguage: async (language) => {
    try {
      await AsyncStorage.setItem(STORE_LANGUAGE_KEY, language);
    } catch (error) {
      console.error("Dil kaydedilemedi:", error);
    }
  },
};

const resources = {
  en: { translation: en },
  tr: { translation: tr },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "tr",
    compatibilityJSON: "v3", // React Native Android için gereklidir
    interpolation: {
      escapeValue: false, // React XSS'e karşı kendi korumasına sahip
    },
    react: {
      useSuspense: false, // React Native asenkron load sorunlarını çözer
    },
    // Performans için development modunda debug'ı kapatıyoruz
    debug: false,
  });

export default i18n;
