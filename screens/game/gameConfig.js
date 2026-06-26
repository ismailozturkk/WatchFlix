export const SCENE_GAME_ID = "scene_guess";
export const DEFAULT_MODE_ID = "classic";
export const DEFAULT_DIFFICULTY_ID = "normal";

/* ── Mode ids ───────────────────────────────────────────────────────────── */
export const MODE_CLASSIC = "classic";
export const MODE_TIME_ATTACK = "time_attack";
export const MODE_SURVIVAL = "survival";

/* ── Mode definitions ───────────────────────────────────────────────────────
   timerType:
     "per_question" -> her soru icin zorluga bagli sure (Klasik, Hayatta Kalma)
     "session"      -> oturum boyunca tek geri sayim (Zamana Karsi)
   ────────────────────────────────────────────────────────────────────────── */
export const SCENE_GAME_MODES = [
  {
    id: MODE_CLASSIC,
    icon: "albums-outline",
    titleKey: "autoI18n.klasik_mod",
    ruleKey: "autoI18n.klasik_mod_kural",
    metaKey: "autoI18n.klasik_mod_meta",
    tr: "Klasik Mod",
    en: "Classic Mode",
    timerType: "per_question",
    questionCount: 10,
    estimatedMinutes: 3,
    initialJokers: 3,
    endsOnWrong: false,
    leaderboardEligible: true,
    available: true,
  },
  {
    id: MODE_TIME_ATTACK,
    icon: "timer-outline",
    titleKey: "autoI18n.zamana_karsi",
    ruleKey: "autoI18n.zamana_karsi_kural",
    metaKey: "autoI18n.zamana_karsi_meta",
    tr: "Zamana Karşı",
    en: "Time Attack",
    timerType: "session",
    totalSeconds: 60,
    wrongPenaltySeconds: 5,
    estimatedMinutes: 1,
    initialJokers: 1,
    endsOnWrong: false,
    leaderboardEligible: false,
    available: true,
  },
  {
    id: MODE_SURVIVAL,
    icon: "heart-half-outline",
    titleKey: "autoI18n.hayatta_kalma",
    ruleKey: "autoI18n.hayatta_kalma_kural",
    metaKey: "autoI18n.hayatta_kalma_meta",
    tr: "Hayatta Kalma",
    en: "Survival",
    timerType: "per_question",
    lives: 3,
    maxLives: 5,
    streakRewardInterval: 5,
    estimatedMinutes: 5,
    initialJokers: 2,
    endsOnWrong: false,
    leaderboardEligible: false,
    available: true,
  },
];

/* ── Difficulty definitions ─────────────────────────────────────────────── */
export const SCENE_GAME_DIFFICULTIES = [
  {
    id: "easy",
    icon: "leaf-outline",
    titleKey: "autoI18n.kolay",
    descriptionKey: "autoI18n.kolay_aciklama",
    tr: "Kolay",
    en: "Easy",
    timeSeconds: 15,
    optionCount: 3,
    scoreMultiplier: 1.0,
    color: "#2ECC71",
  },
  {
    id: "normal",
    icon: "speedometer-outline",
    titleKey: "autoI18n.normal",
    descriptionKey: "autoI18n.normal_aciklama",
    tr: "Normal",
    en: "Normal",
    timeSeconds: 12,
    optionCount: 4,
    scoreMultiplier: 1.25,
    color: "#56CCF2",
  },
  {
    id: "hard",
    icon: "flame-outline",
    titleKey: "autoI18n.zor",
    descriptionKey: "autoI18n.zor_aciklama",
    tr: "Zor",
    en: "Hard",
    timeSeconds: 8,
    optionCount: 4,
    scoreMultiplier: 1.5,
    color: "#FF6B6B",
  },
];

/* ── Source definitions ─────────────────────────────────────────────────── */
export const SCENE_GAME_SOURCES = [
  { id: "popular", icon: "flame-outline", labelKey: "autoI18n.populer", tr: "Popüler", en: "Popular", group: "discover" },
  { id: "top_rated_movie", icon: "star-outline", labelKey: "autoI18n.en_iyi_filmler", tr: "En İyi Filmler", en: "Top Rated Movies", group: "discover" },
  { id: "top_rated_tv", icon: "tv-outline", labelKey: "autoI18n.en_iyi_diziler", tr: "En İyi Diziler", en: "Top Rated Series", group: "discover" },
  { id: "popular_movie", icon: "film-outline", labelKey: "autoI18n.populer_filmler", tr: "Popüler Filmler", en: "Popular Movies", group: "discover" },
  { id: "popular_tv", icon: "radio-outline", labelKey: "autoI18n.populer_diziler", tr: "Popüler Diziler", en: "Popular Series", group: "discover" },
  { id: "watchlist", icon: "bookmark-outline", labelKey: "autoI18n.izleme_listem", tr: "İzleme Listem", en: "My Watchlist", personal: true, listKey: "watchList", group: "personal" },
  { id: "favorites", icon: "heart-outline", labelKey: "autoI18n.favoriler", tr: "Favoriler", en: "Favorites", personal: true, listKey: "favorites", group: "personal" },
  { id: "watchedMovies", icon: "checkmark-circle-outline", labelKey: "autoI18n.izlenen_filmler", tr: "İzlenen Filmler", en: "Watched Movies", personal: true, listKey: "watchedMovies", group: "personal" },
  { id: "watchedTv", icon: "checkmark-done-outline", labelKey: "autoI18n.izlenen_diziler", tr: "İzlenen Diziler", en: "Watched Series", personal: true, listKey: "watchedTv", group: "personal" },
];

/* ── Lookups ────────────────────────────────────────────────────────────── */
export const getModeConfig = (modeId) =>
  SCENE_GAME_MODES.find((mode) => mode.id === modeId) || SCENE_GAME_MODES[0];

export const getDifficultyConfig = (difficultyId) =>
  SCENE_GAME_DIFFICULTIES.find((difficulty) => difficulty.id === difficultyId) ||
  SCENE_GAME_DIFFICULTIES[1];

export const getSourceConfig = (sourceId) =>
  SCENE_GAME_SOURCES.find((source) => source.id === sourceId) || SCENE_GAME_SOURCES[0];

export const isPersonalSource = (sourceId) => Boolean(getSourceConfig(sourceId)?.personal);

export const availableModeCount = SCENE_GAME_MODES.filter((mode) => mode.available).length;

export const getLocalizedGameLabel = (item, language) =>
  language === "en" ? item.en : item.tr;
