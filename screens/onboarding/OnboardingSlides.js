// screens/onboarding/OnboardingSlides.js
//
// Üç slayt türü:
//   DiscoverSlide  — poster duvarının önünde büyük karşılama (ilk slayt)
//   ShowcaseSlide  — başlık + canlı uygulama önizlemesi (AI, profil)
//   CtaSlide       — son slayt: poster yelpazesi + faydalar (düğmeler alt çubukta)
// Kişiselleştirme slaytları OnboardingPreferences.js'te.

import React, { useEffect, useState } from "react";
import { Animated, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import LottieView from "lottie-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { alpha } from "../../theme/colors";
import { RadialGlow } from "./OnboardingBackdrop";
import {
  COMPACT,
  FeatureHeading,
  PAGE_W,
  SIDE_PAD,
  renderAccentedTitle,
  slideBottom,
  slideTop,
  useSlideParallax,
} from "./OnboardingParts";

const DISCOVER_LOTTIE = require("@lottie/dizi_film_animation.json");

// ── 1) Karşılama ─────────────────────────────────────────────────────────────
export function DiscoverSlide({
  feature,
  theme,
  accent,
  topInset,
  bottomInset,
  scrollX,
  slideIndex,
  hasPosters,
}) {
  const parallax = useSlideParallax(scrollX, slideIndex);
  return (
    <View style={{ width: PAGE_W, flex: 1 }}>
      {/* Metnin okunması için aşağı doğru koyulaşan perde */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          alpha(theme.primary, 0.55),
          alpha(theme.primary, 0.05),
          alpha(theme.primary, 0.72),
          alpha(theme.primary, 0.96),
          theme.primary,
        ]}
        locations={[0, 0.22, 0.5, 0.7, 0.86]}
        style={StyleSheet.absoluteFill}
      />

      {/* Poster duvarı gelene (ya da hiç gelmezse) yedek animasyon */}
      {!hasPosters && (
        <View
          pointerEvents="none"
          style={[styles.lottieWrap, { top: slideTop(topInset) }]}
        >
          <LottieView source={DISCOVER_LOTTIE} style={styles.lottie} autoPlay loop />
        </View>
      )}

      <View style={[styles.discoverBody, { paddingBottom: slideBottom(bottomInset) - 44 }]}>
        <Animated.View style={[{ width: "100%" }, parallax.head]}>
          <FeatureHeading
            eyebrow={feature.eyebrow}
            title={feature.title}
            titleAccent={feature.titleAccent}
            desc={feature.desc}
            tags={feature.tags}
            icon={feature.icon}
            theme={theme}
            accent={accent}
            size={COMPACT ? 32 : 36}
          />
        </Animated.View>
      </View>
    </View>
  );
}

// ── 2) Başlık + uygulama önizlemesi ──────────────────────────────────────────
export function ShowcaseSlide({
  feature,
  Mock,
  mockProps,
  theme,
  accent,
  isLightTheme,
  topInset,
  bottomInset,
  scrollX,
  slideIndex,
  active,
}) {
  const parallax = useSlideParallax(scrollX, slideIndex);

  // Ağır önizleme yalnız slayt görünür/komşu olunca kurulur; bir kez kurulunca
  // sökülmez (geri kaydırmada titreme olmasın).
  const [mounted, setMounted] = useState(!!active);
  useEffect(() => {
    if (active && !mounted) setMounted(true);
  }, [active, mounted]);

  return (
    <View style={{ width: PAGE_W, flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{
          paddingHorizontal: SIDE_PAD,
          paddingTop: slideTop(topInset),
          paddingBottom: slideBottom(bottomInset),
        }}
      >
        <Animated.View style={parallax.head}>
          <FeatureHeading
            eyebrow={feature.eyebrow}
            title={feature.title}
            titleAccent={feature.titleAccent}
            desc={feature.desc}
            icon={feature.icon}
            theme={theme}
            accent={accent}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.stage,
            {
              backgroundColor: alpha(theme.secondary, isLightTheme ? 0.6 : 0.42),
              borderColor: alpha(accent, 0.22),
            },
            parallax.stage,
          ]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={[alpha(accent, isLightTheme ? 0.1 : 0.16), "transparent"]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 0.7 }}
            style={StyleSheet.absoluteFill}
          />
          {mounted ? <Mock {...mockProps} /> : <View style={{ height: 320 }} />}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── 3) Son slayt ─────────────────────────────────────────────────────────────
