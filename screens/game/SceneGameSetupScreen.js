// screens/game/SceneGameSetupScreen.js
//
// Oyun kurulumu: mod → zorluk → içerik kaynağı. Başlat butonu ve seçim özeti
// ekranın ALTINDA SABİT durur; kaynak listesi uzasa da oyuncu "Başlat"ı
// aramak için kaydırmaz.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { PressableScale, SectionHeader } from "@components/game/ui";
import { useLanguage } from "@context/LanguageContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import { buildWatchlistPool } from "@services/sceneGameService";
import { loadSceneGamePreferences, saveSceneGamePreferences } from "@services/sceneGamePreferences";
import { i18nText } from "@utils/i18nText";
import { usePremiumDailyGate } from "@hooks/usePremiumGate";
import usePremiumScreenGuard from "@hooks/usePremiumScreenGuard";
import { alpha } from "../../theme/colors";
import { GameScreenShell, gameSharedStyles } from "./GameScreenShell";
import {
  DEFAULT_DIFFICULTY_ID,
  DEFAULT_MODE_ID,
  getLocalizedGameLabel,
  SCENE_GAME_DIFFICULTIES,
  SCENE_GAME_ID,
  SCENE_GAME_SOURCES,
  SELECTABLE_GAME_MODES,
} from "./gameConfig";
import { getGameTitle, getModeMetaLine } from "./gameLabels";
import { getGameEntry, resolveGameAccentColors } from "./gameRegistry";

/* ── Yardımcılar ────────────────────────────────────────────────────────── */
const discoverSources = SCENE_GAME_SOURCES.filter((s) => s.group === "discover");
const personalSources = SCENE_GAME_SOURCES.filter((s) => s.group === "personal");

