// components/BackButton.js
//
// Ekran içine yerleştirilen tutarlı geri butonu. Native header oku yerine
// kullanılır (ilgili ekranlarda headerShown:false yapılır).
//
// Üç varyant:
//   variant="solid" (varsayılan) → düz/temalı zeminler için theme.secondary kutu
//   variant="blur"               → backdrop görsel üzeri ekranlar için koyu blur
//   variant="plain"              → zeminsiz yalın ok (kutusuz başlıklar)
//
// iOS 26+'da (Liquid Glass) her varyant yuvarlak cam düğme olur — sistemin
// kendi geri düğmesiyle aynı dil. Diğer platformlarda/sürümlerde eski kutu
// görünümü aynen kalır (bkz. components/common/GlassIconButton.js).
//
// Varsayılan olarak SafeArea üst boşluğuna göre absolute konumlanır (sol üst).
// `absolute={false}` verilirse satır içi (header içinde) kullanılabilir.

import React, { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlassIconButton from "./common/GlassIconButton";
import { i18nText } from "../utils/i18nText";

export default function BackButton({
  onPress,
  iconName = "chevron-back",
  variant = "solid",
  color,
  absolute = true,
  top,
  style,
}) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Geri gidilemiyorsa (ör. tab kökü / ilk ekran) ve özel onPress yoksa gizle.
  // Değer yalnızca ekran odaklıyken tazelenir: stack kökündeki bir ekran,
  // üstüne başka ekran push'luyken arka planda re-render olursa canGoBack()
  // true döner ve buton dönüşte "hayalet" olarak görünür kalırdı. Odak
  // dışındayken son değer dondurulur, odak gelince yeniden değerlendirilir.
  const [canGoBack, setCanGoBack] = useState(
    () => navigation?.canGoBack?.() ?? true,
  );
  useEffect(() => {
    if (!navigation?.addListener) return undefined;
    const update = () => setCanGoBack(navigation.canGoBack?.() ?? true);
    update();
    return navigation.addListener("focus", update);
  }, [navigation]);

  if (!onPress && !canGoBack) return null;

  const handlePress = onPress || (() => navigation.goBack());
  const positionStyle = absolute
    ? {
        position: "absolute",
        top: top != null ? top : insets.top + 8,
        left: 16,
        zIndex: 50,
        elevation: 50,
      }
    : null;

  return (
    <GlassIconButton
      icon={iconName}
      variant={variant === "blur" || variant === "plain" ? variant : "solid"}
      color={color}
      onPress={handlePress}
      accessibilityLabel={i18nText("autoI18n.geri", "Geri")}
      style={[positionStyle, style]}
    />
  );
}
