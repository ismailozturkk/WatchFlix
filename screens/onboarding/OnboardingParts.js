// screens/onboarding/OnboardingParts.js
//
// Slaytların ortak yapı taşları: sayfa ölçüleri, vurgulu başlık, başlık bloğu
// (FeatureHeading) ve kaydırmaya bağlı parallax stilleri.

import React, { useMemo } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { DOCK_BODY, HEADER_BODY } from "./OnboardingChrome";

export const PAGE_W = Dimensions.get("window").width;
export const SIDE_PAD = 20;
// Dar/kısa ekranlarda (iPhone SE gibi) büyük görselleri küçültmek için.
export const COMPACT = Dimensions.get("window").height < 720;

/** Slayt içeriğinin üst/alt boşluğu: sabit üst çubuğun ve alt düğmelerin altında kalmasın. */
export const slideTop = (topInset) => topInset + HEADER_BODY + 18;
export const slideBottom = (bottomInset) => bottomInset + DOCK_BODY + 26;

/** Başlığın içinde tek bir kelime/öbek vurgu rengiyle boyanır. */
export function renderAccentedTitle(title, accentWord, accentColor) {
  if (!accentWord) return title;
  const at = title.indexOf(accentWord);
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <Text style={{ color: accentColor }}>{accentWord}</Text>
      {title.slice(at + accentWord.length)}
    </>
  );
}

export function FeatureHeading({
  title,
  titleAccent,
  desc,
  theme,
  accent,
  size = 30,
}) {
  return (
    <View style={styles.copy}>
      <Text style={[styles.title, { color: theme.text.primary, fontSize: size, lineHeight: size + 5 }]}>
        {renderAccentedTitle(title, titleAccent, accent)}
      </Text>

      {!!desc && <Text style={[styles.desc, { color: theme.text.secondary }]}>{desc}</Text>}

    </View>
  );
}

/**
 * Slayt içeriği için scrollX'e bağlı stiller (native driver).
 * head: yatay kayma + solma · stage: hafif küçülme + solma
 */
export function useSlideParallax(scrollX, slideIndex) {
  return useMemo(() => {
    if (!scrollX) return { head: null, stage: null };
    const inputRange = [(slideIndex - 1) * PAGE_W, slideIndex * PAGE_W, (slideIndex + 1) * PAGE_W];
    const fade = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: "clamp" });
    return {
      head: {
        opacity: fade,
        transform: [
          {
            translateX: scrollX.interpolate({
              inputRange,
              outputRange: [PAGE_W * 0.28, 0, -PAGE_W * 0.28],
              extrapolate: "clamp",
            }),
          },
        ],
      },
      stage: {
        opacity: fade,
        transform: [
          {
            scale: scrollX.interpolate({
              inputRange,
              outputRange: [0.93, 1, 0.93],
              extrapolate: "clamp",
            }),
          },
        ],
      },
    };
  }, [scrollX, slideIndex]);
}

const styles = StyleSheet.create({
  copy: { width: "100%", maxWidth: 400, alignSelf: "center" },
  title: { fontWeight: "900", letterSpacing: -0.8 },
  desc: { fontSize: 14.5, lineHeight: 21.5, marginTop: 10 },
});
