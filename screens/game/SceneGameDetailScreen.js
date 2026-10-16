// screens/game/SceneGameDetailScreen.js
//
// Bir oyunun (Sahne Tahmin / Poster Bulmaca) "vitrin" ekranı: ne olduğu, senin
// rekorların, hangi modlarla oynanacağı ve tek dokunuşla Hızlı Oyna. Her iki oyun
// aynı ekranı kullanır; hero, kurallar ve metinler `gameId`'ye göre değişir.

import { intlLocaleOf } from "../../utils/appLanguages";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import GlassCloseButton from "@components/common/GlassCloseButton";
import BottomSheetModal from "@components/common/BottomSheetModal";
import Skeleton from "@components/Skeleton";
import { PressableScale, SectionHeader } from "@components/game/ui";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { loadSceneGamePreferences } from "@services/sceneGamePreferences";
import { loadGameData } from "@services/sceneGameService";
import { i18nText } from "@utils/i18nText";
import { alpha } from "../../theme/colors";
import { GameScreenShell, gameSharedStyles } from "./GameScreenShell";
import {
  DEFAULT_DIFFICULTY_ID,
  DEFAULT_MODE_ID,
  getDifficultyConfig,
  getLocalizedGameLabel,
  getModeConfig,
  isPosterGame,
  SCENE_GAME_ID,
  SCENE_GAME_SOURCES,
  SELECTABLE_GAME_MODES,
} from "./gameConfig";
import usePremiumScreenGuard from "@hooks/usePremiumScreenGuard";
import { getGameTitle, getModeMetaLine } from "./gameLabels";
import { bestScoreForGame, getGameEntry, resolveGameAccentColors } from "./gameRegistry";

// Kurallar oyuna göre: [ikon, çeviri anahtarı].
const SCENE_RULES = [
  { icon: "images-outline", textKey: "autoI18n.kural_sahneyi_incele" },
  { icon: "list-outline", textKey: "autoI18n.kural_dort_secenek" },
  { icon: "timer-outline", textKey: "autoI18n.kural_sure_bonus" },
  { icon: "sparkles-outline", textKey: "autoI18n.kural_joker" },
  { icon: "trophy-outline", textKey: "autoI18n.kural_rekor" },
];
const POSTER_RULES = [
  { icon: "grid-outline", textKey: "autoI18n.kural_afis_orulu" },
  { icon: "eye-outline", textKey: "autoI18n.kural_afis_acilir" },
  { icon: "flash-outline", textKey: "autoI18n.kural_afis_erken_bil" },
  { icon: "sparkles-outline", textKey: "autoI18n.kural_afis_joker" },
];

