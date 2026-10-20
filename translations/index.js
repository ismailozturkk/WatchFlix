import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { Keys, get, has } from "../services/storage";
import {
  cihazDilleriniOku,
  cihazDilindenSec,
} from "../utils/deviceLanguage";
import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import pt from "./pt.json";
import tr from "./tr.json";

// Kayıtlı dil YOKSA cihaz dili. `get()` kayıt yokken registry varsayılanını
// ("tr") döndürdüğü için "hiç seçilmemiş" ile "Türkçe seçilmiş" ancak `has()`
// ile ayrılabiliyor — ayrım olmadan yabancı kullanıcı Türkçe açılıyordu.
//
// İlk çözümleme BİLEREK depoya yazılmıyor: yazan taraf tek (AppSettingsContext →
// changeLanguage) ve bu dosyanın okur kalması o kuralı bozmuyor. Yan etkisi de
// istenen yönde — kullanıcı dili elle seçene dek uygulama cihaz dilini izler,
// seçtiği an kayıt oluşur ve cihaz dili artık onu ezemez.
//
// AppSettingsContext açılış state'ini bu fonksiyondan alır; ayrışsalardı
// LanguageContext depodaki "tr"yi i18n'e geri yazıp cihaz dilini ezerdi.
export const cozumlenmisDil = () =>
  has(Keys.language)
    ? get(Keys.language)
    : cihazDilindenSec(cihazDilleriniOku());

const languageDetector = {
  type: "languageDetector",
  // MMKV senkron okuduğu için dil ilk denemede biliniyor: i18next artık
  // "tr" ile başlayıp sonra İngilizce'ye geçmiyor (açılıştaki dil flash'ı).
  async: false,
  detect: cozumlenmisDil,
  init: () => {},
  // Write is owned by AppSettingsContext — no-op here to avoid double writes.
  cacheUserLanguage: () => {},
};

// Yeni dil: utils/appLanguages.js'e kayıt + buraya paket (statik import şart —
// Metro dinamik require'ı paketlemez). Rehber: docs/mimari/DIL_DESTEGI_REHBERI.md
const resources = {
  de: { translation: de },
  en: { translation: en },
  es: { translation: es },
  pt: { translation: pt },
  tr: { translation: tr },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Eksik anahtar önce İngilizce'ye, sonra Türkçe'ye düşer (es/pt/de için). tr/en eskisi
    // gibi Türkçe'ye düşer — paketleri tam eşit olduğundan bu yalnız güvenlik ağı.
    fallbackLng: { es: ["en", "tr"], pt: ["en", "tr"], de: ["en", "tr"], default: ["tr"] },
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
