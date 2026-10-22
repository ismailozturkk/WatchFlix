// components/game/QuickGameParts.js
//
// Hızlı oyunların (Önce hangisi? + utils/quickGames.js'teki dört oyun) ORTAK ekran parçaları: canlar, skor/rekor
// satırı, yükleniyor, hata, oyun sonu kartı ve afiş kartı. Ortak metinler OLDER_COPY'den gelir (`copy` prop'u).
//
// İki ekran (screens/game/OlderGameScreen, screens/game/QuickGameScreen) aynı parçaları kullanır; böylece can,
// rekor ve oyun sonu davranışı tek yerde ve oyunlar arasında birebir aynı kalır.

import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import AppIcon from "@components/AppIcon";
import GlassPressable from "@components/common/GlassPressable";
import { PressableScale } from "@components/game/ui";
import { buildTmdbUrl } from "@utils/tmdbImageUtils";
import { OLDER_LIVES, olderAccuracy } from "@utils/olderGame";
import { gameSharedStyles } from "../../screens/game/GameScreenShell";

export const QUICK_GOOD = "#22C55E";
export const QUICK_BAD = "#EF4444";
const GOLD = "#FFD76A";

export function Hearts({ lives, theme, copy }) {
  return (
    <View style={styles.hearts} accessible accessibilityLabel={copy.livesLabel(lives)}>
      {Array.from({ length: OLDER_LIVES }, (_, i) => (
        <AppIcon
          key={i}
          family="Ionicons"
          name={i < lives ? "heart" : "heart-outline"}
          size={20}
          color={i < lives ? QUICK_BAD : theme.text.muted}
        />
      ))}
    </View>
  );
}

export function StatRow({ theme, copy, score, best, accent }) {
  return (
    <View style={styles.statRow}>
      <Stat theme={theme} label={copy.scoreLabel} value={score} color={accent} />
      <Stat theme={theme} label={copy.bestLabel} value={best} color={GOLD} />
    </View>
  );
}

