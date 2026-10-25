// components/common/GlassPressable.js
//
// Pressable'ın YERİNE GEÇEN düğme: iOS 26+'da kendi dolgu/çerçeve/köşe stili
// Liquid Glass'a, Android'de buzlu cam katmanına devredilir; iOS 18–25 ve Efektler
// Kapalı'da birebir Pressable çizilir.
// `style` ve `children` Pressable gibi FONKSİYON da olabilir ({ pressed }).
//
// Cam yolunda basılı-durum saydamlığı kalkar (stildeki `opacity` düşer): cam
// kendi `isInteractive` animasyonunu oynar. Buzlu camda saydamlık KALIR (Android'de
// opaklık kuralı yok). Stil kuralları utils/glassChrome.js'te.
//
// Ek prop'lar: glass={false} (cam olmasın), glassTint (ton zorla).
import React, { forwardRef } from "react";
import { Pressable } from "react-native";
import useGlassChrome from "./useGlassChrome";

const GlassPressable = forwardRef(function GlassPressable(
  { style, children, glass = true, glassTint, onLayout, ...rest },
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
      <Pressable ref={ref} style={style} onLayout={onLayout} {...rest}>
        {children}
      </Pressable>
    );
  }

  const content =
    typeof children === "function"
      ? (state) => chrome.wrap(children(state))
      : chrome.wrap(children);

  return (
    <Pressable ref={ref} style={chrome.style} onLayout={chrome.onLayout} {...rest}>
      {content}
    </Pressable>
  );
});

export default GlassPressable;
