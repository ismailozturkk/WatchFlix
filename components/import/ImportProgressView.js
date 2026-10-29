// components/import/ImportProgressView.js
//
// Aktarım sürerken görünen ekran:
//   • halka ilerleme (yüzde) + aşamanın büyük başlığı + sayaç + kalan süre
//   • "şimdi eşleşen / kaydedilen" içeriğin afişi ve durum rozeti
//   • son işlenen afiş şeridi (yeni gelen soldan kayarak girer)
//   • dört aşamalı zaman çizelgesi (eşleştirme → kayıt → listeler → istatistik)
//   • canlı sayaçlar ve satır içi onaylı "Durdur"
//
// REANIMATED KURALI (memory/reanimated-initial-value-vanish): halka `memo` — yalnız oran
// DEĞİŞİNCE çizilir; oran sabitken (ör. istatistik hesabı sürerken) her saniyelik
// yeniden çizim halkanın ilk değerini (boş halka) geri yazabilirdi. Nabız halkası süs.
// "Hareketi Azalt" açıkken hiçbir hareket oynamaz.

import React, { memo, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInLeft,
  LinearTransition,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import AppIcon from "../AppIcon";
import GlassTouchable from "../common/GlassTouchable";
import { alpha } from "../../theme/colors";
import useReduceMotion from "../../hooks/useReduceMotion";
import { buildTmdbUrl } from "../../utils/tmdbImageUtils";
import { stageStatus, visibleStages } from "../../services/import/importProgress";
import { describeStage, etaText, statusBadge } from "./importPresentation";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 108;
const RING_STROKE = 10;
const RECENT_W = 34;
const RECENT_H = 51;

export const IMPORT_TONES = Object.freeze({
  safe: "#43D17B",
  warning: "#FF9F43",
  danger: "#EF4444",
  violet: "#A78BFA",
  gold: "#F5B942",
  sky: "#65D6FF",
});

export function toneColor(tone, theme) {
  if (tone === "accent") return theme.accent || "#138DF0";
  if (tone === "muted") return theme.text.secondary;
  return IMPORT_TONES[tone] || theme.text.secondary;
}

const ProgressRing = memo(function ProgressRing({ ratio, color, colorEnd, track, reduceMotion }) {
  const center = RING_SIZE / 2;
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = useSharedValue(ratio);

  useEffect(() => {
    value.value = reduceMotion
      ? ratio
      : withTiming(ratio, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [ratio, reduceMotion, value]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.value),
  }));

  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      <Defs>
        <SvgGradient id="importRingGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={color} />
          <Stop offset="1" stopColor={colorEnd} />
        </SvgGradient>
      </Defs>
      <Circle cx={center} cy={center} r={radius} stroke={track} strokeWidth={RING_STROKE} fill="none" />
      <AnimatedCircle
        cx={center}
        cy={center}
        r={radius}
        stroke="url(#importRingGradient)"
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={[circumference, circumference]}
        animatedProps={animatedProps}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </Svg>
  );
});

/** Etkin aşama noktasının arkasında yayılan halka. */
function PulseHalo({ color, size, reduceMotion }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return undefined;
    pulse.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.75 }],
  }));
  if (reduceMotion) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.halo, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
    />
  );
}

export function PosterThumb({ path, width, height, radius, theme, children }) {
  const uri = path ? buildTmdbUrl(path, "poster", width) : null;
  return (
    <View
      style={[
        styles.poster,
        { width, height, borderRadius: radius, backgroundColor: alpha(theme.text.muted || "#888", 0.16) },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} recyclingKey={path} />
      ) : (
        <AppIcon family="Ionicons" name="film-outline" size={Math.round(width * 0.42)} color={theme.text.muted} />
      )}
      {children}
    </View>
  );
}

