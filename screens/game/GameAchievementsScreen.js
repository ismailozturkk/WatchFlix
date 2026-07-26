import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import AppBadge from "@components/badges/AppBadge";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { rarityStyle } from "@theme/badgeTokens";
import { loadGameData } from "@services/sceneGameService";
import { i18nText } from "@utils/i18nText";
import { GameScreenShell } from "./GameScreenShell";
import { SCENE_ACHIEVEMENTS } from "./gameRegistry";

export default function GameAchievementsScreen({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const tr = language !== "en";
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (user?.uid) loadGameData(user.uid).then(setStats).catch(() => setStats(null));
  }, [user?.uid]);

  const achievements = useMemo(
    () =>
      SCENE_ACHIEVEMENTS.map((achievement) => {
        const progress = Math.max(0, Math.min(achievement.getProgress(stats), achievement.target));
        return {
          ...achievement,
          title: i18nText(achievement.titleKey, achievement.id),
          description: i18nText(achievement.descriptionKey, ""),
          unlocked: achievement.isUnlocked(stats),
          progress,
        };
      }),
    [stats],
  );

  const unlockedCount = achievements.filter((item) => item.unlocked).length;

  return (
    <GameScreenShell navigation={navigation} title={tr ? "Başarımlar" : "Achievements"} subtitle={`${unlockedCount}/${achievements.length} ${tr ? "açıldı" : "unlocked"}`}>
      {achievements.map((item) => {
        const ratio = item.target ? item.progress / item.target : 0;
        return (
          <View key={item.id} style={[styles.card, { backgroundColor: theme.secondary, borderColor: item.unlocked ? rarityStyle(item.rarity, theme).color : theme.border }]}>
            <AppBadge
              glyph={item.icon}
              glyphSolid={item.iconSolid}
              rarity={item.rarity}
              unlocked={item.unlocked}
              progress={ratio}
              size={52}
              accessibilityLabel={item.title}
            />
            <View style={styles.copy}>
              <Text style={[styles.title, { color: theme.text.primary }]}>{item.title}</Text>
              <Text style={[styles.description, { color: theme.text.muted }]}>{item.description}</Text>
              {!item.unlocked && item.target > 1 ? (
                <View style={styles.progressWrap}>
                  <View style={[styles.progressTrack, { backgroundColor: theme.primary }]}>
                    <View style={[styles.progressFill, { backgroundColor: theme.accent, width: `${Math.round(ratio * 100)}%` }]} />
                  </View>
                  <Text style={[styles.progressText, { color: theme.text.muted }]}>{item.progress}/{item.target}</Text>
                </View>
              ) : null}
            </View>
            {item.unlocked ? <AppIcon family="Ionicons" name="checkmark-circle" size={22} color="#2ECC71" /> : null}
          </View>
        );
      })}
    </GameScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 84, borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 13 },
  copy: { flex: 1 },
  title: { fontSize: 15, fontWeight: "850" },
  description: { fontSize: 11, lineHeight: 16, fontWeight: "650", marginTop: 3 },
  progressWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { fontSize: 10, fontWeight: "800" },
});
