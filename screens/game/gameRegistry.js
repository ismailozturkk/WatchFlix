export const GAME_REGISTRY = [
  {
    id: "scene_guess",
    titleKey: "autoI18n.sahne_tahmin_oyunu_title",
    descriptionKey: "autoI18n.sahne_tahmin_aciklama",
    icon: { family: "Ionicons", name: "film-outline" },
    artwork: { type: "gradient", icon: "scan-outline" },
    accentColors: ["accent", "bold"],
    routeName: "SceneGameDetailScreen",
    availability: "available",
    playerProgress: null,
    dailyState: null,
  },
  {
    id: "poster_puzzle",
    titleKey: "autoI18n.poster_bulmaca",
    descriptionKey: "autoI18n.poster_bulmaca_aciklama",
    icon: { family: "Ionicons", name: "grid-outline" },
    artwork: { type: "gradient", icon: "image-outline" },
    accentColors: ["muted", "secondary"],
    routeName: null,
    availability: "coming_soon",
    playerProgress: null,
    dailyState: null,
  },
];

const resolveColor = (token, theme) => {
  if (token === "accent") return theme.accent;
  if (token === "bold") return theme.bold || theme.accent;
  if (token === "muted") return theme.text.muted;
  if (token === "secondary") return theme.secondary;
  return theme.accent;
};

export const resolveGameAccentColors = (game, theme) =>
  game.accentColors.map((token) => resolveColor(token, theme));

export const buildSceneGameProgress = (stats) => ({
  level: Number(stats?.level) || 1,
  weeklyStreak: Number(stats?.weeklyStreak) || 0,
  bestClassicScore: Number(stats?.bestScore) || 0,
  totalPlayed: Number(stats?.totalPlayed) || 0,
});

export const buildSceneDailyState = (stats) => {
  if (stats?.dailyState) return stats.dailyState;
  return { status: "coming_soon", rewardXp: 0, expiresAt: null };
};

// En iyi Hayatta Kalma skoru (mod+zorluk farketmeksizin) — survivor basarimi icin.
const survivalBestOf = (stats) => {
  const byMode = stats?.bestScoresByMode;
  if (!byMode || typeof byMode !== "object") return 0;
  return Object.entries(byMode).reduce(
    (max, [key, value]) => (key.startsWith("survival") ? Math.max(max, Number(value) || 0) : max),
    0,
  );
};

// Basarim kataloğu (Part 15.2). Her basarim ilerleme tabanlidir (getProgress/target);
// boylece kilitliyken bile kullaniciya ne kadar kaldigi gosterilebilir.
// Film/dizi ayrimi, kusursuz tur ve hizli cevap gibi ayri sayac gerektiren
// basarimlar oturum bazli alanlar Firestore'a tasininca (Faz E) eklenecek.
const defineAchievement = (def) => ({
  ...def,
  isUnlocked: (stats) => def.getProgress(stats) >= def.target,
});

export const SCENE_ACHIEVEMENTS = [
  defineAchievement({
    id: "first_game",
    titleKey: "autoI18n.basari_ilk_oyun",
    descriptionKey: "autoI18n.basari_ilk_oyun_aciklama",
    icon: "flag-outline",
    target: 1,
    getProgress: (stats) => Number(stats?.totalPlayed) || 0,
  }),
  defineAchievement({
    id: "sharp_eye",
    titleKey: "autoI18n.basari_keskin_goz",
    descriptionKey: "autoI18n.basari_keskin_goz_aciklama",
    icon: "eye-outline",
    target: 10,
    getProgress: (stats) => Number(stats?.bestStreak) || 0,
  }),
  defineAchievement({
    id: "streak_master",
    titleKey: "autoI18n.basari_seri_ustasi",
    descriptionKey: "autoI18n.basari_seri_ustasi_aciklama",
    icon: "flame-outline",
    target: 20,
    getProgress: (stats) => Number(stats?.bestStreak) || 0,
  }),
  defineAchievement({
    id: "movie_buff",
    titleKey: "autoI18n.basari_film_kurdu",
    descriptionKey: "autoI18n.basari_film_kurdu_aciklama",
    icon: "film-outline",
    target: 100,
    getProgress: (stats) => Number(stats?.totalCorrect) || 0,
  }),
  defineAchievement({
    id: "score_hunter",
    titleKey: "autoI18n.basari_skor_avcisi",
    descriptionKey: "autoI18n.basari_skor_avcisi_aciklama",
    icon: "trophy-outline",
    target: 1000,
    getProgress: (stats) => Number(stats?.bestScore) || 0,
  }),
  defineAchievement({
    id: "marathon",
    titleKey: "autoI18n.basari_maraton",
    descriptionKey: "autoI18n.basari_maraton_aciklama",
    icon: "walk-outline",
    target: 25,
    getProgress: (stats) => Number(stats?.totalPlayed) || 0,
  }),
  defineAchievement({
    id: "survivor",
    titleKey: "autoI18n.basari_hayatta_kalan",
    descriptionKey: "autoI18n.basari_hayatta_kalan_aciklama",
    icon: "heart-outline",
    target: 1,
    getProgress: (stats) => (survivalBestOf(stats) > 0 ? 1 : 0),
  }),
  defineAchievement({
    id: "veteran",
    titleKey: "autoI18n.basari_veteran",
    descriptionKey: "autoI18n.basari_veteran_aciklama",
    icon: "ribbon-outline",
    target: 5,
    getProgress: (stats) => Number(stats?.level) || 1,
  }),
  defineAchievement({
    id: "sniper",
    titleKey: "autoI18n.basari_keskin_nisanci",
    descriptionKey: "autoI18n.basari_keskin_nisanci_aciklama",
    icon: "locate-outline",
    target: 500,
    getProgress: (stats) => Number(stats?.totalCorrect) || 0,
  }),
];

// Baslangic gorevleri (Part 15.3). Gercek gunluk/haftalik sifirlama tarih takibi
// ve backend gerektirdiginden bu surumde kalici/birikimli hedefler kullanilir.
export const SCENE_STARTER_TASKS = [
  {
    id: "complete_game",
    titleKey: "autoI18n.gorev_bir_oyun_tamamla",
    target: 1,
    getProgress: (stats) => Number(stats?.totalPlayed) || 0,
  },
  {
    id: "five_correct",
    titleKey: "autoI18n.gorev_bes_dogru",
    target: 5,
    getProgress: (stats) => Number(stats?.totalCorrect) || 0,
  },
  {
    id: "play_five_games",
    titleKey: "autoI18n.gorev_bes_oyun",
    target: 5,
    getProgress: (stats) => Number(stats?.totalPlayed) || 0,
  },
  {
    id: "fifty_correct",
    titleKey: "autoI18n.gorev_elli_dogru",
    target: 50,
    getProgress: (stats) => Number(stats?.totalCorrect) || 0,
  },
  {
    id: "reach_streak_ten",
    titleKey: "autoI18n.gorev_on_seri",
    target: 10,
    getProgress: (stats) => Number(stats?.bestStreak) || 0,
  },
];
