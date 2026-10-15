// components/friends/RoundIconButton.js
//
// Satır içi, YALNIZ ikonlu yuvarlak düğme (38 px — eski 34 px düğmelerden büyük,
// parmakla rahat vurulur). İkonlu düğme etiketsiz olduğu için `accessibilityLabel`
// ZORUNLU: ekran okuyucu "düğme" yerine eylemi söylesin.

import React, { memo } from "react";
import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "@theme/colors";

function RoundIconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone,
  variant = "soft",
  size = 38,
}) {
  const { theme } = useTheme();
  const color = tone || theme.accent;
  const ghost = variant === "ghost";

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: ghost ? "transparent" : alpha(color, 0.15),
          borderColor: ghost ? alpha(theme.border, 0.9) : "transparent",
          opacity: pressed ? 0.78 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={Math.round(size * 0.48)}
        color={ghost ? theme.text?.secondary ?? "#aaa" : color}
      />
    </Pressable>
  );
}

export default memo(RoundIconButton);

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
