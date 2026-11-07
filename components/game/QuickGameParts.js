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
import usePosterCorner from "@hooks/usePosterCorner";

export const QUICK_GOOD = "#22C55E";
export const QUICK_BAD = "#EF4444";
const GOLD = "#FFD76A";

/** Canlar; `max` oyunun can sayısı (Yüksek puanı bul: 1). */
export function Hearts({ lives, theme, copy, max = OLDER_LIVES }) {
  return (
    <View
      style={[styles.hearts, { backgroundColor: theme.secondary, borderColor: theme.border }]}
      accessible
      accessibilityLabel={copy.livesLabel(lives)}
    >
      {Array.from({ length: max }, (_, i) => (
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
    <View style={[styles.statRow, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <Stat theme={theme} label={copy.scoreLabel} value={score} color={accent} icon="flash" />
      <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
      <Stat theme={theme} label={copy.bestLabel} value={best} color={GOLD} icon="trophy" />
    </View>
  );
}

function Stat({ theme, label, value, color, icon }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: `${color}20`, borderColor: `${color}4D` }]}>
        <AppIcon family="Ionicons" name={icon} size={15} color={color} />
      </View>
      <View style={styles.statCopy}>
        <Text style={[styles.statValue, { color: theme.text.primary }]} allowFontScaling={false}>
          {value}
        </Text>
        <Text style={[styles.statLabel, { color: theme.text.muted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Oyun türü ikonu + soru: bütün hızlı oyunlarda aynı belirgin soru kartı. */
export function QuestionPrompt({ children, theme, accent, icon = "help-circle-outline" }) {
  return (
    <View style={[styles.questionPrompt, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={[styles.questionIcon, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
        <AppIcon family="Ionicons" name={icon} size={18} color={accent} />
      </View>
      <Text style={[styles.questionText, { color: theme.text.primary }]}>{children}</Text>
      <View style={[styles.questionAccent, { backgroundColor: accent }]} />
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
        <View style={[styles.endGlow, { backgroundColor: `${accent}18` }]} />
        <View style={[styles.endMedallion, { backgroundColor: `${accent}22`, borderColor: `${accent}66` }]}>
          <AppIcon family="Ionicons" name="flag" size={24} color={accent} />
        </View>
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
        <View style={[styles.endStats, { backgroundColor: theme.primary, borderColor: theme.border }]}>
          <View style={styles.endStatItem}>
            <AppIcon family="Ionicons" name="checkmark-done" size={14} color={QUICK_GOOD} />
            <Text style={[styles.endMeta, { color: theme.text.secondary }]}>{copy.accuracy(olderAccuracy(stats))}</Text>
          </View>
          <View style={[styles.endStatsDivider, { backgroundColor: theme.border }]} />
          <View style={styles.endStatItem}>
            <AppIcon family="Ionicons" name="game-controller" size={14} color={accent} />
            <Text style={[styles.endMeta, { color: theme.text.secondary }]}>{copy.plays(stats.plays)}</Text>
          </View>
        </View>
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
        <AppIcon family="Ionicons" name="close" size={17} color={theme.text.secondary} />
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
        <View style={styles.feedbackSpacer} />
        <AppIcon family="Ionicons" name="chevron-forward" size={17} color={reveal.correct ? QUICK_GOOD : QUICK_BAD} />
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
  const corner = usePosterCorner("fun");
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.97}
      style={[styles.posterWrap, style]}
    >
      <View style={[styles.poster, { borderRadius: corner(18), borderColor: border, borderWidth: state === "idle" || state === "other" ? 1 : 3, backgroundColor: theme.secondary }]}>
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
  hearts: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 9, borderRadius: 17, borderWidth: 1 },
  statRow: { minHeight: 62, flexDirection: "row", alignItems: "center", borderRadius: 20, borderWidth: 1, paddingHorizontal: 8 },
  stat: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 7 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32 },
  statIcon: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  statCopy: { flex: 1, minWidth: 0 },
  statValue: { fontSize: 21, lineHeight: 23, fontWeight: "900", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 10.5, fontWeight: "800", marginTop: 1 },

  questionPrompt: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: "hidden",
  },
  questionIcon: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  questionText: { flex: 1, fontSize: 16, lineHeight: 20, fontWeight: "900", letterSpacing: -0.15 },
  questionAccent: { position: "absolute", left: 0, top: 15, bottom: 15, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 40 },
  note: { fontSize: 13, lineHeight: 18, fontWeight: "600", textAlign: "center", paddingHorizontal: 12 },
  errorTitle: { fontSize: 17, fontWeight: "900" },
  cta: { alignSelf: "stretch" },

  posterWrap: { flex: 1, borderRadius: 20, shadowColor: "#000000", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 5 },
  poster: { aspectRatio: 2 / 3, borderRadius: 18, overflow: "hidden" },
  posterImage: { width: "100%", height: "100%" },
  posterTitle: { fontSize: 12.5, lineHeight: 16, fontWeight: "800", textAlign: "center", marginTop: 9, minHeight: 32 },
  yearBadge: { position: "absolute", left: 9, right: 9, bottom: 9, minHeight: 35, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  yearText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", letterSpacing: 0.25 },
  mark: { position: "absolute", top: 9, right: 9, width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "rgba(255,255,255,0.85)", alignItems: "center", justifyContent: "center" },

  feedbackSlot: { height: 52, alignItems: "stretch", justifyContent: "center" },
  feedback: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 15, maxHeight: 48, borderRadius: 16, borderWidth: 1.5 },
  feedbackText: { fontSize: 15, fontWeight: "900" },
  feedbackSpacer: { flex: 1 },

  endCard: { alignSelf: "stretch", alignItems: "center", borderRadius: 28, borderWidth: 1, paddingVertical: 24, paddingHorizontal: 16, gap: 4, overflow: "hidden" },
  endGlow: { position: "absolute", width: 210, height: 210, borderRadius: 105, top: -132 },
  endMedallion: { width: 52, height: 52, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 7 },
  endKicker: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  endScore: { fontSize: 64, fontWeight: "900", lineHeight: 72, letterSpacing: -1 },
  endLabel: { fontSize: 15, fontWeight: "800" },
  endMeta: { fontSize: 12, fontWeight: "800" },
  endStats: { alignSelf: "stretch", minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, marginTop: 12, paddingHorizontal: 8 },
  endStatItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  endStatsDivider: { width: StyleSheet.hairlineWidth, height: 22 },
  bestPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, marginTop: 8 },
  bestPillText: { fontSize: 13, fontWeight: "900" },
  ghost: { alignSelf: "stretch", minHeight: 46, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  ghostText: { fontSize: 14, fontWeight: "800" },
});
