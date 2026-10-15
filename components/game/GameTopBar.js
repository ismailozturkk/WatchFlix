// components/game/GameTopBar.js
//
// Aktif oyunun üst bölgesi, iki satır:
//   1) GameTopBar   → çıkış • ilerleme (mod'a göre) • sayaç
//   2) GameScoreRow → skor • seri • (sağda joker vb. çocuk)
//
// İLERLEME mod'a göre değişir: sabit soru sayılı modlarda (Klasik, Günlük)
// her soru bir dilim ve sonucuyla renklenir; Hayatta Kalma'da kalan canlar;
// Zamana Karşı'da doğru sayısı. Saf gösterim — Firestore/TMDB isteği yok.

import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import GlassCloseButton from "@components/common/GlassCloseButton";
import { i18nText } from "@utils/i18nText";
import { alpha } from "../../theme/colors";

// Hayatta Kalma'da "kayıp can" boş kalp olarak gösterilen taban.
const BASE_LIVES = 3;

function SegmentTrack({ total, results, current, theme, gameTokens }) {
  return (
    <View style={styles.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, index) => {
        const answered = index < results.length;
        const isCurrent = index === current - 1 && !answered;
        let color = theme.border;
        if (answered) color = results[index] ? gameTokens.correct : gameTokens.incorrect;
        else if (isCurrent) color = theme.accent;
        return <View key={index} style={[styles.segment, { backgroundColor: color, opacity: answered || isCurrent ? 1 : 0.55 }]} />;
      })}
    </View>
  );
}

function Hearts({ lives, maxLives, gameTokens, theme }) {
  const slots = Math.max(BASE_LIVES, Math.min(lives, maxLives || 5));
  return (
    <View style={styles.hearts} accessibilityLabel={i18nText("autoI18n.oyun_kalan_can", "{{count}} can kaldı", { count: lives })}>
      {Array.from({ length: slots }, (_, index) => {
        const alive = index < lives;
        return (
          <AppIcon
            key={index}
            family="Ionicons"
            name={alive ? "heart" : "heart-outline"}
            size={18}
            color={alive ? gameTokens.incorrect : theme.text.muted}
          />
        );
      })}
    </View>
  );
}

export default function GameTopBar({
  theme,
  gameTokens,
  mode,
  results = [],
  round,
  questionTotal,
  lives,
  maxLives,
  correctCount = 0,
  onClose,
}) {
  const isSurvival = mode === "survival";

  return (
    <View style={styles.bar}>
      <GlassCloseButton
        size={38}
        fallbackRadius={13}
        iconSize={20}
        color={theme.text.primary}
        backgroundColor={theme.secondary}
        borderColor={theme.border}
        accessibilityLabel={i18nText("autoI18n.oyundan_cik", "Oyundan çık")}
        onPress={onClose}
      />

      <View style={styles.center}>
        {questionTotal ? (
          <SegmentTrack total={questionTotal} results={results} current={round} theme={theme} gameTokens={gameTokens} />
        ) : isSurvival ? (
          <Hearts lives={lives} maxLives={maxLives} gameTokens={gameTokens} theme={theme} />
        ) : (
          <View style={styles.sessionLabel}>
            <AppIcon family="Ionicons" name="flash" size={14} color={gameTokens.gold} />
            <Text style={[styles.sessionText, { color: theme.text.secondary }]} allowFontScaling={false}>
              {i18nText("autoI18n.oyun_dogru_sayisi", "{{count}} doğru", { count: correctCount })}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.counter, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <Text style={[styles.counterText, { color: theme.text.primary }]} allowFontScaling={false}>
          {questionTotal ? `${Math.min(round, questionTotal)}/${questionTotal}` : `#${round}`}
        </Text>
      </View>
    </View>
  );
}

/** Skor + seri hapları; sağ tarafa çocuk (joker çubuğu) alır. */
export function GameScoreRow({ theme, gameTokens, score, scoreScale, streak, streakScale, children }) {
  const hot = streak >= 3;
  const streakColor = hot ? "#FF8A3D" : theme.text.muted;
  return (
    <View style={styles.scoreRow}>
      <View style={styles.pills}>
        <Animated.View
          style={[
            styles.pill,
            { backgroundColor: alpha(gameTokens.gold, 0.14), borderColor: alpha(gameTokens.gold, 0.34), transform: [{ scale: scoreScale }] },
          ]}
        >
          <AppIcon family="Ionicons" name="star" size={14} color={gameTokens.gold} />
          <Text style={[styles.pillText, { color: gameTokens.gold }]} allowFontScaling={false}>
            {score}
          </Text>
        </Animated.View>
        <Animated.View
          style={[
            styles.pill,
            {
              backgroundColor: hot ? "rgba(255,138,61,0.16)" : theme.secondary,
              borderColor: hot ? "rgba(255,138,61,0.4)" : theme.border,
              transform: [{ scale: streakScale }],
            },
          ]}
        >
          <AppIcon family="Ionicons" name="flame" size={14} color={streakColor} />
          <Text style={[styles.pillText, { color: streakColor }]} allowFontScaling={false}>
            {streak}
          </Text>
        </Animated.View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  center: { flex: 1, justifyContent: "center" },
  segments: { flexDirection: "row", alignItems: "center", gap: 4 },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  hearts: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  sessionLabel: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  sessionText: { fontSize: 13, fontWeight: "800" },
  counter: { minWidth: 46, height: 34, borderRadius: 12, borderWidth: 1, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" },
  counterText: { fontSize: 12.5, fontWeight: "900" },

  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 10 },
  pills: { flexDirection: "row", alignItems: "center", gap: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, height: 34, borderRadius: 17, borderWidth: 1 },
  pillText: { fontSize: 15, fontWeight: "900" },
});
