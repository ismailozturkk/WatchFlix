// components/common/GlassIconButton.js
//
// Yuvarlak ikon düğmesi: iOS 26+'da Liquid Glass, diğer her yerde eski görünüm.
// Geri düğmesi (BackButton), poster üstü paylaş/kapat düğmeleri ve başlık
// düğmeleri için tek yapı taşı.
//
// Üç eski görünüm (cam yokken):
//   variant="solid" → tema zeminli kutu (theme.secondary + çerçeve)
//   variant="blur"  → koyu blur (poster/backdrop üstü)
//   variant="plain" → zeminsiz yalın ikon (eskiden çıplak ok olan başlıklar);
//                     cam yolunda yine yuvarlak cam düğme olur
//
// `overlay`: camın DIŞINDA, düğmenin üstüne binen öğe (okunmamış sayacı gibi).
// Cam çocuklarını şeklinin içine kırptığı için taşan öğe `children`a konamaz.
//
// `flatFallback` (yalnız variant="blur"): cam yokken blur ÇİZME, `fallbackStyle`
// düz zemin olarak kalsın — eski görünümü yarı saydam koyu katman olan
// düğmeler (galeri kapat, poster üstü kapat) için.
//
// Cam durumunda:
//   • köşe tam yuvarlak (size/2); eski görünümün 12 pt köşesi aynen korunur
//   • `isInteractive`: dokununca cam sistemin kendi esneme/parlama animasyonunu
//     oynar — bu yüzden cam yolunda ek basma saydamlığı/ölçeği YOK (cam üzerinde
//     `opacity` değişimi efekti bozar, bkz. GlassSurface kuralları)
//   • `variant="blur"` camı temadan bağımsız KOYU çizer (poster hep koyu)
import React, { memo } from "react";
import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassSurface from "./GlassSurface";
import { useTheme } from "../../context/ThemeContext";
import { useLiquidGlass } from "../../services/liquidGlass";

const DEFAULT_FALLBACK_RADIUS = 12;

function GlassIconButton({
  icon,
  iconSize,
  color,
  size = 40,
  fallbackRadius = DEFAULT_FALLBACK_RADIUS,
  variant = "solid",
  tint,
  overlay,
  fallbackStyle,
  flatFallback = false,
  onPress,
  accessibilityLabel,
  hitSlop = 8,
  disabled,
  style,
  children,
  ...rest
}) {
  const { theme } = useTheme();
  const glass = useLiquidGlass();
  const onImage = variant === "blur";
  const iconColor = color || (onImage ? "#FFFFFF" : theme.text.primary);
  const glyphSize = iconSize ?? (variant === "plain" ? 24 : 22);

  const box = { width: size, height: size };
  const surface = (
    <GlassSurface
      radius={glass ? size / 2 : fallbackRadius}
      scheme={onImage ? "dark" : undefined}
      tint={tint}
      interactive
      fallbackBlur={onImage && !flatFallback ? { tint: "dark", intensity: 60 } : undefined}
      fallbackStyle={
        fallbackStyle ??
        (onImage || variant === "plain"
          ? undefined
          : { backgroundColor: theme.secondary, borderColor: theme.border, borderWidth: 1 })
      }
      style={[styles.center, box]}
    >
      {children ?? <Ionicons name={icon} size={glyphSize} color={iconColor} />}
    </GlassSurface>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { disabled: true } : undefined}
      // Basma geri bildirimi YALNIZ cam olmayan yolda: cam kendi etkileşimini
      // taşıyor, üstüne saydamlık bindirmek efekti bozuyor.
      style={({ pressed }) => [style, !glass && pressed && styles.pressedFallback]}
      {...rest}
    >
      {surface}
      {overlay}
    </Pressable>
  );
}

export default memo(GlassIconButton);

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  pressedFallback: { opacity: 0.8 },
});
