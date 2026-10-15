// components/premium/PremiumPill.js
//
// "Premium" rozeti: bir özelliğin ücretsiz planda kapalı olduğunu söyleyen küçük
// elmaslı hap. Ayarlar satırlarında (kar, ambiyans, ikon arka planı, pet, simge) ve Hub
// vitrin kartlarında aynı dili konuşmak için tek bileşen.
//
// Yalnız görünüm: dokunma davranışını çağıran taraf verir (satırın kendisi zaten
// yükseltme sayfasını açar), bu yüzden kendi başına basılabilir değildir.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "@theme/colors";

export default function PremiumPill({ label = "Premium", color, tone, style }) {
  const { theme } = useTheme();
  const tint = color || theme.accent;
  // `tone="onDark"`: koyu/gradyan zemin (Hub kartları) — açık renkli cam hap.
  const onDark = tone === "onDark";
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: onDark ? "rgba(255,255,255,0.18)" : alpha(tint, 0.14),
          borderColor: onDark ? "rgba(255,255,255,0.34)" : alpha(tint, 0.4),
        },
        style,
      ]}
    >
      <AppIcon family="Ionicons" name="diamond" size={10} color={onDark ? "#FFFFFF" : tint} />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.text, { color: onDark ? "#FFFFFF" : tint }]}
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
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
});
