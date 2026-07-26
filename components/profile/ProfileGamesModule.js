import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import Skeleton from "@components/Skeleton";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { loadGameData } from "@services/sceneGameService";
import { i18nText } from "@utils/i18nText";
import {
  buildSceneDailyState,
  buildSceneGameProgress,
  GAME_REGISTRY,
  resolveGameAccentColors,
} from "@screens/game/gameRegistry";

export default function ProfileGamesModule({ navigation }) {
  const { theme } = useTheme();
  useLanguage();
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, stats: null });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setState((current) => ({ ...current, loading: true }));

      if (!user?.uid) {
        setState({ loading: false, stats: null });
        return () => { active = false; };
      }

      loadGameData(user.uid)
        .then((stats) => {
          if (active) setState({ loading: false, stats });
        })
        .catch(() => {
          if (active) setState({ loading: false, stats: null });
        });

      return () => { active = false; };
    }, [user?.uid]),
  );

  const games = useMemo(() => GAME_REGISTRY.map((game) => {
    if (game.id !== "scene_guess") return game;
    return {
      ...game,
      playerProgress: buildSceneGameProgress(state.stats),
      dailyState: buildSceneDailyState(state.stats),
    };
  }), [state.stats]);

  const featuredGame = games.find((game) => game.availability === "available") || games[0];
  const secondaryGames = games.filter((game) => game.id !== featuredGame.id);

  const openGameHub = () => navigation.navigate("GameHubScreen");
  const openGame = (game) => {
    if (game.availability !== "available" || !game.routeName) return;
    navigation.navigate(game.routeName, { gameId: game.id });
  };

  return (
    <View style={styles.module}>
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
          {i18nText("autoI18n.oyunlar", "Oyunlar")}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.tum_oyunlari_gor", "Tüm oyunları gör")}
          onPress={openGameHub}
          hitSlop={10}
        >
          <Text style={[styles.seeAll, { color: theme.accent }]}>
            {i18nText("autoI18n.tumunu_gor", "Tümünü Gör")} →
          </Text>
        </TouchableOpacity>
      </View>

      {state.loading ? (
        <GamesModuleSkeleton theme={theme} />
      ) : (
        <FeaturedGameCard
          game={featuredGame}
          theme={theme}
          navigation={navigation}
          openGameHub={openGameHub}
        />
      )}
    </View>
  );
}

