// components/libraryImport/RestoreVisuals.js
//
// Kütüphaneni İçe Aktar ekranının hareketli parçaları (screens/tabs/settings/LibraryImportScreen.js).
//
// Reanimated kuralı (bkz. bellek "reanimated ilk-değer kaybolması"): kalıcı yüzeylerde animasyonlu stilin İLK /
// dinlenme değeri GÖRÜNÜR olur (ölçek 1, opaklık > 0). Nabız halkası 0'da tam görünür başlar; çubuk o anki
// oranla başlar (0'dan değil); bitiş rozeti `entering` düzen animasyonuyla gelir. Hareket azaltma açıkken hiçbir
// döngü çalışmaz, her şey son hâliyle çizilir.

import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import AppIcon from "../AppIcon";
import LensLoader from "../LensLoader";
import { alpha } from "../../theme/colors";
import { PosterThumb } from "../import/ImportProgressView";

/* ── Küre: boşta nabız, çalışırken dönen yay, bitince onay ─────────────────────── */

const ORB = 92;

function PulseRing({ color, delay, active, reduceMotion }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(t);
      t.value = 0;
      return undefined;
    }
    const start = setTimeout(() => {
      t.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false);
    }, delay);
    return () => {
      clearTimeout(start);
      cancelAnimation(t);
    };
  }, [active, delay, reduceMotion, t]);
  // t = 0 → görünür, ölçek 1 (dinlenme değeri görünür).
  const style = useAnimatedStyle(() => ({
    opacity: 0.32 * (1 - t.value),
    transform: [{ scale: 1 + t.value * 0.55 }],
  }));
  return <Animated.View pointerEvents="none" style={[s.ring, { borderColor: color }, style]} />;
}

function SpinArc({ color, active, reduceMotion }) {
  const turn = useSharedValue(0);
  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(turn);
      turn.value = 0;
      return undefined;
    }
    turn.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [active, reduceMotion, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  if (!active) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[s.arc, { borderTopColor: color, borderRightColor: alpha(color, 0.35) }, style]}
    />
  );
}

/**
 * @param {{ C: object, mode: "idle"|"busy"|"done"|"error", reduceMotion?: boolean }} props
 */
