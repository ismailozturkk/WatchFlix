export const ONBOARDING_GENRES = Object.freeze([
  { key: "action", tr: "Aksiyon", en: "Action", tvTr: "Aksiyon & Macera", tvEn: "Action & Adventure", movieId: 28, tvId: 10759, icon: "flash-outline" },
  { key: "adventure", tr: "Macera", en: "Adventure", movieId: 12, tvId: null, icon: "map-outline" },
  { key: "scifi", tr: "Bilim Kurgu", en: "Sci-Fi", tvTr: "Bilim Kurgu & Fantastik", tvEn: "Sci-Fi & Fantasy", movieId: 878, tvId: 10765, icon: "planet-outline" },
  { key: "fantasy", tr: "Fantastik", en: "Fantasy", movieId: 14, tvId: null, icon: "sparkles-outline" },
  { key: "drama", tr: "Dram", en: "Drama", movieId: 18, tvId: 18, icon: "heart-outline" },
  { key: "comedy", tr: "Komedi", en: "Comedy", movieId: 35, tvId: 35, icon: "happy-outline" },
  { key: "crime", tr: "Suç", en: "Crime", movieId: 80, tvId: 80, icon: "finger-print-outline" },
  { key: "mystery", tr: "Gizem", en: "Mystery", movieId: 9648, tvId: 9648, icon: "search-outline" },
  { key: "thriller", tr: "Gerilim", en: "Thriller", movieId: 53, tvId: null, icon: "pulse-outline" },
  { key: "horror", tr: "Korku", en: "Horror", movieId: 27, tvId: null, icon: "moon-outline" },
  { key: "romance", tr: "Romantik", en: "Romance", movieId: 10749, tvId: null, icon: "heart-circle-outline" },
  { key: "animation", tr: "Animasyon", en: "Animation", movieId: 16, tvId: 16, icon: "color-palette-outline" },
  { key: "family", tr: "Aile", en: "Family", movieId: 10751, tvId: 10751, icon: "people-outline" },
  { key: "documentary", tr: "Belgesel", en: "Documentary", movieId: 99, tvId: 99, icon: "videocam-outline" },
  { key: "reality", tr: "Reality", en: "Reality", movieId: null, tvId: 10764, icon: "star-outline" },
  { key: "kids", tr: "Çocuk", en: "Kids", movieId: null, tvId: 10762, icon: "balloon-outline" },
  { key: "soap", tr: "Pembe Dizi", en: "Soap", movieId: null, tvId: 10766, icon: "tv-outline" },
]);

const VALID_KEYS = new Set(ONBOARDING_GENRES.map((genre) => genre.key));

export const normalizeOnboardingGenreKeys = (keys) =>
  [...new Set((keys || []).map((key) => String(key || "").trim()))]
    .filter((key) => VALID_KEYS.has(key))
    .slice(0, 3);

export const normalizeOnboardingGenrePreferences = (value) => {
  if (Array.isArray(value)) {
    const legacy = normalizeOnboardingGenreKeys(value);
    return {
      movie: legacy.filter((key) => ONBOARDING_GENRES.find((genre) => genre.key === key)?.movieId),
      tv: legacy.filter((key) => ONBOARDING_GENRES.find((genre) => genre.key === key)?.tvId),
    };
  }
  return {
    movie: normalizeOnboardingGenreKeys(value?.movie)
      .filter((key) => ONBOARDING_GENRES.find((genre) => genre.key === key)?.movieId),
    tv: normalizeOnboardingGenreKeys(value?.tv)
      .filter((key) => ONBOARDING_GENRES.find((genre) => genre.key === key)?.tvId),
  };
};

export const resolveOnboardingGenreIds = (keys, mediaType) => {
  const idKey = mediaType === "tv" ? "tvId" : "movieId";
  const normalized = normalizeOnboardingGenrePreferences(keys);
  return [...new Set(normalized[mediaType === "tv" ? "tv" : "movie"]
    .map((key) => ONBOARDING_GENRES.find((genre) => genre.key === key)?.[idKey])
    .filter(Boolean))];
};
