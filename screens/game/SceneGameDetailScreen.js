import React, { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import Skeleton from "@components/Skeleton";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { loadSceneGamePreferences } from "@services/sceneGamePreferences";
import { loadGameData } from "@services/sceneGameService";
import { i18nText } from "@utils/i18nText";
import { GameScreenShell, gameSharedStyles } from "./GameScreenShell";
import {
  DEFAULT_DIFFICULTY_ID,
  DEFAULT_MODE_ID,
  getDifficultyConfig,
  getLocalizedGameLabel,
  getModeConfig,
  SCENE_GAME_ID,
  SCENE_GAME_SOURCES,
} from "./gameConfig";

const MODE_CARDS = [
  {
    id: "classic",
    icon: "albums-outline",
    titleKey: "autoI18n.klasik_mod",
    descriptionKey: "autoI18n.klasik_mod_detay",
    metaKey: "autoI18n.klasik_mod_meta",
    available: getModeConfig("classic").available,
  },
  {
    id: "time_attack",
    icon: "timer-outline",
    titleKey: "autoI18n.zamana_karsi",
    descriptionKey: "autoI18n.zamana_karsi_detay",
    metaKey: "autoI18n.zamana_karsi_meta",
    available: getModeConfig("time_attack").available,
  },
  {
    id: "survival",
    icon: "heart-half-outline",
    titleKey: "autoI18n.hayatta_kalma",
    descriptionKey: "autoI18n.hayatta_kalma_detay",
    metaKey: "autoI18n.hayatta_kalma_meta",
    available: getModeConfig("survival").available,
  },
];

const RULES = [
  { icon: "images-outline", textKey: "autoI18n.kural_sahneyi_incele" },
  { icon: "list-outline", textKey: "autoI18n.kural_dort_secenek" },
  { icon: "timer-outline", textKey: "autoI18n.kural_sure_bonus" },
  { icon: "sparkles-outline", textKey: "autoI18n.kural_joker" },
  { icon: "trophy-outline", textKey: "autoI18n.kural_rekor" },
];

export default function SceneGameDetailScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, stats: null, preferences: null });
  const [rulesVisible, setRulesVisible] = useState(false);
  const gameId = route.params?.gameId || SCENE_GAME_ID;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setState((current) => ({ ...current, loading: true }));

      Promise.all([
        user?.uid ? loadGameData(user.uid) : Promise.resolve(null),
        loadSceneGamePreferences(user?.uid),
      ]).then(([stats, preferences]) => {
        if (!active) return;
        const fallbackPreferences = stats ? {
          modeId: stats.lastModeId || DEFAULT_MODE_ID,
          difficultyId: stats.lastDifficultyId || DEFAULT_DIFFICULTY_ID,
          sourceId: stats.lastSourceId || "popular",
        } : null;
        setState({ loading: false, stats, preferences: preferences || fallbackPreferences });
      }).catch(() => {
        if (active) setState({ loading: false, stats: null, preferences: null });
      });

      return () => { active = false; };
    }, [user?.uid]),
  );

  const totalQuestions = (Number(state.stats?.totalCorrect) || 0) + (Number(state.stats?.totalWrong) || 0);
  const accuracy = totalQuestions
    ? Math.round(((Number(state.stats?.totalCorrect) || 0) / totalQuestions) * 100)
    : 0;
  const hasPlayed = (Number(state.stats?.totalPlayed) || 0) > 0;
  const lastSource = useMemo(
    () => SCENE_GAME_SOURCES.find((source) => source.id === (state.preferences?.sourceId || state.stats?.lastSourceId)),
    [state.preferences?.sourceId, state.stats?.lastSourceId],
  );
  const lastMode = useMemo(
    () => getModeConfig(state.preferences?.modeId || state.stats?.lastModeId || DEFAULT_MODE_ID),
    [state.preferences?.modeId, state.stats?.lastModeId],
  );
  const lastDifficulty = useMemo(
    () => getDifficultyConfig(state.preferences?.difficultyId || state.stats?.lastDifficultyId || DEFAULT_DIFFICULTY_ID),
    [state.preferences?.difficultyId, state.stats?.lastDifficultyId],
  );

  const openSetup = (modeId = DEFAULT_MODE_ID) => navigation.navigate("SceneGameSetupScreen", {
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

  return (
    <GameScreenShell
      navigation={navigation}
      title={i18nText("autoI18n.sahne_tahmin_oyunu_title", "Sahne Tahmin")}
      subtitle={i18nText("autoI18n.sahne_tahmin_detay_alt", "Sahneden filmi veya diziyi bul")}
    >
      <LinearGradient
        colors={[theme.bold || theme.accent, theme.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View pointerEvents="none" style={styles.heroGlowOne} />
        <View pointerEvents="none" style={styles.heroGlowTwo} />
        <View pointerEvents="none" style={styles.heroArtwork}>
          <AppIcon family="Ionicons" name="film" size={120} color="rgba(255,255,255,0.08)" />
        </View>

        <View style={styles.heroBadgePill}>
          <AppIcon family="Ionicons" name="film-outline" size={13} color="#FFD700" />
          <Text style={styles.heroBadgeText} allowFontScaling={false}>
            {i18nText("autoI18n.sahne_tahmin_oyunu_title", "Sahne Tahmin Oyunu").toUpperCase()}
          </Text>
        </View>

        <Text style={styles.heroTitle} allowFontScaling={false}>
          {i18nText("autoI18n.sinema_bilgini_test_et", "Sinema bilgini sahnelerle test et")}
        </Text>
        <Text style={styles.heroText} allowFontScaling={false}>
          {i18nText("autoI18n.sahne_tahmin_detay_aciklama", "Doğru yapımı seçenekler arasından bul, hızlı cevaplarla skorunu ve serini geliştir.")}
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
            <Metric label={i18nText("autoI18n.en_iyi_skor", "En İyi Skor")} value={state.stats?.bestScore || 0} color="#FFD700" theme={theme} />
            <Metric label={i18nText("autoI18n.dogruluk", "Doğruluk")} value={`${accuracy}%`} color="#38BDF8" theme={theme} />
            <Metric label={i18nText("autoI18n.en_iyi_seri", "En İyi Seri")} value={state.stats?.bestStreak || 0} color="#FF6B6B" theme={theme} />
          </View>

          <SectionHeader title={i18nText("autoI18n.son_oyun", "Son Oyun")} theme={theme} />
          <LastGameCard
            stats={state.stats}
            hasPlayed={hasPlayed}
            lastSource={lastSource}
            lastMode={lastMode}
            lastDifficulty={lastDifficulty}
            language={language}
            theme={theme}
            onStart={() => openSetup()}
          />

          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.navigate("GameLeaderboardScreen", { gameId })}
            style={[styles.leaderboardCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          >
            <View style={styles.leaderboardIcon}>
              <AppIcon family="Ionicons" name="trophy" size={22} color="#FFD700" />
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
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.oyuna_basla", "Oyuna Başla")}
            style={[gameSharedStyles.primaryButton, { backgroundColor: theme.accent, marginTop: 12 }]}
            onPress={() => openSetup()}
          >
            <AppIcon family="Ionicons" name="play" size={18} color="#fff" />
            <Text style={gameSharedStyles.primaryButtonText} allowFontScaling={false}>
              {i18nText("autoI18n.oyuna_basla", "Oyuna Başla")}
            </Text>
          </TouchableOpacity>

          {hasPlayed && state.preferences ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.hizli_oyna", "Hızlı Oyna")}
              style={[styles.quickButton, { backgroundColor: theme.secondary, borderColor: theme.border }]}
              onPress={quickPlay}
            >
              <AppIcon family="Ionicons" name="flash" size={18} color={theme.accent} />
              <View style={styles.quickCopy}>
                <Text style={[styles.quickTitle, { color: theme.text.primary }]} allowFontScaling={false}>
                  {i18nText("autoI18n.hizli_oyna", "Hızlı Oyna")}
                </Text>
                <Text style={[styles.quickMeta, { color: theme.text.muted }]} allowFontScaling={false}>
                  {formatPreferenceSummary(state.preferences, lastSource, language)}
                </Text>
              </View>
              <AppIcon family="Ionicons" name="play-circle" size={24} color={theme.accent} />
            </TouchableOpacity>
          ) : null}
        </>
      )}

      <RulesSheet visible={rulesVisible} onClose={() => setRulesVisible(false)} theme={theme} />
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

function SectionHeader({ title, theme }) {
  return (
    <Text style={[styles.sectionTitle, { color: theme.text.muted }]} allowFontScaling={false}>
      {title}
    </Text>
  );
}

function ModeCard({ mode, theme, onPress }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !mode.available }}
      disabled={!mode.available}
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.modeCard,
        { backgroundColor: theme.secondary, borderColor: mode.available ? theme.accent + "55" : theme.border, opacity: mode.available ? 1 : 0.6 },
      ]}
    >
      <View style={[styles.modeIcon, { backgroundColor: mode.available ? `${theme.accent}1F` : theme.primary }]}>
        <AppIcon family="Ionicons" name={mode.icon} size={22} color={mode.available ? theme.accent : theme.text.muted} />
      </View>
      <View style={styles.modeCopy}>
        <View style={styles.modeTitleRow}>
          <Text style={[styles.modeTitle, { color: theme.text.primary }]} allowFontScaling={false}>
            {i18nText(mode.titleKey, mode.id)}
          </Text>
          {!mode.available ? (
            <View style={[styles.soonBadge, { borderColor: theme.border }]}>
              <Text style={[styles.soonText, { color: theme.text.muted }]} allowFontScaling={false}>
                {i18nText("autoI18n.yakinda", "Yakında")}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.modeDescription, { color: theme.text.muted }]} allowFontScaling={false}>
          {i18nText(mode.descriptionKey, "")}
        </Text>
        <Text style={[styles.modeMeta, { color: mode.available ? theme.accent : theme.text.muted }]} allowFontScaling={false}>
          {i18nText(mode.metaKey, "")}
        </Text>
      </View>
      {mode.available ? (
        <AppIcon family="Ionicons" name="chevron-forward" size={18} color={theme.text.muted} />
      ) : (
        <AppIcon family="Ionicons" name="lock-closed-outline" size={16} color={theme.text.muted} />
      )}
    </TouchableOpacity>
  );
}

