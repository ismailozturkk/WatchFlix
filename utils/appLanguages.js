// utils/appLanguages.js
//
// Uygulama dillerinin TEK kayıt defteri + dil koduna bağlı çıkarımlar. SAF modül
// (React/i18n/native importu yok) — functions/ ve jest tarafından doğrudan okunabilir.
//
// NEDEN: dil bilgisi eskiden her dosyada elle dallanıyordu (`language === "tr" ?
// "tr-TR" : "en-US"`, `isTr`, `=== "en" ? "en" : "tr"` …). Üçüncü dil gelince bu
// dallanmalar yabancı dili sessizce Türkçe'ye ya da İngilizce'ye düşürüyordu (bkz.
// docs/mimari/DIL_DESTEGI_REHBERI.md, "düşüş yönü"). Yeni dil eklemek artık BURAYA
// bir satır + translations/<kod>.json demek; locale/bölge/seçici/yedek doğrulaması
// buradan türer.
//
// KURAL: bilinmeyen dil → İNGİLİZCE (`FALLBACK_LANGUAGE`). Türkçe yalnız "tr"
// seçilince çıkar. Bu, utils/deviceLanguage.js'deki YEDEK_DIL ile aynı karar.

/**
 * @typedef {Object} AppLanguage
 * @property {string} code        ISO 639-1 — depoda saklanan değer (`Keys.language`)
 * @property {string} name        Seçicide ikincil satır: dilin İNGİLİZCE adı (arama da bunu görür)
 * @property {string} nativeName  Seçicide asıl satır: dilin KENDİ adı
 * @property {string} flag        react-native-country-flag ISO ülke kodu
 * @property {string} intlLocale  Intl / toLocale* / localeCompare etiketi
 * @property {string} tmdbLanguage TMDB `language` parametresi
 * @property {string} tmdbRegion  TMDB `region` / `watch_region` (dil ≠ ülke: tek değerli varsayım)
 * @property {string[]} tmdbImageLanguages TMDB poster/arka plan dilleri, öncelik sırasıyla (`null` dilsiz görseller her zaman sona eklenir)
 * @property {string} legalLang   website/legal.js'in bildiği sayfa dili (yalnız tr/en)
 * @property {string} aiPromptName Gemini sistem talimatına yazılan dil etiketi
 */

/** @type {ReadonlyArray<AppLanguage>} */
export const APP_LANGUAGES = Object.freeze([
  {
    code: "tr",
    name: "Turkish",
    nativeName: "Türkçe",
    flag: "tr",
    intlLocale: "tr-TR",
    tmdbLanguage: "tr-TR",
    tmdbRegion: "TR",
    tmdbImageLanguages: ["tr", "en"],
    legalLang: "tr",
    aiPromptName: "tr",
  },
  {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "us",
    intlLocale: "en-US",
    tmdbLanguage: "en-US",
    tmdbRegion: "US",
    tmdbImageLanguages: ["en", "tr"],
    legalLang: "en",
    aiPromptName: "en",
  },
  {
    // Tarafsız İspanyolca (tú). TMDB için tek bölge gerekiyor: ES. Latin Amerika
    // için ayrı bölge seçtirmek istenirse burası bölünür (bkz. rehber, bölüm 10).
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    flag: "es",
    intlLocale: "es-ES",
    tmdbLanguage: "es-ES",
    tmdbRegion: "ES",
    tmdbImageLanguages: ["es", "en"],
    // website/legal.js henüz yalnız tr/en biliyor → İngilizce sayfa.
    legalLang: "en",
    aiPromptName: "Spanish (es)",
  },
]);

export const SUPPORTED_LANGUAGE_CODES = Object.freeze(APP_LANGUAGES.map((l) => l.code));

/** Bilinmeyen dilin düşeceği dil. utils/deviceLanguage.js YEDEK_DIL ile aynı. */
export const FALLBACK_LANGUAGE = "en";

const BY_CODE = new Map(APP_LANGUAGES.map((l) => [l.code, l]));

/** "tr-TR", "TR", " en_GB " → "tr" | "en" (tanınmayan → ""). */
const baseCode = (value) =>
  typeof value === "string" ? value.trim().toLowerCase().split(/[-_]/)[0] : "";

/** Dil değiştirme DÜĞMESİ için (ör. onboarding): kayıt sırasındaki sonraki dil, sondan başa döner. */
export const nextAppLanguage = (language) => {
  const index = SUPPORTED_LANGUAGE_CODES.indexOf(baseCode(language));
  return SUPPORTED_LANGUAGE_CODES[(index + 1) % SUPPORTED_LANGUAGE_CODES.length];
};

/**
 * Eski API'ler dili `tr` BOOLEAN'ı olarak alıyordu (`true` = Türkçe, `false` = İngilizce).
 * Bu köprü hem o biçimi hem yeni dil kodunu kabul eder → "tr" | "en" | "es" …
 */
export const legacyFlagToLanguage = (value) =>
  typeof value === "boolean" ? (value ? "tr" : "en") : normalizeAppLanguage(value);

export const isSupportedAppLanguage = (code) => BY_CODE.has(code);

/** Her girdiyi desteklenen bir koda indirger; bilinmeyen → İngilizce. */
export const normalizeAppLanguage = (language) => {
  const code = baseCode(language);
  return BY_CODE.has(code) ? code : FALLBACK_LANGUAGE;
};

/** @returns {AppLanguage} */
export const getAppLanguage = (language) => BY_CODE.get(normalizeAppLanguage(language));

export const intlLocaleOf = (language) => getAppLanguage(language).intlLocale;
export const tmdbLanguageOf = (language) => getAppLanguage(language).tmdbLanguage;
export const tmdbRegionOf = (language) => getAppLanguage(language).tmdbRegion;
/** Poster/arka plan dilleri: ["es", "en"] (öncelik sırası). */
export const tmdbImageLanguagesOf = (language) => getAppLanguage(language).tmdbImageLanguages;
/** TMDB `include_image_language` değeri: "es,en,null". */
export const tmdbImageLanguageOrderOf = (language) =>
  [...tmdbImageLanguagesOf(language), "null"].join(",");
export const legalLanguageOf = (language) => getAppLanguage(language).legalLang;
export const aiPromptLanguageOf = (language) => getAppLanguage(language).aiPromptName;

/**
 * Elle yazılmış metin tablosu olan modüller için: uygulama dili tabloda VARSA o,
 * yoksa İngilizce (tabloda en yoksa ilk kol). `language === "en" ? "en" : "tr"`
 * kalıbının yerine — yabancı dili Türkçe'ye düşürmez.
 *
 * @param {string} language
 * @param {ReadonlyArray<string>} available  modülün metin sahibi olduğu diller
 */
export const copyLanguage = (language, available) => {
  const code = normalizeAppLanguage(language);
  if (available.includes(code)) return code;
  return available.includes(FALLBACK_LANGUAGE) ? FALLBACK_LANGUAGE : available[0];
};

/**
 * `{ tr: …, en: …, es: … }` tablosundan dile uygun değeri seçer (yoksa İngilizce).
 * @template T
 * @param {string} language
 * @param {Record<string, T>} table
 * @returns {T}
 */
export const pickByLanguage = (language, table) =>
  table[copyLanguage(language, Object.keys(table))];
