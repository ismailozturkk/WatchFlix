import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import Skeleton from "@components/Skeleton";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { loadGameData } from "@services/sceneGameService";
import { computeLevel } from "@utils/gameScoring";
import { GameNavCard, GameScreenShell } from "./GameScreenShell";
import { getDifficultyConfig, getLocalizedGameLabel, getModeConfig } from "./gameConfig";

export default function GameStatsScreen({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const tr = language !== "en";
  const [state, setState] = useState({ loading: true, data: null });

  useEffect(() => {
    if (!user?.uid) { setState({ loading: false, data: null }); return; }
    loadGameData(user.uid).then((data) => setState({ loading: false, data })).catch(() => setState({ loading: false, data: null }));
  }, [user?.uid]);

  const data = state.data || {};
  const level = useMemo(() => computeLevel(data.totalXp), [data.totalXp]);

  const values = useMemo(() => {
    const questions = (data.totalCorrect || 0) + (data.totalWrong || 0);
    return [
      { icon: "trophy-outline", label: tr ? "En iyi skor" : "Best score", value: data.bestScore || 0, color: "#E8B931" },
      { icon: "flame-outline", label: tr ? "En iyi seri" : "Best streak", value: data.bestStreak || 0, color: "#FF6B6B" },
      { icon: "game-controller-outline", label: tr ? "Toplam oyun" : "Total games", value: data.totalPlayed || 0, color: theme.accent },
      { icon: "checkmark-circle-outline", label: tr ? "Toplam doğru" : "Total correct", value: data.totalCorrect || 0, color: "#2ECC71" },
      { icon: "close-circle-outline", label: tr ? "Toplam yanlış" : "Total wrong", value: data.totalWrong || 0, color: "#E74C3C" },
      { icon: "analytics-outline", label: tr ? "Doğruluk" : "Accuracy", value: questions ? `${Math.round(((data.totalCorrect || 0) / questions) * 100)}%` : "0%", color: "#56CCF2" },
    ];
  }, [data, theme.accent, tr]);

  const modeBests = useMemo(() => {
    const byMode = data.bestScoresByMode;
    if (!byMode || typeof byMode !== "object") return [];
    return Object.entries(byMode)
      .map(([key, score]) => {
        const underscore = key.lastIndexOf("_");
        const modeId = key.slice(0, underscore);
        const difficultyId = key.slice(underscore + 1);
        return {
          key,
          score: Number(score) || 0,
          label: `${getLocalizedGameLabel(getModeConfig(modeId), language)} · ${getLocalizedGameLabel(getDifficultyConfig(difficultyId), language)}`,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [data.bestScoresByMode, language]);

  return (
    <GameScreenShell navigation={navigation} title={tr ? "Oyuncu Profili" : "Player Profile"} subtitle={tr ? "Sahne Tahmin ilerlemen" : "Your Scene Guess progress"}>
      {state.loading ? (
        <StatsSkeleton theme={theme} />
      ) : (
        <>
          {/* Seviye / XP kartı (Part 15.1) */}
          <View style={[styles.levelCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <View style={styles.levelTop}>
              <View style={[styles.levelBadge, { backgroundColor: `${theme.accent}1A`, borderColor: `${theme.accent}55` }]}>
                <AppIcon family="Ionicons" name="sparkles" size={18} color={theme.accent} />
                <Text style={[styles.levelNumber, { color: theme.accent }]}>{level.level}</Text>
              </View>
              <View style={styles.levelCopy}>
                <Text style={[styles.levelTitle, { color: theme.text.primary }]}>{tr ? `Seviye ${level.level}` : `Level ${level.level}`}</Text>
                <Text style={[styles.levelXp, { color: theme.text.muted }]}>{tr ? `${level.totalXp} XP toplam` : `${level.totalXp} XP total`}</Text>
              </View>
              <View style={styles.streakWrap}>
                <Text style={styles.streakValue}>🔥 {Number(data.weeklyStreak) || 0}</Text>
                <Text style={[styles.streakLabel, { color: theme.text.muted }]}>{tr ? "Haftalık seri" : "Weekly streak"}</Text>
              </View>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: theme.primary }]}>
              <View style={[styles.progressFill, { backgroundColor: theme.accent, width: `${Math.round(level.progress * 100)}%` }]} />
            </View>
            <View style={styles.progressFooter}>
              <Text style={[styles.progressText, { color: theme.text.muted }]}>{tr ? `Sonraki seviyeye ${Math.max(0, level.nextLevelXp - level.currentLevelXp)} XP` : `${Math.max(0, level.nextLevelXp - level.currentLevelXp)} XP to next level`}</Text>
              <Text style={[styles.progressText, { color: theme.text.muted }]}>{formatLastPlayed(data.lastPlayedAt, language)}</Text>
            </View>
          </View>

          {/* İstatistik grid */}
          <View style={styles.grid}>
            {values.map((item) => (
              <View key={item.label} style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <View style={[styles.icon, { backgroundColor: `${item.color}20` }]}><AppIcon family="Ionicons" name={item.icon} size={22} color={item.color} /></View>
                <Text style={[styles.value, { color: theme.text.primary }]}>{item.value}</Text>
                <Text style={[styles.label, { color: theme.text.muted }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Mod bazlı rekorlar */}
          {modeBests.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>{tr ? "MOD REKORLARI" : "MODE RECORDS"}</Text>
              <View style={[styles.panel, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                {modeBests.map((mode, index) => (
                  <View key={mode.key} style={[styles.modeRow, index !== modeBests.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                    <AppIcon family="Ionicons" name="medal-outline" size={17} color={theme.accent} />
                    <Text style={[styles.modeLabel, { color: theme.text.primary }]} numberOfLines={1}>{mode.label}</Text>
                    <Text style={[styles.modeScore, { color: theme.accent }]}>{mode.score}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <GameNavCard
            icon="ribbon-outline"
            accent="#C084FC"
            title={tr ? "Başarımlar" : "Achievements"}
            description={tr ? "Açtığın ve bekleyen başarımları gör" : "See unlocked and pending achievements"}
            onPress={() => navigation.navigate("GameAchievementsScreen")}
          />
        </>
      )}
    </GameScreenShell>
  );
}

function formatLastPlayed(value, language) {
  if (!value) return language === "en" ? "Not played yet" : "Henüz oynanmadı";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return language === "en" ? "Last played" : "Son oynama";
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "short" }).format(date);
}

// Kardeş oyun ekranlarıyla (SceneGameDetail DetailSkeleton) tutarlı:
// seviye kartı + 2 sütun istatistik grid + mod paneli iskeleti.
function StatsSkeleton({ theme }) {
  const box = { backgroundColor: theme.secondary };
  return (
    <View style={{ gap: 12 }}>
      <Skeleton height={122} style={[{ borderRadius: 20 }, box]} />
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width="48.5%" height={145} style={[{ borderRadius: 19 }, box]} />
        ))}
      </View>
      <Skeleton height={132} style={[{ borderRadius: 18 }, box]} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 80 },
  levelCard: { borderRadius: 20, borderWidth: 1, padding: 16 },
  levelTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  levelBadge: { minWidth: 56, height: 48, borderRadius: 15, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10 },
  levelNumber: { fontSize: 22, fontWeight: "900" },
  levelCopy: { flex: 1 },
  levelTitle: { fontSize: 16, fontWeight: "900" },
  levelXp: { fontSize: 11, fontWeight: "700", marginTop: 3 },
  streakWrap: { alignItems: "flex-end" },
  streakValue: { fontSize: 16, fontWeight: "900", color: "#FF6B6B" },
  streakLabel: { fontSize: 9, fontWeight: "700", marginTop: 3 },
  progressTrack: { height: 8, borderRadius: 5, overflow: "hidden", marginTop: 15 },
  progressFill: { height: "100%", borderRadius: 5 },
  progressFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  progressText: { fontSize: 10, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { width: "48.5%", minHeight: 145, borderRadius: 19, borderWidth: 1, padding: 15 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 27, fontWeight: "900", marginTop: 13 },
  label: { fontSize: 11, fontWeight: "700", marginTop: 3 },
  sectionTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 0.7, marginTop: 6, marginLeft: 2 },
  panel: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14 },
  modeRow: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 11 },
  modeLabel: { flex: 1, fontSize: 13, fontWeight: "750" },
  modeScore: { fontSize: 16, fontWeight: "900" },
});
