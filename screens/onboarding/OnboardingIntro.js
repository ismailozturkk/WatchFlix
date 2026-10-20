// screens/onboarding/OnboardingIntro.js
//
// Marka açılışı: logo yaylanarak belirir, "Seelogd" adı yukarı kayar, slogan ve
// özellik simgeleri gelir. Kendiliğinden biter; dokununca hemen geçilir.

import React, { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { AuthBackdrop } from "../../components/auth/AuthKit";
import { RadialGlow } from "./OnboardingBackdrop";
import useAppLogo from "@hooks/useAppLogo";
import { alpha } from "../../theme/colors";

const FEATURE_ICONS = ["film-outline", "sparkles-outline", "people-outline"];

export default function OnboardingIntro({ theme, accent, isLightTheme, copy, onDone }) {
  // Marka logosu seçili uygulama simgesini izler (hooks/useAppLogo.js).
  const { logo: appLogo } = useAppLogo();

  const overlay = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const lower = useRef(new Animated.Value(0)).current;
  const timeline = useRef(null);
  const closing = useRef(false);

  const finish = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    timeline.current?.stop();
    Animated.timing(overlay, {
      toValue: 0,
      duration: 320,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => onDone?.());
  }, [onDone, overlay]);

  useEffect(() => {
    timeline.current = Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(glow, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(word, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.back(1.3)),
        useNativeDriver: true,
      }),
      Animated.timing(lower, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.delay(520),
    ]);
    timeline.current.start(({ finished }) => {
      if (finished) finish();
    });
    return () => timeline.current?.stop();
  }, []);

  const wordStyle = {
    opacity: word,
    transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
  };

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        // Yarı saydam zemin: arkadaki poster duvarı intro'da da belli belirsiz görünür.
        { backgroundColor: alpha(theme.primary, isLightTheme ? 0.95 : 0.92), opacity: overlay },
      ]}
    >
      <AuthBackdrop accent={accent} isLightTheme={isLightTheme} />

      <Pressable
        style={styles.press}
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel={copy.introTap}
      >
        <Animated.View
          style={[
            styles.eyebrow,
            { backgroundColor: alpha(accent, 0.12), borderColor: alpha(accent, 0.3), opacity: lower },
          ]}
        >
          <View style={[styles.liveDot, { backgroundColor: accent }]} />
          <Text style={[styles.eyebrowText, { color: accent }]}>{copy.introEyebrow}</Text>
        </Animated.View>

        <View style={styles.logoWrap}>
          <Animated.View
            style={[
              styles.logoGlow,
              {
                opacity: glow,
                transform: [
                  { scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                ],
              },
            ]}
          >
            <RadialGlow color={accent} size={300} opacity={isLightTheme ? 0.4 : 0.55} />
          </Animated.View>
          <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
            <Image source={appLogo} style={styles.logo} resizeMode="contain" />
          </Animated.View>
        </View>

        <Animated.Text allowFontScaling={false} style={[styles.brand, { color: theme.text.primary }, wordStyle]}>
          See<Text style={{ color: accent }}>logd</Text>
        </Animated.Text>

        <Animated.Text style={[styles.tagline, { color: theme.text.secondary, opacity: lower }]}>
          {copy.tagline}
        </Animated.Text>

        <Animated.View style={[styles.featureRow, { opacity: lower }]}>
          {FEATURE_ICONS.map((icon) => (
            <View
              key={icon}
              style={[
                styles.featureIcon,
                {
                  backgroundColor: alpha(theme.secondary, 0.72),
                  borderColor: alpha(theme.border, 0.8),
                },
              ]}
            >
              <Ionicons name={icon} size={17} color={accent} />
            </View>
          ))}
        </Animated.View>

        <Animated.View style={[styles.tapRow, { opacity: lower }]}>
          <Text style={[styles.tapText, { color: theme.text.muted }]}>{copy.introTap}</Text>
          <LinearGradient
            pointerEvents="none"
            colors={[alpha(accent, 0), alpha(accent, 0.7), alpha(accent, 0)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.tapLine}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 50, alignItems: "center", justifyContent: "center" },
  press: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 26,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  eyebrowText: { fontSize: 10.5, fontWeight: "900", letterSpacing: 1.15 },
  logoWrap: { alignItems: "center", justifyContent: "center", marginBottom: 20 },
  logoGlow: { position: "absolute", width: 300, height: 300 },
  logo: { width: 128, height: 128 },
  brand: { fontSize: 46, fontWeight: "900", letterSpacing: -1.2 },
  tagline: {
    maxWidth: 330,
    fontSize: 15.5,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
    fontWeight: "550",
  },
  featureRow: { flexDirection: "row", gap: 9, marginTop: 26 },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tapRow: { position: "absolute", bottom: 40, alignItems: "center", gap: 8 },
  tapText: { fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },
  tapLine: { width: 72, height: 2, borderRadius: 1 },
});