/* ══════════════════════════════════════════════════════════════════════════ */
export default function SceneGameSetupScreen({ navigation, route }) {
  usePremiumScreenGuard("games", navigation);
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { combinedLists } = useListStatusContext();
  const { user } = useAuth();

  const gameId = route.params?.gameId || SCENE_GAME_ID;
  const accent = resolveGameAccentColors(getGameEntry(gameId), theme);

  /* ── Seçim durumu ───────────────────────────────────────────────────── */
  // Günlük mod burada seçilemez; yanlış param gelirse ilk moda düşer.
  const initialMode = SELECTABLE_GAME_MODES.some((m) => m.id === route.params?.modeId)
    ? route.params.modeId
    : DEFAULT_MODE_ID;
  const [modeId, setModeId] = useState(initialMode);
  const [difficultyId, setDifficultyId] = useState(route.params?.difficultyId || DEFAULT_DIFFICULTY_ID);
  const [sourceId, setSourceId] = useState(route.params?.sourceId || "popular");

  /* ── Kayıtlı tercihleri yükle ───────────────────────────────────────── */
  useEffect(() => {
    // Rotada (ör. Oyun Merkezi mod çipi) açık bir tercih varsa kayıtlıyı ezme.
    const hasRoutePrefs = route.params?.modeId || route.params?.difficultyId || route.params?.sourceId;
    if (hasRoutePrefs) return;
    let active = true;
    loadSceneGamePreferences(user?.uid).then((preferences) => {
      if (!active || !preferences) return;
      if (SELECTABLE_GAME_MODES.some((m) => m.id === preferences.modeId)) setModeId(preferences.modeId);
      setDifficultyId(preferences.difficultyId || DEFAULT_DIFFICULTY_ID);
      setSourceId(preferences.sourceId || "popular");
    });
    return () => { active = false; };
  }, [route.params?.modeId, route.params?.difficultyId, route.params?.sourceId, user?.uid]);

  /* ── Kişisel kaynak sayıları ────────────────────────────────────────── */
  const counts = useMemo(
    () => Object.fromEntries(
      SCENE_GAME_SOURCES.filter((item) => item.personal).map((item) => [
        item.id,
        buildWatchlistPool(combinedLists?.[item.listKey] || []).length,
      ]),
    ),
    [combinedLists],
  );

  /* ── Türetilmiş durum ───────────────────────────────────────────────── */
  const selectedMode = useMemo(() => SELECTABLE_GAME_MODES.find((m) => m.id === modeId) || SELECTABLE_GAME_MODES[0], [modeId]);
  const selectedDifficulty = useMemo(() => SCENE_GAME_DIFFICULTIES.find((d) => d.id === difficultyId) || SCENE_GAME_DIFFICULTIES[1], [difficultyId]);
  const selectedSource = useMemo(() => SCENE_GAME_SOURCES.find((s) => s.id === sourceId) || SCENE_GAME_SOURCES[0], [sourceId]);

  /* ── Oyunu başlat ───────────────────────────────────────────────────── */
  // Günlük oyun hakkı: bittiyse oyun ekranı hiç açılmadan uyarılır. Asıl
  // harcama oyun başladığında (hooks/useSceneGame).
  const gamesGate = usePremiumDailyGate("games");
  const handleStartGame = useCallback(async () => {
    if (!gamesGate.check()) return;
    await saveSceneGamePreferences(user?.uid, { modeId, difficultyId, sourceId });
    navigation.navigate("SceneGamePlayScreen", { gameId, modeId, difficultyId, sourceId });
  }, [navigation, gameId, modeId, difficultyId, sourceId, user?.uid, gamesGate]);

  const footer = (
    <View>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryIcon, { backgroundColor: alpha(accent[1], 0.16) }]}>
          <AppIcon family="Ionicons" name={selectedMode.icon} size={17} color={accent[1]} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={[styles.summaryTitle, { color: theme.text.primary }]} allowFontScaling={false} numberOfLines={1}>
            {getLocalizedGameLabel(selectedMode, language)} · {getLocalizedGameLabel(selectedDifficulty, language)} · {getLocalizedGameLabel(selectedSource, language)}
          </Text>
          <Text style={[styles.summaryDetails, { color: theme.text.muted }]} allowFontScaling={false} numberOfLines={1}>
            {getModeMetaLine(selectedMode, language)}
          </Text>
        </View>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={i18nText("autoI18n.oyunu_baslat", "Oyunu Başlat")}
        onPress={handleStartGame}
        style={styles.startWrap}
      >
        <LinearGradient colors={accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.startButton}>
          <AppIcon family="Ionicons" name="play" size={17} color="#fff" />
          <Text style={gameSharedStyles.primaryButtonText} allowFontScaling={false}>
            {i18nText("autoI18n.oyunu_baslat", "Oyunu Başlat")}
          </Text>
        </LinearGradient>
      </PressableScale>
      {!gamesGate.unlimited ? (
        <Text style={[styles.dailyAllowance, { color: theme.text.muted }]} allowFontScaling={false}>
          {language === "tr" ? `Bugün ${gamesGate.remaining}/${gamesGate.limit} oyun hakkın kaldı` : language === "es" ? `${gamesGate.remaining}/${gamesGate.limit} partidas restantes hoy` : language === "pt" ? `${gamesGate.remaining}/${gamesGate.limit} partidas restantes hoje` : `${gamesGate.remaining}/${gamesGate.limit} games left today`}
        </Text>
      ) : null}
    </View>
  );

  return (
    <GameScreenShell
      navigation={navigation}
      title={i18nText("autoI18n.oyun_kurulumu", "Oyun Kurulumu")}
      subtitle={getGameTitle(gameId)}
      footer={footer}
    >
      {/* ── 1. Mod ─────────────────────────────────────────────────────── */}
      <SectionHeader title={i18nText("autoI18n.oyun_modu", "Oyun Modu")} theme={theme} style={styles.sectionFirst} />
      <View style={styles.modeList}>
        {SELECTABLE_GAME_MODES.map((mode) => (
          <ModeCard
            key={mode.id}
            mode={mode}
            selected={modeId === mode.id}
            accent={accent[1]}
            language={language}
            theme={theme}
            onPress={() => setModeId(mode.id)}
          />
        ))}
      </View>

      {/* ── 2. Zorluk ──────────────────────────────────────────────────── */}
      <SectionHeader title={i18nText("autoI18n.zorluk", "Zorluk")} theme={theme} style={styles.sectionTight} />
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

      {/* ── 3. İçerik kaynağı ──────────────────────────────────────────── */}
      <SectionHeader title={i18nText("autoI18n.kesfet", "Keşfet")} theme={theme} style={styles.sectionTight} />
      <View style={styles.sourceGrid}>
        {discoverSources.map((item) => (
          <SourceCard
            key={item.id}
            item={item}
            selected={sourceId === item.id}
            accent={accent[1]}
            language={language}
            theme={theme}
            onPress={() => setSourceId(item.id)}
          />
        ))}
      </View>

      <SectionHeader title={i18nText("autoI18n.sana_ozel", "Sana Özel")} theme={theme} style={styles.sectionTight} />
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
              accent={accent[1]}
              language={language}
              theme={theme}
              onPress={() => !disabled && setSourceId(item.id)}
            />
          );
        })}
      </View>
    </GameScreenShell>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Bileşenler
   ══════════════════════════════════════════════════════════════════════════ */

