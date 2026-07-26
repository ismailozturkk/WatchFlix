import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { useLanguage } from "@context/LanguageContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import { buildWatchlistPool } from "@services/sceneGameService";
import { loadSceneGamePreferences, saveSceneGamePreferences } from "@services/sceneGamePreferences";
import { i18nText } from "@utils/i18nText";
import { GameScreenShell, gameSharedStyles } from "./GameScreenShell";
import {
  DEFAULT_DIFFICULTY_ID,
  DEFAULT_MODE_ID,
  getLocalizedGameLabel,
  SCENE_GAME_DIFFICULTIES,
  SCENE_GAME_ID,
  SCENE_GAME_MODES,
  SCENE_GAME_SOURCES,
} from "./gameConfig";

/* ── Helpers ────────────────────────────────────────────────────────────── */
const discoverSources = SCENE_GAME_SOURCES.filter((s) => s.group === "discover");
const personalSources = SCENE_GAME_SOURCES.filter((s) => s.group === "personal");

function getModeMetaLine(mode, language) {
  const parts = [];
  if (mode.questionCount) parts.push(`${mode.questionCount} ${i18nText("autoI18n.soru", language === "en" ? "questions" : "soru")}`);
  if (mode.totalSeconds) parts.push(`${mode.totalSeconds} ${i18nText("autoI18n.saniye", language === "en" ? "sec" : "sn")}`);
  if (mode.lives) parts.push(`${mode.lives} ${i18nText("autoI18n.can", language === "en" ? "lives" : "can")}`);
  if (mode.estimatedMinutes) parts.push(`~${mode.estimatedMinutes} ${i18nText("autoI18n.dakika", language === "en" ? "min" : "dk")}`);
  if (mode.leaderboardEligible) parts.push(i18nText("autoI18n.liderlik_uygun", language === "en" ? "Liderlik" : "Liderlik"));
  return parts.join(" · ");
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function SceneGameSetupScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { combinedLists } = useListStatusContext();
  const { user } = useAuth();

  const gameId = route.params?.gameId || SCENE_GAME_ID;

  /* ── Local selection state ──────────────────────────────────────────── */
  const [modeId, setModeId] = useState(route.params?.modeId || DEFAULT_MODE_ID);
  const [difficultyId, setDifficultyId] = useState(route.params?.difficultyId || DEFAULT_DIFFICULTY_ID);
  const [sourceId, setSourceId] = useState(route.params?.sourceId || "popular");

  /* ── Load saved preferences on mount ────────────────────────────────── */
  useEffect(() => {
    const hasRoutePrefs = route.params?.modeId || route.params?.difficultyId || route.params?.sourceId;
    if (hasRoutePrefs) return;
    let active = true;
    loadSceneGamePreferences(user?.uid).then((preferences) => {
      if (!active || !preferences) return;
      setModeId(preferences.modeId || DEFAULT_MODE_ID);
      setDifficultyId(preferences.difficultyId || DEFAULT_DIFFICULTY_ID);
      setSourceId(preferences.sourceId || "popular");
    });
    return () => { active = false; };
  }, [route.params?.modeId, route.params?.difficultyId, route.params?.sourceId, user?.uid]);

  /* ── Personal source content counts ─────────────────────────────────── */
  const counts = useMemo(
    () => Object.fromEntries(
      SCENE_GAME_SOURCES.filter((item) => item.personal).map((item) => [
        item.id,
        buildWatchlistPool(combinedLists?.[item.listKey] || []).length,
      ]),
    ),
    [combinedLists],
  );

  /* ── Derived state ──────────────────────────────────────────────────── */
  const selectedMode = useMemo(() => SCENE_GAME_MODES.find((m) => m.id === modeId) || SCENE_GAME_MODES[0], [modeId]);
  const selectedDifficulty = useMemo(() => SCENE_GAME_DIFFICULTIES.find((d) => d.id === difficultyId) || SCENE_GAME_DIFFICULTIES[1], [difficultyId]);
  const selectedSource = useMemo(() => SCENE_GAME_SOURCES.find((s) => s.id === sourceId) || SCENE_GAME_SOURCES[0], [sourceId]);

  /* ── Start game ─────────────────────────────────────────────────────── */
  const handleStartGame = useCallback(async () => {
    await saveSceneGamePreferences(user?.uid, { modeId, difficultyId, sourceId });
    navigation.navigate("SceneGamePlayScreen", { gameId, modeId, difficultyId, sourceId });
  }, [navigation, gameId, modeId, difficultyId, sourceId, user?.uid]);

  return (
    <GameScreenShell
      navigation={navigation}
      title={i18nText("autoI18n.oyun_kurulumu", "Oyun Kurulumu")}
      subtitle={i18nText("autoI18n.oyun_kurulumu_alt", "Modu, zorluğu ve kaynağı seç")}
    >
      {/* ── 1. Mode Selection ──────────────────────────────────────────── */}
      <SectionHeader icon="game-controller-outline" title={i18nText("autoI18n.oyun_modu", "Oyun Modu")} theme={theme} />
      <View style={styles.modeList}>
        {SCENE_GAME_MODES.map((mode) => (
          <ModeCard
            key={mode.id}
            mode={mode}
            selected={modeId === mode.id}
            language={language}
            theme={theme}
            onPress={() => mode.available && setModeId(mode.id)}
          />
        ))}
      </View>

      {/* ── 2. Difficulty Selection ────────────────────────────────────── */}
      <SectionHeader icon="options-outline" title={i18nText("autoI18n.zorluk", "Zorluk")} theme={theme} />
      <View style={styles.difficultyRow}>
        {SCENE_GAME_DIFFICULTIES.map((diff) => (
          <DifficultyChip
            key={diff.id}
            diff={diff}
            selected={difficultyId === diff.id}
            language={language}
            theme={theme}
            onPress={() => setDifficultyId(diff.id)}
          />
        ))}
      </View>

      {/* ── 3. Content Source ──────────────────────────────────────────── */}
      <SectionHeader icon="compass-outline" title={i18nText("autoI18n.kesfet", "Keşfet")} theme={theme} />
      <View style={styles.sourceGrid}>
        {discoverSources.map((item) => (
          <SourceCard
            key={item.id}
            item={item}
            selected={sourceId === item.id}
            language={language}
            theme={theme}
            onPress={() => setSourceId(item.id)}
          />
        ))}
      </View>

      <SectionHeader icon="person-outline" title={i18nText("autoI18n.sana_ozel", "Sana Özel")} theme={theme} />
      <View style={styles.sourceGrid}>
        {personalSources.map((item) => {
          const count = counts[item.id] ?? 0;
          const disabled = count < 4;
          return (
            <SourceCard
              key={item.id}
              item={item}
              count={count}
              disabled={disabled}
              selected={sourceId === item.id}
              language={language}
              theme={theme}
              onPress={() => !disabled && setSourceId(item.id)}
            />
          );
        })}
      </View>

      {/* ── 4. Summary ────────────────────────────────────────────────── */}
      <View style={[styles.summaryCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <View style={[styles.summaryIcon, { backgroundColor: `${theme.accent}1C` }]}>
          <AppIcon family="Ionicons" name="checkmark-done-circle" size={20} color={theme.accent} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={[styles.summaryTitle, { color: theme.text.primary }]} allowFontScaling={false}>
            {getLocalizedGameLabel(selectedMode, language)} · {getLocalizedGameLabel(selectedDifficulty, language)} · {getLocalizedGameLabel(selectedSource, language)}
          </Text>
          <Text style={[styles.summaryDetails, { color: theme.accent }]} allowFontScaling={false}>
            {getModeMetaLine(selectedMode, language)}
          </Text>
        </View>
      </View>

      {/* ── 5. Start Button ───────────────────────────────────────────── */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={i18nText("autoI18n.oyunu_baslat", "Oyunu Başlat")}
        style={[gameSharedStyles.primaryButton, styles.startButton, { backgroundColor: theme.accent }]}
        onPress={handleStartGame}
      >
        <AppIcon family="Ionicons" name="play" size={17} color="#fff" />
        <Text style={gameSharedStyles.primaryButtonText} allowFontScaling={false}>
          {i18nText("autoI18n.oyunu_baslat", "Oyunu Başlat")}
        </Text>
      </TouchableOpacity>
    </GameScreenShell>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-components (Compact UI)
   ══════════════════════════════════════════════════════════════════════════ */

function SectionHeader({ icon, title, theme }) {
  return (
    <View style={styles.sectionRow}>
      <AppIcon family="Ionicons" name={icon} size={14} color={theme.text.muted} />
      <Text style={[styles.sectionTitle, { color: theme.text.muted }]} allowFontScaling={false}>
        {title}
      </Text>
    </View>
  );
}

/* ── Mode Card (Compact) ─────────────────────────────────────────────────── */
function ModeCard({ mode, selected, language, theme, onPress }) {
  const borderColor = !mode.available ? theme.border : selected ? theme.accent : theme.border;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !mode.available }}
      disabled={!mode.available}
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.modeCard,
        {
          backgroundColor: selected ? `${theme.accent}14` : theme.secondary,
          borderColor,
          opacity: mode.available ? 1 : 0.5,
        },
      ]}
    >
      <View style={[styles.modeIcon, { backgroundColor: selected ? theme.accent : theme.primary }]}>
        <AppIcon family="Ionicons" name={mode.icon} size={18} color={selected ? "#FFFFFF" : theme.text.muted} />
      </View>
      <View style={styles.modeCopy}>
        <View style={styles.modeTitleRow}>
          <Text style={[styles.modeTitle, { color: theme.text.primary }]} allowFontScaling={false}>
            {i18nText(mode.titleKey, getLocalizedGameLabel(mode, language))}
          </Text>
          <Text style={[styles.modeMetaPill, { color: selected ? theme.accent : theme.text.muted }]} allowFontScaling={false}>
            {getModeMetaLine(mode, language)}
          </Text>
        </View>
        <Text style={[styles.modeRule, { color: theme.text.muted }]} numberOfLines={1} allowFontScaling={false}>
          {i18nText(mode.ruleKey, "")}
        </Text>
      </View>
      {selected && mode.available && (
        <AppIcon family="Ionicons" name="checkmark-circle" size={18} color={theme.accent} />
      )}
    </TouchableOpacity>
  );
}

