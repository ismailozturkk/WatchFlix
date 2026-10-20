// components/common/GlassCloseButton.js
//
// Alt sayfa / modal / panel başlıklarındaki "Kapat" (veya "Geri") düğmesi.
// iOS 26+'da Liquid Glass yuvarlak düğme, diğer her yerde ÇAĞIRANIN eski kutusu
// (aynı boyut, köşe, zemin, çerçeve) — yani cam yokken görünüm değişmez.
//
// GlassIconButton'ın ince bir kabuğu: otuz küsur başlıkta aynı beş şeyi
// (ikon, boyut, eski köşe, eski zemin, erişilebilirlik etiketi) elle yazmak
// yerine tek yerde tutar.
//
//   <GlassCloseButton onPress={onClose} backgroundColor={theme.primary} />
//   <GlassCloseButton icon="chevron-back" … />          // geri
//
// `onImage`: fotoğraf/degrade üstündeki beyaz ikonlu düğme. Cam yolunda temadan
// bağımsız KOYU cam; cam yokken `backgroundColor` düz zemin olarak aynen kalır
// (eski görünüm blur değil, yarı saydam koyu katmandı).
import React, { memo } from "react";
import GlassIconButton from "./GlassIconButton";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";

function GlassCloseButton({
  onPress,
  icon = "close",
  size = 34,
  fallbackRadius = 12,
  iconSize = 18,
  color,
  backgroundColor,
  borderColor,
  onImage = false,
  accessibilityLabel,
  ...rest
}) {
  const { theme } = useTheme();

  const fallbackStyle = onImage
    ? { backgroundColor: backgroundColor ?? "rgba(0,0,0,0.45)" }
    : {
        backgroundColor: backgroundColor ?? theme.primary,
        ...(borderColor ? { borderColor, borderWidth: 1 } : null),
      };

  return (
    <GlassIconButton
      icon={icon}
      iconSize={iconSize}
      size={size}
      fallbackRadius={fallbackRadius}
      variant={onImage ? "blur" : "solid"}
      flatFallback={onImage}
      color={color ?? (onImage ? "#FFFFFF" : theme.text.muted)}
      fallbackStyle={fallbackStyle}
      onPress={onPress}
      accessibilityLabel={
        accessibilityLabel ??
        (icon === "close" ? i18nText("autoI18n.kapat", "Kapat") : i18nText("autoI18n.geri", "Geri"))
      }
      {...rest}
    />
  );
}

export default memo(GlassCloseButton);
