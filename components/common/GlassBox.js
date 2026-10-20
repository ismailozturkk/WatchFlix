// components/common/GlassBox.js
//
// View'ın YERİNE GEÇEN kutu: iOS 26+'da kendi dolgu/çerçeve/köşe stili Liquid
// Glass'a devredilir, diğer her yerde birebir View çizilir. Yazı alanı kabukları
// (ikon + TextInput + temizle düğmesi), kartlar, bilgi şeritleri ve gruplar için.
//
//   <View style={[s.field, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
//   <GlassBox role="field" style={[s.field, { … aynı … }]}>
//
// Cam, çocukların ARKASINDA mutlak bir katmandır; çocuklar normal akışta durur
// (cam şekline kırpılmaz). Çocuklar "cam içinde" işaretlenir: içlerindeki
// GlassTouchable/GlassBox camlaşmaz (cam camı örnekleyemez).
//
// Props:
//   role      "field" | "card" | "button" — ton şiddetini seçer (varsayılan "card")
//   focused / accent  alan odaktayken cam vurgu renginde hafifçe tonlanır
//   glass={false}     bu kutu cam OLMASIN
//   glassTint         ton zorla
import React, { forwardRef } from "react";
import { View } from "react-native";
import useGlassChrome from "./useGlassChrome";
import { alpha } from "../../theme/colors";
import { GLASS_FIELD_FOCUS_TINT_ALPHA } from "../../utils/glassChrome";

const GlassBox = forwardRef(function GlassBox(
  { style, children, role = "card", focused = false, accent, glass = true, glassTint, onLayout, ...rest },
  ref,
) {
  const tint =
    glassTint ?? (focused && accent ? alpha(accent, GLASS_FIELD_FOCUS_TINT_ALPHA) : undefined);
  const chrome = useGlassChrome(style, { role, tint, enabled: glass, onLayout });

  if (!chrome) {
    return (
      <View ref={ref} style={style} onLayout={onLayout} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <View ref={ref} style={chrome.style} onLayout={chrome.onLayout} {...rest}>
      {chrome.wrap(children)}
    </View>
  );
});

export default GlassBox;
