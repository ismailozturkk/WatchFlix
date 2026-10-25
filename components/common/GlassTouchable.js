// components/common/GlassTouchable.js
//
// TouchableOpacity'nin YERİNE GEÇEN düğme: iOS 26+'da kendi dolgu/çerçeve/köşe
// stili Liquid Glass'a, Android'de buzlu cam katmanına devredilir; iOS 18–25 ve
// Efektler Kapalı'da birebir TouchableOpacity çizilir. Çağıran yer yalnız etiketi
// değiştirir:
//
//   <TouchableOpacity style={[s.btn, { backgroundColor: theme.accent }]} …>
//   <GlassTouchable   style={[s.btn, { backgroundColor: theme.accent }]} …>
//
// Cam yolunda `activeOpacity` YOK: cam yüzeyin/atalarının opaklığı animasyonlanınca
// efekt bozulur (GlassSurface kural 1); basma geri bildirimini camın kendi
// `isInteractive` animasyonu verir. Stil kuralları utils/glassChrome.js'te.
//
// Ek prop'lar (hepsi isteğe bağlı):
//   glass={false}   bu düğme cam OLMASIN (marka renkli düğme, gradyan zemin…)
//   glassTint       ton zorla (varsayılan: dolgu renginden türer)
import React, { forwardRef } from "react";
import { Pressable, TouchableOpacity } from "react-native";
import useGlassChrome from "./useGlassChrome";

const GlassTouchable = forwardRef(function GlassTouchable(
  { style, children, glass = true, glassTint, activeOpacity, onLayout, ...rest },
  ref,
) {
  const chrome = useGlassChrome(style, {
    role: "button",
    tint: glassTint,
    enabled: glass,
    interactive: true,
    catchTouches: true,
    onLayout,
  });

  if (!chrome) {
    return (
      <TouchableOpacity
        ref={ref}
        style={style}
        activeOpacity={activeOpacity}
        onLayout={onLayout}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    );
  }

  // Android buzlu cam: opaklık kuralı yok; eski dokunma geri bildirimi
  // (activeOpacity) aynen kalır, yalnız kabuk buzlu katmana devredilir.
  if (chrome.frosted) {
    return (
      <TouchableOpacity
        ref={ref}
        style={chrome.style}
        activeOpacity={activeOpacity}
        onLayout={chrome.onLayout}
        {...rest}
      >
        {chrome.wrap(children)}
      </TouchableOpacity>
    );
  }

  return (
    <Pressable
      ref={ref}
      style={chrome.style}
      onLayout={chrome.onLayout}
      accessibilityRole={rest.accessibilityRole ?? "button"}
      accessibilityState={
        rest.disabled && !rest.accessibilityState ? { disabled: true } : rest.accessibilityState
      }
      {...rest}
    >
      {chrome.wrap(children)}
    </Pressable>
  );
});

export default GlassTouchable;
