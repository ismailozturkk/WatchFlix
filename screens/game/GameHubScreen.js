// screens/game/GameHubScreen.js
//
// Oyun Merkezi. Yukarıdan aşağıya: oyuncu kartı → Günlük Meydan Okuma → oyunlar
// (mod kısayollarıyla) → arkadaş sıralaması → başarımlar. Amaç, ilk açılışta
// iki dokunuşla oyuna girebilmek: günlük kart ve mod çipleri doğrudan
// oyunu/kurulumu açar.

import UserAvatar from "@components/common/UserAvatar";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import GlassIconButton from "@components/common/GlassIconButton";
import Skeleton from "@components/Skeleton";
import DailyChallengeCard from "@components/game/DailyChallengeCard";
import PlayerStrip from "@components/game/PlayerStrip";
import { MiniProgress, PressableScale, SectionHeader } from "@components/game/ui";
import { useAuth } from "@context/AuthContext";
import { useFriends } from "@context/FriendsContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useDailyView from "@hooks/useDailyView";
import useGameStats from "@hooks/useGameStats";
import usePremiumScreenGuard from "@hooks/usePremiumScreenGuard";
import { fetchLeaderboard } from "@services/sceneGameService";
import { i18nText } from "@utils/i18nText";
import { DAILY_MODE_ID, DAILY_SOURCE_ID } from "@utils/dailyChallenge";
import { alpha } from "../../theme/colors";
import { GameScreenShell } from "./GameScreenShell";
import {
  bestScoreForGame,
  buildSceneGameProgress,
  GAME_REGISTRY,
  resolveGameAccentColors,
  SCENE_ACHIEVEMENTS,
} from "./gameRegistry";
import { getLocalizedGameLabel, SCENE_GAME_ID, SELECTABLE_GAME_MODES } from "./gameConfig";
import GlassTouchable from "../../components/common/GlassTouchable";

const RANK_COLORS = ["#FFC83D", "#C4CAD4", "#D98C4A"];

