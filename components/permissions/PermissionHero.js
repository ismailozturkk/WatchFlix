// components/permissions/PermissionHero.js
//
// İzin sayfalarının üst sahnesi: degrade rozet + iki yayılan halka. Görsel dili
// bildirim ön-açıklamasıyla (NotificationBellHero) aynı; o sayfaya bağlı çipler
// burada yok, çünkü sahne her izin ve durum için kullanılıyor (`icon`, `tone`).
// `animate=false` ("Hareketi Azalt") iken halkalar sabit ve silik durur.

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { alpha } from "../../theme/colors";
import { isLightSurface, shiftLightness } from "../../utils/colorUtils";

export { SheetGlow } from "../notifications/NotificationBellHero";

const BADGE = 76;
const BADGE_RADIUS = 26;
const RIPPLE_MAX_SCALE = 1.55;

function Ripple({ color, delay, animate }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!animate) return undefined;
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [animate, delay, progress]);

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 1], [0, 0.5, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, RIPPLE_MAX_SCALE]) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ripple, { borderColor: color }, animate ? rippleStyle : styles.rippleStill]}
    />
  );
}

export default function PermissionHero({ icon, tone, animate = true }) {
  const foreground = isLightSurface(tone) ? "#111827" : "#FFFFFF";
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.stage}
    >
      <Ripple color={tone} delay={0} animate={animate} />
      <Ripple color={tone} delay={1300} animate={animate} />
      <View style={[styles.badgeShadow, { backgroundColor: tone, shadowColor: tone }]}>
        <LinearGradient
          colors={[shiftLightness(tone, 10), tone, shiftLightness(tone, -14)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.badge}
        >
          <View style={[styles.sheen, { backgroundColor: alpha("#FFFFFF", 0.16) }]} />
          <AppIcon name={icon} size={36} color={foreground} />
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { height: BADGE * RIPPLE_MAX_SCALE + 8, alignItems: "center", justifyContent: "center" },
  ripple: {
    position: "absolute",
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE_RADIUS,
    borderWidth: 1.5,
  },
  rippleStill: { opacity: 0.22, transform: [{ scale: 1.2 }] },
  badgeShadow: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE_RADIUS,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 8,
  },
  badge: {
    flex: 1,
    borderRadius: BADGE_RADIUS,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  sheen: { position: "absolute", top: 0, left: 0, right: 0, height: BADGE / 2 },
});