/* ── Difficulty Chip (Compact) ────────────────────────────────────────────── */
function DifficultyChip({ diff, selected, language, theme, onPress }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.diffChip,
        {
          backgroundColor: selected ? `${diff.color}20` : theme.secondary,
          borderColor: selected ? diff.color : theme.border,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <AppIcon family="Ionicons" name={diff.icon} size={15} color={selected ? diff.color : theme.text.muted} />
        <Text style={[styles.diffTitle, { color: selected ? diff.color : theme.text.primary }]} allowFontScaling={false}>
          {i18nText(diff.titleKey, getLocalizedGameLabel(diff, language))}
        </Text>
      </View>
      <Text style={[styles.diffDesc, { color: selected ? diff.color : theme.text.muted }]} allowFontScaling={false}>
        {diff.timeSeconds}{i18nText("autoI18n.saniye_kisa", "sn")} · {diff.optionCount} {i18nText("autoI18n.secenek", language === "en" ? "opts" : "şık")}
      </Text>
    </TouchableOpacity>
  );
}

/* ── Source Card (Compact) ────────────────────────────────────────────────── */
function SourceCard({ item, count, disabled, selected, language, theme, onPress }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.sourceCard,
        {
          backgroundColor: selected ? `${theme.accent}14` : theme.secondary,
          borderColor: selected ? theme.accent : theme.border,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <View style={[styles.sourceIcon, { backgroundColor: selected ? theme.accent : theme.primary }]}>
        <AppIcon family="Ionicons" name={item.icon} size={17} color={selected ? "#FFFFFF" : theme.text.secondary} />
      </View>
      <View style={styles.sourceTextWrap}>
        <Text style={[styles.sourceTitle, { color: theme.text.primary }]} numberOfLines={1} allowFontScaling={false}>
          {getLocalizedGameLabel(item, language)}
        </Text>
        {item.personal && count !== undefined ? (
          <Text style={[styles.sourceMeta, { color: disabled ? "#FF6B6B" : theme.text.muted }]} allowFontScaling={false}>
            {disabled ? `${count}/4` : `${count} içerik`}
          </Text>
        ) : null}
      </View>
      {selected && !disabled ? (
        <AppIcon family="Ionicons" name="checkmark-circle" size={16} color={theme.accent} />
      ) : null}
    </TouchableOpacity>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Compact Styles
   ══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10, marginBottom: 6, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 11.5, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },

  /* Mode cards (Compact) */
  modeList: { gap: 8 },
  modeCard: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modeIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modeCopy: { flex: 1 },
  modeTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modeTitle: { fontSize: 13.5, fontWeight: "900" },
  modeMetaPill: { fontSize: 9.5, fontWeight: "750" },
  modeRule: { fontSize: 10, fontWeight: "600", marginTop: 1 },

  /* Difficulty chips (Compact) */
  difficultyRow: { flexDirection: "row", gap: 8 },
  diffChip: {
    flex: 1,
    minHeight: 58,
    borderRadius: 15,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  diffTitle: { fontSize: 12.5, fontWeight: "900" },
  diffDesc: { fontSize: 9, fontWeight: "750" },

  /* Source grid (Compact) */
  sourceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sourceCard: {
    width: "48.5%",
    minHeight: 54,
    borderRadius: 15,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sourceIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sourceTextWrap: { flex: 1 },
  sourceTitle: { fontSize: 12, fontWeight: "800" },
  sourceMeta: { fontSize: 9, fontWeight: "700", marginTop: 1 },

  /* Summary card (Compact) */
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  summaryIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  summaryCopy: { flex: 1 },
  summaryTitle: { fontSize: 12, fontWeight: "900" },
  summaryDetails: { fontSize: 9.5, fontWeight: "750", marginTop: 2 },

  startButton: {
    minHeight: 48,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 16,
  },
});