function FeaturedGameCard({ game, theme, navigation, openGameHub }) {
  const progress = game.playerProgress || buildSceneGameProgress(null);
  const daily = game.dailyState || buildSceneDailyState(null);
  const colors = resolveGameAccentColors(game, theme);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${i18nText(game.titleKey, "Sahne Tahmin")}`}
      accessibilityHint={i18nText("autoI18n.oyun_merkezini_acar", "Oyun merkezini açar")}
      activeOpacity={0.92}
      onPress={openGameHub}
      style={[styles.featuredShadow, { shadowColor: theme.shadow || theme.accent }]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.featured}
      >
        {/* Arka plan parlama ve filigran */}
        <View pointerEvents="none" style={styles.artworkGlowOne} />
        <View pointerEvents="none" style={styles.artworkGlowTwo} />
        <View pointerEvents="none" style={styles.artworkIcon}>
          <AppIcon family="Ionicons" name={game.artwork.icon} size={135} color="rgba(255,255,255,0.065)" />
        </View>

        {/* 1. ÜST BAR: Marka Rozeti ve Seviye Pill */}
        <View style={styles.topBarRow}>
          <View style={styles.gameBadgePill}>
            <AppIcon family="Ionicons" name="game-controller-outline" size={12} color="#FFD700" />
            <Text style={styles.gameBadgeText} allowFontScaling={false}>
              {i18nText("autoI18n.oyun_merkezi", "Oyun Merkezi").toUpperCase()}
            </Text>
          </View>

          <View style={styles.levelPill}>
            <AppIcon family="Ionicons" name="sparkles" size={12} color="#FFD700" />
            <Text style={styles.levelPillText} allowFontScaling={false}>
              {i18nText("autoI18n.seviye_degeri", `Seviye ${progress.level}`, { level: progress.level })}
            </Text>
          </View>
        </View>

        {/* 2. BAŞLIK VE AÇIKLAMA */}
        <View style={styles.mainInfoContainer}>
          <View style={styles.titleWithIconRow}>
            <View style={styles.gameMainIcon}>
              <AppIcon family="Ionicons" name="game-controller-outline" size={24} color="#fff" />
            </View>
            <View style={styles.titleTextWrap}>
              <Text style={styles.featuredTitle} allowFontScaling={false}>
                {i18nText("autoI18n.oyun_merkezi", "Sinema Oyunları")}
              </Text>
              <Text style={styles.featuredDescription} numberOfLines={2} allowFontScaling={false}>
                {i18nText("autoI18n.oyun_merkezi_hero_aciklama", "Sahne tahminleri ve bulmacalarla sinema bilgini konuştur, rekorunu geliştir!")}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. İSTATİSTİK ÇİPLERİ (Haftalık Seri & En İyi Skor) */}
        <View style={styles.statsGridRow}>
          <View style={styles.statChip}>
            <View style={[styles.statIconBadge, { backgroundColor: "rgba(255, 107, 107, 0.22)" }]}>
              <AppIcon family="Ionicons" name="flame" size={15} color="#FF6B6B" />
            </View>
            <View style={styles.statTextWrap}>
              <Text style={styles.statValueText} allowFontScaling={false}>
                {progress.weeklyStreak}
              </Text>
              <Text style={styles.statLabelText} allowFontScaling={false}>
                {i18nText("autoI18n.haftalik_seri", "Haftalık Seri")}
              </Text>
            </View>
          </View>

          <View style={styles.statChip}>
            <View style={[styles.statIconBadge, { backgroundColor: "rgba(255, 215, 0, 0.22)" }]}>
              <AppIcon family="Ionicons" name="trophy" size={15} color="#FFD700" />
            </View>
            <View style={styles.statTextWrap}>
              <Text style={styles.statValueText} allowFontScaling={false}>
                {progress.bestClassicScore}
              </Text>
              <Text style={styles.statLabelText} allowFontScaling={false}>
                {i18nText("autoI18n.en_iyi_klasik", "En İyi Skor")}
              </Text>
            </View>
          </View>
        </View>

        {/* 4. ÇİFT YÖNLENDİRME BUTONLARI (Sahne Tahmini & Poster Tahmini) */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate("SceneGameDetailScreen", { gameId: "scene_guess" })}
            style={[styles.actionBtn, styles.actionBtnPrimary]}
          >
            <AppIcon family="Ionicons" name="film" size={14} color={colors[0] || "#1A0B2E"} />
            <Text style={[styles.actionBtnText, { color: colors[0] || "#1A0B2E" }]} allowFontScaling={false}>
              {i18nText("autoI18n.sahne_tahmini", "Sahne Tahmini")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              const posterGame = GAME_REGISTRY.find((g) => g.id === "poster_puzzle");
              if (posterGame?.routeName && posterGame?.availability === "available") {
                navigation.navigate(posterGame.routeName, { gameId: posterGame.id });
              } else {
                openGameHub();
              }
            }}
            style={[styles.actionBtn, styles.actionBtnSecondary]}
          >
            <AppIcon family="Ionicons" name="grid" size={14} color="#FFFFFF" />
            <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]} allowFontScaling={false}>
              {i18nText("autoI18n.poster_tahmini", "Poster Tahmini")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 5. GÜNLÜK GÖREV ALT PANELİ */}
        <View style={styles.dailyTaskFooter}>
          <View style={styles.dailyTaskLeft}>
            <AppIcon family="Ionicons" name="calendar-outline" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.dailyTaskTitle} allowFontScaling={false}>
              {i18nText("autoI18n.gunluk_meydan_okuma", "Günlük Meydan Okuma")}
            </Text>
          </View>
          <View style={styles.dailyRewardPill}>
            <Text style={styles.dailyRewardText} allowFontScaling={false}>
              {daily.status === "coming_soon" ? i18nText("autoI18n.yakinda", "Yakında") : `+${daily.rewardXp} XP`}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function CompactGameCard({ game, theme, onPress }) {
  const locked = game.availability !== "available";
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
      accessibilityLabel={`${i18nText(game.titleKey, "Poster Bulmaca")}. ${locked ? i18nText("autoI18n.yakinda", "Yakında") : ""}`}
      activeOpacity={locked ? 1 : 0.8}
      disabled={locked}
      onPress={onPress}
      style={[styles.compactCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.compactIcon, { backgroundColor: theme.primary }]}>
        <AppIcon family={game.icon.family} name={game.icon.name} size={22} color={theme.text.muted} />
      </View>
      <View style={styles.compactCopy}>
        <Text style={[styles.compactTitle, { color: theme.text.primary }]}>
          {i18nText(game.titleKey, "Poster Bulmaca")}
        </Text>
        <Text style={[styles.compactDescription, { color: theme.text.muted }]} numberOfLines={1}>
          {i18nText(game.descriptionKey, "Posteri parçalarından tahmin et")}
        </Text>
      </View>
      <View style={[styles.comingSoonBadge, { borderColor: theme.border }]}>
        <AppIcon family="Ionicons" name="lock-closed-outline" size={11} color={theme.text.muted} />
        <Text style={[styles.comingSoonText, { color: theme.text.muted }]}>
          {i18nText("autoI18n.yakinda", "Yakında")}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function GamesModuleSkeleton({ theme }) {
  return (
    <View accessibilityLabel={i18nText("autoI18n.oyunlar_yukleniyor", "Oyunlar yükleniyor")}>
      <Skeleton height={270} style={[styles.skeletonFeatured, { backgroundColor: theme.secondary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  module: { width: "90%", marginTop: 10, marginBottom: 15 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  sectionTitle: { fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "800" },
  seeAll: { fontSize: 12, fontWeight: "800" },

  featuredShadow: {
    borderRadius: 24,
    elevation: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  featured: {
    minHeight: 270,
    borderRadius: 24,
    padding: 16,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  artworkGlowOne: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -60,
    top: -80,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  artworkGlowTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    right: 20,
    bottom: -60,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  artworkIcon: {
    position: "absolute",
    right: -10,
    top: 35,
    transform: [{ rotate: "-10deg" }],
  },

  // Üst Bar
  topBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  gameBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
  },
  gameBadgeText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  levelPillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  // Ana Başlık ve Açıklama
  mainInfoContainer: {
    marginBottom: 14,
  },
  titleWithIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  gameMainIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  titleTextWrap: {
    flex: 1,
  },
  featuredTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  featuredDescription: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 3,
  },

  // İstatistik Çipleri
  statsGridRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  statIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  statTextWrap: {
    flex: 1,
  },
  statValueText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  statLabelText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 9.5,
    fontWeight: "700",
    marginTop: 1,
  },

  // Çift Yönlendirme Butonları (Sahne Tahmini & Poster Tahmini)
  actionButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  actionBtnPrimary: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnSecondary: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  // Günlük Görev Alt Paneli
  dailyTaskFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  dailyTaskLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dailyTaskTitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "750",
  },
  dailyRewardPill: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dailyRewardText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "800",
  },

  secondaryList: { marginTop: 10, gap: 8 },
  compactCard: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  compactIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  compactCopy: { flex: 1 },
  compactTitle: { fontSize: 13, fontWeight: "850" },
  compactDescription: { fontSize: 9.5, fontWeight: "650", marginTop: 2 },
  comingSoonBadge: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  comingSoonText: { fontSize: 8.5, fontWeight: "800" },
  skeletonFeatured: { borderRadius: 24 },
  skeletonCompact: { borderRadius: 18, marginTop: 10 },
});
