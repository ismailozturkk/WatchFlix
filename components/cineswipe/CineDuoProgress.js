// components/cineswipe/CineDuoProgress.js
//
// Duo oyun içi ilerleme: kendi ve arkadaşının kaç karta oy verdiği. Eski ekran
// yalnız "7/20" yazıyordu ve arkadaşın durumu yalnızca SEN bitirince görünüyordu.
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { alpha } from "../../theme/colors";

function Bar({ value, total, color, track }) {
  const progress = useSharedValue(0);
  const ratio = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;

  useEffect(() => {
    progress.value = withTiming(ratio * 100, { duration: 420 });
  }, [ratio, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value}%` }));
  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

/**
 * @param {number} youCount       Senin oy verdiğin kart sayısı.
 * @param {number} partnerCount   Arkadaşının oy verdiği kart sayısı.
 * @param {string} statusText     "Seçimin kaydediliyor…" / hata / boş (canlı bölge).
 */
export default function CineDuoProgress({ youCount, partnerCount, total, partnerName, statusText, copy, colors }) {
  const track = alpha(colors.text, 0.1);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {copy.progress.you}
        </Text>
        <Bar value={youCount} total={total} color={colors.accent} track={track} />
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {youCount}/{total}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {partnerName || copy.progress.partner}
        </Text>
        <Bar value={partnerCount} total={total} color={colors.like} track={track} />
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {partnerCount}/{total}
        </Text>
      </View>
      {statusText ? (
        <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.textSecondary }]}>
          {statusText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 6,
    gap: 7,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: {
    width: 74,
    fontSize: 12,
    fontWeight: "800",
  },
  track: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  count: {
    width: 44,
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "right",
  },
  status: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    minHeight: 16,
  },
});
