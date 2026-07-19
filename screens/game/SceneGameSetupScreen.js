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
  if (mode.leaderboardEligible) parts.push(i18nText("autoI18n.liderlik_uygun", language === "en" ? "Leaderboard" : "Liderlik"));
  return parts.join("  ·  ");
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function SceneGameSetupScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  // combinedLists: legacy kök array'ler + yeni subcollection birleşimi.
  // allLists yalnız kök array'leri görür; migration onları deleteField ile
  // sildiği için migre kullanıcıda tüm "Sana Özel" kaynaklar 0/4 görünüp
  // kalıcı kilitleniyordu (oyun içi kaynak seçimi zaten combinedLists kullanır).
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
        <View style={[styles.summaryIcon, { backgroundColor: `${theme.accent}15` }]}>
          <AppIcon family="Ionicons" name="clipboard-outline" size={22} color={theme.accent} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={[styles.summaryTitle, { color: theme.text.primary }]}>
            {i18nText("autoI18n.ozet", "Özet")}
          </Text>
          <Text style={[styles.summaryMeta, { color: theme.text.muted }]}>
            {getLocalizedGameLabel(selectedMode, language)}
            {"  ·  "}
            {getLocalizedGameLabel(selectedDifficulty, language)}
            {"  ·  "}
            {getLocalizedGameLabel(selectedSource, language)}
          </Text>
          <Text style={[styles.summaryDetails, { color: theme.text.secondary }]}>
            {getModeMetaLine(selectedMode, language)}
          </Text>
        </View>
      </View>

      {/* ── 5. Start Button ───────────────────────────────────────────── */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={i18nText("autoI18n.oyunu_baslat", "Oyunu Başlat")}
        style={[gameSharedStyles.primaryButton, { backgroundColor: theme.accent, marginTop: 6 }]}
        onPress={handleStartGame}
      >
        <AppIcon family="Ionicons" name="play" size={20} color="#fff" />
        <Text style={gameSharedStyles.primaryButtonText}>
          {i18nText("autoI18n.oyunu_baslat", "Oyunu Başlat")}
        </Text>
      </TouchableOpacity>
    </GameScreenShell>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════════════════════ */

function SectionHeader({ icon, title, theme }) {
  return (
    <View style={styles.sectionRow}>
      <AppIcon family="Ionicons" name={icon} size={16} color={theme.text.muted} />
      <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>{title}</Text>
    </View>
  );
}

/* ── Mode Card ──────────────────────────────────────────────────────────── */
function ModeCard({ mode, selected, language, theme, onPress }) {
  const borderColor = !mode.available ? theme.border : selected ? theme.accent : theme.border;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !mode.available }}
      disabled={!mode.available}
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.modeCard,
        {
          backgroundColor: theme.secondary,
          borderColor,
          opacity: mode.available ? 1 : 0.52,
        },
      ]}
    >
      <View style={[styles.modeIcon, { backgroundColor: selected ? `${theme.accent}20` : theme.primary }]}>
        <AppIcon family="Ionicons" name={mode.icon} size={24} color={selected ? theme.accent : theme.text.muted} />
      </View>
      <View style={styles.modeCopy}>
        <View style={styles.modeTitleRow}>
          <Text style={[styles.modeTitle, { color: theme.text.primary }]}>
            {i18nText(mode.titleKey, getLocalizedGameLabel(mode, language))}
          </Text>
          {!mode.available && (
            <View style={[styles.soonBadge, { borderColor: theme.border }]}>
              <Text style={[styles.soonText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.yakinda", "Yakında")}
              </Text>
            </View>
          )}
          {selected && mode.available && (
            <AppIcon family="Ionicons" name="checkmark-circle" size={18} color={theme.accent} />
          )}
        </View>
        <Text style={[styles.modeRule, { color: theme.text.muted }]} numberOfLines={2}>
          {i18nText(mode.ruleKey, "")}
        </Text>
        <Text style={[styles.modeMeta, { color: selected ? theme.accent : theme.text.muted }]}>
          {getModeMetaLine(mode, language)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/* ── Difficulty Chip ────────────────────────────────────────────────────── */
function DifficultyChip({ diff, selected, language, theme, onPress }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.diffChip,
        {
          backgroundColor: selected ? `${diff.color}18` : theme.secondary,
          borderColor: selected ? diff.color : theme.border,
        },
      ]}
    >
      <AppIcon family="Ionicons" name={diff.icon} size={20} color={selected ? diff.color : theme.text.muted} />
      <Text style={[styles.diffTitle, { color: selected ? diff.color : theme.text.primary }]}>
        {i18nText(diff.titleKey, getLocalizedGameLabel(diff, language))}
      </Text>
      <Text style={[styles.diffDesc, { color: selected ? diff.color : theme.text.muted }]}>
        {diff.timeSeconds}{i18nText("autoI18n.saniye_kisa", "sn")} · {diff.optionCount} {i18nText("autoI18n.secenek", language === "en" ? "options" : "şık")}
      </Text>
    </TouchableOpacity>
  );
}

