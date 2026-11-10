// components/common/BetaBadge.js
//
// "BETA" rozeti: özelliğin henüz geliştirilmekte olduğunu söyleyen küçük hap.
// Hangi özelliklerde görüneceği utils/betaFeatures.js'te (tek liste).
// PremiumPill ile aynı ölçüler; renk temadan bağımsız kehribar ki her temada
// "bitmemiş" anlamı aynı okunsun. `tone="onDark"`: gradyan/koyu kart zemini.
//
// Yalnız görünüm; dokunma davranışı yoktur.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";

export const BETA_COLOR = "#F59E0B";

export default function BetaBadge({ tone, compact = false, style }) {
  const onDark = tone === "onDark";
  const label = i18nText("autoI18n.beta_rozet", "Beta").toUpperCase();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={i18nText("autoI18n.beta_rozet_aciklama", "Bu özellik hâlâ geliştiriliyor (beta)")}
      style={[
        styles.pill,
        compact && styles.pillCompact,
        onDark ? styles.pillOnDark : styles.pillDefault,
        style,
      ]}
    >
      {compact ? null : (
        <AppIcon family="Ionicons" name="flask" size={9} color={onDark ? "#FFFFFF" : BETA_COLOR} />
      )}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.text, compact && styles.textCompact, { color: onDark ? "#FFFFFF" : BETA_COLOR }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillCompact: { paddingHorizontal: 5, paddingVertical: 1 },
  pillDefault: { backgroundColor: "rgba(245,158,11,0.14)", borderColor: "rgba(245,158,11,0.45)" },
  pillOnDark: { backgroundColor: "rgba(245,158,11,0.85)", borderColor: "rgba(255,255,255,0.35)" },
  text: { fontSize: 9.5, fontWeight: "900", letterSpacing: 0.8 },
  textCompact: { fontSize: 8.5, letterSpacing: 0.6 },
});