function PosterFan({ posters, theme, accent, logo }) {
  const cards = posters.slice(0, 3);
  const scale = COMPACT ? 0.72 : 0.86;

  if (!cards.length) {
    return (
      <View style={[styles.fan, { height: 170 * scale + 20 }]}>
        <RadialGlow color={accent} size={300} opacity={0.5} style={styles.fanGlow} />
        <View
          style={[
            styles.logoTile,
            { backgroundColor: alpha(accent, 0.12), borderColor: alpha(accent, 0.28) },
          ]}
        >
          <Image source={logo} style={styles.logoTileImage} />
        </View>
      </View>
    );
  }

  // Yelpaze 280 pt genişlikte; kart 104 pt → ortadaki kart left: 88.
  const placement = [
    { left: 22, top: 30, rotate: "-12deg", scale: 0.9, z: 1 },
    { left: 88, top: 8, rotate: "0deg", scale: 1, z: 3 },
    { left: 154, top: 30, rotate: "12deg", scale: 0.9, z: 2 },
  ];

  return (
    <View style={[styles.fan, { height: 215 * scale }]}>
      <RadialGlow color={accent} size={330} opacity={0.5} style={styles.fanGlow} />
      <View style={{ width: 280, height: 215, transform: [{ scale }], alignItems: "center" }}>
        {cards.map((uri, i) => {
          const p = placement[i];
          return (
            <View
              key={`${uri}-${i}`}
              style={[
                styles.fanCard,
                {
                  left: p.left,
                  top: p.top,
                  zIndex: p.z,
                  borderColor: alpha(theme.text.primary, 0.18),
                  transform: [{ rotate: p.rotate }, { scale: p.scale }],
                },
              ]}
            >
              <ExpoImage source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.4)"]} style={StyleSheet.absoluteFill} />
            </View>
          );
        })}
        <View
          style={[
            styles.fanBadge,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <Image source={logo} style={styles.fanBadgeLogo} />
          <Text allowFontScaling={false} style={[styles.fanBadgeText, { color: theme.text.primary }]}>
            See<Text style={{ color: accent }}>logd</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

export function CtaSlide({
  cta,
  theme,
  accent,
  isLightTheme,
  topInset,
  bottomInset,
  posters,
  logo,
  scrollX,
  slideIndex,
}) {
  const parallax = useSlideParallax(scrollX, slideIndex);
  return (
    <ScrollView
      style={{ width: PAGE_W }}
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentContainerStyle={[
        styles.ctaScroll,
        { paddingTop: slideTop(topInset), paddingBottom: bottomInset + 200 },
      ]}
    >
      <Animated.View style={[styles.ctaInner, parallax.head]}>
        <PosterFan posters={posters} theme={theme} accent={accent} logo={logo} />

        <View
          style={[
            styles.freeBadge,
            { backgroundColor: alpha(accent, isLightTheme ? 0.1 : 0.14), borderColor: alpha(accent, 0.26) },
          ]}
        >
          <Ionicons name="sparkles" size={13} color={accent} />
          <Text style={[styles.freeBadgeText, { color: accent }]}>{cta.freeBadge}</Text>
        </View>

        <Text style={[styles.ctaTitle, { color: theme.text.primary }]}>
          {renderAccentedTitle(cta.title, cta.titleAccent, accent)}
        </Text>
        <Text style={[styles.ctaDesc, { color: theme.text.secondary }]}>{cta.desc}</Text>

        <View
          style={[
            styles.benefits,
            {
              backgroundColor: alpha(theme.secondary, isLightTheme ? 0.85 : 0.6),
              borderColor: alpha(theme.border, 0.9),
            },
          ]}
        >
          {cta.benefits.map((benefit, i) => (
            <View
              key={benefit.text}
              style={[
                styles.benefit,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
              ]}
            >
              <View style={[styles.benefitIcon, { backgroundColor: alpha(accent, 0.14) }]}>
                <Ionicons name={benefit.icon} size={16} color={accent} />
              </View>
              <Text style={[styles.benefitText, { color: theme.text.primary }]}>{benefit.text}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Karşılama
  discoverBody: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: SIDE_PAD,
  },
  lottieWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  lottie: { width: 280, height: 280 },

  // Önizleme sahnesi
  stage: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    borderRadius: 30,
    borderWidth: 1,
    marginTop: 22,
    padding: 12,
    overflow: "hidden",
    alignItems: "center",
  },

  // Son slayt
  ctaScroll: { alignItems: "center", paddingHorizontal: SIDE_PAD },
  ctaInner: { width: "100%", maxWidth: 400, alignItems: "center" },
  fan: { width: 300, alignItems: "center", justifyContent: "center" },
  fanGlow: { position: "absolute" },
  fanCard: {
    position: "absolute",
    width: 104,
    height: 156,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 14,
    elevation: 8,
  },
  fanBadge: {
    position: "absolute",
    bottom: 0,
    zIndex: 5,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 5,
  },
  fanBadgeLogo: { width: 20, height: 20 },
  fanBadgeText: { fontSize: 13, fontWeight: "900", letterSpacing: -0.2 },
  logoTile: {
    width: 142,
    height: 142,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoTileImage: { width: 104, height: 104 },
  freeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  freeBadgeText: { fontSize: 10.5, fontWeight: "900", letterSpacing: 0.9 },
  ctaTitle: {
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "900",
    letterSpacing: -0.8,
    textAlign: "center",
    marginTop: 14,
  },
  ctaDesc: {
    maxWidth: 340,
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 10,
  },
  benefits: {
    width: "100%",
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 14,
  },
  benefit: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  benefitIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: { flex: 1, fontSize: 13.5, fontWeight: "700", lineHeight: 18 },
});
