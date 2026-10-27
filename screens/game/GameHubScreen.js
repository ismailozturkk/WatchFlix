// screens/game/GameHubScreen.js
//
// Oyun Merkezi = oyuncunun İLERLEME ekranı. Yukarıdan aşağıya: oyuncu kartı →
// dört temel sayı → arkadaş sıralaması → başarımlar (tam liste) → mod rekorları.
//
// SADELEŞTİRME (23 Eki): eskiden bu bilgi üç ekrana dağılmıştı (Oyun Merkezi →
// Oyuncu Profili → Başarımlar) ve Oyun Merkezi, Eğlence sekmesindeki günlük kartı
// ve oyun kartlarını bir kez daha gösteriyordu. Oynamak Eğlence'den (kurulum alt
// sayfası), ilerlemeye bakmak buradan; tek ayrı ekran Liderlik Tablosu.
//
// TÜM OYUNLAR (27 Eki): eskiden sayılar, arkadaş sıralaması ve rekorlar yalnız
// Sahne Tahmin'i (ve Poster Bulmaca modlarını) görüyordu; hızlı oyunlar hiç yoktu.
// Şimdi arkadaş sıralaması GENEL sıralamadan (utils/gameBoards — oyun başına sıra
// puanı), "Toplam Oyun" ve "Doğruluk" hızlı oyunları da sayar, "Rekorlar" her
// hızlı oyunun cihaz-yerel rekorunu da listeler. Seviye/XP ve başarımlar Sahne
// Tahmin + Poster Bulmaca'ya ait kalır (hızlı oyunlar XP vermez).

import UserAvatar from "@components/common/UserAvatar";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AppIcon from "@components/AppIcon";
import AppBadge from "@components/badges/AppBadge";
import GlassBox from "@components/common/GlassBox";
import GlassIconButton from "@components/common/GlassIconButton";
import Skeleton from "@components/Skeleton";
import PlayerStrip from "@components/game/PlayerStrip";
import { MiniProgress, PressableScale, SectionHeader } from "@components/game/ui";
import { useAuth } from "@context/AuthContext";
import { useFriends } from "@context/FriendsContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useGameStats from "@hooks/useGameStats";
import usePremiumScreenGuard from "@hooks/usePremiumScreenGuard";
import { fetchOverallBoard } from "@services/gameLeaderboards";
import { Keys, useStored } from "@services/storage";
import { rarityStyle } from "@theme/badgeTokens";
import { pickByLanguage } from "@utils/appLanguages";
import { i18nText } from "@utils/i18nText";
import { OLDER_BOARD_GAME, OVERALL_BOARD } from "@utils/gameBoards";
import { normalizeOlderStats } from "@utils/olderGame";
import { QUICK_GAME_IDS, normalizeQuickStats } from "@utils/quickGames";
import { alpha } from "../../theme/colors";
import { GameScreenShell } from "./GameScreenShell";
import { buildSceneGameProgress, SCENE_ACHIEVEMENTS } from "./gameRegistry";
import {
  getDifficultyConfig,
  getLocalizedGameLabel,
  getModeConfig,
  parseModeScoreKey,
  POSTER_GAME_ID,
} from "./gameConfig";
import { getBoardGameTitle, getGameTitle } from "./gameLabels";
import GlassTouchable from "../../components/common/GlassTouchable";

const RANK_COLORS = ["#FFC83D", "#C4CAD4", "#D98C4A"];

