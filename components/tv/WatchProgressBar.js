import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { i18nText } from "../../utils/i18nText";

const CHIP_BACKGROUND = "rgba(0, 0, 0, 0.5)";

export default function WatchProgressBar({
  watched = 0,
  total = 0,
  startColor,
  endColor,
  trackColor,
  style,
}) {
  const safeTotal = Math.max(0, Number(total) || 0);
  if (safeTotal === 0) return null;

  const safeWatched = Math.min(safeTotal, Math.max(0, Number(watched) || 0));
  const percent = Math.round((safeWatched / safeTotal) * 100);

  return (
    <View style={[styles.track, { backgroundColor: trackColor }, style]}>
      {percent > 0 && (
        <View style={[styles.fill, { width: `${percent}%` }]}>
          <LinearGradient
            colors={[startColor, endColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <View pointerEvents="none" style={styles.labelRow}>
        <View style={styles.chip}>
          <Text allowFontScaling={false} style={styles.count}>
            <Text style={styles.countValue}>{safeWatched}</Text>
            {" / "}
            {safeTotal} {i18nText("autoI18n.bolum_birim", "bölüm")}
          </Text>
        </View>
        <View style={styles.chip}>
          <Text allowFontScaling={false} style={styles.percent}>
            {percent}%
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 12,
    overflow: "hidden",
  },
  labelRow: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 5,
  },
  chip: {
    backgroundColor: CHIP_BACKGROUND,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 9,
  },
  count: { fontSize: 11, lineHeight: 15, fontWeight: "700", color: "#FFFFFF" },
  countValue: { fontSize: 12.5, fontWeight: "900" },
  percent: { fontSize: 12, lineHeight: 15, fontWeight: "900", color: "#FFFFFF" },
});
