// components/profile/YearlyGoalTrackCard.js
//
// Hedef sayfasındaki TEK hat (film ya da dizi) için kart. Kapalıyken yalnız başlık + anahtar;
// açıkken (yukarıdan aşağıya):
//   ölçü seçimi (yalnız dizi: "Dizi sayısı" | "Bölüm sayısı") → açıklama → hedef ayarı
//   (− / + basılı tutunca hızlanır, hazır çipler) → ilerleme çubuğu (PLAN İŞARETLİ) + tempo
//   rozeti → plan hücreleri (kalan, haftada, ayda, yıl sonu tahmini).
//
// Kart TASLAK üzerinde çalışır: hedef değiştikçe çubuk, tempo ve plan hücreleri anında yeni
// hedefe göre yeniden hesaplanır (`progress` sayfadan taslakla gelir) — kullanıcı kaydetmeden
// önce hedefin gerçekçi olup olmadığını görür. Sayım (`count`) gerçek izleme verisidir.
//
// Metin kutusu BİLEREK YOK: hedef küçük bir tam sayı; stepper + hazır çipler yeter, klavye sayfayı
// sıkıştırmaz.

import React, { memo, useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import SwitchToggle from "@components/SwitchToggle";
import { alpha } from "../../theme/colors";
import { GOAL_LIMITS, GOAL_PRESETS, GOAL_STEPS } from "../../utils/yearlyGoal";
import YearlyGoalBar from "./YearlyGoalBar";
import { paceVisualOf, SHOW_MEASURE_ORDER } from "./yearlyGoalTheme";
import { fillCopy, formatGoalNumber, formatPercent, unitLabel } from "./yearlyGoalCopy";
import GlassPressable from "../common/GlassPressable";
import GlassBox from "../common/GlassBox";

const HOLD_DELAY_MS = 380;
const HOLD_SLOW_MS = 110;
const HOLD_FAST_MS = 70;
// Bu kadar adımdan sonra basılı tutma hızlanır (adım × 5): 24'ten 100'e makul sürede çıkılsın.
const HOLD_ACCEL_AFTER = 12;

/** Basılı tutarken tekrarlayan adım. `apply(direction, fast)` kararlı bir işlev olmalı. */
function useHoldStep(apply) {
  const timer = useRef(null);
  const ticks = useRef(0);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(
    (direction) => {
      stop();
      ticks.current = 0;
      apply(direction, false);
      const run = () => {
        ticks.current += 1;
        const fast = ticks.current > HOLD_ACCEL_AFTER;
        apply(direction, fast);
        timer.current = setTimeout(run, fast ? HOLD_FAST_MS : HOLD_SLOW_MS);
      };
      timer.current = setTimeout(run, HOLD_DELAY_MS);
    },
    [apply, stop],
  );

  // Sayfa tutarken kapanırsa zamanlayıcı sızmasın.
  useEffect(() => stop, [stop]);
  return { start, stop };
}

const StepButton = memo(function StepButton({ testID, icon, label, disabled, onHoldStart, onHoldEnd, theme }) {
  return (
    <GlassPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPressIn={onHoldStart}
      onPressOut={onHoldEnd}
      hitSlop={6}
      style={({ pressed }) => [
        styles.stepButton,
        {
          backgroundColor: pressed ? alpha(theme.accent, 0.22) : theme.secondary,
          borderColor: pressed ? alpha(theme.accent, 0.6) : theme.border,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={theme.text.primary} />
    </GlassPressable>
  );
});

function StatCell({ testID, value, label, theme }) {
  return (
    <View testID={testID} style={[styles.statCell, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[styles.statValue, { color: theme.text.primary }]}
      >
        {value}
      </Text>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[styles.statLabel, { color: theme.text.muted }]}
      >
        {label}
      </Text>
    </View>
  );
}

function YearlyGoalTrackCard({
  track,
  theme,
  language,
  copy,
  draft,
  count,
  progress,
  color,
  icon,
  onToggle,
  onStep,
  onMeasure,
  onTarget,
}) {
  const { on, kind, measure, target } = draft;
  const limits = GOAL_LIMITS[kind];
  const step = GOAL_STEPS[kind];

  const applyStep = useCallback(
    (direction, fast) => onStep(track, direction * step * (fast ? 5 : 1)),
    [onStep, track, step],
  );
  const hold = useHoldStep(applyStep);

  const toggleLabel = track === "movies" ? copy.sheet.toggleMovies : copy.sheet.toggleShows;
  const hint = track === "movies" ? copy.tracks.movies.hint : copy.measures[measure].hint;
  const unit = unitLabel(copy, kind);
  const visual = progress ? paceVisualOf(progress.pace) : null;
  const dash = copy.stats.none;

  let paceText = null;
  if (progress) {
    paceText =
      progress.pace === "ahead" || progress.pace === "behind"
        ? fillCopy(copy.pace[progress.pace], { n: Math.abs(progress.paceDelta) })
        : copy.pace[progress.pace === "done" ? "done" : "onTrack"];
  }

  const cells = [];
  if (progress) {
    if (progress.done) {
      cells.push({ id: "over", value: `+${progress.over}`, label: copy.stats.over });
    } else {
      cells.push({ id: "remaining", value: String(progress.remaining), label: copy.stats.remaining });
      cells.push({
        id: "perWeek",
        value: progress.perWeekNeeded == null ? dash : `~${formatGoalNumber(progress.perWeekNeeded, language)}`,
        label: copy.stats.perWeek,
      });
      cells.push({
        id: "perMonth",
        value: progress.perMonthNeeded == null ? dash : `~${formatGoalNumber(progress.perMonthNeeded, language)}`,
        label: copy.stats.perMonth,
      });
    }
    cells.push({
      id: "projected",
      value: progress.projected == null ? dash : `~${progress.projected}`,
      label: copy.stats.projected,
    });
  }

  return (
    <GlassBox role="card"
      testID={`yearly-goal-track-${track}`}
      style={[
        styles.card,
        { backgroundColor: theme.between, borderColor: on ? alpha(color, 0.5) : theme.border },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconTile, { backgroundColor: alpha(color, 0.18) }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
            {toggleLabel}
          </Text>
          {on && progress ? (
            <Text
              testID={`yearly-goal-sofar-${track}`}
              style={[styles.subtitle, { color: theme.text.muted }]}
              numberOfLines={1}
            >
              {fillCopy(copy.stats.soFar, { n: count })} · {formatPercent(progress.percent, language)}
            </Text>
          ) : (
            <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={2}>
              {hint}
            </Text>
          )}
        </View>
        <SwitchToggle
          testID={`yearly-goal-toggle-${track}`}
          value={on}
          onValueChange={(value) => onToggle(track, value)}
          size={30}
          accessibilityLabel={toggleLabel}
        />
      </View>

      {on ? (
        <View style={styles.body}>
          {track === "shows" ? (
            <View style={styles.measureBlock}>
              <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{copy.sheet.measureLabel}</Text>
              <View style={styles.measureRow}>
                {SHOW_MEASURE_ORDER.map((id) => {
                  const selected = id === measure;
                  return (
                    <Pressable
                      key={id}
                      testID={`yearly-goal-measure-${id}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => onMeasure(id)}
                      style={[
                        styles.measureChip,
                        {
                          backgroundColor: selected ? alpha(color, 0.18) : theme.secondary,
                          borderColor: selected ? color : theme.border,
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                        style={[styles.measureText, { color: selected ? theme.text.primary : theme.text.secondary }]}
                      >
                        {copy.measures[id].name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text testID="yearly-goal-hint" style={[styles.hint, { color: theme.text.muted }]}>
                {hint}
              </Text>
            </View>
          ) : null}

          {/* ── Hedef ── */}
          <View style={styles.stepper}>
            <StepButton
              testID={`yearly-goal-decrease-${track}`}
              icon="remove"
              label={copy.sheet.decrease}
              disabled={target <= limits.min}
              onHoldStart={() => hold.start(-1)}
              onHoldEnd={hold.stop}
              theme={theme}
            />
            <View style={styles.targetBox}>
              <Text
                testID={`yearly-goal-target-${track}`}
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.targetValue, { color: theme.text.primary }]}
              >
                {target}
              </Text>
              <Text style={[styles.targetUnit, { color: theme.text.muted }]} numberOfLines={1}>
                {unit}
              </Text>
            </View>
            <StepButton
              testID={`yearly-goal-increase-${track}`}
              icon="add"
              label={copy.sheet.increase}
              disabled={target >= limits.max}
              onHoldStart={() => hold.start(1)}
              onHoldEnd={hold.stop}
              theme={theme}
            />
          </View>

          <View style={styles.presetRow}>
            {GOAL_PRESETS[kind].map((value) => {
              const selected = value === target;
              return (
                <Pressable
                  key={value}
                  testID={`yearly-goal-preset-${track}-${value}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onTarget(track, value)}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: selected ? alpha(color, 0.18) : theme.secondary,
                      borderColor: selected ? color : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.presetText, { color: selected ? theme.text.primary : theme.text.secondary }]}>
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── İlerleme + plan ── */}
          {progress ? (
            <View style={styles.progressBlock}>
              <YearlyGoalBar
                ratio={progress.ratio}
                markerRatio={progress.done ? null : progress.expectedRatio}
                color={progress.done ? "#FBBF24" : color}
                trackColor={alpha(theme.text.muted, 0.22)}
                markerColor={theme.text.primary}
              />
              <View style={styles.progressRow}>
                <Text
                  testID={`yearly-goal-plan-${track}`}
                  style={[styles.planText, { color: theme.text.muted }]}
                  numberOfLines={1}
                >
                  {progress.done ? "" : fillCopy(copy.stats.planToday, { n: progress.planToday })}
                </Text>
                <View style={[styles.paceChip, { backgroundColor: alpha(visual.color, 0.16) }]}>
                  <Ionicons name={visual.icon} size={13} color={visual.color} />
                  <Text
                    testID={`yearly-goal-pace-${track}`}
                    style={[styles.paceText, { color: theme.text.primary }]}
                    numberOfLines={1}
                  >
                    {paceText}
                  </Text>
                </View>
              </View>

              <View style={styles.cells}>
                {cells.map((cell) => (
                  <StatCell
                    key={cell.id}
                    testID={`yearly-goal-stat-${track}-${cell.id}`}
                    value={cell.value}
                    label={cell.label}
                    theme={theme}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </GlassBox>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconTile: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 15, fontWeight: "800" },
  subtitle: { fontSize: 11.5, lineHeight: 15, fontWeight: "600" },

  body: { marginTop: 14, gap: 14 },
  measureBlock: { gap: 8 },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  measureRow: { flexDirection: "row", gap: 8 },
  measureChip: {
    flex: 1,
    minWidth: 0,
    height: 38,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  measureText: { fontSize: 13, fontWeight: "800" },
  hint: { fontSize: 11.5, lineHeight: 16, fontWeight: "600" },

  stepper: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  targetBox: { flex: 1, minWidth: 0, alignItems: "center" },
  // adjustsFontSizeToFit BİLEREK YOK: alignItems:"center" içindeki otomatik genişlikli metinde iOS, sığdırmayı
  // genişlik ölçülmeden yapıp sayıyı minimuma (çok küçük) indiriyordu. En geniş hedef 4 hane (9999) ≈ 100 pt;
  // kutu 320 pt ekranda bile ~130 pt, yani sığdırmaya gerek yok.
  targetValue: {
    textAlign: "center", fontSize: 40, lineHeight: 46, fontWeight: "900", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  targetUnit: { fontSize: 11.5, fontWeight: "700", marginTop: -2 },

  presetRow: { flexDirection: "row", gap: 8 },
  presetChip: {
    flex: 1,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  presetText: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },

  progressBlock: { gap: 10 },
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  planText: { flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: "600" },
  paceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: "62%",
  },
  paceText: { fontSize: 12, fontWeight: "800", flexShrink: 1 },

  cells: { flexDirection: "row", gap: 8 },
  statCell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    gap: 1,
  },
  statValue: { fontSize: 15, fontWeight: "900", fontVariant: ["tabular-nums"], maxWidth: "100%" },
  statLabel: { fontSize: 10.5, fontWeight: "700", maxWidth: "100%" },
});

export default memo(YearlyGoalTrackCard);
