// components/cineswipe/CineWaitingRoom.js
//
// Duo bekleme odası: kod büyük rakam kutuları olarak gösterilir (kopyala / paylaş),
// arkadaş beklenirken nabız halkaları atar. Eski sürüm düz bir yazı ve dönen
// gösterge sunuyordu; kod kopyalanamıyordu.
import React, { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import AppIcon from "../AppIcon";
import PressableScale from "./PressableScale";
import { alpha } from "../../theme/colors";

function PulseRing({ color, delay }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 0.95 }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: color }, style]} />;
}

/**
 * @param {string} roomCode
 * @param {string} summary  "20 kart · Popüler & Trendler"
 */
export default function CineWaitingRoom({ roomCode, summary, onCopy, onShare, onCancel, copy, colors }) {
  const digits = String(roomCode || "").split("");

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pulse}>
        <PulseRing color={colors.accent} delay={0} />
        <PulseRing color={colors.accent} delay={1000} />
        <View style={[styles.core, { backgroundColor: alpha(colors.accent, 0.16) }]}>
          <AppIcon family="Ionicons" name="people" size={34} color={colors.accent} />
        </View>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{copy.waiting.title}</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{copy.waiting.body}</Text>

      <Text style={[styles.codeLabel, { color: colors.muted }]}>{copy.waiting.codeLabel}</Text>
      <View accessible accessibilityLabel={`${copy.waiting.codeLabel}: ${digits.join(" ")}`} style={styles.codeRow}>
        {digits.map((digit, index) => (
          <Animated.View
            key={`${index}_${digit}`}
            entering={FadeInDown.delay(index * 55).duration(320)}
            style={[styles.digit, { backgroundColor: alpha(colors.accent, 0.13), borderColor: alpha(colors.accent, 0.55) }]}
          >
            <Text style={[styles.digitText, { color: colors.accent }]}>{digit}</Text>
          </Animated.View>
        ))}
      </View>
      {summary ? <Text style={[styles.summary, { color: colors.muted }]}>{summary}</Text> : null}

      <View style={styles.actions}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={copy.waiting.copy}
          onPress={onCopy}
          style={[styles.secondary, { backgroundColor: alpha(colors.surface, 0.8), borderColor: colors.border }]}
        >
          <AppIcon family="Ionicons" name="copy-outline" size={18} color={colors.text} />
          <Text style={[styles.secondaryText, { color: colors.text }]}>{copy.waiting.copy}</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={copy.waiting.share}
          onPress={onShare}
          style={[styles.primary, { backgroundColor: colors.accent }]}
        >
          <AppIcon family="Ionicons" name="share-social-outline" size={19} color={colors.onAccent} />
          <Text style={[styles.primaryText, { color: colors.onAccent }]}>{copy.waiting.share}</Text>
        </PressableScale>
      </View>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={copy.waiting.cancel}
        onPress={onCancel}
        style={styles.cancel}
      >
        <AppIcon family="Ionicons" name="close-circle-outline" size={18} color={colors.pass} />
        <Text style={[styles.cancelText, { color: colors.pass }]}>{copy.waiting.cancel}</Text>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    alignSelf: "stretch",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  pulse: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
  },
  ring: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
  },
  core: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 300,
    marginBottom: 26,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  codeRow: {
    flexDirection: "row",
    gap: 8,
  },
  digit: {
    width: 46,
    height: 62,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  digitText: {
    fontSize: 30,
    fontWeight: "900",
  },
  summary: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 26,
  },
  secondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: "800",
  },
  primary: {
    flex: 1.3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
  },
  primaryText: {
    fontSize: 14.5,
    fontWeight: "900",
  },
  cancel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 13.5,
    fontWeight: "800",
  },
});
