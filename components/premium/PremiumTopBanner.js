// components/premium/PremiumTopBanner.js
//
// Free kullanıcının her ekranın en üstünde gördüğü ince "Premium'a geç" şeridi. Dokununca
// ödeme ekranı (PremiumScreen, source "top_banner") açılır. Kim / nerede kuralları
// utils/premiumTopBanner.js'de; ekranın üstüne yerleştiren katman PremiumTopBannerLayout.
//
// Boyut: 36 px tek satır — dikkat çeksin ama içeriği itip rahatsız etmesin.
//
// Premium hissi:
//   • Akan degrade: indigo → mor → fuşya → pembe, şerit genişliğinin 3 katı bir katmanda
//     yavaşça sola kayar (dikişsiz döngü, ≈9 sn).
//   • Arada bir (≈4,5 sn) geçen ışık süpürmesi, üstte 1 px cam parlaması.
//   • Altın parıltı ikonu hafifçe nabız atar; sağda beyaz "Yükselt" hapı.
//   • Basınca yaylı küçülme, altında mor gölge.
//
// Hareket yalnız ekran odaktayken ve "Hareketi Azalt" kapalıyken, native sürücüde çalışır;
// kapalıyken şerit durağan degradeyle eksiksiz çizilir.

import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import useReduceMotion from "@hooks/useReduceMotion";
import { normalizeAppLanguage } from "@utils/appLanguages";
import {
  PREMIUM_TOP_BANNER_COLORS,
  PREMIUM_TOP_BANNER_GOLD,
  PREMIUM_TOP_BANNER_HEIGHT,
  PREMIUM_TOP_BANNER_SOURCE,
  PREMIUM_TOP_BANNER_SUBTITLE_MIN_WIDTH,
  premiumTopBannerAccessibilityLabel,
  premiumTopBannerCopy,
  premiumTopBannerFlowGeometry,
  premiumTopBannerFlowStops,
} from "@utils/premiumTopBanner";
import { useLanguage } from "../../context/LanguageContext";

const FLOW_MS = 9000;
const SWEEP_PAUSE_MS = 3200;
const SWEEP_MS = 1300;
const PULSE_MS = 1100;
const FLOW_STOPS = premiumTopBannerFlowStops();

export default function PremiumTopBanner() {
  const navigation = useNavigation();
  const focused = useIsFocused();
  const reduceMotion = useReduceMotion();
  const { language } = useLanguage();
  const lang = normalizeAppLanguage(language);
  const copy = premiumTopBannerCopy(lang);

  const press = useRef(new Animated.Value(1)).current;
  const flow = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(360);

  const animate = focused && !reduceMotion;
  useEffect(() => {
    if (!animate) {
      flow.setValue(0);
      sweep.setValue(0);
      pulse.setValue(0);
      return undefined;
    }
    const loops = [
      Animated.loop(
        Animated.timing(flow, {
          toValue: 1,
          duration: FLOW_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.delay(SWEEP_PAUSE_MS),
          Animated.timing(sweep, {
            toValue: 1,
            duration: SWEEP_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: PULSE_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: PULSE_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [animate, flow, sweep, pulse]);

  const springTo = (toValue, bounciness) =>
    Animated.spring(press, { toValue, speed: 40, bounciness, useNativeDriver: true }).start();

  const { layerWidth, period } = premiumTopBannerFlowGeometry(width);
  const flowX = flow.interpolate({ inputRange: [0, 1], outputRange: [0, -period] });
  const shineX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-70, width + 30] });
  const sparkScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const sparkRotate = pulse.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "10deg"] });
  const showSubtitle = width >= PREMIUM_TOP_BANNER_SUBTITLE_MIN_WIDTH;

  return (
    <Animated.View style={[styles.shadow, { transform: [{ scale: press }] }]}>
      <Pressable
        testID="premium-top-banner"
        onPress={() => navigation.navigate("PremiumScreen", { source: PREMIUM_TOP_BANNER_SOURCE })}
        onPressIn={() => springTo(0.97, 0)}
        onPressOut={() => springTo(1, 6)}
        accessibilityRole="button"
        accessibilityLabel={premiumTopBannerAccessibilityLabel(lang)}
        hitSlop={{ top: 4, bottom: 4 }}
      >
        <View style={styles.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {/* Akan degrade: 3 genişlik boyunca tekrarlanan renkler, bir periyot kayar */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.flowLayer,
              { width: layerWidth, transform: [{ translateX: animate ? flowX : 0 }] },
            ]}
          >
            <LinearGradient
              colors={FLOW_STOPS}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          {/* Cam parlaması: üst yarıda soluk beyaz + 1 px ışık çizgisi */}
          <View pointerEvents="none" style={styles.gloss} />
          <View pointerEvents="none" style={styles.topLine} />
          {animate ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.shine, { transform: [{ translateX: shineX }, { rotate: "20deg" }] }]}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.32)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          ) : null}

          <View style={styles.content}>
            <View style={styles.sparkTile}>
              <Animated.View
                style={{ transform: [{ scale: sparkScale }, { rotate: sparkRotate }] }}
              >
                <AppIcon name="sparkles" size={14} color={PREMIUM_TOP_BANNER_GOLD} />
              </Animated.View>
            </View>
            <Text allowFontScaling={false} numberOfLines={1} style={styles.title}>
              {copy.title}
            </Text>
            {showSubtitle ? (
              <>
                <View style={styles.dot} />
                <Text allowFontScaling={false} numberOfLines={1} style={styles.subtitle}>
                  {copy.subtitle}
                </Text>
              </>
            ) : null}
            <View style={styles.spacer} />
            <View style={styles.cta}>
              <Text allowFontScaling={false} numberOfLines={1} style={styles.ctaText}>
                {copy.cta}
              </Text>
              <AppIcon name="arrow-forward" size={12} color={PREMIUM_TOP_BANNER_COLORS[1]} />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const RADIUS = 14;

const styles = StyleSheet.create({
  // Gölge dış kapta: içteki şerit kırpar (overflow hidden), gölge kırpılmasın.
  shadow: {
    borderRadius: RADIUS,
    backgroundColor: PREMIUM_TOP_BANNER_COLORS[1],
    shadowColor: PREMIUM_TOP_BANNER_COLORS[1],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  bar: {
    height: PREMIUM_TOP_BANNER_HEIGHT,
    borderRadius: RADIUS,
    overflow: "hidden",
    justifyContent: "center",
  },
  flowLayer: { position: "absolute", top: 0, bottom: 0, left: 0 },
  gloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  topLine: {
    position: "absolute",
    top: 0,
    left: RADIUS,
    right: RADIUS,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  shine: { position: "absolute", top: -16, bottom: -16, width: 40 },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 6,
    paddingRight: 5,
  },
  sparkTile: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.35)",
    marginRight: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.7)",
    marginHorizontal: 7,
  },
  subtitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  spacer: { flex: 1, minWidth: 8 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 26,
    paddingHorizontal: 11,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  ctaText: {
    color: PREMIUM_TOP_BANNER_COLORS[1],
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
});
