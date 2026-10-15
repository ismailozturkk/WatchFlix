import { resolveRarity } from "@theme/badgeTokens";
import { computeLevel } from "@utils/gameScoring";
import { effectiveStreak } from "@utils/dailyChallenge";
import { POSTER_GAME_ID, SCENE_GAME_ID } from "./gameConfig";

// Her oyun ayni motoru (useSceneGame) kullanir; fark soru turu ve gorunumdur:
//   scene_guess   → TMDB sahne kareleri
//   poster_puzzle → bulanik/ortulu afis, sure ilerledikce acilir
// `accentColors`: tema anahtari ("accent"/"bold") ya da sabit hex.
export const GAME_REGISTRY = [
  {
    id: SCENE_GAME_ID,
    titleKey: "autoI18n.sahne_tahmin_oyunu_title",
    descriptionKey: "autoI18n.sahne_tahmin_aciklama",
    icon: { family: "Ionicons", name: "film-outline" },
    artwork: { type: "gradient", icon: "scan-outline" },
    accentColors: ["accent", "bold"],
    routeName: "SceneGameDetailScreen",
    availability: "available",
  },
  {
    id: POSTER_GAME_ID,
    titleKey: "autoI18n.poster_bulmaca",
    descriptionKey: "autoI18n.poster_bulmaca_aciklama",
    icon: { family: "Ionicons", name: "grid-outline" },
    artwork: { type: "gradient", icon: "image-outline" },
    accentColors: ["#F59E0B", "#E4572E"],
    routeName: "SceneGameDetailScreen",
    availability: "available",
  },
];

export const getGameEntry = (gameId) =>
  GAME_REGISTRY.find((game) => game.id === gameId) || GAME_REGISTRY[0];

const resolveColor = (token, theme) => {
  if (typeof token === "string" && token.startsWith("#")) return token;
  if (token === "accent") return theme.accent;
  if (token === "bold") return theme.bold || theme.accent;
  if (token === "muted") return theme.text.muted;
  if (token === "secondary") return theme.secondary;
  return theme.accent;
};

export const resolveGameAccentColors = (game, theme) =>
  game.accentColors.map((token) => resolveColor(token, theme));

// Unvan esikleri (seviye >= esik). Basliklar i18n anahtaridir.
const PLAYER_TITLES = [
  { minLevel: 7, key: "autoI18n.sinema_gurusu", fallback: "Sinema Gurusu" },
  { minLevel: 4, key: "autoI18n.oyun_unvan_sinefil", fallback: "Sinefil" },
  { minLevel: 2, key: "autoI18n.film_sever", fallback: "Film Sever" },
  { minLevel: 1, key: "autoI18n.oyun_unvan_yeni", fallback: "Yeni Oyuncu" },
];

export const getPlayerTitle = (level) =>
  PLAYER_TITLES.find((title) => level >= title.minLevel) || PLAYER_TITLES[PLAYER_TITLES.length - 1];

/**
 * Oyuncu ilerlemesi. XP/seviye `totalXp`'ten TURETILIR (computeLevel); eskiden
 * Oyun Merkezi'nde skor ve oyun sayisindan uydurulmus bir formulle cizgi
 * basiliyordu ve gercek XP ile hic ortusmuyordu.
 */
export const buildSceneGameProgress = (stats, now = Date.now()) => {
  const level = computeLevel(stats?.totalXp);
  const correct = Number(stats?.totalCorrect) || 0;
  const wrong = Number(stats?.totalWrong) || 0;
  const answered = correct + wrong;
  return {
    level: level.level,
    totalXp: level.totalXp,
    levelProgress: level.progress,
    xpIntoLevel: level.currentLevelXp,
    xpForNext: level.nextLevelXp,
    dayStreak: effectiveStreak(stats?.dayStreak, stats?.lastPlayDay, now),
    bestClassicScore: Number(stats?.bestScore) || 0,
    totalPlayed: Number(stats?.totalPlayed) || 0,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
  };
};

