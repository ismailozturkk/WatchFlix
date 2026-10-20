// components/cineswipe/CineCardSkeleton.js
//
// Deste yüklenirken kartın yerini tutan, nefes alan iskelet kart. Eski ekran
// ortada dönen bir gösterge gösterip kart yerleşince sıçrıyordu.
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { alpha } from "../../theme/colors";

export default function CineCardSkeleton({ width, height, colors }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 950, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const breathing = useAnimatedStyle(() => ({ opacity: 0.5 + 0.4 * pulse.value }));
  const bar = alpha(colors.text, 0.12);

  return (
    <Animated.View
      style={[styles.card, { width, height, backgroundColor: alpha(colors.surface, 0.9) }, breathing]}
    >
      <View style={styles.bottom}>
        <View style={[styles.bar, { width: "72%", height: 22, backgroundColor: bar }]} />
        <View style={styles.pills}>
          <View style={[styles.bar, { width: 52, height: 22, backgroundColor: bar }]} />
          <View style={[styles.bar, { width: 46, height: 22, backgroundColor: bar }]} />
          <View style={[styles.bar, { width: 50, height: 22, backgroundColor: bar }]} />
        </View>
        <View style={[styles.bar, { width: "100%", height: 12, backgroundColor: bar }]} />
        <View style={[styles.bar, { width: "84%", height: 12, backgroundColor: bar }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    borderRadius: 28,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  bottom: {
    padding: 20,
    gap: 12,
  },
  pills: {
    flexDirection: "row",
    gap: 8,
  },
  bar: {
    borderRadius: 8,
  },
});
