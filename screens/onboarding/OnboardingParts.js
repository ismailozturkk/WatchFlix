// screens/onboarding/OnboardingParts.js
//
// Slaytların ortak yapı taşları: sayfa ölçüleri, vurgulu başlık, başlık bloğu
// (FeatureHeading) ve kaydırmaya bağlı parallax stilleri.

import React, { useMemo } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { alpha } from "../../theme/colors";
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
  eyebrow,
  title,
  titleAccent,
  desc,
  tags = [],
  icon,
  theme,
  accent,
  size = 30,
}) {
  return (
    <View style={styles.copy}>
      <View style={styles.eyebrowRow}>
        <View style={[styles.eyebrowIcon, { backgroundColor: alpha(accent, 0.15) }]}>
          <Ionicons name={icon} size={15} color={accent} />
        </View>
        <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text>
      </View>

      <Text style={[styles.title, { color: theme.text.primary, fontSize: size, lineHeight: size + 5 }]}>
        {renderAccentedTitle(title, titleAccent, accent)}
      </Text>

      {!!desc && <Text style={[styles.desc, { color: theme.text.secondary }]}>{desc}</Text>}

      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.map((tag) => (
            <View
              key={tag}
              style={[
                styles.tag,
                { backgroundColor: alpha(accent, 0.09), borderColor: alpha(accent, 0.18) },
              ]}
            >
              <View style={[styles.tagDot, { backgroundColor: accent }]} />
              <Text style={[styles.tagText, { color: theme.text.secondary }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
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
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 },
  eyebrowIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  title: { fontWeight: "900", letterSpacing: -0.8 },
  desc: { fontSize: 14.5, lineHeight: 21.5, marginTop: 10 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 16 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagDot: { width: 4, height: 4, borderRadius: 2 },
  tagText: { fontSize: 11, fontWeight: "700" },
});
