import { copyLanguage } from "../../utils/appLanguages";

export const SCENE_GAME_ID = "scene_guess";
export const POSTER_GAME_ID = "poster_puzzle";
export const DEFAULT_MODE_ID = "classic";
export const DEFAULT_DIFFICULTY_ID = "normal";

/* ── Mode ids ───────────────────────────────────────────────────────────── */
export const MODE_CLASSIC = "classic";
export const MODE_TIME_ATTACK = "time_attack";
export const MODE_SURVIVAL = "survival";
export const MODE_DAILY = "daily";

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
    en: "Classic Mode", es: "Modo clásico", pt: "Modo clássico", de: "Klassikmodus",
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
    en: "Time Attack", es: "Contrarreloj", pt: "Contra o relógio", de: "Gegen die Zeit",
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
    en: "Survival", es: "Supervivencia", pt: "Sobrevivência", de: "Überleben",
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
  {
    // Gunluk Meydan Okuma: herkese ayni 10 sahne, gunde tek deneme. Kurulum
    // ekraninda SECILMEZ (selectable:false); yalniz Hub/Oyun Merkezi'ndeki
    // gunluk kartindan acilir. Kurallar Klasik ile ayni, zorluk Normal'e sabit.
    id: MODE_DAILY,
    icon: "sunny-outline",
    titleKey: "autoI18n.gunluk_meydan_okuma",
    ruleKey: "autoI18n.gunluk_mod_kural",
    metaKey: "autoI18n.gunluk_mod_meta",
    tr: "Günlük Meydan Okuma",
    en: "Daily Challenge", es: "Reto diario", pt: "Desafio diário", de: "Tägliche Challenge",
    timerType: "per_question",
    questionCount: 10,
    estimatedMinutes: 3,
    initialJokers: 2,
    endsOnWrong: false,
    leaderboardEligible: false,
    available: true,
    selectable: false,
    daily: true,
  },
];

/* Kurulum ekraninda secilebilen modlar (gunluk mod haric). */
export const SELECTABLE_GAME_MODES = SCENE_GAME_MODES.filter(
  (mode) => mode.available && mode.selectable !== false,
);

/* ── Difficulty definitions ─────────────────────────────────────────────── */
export const SCENE_GAME_DIFFICULTIES = [
  {
    id: "easy",
    icon: "leaf-outline",
    titleKey: "autoI18n.kolay",
    descriptionKey: "autoI18n.kolay_aciklama",
    tr: "Kolay",
    en: "Easy", es: "Fácil", pt: "Fácil", de: "Leicht",
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
    en: "Normal", es: "Normal", pt: "Normal", de: "Normal",
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
    en: "Hard", es: "Difícil", pt: "Difícil", de: "Schwer",
    timeSeconds: 8,
    optionCount: 4,
    scoreMultiplier: 1.5,
    color: "#FF6B6B",
  },
];

/* ── Source definitions ─────────────────────────────────────────────────── */
export const SCENE_GAME_SOURCES = [
  { id: "popular", icon: "flame-outline", labelKey: "autoI18n.populer", tr: "Popüler", en: "Popular", es: "Populares", pt: "Populares", de: "Beliebt", group: "discover" },
  { id: "top_rated_movie", icon: "star-outline", labelKey: "autoI18n.en_iyi_filmler", tr: "En İyi Filmler", en: "Top Rated Movies", es: "Películas mejor valoradas", pt: "Filmes mais bem avaliados", de: "Bestbewertete Filme", group: "discover" },
  { id: "top_rated_tv", icon: "tv-outline", labelKey: "autoI18n.en_iyi_diziler", tr: "En İyi Diziler", en: "Top Rated Series", es: "Series mejor valoradas", pt: "Séries mais bem avaliadas", de: "Bestbewertete Serien", group: "discover" },
  { id: "popular_movie", icon: "film-outline", labelKey: "autoI18n.populer_filmler", tr: "Popüler Filmler", en: "Popular Movies", es: "Películas populares", pt: "Filmes populares", de: "Beliebte Filme", group: "discover" },
  { id: "popular_tv", icon: "radio-outline", labelKey: "autoI18n.populer_diziler", tr: "Popüler Diziler", en: "Popular Series", es: "Series populares", pt: "Séries populares", de: "Beliebte Serien", group: "discover" },
  { id: "watchlist", icon: "bookmark-outline", labelKey: "autoI18n.izleme_listem", tr: "İzleme Listem", en: "My Watchlist", es: "Mi lista de seguimiento", pt: "Minha lista para assistir", de: "Meine Merkliste", personal: true, listKey: "watchList", group: "personal" },
  { id: "favorites", icon: "heart-outline", labelKey: "autoI18n.favoriler", tr: "Favoriler", en: "Favorites", es: "Favoritos", pt: "Favoritos", de: "Favoriten", personal: true, listKey: "favorites", group: "personal" },
  { id: "watchedMovies", icon: "checkmark-circle-outline", labelKey: "autoI18n.izlenen_filmler", tr: "İzlenen Filmler", en: "Watched Movies", es: "Películas vistas", pt: "Filmes assistidos", de: "Gesehene Filme", personal: true, listKey: "watchedMovies", group: "personal" },
  { id: "watchedTv", icon: "checkmark-done-outline", labelKey: "autoI18n.izlenen_diziler", tr: "İzlenen Diziler", en: "Watched Series", es: "Series vistas", pt: "Séries assistidas", de: "Gesehene Serien", personal: true, listKey: "watchedTv", group: "personal" },
  // Gunluk meydan okumanin sabit havuzu. Kurulum listesinde gorunmez
  // (group:"daily"); sonuc/istatistik ekranlari etiketi buradan okur.
  { id: "daily", icon: "sunny-outline", labelKey: "autoI18n.gunluk_meydan_okuma", tr: "Günlük Meydan Okuma", en: "Daily Challenge", es: "Reto diario", pt: "Desafio diário", de: "Tägliche Challenge", group: "daily" },
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

export const isPosterGame = (gameId) => gameId === POSTER_GAME_ID;
export const isDailyMode = (modeId) => modeId === MODE_DAILY;

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı); `es` alanı olmayan öğe İngilizceye düşer.
export const getLocalizedGameLabel = (item, language) =>
  item[copyLanguage(language, ["tr", "en", "es", "pt", "de"])] ?? item.en;

/**
 * `bestScoresByMode` anahtarını ("classic_normal", "poster_classic_normal",
 * "daily_normal") parçalar. Afiş oyunu anahtarı `poster_` önekiyle yazar;
 * öneki atmadan bölmek "poster_classic"i bilinmeyen mod sayıp Klasik'e düşürürdü.
 */
export function parseModeScoreKey(key) {
  const text = String(key || "");
  const poster = text.startsWith("poster_");
  const rest = poster ? text.slice("poster_".length) : text;
  const cut = rest.lastIndexOf("_");
  return {
    gameId: poster ? POSTER_GAME_ID : SCENE_GAME_ID,
    modeId: cut < 0 ? rest : rest.slice(0, cut),
    difficultyId: cut < 0 ? "" : rest.slice(cut + 1),
  };
}