function Stat({ theme, label, value, color }) {
  return (
    <View style={[styles.stat, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <Text style={[styles.statValue, { color }]} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.text.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function LoadingState({ theme, copy }) {
  return (
    <View style={styles.center} accessibilityLabel={copy.loading}>
      <ActivityIndicator size="large" color={theme.accent} />
      <Text style={[styles.note, { color: theme.text.secondary }]}>{copy.loading}</Text>
    </View>
  );
}

export function ErrorState({ theme, copy, accent, onRetry }) {
  return (
    <View style={styles.center}>
      <AppIcon family="Ionicons" name="cloud-offline-outline" size={44} color={theme.text.muted} />
      <Text style={[styles.errorTitle, { color: theme.text.primary }]}>{copy.errorTitle}</Text>
      <Text style={[styles.note, { color: theme.text.secondary }]}>{copy.errorBody}</Text>
      <GlassPressable
        onPress={onRetry}
        accessibilityRole="button"
        style={[gameSharedStyles.primaryButton, styles.cta, { backgroundColor: accent }]}
      >
        <AppIcon family="Ionicons" name="refresh" size={18} color="#FFFFFF" />
        <Text style={gameSharedStyles.primaryButtonText}>{copy.retry}</Text>
      </GlassPressable>
    </View>
  );
}

export function EndCard({ theme, copy, accent, score, best, summary, stats, onAgain, onClose }) {
  return (
    <View style={styles.center}>
      <View style={[styles.endCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <Text style={[styles.endKicker, { color: theme.text.muted }]}>{copy.endTitle.toUpperCase()}</Text>
        <Text style={[styles.endScore, { color: theme.text.primary }]} allowFontScaling={false}>
          {score}
        </Text>
        <Text style={[styles.endLabel, { color: theme.text.secondary }]}>{copy.endScore(score)}</Text>
        {summary?.newBest ? (
          <View style={[styles.bestPill, { backgroundColor: `${GOLD}26`, borderColor: `${GOLD}99` }]}>
            <AppIcon family="Ionicons" name="trophy" size={14} color={GOLD} />
            <Text style={[styles.bestPillText, { color: theme.text.primary }]}>{copy.newBest}</Text>
          </View>
        ) : (
          <Text style={[styles.endMeta, { color: theme.text.muted }]}>{copy.bestIs(best)}</Text>
        )}
        <Text style={[styles.endMeta, { color: theme.text.muted }]}>
          {`${copy.accuracy(olderAccuracy(stats))} · ${copy.plays(stats.plays)}`}
        </Text>
      </View>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={copy.playAgain}
        onPress={onAgain}
        style={[gameSharedStyles.primaryButton, styles.cta, { backgroundColor: accent }]}
      >
        <AppIcon family="Ionicons" name="refresh" size={18} color="#FFFFFF" />
        <Text style={gameSharedStyles.primaryButtonText}>{copy.playAgain}</Text>
      </PressableScale>
      <GlassPressable
        onPress={onClose}
        accessibilityRole="button"
        style={[styles.ghost, { borderColor: theme.border }]}
      >
        <Text style={[styles.ghostText, { color: theme.text.secondary }]}>{copy.close}</Text>
      </GlassPressable>
    </View>
  );
}

/** "Doğru!" / "Yanlış" şeridi; dokunmak sıradaki soruya hemen geçirir. */
export function FeedbackStrip({ reveal, theme, copy, onPress }) {
  if (!reveal) return <View style={styles.feedbackSlot} />;
  return (
    <View style={styles.feedbackSlot}>
      <GlassPressable
        onPress={onPress}
        accessibilityRole="button"
        style={[
          styles.feedback,
          { backgroundColor: reveal.correct ? `${QUICK_GOOD}26` : `${QUICK_BAD}26`, borderColor: reveal.correct ? QUICK_GOOD : QUICK_BAD },
        ]}
      >
        <AppIcon
          family="Ionicons"
          name={reveal.correct ? "checkmark-circle" : "close-circle"}
          size={20}
          color={reveal.correct ? QUICK_GOOD : QUICK_BAD}
        />
        <Text style={[styles.feedbackText, { color: theme.text.primary }]}>
          {reveal.correct ? copy.correct : copy.wrong}
        </Text>
      </GlassPressable>
    </View>
  );
}

/**
 * Afiş kartı. `state`: idle | older (doğru) | wrong (seçilen yanlış) | other. `badge`: cevaptan sonra afişin alt
 * şeridinde görünen metin (yıl ya da oy sayısı).
 */
export function PosterCard({ item, badge, state, theme, label, disabled, onPress, showTitle = true, style }) {
  const uri = buildTmdbUrl(item.posterPath, "poster", 342);
  const border = state === "older" ? QUICK_GOOD : state === "wrong" ? QUICK_BAD : theme.border;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.97}
      style={[styles.posterWrap, style]}
    >
      <View style={[styles.poster, { borderColor: border, borderWidth: state === "idle" || state === "other" ? 1 : 3, backgroundColor: theme.secondary }]}>
        {uri ? <Image source={{ uri }} style={styles.posterImage} contentFit="cover" /> : null}
        {badge != null ? (
          <View style={[styles.yearBadge, { backgroundColor: state === "older" ? QUICK_GOOD : "rgba(0,0,0,0.72)" }]}>
            <Text style={styles.yearText} allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {badge}
            </Text>
          </View>
        ) : null}
        {state === "older" ? (
          <View style={[styles.mark, { backgroundColor: QUICK_GOOD }]}>
            <AppIcon family="Ionicons" name="checkmark" size={16} color="#FFFFFF" />
          </View>
        ) : state === "wrong" ? (
          <View style={[styles.mark, { backgroundColor: QUICK_BAD }]}>
            <AppIcon family="Ionicons" name="close" size={16} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      {showTitle ? (
        <Text style={[styles.posterTitle, { color: theme.text.secondary }]} numberOfLines={2}>
          {item.title}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hearts: { flexDirection: "row", gap: 4 },
  statRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 10, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "900" },
  statLabel: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 40 },
  note: { fontSize: 13, lineHeight: 18, fontWeight: "600", textAlign: "center", paddingHorizontal: 12 },
  errorTitle: { fontSize: 17, fontWeight: "900" },
  cta: { alignSelf: "stretch" },

  posterWrap: { flex: 1 },
  poster: { aspectRatio: 2 / 3, borderRadius: 18, overflow: "hidden" },
  posterImage: { width: "100%", height: "100%" },
  posterTitle: { fontSize: 12.5, lineHeight: 16, fontWeight: "700", textAlign: "center", marginTop: 8, minHeight: 32 },
  yearBadge: { position: "absolute", left: 8, right: 8, bottom: 8, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 6, alignItems: "center" },
  yearText: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", letterSpacing: 0.3 },
  mark: { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },

  feedbackSlot: { height: 48, alignItems: "center", justifyContent: "center" },
  feedback: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, height: 44, borderRadius: 22, borderWidth: 1.5 },
  feedbackText: { fontSize: 15, fontWeight: "900" },

  endCard: { alignSelf: "stretch", alignItems: "center", borderRadius: 24, borderWidth: 1, paddingVertical: 24, paddingHorizontal: 16, gap: 4 },
  endKicker: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  endScore: { fontSize: 64, fontWeight: "900", lineHeight: 72, letterSpacing: -1 },
  endLabel: { fontSize: 15, fontWeight: "800" },
  endMeta: { fontSize: 12.5, fontWeight: "600", marginTop: 6 },
  bestPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, marginTop: 8 },
  bestPillText: { fontSize: 13, fontWeight: "900" },
  ghost: { alignSelf: "stretch", minHeight: 46, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ghostText: { fontSize: 14, fontWeight: "800" },
});