function LastGameCard({ stats, hasPlayed, lastSource, lastMode, lastDifficulty, language, theme, onStart }) {
  if (!hasPlayed) {
    return (
      <View style={[styles.emptyLastGame, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <View style={[styles.emptyLastIcon, { backgroundColor: `${theme.accent}18` }]}>
          <AppIcon family="Ionicons" name="play-outline" size={22} color={theme.accent} />
        </View>
        <View style={styles.emptyLastCopy}>
          <Text style={[styles.emptyLastTitle, { color: theme.text.primary }]} allowFontScaling={false}>
            {i18nText("autoI18n.henuz_oyun_oynanmadi", "Henüz oyun oynanmadı")}
          </Text>
          <Text style={[styles.emptyLastText, { color: theme.text.muted }]} allowFontScaling={false}>
            {i18nText("autoI18n.ilk_skorunu_olustur", "İlk skorunu oluşturmak için bir oyun başlat.")}
          </Text>
        </View>
        <TouchableOpacity onPress={onStart} style={[styles.emptyLastButton, { backgroundColor: theme.accent }]}>
          <AppIcon family="Ionicons" name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.lastGameCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={styles.lastGameTop}>
        <View>
          <Text style={[styles.lastGameDate, { color: theme.text.muted }]} allowFontScaling={false}>
            {formatLastPlayed(stats?.lastPlayedAt, language)}
          </Text>
          <Text style={[styles.lastGameMode, { color: theme.text.primary }]} allowFontScaling={false}>
            {lastMode ? getLocalizedGameLabel(lastMode, language) : i18nText("autoI18n.klasik_mod", "Klasik Mod")}
          </Text>
        </View>
        <View style={[styles.lastScoreBadge, { backgroundColor: `${theme.accent}18` }]}>
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
            {lastSource ? getLocalizedGameLabel(lastSource, language) : i18nText("autoI18n.populer", "Popüler")}
          </Text>
        </View>
        <View style={styles.lastMetaItem}>
          <AppIcon family="Ionicons" name="speedometer-outline" size={14} color={theme.text.muted} />
          <Text style={[styles.lastMetaText, { color: theme.text.secondary }]} allowFontScaling={false}>
            {lastDifficulty ? getLocalizedGameLabel(lastDifficulty, language) : i18nText("autoI18n.normal", "Normal")}
          </Text>
        </View>
      </View>
    </View>
  );
}

function RulesSheet({ visible, onClose, theme }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityRole="button" accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")} onPress={onClose} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={["bottom"]} style={[styles.rulesSheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.sheetTitle, { color: theme.text.primary }]} allowFontScaling={false}>
                {i18nText("autoI18n.nasil_oynanir", "Nasıl Oynanır?")}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: theme.text.muted }]} allowFontScaling={false}>
                {i18nText("autoI18n.sahne_tahmin_kurallari", "Sahne Tahmin kuralları")}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.primary }]}
            >
              <AppIcon family="Ionicons" name="close" size={20} color={theme.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.rulesList}>
            {RULES.map((rule, index) => (
              <View key={rule.textKey} style={styles.ruleRow}>
                <View style={[styles.ruleNumber, { backgroundColor: `${theme.accent}18` }]}>
                  <Text style={[styles.ruleNumberText, { color: theme.accent }]} allowFontScaling={false}>
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
          <TouchableOpacity onPress={onClose} style={[gameSharedStyles.primaryButton, { backgroundColor: theme.accent }]}>
            <Text style={gameSharedStyles.primaryButtonText} allowFontScaling={false}>
              {i18nText("autoI18n.anladim", "Anladım")}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function DetailSkeleton({ theme }) {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonMetrics}>
        <Skeleton height={82} style={[styles.skeletonMetric, { backgroundColor: theme.secondary }]} />
        <Skeleton height={82} style={[styles.skeletonMetric, { backgroundColor: theme.secondary }]} />
        <Skeleton height={82} style={[styles.skeletonMetric, { backgroundColor: theme.secondary }]} />
      </View>
      <Skeleton height={104} style={[styles.skeletonBlock, { backgroundColor: theme.secondary }]} />
      <Skeleton height={104} style={[styles.skeletonBlock, { backgroundColor: theme.secondary }]} />
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
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 240,
    borderRadius: 24,
    padding: 18,
    overflow: "hidden",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  heroGlowOne: { position: "absolute", width: 190, height: 190, borderRadius: 95, right: -58, top: -72, backgroundColor: "rgba(255,255,255,0.1)" },
  heroGlowTwo: { position: "absolute", width: 110, height: 110, borderRadius: 55, left: -42, bottom: -35, backgroundColor: "rgba(255,255,255,0.07)" },
  heroArtwork: { position: "absolute", right: -8, top: 40, transform: [{ rotate: "-8deg" }] },

  heroBadgePill: {
    alignSelf: "flex-start",
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
  heroBadgeText: { color: "#fff", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.8 },

  heroTitle: { color: "#fff", fontSize: 22, lineHeight: 28, fontWeight: "900", maxWidth: "84%", marginTop: 12 },
  heroText: { color: "rgba(255,255,255,0.85)", fontSize: 11.5, lineHeight: 16, fontWeight: "600", maxWidth: "90%", marginTop: 5 },

  rulesButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 11,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,0,0,0.2)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  rulesButtonText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },

  metricCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: { fontSize: 20, fontWeight: "900" },
  metricLabel: { fontSize: 10, fontWeight: "750", marginTop: 2 },

  sectionTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 14, marginBottom: 8 },

  modeList: { gap: 10 },
  modeCard: { minHeight: 96, borderRadius: 20, borderWidth: 1, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  modeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modeCopy: { flex: 1 },
  modeTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  modeTitle: { fontSize: 14.5, fontWeight: "900" },
  modeDescription: { fontSize: 10.5, lineHeight: 15, fontWeight: "600", marginTop: 3 },
  modeMeta: { fontSize: 9.5, fontWeight: "800", marginTop: 5 },
  soonBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  soonText: { fontSize: 8, fontWeight: "800" },

  emptyLastGame: { minHeight: 90, borderRadius: 20, borderWidth: 1, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  emptyLastIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  emptyLastCopy: { flex: 1 },
  emptyLastTitle: { fontSize: 13, fontWeight: "850" },
  emptyLastText: { fontSize: 10, lineHeight: 14, fontWeight: "650", marginTop: 2 },
  emptyLastButton: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },

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

  leaderboardCard: { minHeight: 76, borderRadius: 20, borderWidth: 1, padding: 13, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  leaderboardIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(232,185,49,0.14)", alignItems: "center", justifyContent: "center" },
  leaderboardCopy: { flex: 1 },
  leaderboardTitle: { fontSize: 13.5, fontWeight: "850" },
  leaderboardText: { fontSize: 10, fontWeight: "650", marginTop: 2 },

  quickButton: { minHeight: 60, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  quickCopy: { flex: 1 },
  quickTitle: { fontSize: 12.5, fontWeight: "850" },
  quickMeta: { fontSize: 9.5, fontWeight: "650", marginTop: 2 },

  modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  rulesSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 16 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 19, fontWeight: "900" },
  sheetSubtitle: { fontSize: 10.5, fontWeight: "650", marginTop: 2 },
  closeButton: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rulesList: { marginVertical: 14, gap: 10 },
  ruleRow: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 10 },
  ruleNumber: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  ruleNumberText: { fontSize: 10.5, fontWeight: "900" },
  ruleText: { flex: 1, fontSize: 10.5, lineHeight: 15, fontWeight: "650" },

  skeletonWrap: { gap: 12 },
  skeletonMetrics: { flexDirection: "row", gap: 10 },
  skeletonMetric: { flex: 1, borderRadius: 16 },
  skeletonBlock: { borderRadius: 19 },
});
