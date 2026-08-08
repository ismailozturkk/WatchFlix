import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { Keys, get } from "../services/storage";
import en from "./en.json";
import tr from "./tr.json";

const STORE_LANGUAGE_KEY = Keys.language.key;

const languageDetector = {
  type: "languageDetector",
  // MMKV senkron okuduğu için dil ilk denemede biliniyor: i18next artık
  // "tr" ile başlayıp sonra İngilizce'ye geçmiyor (açılıştaki dil flash'ı).
  async: false,
  detect: () => get(Keys.language),
  init: () => {},
  // Write is owned by AppSettingsContext — no-op here to avoid double writes.
  cacheUserLanguage: () => {},
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