/* ── Source Card ─────────────────────────────────────────────────────────── */
function SourceCard({ item, count, disabled, selected, language, theme, onPress }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.sourceCard,
        {
          backgroundColor: theme.secondary,
          borderColor: selected ? theme.accent : theme.border,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <View style={[styles.sourceIcon, { backgroundColor: selected ? `${theme.accent}25` : theme.primary }]}>
        <AppIcon family="Ionicons" name={item.icon} size={21} color={selected ? theme.accent : theme.text.secondary} />
      </View>
      <Text style={[styles.sourceTitle, { color: theme.text.primary }]} numberOfLines={2}>
        {getLocalizedGameLabel(item, language)}
      </Text>
      {item.personal && count !== undefined ? (
        <Text style={[styles.sourceMeta, { color: disabled ? "#FF6B6B" : theme.text.muted }]}>
          {disabled
            ? i18nText("autoI18n.oyun_en_az_dort_icerik", `${count}/4`, { count })
            : i18nText("autoI18n.oyun_uygun_icerik", `${count} içerik`, { count })}
        </Text>
      ) : null}
      {selected && !disabled ? (
        <AppIcon family="Ionicons" name="checkmark-circle" size={19} color={theme.accent} style={styles.sourceCheck} />
      ) : null}
    </TouchableOpacity>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Styles
   ══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  /* Section header */
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },

  /* Mode cards */
  modeList: { gap: 9 },
  modeCard: {
    minHeight: 100,
    borderRadius: 19,
    borderWidth: 1.5,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modeIcon: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  modeCopy: { flex: 1 },
  modeTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  modeTitle: { fontSize: 14, fontWeight: "900" },
  modeRule: { fontSize: 10, lineHeight: 14, fontWeight: "650", marginTop: 4 },
  modeMeta: { fontSize: 9, fontWeight: "800", marginTop: 5 },
  soonBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  soonText: { fontSize: 7, fontWeight: "800" },

  /* Difficulty chips */
  difficultyRow: { flexDirection: "row", gap: 9 },
  diffChip: {
    flex: 1,
    minHeight: 86,
    borderRadius: 17,
    borderWidth: 1.5,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  diffTitle: { fontSize: 13, fontWeight: "900", marginTop: 2 },
  diffDesc: { fontSize: 9, fontWeight: "700", textAlign: "center" },

  /* Source grid */
  sourceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sourceCard: {
    width: "48%",
    minHeight: 110,
    borderRadius: 17,
    borderWidth: 1.5,
    padding: 13,
  },
  sourceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sourceTitle: { fontSize: 13, fontWeight: "800", lineHeight: 17, marginTop: 9, paddingRight: 10 },
  sourceMeta: { fontSize: 10, fontWeight: "700", marginTop: 4 },
  sourceCheck: { position: "absolute", top: 11, right: 11 },

  /* Summary card */
  summaryCard: {
    borderRadius: 19,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 2,
  },
  summaryIcon: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  summaryCopy: { flex: 1 },
  summaryTitle: { fontSize: 13, fontWeight: "900" },
  summaryMeta: { fontSize: 10, fontWeight: "700", marginTop: 3 },
  summaryDetails: { fontSize: 9, fontWeight: "650", marginTop: 3 },
});