export default function SceneGameDetailScreen({ navigation, route }) {
  usePremiumScreenGuard("games", navigation);
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const gameId = route.params?.gameId || SCENE_GAME_ID;
  const poster = isPosterGame(gameId);
  const game = getGameEntry(gameId);
  const colors = resolveGameAccentColors(game, theme);

  const [state, setState] = useState({ loading: true, stats: null, preferences: null });
  const [rulesVisible, setRulesVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        user?.uid ? loadGameData(user.uid) : Promise.resolve(null),
        loadSceneGamePreferences(user?.uid),
      ])
        .then(([stats, preferences]) => {
          if (!active) return;
          const fallbackPreferences = stats
            ? {
                modeId: stats.lastModeId || DEFAULT_MODE_ID,
                difficultyId: stats.lastDifficultyId || DEFAULT_DIFFICULTY_ID,
                sourceId: stats.lastSourceId || "popular",
              }
            : null;
          setState({ loading: false, stats, preferences: preferences || fallbackPreferences });
        })
        .catch(() => {
          if (active) setState({ loading: false, stats: null, preferences: null });
        });
      return () => {
        active = false;
      };
    }, [user?.uid]),
  );

  const stats = state.stats;
  const totalQuestions = (Number(stats?.totalCorrect) || 0) + (Number(stats?.totalWrong) || 0);
  const accuracy = totalQuestions ? Math.round(((Number(stats?.totalCorrect) || 0) / totalQuestions) * 100) : 0;
  const hasPlayed = (Number(stats?.totalPlayed) || 0) > 0;
  const bestScore = bestScoreForGame(stats, gameId);

  const lastSource = useMemo(
    () => SCENE_GAME_SOURCES.find((source) => source.id === (state.preferences?.sourceId || stats?.lastSourceId)),
    [state.preferences?.sourceId, stats?.lastSourceId],
  );

  const openSetup = (modeId = DEFAULT_MODE_ID) =>
    navigation.navigate("SceneGameSetupScreen", {
      gameId,
      modeId,
      difficultyId: state.preferences?.difficultyId || DEFAULT_DIFFICULTY_ID,
      sourceId: state.preferences?.sourceId,
    });

  const quickPlay = () => {
    const preferences = state.preferences || {
      modeId: DEFAULT_MODE_ID,
      difficultyId: DEFAULT_DIFFICULTY_ID,
      sourceId: "popular",
    };
    navigation.navigate("SceneGamePlayScreen", {
      gameId,
      modeId: preferences.modeId,
      difficultyId: preferences.difficultyId,
      sourceId: preferences.sourceId,
    });
  };

  const footer = (
    <View style={styles.footerRow}>
      {hasPlayed && state.preferences ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.hizli_oyna", "Hızlı Oyna")}
          onPress={quickPlay}
          style={[styles.quickButton, { backgroundColor: theme.secondary, borderColor: theme.border }]}
        >
          <AppIcon family="Ionicons" name="flash" size={19} color={colors[1]} />
          <View style={styles.quickCopy}>
            <Text style={[styles.quickTitle, { color: theme.text.primary }]} allowFontScaling={false}>
              {i18nText("autoI18n.hizli_oyna", "Hızlı Oyna")}
            </Text>
            <Text style={[styles.quickMeta, { color: theme.text.muted }]} allowFontScaling={false} numberOfLines={1}>
              {formatPreferenceSummary(state.preferences, lastSource, language)}
            </Text>
          </View>
        </PressableScale>
      ) : null}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={i18nText("autoI18n.oyuna_basla", "Oyuna Başla")}
        onPress={() => openSetup()}
        style={[styles.startButton, hasPlayed && state.preferences && styles.startButtonCompact]}
      >
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.startGradient}>
          <AppIcon family="Ionicons" name="play" size={17} color="#fff" />
          <Text style={gameSharedStyles.primaryButtonText} allowFontScaling={false}>
            {i18nText("autoI18n.oyuna_basla", "Oyuna Başla")}
          </Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );

  return (
    <GameScreenShell
      navigation={navigation}
      title={getGameTitle(gameId)}
      subtitle={
        poster
          ? i18nText("autoI18n.poster_detay_alt", "Afişi parça parça tanı")
          : i18nText("autoI18n.sahne_tahmin_detay_alt", "Sahneden filmi veya diziyi bul")
      }
      footer={footer}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View pointerEvents="none" style={styles.heroGlowOne} />
        <View pointerEvents="none" style={styles.heroGlowTwo} />
        <View pointerEvents="none" style={styles.heroArtwork}>
          <AppIcon family="Ionicons" name={poster ? "grid" : "film"} size={130} color="rgba(255,255,255,0.13)" />
        </View>

        <View style={styles.heroBadge}>
          <AppIcon family="Ionicons" name={game.icon.name} size={13} color="#FFD76A" />
          <Text style={styles.heroBadgeText} allowFontScaling={false}>
            {getGameTitle(gameId).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.heroTitle} allowFontScaling={false}>
          {poster
            ? i18nText("autoI18n.poster_hero_baslik", "Afişi örten karolar açılırken tanı")
            : i18nText("autoI18n.sinema_bilgini_test_et", "Sinema bilgini sahnelerle test et")}
        </Text>
        <Text style={styles.heroText} allowFontScaling={false}>
          {poster
            ? i18nText("autoI18n.poster_hero_aciklama", "Ne kadar erken bilirsen o kadar çok puan. Jokerlerle şıkları ele.")
            : i18nText("autoI18n.sahne_tahmin_detay_aciklama", "Doğru yapımı seçenekler arasından bul, hızlı cevaplarla skorunu ve serini geliştir.")}
        </Text>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.kurallari_gor", "Kuralları gör")}
          onPress={() => setRulesVisible(true)}
          style={styles.rulesButton}
        >
          <AppIcon family="Ionicons" name="information-circle-outline" size={16} color="#fff" />
          <Text style={styles.rulesButtonText} allowFontScaling={false}>
            {i18nText("autoI18n.nasil_oynanir", "Nasıl Oynanır?")}
          </Text>
        </TouchableOpacity>
      </LinearGradient>

      {state.loading ? (
        <DetailSkeleton theme={theme} />
      ) : (
        <>
          <View style={gameSharedStyles.metricRow}>
            <Metric label={i18nText("autoI18n.en_iyi_skor", "En İyi Skor")} value={bestScore} color="#FFC83D" theme={theme} />
            <Metric label={i18nText("autoI18n.dogruluk", "Doğruluk")} value={`${accuracy}%`} color="#38BDF8" theme={theme} />
            <Metric label={i18nText("autoI18n.en_iyi_seri", "En İyi Seri")} value={stats?.bestStreak || 0} color="#FF7A59" theme={theme} />
          </View>

          <SectionHeader title={i18nText("autoI18n.oyun_modlari", "Oyun Modları")} theme={theme} style={styles.sectionTight} />
          <View style={styles.modeList}>
            {SELECTABLE_GAME_MODES.map((mode) => (
              <ModeCard
                key={mode.id}
                mode={mode}
                accent={colors[1]}
                language={language}
                theme={theme}
                onPress={() => openSetup(mode.id)}
              />
            ))}
          </View>

          {!poster ? (
            <PressableScale
              accessibilityRole="button"
              onPress={() => navigation.navigate("GameLeaderboardScreen", { gameId })}
              style={[styles.leaderboardCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}
            >
              <View style={styles.leaderboardIcon}>
                <AppIcon family="Ionicons" name="trophy" size={22} color="#FFC83D" />
              </View>
              <View style={styles.leaderboardCopy}>
                <Text style={[styles.leaderboardTitle, { color: theme.text.primary }]} allowFontScaling={false}>
                  {i18nText("autoI18n.liderlik_tablosu", "Liderlik Tablosu")}
                </Text>
                <Text style={[styles.leaderboardText, { color: theme.text.muted }]} allowFontScaling={false}>
                  {i18nText("autoI18n.skorunu_karsilastir", "Skorunu diğer oyuncularla karşılaştır")}
                </Text>
              </View>
              <AppIcon family="Ionicons" name="chevron-forward" size={18} color={theme.text.muted} />
            </PressableScale>
          ) : null}

          {hasPlayed ? (
            <>
              <SectionHeader title={i18nText("autoI18n.son_oyun", "Son Oyun")} theme={theme} style={styles.sectionTight} />
              <LastGameCard stats={stats} language={language} theme={theme} />
            </>
          ) : null}
        </>
      )}

      <RulesSheet
        visible={rulesVisible}
        onClose={() => setRulesVisible(false)}
        theme={theme}
        rules={poster ? POSTER_RULES : SCENE_RULES}
        title={getGameTitle(gameId)}
        accent={colors[1]}
      />
    </GameScreenShell>
  );
}

