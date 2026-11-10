// components/common/BetaBadge.js
//
// Durum rozetleri (küçük hap; PremiumPill ile aynı ölçü dili). Yalnız görünüm.
//
// • BetaBadge (varsayılan): özellik henüz geliştiriliyor. Hangi özelliklerde
//   görüneceği utils/betaFeatures.js'te (tek liste). Kehribar.
// • DevBadge: yalnız geliştirme build'inde (__DEV__) çizilen araçlar (plan
//   simülatörü, Debug, test bildirimi...). Mor. Kendi de __DEV__ dışında çizilmez,
//   yani yanlışlıkla yayın build'inde görünen bir satıra konsa bile sızmaz.
//
// Renkler temadan bağımsız ki anlamları her temada aynı okunsun.
// `tone="onDark"`: gradyan/koyu kart zemini. `compact`: ikon yok, daha küçük.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";

export const BETA_COLOR = "#F59E0B";
export const DEV_COLOR = "#8B5CF6";

function StatusPill({ label, a11yLabel, icon, color, tone, compact, style }) {
  const onDark = tone === "onDark";
  const fg = onDark ? "#FFFFFF" : color;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
      style={[
        styles.pill,
        compact && styles.pillCompact,
        onDark
          ? { backgroundColor: hexAlpha(color, 0.85), borderColor: "rgba(255,255,255,0.35)" }
          : { backgroundColor: hexAlpha(color, 0.14), borderColor: hexAlpha(color, 0.45) },
        style,
      ]}
    >
      {compact ? null : <AppIcon family="Ionicons" name={icon} size={9} color={fg} />}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.text, compact && styles.textCompact, { color: fg }]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function BetaBadge({ tone, compact = false, style }) {
  return (
    <StatusPill
      label={i18nText("autoI18n.beta_rozet", "Beta").toUpperCase()}
      a11yLabel={i18nText("autoI18n.beta_rozet_aciklama", "Bu özellik hâlâ geliştiriliyor (beta)")}
      icon="flask"
      color={BETA_COLOR}
      tone={tone}
      compact={compact}
      style={style}
    />
  );
}

// Yalnız geliştiriciler görür: metin çevrilmez.
export function DevBadge({ tone, compact = false, style }) {
  if (!__DEV__) return null;
  return (
    <StatusPill
      label="DEV"
      a11yLabel="Yalnız geliştirme sürümünde"
      icon="code-slash"
      color={DEV_COLOR}
      tone={tone}
      compact={compact}
      style={style}
    />
  );
}

function hexAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
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
  text: { fontSize: 9.5, fontWeight: "900", letterSpacing: 0.8 },
  textCompact: { fontSize: 8.5, letterSpacing: 0.6 },
});
