// components/common/GlassPillButton.js
//
// Etiketli (ve/veya ikonlu) hap düğme: iOS 26+'da Liquid Glass, diğer her
// yerde ÇAĞIRANIN eski kutusu. Yüzen eylem düğmeleri ve ekran köşesindeki
// küçük hap kontroller için (GlassIconButton'ın etiketli karşılığı).
//
//   <GlassPillButton label="Grubu Oluştur" icon="checkmark-circle"
//     tint={color} fallbackStyle={{ backgroundColor: color }} … />
//
// Cam kuralları (bkz. GlassSurface):
//   • cam yüzeye / atalarına `opacity` verme → devre dışı görünüm cam yolunda
//     opaklıkla DEĞİL, nötr ton + soluk içerik rengiyle verilir; opaklık yalnız
//     eski yolda uygulanır
//   • RN gölgesi/elevation `fallbackStyle`a konur (cam kendi gölgesini çizer)
//   • basma geri bildirimini cam kendi `interactive` animasyonuyla verir
import React, { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassSurface from "./GlassSurface";
import { useTheme } from "../../context/ThemeContext";
import { useGlassShape, useLiquidGlass } from "../../services/liquidGlass";

function GlassPillButton({
  label,
  icon,
  iconSize = 18,
  onPress,
  tint,
  color = "#FFFFFF",
  disabledColor,
  height = 48,
  paddingHorizontal = 18,
  gap = 8,
  fontSize = 15,
  fallbackRadius = 18,
  fallbackStyle,
  loading = false,
  disabled = false,
  hitSlop,
  accessibilityLabel,
  style,
  children,
}) {
  const { theme } = useTheme();
  const glass = useLiquidGlass();
  // Android buzlu camında da şekil hap (cam ile aynı dil).
  const shaped = useGlassShape();
  const inactive = disabled || loading;
  // Cam yolunda opaklık yok: devre dışı = ton kalkar, içerik soluklaşır.
  const contentColor = disabled && glass ? disabledColor ?? theme.text.muted : color;

  const content =
    children ??
    (loading ? (
      <ActivityIndicator color={contentColor} />
    ) : (
      <>
        {icon ? <Ionicons name={icon} size={iconSize} color={contentColor} /> : null}
        {label ? (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.label, { color: contentColor, fontSize }]}
          >
            {label}
          </Text>
        ) : null}
      </>
    ));

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        style,
        !glass && disabled && styles.disabledFallback,
        !glass && !disabled && pressed && styles.pressedFallback,
      ]}
    >
      <GlassSurface
        radius={shaped ? height / 2 : fallbackRadius}
        tint={disabled ? undefined : tint}
        interactive={!inactive}
        fallbackStyle={fallbackStyle}
        style={[styles.pill, { height, paddingHorizontal, gap }]}
      >
        {content}
      </GlassSurface>
    </Pressable>
  );
}

export default memo(GlassPillButton);

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  label: { fontWeight: "800", letterSpacing: 0.1 },
  disabledFallback: { opacity: 0.4 },
  pressedFallback: { opacity: 0.85 },
});
