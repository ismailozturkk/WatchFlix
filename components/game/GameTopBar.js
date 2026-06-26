// components/game/GameTopBar.js
//
// Aktif oyun ust bari (Part 12.1 / Part 19): sol cikis, orta skor+seri,
// sag soru sayaci veya kalan can. Saf gosterim bileseni; Firestore/TMDB
// istegi yapmaz, tum veriyi prop olarak alir.

import React from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";

export default function GameTopBar({
  theme,
  gameTokens,
  score,
  scoreScale,
  streak,
  streakScale,
  isSurvivalMode,
  lives,
  round,
  questionTotal,
  onClose,
}) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity
        onPress={onClose}
        activeOpacity={0.7}
        style={styles.quitBtn}
        accessibilityRole="button"
        accessibilityLabel={i18nText("autoI18n.oyundan_cik", "Oyundan çık")}
        hitSlop={8}
      >
        <AppIcon family="Ionicons" name="close" size={22} color={theme.text.primary} />
      </TouchableOpacity>

      <View style={styles.topBarCenter}>
        <Animated.View style={[styles.scoreBadge, { transform: [{ scale: scoreScale }] }]}>
          <AppIcon family="Ionicons" name="star" size={16} color={gameTokens.gold} />
          <Text style={[styles.scoreText, { color: gameTokens.gold }]}>{score}</Text>
        </Animated.View>
        <Animated.View style={[styles.streakBadge, { transform: [{ scale: streakScale }] }]}>
          <Text style={[styles.streakText, { color: gameTokens.incorrect }]}>🔥 {streak}</Text>
        </Animated.View>
      </View>

      {isSurvivalMode ? (
        <View style={styles.livesBadge}>
          <AppIcon family="Ionicons" name="heart" size={14} color="#FF5A5F" />
          <Text style={styles.livesText}>{lives}</Text>
        </View>
      ) : (
        <View style={styles.roundBadge}>
          <Text style={[styles.roundText, { color: theme.text.muted }]}>
            {questionTotal ? `${round}/${questionTotal}` : `#${round}`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  quitBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" },
  topBarCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  scoreBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,215,0,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  scoreText: { fontSize: 16, fontWeight: "800" },
  streakBadge: { backgroundColor: "rgba(255,107,107,0.15)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,107,107,0.3)" },
  streakText: { fontSize: 14, fontWeight: "800" },
  roundBadge: { minWidth: 38, height: 38, borderRadius: 19, paddingHorizontal: 10, justifyContent: "center", alignItems: "center" },
  roundText: { fontSize: 13, fontWeight: "700" },
  livesBadge: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 38, height: 38, borderRadius: 19, paddingHorizontal: 10, justifyContent: "center", backgroundColor: "rgba(255,90,95,0.15)", borderWidth: 1, borderColor: "rgba(255,90,95,0.3)" },
  livesText: { color: "#FF5A5F", fontSize: 14, fontWeight: "800" },
});