function Metric({ label, value, color, theme }) {
  return (
    <View style={[gameSharedStyles.metric, styles.metricCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <Text style={[styles.metricValue, { color }]} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={[styles.metricLabel, { color: theme.text.muted }]} numberOfLines={1} allowFontScaling={false}>
        {label}
      </Text>
    </View>
  );
}

function ModeCard({ mode, accent, language, theme, onPress }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={getLocalizedGameLabel(mode, language)}
      onPress={onPress}
      scaleTo={0.985}
      style={[styles.modeCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.modeIcon, { backgroundColor: alpha(accent, 0.16) }]}>
        <AppIcon family="Ionicons" name={mode.icon} size={22} color={accent} />
      </View>
      <View style={styles.modeCopy}>
        <Text style={[styles.modeTitle, { color: theme.text.primary }]} allowFontScaling={false}>
          {i18nText(mode.titleKey, getLocalizedGameLabel(mode, language))}
        </Text>
        <Text style={[styles.modeDescription, { color: theme.text.muted }]} allowFontScaling={false} numberOfLines={2}>
          {i18nText(mode.ruleKey, "")}
        </Text>
        <Text style={[styles.modeMeta, { color: accent }]} allowFontScaling={false}>
          {getModeMetaLine(mode, language)}
        </Text>
      </View>
      <AppIcon family="Ionicons" name="chevron-forward" size={18} color={theme.text.muted} />
    </PressableScale>
  );
}

function LastGameCard({ stats, language, theme }) {
  const mode = getModeConfig(stats?.lastModeId);
  const difficulty = getDifficultyConfig(stats?.lastDifficultyId);
  const source = SCENE_GAME_SOURCES.find((item) => item.id === stats?.lastSourceId);
  return (
    <View style={[styles.lastGameCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={styles.lastGameTop}>
        <View>
          <Text style={[styles.lastGameDate, { color: theme.text.muted }]} allowFontScaling={false}>
            {formatLastPlayed(stats?.lastPlayedAt, language)}
          </Text>
          <Text style={[styles.lastGameMode, { color: theme.text.primary }]} allowFontScaling={false}>
            {getLocalizedGameLabel(mode, language)}
          </Text>
        </View>
        <View style={[styles.lastScoreBadge, { backgroundColor: alpha(theme.accent, 0.14) }]}>
          <Text style={[styles.lastScoreValue, { color: theme.accent }]} allowFontScaling={false}>
            {Number(stats?.score) || 0}
          </Text>
          <Text style={[styles.lastScoreLabel, { color: theme.text.muted }]} allowFontScaling={false}>
            {i18nText("autoI18n.son_skor", "Son skor")}
          </Text>
        </View>
      </View>
      <View style={[styles.lastGameDivider, { backgroundColor: theme.border }]} />
      <View style={styles.lastGameMeta}>
        <View style={styles.lastMetaItem}>
          <AppIcon family="Ionicons" name="albums-outline" size={14} color={theme.text.muted} />
          <Text style={[styles.lastMetaText, { color: theme.text.secondary }]} allowFontScaling={false}>
            {source ? getLocalizedGameLabel(source, language) : i18nText("autoI18n.populer", "Popüler")}
          </Text>
        </View>
        <View style={styles.lastMetaItem}>
          <AppIcon family="Ionicons" name="speedometer-outline" size={14} color={theme.text.muted} />
          <Text style={[styles.lastMetaText, { color: theme.text.secondary }]} allowFontScaling={false}>
            {getLocalizedGameLabel(difficulty, language)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function RulesSheet({ visible, onClose, theme, rules, title, accent }) {
  return (
    <BottomSheetModal visible={visible} onClose={onClose} intensity={35} dimColor="rgba(0,0,0,0.42)">
      <SafeAreaView edges={["bottom"]} style={[styles.rulesSheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
        <View style={styles.sheetHeader}>
          <View>
            <Text style={[styles.sheetTitle, { color: theme.text.primary }]} allowFontScaling={false}>
              {i18nText("autoI18n.nasil_oynanir", "Nasıl Oynanır?")}
            </Text>
            <Text style={[styles.sheetSubtitle, { color: theme.text.muted }]} allowFontScaling={false}>
              {title}
            </Text>
          </View>
          <GlassCloseButton
            size={36}
            fallbackRadius={12}
            iconSize={20}
            color={theme.text.primary}
            onPress={onClose}
          />
        </View>
        <View style={styles.rulesList}>
          {rules.map((rule, index) => (
            <View key={rule.textKey} style={styles.ruleRow}>
              <View style={[styles.ruleNumber, { backgroundColor: alpha(accent, 0.16) }]}>
                <Text style={[styles.ruleNumberText, { color: accent }]} allowFontScaling={false}>
                  {index + 1}
                </Text>
              </View>
              <AppIcon family="Ionicons" name={rule.icon} size={18} color={theme.text.secondary} />
              <Text style={[styles.ruleText, { color: theme.text.secondary }]} allowFontScaling={false}>
                {i18nText(rule.textKey, "")}
              </Text>
            </View>
          ))}
        </View>
        <TouchableOpacity onPress={onClose} style={[gameSharedStyles.primaryButton, { backgroundColor: accent }]}>
          <Text style={gameSharedStyles.primaryButtonText} allowFontScaling={false}>
            {i18nText("autoI18n.anladim", "Anladım")}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </BottomSheetModal>
  );
}

function DetailSkeleton({ theme }) {
  const box = { backgroundColor: theme.secondary };
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonMetrics}>
        <Skeleton width="31.5%" height={82} style={[styles.skeletonMetric, box]} />
        <Skeleton width="31.5%" height={82} style={[styles.skeletonMetric, box]} />
        <Skeleton width="31.5%" height={82} style={[styles.skeletonMetric, box]} />
      </View>
      <Skeleton height={104} style={[styles.skeletonBlock, box]} />
      <Skeleton height={104} style={[styles.skeletonBlock, box]} />
    </View>
  );
}

function formatPreferenceSummary(preferences, source, language) {
  const sourceLabel = source ? getLocalizedGameLabel(source, language) : i18nText("autoI18n.populer", "Popüler");
  const mode = getModeConfig(preferences?.modeId || DEFAULT_MODE_ID);
  const difficulty = getDifficultyConfig(preferences?.difficultyId || DEFAULT_DIFFICULTY_ID);
  return `${getLocalizedGameLabel(mode, language)} · ${getLocalizedGameLabel(difficulty, language)} · ${sourceLabel}`;
}

function formatLastPlayed(value, language) {
  if (!value) return i18nText("autoI18n.son_oynanma", "Son oynama");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return i18nText("autoI18n.son_oynanma", "Son oynama");
  return new Intl.DateTimeFormat(intlLocaleOf(language), { day: "numeric", month: "short", year: "numeric" }).format(date);
}

const styles = StyleSheet.create({
  hero: { minHeight: 232, borderRadius: 26, padding: 18, overflow: "hidden", justifyContent: "space-between" },
  heroGlowOne: { position: "absolute", width: 200, height: 200, borderRadius: 100, right: -60, top: -80, backgroundColor: "rgba(255,255,255,0.12)" },
  heroGlowTwo: { position: "absolute", width: 120, height: 120, borderRadius: 60, left: -44, bottom: -40, backgroundColor: "rgba(0,0,0,0.12)" },
  heroArtwork: { position: "absolute", right: -10, top: 36, transform: [{ rotate: "-8deg" }] },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  heroBadgeText: { color: "#fff", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.9 },
  heroTitle: { color: "#fff", fontSize: 23, lineHeight: 29, fontWeight: "900", maxWidth: "80%", marginTop: 12 },
  heroText: { color: "rgba(255,255,255,0.88)", fontSize: 12, lineHeight: 17, fontWeight: "650", maxWidth: "88%", marginTop: 6 },
  rulesButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: 11,
    backgroundColor: "rgba(0,0,0,0.24)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  rulesButtonText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  metricCard: { flex: 1, borderRadius: 18, borderWidth: 1, paddingVertical: 13, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  metricValue: { fontSize: 21, fontWeight: "900" },
  metricLabel: { fontSize: 10, fontWeight: "750", marginTop: 3 },

  sectionTight: { marginTop: 6, marginBottom: 2 },
  modeList: { gap: 10 },
  modeCard: { minHeight: 96, borderRadius: 20, borderWidth: 1, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  modeIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  modeCopy: { flex: 1 },
  modeTitle: { fontSize: 14.5, fontWeight: "900" },
  modeDescription: { fontSize: 10.5, lineHeight: 15, fontWeight: "600", marginTop: 3 },
  modeMeta: { fontSize: 9.5, fontWeight: "800", marginTop: 5 },

  lastGameCard: { borderRadius: 20, borderWidth: 1, padding: 14 },
  lastGameTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lastGameDate: { fontSize: 9.5, fontWeight: "700" },
  lastGameMode: { fontSize: 14.5, fontWeight: "900", marginTop: 2 },
  lastScoreBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center" },
  lastScoreValue: { fontSize: 18, fontWeight: "900" },
  lastScoreLabel: { fontSize: 8, fontWeight: "750", marginTop: 1 },
  lastGameDivider: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  lastGameMeta: { flexDirection: "row", gap: 16 },
  lastMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  lastMetaText: { fontSize: 10, fontWeight: "700" },

  leaderboardCard: { minHeight: 76, borderRadius: 20, borderWidth: 1, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  leaderboardIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,200,61,0.14)", alignItems: "center", justifyContent: "center" },
  leaderboardCopy: { flex: 1 },
  leaderboardTitle: { fontSize: 13.5, fontWeight: "850" },
  leaderboardText: { fontSize: 10, fontWeight: "650", marginTop: 2 },

  footerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  quickButton: { flex: 1, minHeight: 54, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  quickCopy: { flex: 1 },
  quickTitle: { fontSize: 12.5, fontWeight: "850" },
  quickMeta: { fontSize: 9, fontWeight: "650", marginTop: 2 },
  startButton: { flex: 1, borderRadius: 16, overflow: "hidden" },
  startButtonCompact: { flex: 0.85 },
  startGradient: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14 },

  rulesSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 16 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 19, fontWeight: "900" },
  sheetSubtitle: { fontSize: 10.5, fontWeight: "650", marginTop: 2 },
  rulesList: { marginVertical: 14, gap: 10 },
  ruleRow: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 10 },
  ruleNumber: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  ruleNumberText: { fontSize: 10.5, fontWeight: "900" },
  ruleText: { flex: 1, fontSize: 10.5, lineHeight: 15, fontWeight: "650" },

  skeletonWrap: { gap: 12 },
  skeletonMetrics: { flexDirection: "row", justifyContent: "space-between" },
  skeletonMetric: { borderRadius: 16 },
  skeletonBlock: { borderRadius: 19 },
});
