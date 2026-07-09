// components/tournament/StageTimeline.js
//
// Turnuva hero'sundaki İNTERAKTİF aşama çizelgesi: Seçim → Son 32 → Son 16 →
// Çeyrek → Yarı → Final → Kupa. Her düğüm ikon + kısa etiket + gün aralığı
// gösterir; biten aşamalar dolu (✓), aktif aşama nabız (pulse) halkasıyla
// vurgulanır, gelecek aşamalar soluk. Düğümler arasındaki çizgi ilerlemeyle
// dolar. Oylama turu düğümlerine BASILINCA ekran o turun listesine atlar
// (onStagePress ile). Beyaz-üstüne tasarım — gradyan hero içinde kullanılır.

import React, { memo, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import AppIcon from "@components/AppIcon";
import {
  ROUNDS,
  SELECTION_DAYS,
  RESULTS_START_DAY,
  getElapsedDays,
} from "@services/tournamentEngine";

// Aşama tanımları: seçim + 5 oylama turu + sonuç. Kısa etiketler dar ekrana sığar.
const buildStages = (lang) => [
  {
    key: "selection", icon: "checkbox", roundIndex: null,
    label: lang === "tr" ? "Seçim" : "Picks",
    startDay: 0, endDay: SELECTION_DAYS,
  },
  ...ROUNDS.map((r, i) => ({
    key: r.key,
    icon: r.key === "final" ? "flame" : "git-compare",
    roundIndex: i,
    label:
      r.key === "r32" ? "32"
      : r.key === "r16" ? "16"
      : r.key === "qf" ? (lang === "tr" ? "ÇF" : "QF")
      : r.key === "sf" ? (lang === "tr" ? "YF" : "SF")
      : (lang === "tr" ? "Final" : "Final"),
    startDay: r.startDay,
    endDay: r.endDay,
  })),
  {
    key: "results", icon: "trophy", roundIndex: ROUNDS.length - 1,
    label: lang === "tr" ? "Kupa" : "Cup",
    startDay: RESULTS_START_DAY, endDay: 31,
  },
];

// Aktif düğümün nabız halkası — reanimated, JS thread'e dokunmaz.
const PulseRing = memo(() => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );
  }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - p.value),
    transform: [{ scale: 1 + p.value * 0.55 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.pulse, style]} />;
});

function StageTimeline({ periodId, nowMs, lang = "tr", onStagePress }) {
  const stages = useMemo(() => buildStages(lang), [lang]);
  const elapsed = getElapsedDays(periodId, nowMs);

  return (
    <View style={styles.row}>
      {stages.map((s, i) => {
        const done = elapsed >= s.endDay;
        const active = elapsed >= s.startDay && elapsed < s.endDay;
        const leftFilled = i > 0 && elapsed >= s.startDay;   // önceki aşama bitti
        const rightFilled = i < stages.length - 1 && done;    // bu aşama bitti
        const dayText = `${s.startDay + 1}-${Math.min(s.endDay, 31)}`;

        return (
          <Pressable
            key={s.key}
            style={styles.stage}
            onPress={() => onStagePress?.(s)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={s.label}
          >
            {/* Bağlantı çizgisi yarıları */}
            <View style={styles.lineTrack}>
              <View
                style={[
                  styles.lineHalf,
                  i === 0 && styles.lineHidden,
                  { backgroundColor: leftFilled ? "#fff" : "rgba(255,255,255,0.28)" },
                ]}
              />
              <View
                style={[
                  styles.lineHalf,
                  i === stages.length - 1 && styles.lineHidden,
                  { backgroundColor: rightFilled ? "#fff" : "rgba(255,255,255,0.28)" },
                ]}
              />
            </View>

            <View style={styles.nodeWrap}>
              {active && <PulseRing />}
              <View
                style={[
                  styles.node,
                  done && styles.nodeDone,
                  active && styles.nodeActive,
                ]}
              >
                <AppIcon
                  family="Ionicons"
                  name={done ? "checkmark" : s.icon}
                  size={active ? 15 : 12}
                  color={done || active ? "#3b3b3b" : "#fff"}
                />
              </View>
            </View>

            <Text
              numberOfLines={1}
              style={[styles.label, { opacity: done || active ? 1 : 0.62 }, active && styles.labelActive]}
            >
              {s.label}
            </Text>
            <Text style={[styles.days, { opacity: active ? 0.95 : 0.55 }]}>{dayText}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const NODE = 26;
const NODE_ACTIVE = 32;

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginTop: 14 },
  stage: { flex: 1, alignItems: "center" },

  lineTrack: {
    position: "absolute",
    top: NODE_ACTIVE / 2 - 1.25,
    left: 0,
    right: 0,
    flexDirection: "row",
  },
  lineHalf: { flex: 1, height: 2.5, borderRadius: 2 },
  lineHidden: { backgroundColor: "transparent" },

  nodeWrap: {
    width: NODE_ACTIVE,
    height: NODE_ACTIVE,
    alignItems: "center",
    justifyContent: "center",
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  nodeDone: { backgroundColor: "#fff", borderColor: "#fff" },
  nodeActive: {
    width: NODE_ACTIVE,
    height: NODE_ACTIVE,
    borderRadius: NODE_ACTIVE / 2,
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  pulse: {
    position: "absolute",
    width: NODE_ACTIVE,
    height: NODE_ACTIVE,
    borderRadius: NODE_ACTIVE / 2,
    backgroundColor: "#fff",
  },

  label: { color: "#fff", fontSize: 10, fontWeight: "800", marginTop: 5 },
  labelActive: { fontSize: 10.5 },
  days: { color: "#fff", fontSize: 8.5, fontWeight: "600", marginTop: 1 },
});

export default memo(StageTimeline);
