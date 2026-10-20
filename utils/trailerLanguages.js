export const TRAILER_LANGUAGES = [
  { code: "en", region: "en-US", label: "English" },
  { code: "tr", region: "tr-TR", label: "Türkçe" },
  { code: "de", region: "de-DE", label: "Deutsch" },
  { code: "fr", region: "fr-FR", label: "Français" },
  { code: "es", region: "es-ES", label: "Español" },
  { code: "it", region: "it-IT", label: "Italiano" },
  { code: "pt", region: "pt-BR", label: "Português" },
  { code: "ru", region: "ru-RU", label: "Русский" },
  { code: "ja", region: "ja-JP", label: "日本語" },
  { code: "ko", region: "ko-KR", label: "한국어" },
  { code: "zh", region: "zh-CN", label: "中文" },
  { code: "hi", region: "hi-IN", label: "हिन्दी" },
  { code: "ar", region: "ar-SA", label: "العربية" },
];

export const normalizeTrailerLanguageCode = (code, fallback = "en") => {
  const normalized = String(code || "")
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(normalized) ? normalized : fallback;
};

export const trailerLanguageOf = (code) => {
  const normalized = normalizeTrailerLanguageCode(code);
  return (
    TRAILER_LANGUAGES.find((language) => language.code === normalized) || {
      code: normalized,
      // TMDB also accepts an ISO-639 language without a region suffix.
      region: normalized,
      label: normalized.toUpperCase(),
    }
  );
};

export const buildTrailerLanguageOrder = ({ originalLanguage, appLanguage, selectedLanguage }) => {
  const app = normalizeTrailerLanguageCode(appLanguage);
  const original = normalizeTrailerLanguageCode(originalLanguage);
  const selected = normalizeTrailerLanguageCode(selectedLanguage, app);
  // Sıralama kuralı:
  //   1. Seçili dil (uygulama dili / seçilen dil),
  //   2. İngilizce,
  //   3. İçeriğin ana dili.
  // Diğer diller modalından seçilen farklı bir dil varsa en sona eklenir.
  return [...new Set([app, "en", original, selected])];
};
