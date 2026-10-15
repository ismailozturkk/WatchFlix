// screens/onboarding/OnboardingChrome.js
//
// Slaytların ÜSTÜNDE duran sabit parçalar:
//   OnboardingHeader  — marka, "Atla", dil + hikâye tarzı ilerleme çubuğu
//   OnboardingNavDock — geri + "Devam Et" (alt)
//   OnboardingCtaDock — "Kayıt ol" + "Giriş yap" (son slaytta aynı yerde)
// Üst gradyan kaydırılan içeriğin başlığın altından geçerken karışmasını önler.

import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassIconButton from "../../components/common/GlassIconButton";
import {
  AuthFooterLink,
  AuthPrimaryButton,
} from "../../components/auth/AuthKit";
import { alpha } from "../../theme/colors";

const { width } = Dimensions.get("window");
const SIDE = 20;
const SEG_GAP = 5;

export const HEADER_BODY = 62; // üst çubuk + ilerleme yüksekliği (inset hariç)
export const DOCK_BODY = 138; // alt çubuk yüksekliği (inset hariç)

// ── İlerleme: hikâye tarzı bölmeli çubuk ─────────────────────────────────────
function Segment({ index, scrollX, accent, track, segW }) {
  const fill = useMemo(
    () =>
      scrollX.interpolate({
        inputRange: [(index - 1) * width, index * width],
        outputRange: [-segW, 0],
        extrapolate: "clamp",
      }),
    [scrollX, index, segW],
  );
  return (
    <View style={[styles.segment, { backgroundColor: track }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: accent, transform: [{ translateX: fill }] },
        ]}
      />
    </View>
  );
}

function OnboardingProgress({ count, scrollX, accent, track }) {
  const segW = (width - SIDE * 2 - SEG_GAP * (count - 1)) / count;
  return (
    <View style={styles.progress} accessibilityRole="progressbar" pointerEvents="none">
      {Array.from({ length: count }, (_, i) => (
        <Segment key={i} index={i} scrollX={scrollX} accent={accent} track={track} segW={segW} />
      ))}
    </View>
  );
}

// ── Üst çubuk ────────────────────────────────────────────────────────────────
export function OnboardingHeader({
  theme,
  accent,
  isLightTheme,
  topInset,
  logo,
  copy,
  language,
  onToggleLanguage,
  showSkip,
  onSkip,
  count,
  scrollX,
}) {
  const chip = {
    backgroundColor: alpha(theme.secondary, isLightTheme ? 0.92 : 0.7),
    borderColor: alpha(theme.border, 0.85),
  };
  return (
    <View style={[styles.header, { paddingTop: topInset + 8 }]} pointerEvents="box-none">
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(theme.primary, 0.97), alpha(theme.primary, 0.86), alpha(theme.primary, 0)]}
        locations={[0, 0.74, 1]}
        style={[StyleSheet.absoluteFill, { bottom: -18 }]}
      />
      <View style={styles.headerRow} pointerEvents="box-none">
        <View style={styles.brand} pointerEvents="none">
          <Image source={logo} style={styles.brandLogo} />
          <Text allowFontScaling={false} style={[styles.brandText, { color: theme.text.primary }]}>
            See<Text style={{ color: accent }}>logd</Text>
          </Text>
        </View>

        <View style={styles.headerActions} pointerEvents="box-none">
          {showSkip && (
            <Pressable
              accessibilityRole="button"
              onPress={onSkip}
              hitSlop={8}
              style={({ pressed }) => [styles.chip, chip, pressed && { opacity: 0.7 }]}
            >
              <Text maxFontSizeMultiplier={1.15} style={[styles.chipText, { color: theme.text.secondary }]}>
                {copy.skip}
              </Text>
              <Ionicons name="play-forward" size={11} color={theme.text.muted} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.language}
            onPress={onToggleLanguage}
            hitSlop={8}
            style={({ pressed }) => [styles.chip, chip, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="globe-outline" size={14} color={accent} />
            <Text maxFontSizeMultiplier={1.15} style={[styles.chipText, { color: theme.text.primary }]}>
              {(language || "tr").toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </View>

      <OnboardingProgress
        count={count}
        scrollX={scrollX}
        accent={accent}
        track={alpha(theme.text.muted, isLightTheme ? 0.22 : 0.26)}
      />
    </View>
  );
}

// ── Alt çubuk: geri + devam ──────────────────────────────────────────────────
const BACK_W = 58;

export function OnboardingNavDock({
  theme,
  accent,
  isLightTheme,
  bottomInset,
  copy,
  label,
  showBack,
  onBack,
  onNext,
  visible,
}) {
  // Geri düğmesi genişliği yumuşakça açılır; "Devam" düğmesi yerini ona bırakır.
  const backOpen = useRef(new Animated.Value(showBack ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(backOpen, {
      toValue: showBack ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [showBack, backOpen]);

  return (
    <View
      style={[styles.dock, { paddingBottom: bottomInset + 14 }]}
      pointerEvents={visible ? "box-none" : "none"}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(theme.primary, 0), alpha(theme.primary, 0.97), theme.primary]}
        locations={[0, 0.24, 0.5]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.dockRow}>
        <Animated.View
          style={{
            width: backOpen.interpolate({ inputRange: [0, 1], outputRange: [0, BACK_W + 10] }),
            opacity: backOpen,
            overflow: "hidden",
          }}
          pointerEvents={showBack ? "auto" : "none"}
        >
          <GlassIconButton
            icon="arrow-back"
            iconSize={21}
            size={BACK_W}
            fallbackRadius={18}
            accessibilityLabel={copy.back}
            onPress={onBack}
          />
        </Animated.View>
        <View style={styles.nextWrap}>
          <AuthPrimaryButton label={label} accent={accent} onPress={onNext} />
        </View>
      </View>
    </View>
  );
}

// ── Son slayt: kayıt / giriş ─────────────────────────────────────────────────
export function OnboardingCtaDock({
  theme,
  accent,
  bottomInset,
  cta,
  visible,
  onRegister,
  onLogin,
}) {
  return (
    <View
      style={[styles.dock, { paddingBottom: bottomInset + 12 }]}
      pointerEvents={visible ? "box-none" : "none"}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(theme.primary, 0), alpha(theme.primary, 0.97), theme.primary]}
        locations={[0, 0.24, 0.5]}
        style={StyleSheet.absoluteFill}
      />
      <AuthPrimaryButton label={cta.register} accent={accent} onPress={onRegister} />
      <AuthFooterLink
        theme={theme}
        accent={accent}
        text={cta.haveAccount}
        link={cta.login}
        onPress={onLogin}
      />
      <View style={styles.trust}>
        <Ionicons name="shield-checkmark" size={12} color={theme.text.muted} />
        <Text maxFontSizeMultiplier={1.15} style={[styles.trustText, { color: theme.text.muted }]}>
          {cta.trust}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingHorizontal: SIDE,
    paddingBottom: 6,
  },
  headerRow: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 7 },
  brandLogo: { width: 28, height: 28 },
  brandText: { fontSize: 18, fontWeight: "900", letterSpacing: -0.4 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  chip: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  progress: { flexDirection: "row", gap: SEG_GAP, marginTop: 12 },
  segment: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },

  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingHorizontal: SIDE,
    paddingTop: 30,
    gap: 10,
  },
  dockRow: { flexDirection: "row", alignItems: "center" },
  nextWrap: { flex: 1 },
  trust: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  trustText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
});
