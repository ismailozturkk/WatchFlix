// components/game/ui.js
//
// Oyun ekranlarının ortak küçük yapı taşları. Amaç: Oyun Merkezi, detay,
// kurulum ve sonuç ekranları aynı dili konuşsun (aynı basma hissi, aynı çip,
// aynı bölüm başlığı) ve her ekran kendi kopyasını yazmasın.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { alpha } from "../../theme/colors";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { mass: 0.4, damping: 14, stiffness: 220 };

/**
 * Basınca yayla küçülen Pressable. `style` dizi/nesne olabilir (fonksiyon
 * DEĞİL). Dokunma geri bildirimi tüm oyun yüzeylerinde aynı olsun diye tek yer.
 */
export function PressableScale({ children, style, scaleTo = 0.97, onPressIn, onPressOut, ...rest }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        scale.value = withSpring(scaleTo, SPRING);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, SPRING);
        onPressOut?.(event);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Üst köşede yumuşak vurgu ışığı — düz arka plana derinlik verir. */
export function GlowBackdrop({ color, height = 260, opacity = 0.2 }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[alpha(color, opacity), alpha(color, 0)]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={[styles.glow, { height }]}
    />
  );
}

/** İkon + değer + (isteğe bağlı) etiket: küçük istatistik hapı. */
export function StatPill({ icon, iconColor, value, label, theme, tone = "surface", style }) {
  const onDark = tone === "glass";
  const bg = onDark ? "rgba(0,0,0,0.22)" : theme.primary;
  const border = onDark ? "rgba(255,255,255,0.14)" : theme.border;
  const valueColor = onDark ? "#FFFFFF" : theme.text.primary;
  const labelColor = onDark ? "rgba(255,255,255,0.72)" : theme.text.muted;
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: border }, style]}>
      {icon ? <AppIcon family="Ionicons" name={icon} size={14} color={iconColor || valueColor} /> : null}
      <Text style={[styles.pillValue, { color: valueColor }]} allowFontScaling={false} numberOfLines={1}>
        {value}
      </Text>
      {label ? (
        <Text style={[styles.pillLabel, { color: labelColor }]} allowFontScaling={false} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/** Bölüm başlığı + (isteğe bağlı) sağ aksiyon. */
export function SectionHeader({ title, action, onAction, theme, style }) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={[styles.sectionTitle, { color: theme.text.muted }]} allowFontScaling={false}>
        {title}
      </Text>
      {action ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onAction} style={styles.sectionActionWrap}>
          <Text style={[styles.sectionAction, { color: theme.accent }]} allowFontScaling={false}>
            {action}
          </Text>
          <AppIcon family="Ionicons" name="chevron-forward" size={13} color={theme.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Dolu/boş ilerleme çubuğu (ince). */
export function MiniProgress({ ratio, color, trackColor, height = 6, style }) {
  const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
  return (
    <View style={[{ height, borderRadius: height / 2, overflow: "hidden", backgroundColor: trackColor }, style]}>
      <View style={{ width: `${clamped * 100}%`, height: "100%", borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", top: 0, left: 0, right: 0 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillValue: { fontSize: 12.5, fontWeight: "900" },
  pillLabel: { fontSize: 10.5, fontWeight: "700" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  sectionActionWrap: { flexDirection: "row", alignItems: "center", gap: 2 },
  sectionAction: { fontSize: 12, fontWeight: "800" },
});