function ModeCard({ mode, selected, accent, language, theme, onPress }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      scaleTo={0.985}
      style={[
        styles.modeCard,
        {
          backgroundColor: selected ? alpha(accent, 0.1) : theme.secondary,
          borderColor: selected ? accent : theme.border,
        },
      ]}
    >
      <View style={[styles.modeIcon, { backgroundColor: selected ? accent : theme.primary }]}>
        <AppIcon family="Ionicons" name={mode.icon} size={19} color={selected ? "#FFFFFF" : theme.text.muted} />
      </View>
      <View style={styles.modeCopy}>
        <Text style={[styles.modeTitle, { color: theme.text.primary }]} allowFontScaling={false}>
          {i18nText(mode.titleKey, getLocalizedGameLabel(mode, language))}
        </Text>
        <Text style={[styles.modeRule, { color: theme.text.muted }]} numberOfLines={2} allowFontScaling={false}>
          {i18nText(mode.ruleKey, "")}
        </Text>
        <Text style={[styles.modeMeta, { color: selected ? accent : theme.text.muted }]} allowFontScaling={false}>
          {getModeMetaLine(mode, language)}
        </Text>
      </View>
      <View style={[styles.radio, { borderColor: selected ? accent : theme.border, backgroundColor: selected ? accent : "transparent" }]}>
        {selected ? <AppIcon family="Ionicons" name="checkmark" size={13} color="#FFFFFF" /> : null}
      </View>
    </PressableScale>
  );
}

function DifficultyChip({ diff, selected, language, theme, onPress }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      scaleTo={0.96}
      style={[
        styles.diffChip,
        {
          backgroundColor: selected ? alpha(diff.color, 0.14) : theme.secondary,
          borderColor: selected ? diff.color : theme.border,
        },
      ]}
    >
      <AppIcon family="Ionicons" name={diff.icon} size={20} color={selected ? diff.color : theme.text.muted} />
      <Text style={[styles.diffTitle, { color: selected ? diff.color : theme.text.primary }]} allowFontScaling={false}>
        {i18nText(diff.titleKey, getLocalizedGameLabel(diff, language))}
      </Text>
      <Text style={[styles.diffDesc, { color: selected ? diff.color : theme.text.muted }]} allowFontScaling={false}>
        {diff.timeSeconds}{i18nText("autoI18n.saniye_kisa", "sn")} · {diff.optionCount} {i18nText("autoI18n.secenek", language === "en" ? "opts" : "şık")}
      </Text>
      <Text style={[styles.diffMult, { color: theme.text.muted }]} allowFontScaling={false}>
        ×{diff.scoreMultiplier}
      </Text>
    </PressableScale>
  );
}

function SourceCard({ item, count, disabled, selected, accent, language, theme, onPress }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.97}
      style={[
        styles.sourceCard,
        {
          backgroundColor: selected ? alpha(accent, 0.1) : theme.secondary,
          borderColor: selected ? accent : theme.border,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <View style={[styles.sourceIcon, { backgroundColor: selected ? accent : theme.primary }]}>
        <AppIcon family="Ionicons" name={item.icon} size={16} color={selected ? "#FFFFFF" : theme.text.secondary} />
      </View>
      <View style={styles.sourceTextWrap}>
        <Text style={[styles.sourceTitle, { color: theme.text.primary }]} numberOfLines={1} allowFontScaling={false}>
          {getLocalizedGameLabel(item, language)}
        </Text>
        {item.personal && count !== undefined ? (
          <Text style={[styles.sourceMeta, { color: disabled ? "#FF6B6B" : theme.text.muted }]} allowFontScaling={false}>
            {disabled
              ? `${count}/4`
              : i18nText("autoI18n.oyun_icerik_sayisi", "{{count}} içerik", { count })}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  sectionFirst: { marginTop: 2, marginBottom: 8 },
  sectionTight: { marginTop: 8, marginBottom: 8 },

  modeList: { gap: 9 },
  modeCard: { minHeight: 84, borderRadius: 18, borderWidth: 1.5, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  modeIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modeCopy: { flex: 1 },
  modeTitle: { fontSize: 14, fontWeight: "900" },
  modeRule: { fontSize: 10.5, lineHeight: 14, fontWeight: "600", marginTop: 2 },
  modeMeta: { fontSize: 9.5, fontWeight: "800", marginTop: 4 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },

  difficultyRow: { flexDirection: "row", gap: 9 },
  diffChip: { flex: 1, minHeight: 100, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 6, paddingVertical: 11, alignItems: "center", justifyContent: "center", gap: 4 },
  diffTitle: { fontSize: 13, fontWeight: "900" },
  diffDesc: { fontSize: 9.5, fontWeight: "750" },
  diffMult: { fontSize: 9.5, fontWeight: "900" },

  sourceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  sourceCard: { width: "48.5%", minHeight: 56, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 9 },
  sourceIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  sourceTextWrap: { flex: 1 },
  sourceTitle: { fontSize: 12, fontWeight: "800" },
  sourceMeta: { fontSize: 9, fontWeight: "700", marginTop: 1 },

  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  summaryIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  summaryCopy: { flex: 1 },
  summaryTitle: { fontSize: 12, fontWeight: "900" },
  summaryDetails: { fontSize: 9.5, fontWeight: "750", marginTop: 2 },
  startWrap: { borderRadius: 16, overflow: "hidden" },
  startButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 20 },
  dailyAllowance: { fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 8 },
});