/**
 * Bir oyunun en iyi skoru. Sahne: genel tablodaki skor (Klasik + Normal);
 * Afis: afis modlarinin en yuksegi. Gunluk skorlar ikisine de karismaz.
 */
export const bestScoreForGame = (stats, gameId) => {
  const byMode = stats?.bestScoresByMode;
  const entries = byMode && typeof byMode === "object" ? Object.entries(byMode) : [];
  if (gameId === POSTER_GAME_ID) {
    return entries.reduce(
      (max, [key, value]) => (key.startsWith("poster_") ? Math.max(max, Number(value) || 0) : max),
      0,
    );
  }
  const ranked = Number(stats?.bestScore) || 0;
  const other = entries.reduce(
    (max, [key, value]) =>
      key.startsWith("poster_") || key.startsWith("daily_") ? max : Math.max(max, Number(value) || 0),
    0,
  );
  return Math.max(ranked, other);
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
// `iconSolid` NEDEN ELLE YAZILIYOR: eskiden acik hal `icon.replace("-outline","")`
// ile turetiliyordu. Ionicons'ta her outline ikonun dolu ikizi YOK ve AppIcon
// taninmayan isimde kirmizi bir uyari ucgeni basiyor (components/AppIcon.js) —
// yani hatali secim sessizce kullaniciya kirmizi ucgen olarak gidiyordu.
// Katalogda acikca tutmak bunu imkansiz kilar.
// `rarity` yazilmazsa target'tan turetilir (theme/badgeTokens.js resolveRarity).
const defineAchievement = (def) => ({
  ...def,
  iconSolid: def.iconSolid || def.icon,
  rarity: def.rarity || resolveRarity(def.target),
  isUnlocked: (stats) => def.getProgress(stats) >= def.target,
});

// SIRALAMA = SAYAÇ AİLESİ. Aynı sayacı ölçen başarımlar bitişik ve eşiğe göre
// artan durur; böylece hem listede bir merdiven olarak okunur hem de yeni bir
// kademe eklerken hangi ailenin neresine gireceği belli olur.
//
// Eskiden burada `gorev_*` çeviri anahtarlı 3 girdi vardı: başlıkları emir
// cümlesiydi ("Beş oyun oyna") ve `_aciklama` anahtarları hiç yoktu, yani
// kartın alt satırı boş çiziliyordu. Diğer 9 başarımın "isim + açıklama"
// kalıbına çevrildiler. "5 doğru" kademesi tamamen kaldırıldı: İlk Oyun ile
// pratikte aynı anda açılıyordu (bir oyun bitiren zaten 5 doğru yapıyor).
export const SCENE_ACHIEVEMENTS = [
  // ── Oynanan oyun sayısı (totalPlayed): 1 → 5 → 25 ──────────────────────
  defineAchievement({
    id: "first_game",
    titleKey: "autoI18n.basari_ilk_oyun",
    descriptionKey: "autoI18n.basari_ilk_oyun_aciklama",
    icon: "flag-outline",
    iconSolid: "flag",
    target: 1,
    getProgress: (stats) => Number(stats?.totalPlayed) || 0,
  }),
  defineAchievement({
    id: "game_explorer",
    titleKey: "autoI18n.basari_oyun_kasifi",
    descriptionKey: "autoI18n.basari_oyun_kasifi_aciklama",
    icon: "game-controller-outline",
    iconSolid: "game-controller",
    target: 5,
    getProgress: (stats) => Number(stats?.totalPlayed) || 0,
  }),
  defineAchievement({
    id: "marathon",
    titleKey: "autoI18n.basari_maraton",
    descriptionKey: "autoI18n.basari_maraton_aciklama",
    icon: "walk-outline",
    iconSolid: "walk",
    target: 25,
    getProgress: (stats) => Number(stats?.totalPlayed) || 0,
  }),

  // ── Toplam doğru cevap (totalCorrect): 50 → 100 → 500 ──────────────────
  defineAchievement({
    id: "fifty_correct",
    titleKey: "autoI18n.basari_yarim_yuzyil",
    descriptionKey: "autoI18n.basari_yarim_yuzyil_aciklama",
    icon: "checkmark-done-circle-outline",
    iconSolid: "checkmark-done-circle",
    target: 50,
    getProgress: (stats) => Number(stats?.totalCorrect) || 0,
  }),
  defineAchievement({
    id: "movie_buff",
    titleKey: "autoI18n.basari_film_kurdu",
    descriptionKey: "autoI18n.basari_film_kurdu_aciklama",
    icon: "film-outline",
    iconSolid: "film",
    target: 100,
    getProgress: (stats) => Number(stats?.totalCorrect) || 0,
  }),
  defineAchievement({
    id: "sniper",
    titleKey: "autoI18n.basari_keskin_nisanci",
    descriptionKey: "autoI18n.basari_keskin_nisanci_aciklama",
    icon: "locate-outline",
    iconSolid: "locate",
    target: 500,
    getProgress: (stats) => Number(stats?.totalCorrect) || 0,
  }),

  // ── En iyi seri (bestStreak): 10 → 20 ──────────────────────────────────
  defineAchievement({
    id: "sharp_eye",
    titleKey: "autoI18n.basari_keskin_goz",
    descriptionKey: "autoI18n.basari_keskin_goz_aciklama",
    icon: "eye-outline",
    iconSolid: "eye",
    target: 10,
    getProgress: (stats) => Number(stats?.bestStreak) || 0,
  }),
  defineAchievement({
    id: "streak_master",
    titleKey: "autoI18n.basari_seri_ustasi",
    descriptionKey: "autoI18n.basari_seri_ustasi_aciklama",
    icon: "flame-outline",
    iconSolid: "flame",
    target: 20,
    getProgress: (stats) => Number(stats?.bestStreak) || 0,
  }),

  // ── Tek oyun skoru (bestScore) ─────────────────────────────────────────
  defineAchievement({
    id: "score_hunter",
    titleKey: "autoI18n.basari_skor_avcisi",
    descriptionKey: "autoI18n.basari_skor_avcisi_aciklama",
    icon: "trophy-outline",
    iconSolid: "trophy",
    target: 1000,
    getProgress: (stats) => Number(stats?.bestScore) || 0,
  }),

  // ── Tekil kilometre taşları (mod / seviye) ─────────────────────────────
  defineAchievement({
    id: "survivor",
    titleKey: "autoI18n.basari_hayatta_kalan",
    descriptionKey: "autoI18n.basari_hayatta_kalan_aciklama",
    icon: "heart-outline",
    iconSolid: "heart",
    target: 1,
    getProgress: (stats) => (survivalBestOf(stats) > 0 ? 1 : 0),
  }),
  defineAchievement({
    id: "daily_first",
    titleKey: "autoI18n.basari_gunluk_ilk",
    descriptionKey: "autoI18n.basari_gunluk_ilk_aciklama",
    icon: "sunny-outline",
    iconSolid: "sunny",
    target: 1,
    getProgress: (stats) => Number(stats?.totalDailyPlayed) || 0,
  }),
  defineAchievement({
    id: "daily_week",
    titleKey: "autoI18n.basari_gunluk_hafta",
    descriptionKey: "autoI18n.basari_gunluk_hafta_aciklama",
    icon: "calendar-outline",
    iconSolid: "calendar",
    target: 7,
    getProgress: (stats) => Number(stats?.bestDailyStreak) || 0,
  }),
  defineAchievement({
    id: "veteran",
    titleKey: "autoI18n.basari_veteran",
    descriptionKey: "autoI18n.basari_veteran_aciklama",
    icon: "ribbon-outline",
    iconSolid: "ribbon",
    target: 5,
    getProgress: (stats) => Number(stats?.level) || 1,
  }),
];