export default function GameHubScreen({ navigation }) {
  // Oyunlar Premium'da: Hub kartı kilitliyken buraya gelinmez; başka yoldan
  // gelinirse yükseltme sayfası açılır ve ekran geri sarılır.
  usePremiumScreenGuard("games", navigation);
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { friends = [] } = useFriends() || {};
  const { ready, stats } = useGameStats();
  const daily = useDailyView(stats);
  const [board, setBoard] = useState({ loading: true, error: false, rows: [] });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchLeaderboard(50)
        .then((rows) => active && setBoard({ loading: false, error: false, rows }))
        .catch(() => active && setBoard({ loading: false, error: true, rows: [] }));
      return () => {
        active = false;
      };
    }, []),
  );

  const progress = useMemo(() => buildSceneGameProgress(stats, daily.now), [stats, daily.now]);

  const friendRows = useMemo(() => {
    const uids = new Set(friends.map((friend) => friend.friendUid || friend.id));
    if (user?.uid) uids.add(user.uid);
    return board.rows
      .filter((entry) => uids.has(entry.uid))
      .sort((a, b) => (Number(b.bestScore) || 0) - (Number(a.bestScore) || 0))
      .slice(0, 3);
  }, [friends, board.rows, user?.uid]);

  const achievements = useMemo(() => {
    const all = SCENE_ACHIEVEMENTS.map((achievement) => {
      const value = Math.min(achievement.getProgress(stats), achievement.target);
      return { ...achievement, value, ratio: achievement.target ? value / achievement.target : 0, unlocked: achievement.isUnlocked(stats) };
    });
    // Kilidi açılmak üzere olanlar önde; açılanlar sona.
    const pending = all.filter((item) => !item.unlocked).sort((a, b) => b.ratio - a.ratio);
    return { unlockedCount: all.length - pending.length, total: all.length, preview: pending.slice(0, 3) };
  }, [stats]);

  const playDaily = () =>
    navigation.navigate("SceneGamePlayScreen", {
      gameId: SCENE_GAME_ID,
      modeId: DAILY_MODE_ID,
      difficultyId: "normal",
      sourceId: DAILY_SOURCE_ID,
    });
  const openLeaderboard = (scope) =>
    navigation.navigate("GameLeaderboardScreen", { gameId: SCENE_GAME_ID, scope });
  const openAchievements = () => navigation.navigate("GameAchievementsScreen", { gameId: SCENE_GAME_ID });

  const headerRight = (
    <GlassIconButton
      icon="stats-chart-outline"
      iconSize={18}
      size={38}
      fallbackRadius={12}
      color={theme.text.primary}
      accessibilityLabel={i18nText("autoI18n.oyuncu_profili", "Oyuncu Profili")}
      onPress={() => navigation.navigate("GameStatsScreen")}
    />
  );

  return (
    <GameScreenShell
      navigation={navigation}
      title={i18nText("autoI18n.oyun_merkezi", "Oyun Merkezi")}
      subtitle={i18nText("autoI18n.oyun_merkezi_aciklama", "Sinema oyunları ve gelişimin")}
      headerRight={headerRight}
    >
      {!ready ? (
        <HubSkeleton theme={theme} />
      ) : (
        <>
          <PlayerStrip
            progress={progress}
            theme={theme}
            user={user}
            onPress={() => navigation.navigate("GameStatsScreen")}
          />

          <DailyChallengeCard daily={daily} theme={theme} onPlay={playDaily} onResult={() => openLeaderboard("daily")} />

          <SectionHeader title={i18nText("autoI18n.oyunlar", "Oyunlar")} theme={theme} />
          <View style={styles.gameList}>
            {GAME_REGISTRY.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                theme={theme}
                language={language}
                bestScore={bestScoreForGame(stats, game.id)}
                onOpen={() => navigation.navigate(game.routeName, { gameId: game.id })}
                onPlayMode={(modeId) =>
                  navigation.navigate("SceneGameSetupScreen", { gameId: game.id, modeId })
                }
              />
            ))}
          </View>

          <SectionHeader
            title={i18nText("autoI18n.arkadas_siralamasi", "Arkadaş Sıralaması")}
            action={i18nText("autoI18n.tumunu_gor", "Tümünü Gör")}
            onAction={() => openLeaderboard("friends")}
            theme={theme}
          />
          <FriendsRanking
            board={board}
            rows={friendRows}
            currentUid={user?.uid}
            theme={theme}
            onOpen={() => openLeaderboard("friends")}
          />

          <SectionHeader
            title={i18nText("autoI18n.basarimlar", "Başarımlar")}
            action={`${achievements.unlockedCount}/${achievements.total}`}
            onAction={openAchievements}
            theme={theme}
          />
          <AchievementsPreview achievements={achievements} theme={theme} onOpen={openAchievements} />
        </>
      )}
    </GameScreenShell>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Oyun kartı: renkli üst bant (oyuna git) + mod kısayolları (kurulum)
   ══════════════════════════════════════════════════════════════════════════ */
