import { Image } from "expo-image";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import Skeleton from "@components/Skeleton";
import { useAuth } from "@context/AuthContext";
import { useFriends } from "@context/FriendsContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { fetchLeaderboard, loadGameData } from "@services/sceneGameService";
import { getAvatarSource } from "@utils/avatars";
import { i18nText } from "@utils/i18nText";
import { GameScreenShell } from "./GameScreenShell";
import {
  buildSceneDailyState,
  buildSceneGameProgress,
  GAME_REGISTRY,
  resolveGameAccentColors,
  SCENE_ACHIEVEMENTS,
} from "./gameRegistry";
import { DEFAULT_DIFFICULTY_ID, DEFAULT_MODE_ID, SCENE_GAME_ID } from "./gameConfig";

export default function GameHubScreen({ navigation }) {
  const { theme } = useTheme();
  useLanguage();
  const { user } = useAuth();
  const { friends = [], loading: friendsLoading } = useFriends() || {};
  const [state, setState] = useState({ loading: true, stats: null, leaderboard: [], leaderboardError: false });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setState((current) => ({ ...current, loading: true, leaderboardError: false }));

      Promise.allSettled([
        user?.uid ? loadGameData(user.uid) : Promise.resolve(null),
        fetchLeaderboard(50),
      ]).then(([statsResult, leaderboardResult]) => {
        if (!active) return;
        setState({
          loading: false,
          stats: statsResult.status === "fulfilled" ? statsResult.value : null,
          leaderboard: leaderboardResult.status === "fulfilled" ? leaderboardResult.value : [],
          leaderboardError: leaderboardResult.status === "rejected",
        });
      });

      return () => { active = false; };
    }, [user?.uid]),
  );

  const progress = useMemo(() => buildSceneGameProgress(state.stats), [state.stats]);
  const dailyState = useMemo(() => buildSceneDailyState(state.stats), [state.stats]);
  const isNewPlayer = progress.totalPlayed === 0;

  const friendRows = useMemo(() => {
    const friendUids = new Set(friends.map((friend) => friend.friendUid || friend.id));
    if (user?.uid) friendUids.add(user.uid);
    return state.leaderboard
      .filter((entry) => friendUids.has(entry.uid))
      .sort((a, b) => (Number(b.bestScore) || 0) - (Number(a.bestScore) || 0))
      .slice(0, 3);
  }, [friends, state.leaderboard, user?.uid]);

  const unlockedAchievements = useMemo(
    () => SCENE_ACHIEVEMENTS.filter((achievement) => achievement.isUnlocked(state.stats)),
    [state.stats],
  );

  const startFirstGame = () => navigation.navigate("SceneGameSetupScreen", {
    gameId: SCENE_GAME_ID,
    modeId: DEFAULT_MODE_ID,
    difficultyId: DEFAULT_DIFFICULTY_ID,
  });

  const headerRight = (
    <View style={styles.headerRightContainer}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={i18nText("autoI18n.ayarlari_ac", "Ayarları aç")}
        onPress={() => navigation.navigate("TabScreen", { initialTab: "settings" })}
        style={[styles.settingsButton, { backgroundColor: theme.secondary, borderColor: theme.border }]}
      >
        <AppIcon family="Ionicons" name="settings-outline" size={18} color={theme.text.primary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <GameScreenShell
      navigation={navigation}
      title={i18nText("autoI18n.oyun_merkezi", "Oyun Merkezi")}
      subtitle={i18nText("autoI18n.oyun_merkezi_aciklama", "Sinema oyunları ve gelişimin")}
      headerRight={headerRight}
    >
      {state.loading ? (
        <GameHubSkeleton theme={theme} />
      ) : (
        <>
          {/* 1. OYUNCU PROFİL & XP İLERLEME BANNER'I */}
          <PlayerProfileBanner user={user} progress={progress} theme={theme} />

          {/* 2. GÜNLÜK MEYDAN OKUMA HERO KARTI */}
          <DailyChallengeCard dailyState={dailyState} theme={theme} />

          {isNewPlayer ? <NewPlayerCard theme={theme} onStart={startFirstGame} /> : null}

          {/* 3. OYUNLAR VİTRİNİ */}
          <SectionHeader title={i18nText("autoI18n.oyunlar", "Oyunlar Vitrini")} theme={theme} />
          <View style={styles.gameList}>
            {GAME_REGISTRY.map((game) => (
              <HubGameCard
                key={game.id}
                game={game}
                stats={game.id === SCENE_GAME_ID ? state.stats : null}
                theme={theme}
                onPress={() => game.routeName && navigation.navigate(game.routeName, { gameId: game.id })}
              />
            ))}
          </View>

          {/* 4. LİDERLİK TABLOSU */}
          <SectionHeader
            title={i18nText("autoI18n.arkadas_siralamasi", "Liderlik Tablosu")}
            theme={theme}
            action={i18nText("autoI18n.tumunu_gor", "Tümünü Gör")}
            onAction={() => navigation.navigate("GameLeaderboardScreen", { gameId: SCENE_GAME_ID })}
          />
          <FriendsRankingCard
            loading={friendsLoading}
            error={state.leaderboardError}
            rows={friendRows}
            currentUid={user?.uid}
            theme={theme}
            onOpen={() => navigation.navigate("GameLeaderboardScreen", { gameId: SCENE_GAME_ID })}
          />

          {/* 5. BAŞARIMLAR */}
          <SectionHeader
            title={i18nText("autoI18n.son_basarimlar", "Son Başarımlar")}
            theme={theme}
            action={i18nText("autoI18n.tumunu_gor", "Tümünü Gör")}
            onAction={() => navigation.navigate("GameAchievementsScreen", { gameId: SCENE_GAME_ID })}
          />
          <AchievementsPreview
            achievements={unlockedAchievements}
            stats={state.stats}
            theme={theme}
            onOpen={() => navigation.navigate("GameAchievementsScreen", { gameId: SCENE_GAME_ID })}
          />
        </>
      )}
    </GameScreenShell>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   1. Oyuncu Profil & XP Banner Bileşeni
   ══════════════════════════════════════════════════════════════════════════ */
function PlayerProfileBanner({ user, progress, theme }) {
  const currentXp = (progress.bestClassicScore || 0) * 12 + progress.totalPlayed * 25;
  const nextLevelXp = progress.level * 300;
  const xpRatio = Math.min(1, currentXp / nextLevelXp);

  return (
    <View style={[styles.profileBanner, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={styles.bannerTopRow}>
        <View style={styles.avatarWrap}>
          <Image source={getAvatarSource(user?.avatarIndex)} style={styles.bannerAvatar} />
          <View style={[styles.avatarBadge, { backgroundColor: theme.accent }]}>
            <AppIcon family="Ionicons" name="sparkles" size={10} color="#fff" />
          </View>
        </View>

        <View style={styles.bannerInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.bannerName, { color: theme.text.primary }]} numberOfLines={1} allowFontScaling={false}>
              {user?.displayName || i18nText("autoI18n.oyuncu", "Sinema Oyuncusu")}
            </Text>
            <View style={[styles.levelBadge, { backgroundColor: `${theme.accent}1F` }]}>
              <Text style={[styles.levelBadgeText, { color: theme.accent }]} allowFontScaling={false}>
                ⚡ {i18nText("autoI18n.seviye_degeri", `Level ${progress.level}`, { level: progress.level })}
              </Text>
            </View>
          </View>
          <Text style={[styles.bannerSubtitle, { color: theme.text.muted }]} allowFontScaling={false}>
            {progress.level > 3 ? i18nText("autoI18n.sinema_gurusu", "Sinema Gurusu") : i18nText("autoI18n.film_sever", "Film Sever")}
          </Text>
        </View>
      </View>

      {/* XP Progress Bar */}
      <View style={styles.xpTrackWrap}>
        <View style={styles.xpHeader}>
          <Text style={[styles.xpTitle, { color: theme.text.muted }]} allowFontScaling={false}>
            XP İlerlemesi
          </Text>
          <Text style={[styles.xpValue, { color: theme.text.primary }]} allowFontScaling={false}>
            {currentXp} / {nextLevelXp} XP
          </Text>
        </View>
        <View style={[styles.xpBarTrack, { backgroundColor: theme.primary }]}>
          <LinearGradient
            colors={[theme.accent, theme.bold || theme.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.xpBarFill, { width: `${xpRatio * 100}%` }]}
          />
        </View>
      </View>

      {/* Quick Stats Chips */}
      <View style={styles.bannerStatsRow}>
        <View style={[styles.bannerStatChip, { backgroundColor: theme.primary }]}>
          <AppIcon family="Ionicons" name="flame" size={14} color="#FF6B6B" />
          <Text style={[styles.bannerStatValue, { color: theme.text.primary }]} allowFontScaling={false}>
            {progress.weeklyStreak} {i18nText("autoI18n.gun_seri", "Gün Seri")}
          </Text>
        </View>

        <View style={[styles.bannerStatChip, { backgroundColor: theme.primary }]}>
          <AppIcon family="Ionicons" name="trophy" size={14} color="#FFD700" />
          <Text style={[styles.bannerStatValue, { color: theme.text.primary }]} allowFontScaling={false}>
            {progress.bestClassicScore} {i18nText("autoI18n.rekor", "Rekor")}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   2. Günlük Meydan Okuma Card
   ══════════════════════════════════════════════════════════════════════════ */
function DailyChallengeCard({ dailyState, theme }) {
  const comingSoon = dailyState.status === "coming_soon";
  const completed = dailyState.status === "completed";
  const remaining = formatRemaining(dailyState.expiresAt);

  return (
    <LinearGradient
      colors={[theme.bold || theme.accent, theme.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.dailyHero}
    >
      <View pointerEvents="none" style={styles.dailyGlowOne} />
      <View pointerEvents="none" style={styles.dailyGlowTwo} />
      <View pointerEvents="none" style={styles.dailyArtwork}>
        <AppIcon family="Ionicons" name="calendar-sharp" size={125} color="rgba(255,255,255,0.075)" />
      </View>

      <View style={styles.dailyTopRow}>
        <View style={styles.dailyBadgePill}>
          <AppIcon family="Ionicons" name="sunny" size={12} color="#FFD700" />
          <Text style={styles.dailyBadgeText} allowFontScaling={false}>
            {i18nText("autoI18n.gunluk_meydan_okuma", "Günlük Meydan Okuma").toUpperCase()}
          </Text>
        </View>
        <View style={styles.dailyStatusBadge}>
          <Text style={styles.dailyStatusText} allowFontScaling={false}>
            {comingSoon ? i18nText("autoI18n.yakinda", "Yakında") : completed ? i18nText("autoI18n.tamamlandi", "Tamamlandı") : i18nText("autoI18n.bugun", "Bugün")}
          </Text>
        </View>
      </View>

      <Text style={styles.dailyTitle} allowFontScaling={false} numberOfLines={2}>
        {comingSoon
          ? i18nText("autoI18n.gunluk_mod_yakinda", "Herkes için aynı sahneler yakında")
          : completed
          ? i18nText("autoI18n.gunluk_tamamlandi", "Bugünkü denemeni tamamladın")
          : i18nText("autoI18n.gunluk_sahneleri_tahmin_et", "Bugünün sahnelerini tahmin et")}
      </Text>

      <View style={styles.dailyStatsRow}>
        <View style={styles.dailyMetaChip}>
          <AppIcon family="Ionicons" name="time-outline" size={13} color="#FFFFFF" />
          <Text style={styles.dailyMetaText} allowFontScaling={false}>
            {comingSoon ? "--:--" : remaining}
          </Text>
        </View>

        <View style={styles.dailyMetaChip}>
          <AppIcon family="Ionicons" name="people-outline" size={13} color="#FFFFFF" />
          <Text style={styles.dailyMetaText} allowFontScaling={false}>
            {dailyState.friendRank ? `#${dailyState.friendRank}` : "#--"}
          </Text>
        </View>

        <View style={styles.dailyMetaChip}>
          <AppIcon family="Ionicons" name="sparkles" size={13} color="#FFD700" />
          <Text style={styles.dailyMetaText} allowFontScaling={false}>
            {comingSoon ? "-- XP" : `+${Number(dailyState.rewardXp) || 0} XP`}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={comingSoon ? 1 : 0.85}
        disabled={comingSoon}
        style={[styles.dailyCtaBtn, { opacity: comingSoon ? 0.7 : 1 }]}
      >
        <Text style={[styles.dailyCtaText, { color: theme.accent }]} allowFontScaling={false}>
          {comingSoon
            ? i18nText("autoI18n.yakinda", "Yakında")
            : completed
            ? i18nText("autoI18n.sonucu_gor", "Sonucu Gör")
            : i18nText("autoI18n.oyna", "Oyuna Başla")}
        </Text>
        <AppIcon
          family="Ionicons"
          name={completed ? "stats-chart" : "arrow-forward"}
          size={14}
          color={theme.accent}
        />
      </TouchableOpacity>
    </LinearGradient>
  );
}

function NewPlayerCard({ theme, onStart }) {
  return (
    <View style={[styles.welcomeCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={[styles.welcomeIcon, { backgroundColor: `${theme.accent}20` }]}>
        <AppIcon family="Ionicons" name="rocket-outline" size={22} color={theme.accent} />
      </View>
      <View style={styles.welcomeCopy}>
        <Text style={[styles.welcomeTitle, { color: theme.text.primary }]} allowFontScaling={false}>
          {i18nText("autoI18n.ilk_oyun_bonus_baslik", "İlk oyununla başla")}
        </Text>
        <Text style={[styles.welcomeText, { color: theme.text.muted }]} allowFontScaling={false}>
          {i18nText("autoI18n.ilk_oyun_bonus_aciklama", "Sahne Tahmin'i keşfet. XP bonusları ile ilerlemeni kaydet.")}
        </Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={i18nText("autoI18n.ilk_oyununu_baslat", "İlk oyununu başlat")}
        onPress={onStart}
        style={[styles.welcomeButton, { backgroundColor: theme.accent }]}
      >
        <AppIcon family="Ionicons" name="play" size={15} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Oyunlar Vitrini Kartı
   ══════════════════════════════════════════════════════════════════════════ */
function HubGameCard({ game, stats, theme, onPress }) {
  const locked = game.availability !== "available";
  const colors = resolveGameAccentColors(game, theme);
  const hasPlayed = (Number(stats?.totalPlayed) || 0) > 0;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
      accessibilityLabel={i18nText(game.titleKey, game.id)}
      disabled={locked}
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.gameCard,
        { backgroundColor: theme.secondary, borderColor: theme.border, opacity: locked ? 0.65 : 1 },
      ]}
    >
      <LinearGradient colors={colors} style={styles.gameArtwork}>
        <AppIcon family={game.icon.family} name={game.icon.name} size={24} color="#fff" />
      </LinearGradient>
      <View style={styles.gameCopy}>
        <View style={styles.gameTitleRow}>
          <Text style={[styles.gameTitle, { color: theme.text.primary }]} allowFontScaling={false}>
            {i18nText(game.titleKey, game.id)}
          </Text>
          {locked ? (
            <View style={[styles.lockBadge, { borderColor: theme.border }]}>
              <AppIcon family="Ionicons" name="lock-closed-outline" size={10} color={theme.text.muted} />
              <Text style={[styles.lockText, { color: theme.text.muted }]} allowFontScaling={false}>
                {i18nText("autoI18n.yakinda", "Yakında")}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.gameDescription, { color: theme.text.muted }]} numberOfLines={1} allowFontScaling={false}>
          {i18nText(game.descriptionKey, "")}
        </Text>
        <View style={styles.gameMetaRow}>
          <View style={[styles.metaChip, { backgroundColor: theme.primary, borderColor: theme.border }]}>
            <Text style={[styles.gameMetaText, { color: theme.text.secondary }]} allowFontScaling={false}>
              {hasPlayed ? formatLastPlayed(stats?.lastPlayedAt) : i18nText("autoI18n.henuz_oynanmadi", "Henüz oynanmadı")}
            </Text>
          </View>

          <View style={[styles.metaChip, { backgroundColor: theme.primary, borderColor: theme.border }]}>
            <Text style={[styles.gameMetaText, { color: theme.text.secondary }]} allowFontScaling={false}>
              {hasPlayed
                ? `${i18nText("autoI18n.rekor", "Rekor")}: ${Number(stats?.bestScore) || 0}`
                : locked
                ? i18nText("autoI18n.yakinda_acilacak", "Yakında")
                : i18nText("autoI18n.rekor_yok", "Rekor yok")}
            </Text>
          </View>
        </View>
      </View>
      {!locked ? <AppIcon family="Ionicons" name="chevron-forward" size={18} color={theme.text.muted} /> : null}
    </TouchableOpacity>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   4. Görev Satırı
   ══════════════════════════════════════════════════════════════════════════ */
function TaskRow({ task, stats, theme, isLast }) {
  const rawProgress = task.getProgress(stats);
  const progress = Math.min(rawProgress, task.target);
  const complete = progress >= task.target;
  const ratio = task.target ? progress / task.target : 0;

  return (
    <View
      style={[
        styles.taskRow,
        !isLast && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View
        style={[
          styles.taskState,
          { backgroundColor: complete ? "rgba(46,204,113,0.18)" : `${theme.accent}18` },
        ]}
      >
        <AppIcon
          family="Ionicons"
          name={complete ? "checkmark" : "flag-outline"}
          size={15}
          color={complete ? "#2ECC71" : theme.accent}
        />
      </View>
      <View style={styles.taskCopy}>
        <View style={styles.taskTitleRow}>
          <Text style={[styles.taskTitle, { color: theme.text.primary }]} allowFontScaling={false}>
            {i18nText(task.titleKey, task.id)}
          </Text>
          <Text style={[styles.taskCount, { color: complete ? "#2ECC71" : theme.text.muted }]} allowFontScaling={false}>
            {progress}/{task.target}
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: theme.primary }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: complete ? "#2ECC71" : theme.accent, width: `${ratio * 100}%` },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   5. Arkadaş Sıralaması (Podyum Stili)
   ══════════════════════════════════════════════════════════════════════════ */
function FriendsRankingCard({ loading, error, rows, currentUid, theme, onOpen }) {
  if (loading) return <Skeleton height={154} style={{ borderRadius: 20, backgroundColor: theme.secondary }} />;
  if (error) return <EmptyPanel icon="cloud-offline-outline" text={i18nText("autoI18n.arkadas_siralamasi_yuklenemedi", "Arkadaş sıralaması yüklenemedi")} theme={theme} onPress={onOpen} />;
  if (!rows.length) return <EmptyPanel icon="people-outline" text={i18nText("autoI18n.arkadas_siralamasi_bos", "Arkadaşların oynadığında sıralama burada görünecek.")} theme={theme} onPress={onOpen} />;

  const getRankColor = (idx) => {
    if (idx === 0) return "#FFD700";
    if (idx === 1) return "#C0C0C0";
    if (idx === 2) return "#CD7F32";
    return theme.text.muted;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onOpen}
      style={[styles.panel, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      {rows.map((entry, index) => (
        <View key={entry.uid} style={styles.rankRow}>
          <View style={styles.rankNumberBadge}>
            <Text
              style={[styles.rankNumber, { color: getRankColor(index) }]}
              allowFontScaling={false}
            >
              #{index + 1}
            </Text>
          </View>
          <View style={[styles.avatarContainer, { borderColor: getRankColor(index) }]}>
            <Image source={getAvatarSource(entry.avatarIndex)} style={styles.rankAvatar} />
          </View>
          <View style={styles.rankCopy}>
            <Text style={[styles.rankName, { color: theme.text.primary }]} numberOfLines={1} allowFontScaling={false}>
              {entry.uid === currentUid ? i18nText("autoI18n.sen", "Sen") : entry.displayName || i18nText("autoI18n.anonim_oyuncu", "Anonim Oyuncu")}
            </Text>
            <Text style={[styles.rankMeta, { color: theme.text.muted }]} allowFontScaling={false}>
              {i18nText("autoI18n.sahne_tahmin_oyunu_title", "Sahne Tahmin")}
            </Text>
          </View>
          <Text style={[styles.rankScore, { color: theme.accent }]} allowFontScaling={false}>
            {Number(entry.bestScore) || 0}
          </Text>
        </View>
      ))}
    </TouchableOpacity>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   6. Son Başarımlar Önizleme
   ══════════════════════════════════════════════════════════════════════════ */
function AchievementsPreview({ achievements, stats, theme, onOpen }) {
  const inProgressAchievements = useMemo(
    () => SCENE_ACHIEVEMENTS.filter((achievement) => !achievement.isUnlocked(stats)).slice(0, 2),
    [stats],
  );

  const hasItems = achievements.length > 0 || inProgressAchievements.length > 0;
  if (!hasItems) return <EmptyPanel icon="ribbon-outline" text={i18nText("autoI18n.ilk_basari_bekliyor", "İlk başarımın seni bekliyor. Bir oyun tamamlayarak başla.")} theme={theme} onPress={onOpen} />;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onOpen}
      style={[styles.achievementCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      {/* Kazanılan Başarımlar */}
      {achievements.slice(-2).map((achievement) => (
        <View key={achievement.id} style={styles.achievementItem}>
          <View style={[styles.achievementIcon, { backgroundColor: "rgba(192,132,252,0.18)" }]}>
            <AppIcon family="Ionicons" name={achievement.iconSolid || achievement.icon} size={18} color="#C084FC" />
          </View>
          <View style={styles.achievementCopy}>
            <Text style={[styles.achievementTitle, { color: theme.text.primary }]} allowFontScaling={false}>
              {i18nText(achievement.titleKey, achievement.id)}
            </Text>
            <Text style={[styles.achievementText, { color: theme.text.muted }]} allowFontScaling={false}>
              {i18nText(achievement.descriptionKey, "")}
            </Text>
          </View>
          <AppIcon family="Ionicons" name="checkmark-circle" size={18} color="#2ECC71" />
        </View>
      ))}

      {/* Devam Eden Kademeli Başarımlar */}
      {inProgressAchievements.map((achievement) => {
        const rawProgress = achievement.getProgress(stats);
        const progress = Math.min(rawProgress, achievement.target);
        const ratio = achievement.target ? progress / achievement.target : 0;

        return (
          <View key={achievement.id} style={styles.achievementItem}>
            <View style={[styles.achievementIcon, { backgroundColor: `${theme.accent}18` }]}>
              <AppIcon family="Ionicons" name={achievement.icon} size={17} color={theme.accent} />
            </View>
            <View style={styles.achievementCopy}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[styles.achievementTitle, { color: theme.text.primary }]} allowFontScaling={false}>
                  {i18nText(achievement.titleKey, achievement.id)}
                </Text>
                <Text style={[styles.taskCountText, { color: theme.text.muted }]} allowFontScaling={false}>
                  {progress}/{achievement.target}
                </Text>
              </View>
              <View style={[styles.miniProgressTrack, { backgroundColor: theme.primary, marginTop: 4 }]}>
                <View style={[styles.miniProgressFill, { backgroundColor: theme.accent, width: `${ratio * 100}%` }]} />
              </View>
            </View>
          </View>
        );
      })}
    </TouchableOpacity>
  );
}

function EmptyPanel({ icon, text, theme, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.emptyPanel, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <AppIcon family="Ionicons" name={icon} size={22} color={theme.text.muted} />
      <Text style={[styles.emptyText, { color: theme.text.muted }]} allowFontScaling={false}>
        {text}
      </Text>
      <AppIcon family="Ionicons" name="chevron-forward" size={16} color={theme.text.muted} />
    </TouchableOpacity>
  );
}

function SectionHeader({ title, theme, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.text.muted }]} allowFontScaling={false}>
        {title}
      </Text>
      {action ? (
        <TouchableOpacity hitSlop={9} onPress={onAction}>
          <Text style={[styles.sectionAction, { color: theme.accent }]} allowFontScaling={false}>
            {action} →
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function GameHubSkeleton({ theme }) {
  return (
    <View style={styles.skeletonWrap}>
      <Skeleton height={140} style={[styles.skeleton, { backgroundColor: theme.secondary }]} />
      <Skeleton height={210} style={[styles.skeleton, { backgroundColor: theme.secondary }]} />
      <Skeleton height={88} style={[styles.skeleton, { backgroundColor: theme.secondary }]} />
      <Skeleton height={156} style={[styles.skeleton, { backgroundColor: theme.secondary }]} />
    </View>
  );
}

function formatRemaining(expiresAt) {
  if (!expiresAt) return "--:--";
  const timestamp = typeof expiresAt?.toMillis === "function" ? expiresAt.toMillis() : new Date(expiresAt).getTime();
  if (!Number.isFinite(timestamp)) return "--:--";
  const remaining = Math.max(0, timestamp - Date.now());
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatLastPlayed(value) {
  if (!value) return i18nText("autoI18n.henuz_oynanmadi", "Henüz oynanmadı");
  const timestamp = typeof value?.toMillis === "function" ? value.toMillis() : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return i18nText("autoI18n.son_oynanma", "Son oynama");
  const elapsedDays = Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
  if (elapsedDays === 0) return i18nText("autoI18n.bugun_oynandi", "Bugün oynandı");
  if (elapsedDays === 1) return i18nText("autoI18n.dun_oynandi", "Dün oynandı");
  return i18nText("autoI18n.gun_once_oynandi", `${elapsedDays}d önce`, { count: elapsedDays });
}

/* ══════════════════════════════════════════════════════════════════════════
   Gaming Dashboard Styles
   ══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  headerRightContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  settingsButton: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  // Player Profile Banner
  profileBanner: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 15,
    marginBottom: 10,
    gap: 12,
  },
  bannerTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarWrap: { position: "relative" },
  bannerAvatar: { width: 48, height: 48, borderRadius: 16 },
  avatarBadge: { position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  bannerInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bannerName: { fontSize: 16, fontWeight: "900", maxWidth: 140 },
  levelBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  levelBadgeText: { fontSize: 9.5, fontWeight: "900" },
  bannerSubtitle: { fontSize: 10.5, fontWeight: "650", marginTop: 2 },

  xpTrackWrap: { gap: 4 },
  xpHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  xpTitle: { fontSize: 9.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  xpValue: { fontSize: 10, fontWeight: "850" },
  xpBarTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  xpBarFill: { height: "100%", borderRadius: 3 },

  bannerStatsRow: { flexDirection: "row", gap: 8 },
  bannerStatChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 },
  bannerStatValue: { fontSize: 10.5, fontWeight: "800" },

  // Daily Hero
  dailyHero: {
    minHeight: 220,
    borderRadius: 24,
    padding: 18,
    overflow: "hidden",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dailyGlowOne: { position: "absolute", width: 170, height: 170, borderRadius: 85, right: -50, top: -60, backgroundColor: "rgba(255,255,255,0.09)" },
  dailyGlowTwo: { position: "absolute", width: 100, height: 100, borderRadius: 50, left: -30, bottom: -30, backgroundColor: "rgba(255,255,255,0.06)" },
  dailyArtwork: { position: "absolute", right: -8, top: 30, transform: [{ rotate: "-8deg" }] },
  dailyTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dailyBadgePill: {
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
  dailyBadgeText: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.8 },
  dailyStatusBadge: { borderRadius: 10, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 10, paddingVertical: 5 },
  dailyStatusText: { color: "#fff", fontSize: 10, fontWeight: "850" },
  dailyTitle: { color: "#fff", fontSize: 20, lineHeight: 26, fontWeight: "900", maxWidth: "85%", marginVertical: 8 },

  dailyStatsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 6 },
  dailyMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  dailyMetaText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },

  dailyCtaBtn: {
    height: 40,
    borderRadius: 14,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  dailyCtaText: { fontSize: 12.5, fontWeight: "900" },

  // New Player Card
  welcomeCard: {
    minHeight: 84,
    borderRadius: 20,
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  welcomeIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  welcomeCopy: { flex: 1 },
  welcomeTitle: { fontSize: 13.5, fontWeight: "850" },
  welcomeText: { fontSize: 10, lineHeight: 14, fontWeight: "650", marginTop: 2 },
  welcomeButton: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  // Section Headers
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 8, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  sectionAction: { fontSize: 11, fontWeight: "800" },

  // Game List Cards
  gameList: { gap: 10 },
  gameCard: {
    minHeight: 88,
    borderRadius: 20,
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  gameArtwork: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  gameCopy: { flex: 1 },
  gameTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  gameTitle: { fontSize: 14.5, fontWeight: "900" },
  lockBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  lockText: { fontSize: 8.5, fontWeight: "800" },
  gameDescription: { fontSize: 10.5, lineHeight: 15, fontWeight: "600", marginTop: 2 },
  gameMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  metaChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  gameMetaText: { fontSize: 9.5, fontWeight: "750" },

  // Panels & Lists
  panel: { borderRadius: 20, borderWidth: 1, padding: 13 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  taskState: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  taskCopy: { flex: 1 },
  taskTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  taskTitle: { fontSize: 12.5, fontWeight: "800" },
  taskCount: { fontSize: 10, fontWeight: "800" },
  progressTrack: { height: 5, borderRadius: 2.5, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2.5 },

  rankRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  rankNumberBadge: { width: 24, alignItems: "center" },
  rankNumber: { fontSize: 12.5, fontWeight: "900" },
  avatarContainer: { borderWidth: 1.5, borderRadius: 14, padding: 1 },
  rankAvatar: { width: 34, height: 34, borderRadius: 12 },
  rankCopy: { flex: 1 },
  rankName: { fontSize: 12.5, fontWeight: "850" },
  rankMeta: { fontSize: 9.5, fontWeight: "650", marginTop: 1 },
  rankScore: { fontSize: 14, fontWeight: "900" },

  achievementCard: { borderRadius: 20, borderWidth: 1, padding: 13, gap: 10 },
  achievementItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  achievementIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(192,132,252,0.15)", alignItems: "center", justifyContent: "center" },
  achievementCopy: { flex: 1 },
  achievementTitle: { fontSize: 12.5, fontWeight: "850" },
  achievementText: { fontSize: 9.5, fontWeight: "650", marginTop: 1 },
  taskCountText: { fontSize: 10, fontWeight: "850" },
  miniProgressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  miniProgressFill: { height: "100%", borderRadius: 2 },

  emptyPanel: { minHeight: 64, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  emptyText: { flex: 1, fontSize: 11, fontWeight: "650" },

  skeletonWrap: { gap: 12 },
  skeleton: { borderRadius: 20 },
});
