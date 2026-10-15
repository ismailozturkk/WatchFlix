// components/friends/PillButton.js
//
// Arkadaş ekranlarının ortak, ETİKETLİ düğmesi. Eskiden her eylem yalnız ikonlu
// 34 px'lik yuvarlaktı (✓ ✕ 🗑): ne yaptığı okunmuyor, parmakla zor vuruluyordu.
//
//   variant="primary" → dolu, vurgu rengi (ana eylem: Kabul et, Ekle)
//   variant="soft"    → renkli ton + yarı saydam zemin (ikincil: Mesaj, Geri al)
//   variant="ghost"   → çerçeveli, zemin yok (vazgeçilebilir: Reddet)
//   tone              → soft/primary için renk (varsayılan: tema vurgusu)

import React, { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "@theme/colors";

const SIZES = {
  sm: { height: 34, paddingX: 14, font: 12.5, icon: 15, gap: 5 },
  md: { height: 44, paddingX: 18, font: 14, icon: 17, gap: 7 },
};

function PillButton({
  label,
  icon,
  onPress,
  variant = "soft",
  tone,
  size = "md",
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}) {
  const { theme } = useTheme();
  const dim = SIZES[size] || SIZES.md;
  const color = tone || theme.accent;

  let backgroundColor;
  let foreground;
  let borderColor = "transparent";
  if (variant === "primary") {
    backgroundColor = color;
    foreground = "#FFFFFF";
  } else if (variant === "ghost") {
    backgroundColor = "transparent";
    foreground = theme.text?.secondary ?? "#aaa";
    borderColor = alpha(theme.border, 0.95);
  } else {
    backgroundColor = alpha(color, 0.15);
    foreground = color;
  }

  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === "sm" ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          height: dim.height,
          paddingHorizontal: dim.paddingX,
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed && !inactive ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <View style={[styles.content, { gap: dim.gap }]}>
          {icon ? <Ionicons name={icon} size={dim.icon} color={foreground} /> : null}
          {label ? (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.label, { color: foreground, fontSize: dim.font }]}
            >
              {label}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

export default memo(PillButton);

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  label: { fontWeight: "800", letterSpacing: 0.1 },
});
