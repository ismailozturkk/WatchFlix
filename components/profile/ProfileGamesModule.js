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
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={i18nText("autoI18n.tum_oyunlari_gor", "Tüm oyunları gör")} onPress={openGameHub} hitSlop={10}>
          <Text style={[styles.seeAll, { color: theme.accent }]}>{i18nText("autoI18n.tumunu_gor", "Tümünü Gör")}</Text>
        </TouchableOpacity>
      </View>

      {state.loading ? (
        <GamesModuleSkeleton theme={theme} />
      ) : (
        <>
          <FeaturedGameCard game={featuredGame} theme={theme} onPress={() => openGame(featuredGame)} />
          {secondaryGames.length > 0 ? (
            <View style={styles.secondaryList}>
              {secondaryGames.map((game) => <CompactGameCard key={game.id} game={game} theme={theme} onPress={() => openGame(game)} />)}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function FeaturedGameCard({ game, theme, onPress }) {
  const progress = game.playerProgress || buildSceneGameProgress(null);
  const daily = game.dailyState || buildSceneDailyState(null);
  const colors = resolveGameAccentColors(game, theme);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${i18nText(game.titleKey, "Sahne Tahmin")}. ${i18nText("autoI18n.oyna", "Oyna")}`}
      accessibilityHint={i18nText("autoI18n.oyun_detayini_acar", "Oyun detayını açar")}
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.featuredShadow, { shadowColor: theme.shadow || theme.accent }]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featured}>
        <View style={styles.artworkGlowOne} />
        <View style={styles.artworkGlowTwo} />
        <View pointerEvents="none" style={styles.artworkIcon}>
          <AppIcon family="Ionicons" name={game.artwork.icon} size={118} color="rgba(255,255,255,0.075)" />
        </View>
        <View style={styles.featuredTop}>
          <View style={styles.gameIdentity}>
            <View style={styles.featuredIcon}>
              <AppIcon family={game.icon.family} name={game.icon.name} size={27} color="#fff" />
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.featuredTitle}>{i18nText(game.titleKey, "Sahne Tahmin")}</Text>
              <Text style={styles.featuredDescription} numberOfLines={2}>{i18nText(game.descriptionKey, "Sahneden yapımı tahmin et!")}</Text>
            </View>
          </View>
          <View style={styles.levelBadge}><AppIcon family="Ionicons" name="sparkles" size={13} color="#fff" /><Text style={styles.levelText}>{i18nText("autoI18n.seviye_degeri", `Seviye ${progress.level}`, { level: progress.level })}</Text></View>
        </View>

        <View style={styles.progressRow}>
          <ProgressMetric icon="flame-outline" value={progress.weeklyStreak} label={i18nText("autoI18n.haftalik_seri", "Haftalık Seri")} />
          <View style={styles.metricDivider} />
          <ProgressMetric icon="trophy-outline" value={progress.bestClassicScore} label={i18nText("autoI18n.en_iyi_klasik", "En İyi Klasik")} />
          <View style={styles.playButton}><AppIcon family="Ionicons" name="play" size={19} color={colors[0]} /><Text style={[styles.playText, { color: colors[0] }]}>{i18nText("autoI18n.oyna", "Oyna")}</Text></View>
        </View>

        <View style={styles.dailyRow}>
          <View style={styles.dailyIcon}><AppIcon family="Ionicons" name="calendar-outline" size={17} color="#fff" /></View>
          <View style={styles.dailyCopy}>
            <Text style={styles.dailyTitle}>{i18nText("autoI18n.gunluk_meydan_okuma", "Günlük Meydan Okuma")}</Text>
            <Text style={styles.dailyStatus}>{daily.status === "coming_soon" ? i18nText("autoI18n.yakinda_kullanilabilir", "Yakında kullanılabilir") : i18nText("autoI18n.bugunku_gorev_hazir", "Bugünkü görev hazır")}</Text>
          </View>
          <View style={styles.dailyBadge}><Text style={styles.dailyBadgeText}>{daily.status === "coming_soon" ? i18nText("autoI18n.yakinda", "Yakında") : `+${daily.rewardXp} XP`}</Text></View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function ProgressMetric({ icon, value, label }) {
  return <View style={styles.metric}><View style={styles.metricValueRow}><AppIcon family="Ionicons" name={icon} size={15} color="#fff" /><Text style={styles.metricValue}>{value}</Text></View><Text style={styles.metricLabel}>{label}</Text></View>;
}

function CompactGameCard({ game, theme, onPress }) {
  const locked = game.availability !== "available";
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: locked }} accessibilityLabel={`${i18nText(game.titleKey, "Poster Bulmaca")}. ${locked ? i18nText("autoI18n.yakinda", "Yakında") : ""}`} activeOpacity={locked ? 1 : 0.8} disabled={locked} onPress={onPress} style={[styles.compactCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={[styles.compactIcon, { backgroundColor: theme.primary }]}><AppIcon family={game.icon.family} name={game.icon.name} size={22} color={theme.text.muted} /></View>
      <View style={styles.compactCopy}><Text style={[styles.compactTitle, { color: theme.text.primary }]}>{i18nText(game.titleKey, "Poster Bulmaca")}</Text><Text style={[styles.compactDescription, { color: theme.text.muted }]} numberOfLines={1}>{i18nText(game.descriptionKey, "Posteri parçalarından tahmin et")}</Text></View>
      <View style={[styles.comingSoonBadge, { borderColor: theme.border }]}><AppIcon family="Ionicons" name="lock-closed-outline" size={11} color={theme.text.muted} /><Text style={[styles.comingSoonText, { color: theme.text.muted }]}>{i18nText("autoI18n.yakinda", "Yakında")}</Text></View>
    </TouchableOpacity>
  );
}

function GamesModuleSkeleton({ theme }) {
  return <View accessibilityLabel={i18nText("autoI18n.oyunlar_yukleniyor", "Oyunlar yükleniyor")}><Skeleton height={260} style={[styles.skeletonFeatured, { backgroundColor: theme.secondary }]} /><Skeleton height={76} style={[styles.skeletonCompact, { backgroundColor: theme.secondary }]} /></View>;
}

const styles = StyleSheet.create({
  module: { width: "90%", marginTop: 10, marginBottom: 15 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingHorizontal: 10 },
  sectionTitle: { fontSize: 14, textTransform: "uppercase" },
  seeAll: { fontSize: 12, fontWeight: "850" },
  featuredShadow: { borderRadius: 24, elevation: 8, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.25, shadowRadius: 12 },
  featured: { minHeight: 260, borderRadius: 24, padding: 17, overflow: "hidden" },
  artworkGlowOne: { position: "absolute", width: 180, height: 180, borderRadius: 90, right: -55, top: -75, backgroundColor: "rgba(255,255,255,0.11)" },
  artworkGlowTwo: { position: "absolute", width: 110, height: 110, borderRadius: 55, right: 28, bottom: -55, backgroundColor: "rgba(255,255,255,0.08)" },
  artworkIcon: { position: "absolute", right: -4, top: 44, transform: [{ rotate: "-9deg" }] },
  featuredTop: { flex: 1 },
  gameIdentity: { flexDirection: "row", alignItems: "center", gap: 12 },
  featuredIcon: { width: 53, height: 53, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.17)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  identityCopy: { flex: 1 },
  featuredTitle: { color: "#fff", fontSize: 19, fontWeight: "900" },
  featuredDescription: { color: "rgba(255,255,255,0.82)", fontSize: 11, lineHeight: 15, fontWeight: "650", marginTop: 3 },
  levelBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 13, backgroundColor: "rgba(0,0,0,0.16)", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  levelText: { color: "#fff", fontSize: 10, fontWeight: "850" },
  progressRow: { minHeight: 68, marginTop: 14, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.14)", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 9 },
  metric: { flex: 1 },
  metricValueRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metricValue: { color: "#fff", fontSize: 17, fontWeight: "900" },
  metricLabel: { color: "rgba(255,255,255,0.68)", fontSize: 8, fontWeight: "750", marginTop: 2 },
  metricDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.18)" },
  playButton: { height: 39, borderRadius: 13, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fff" },
  playText: { fontSize: 12, fontWeight: "900" },
  dailyRow: { minHeight: 54, flexDirection: "row", alignItems: "center", marginTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.16)", paddingTop: 10 },
  dailyIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.13)", alignItems: "center", justifyContent: "center" },
  dailyCopy: { flex: 1, marginLeft: 9 },
  dailyTitle: { color: "#fff", fontSize: 11, fontWeight: "850" },
  dailyStatus: { color: "rgba(255,255,255,0.66)", fontSize: 9, fontWeight: "650", marginTop: 2 },
  dailyBadge: { backgroundColor: "rgba(255,255,255,0.13)", borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5 },
  dailyBadgeText: { color: "#fff", fontSize: 9, fontWeight: "850" },
  secondaryList: { marginTop: 10, gap: 8 },
  compactCard: { minHeight: 76, borderRadius: 18, borderWidth: 1, padding: 11, flexDirection: "row", alignItems: "center", gap: 11 },
  compactIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  compactCopy: { flex: 1 },
  compactTitle: { fontSize: 13, fontWeight: "850" },
  compactDescription: { fontSize: 9, fontWeight: "650", marginTop: 3 },
  comingSoonBadge: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4 },
  comingSoonText: { fontSize: 8, fontWeight: "800" },
  skeletonFeatured: { borderRadius: 24 },
  skeletonCompact: { borderRadius: 18, marginTop: 10 },
});