export default function ImportProgressView({
  progress,
  copy,
  theme,
  cancelling,
  confirmingStop,
  onAskStop,
  onDismissStop,
  onConfirmStop,
}) {
  const reduceMotion = useReduceMotion();
  // Kalan süre olay gelmese de (yavaş kayıt) saniyede bir güncellensin.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!progress) return null;

  const accent = theme.accent || "#138DF0";
  const run = copy.run;
  const info = describeStage(progress, progress.stage, copy);
  const percent = Math.min(100, Math.round(progress.ratio * 100));
  const stages = visibleStages(progress);
  const current = progress.current;
  const badge = current ? statusBadge(current.status, copy) : null;
  const badgeColor = badge ? toneColor(badge.tone, theme) : accent;
  const enteringRecent = reduceMotion ? undefined : FadeInLeft.duration(260);
  const layoutRecent = reduceMotion ? undefined : LinearTransition.duration(220);
  const chips = [
    { key: "matched", label: run.chipMatched, value: progress.match.matched, color: accent },
    { key: "unmatched", label: run.chipUnmatched, value: progress.match.unmatched + progress.match.failed, color: IMPORT_TONES.warning },
    { key: "added", label: run.chipAdded, value: progress.save.added, color: IMPORT_TONES.safe },
    { key: "unchanged", label: run.chipUnchanged, value: progress.save.unchanged, color: theme.text.secondary },
  ];

  return (
    <View style={styles.container}>
      {/* Hero: halka + aşama */}
      <View
        style={[
          styles.hero,
          { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.58), borderColor: alpha(accent, 0.25) },
        ]}
      >
        <View style={styles.ringWrap}>
          <ProgressRing
            ratio={progress.ratio}
            color={accent}
            colorEnd={IMPORT_TONES.sky}
            track={alpha(theme.text.muted || "#888", 0.18)}
            reduceMotion={reduceMotion}
          />
          <View style={styles.ringCenter} pointerEvents="none">
            <Text allowFontScaling={false} style={[styles.ringPercent, { color: theme.text.primary }]}>
              {copy.percent(percent)}
            </Text>
            <AppIcon family="Ionicons" name={info.icon} size={14} color={accent} />
          </View>
        </View>

        <View style={styles.heroCopy}>
          <Text numberOfLines={2} style={[styles.heroTitle, { color: theme.text.primary }]}>{info.hero}</Text>
          {info.counter ? (
            <Text allowFontScaling={false} style={[styles.heroCounter, { color: accent }]}>{info.counter}</Text>
          ) : null}
          <Text numberOfLines={2} style={[styles.heroDetail, { color: theme.text.secondary }]}>{info.detail}</Text>
          {progress.stage !== "finalizing" ? (
            <View style={[styles.etaChip, { backgroundColor: alpha(accent, 0.12) }]}>
              <AppIcon family="Ionicons" name="time-outline" size={12} color={accent} />
              <Text numberOfLines={1} style={[styles.etaText, { color: accent }]}>{etaText(progress, copy, now)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Şu an işlenen içerik */}
      {current ? (
        <View
          style={[
            styles.nowCard,
            { backgroundColor: alpha(accent, 0.07), borderColor: alpha(accent, 0.2) },
          ]}
        >
          <PosterThumb path={current.poster} width={46} height={69} radius={9} theme={theme} />
          <View style={styles.nowCopy}>
            {info.now ? (
              <Text numberOfLines={1} style={[styles.nowLabel, { color: theme.text.muted }]}>{info.now}</Text>
            ) : null}
            <Text numberOfLines={2} style={[styles.nowTitle, { color: theme.text.primary }]}>{current.title}</Text>
            {current.year ? (
              <Text style={[styles.nowYear, { color: theme.text.secondary }]}>{current.year}</Text>
            ) : null}
          </View>
          {badge?.text ? (
            <View style={[styles.badge, { backgroundColor: alpha(badgeColor, 0.15) }]}>
              <AppIcon family="Ionicons" name={badge.icon} size={11} color={badgeColor} />
              <Text numberOfLines={1} style={[styles.badgeText, { color: badgeColor }]}>{badge.text}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Son işlenen afişler */}
      {progress.recent.length > 0 ? (
        <View style={styles.recentBlock}>
          <Text style={[styles.sectionLabel, { color: theme.text.secondary }]}>{run.recentTitle}</Text>
          <View style={styles.recentRow}>
            {progress.recent.map((card) => {
              const cardBadge = statusBadge(card.status, copy);
              return (
                <Animated.View key={card.key} entering={enteringRecent} layout={layoutRecent}>
                  <PosterThumb path={card.poster} width={RECENT_W} height={RECENT_H} radius={7} theme={theme}>
                    <View style={[styles.recentDot, { backgroundColor: toneColor(cardBadge.tone, theme) }]}>
                      <AppIcon family="Ionicons" name={cardBadge.icon} size={8} color="#FFFFFF" />
                    </View>
                  </PosterThumb>
                </Animated.View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Aşama zaman çizelgesi */}
      <View
        style={[
          styles.timeline,
          { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.45), borderColor: alpha(theme.border || "#444", 0.6) },
        ]}
      >
        {stages.map((stageKey, index) => {
          const status = stageStatus(progress, stageKey);
          const stageInfo = describeStage(progress, stageKey, copy);
          const dotColor = status === "done" ? IMPORT_TONES.safe : status === "active" ? accent : null;
          const meta =
            status === "pending" ? run.pending : stageInfo.counter || (status === "done" ? run.done : "");
          return (
            <View key={stageKey} style={styles.stageRow}>
              <View style={styles.stageRail}>
                <View style={styles.stageDotWrap}>
                  {status === "active" ? <PulseHalo color={accent} size={30} reduceMotion={reduceMotion} /> : null}
                  <View
                    style={[
                      styles.stageDot,
                      { backgroundColor: dotColor || alpha(theme.text.muted || "#888", 0.14) },
                    ]}
                  >
                    <AppIcon
                      family="Ionicons"
                      name={status === "done" ? "checkmark" : stageInfo.icon}
                      size={status === "done" ? 15 : 13}
                      color={dotColor ? "#FFFFFF" : theme.text.muted}
                    />
                  </View>
                </View>
                {index < stages.length - 1 ? (
                  <View
                    style={[
                      styles.stageLine,
                      { backgroundColor: status === "done" ? alpha(IMPORT_TONES.safe, 0.55) : alpha(theme.text.muted || "#888", 0.2) },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.stageBody}>
                <View style={styles.stageHead}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.stageTitle,
                      { color: status === "pending" ? theme.text.secondary : theme.text.primary },
                      status === "active" && styles.stageTitleActive,
                    ]}
                  >
                    {stageInfo.title}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={[styles.stageMeta, { color: status === "active" ? accent : theme.text.muted }]}
                  >
                    {meta}
                  </Text>
                </View>
                {status !== "pending" ? (
                  <Text numberOfLines={1} style={[styles.stageDetail, { color: theme.text.secondary }]}>
                    {status === "done" && stageKey === "finalizing" ? run.done : stageInfo.detail}
                  </Text>
                ) : null}
                {status === "active" && stageInfo.counter ? (
                  <View style={[styles.miniTrack, { backgroundColor: alpha(theme.text.muted || "#888", 0.18) }]}>
                    <View style={[styles.miniFill, { width: `${Math.round(stageInfo.ratio * 100)}%`, backgroundColor: accent }]} />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {/* Canlı sayaçlar */}
      <View style={styles.chips}>
        {chips.map((chip) => (
          <View
            key={chip.key}
            style={[styles.chip, { backgroundColor: alpha(chip.color, 0.1), borderColor: alpha(chip.color, 0.22) }]}
          >
            <Text allowFontScaling={false} style={[styles.chipValue, { color: chip.color }]}>{chip.value}</Text>
            <Text numberOfLines={1} style={[styles.chipLabel, { color: theme.text.secondary }]}>{chip.label}</Text>
          </View>
        ))}
      </View>

      {/* Durdur */}
      <View style={styles.footer}>
        <View style={styles.awakeRow}>
          <AppIcon family="Ionicons" name="phone-portrait-outline" size={14} color={theme.text.muted} />
          <Text style={[styles.awakeText, { color: theme.text.muted }]}>{run.keepAwake}</Text>
        </View>
        {confirmingStop && !cancelling ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(180)}
            style={[
              styles.stopCard,
              { backgroundColor: alpha(IMPORT_TONES.danger, 0.08), borderColor: alpha(IMPORT_TONES.danger, 0.3) },
            ]}
          >
            <Text style={[styles.stopTitle, { color: theme.text.primary }]}>{run.stopTitle}</Text>
            <Text style={[styles.stopBody, { color: theme.text.secondary }]}>{run.stopBody}</Text>
            <View style={styles.stopActions}>
              <GlassTouchable
                style={[styles.stopAction, { backgroundColor: alpha(theme.secondary || "#333", 0.9) }]}
                onPress={onDismissStop}
              >
                <Text style={[styles.stopActionText, { color: theme.text.primary }]}>{run.stopCancel}</Text>
              </GlassTouchable>
              <GlassTouchable
                style={[styles.stopAction, { backgroundColor: IMPORT_TONES.danger }]}
                onPress={onConfirmStop}
              >
                <Text style={[styles.stopActionText, { color: "#FFFFFF" }]}>{run.stopConfirm}</Text>
              </GlassTouchable>
            </View>
          </Animated.View>
        ) : (
          <GlassTouchable
            style={[
              styles.stopBtn,
              { borderColor: alpha(IMPORT_TONES.danger, 0.45), backgroundColor: alpha(IMPORT_TONES.danger, 0.08) },
            ]}
            onPress={onAskStop}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={IMPORT_TONES.danger} />
            ) : (
              <AppIcon family="Ionicons" name="pause" size={15} color={IMPORT_TONES.danger} />
            )}
            <Text style={[styles.stopText, { color: IMPORT_TONES.danger }]}>
              {cancelling ? run.stopping : run.stop}
            </Text>
          </GlassTouchable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 8, gap: 12 },
  hero: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 22, borderWidth: 1, padding: 14 },
  ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 2 },
  ringPercent: { fontSize: 24, lineHeight: 28, fontWeight: "900", letterSpacing: -0.8 },
  heroCopy: { flex: 1, minWidth: 0, gap: 3 },
  heroTitle: { fontSize: 16, lineHeight: 20, fontWeight: "900" },
  heroCounter: { fontSize: 19, lineHeight: 24, fontWeight: "900", letterSpacing: -0.4 },
  heroDetail: { fontSize: 11.5, lineHeight: 15 },
  etaChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 3,
    maxWidth: "100%",
  },
  etaText: { fontSize: 11, fontWeight: "800", flexShrink: 1 },
  nowCard: { flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 16, borderWidth: 1, padding: 10 },
  nowCopy: { flex: 1, minWidth: 0, gap: 1 },
  nowLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  nowTitle: { fontSize: 14, lineHeight: 18, fontWeight: "800" },
  nowYear: { fontSize: 12, fontWeight: "600" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, maxWidth: 120 },
  badgeText: { fontSize: 11, fontWeight: "800", flexShrink: 1 },
  poster: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  recentBlock: { gap: 7 },
  sectionLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase", paddingHorizontal: 2 },
  recentRow: { flexDirection: "row", gap: 6, overflow: "hidden", height: RECENT_H + 2 },
  recentDot: {
    position: "absolute",
    right: 3,
    bottom: 3,
    width: 13,
    height: 13,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  timeline: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  stageRow: { flexDirection: "row", gap: 11 },
  stageRail: { width: 30, alignItems: "center" },
  stageDotWrap: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute" },
  stageDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stageLine: { width: 2, flex: 1, minHeight: 12, borderRadius: 1, marginVertical: 3 },
  stageBody: { flex: 1, minWidth: 0, paddingBottom: 12, gap: 2 },
  stageHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 28 },
  stageTitle: { flex: 1, fontSize: 13.5, fontWeight: "700" },
  stageTitleActive: { fontWeight: "900" },
  stageMeta: { fontSize: 12, fontWeight: "800" },
  stageDetail: { fontSize: 11.5, lineHeight: 15 },
  miniTrack: { height: 5, borderRadius: 999, overflow: "hidden", marginTop: 5 },
  miniFill: { height: "100%", borderRadius: 999 },
  chips: { flexDirection: "row", gap: 7 },
  chip: { flex: 1, minWidth: 0, borderRadius: 13, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 6, alignItems: "center" },
  chipValue: { fontSize: 17, lineHeight: 21, fontWeight: "900" },
  chipLabel: { fontSize: 10, fontWeight: "700", marginTop: 1 },
  footer: { gap: 10, marginTop: 2 },
  awakeRow: { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingHorizontal: 2 },
  awakeText: { flex: 1, fontSize: 11.5, lineHeight: 16 },
  stopBtn: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  stopText: { fontSize: 14, fontWeight: "800" },
  stopCard: { borderRadius: 16, borderWidth: 1, padding: 13, gap: 6 },
  stopTitle: { fontSize: 14.5, fontWeight: "900" },
  stopBody: { fontSize: 12, lineHeight: 17 },
  stopActions: { flexDirection: "row", gap: 8, marginTop: 6 },
  stopAction: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stopActionText: { fontSize: 13.5, fontWeight: "800" },
});