export function RestoreOrb({ C, mode, reduceMotion }) {
  const color = mode === "error" ? C.amber : mode === "done" ? C.green : C.accent;
  const icon =
    mode === "done" ? "checkmark" : mode === "error" ? "pause" : mode === "busy" ? "cloud-download-outline" : "archive-outline";
  return (
    <View style={s.orbWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <PulseRing color={color} delay={0} active={mode === "idle" || mode === "busy"} reduceMotion={reduceMotion} />
      <PulseRing color={color} delay={1100} active={mode === "idle" || mode === "busy"} reduceMotion={reduceMotion} />
      <SpinArc color={color} active={mode === "busy"} reduceMotion={reduceMotion} />
      <View style={[s.orb, { backgroundColor: alpha(color, 0.16), borderColor: alpha(color, 0.4) }]}>
        <Animated.View key={mode} entering={reduceMotion ? undefined : ZoomIn.springify().damping(13)}>
          <AppIcon family="Ionicons" name={icon} size={36} color={color} />
        </Animated.View>
      </View>
    </View>
  );
}

/* ── Sayı: 0'dan hedefe akar (JS; hareket azaltmada doğrudan son değer) ─────────── */

export function CountUp({ value, style, reduceMotion, duration = 750 }) {
  const target = Math.max(0, Number(value) || 0);
  const [shown, setShown] = useState(reduceMotion ? target : 0);
  const frame = useRef(null);
  useEffect(() => {
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;
    if (reduceMotion || !raf || target === 0) {
      setShown(target);
      return undefined;
    }
    const startAt = Date.now();
    const step = () => {
      const p = Math.min(1, (Date.now() - startAt) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(target * eased));
      if (p < 1) frame.current = raf(step);
    };
    frame.current = raf(step);
    return () => {
      if (frame.current != null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame.current);
    };
  }, [duration, reduceMotion, target]);
  return (
    <Text allowFontScaling={false} style={style}>
      {shown.toLocaleString()}
    </Text>
  );
}

/* ── İlerleme çubuğu ───────────────────────────────────────────────────────────── */

export function ProgressBar({ C, ratio, color, reduceMotion, height = 6 }) {
  const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
  const width = useSharedValue(clamped); // o anki oranla başlar
  useEffect(() => {
    width.value = reduceMotion ? clamped : withTiming(clamped, { duration: 380, easing: Easing.out(Easing.cubic) });
  }, [clamped, reduceMotion, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View style={[s.track, { height, borderRadius: height / 2, backgroundColor: C.closeBg }]}>
      <Animated.View style={[s.fill, { borderRadius: height / 2, backgroundColor: color || C.accent }, style]} />
    </View>
  );
}

/* ── Aşama listesi ────────────────────────────────────────────────────────────── */

/**
 * stages: [{ id, label, status: "pending"|"active"|"done", done?, total? }]
 */
export function StageList({ C, stages, reduceMotion, progressText }) {
  return (
    <View style={s.stages}>
      {stages.map((stage, index) => {
        const active = stage.status === "active";
        const done = stage.status === "done";
        const ratio = stage.total ? stage.done / stage.total : 0;
        return (
          <Animated.View
            key={stage.id}
            entering={reduceMotion ? undefined : FadeInDown.delay(index * 70).duration(300)}
            style={[s.stage, active && { backgroundColor: alpha(C.accent, 0.08), borderColor: alpha(C.accent, 0.3) }]}
          >
            <View
              style={[
                s.stageDot,
                done
                  ? { backgroundColor: C.green, borderColor: C.green }
                  : active
                    ? { borderColor: C.accent }
                    : { borderColor: C.border },
              ]}
            >
              {done ? (
                <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(240)}>
                  <AppIcon family="Ionicons" name="checkmark" size={13} color={C.white} />
                </Animated.View>
              ) : active ? (
                <LensLoader size="small" color={C.accent} />
              ) : null}
            </View>
            <View style={s.stageBody}>
              <View style={s.stageTop}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[s.stageLabel, { color: done || active ? C.text : C.muted }, active && s.stageLabelActive]}
                >
                  {stage.label}
                </Text>
                {active && stage.total ? (
                  <Text allowFontScaling={false} style={[s.stageCount, { color: C.accentStrong }]}>
                    {progressText(stage.done, stage.total)}
                  </Text>
                ) : null}
              </View>
              {active && stage.total ? <ProgressBar C={C} ratio={ratio} reduceMotion={reduceMotion} height={4} /> : null}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

/* ── Seçim satırı: sayı, oran çubuğu, onay kutusu (dokununca yaylanır) ───────────── */

export function SectionToggle({ C, icon, tone, title, amount, ratio, selected, onToggle, index, reduceMotion, last }) {
  const press = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const percent = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80 + index * 55).duration(320)}>
      <Animated.View style={style}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!selected }}
          accessibilityLabel={`${title}, ${amount}`}
          onPressIn={() => {
            if (!reduceMotion) press.value = withTiming(0.97, { duration: 90 });
          }}
          onPressOut={() => {
            press.value = reduceMotion ? 1 : withSpring(1, { damping: 12, stiffness: 260 });
          }}
          onPress={onToggle}
          style={[s.toggle, { borderBottomColor: C.borderMuted }, last && { borderBottomWidth: 0 }]}
        >
          <View style={[s.toggleIcon, { backgroundColor: tone[0], opacity: selected ? 1 : 0.45 }]}>
            <AppIcon family="Ionicons" name={icon} size={17} color={tone[1]} />
          </View>
          <View style={s.toggleBody}>
            <Text allowFontScaling={false} numberOfLines={1} style={[s.toggleTitle, { color: selected ? C.text : C.muted }]}>
              {title}
            </Text>
            <View style={[s.toggleTrack, { backgroundColor: C.closeBg }]}>
              <View style={[s.toggleFill, { width: percent, backgroundColor: selected ? tone[1] : alpha(C.muted, 0.45) }]} />
            </View>
          </View>
          <View
            style={[
              s.check,
              selected ? { backgroundColor: C.accent, borderColor: C.accent } : { backgroundColor: "transparent", borderColor: C.border },
            ]}
          >
            {selected ? <AppIcon family="Ionicons" name="checkmark" size={14} color={C.white} /> : null}
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/* ── Bitiş: yelpaze afişler ───────────────────────────────────────────────────── */

const FAN = [
  { rotate: "-10deg", y: 10 },
  { rotate: "-5deg", y: 3 },
  { rotate: "0deg", y: 0 },
  { rotate: "5deg", y: 3 },
  { rotate: "10deg", y: 10 },
];

export function PosterFan({ posters, theme, reduceMotion }) {
  const shown = (Array.isArray(posters) ? posters : []).slice(0, FAN.length);
  if (shown.length < 2) return null;
  const offset = Math.floor((FAN.length - shown.length) / 2);
  const middle = Math.floor(shown.length / 2);
  return (
    <View style={s.fan}>
      {shown.map((path, index) => {
        const slot = FAN[index + offset];
        return (
          <Animated.View
            key={path}
            entering={reduceMotion ? undefined : FadeInDown.delay(160 + index * 80).springify().damping(14)}
            style={[s.fanItem, { zIndex: index === middle ? 5 : index, transform: [{ rotate: slot.rotate }, { translateY: slot.y }] }]}
          >
            <PosterThumb path={path} width={60} height={90} radius={10} theme={theme} />
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Bitiş sayı kutuları: sırayla belirir, sayılar akar. items: [{ id, value, label, color }] */
export function SummaryTiles({ C, items, reduceMotion }) {
  return (
    <View style={s.tiles}>
      {items.map((item, index) => (
        <Animated.View
          key={item.id}
          entering={reduceMotion ? undefined : FadeIn.delay(260 + index * 90).duration(320)}
          style={[s.tile, { backgroundColor: C.card, borderColor: C.border }]}
        >
          <CountUp value={item.value} reduceMotion={reduceMotion} style={[s.tileValue, { color: item.color || C.text }]} />
          <Text allowFontScaling={false} numberOfLines={1} style={[s.tileLabel, { color: C.muted }]}>
            {item.label}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  orbWrap: { width: ORB + 44, height: ORB + 44, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  ring: { position: "absolute", width: ORB, height: ORB, borderRadius: ORB / 2, borderWidth: 2 },
  arc: {
    position: "absolute",
    width: ORB + 14,
    height: ORB + 14,
    borderRadius: (ORB + 14) / 2,
    borderWidth: 3,
    borderColor: "transparent",
  },
  orb: { width: ORB, height: ORB, borderRadius: ORB / 2, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  track: { width: "100%", overflow: "hidden" },
  fill: { height: "100%" },
  stages: { gap: 8 },
  stage: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "transparent" },
  stageDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  stageBody: { flex: 1, gap: 6 },
  stageTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  stageLabel: { flexShrink: 1, fontSize: 13.5, fontWeight: "600" },
  stageLabelActive: { fontWeight: "800" },
  stageCount: { fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  toggleIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  toggleBody: { flex: 1, gap: 7 },
  toggleTitle: { fontSize: 14, fontWeight: "700" },
  toggleTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  toggleFill: { height: "100%", borderRadius: 2 },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  fan: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", height: 112, marginTop: 4 },
  fanItem: { marginHorizontal: -8, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { flexGrow: 1, flexBasis: "30%", minWidth: 92, borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 10, alignItems: "center", gap: 2 },
  tileValue: { fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] },
  tileLabel: { fontSize: 11.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
});