function GameCard({ game, theme, language, bestScore, onOpen, onPlayMode }) {
  const colors = resolveGameAccentColors(game, theme);
  return (
    <View style={[styles.gameCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={i18nText(game.titleKey, game.id)}
        onPress={onOpen}
        scaleTo={0.99}
      >
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameBand}>
          <View pointerEvents="none" style={styles.bandGlow} />
          <View pointerEvents="none" style={styles.bandArt}>
            <AppIcon family="Ionicons" name={game.artwork.icon} size={86} color="rgba(255,255,255,0.15)" />
          </View>
          <View style={styles.bandIcon}>
            <AppIcon family={game.icon.family} name={game.icon.name} size={22} color="#FFFFFF" />
          </View>
          <View style={styles.bandCopy}>
            <Text style={styles.bandTitle} allowFontScaling={false} numberOfLines={1}>
              {i18nText(game.titleKey, game.id)}
            </Text>
            <Text style={styles.bandText} allowFontScaling={false} numberOfLines={2}>
              {i18nText(game.descriptionKey, "")}
            </Text>
          </View>
          {bestScore > 0 ? (
            <View style={styles.bandScore}>
              <AppIcon family="Ionicons" name="trophy" size={11} color="#FFD76A" />
              <Text style={styles.bandScoreText} allowFontScaling={false}>
                {bestScore}
              </Text>
            </View>
          ) : null}
        </LinearGradient>
      </PressableScale>

      <View style={styles.modeRow}>
        {SELECTABLE_GAME_MODES.map((mode) => (
          <PressableScale
            key={mode.id}
            accessibilityRole="button"
            accessibilityLabel={getLocalizedGameLabel(mode, language)}
            onPress={() => onPlayMode(mode.id)}
            scaleTo={0.95}
            style={[styles.modeChip, { backgroundColor: theme.primary, borderColor: theme.border }]}
          >
            <AppIcon family="Ionicons" name={mode.icon} size={16} color={colors[1]} />
            <Text style={[styles.modeChipText, { color: theme.text.primary }]} allowFontScaling={false} numberOfLines={1}>
              {getLocalizedGameLabel(mode, language)}
            </Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Arkadaş sıralaması
   ══════════════════════════════════════════════════════════════════════════ */
function FriendsRanking({ board, rows, currentUid, theme, onOpen }) {
  if (board.loading) return <Skeleton height={150} style={[styles.skeletonCard, { backgroundColor: theme.secondary }]} />;
  if (board.error) {
    return (
      <EmptyPanel
        icon="cloud-offline-outline"
        text={i18nText("autoI18n.arkadas_siralamasi_yuklenemedi", "Arkadaş sıralaması yüklenemedi")}
        theme={theme}
        onPress={onOpen}
      />
    );
  }
  if (!rows.length) {
    return (
      <EmptyPanel
        icon="people-outline"
        text={i18nText("autoI18n.arkadas_siralamasi_bos", "Arkadaşların oynadığında sıralama burada görünecek.")}
        theme={theme}
        onPress={onOpen}
      />
    );
  }

  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onOpen}
      scaleTo={0.99}
      style={[styles.panel, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      {rows.map((entry, index) => {
        const medal = RANK_COLORS[index] || theme.text.muted;
        const isSelf = entry.uid === currentUid;
        return (
          <View
            key={entry.uid}
            style={[
              styles.rankRow,
              isSelf && { backgroundColor: alpha(theme.accent, 0.12) },
              index > 0 && !isSelf && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <View style={[styles.rankBadge, { backgroundColor: alpha(medal, 0.2), borderColor: medal }]}>
              <Text style={[styles.rankBadgeText, { color: medal }]} allowFontScaling={false}>
                {index + 1}
              </Text>
            </View>
            <UserAvatar avatarIndex={entry.avatarIndex} photoURL={entry.photoURL} isCustomPhoto size={36} />
            <Text style={[styles.rankName, { color: theme.text.primary }]} numberOfLines={1} allowFontScaling={false}>
              {isSelf
                ? i18nText("autoI18n.sen", "Sen")
                : entry.displayName || i18nText("autoI18n.anonim_oyuncu", "Anonim Oyuncu")}
            </Text>
            <Text style={[styles.rankScore, { color: theme.accent }]} allowFontScaling={false}>
              {Number(entry.bestScore) || 0}
            </Text>
          </View>
        );
      })}
    </PressableScale>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Başarım önizleme: kilidi açılmaya en yakın üç başarım
   ══════════════════════════════════════════════════════════════════════════ */
function AchievementsPreview({ achievements, theme, onOpen }) {
  if (!achievements.preview.length) {
    return (
      <EmptyPanel
        icon="ribbon"
        text={i18nText("autoI18n.oyun_tum_basarimlar", "Tüm başarımları açtın. Harikasın!")}
        theme={theme}
        onPress={onOpen}
      />
    );
  }
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onOpen}
      scaleTo={0.99}
      style={[styles.panel, styles.achievementPanel, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      {achievements.preview.map((item) => (
        <View key={item.id} style={styles.achievementRow}>
          <View style={[styles.achievementIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
            <AppIcon family="Ionicons" name={item.icon} size={18} color={theme.accent} />
          </View>
          <View style={styles.achievementCopy}>
            <View style={styles.achievementTop}>
              <Text style={[styles.achievementTitle, { color: theme.text.primary }]} numberOfLines={1} allowFontScaling={false}>
                {i18nText(item.titleKey, item.id)}
              </Text>
              <Text style={[styles.achievementCount, { color: theme.text.muted }]} allowFontScaling={false}>
                {item.value}/{item.target}
              </Text>
            </View>
            <MiniProgress ratio={item.ratio} color={theme.accent} trackColor={theme.primary} height={5} style={styles.achievementBar} />
          </View>
        </View>
      ))}
    </PressableScale>
  );
}

function EmptyPanel({ icon, text, theme, onPress }) {
  return (
    <GlassTouchable
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.emptyPanel, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <AppIcon family="Ionicons" name={icon} size={22} color={theme.text.muted} />
      <Text style={[styles.emptyText, { color: theme.text.muted }]} allowFontScaling={false}>
        {text}
      </Text>
      <AppIcon family="Ionicons" name="chevron-forward" size={16} color={theme.text.muted} />
    </GlassTouchable>
  );
}

function HubSkeleton({ theme }) {
  const box = { backgroundColor: theme.secondary };
  return (
    <View style={styles.skeletonWrap}>
      <Skeleton height={102} style={[styles.skeletonCard, box]} />
      <Skeleton height={204} style={[styles.skeletonHero, box]} />
      <Skeleton height={170} style={[styles.skeletonCard, box]} />
      <Skeleton height={170} style={[styles.skeletonCard, box]} />
    </View>
  );
}

const styles = StyleSheet.create({

  gameList: { gap: 12 },
  gameCard: { borderRadius: 24, borderWidth: 1, overflow: "hidden" },
  gameBand: { minHeight: 96, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden" },
  bandGlow: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    right: -50,
    top: -70,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  bandArt: { position: "absolute", right: -8, bottom: -14, transform: [{ rotate: "-10deg" }] },
  bandIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  bandCopy: { flex: 1, paddingRight: 36 },
  bandTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  bandText: { color: "rgba(255,255,255,0.88)", fontSize: 11, lineHeight: 15, fontWeight: "650", marginTop: 3 },
  bandScore: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.26)",
  },
  bandScoreText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  modeRow: { flexDirection: "row", gap: 8, padding: 10 },
  modeChip: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 4,
  },
  modeChipText: { fontSize: 10.5, fontWeight: "850", textAlign: "center" },

  panel: { borderRadius: 22, borderWidth: 1, padding: 8 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 14 },
  rankBadge: { width: 26, height: 26, borderRadius: 9, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  rankBadgeText: { fontSize: 12, fontWeight: "900" },
  rankName: { flex: 1, fontSize: 13.5, fontWeight: "850" },
  rankScore: { fontSize: 15, fontWeight: "900" },

  achievementPanel: { padding: 14, gap: 14 },
  achievementRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  achievementIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  achievementCopy: { flex: 1 },
  achievementTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  achievementTitle: { flex: 1, fontSize: 13, fontWeight: "850" },
  achievementCount: { fontSize: 10.5, fontWeight: "800" },
  achievementBar: { marginTop: 7 },

  emptyPanel: { minHeight: 64, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  emptyText: { flex: 1, fontSize: 11.5, fontWeight: "650" },

  skeletonWrap: { gap: 12 },
  skeletonCard: { borderRadius: 22 },
  skeletonHero: { borderRadius: 26 },
});
