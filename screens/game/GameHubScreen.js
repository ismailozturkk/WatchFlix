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
  SCENE_STARTER_TASKS,
} from "./gameRegistry";
import { availableModeCount, DEFAULT_DIFFICULTY_ID, DEFAULT_MODE_ID, SCENE_GAME_ID } from "./gameConfig";

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
    <>
      <View style={[styles.levelPill, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <AppIcon family="Ionicons" name="sparkles" size={13} color={theme.accent} />
        <Text style={[styles.levelPillText, { color: theme.text.primary }]}>{i18nText("autoI18n.seviye_kisa", `Sv. ${progress.level}`, { level: progress.level })}</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={i18nText("autoI18n.ayarlari_ac", "Ayarları aç")} onPress={() => navigation.navigate("TabScreen", { initialTab: "settings" })} style={[styles.settingsButton, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <AppIcon family="Ionicons" name="settings-outline" size={19} color={theme.text.primary} />
      </TouchableOpacity>
    </>
  );

  return (
    <GameScreenShell navigation={navigation} title={i18nText("autoI18n.oyun_merkezi", "Oyun Merkezi")} subtitle={i18nText("autoI18n.oyun_merkezi_aciklama", "Oyunların ve ilerlemen")} headerRight={headerRight}>
      {state.loading ? (
        <GameHubSkeleton theme={theme} />
      ) : (
        <>
          <DailyChallengeCard dailyState={dailyState} theme={theme} />

          {isNewPlayer ? <NewPlayerCard theme={theme} onStart={startFirstGame} /> : null}

          <SectionHeader title={i18nText("autoI18n.oyunlar", "Oyunlar")} theme={theme} />
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

          <SectionHeader title={i18nText("autoI18n.devam_eden_gorevler", "Devam Eden Görevler")} theme={theme} />
          <View style={[styles.panel, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            {SCENE_STARTER_TASKS.map((task, index) => <TaskRow key={task.id} task={task} stats={state.stats} theme={theme} isLast={index === SCENE_STARTER_TASKS.length - 1} />)}
          </View>

          <SectionHeader title={i18nText("autoI18n.arkadas_siralamasi", "Arkadaş Sıralaması")} theme={theme} action={i18nText("autoI18n.tumunu_gor", "Tümünü Gör")} onAction={() => navigation.navigate("GameLeaderboardScreen", { gameId: SCENE_GAME_ID })} />
          <FriendsRankingCard loading={friendsLoading} error={state.leaderboardError} rows={friendRows} currentUid={user?.uid} theme={theme} onOpen={() => navigation.navigate("GameLeaderboardScreen", { gameId: SCENE_GAME_ID })} />

          <SectionHeader title={i18nText("autoI18n.son_basarimlar", "Son Başarımlar")} theme={theme} action={i18nText("autoI18n.tumunu_gor", "Tümünü Gör")} onAction={() => navigation.navigate("GameAchievementsScreen", { gameId: SCENE_GAME_ID })} />
          <AchievementsPreview achievements={unlockedAchievements} theme={theme} onOpen={() => navigation.navigate("GameAchievementsScreen", { gameId: SCENE_GAME_ID })} />
        </>
      )}
    </GameScreenShell>
  );
}

function DailyChallengeCard({ dailyState, theme }) {
  const comingSoon = dailyState.status === "coming_soon";
  const completed = dailyState.status === "completed";
  const remaining = formatRemaining(dailyState.expiresAt);

  return (
    <LinearGradient colors={[theme.accent, theme.bold || theme.accent]} style={styles.dailyHero}>
      <View style={styles.dailyArtwork}><AppIcon family="Ionicons" name="calendar" size={104} color="rgba(255,255,255,0.08)" /></View>
      <View style={styles.dailyTop}>
        <View style={styles.dailyIcon}><AppIcon family="Ionicons" name="sunny-outline" size={24} color="#fff" /></View>
        <View style={styles.dailyStatusBadge}><Text style={styles.dailyStatusText}>{comingSoon ? i18nText("autoI18n.yakinda", "Yakında") : completed ? i18nText("autoI18n.tamamlandi", "Tamamlandı") : i18nText("autoI18n.bugun", "Bugün")}</Text></View>
      </View>
      <Text style={styles.dailyEyebrow}>{i18nText("autoI18n.gunluk_meydan_okuma", "Günlük Meydan Okuma")}</Text>
      <Text style={styles.dailyTitle}>{comingSoon ? i18nText("autoI18n.gunluk_mod_yakinda", "Herkes için aynı sahneler yakında") : completed ? i18nText("autoI18n.gunluk_tamamlandi", "Bugünkü denemeni tamamladın") : i18nText("autoI18n.gunluk_sahneleri_tahmin_et", "Bugünün sahnelerini tahmin et")}</Text>
      <View style={styles.dailyFooter}>
        <View style={styles.dailyMeta}><AppIcon family="Ionicons" name="time-outline" size={15} color="#fff" /><Text style={styles.dailyMetaText}>{comingSoon ? "--:--" : remaining}</Text></View>
        <View style={styles.dailyMeta}><AppIcon family="Ionicons" name="people-outline" size={15} color="#fff" /><Text style={styles.dailyMetaText}>{dailyState.friendRank ? `#${dailyState.friendRank}` : "#--"}</Text></View>
        <View style={styles.dailyMeta}><AppIcon family="Ionicons" name="sparkles-outline" size={15} color="#fff" /><Text style={styles.dailyMetaText}>{comingSoon ? "-- XP" : `+${Number(dailyState.rewardXp) || 0} XP`}</Text></View>
        <View style={[styles.dailyAction, { opacity: comingSoon ? 0.7 : 1 }]}><Text style={[styles.dailyActionText, { color: theme.accent }]}>{comingSoon ? i18nText("autoI18n.yakinda", "Yakında") : completed ? i18nText("autoI18n.sonucu_gor", "Sonucu Gör") : i18nText("autoI18n.oyna", "Oyna")}</Text><AppIcon family="Ionicons" name={completed ? "stats-chart" : "arrow-forward"} size={16} color={theme.accent} /></View>
      </View>
    </LinearGradient>
  );
}

function NewPlayerCard({ theme, onStart }) {
  return (
    <View style={[styles.welcomeCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={[styles.welcomeIcon, { backgroundColor: `${theme.accent}20` }]}><AppIcon family="Ionicons" name="rocket-outline" size={25} color={theme.accent} /></View>
      <View style={styles.welcomeCopy}><Text style={[styles.welcomeTitle, { color: theme.text.primary }]}>{i18nText("autoI18n.ilk_oyun_bonus_baslik", "İlk oyununla başla")}</Text><Text style={[styles.welcomeText, { color: theme.text.muted }]}>{i18nText("autoI18n.ilk_oyun_bonus_aciklama", "Sahne Tahmin'i keşfet. XP bonusları ilerleme sistemiyle yakında.")}</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={i18nText("autoI18n.ilk_oyununu_baslat", "İlk oyununu başlat")} onPress={onStart} style={[styles.welcomeButton, { backgroundColor: theme.accent }]}><AppIcon family="Ionicons" name="play" size={17} color="#fff" /></TouchableOpacity>
    </View>
  );
}

function HubGameCard({ game, stats, theme, onPress }) {
  const locked = game.availability !== "available";
  const colors = resolveGameAccentColors(game, theme);
  const hasPlayed = (Number(stats?.totalPlayed) || 0) > 0;

  return (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: locked }} accessibilityLabel={i18nText(game.titleKey, game.id)} disabled={locked} activeOpacity={0.82} onPress={onPress} style={[styles.gameCard, { backgroundColor: theme.secondary, borderColor: theme.border, opacity: locked ? 0.62 : 1 }]}>
      <LinearGradient colors={colors} style={styles.gameArtwork}><AppIcon family={game.icon.family} name={game.icon.name} size={27} color="#fff" /></LinearGradient>
      <View style={styles.gameCopy}>
        <View style={styles.gameTitleRow}><Text style={[styles.gameTitle, { color: theme.text.primary }]}>{i18nText(game.titleKey, game.id)}</Text>{locked ? <View style={[styles.lockBadge, { borderColor: theme.border }]}><AppIcon family="Ionicons" name="lock-closed-outline" size={10} color={theme.text.muted} /><Text style={[styles.lockText, { color: theme.text.muted }]}>{i18nText("autoI18n.yakinda", "Yakında")}</Text></View> : null}</View>
        <Text style={[styles.gameDescription, { color: theme.text.muted }]} numberOfLines={1}>{i18nText(game.descriptionKey, "")}</Text>
        <View style={styles.gameMetaRow}>
          <Text style={[styles.gameMeta, { color: theme.text.secondary }]}>{hasPlayed ? formatLastPlayed(stats?.lastPlayedAt) : i18nText("autoI18n.henuz_oynanmadi", "Henüz oynanmadı")}</Text>
          <View style={[styles.metaDot, { backgroundColor: theme.border }]} />
          <Text style={[styles.gameMeta, { color: theme.text.secondary }]}>{hasPlayed ? `${i18nText("autoI18n.rekor", "Rekor")}: ${Number(stats?.bestScore) || 0}` : locked ? i18nText("autoI18n.yakinda_acilacak", "Yakında açılacak") : i18nText("autoI18n.rekor_yok", "Rekor yok")}</Text>
          <View style={[styles.metaDot, { backgroundColor: theme.border }]} />
          <Text style={[styles.gameMeta, { color: theme.text.secondary }]}>{locked ? i18nText("autoI18n.kilitli", "Kilitli") : i18nText("autoI18n.mod_sayisi", `${availableModeCount} mod`, { count: availableModeCount })}</Text>
        </View>
      </View>
      {!locked ? <AppIcon family="Ionicons" name="chevron-forward" size={19} color={theme.text.muted} /> : null}
    </TouchableOpacity>
  );
}

function TaskRow({ task, stats, theme, isLast }) {
  const rawProgress = task.getProgress(stats);
  const progress = Math.min(rawProgress, task.target);
  const complete = progress >= task.target;
  const ratio = task.target ? progress / task.target : 0;

  return (
    <View style={[styles.taskRow, !isLast && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.taskState, { backgroundColor: complete ? "rgba(46,204,113,0.16)" : `${theme.accent}18` }]}><AppIcon family="Ionicons" name={complete ? "checkmark" : "flag-outline"} size={17} color={complete ? "#2ECC71" : theme.accent} /></View>
      <View style={styles.taskCopy}><View style={styles.taskTitleRow}><Text style={[styles.taskTitle, { color: theme.text.primary }]}>{i18nText(task.titleKey, task.id)}</Text><Text style={[styles.taskCount, { color: theme.text.muted }]}>{progress}/{task.target}</Text></View><View style={[styles.progressTrack, { backgroundColor: theme.primary }]}><View style={[styles.progressFill, { backgroundColor: complete ? "#2ECC71" : theme.accent, width: `${ratio * 100}%` }]} /></View></View>
    </View>
  );
}

function FriendsRankingCard({ loading, error, rows, currentUid, theme, onOpen }) {
  if (loading) return <Skeleton height={154} style={{ borderRadius: 20, backgroundColor: theme.secondary }} />;
  if (error) return <EmptyPanel icon="cloud-offline-outline" text={i18nText("autoI18n.arkadas_siralamasi_yuklenemedi", "Arkadaş sıralaması yüklenemedi")} theme={theme} onPress={onOpen} />;
  if (!rows.length) return <EmptyPanel icon="people-outline" text={i18nText("autoI18n.arkadas_siralamasi_bos", "Arkadaşların oynadığında sıralama burada görünecek.")} theme={theme} onPress={onOpen} />;

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onOpen} style={[styles.panel, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      {rows.map((entry, index) => <View key={entry.uid} style={styles.rankRow}><Text style={[styles.rankNumber, { color: index === 0 ? "#E8B931" : theme.text.muted }]}>#{index + 1}</Text><Image source={getAvatarSource(entry.avatarIndex)} style={styles.rankAvatar} /><View style={styles.rankCopy}><Text style={[styles.rankName, { color: theme.text.primary }]} numberOfLines={1}>{entry.uid === currentUid ? i18nText("autoI18n.sen", "Sen") : entry.displayName || i18nText("autoI18n.anonim_oyuncu", "Anonim Oyuncu")}</Text><Text style={[styles.rankMeta, { color: theme.text.muted }]}>{i18nText("autoI18n.sahne_tahmin_oyunu_title", "Sahne Tahmin")}</Text></View><Text style={[styles.rankScore, { color: theme.accent }]}>{Number(entry.bestScore) || 0}</Text></View>)}
    </TouchableOpacity>
  );
}

function AchievementsPreview({ achievements, theme, onOpen }) {
  if (!achievements.length) return <EmptyPanel icon="ribbon-outline" text={i18nText("autoI18n.ilk_basari_bekliyor", "İlk başarımın seni bekliyor. Bir oyun tamamlayarak başla.")} theme={theme} onPress={onOpen} />;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onOpen} style={[styles.achievementCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      {achievements.slice(-2).map((achievement) => <View key={achievement.id} style={styles.achievementItem}><View style={styles.achievementIcon}><AppIcon family="Ionicons" name={achievement.icon} size={21} color="#C084FC" /></View><View style={styles.achievementCopy}><Text style={[styles.achievementTitle, { color: theme.text.primary }]}>{i18nText(achievement.titleKey, achievement.id)}</Text><Text style={[styles.achievementText, { color: theme.text.muted }]}>{i18nText(achievement.descriptionKey, "")}</Text></View><AppIcon family="Ionicons" name="checkmark-circle" size={19} color="#2ECC71" /></View>)}
    </TouchableOpacity>
  );
}

function EmptyPanel({ icon, text, theme, onPress }) {
  return <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.emptyPanel, { backgroundColor: theme.secondary, borderColor: theme.border }]}><AppIcon family="Ionicons" name={icon} size={27} color={theme.text.muted} /><Text style={[styles.emptyText, { color: theme.text.muted }]}>{text}</Text><AppIcon family="Ionicons" name="chevron-forward" size={17} color={theme.text.muted} /></TouchableOpacity>;
}

function SectionHeader({ title, theme, action, onAction }) {
  return <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.text.muted }]}>{title}</Text>{action ? <TouchableOpacity hitSlop={9} onPress={onAction}><Text style={[styles.sectionAction, { color: theme.accent }]}>{action}</Text></TouchableOpacity> : null}</View>;
}

function GameHubSkeleton({ theme }) {
  return <View style={styles.skeletonWrap}><Skeleton height={224} style={[styles.skeleton, { backgroundColor: theme.secondary }]} /><Skeleton height={96} style={[styles.skeleton, { backgroundColor: theme.secondary }]} /><Skeleton height={88} style={[styles.skeleton, { backgroundColor: theme.secondary }]} /><Skeleton height={156} style={[styles.skeleton, { backgroundColor: theme.secondary }]} /></View>;
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
  return i18nText("autoI18n.gun_once_oynandi", `${elapsedDays} gün önce`, { count: elapsedDays });
}

const styles = StyleSheet.create({
  levelPill: { minHeight: 36, borderRadius: 12, borderWidth: 1, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 5 },
  levelPillText: { fontSize: 10, fontWeight: "850" },
  settingsButton: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dailyHero: { minHeight: 224, borderRadius: 24, padding: 18, overflow: "hidden" },
  dailyArtwork: { position: "absolute", right: -4, top: 38, transform: [{ rotate: "-8deg" }] },
  dailyTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dailyIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  dailyStatusBadge: { borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 9, paddingVertical: 5 },
  dailyStatusText: { color: "#fff", fontSize: 9, fontWeight: "850" },
  dailyEyebrow: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginTop: 18 },
  dailyTitle: { color: "#fff", fontSize: 21, lineHeight: 26, fontWeight: "900", maxWidth: "82%", marginTop: 4 },
  dailyFooter: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: "auto", paddingTop: 17 },
  dailyMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  dailyMetaText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  dailyAction: { marginLeft: "auto", height: 36, borderRadius: 12, backgroundColor: "#fff", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 5 },
  dailyActionText: { fontSize: 10, fontWeight: "900" },
  welcomeCard: { minHeight: 96, borderRadius: 19, borderWidth: 1, padding: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  welcomeIcon: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  welcomeCopy: { flex: 1 },
  welcomeTitle: { fontSize: 13, fontWeight: "850" },
  welcomeText: { fontSize: 10, lineHeight: 14, fontWeight: "650", marginTop: 3 },
  welcomeButton: { width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  sectionHeader: { minHeight: 34, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 7, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  sectionAction: { fontSize: 10, fontWeight: "850" },
  gameList: { gap: 9 },
  gameCard: { minHeight: 92, borderRadius: 19, borderWidth: 1, padding: 11, flexDirection: "row", alignItems: "center", gap: 12 },
  gameArtwork: { width: 64, height: 68, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  gameCopy: { flex: 1 },
  gameTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  gameTitle: { fontSize: 14, fontWeight: "900" },
  gameDescription: { fontSize: 10, fontWeight: "650", marginTop: 4 },
  gameMetaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 7 },
  gameMeta: { fontSize: 9, fontWeight: "750" },
  metaDot: { width: 3, height: 3, borderRadius: 2 },
  lockBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 3 },
  lockText: { fontSize: 7, fontWeight: "800" },
  panel: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 13 },
  taskRow: { minHeight: 69, flexDirection: "row", alignItems: "center", gap: 11 },
  taskState: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  taskCopy: { flex: 1 },
  taskTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  taskTitle: { fontSize: 11, fontWeight: "800" },
  taskCount: { fontSize: 9, fontWeight: "750" },
  progressTrack: { height: 5, borderRadius: 3, overflow: "hidden", marginTop: 7 },
  progressFill: { height: "100%", borderRadius: 3 },
  rankRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 9 },
  rankNumber: { width: 25, fontSize: 12, fontWeight: "900" },
  rankAvatar: { width: 35, height: 35, borderRadius: 18 },
  rankCopy: { flex: 1 },
  rankName: { fontSize: 11, fontWeight: "850" },
  rankMeta: { fontSize: 8, fontWeight: "650", marginTop: 2 },
  rankScore: { fontSize: 14, fontWeight: "900" },
  achievementCard: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 13 },
  achievementItem: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11 },
  achievementIcon: { width: 41, height: 41, borderRadius: 13, backgroundColor: "rgba(192,132,252,0.15)", alignItems: "center", justifyContent: "center" },
  achievementCopy: { flex: 1 },
  achievementTitle: { fontSize: 11, fontWeight: "850" },
  achievementText: { fontSize: 9, fontWeight: "650", marginTop: 3 },
  emptyPanel: { minHeight: 86, borderRadius: 20, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 11 },
  emptyText: { flex: 1, fontSize: 10, lineHeight: 15, fontWeight: "650" },
  skeletonWrap: { gap: 12 },
  skeleton: { borderRadius: 22 },
});