export default function GameHubScreen({ navigation }) {
  // Oyunlar Premium'da: Eğlence'deki şerit kilitliyken buraya gelinmez; başka
  // yoldan gelinirse yükseltme sayfası açılır ve ekran geri sarılır.
  usePremiumScreenGuard("games", navigation);
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { friends = [] } = useFriends() || {};
  const { ready, stats } = useGameStats();
  const [board, setBoard] = useState({ loading: true, error: false, rows: [] });
  const uid = user?.uid || null;
  const olderRaw = useStored(Keys.olderGame, { uid });
  const quickRaw = useStored(Keys.quickGames, { uid });

  // Hızlı oyunların cihaz-yerel kayıtları ("Önce hangisi?" ayrı anahtarda), oyun sırasıyla.
  const quickRecords = useMemo(() => {
    const all = normalizeQuickStats(quickRaw);
    return [
      { gameId: OLDER_BOARD_GAME, ...normalizeOlderStats(olderRaw) },
      ...QUICK_GAME_IDS.map((gameId) => ({ gameId, ...normalizeOlderStats(all[gameId]) })),
    ];
  }, [olderRaw, quickRaw]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // Genel tablo kısa süre önbellekte (services/gameLeaderboards): odakta yeniden okumak ucuz.
      fetchOverallBoard()
        .then(({ rows }) => active && setBoard({ loading: false, error: false, rows }))
        .catch(() => active && setBoard({ loading: false, error: true, rows: [] }));
      return () => {
        active = false;
      };
    }, []),
  );

  const progress = useMemo(() => buildSceneGameProgress(stats), [stats]);
  // Toplam oyun ve doğruluk: sahne oyunları + hızlı oyunlar.
  const totals = useMemo(() => {
    const quickPlays = quickRecords.reduce((sum, record) => sum + record.plays, 0);
    const quickCorrect = quickRecords.reduce((sum, record) => sum + record.correct, 0);
    const quickAnswered = quickRecords.reduce((sum, record) => sum + record.answered, 0);
    const correct = (Number(stats?.totalCorrect) || 0) + quickCorrect;
    const answered = correct + (Number(stats?.totalWrong) || 0) + (quickAnswered - quickCorrect);
    return {
      played: progress.totalPlayed + quickPlays,
      accuracy: answered ? Math.round((correct / answered) * 100) : 0,
    };
  }, [progress.totalPlayed, quickRecords, stats?.totalCorrect, stats?.totalWrong]);

  // Genel satırlar servisten sıralı gelir; arkadaşlar + ben süzülür.
  const friendRows = useMemo(() => {
    const uids = new Set(friends.map((friend) => friend.friendUid || friend.id));
    if (user?.uid) uids.add(user.uid);
    return board.rows.filter((entry) => uids.has(entry.uid)).slice(0, 3);
  }, [friends, board.rows, user?.uid]);

  // Katalog sırası korunur (aynı sayaç ailesi bitişik bir merdiven olarak okunur).
  const achievements = useMemo(() => {
    const items = SCENE_ACHIEVEMENTS.map((achievement) => {
      const value = Math.max(0, Math.min(achievement.getProgress(stats), achievement.target));
      return {
        ...achievement,
        value,
        ratio: achievement.target ? value / achievement.target : 0,
        unlocked: achievement.isUnlocked(stats),
      };
    });
    return { items, unlockedCount: items.filter((item) => item.unlocked).length };
  }, [stats]);

  const modeBests = useMemo(() => {
    const byMode = stats?.bestScoresByMode;
    // Hızlı oyun rekorları (cihaz-yerel): oyun adıyla, sahne modlarının ardından.
    const quick = quickRecords
      .filter((record) => record.best > 0)
      .map((record) => ({ key: `quick_${record.gameId}`, score: record.best, label: getBoardGameTitle(record.gameId, language) }))
      .sort((a, b) => b.score - a.score);
    if (!byMode || typeof byMode !== "object") return quick;
    const scene = Object.entries(byMode)
      .map(([key, score]) => {
        const { gameId, modeId, difficultyId } = parseModeScoreKey(key);
        const base = `${getLocalizedGameLabel(getModeConfig(modeId), language)} · ${getLocalizedGameLabel(getDifficultyConfig(difficultyId), language)}`;
        return {
          key,
          score: Number(score) || 0,
          // Afiş rekorları Klasik ile karışmasın: oyun adı öne konur.
          label: gameId === POSTER_GAME_ID ? `${getGameTitle(POSTER_GAME_ID)} · ${base}` : base,
        };
      })
      .sort((a, b) => b.score - a.score);
    return [...scene, ...quick];
  }, [stats?.bestScoresByMode, language, quickRecords]);

  // Liderlik Genel sıralamayla açılır (oyun seçici orada).
  const openLeaderboard = (scope) =>
    navigation.navigate("GameLeaderboardScreen", { gameId: OVERALL_BOARD, scope });

  const headerRight = (
    <GlassIconButton
      icon="trophy-outline"
      iconSize={18}
      size={38}
      fallbackRadius={12}
      color={theme.text.primary}
      accessibilityLabel={i18nText("autoI18n.liderlik_tablosu", "Liderlik Tablosu")}
      onPress={() => openLeaderboard("global")}
    />
  );

  const metrics = [
    { label: i18nText("autoI18n.en_iyi_skor", "En İyi Skor"), value: progress.bestClassicScore, color: "#E8B931" },
    { label: i18nText("autoI18n.dogruluk", "Doğruluk"), value: `${totals.accuracy}%`, color: "#38BDF8" },
    { label: i18nText("autoI18n.en_iyi_seri", "En İyi Seri"), value: Number(stats?.bestStreak) || 0, color: "#FF7A59" },
    { label: i18nText("autoI18n.toplam_oyun", "Toplam Oyun"), value: totals.played, color: theme.accent },
  ];

  return (
    <GameScreenShell
      navigation={navigation}
      title={i18nText("autoI18n.oyun_merkezi", "Oyun Merkezi")}
      subtitle={i18nText("autoI18n.oyun_merkezi_aciklama", "Oyunların ve ilerlemen")}
      headerRight={headerRight}
    >
      {!ready ? (
        <HubSkeleton theme={theme} />
      ) : (
        <>
          <PlayerStrip progress={progress} theme={theme} user={user} />

          <View style={styles.metricGrid}>
            {metrics.map((metric) => (
              <GlassBox role="card" key={metric.label} style={[styles.metric, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <Text style={[styles.metricValue, { color: metric.color }]} allowFontScaling={false}>
                  {metric.value}
                </Text>
                <Text style={[styles.metricLabel, { color: theme.text.muted }]} numberOfLines={1} allowFontScaling={false}>
                  {metric.label}
                </Text>
              </GlassBox>
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
            action={`${achievements.unlockedCount}/${achievements.items.length}`}
            theme={theme}
          />
          <GlassBox role="card" style={[styles.panel, styles.achievementPanel, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            {achievements.items.map((item) => (
              <AchievementRow key={item.id} item={item} theme={theme} />
            ))}
          </GlassBox>

          {modeBests.length > 0 ? (
            <>
              <SectionHeader
                title={pickByLanguage(language, { tr: "Rekorlar", en: "Records", es: "Récords", pt: "Recordes", de: "Rekorde" })}
                theme={theme}
              />
              <GlassBox role="card" style={[styles.panel, styles.recordPanel, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                {modeBests.map((mode, index) => (
                  <View
                    key={mode.key}
                    style={[
                      styles.recordRow,
                      index !== modeBests.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
                    ]}
                  >
                    <AppIcon family="Ionicons" name="medal-outline" size={17} color={theme.accent} />
                    <Text style={[styles.recordLabel, { color: theme.text.primary }]} numberOfLines={1} allowFontScaling={false}>
                      {mode.label}
                    </Text>
                    <Text style={[styles.recordScore, { color: theme.accent }]} allowFontScaling={false}>
                      {mode.score}
                    </Text>
                  </View>
                ))}
              </GlassBox>
            </>
          ) : null}
        </>
      )}
    </GameScreenShell>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Başarım satırı: rozet + ad/açıklama + (kilitliyse) ilerleme
   ══════════════════════════════════════════════════════════════════════════ */
function AchievementRow({ item, theme }) {
  const title = i18nText(item.titleKey, item.id);
  const color = item.unlocked ? rarityStyle(item.rarity, theme).color : theme.accent;
  return (
    <View style={styles.achievementRow}>
      <AppBadge
        glyph={item.icon}
        glyphSolid={item.iconSolid}
        rarity={item.rarity}
        unlocked={item.unlocked}
        progress={item.ratio}
        size={42}
        accessibilityLabel={title}
      />
      <View style={styles.achievementCopy}>
        <View style={styles.achievementTop}>
          <Text style={[styles.achievementTitle, { color: theme.text.primary }]} numberOfLines={1} allowFontScaling={false}>
            {title}
          </Text>
          {item.unlocked ? (
            <AppIcon family="Ionicons" name="checkmark-circle" size={17} color="#2ECC71" />
          ) : (
            <Text style={[styles.achievementCount, { color: theme.text.muted }]} allowFontScaling={false}>
              {item.value}/{item.target}
            </Text>
          )}
        </View>
        <Text style={[styles.achievementText, { color: theme.text.muted }]} numberOfLines={2} allowFontScaling={false}>
          {i18nText(item.descriptionKey, "")}
        </Text>
        {!item.unlocked && item.target > 1 ? (
          <MiniProgress ratio={item.ratio} color={color} trackColor={theme.primary} height={5} style={styles.achievementBar} />
        ) : null}
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
      <View style={styles.metricGrid}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width="47%" height={74} style={[styles.skeletonMetric, box]} />
        ))}
      </View>
      <Skeleton height={150} style={[styles.skeletonCard, box]} />
      <Skeleton height={220} style={[styles.skeletonCard, box]} />
    </View>
  );
}

const styles = StyleSheet.create({
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { flexBasis: "45%", flexGrow: 1, borderRadius: 18, borderWidth: 1, paddingVertical: 13, paddingHorizontal: 14 },
  metricValue: { fontSize: 22, fontWeight: "900" },
  metricLabel: { fontSize: 10.5, fontWeight: "750", marginTop: 3 },

  panel: { borderRadius: 22, borderWidth: 1, padding: 8 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 14 },
  rankBadge: { width: 26, height: 26, borderRadius: 9, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  rankBadgeText: { fontSize: 12, fontWeight: "900" },
  rankName: { flex: 1, fontSize: 13.5, fontWeight: "850" },
  rankScore: { fontSize: 15, fontWeight: "900" },

  achievementPanel: { padding: 14, gap: 16 },
  achievementRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  achievementCopy: { flex: 1 },
  achievementTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  achievementTitle: { flex: 1, fontSize: 13.5, fontWeight: "850" },
  achievementCount: { fontSize: 10.5, fontWeight: "800" },
  achievementText: { fontSize: 11, lineHeight: 15, fontWeight: "600", marginTop: 2 },
  achievementBar: { marginTop: 7 },

  recordPanel: { paddingVertical: 0, paddingHorizontal: 14 },
  recordRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 11 },
  recordLabel: { flex: 1, fontSize: 13, fontWeight: "750" },
  recordScore: { fontSize: 16, fontWeight: "900" },

  emptyPanel: { minHeight: 64, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  emptyText: { flex: 1, fontSize: 11.5, fontWeight: "650" },

  skeletonWrap: { gap: 12 },
  skeletonCard: { borderRadius: 22 },
  skeletonMetric: { borderRadius: 18 },
});
