// components/common/ScreenSafeAreaView.js
//
// Ekran kökleri için `react-native-safe-area-context` SafeAreaView'ının yerine geçen
// sarmalayıcı (aynı API). Fark tek: Free kullanıcıda ekranın üstünde yüzen Premium şeridi
// (components/premium/PremiumTopBannerLayout.js) varken üst kenara şeridin taştığı kadar
// boşluk ekler.
//
// Neden gerekli: yerel SafeAreaView güvenli alanı React bağlamından değil ekrandaki
// KONUMUNDAN okur; şeridi görmez ve içerik (başlık, geri düğmesi) şeridin altında kalırdı.
// Yerel görünüm "additive" kipte stil boşluğunu güvenli alana EKLER, bu yüzden fazlalık
// stil olarak verilir.
//
// Yalnız ekran KÖKÜNDE (pencerenin tepesine değen) kullan. Modal içinde ya da ekranın
// ortasında kalan bir SafeAreaView için asıl bileşen kalmalı: bağlam Modal'a da miras
// kalır, fazlalık orada yanlış olurdu.

import React, { forwardRef } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePremiumBannerOverlap } from "../../context/ScreenInsetsContext";

const includesTop = (edges) => {
  if (edges == null) return true;
  if (Array.isArray(edges)) return edges.includes("top");
  return edges.top != null && edges.top !== "off";
};

const ScreenSafeAreaView = forwardRef(function ScreenSafeAreaView({ style, edges, ...props }, ref) {
  const overlap = usePremiumBannerOverlap();
  if (!overlap || !includesTop(edges)) {
    return <SafeAreaView ref={ref} style={style} edges={edges} {...props} />;
  }
  const flat = StyleSheet.flatten(style) || {};
  const base = flat.paddingTop ?? flat.paddingVertical ?? flat.padding ?? 0;
  return (
    <SafeAreaView
      ref={ref}
      style={[style, { paddingTop: base + overlap }]}
      edges={edges}
      {...props}
    />
  );
});

export default ScreenSafeAreaView;
