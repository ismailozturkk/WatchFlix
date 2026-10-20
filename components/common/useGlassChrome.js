// components/common/useGlassChrome.js
//
// GlassTouchable / GlassPressable / GlassBox / GlassTextInput'un ORTAK çekirdeği:
// bir öğenin ESKİ stilinden (dolgu, çerçeve, gölge, köşe) cam kararını verir ve
// cam çizilecekse (a) stilin kabuğu çıkarılmış hâlini, (b) öğenin ARKASINDA
// duracak cam katmanını, (c) boyut ölçümü için onLayout'u döner. Cam çizilmeyecekse
// `null` döner → çağıran bileşen eski öğeyi aynen çizer.
//
// Cam çizilmeyen durumlar (hepsinde `null`):
//   • iOS 26 cam yok / Efektler Kapalı (useLiquidGlass)
//   • bu öğe zaten bir camın İÇİNDE (GlassNestContext) — cam camı örnekleyemez
//     (GlassSurface kural 3); örn. cam arama alanındaki "temizle" düğmesi
//   • stil cam için uygun değil (utils/glassChrome.planGlassChrome null verir)
//   • çağıran `glass={false}` dedi (bilinçli istisna)
//
// Karar/stil mantığı utils/glassChrome.js'te (saf, testli). Burası yalnız RN'e
// bağlayan ince katman.
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { useLiquidGlass } from "../../services/liquidGlass";
import { planGlassChrome, stripChrome } from "../../utils/glassChrome";

/**
 * Stil ağacında Reanimated `useAnimatedStyle` çıktısı var mı? Böyle nesneler
 * düzleştirilirse `viewDescriptors` anahtarı sıradan bir alan olarak kopyalanır ve
 * animasyon sessizce ölür; bu öğeler cama çevrilmez, stil olduğu gibi kalır.
 */
function hasReanimatedStyle(style) {
  if (!style) return false;
  if (Array.isArray(style)) return style.some(hasReanimatedStyle);
  return typeof style === "object" && "viewDescriptors" in style;
}

/** Cam bir yüzeyin çocukları için true: içerideki öğeler cama dönmez. */
export const GlassNestContext = createContext(false);

/**
 * @param {object|function|Array} style  Öğenin eski stili (Pressable için fonksiyon olabilir)
 * @param {object} [options]
 * @param {"button"|"field"|"card"} [options.role="button"]
 * @param {string}  [options.tint]       Ton zorla
 * @param {boolean} [options.enabled=true] false → hiç cam çizme
 * @param {boolean} [options.interactive=false] Dokununca cam esner/parlar
 * @param {boolean} [options.catchTouches=false] Cam katmanı dokunuş alsın (dokunulabilirlerde)
 * @param {function} [options.onLayout]  Çağıranın kendi onLayout'u (ezilmez)
 * @returns {null | {style, layer, onLayout, wrap}}
 */
export default function useGlassChrome(style, options = {}) {
  const {
    role = "button",
    tint,
    enabled = true,
    interactive = false,
    catchTouches = false,
    onLayout: userOnLayout,
  } = options;
  const glass = useLiquidGlass();
  const nested = useContext(GlassNestContext);
  const [maxRadius, setMaxRadius] = useState(null);
  const planRadius = useRef(0);

  const active = glass && !nested && enabled;
  let plan = null;
  let flat = null;
  if (active) {
    const probe = typeof style === "function" ? style({ pressed: false }) : style;
    if (!hasReanimatedStyle(probe)) {
      flat = StyleSheet.flatten(probe) || {};
      plan = planGlassChrome(flat, { role, tint });
    }
  }
  planRadius.current = plan ? plan.radius : 0;

  const onLayout = useCallback(
    (event) => {
      const { width, height } = event.nativeEvent.layout;
      // Yalnız köşe gerçekten sığmıyorsa (hap = 999 gibi) durum tut: sığıyorsa
      // yeniden çizim gereksiz.
      const half = Math.min(width, height) / 2;
      const next = planRadius.current > half ? half : null;
      setMaxRadius((prev) => (prev === next ? prev : next));
      userOnLayout?.(event);
    },
    [userOnLayout],
  );

  if (!plan) return null;

  // Tembel: cam kapalıyken (Android, iOS 18–25) bu modül hiç yüklenmez; düğme ve
  // alan olan HER dosya bu kancayı import ettiği için ağır bağımlılıkları
  // (ThemeContext, expo-blur) import zincirine sokmuyoruz.
  const GlassSurface = require("./GlassSurface").default;
  const radius = maxRadius === null ? plan.radius : Math.min(plan.radius, maxRadius);
  const inset = plan.inset;
  const layer = (
    <GlassSurface
      key="glass-chrome-layer"
      radius={radius}
      tint={plan.tint}
      scheme={plan.scheme}
      interactive={interactive}
      pointerEvents={catchTouches ? undefined : "none"}
      style={{ position: "absolute", top: -inset, left: -inset, right: -inset, bottom: -inset }}
    />
  );

  const strippedStyle =
    typeof style === "function"
      ? (state) => stripChrome(StyleSheet.flatten(style(state)) || {}, plan)
      : stripChrome(flat, plan);

  // Çocukları "cam içinde" işaretler: iç içe cam yok.
  const wrap = (children) => (
    <GlassNestContext.Provider value>
      {layer}
      {children}
    </GlassNestContext.Provider>
  );

  return { style: strippedStyle, layer, onLayout, wrap };
}
