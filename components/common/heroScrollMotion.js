// components/common/heroScrollMotion.js
//
// Üst arka plan görselinin (profil kapağı, film/dizi detay backdrop'u) kaydırmaya
// bağlı ORTAK hareketi:
//
//   • Aşağı kaydırınca (içerik yukarı): görsel BÜYÜMEZ; içerikten çok daha yavaş,
//     HERO_RISE kadar yukarı kayar, siyah örtüyle kararır ve sonunda söner.
//   • Üstten aşağı çekince (iOS, negatif ofset): üst kenarı ekranda sabit kalarak
//     esner; alt kenar parmağı izler (stretchy header).
//
// İki yerleşim var:
//   fixedHeroMotion     görsel ekrana sabit (mutlak, kaydırma görünümünün DIŞINDA)
//   inContentHeroMotion görsel kaydırılan içeriğin içinde: aynı ekran hareketini
//                       içeriğe karşı öteleyerek üretir (detay sayfaları; üstüne
//                       içerikteki poster/başlık biner)
//
// `scrollY` native sürücüyle bağlı Animated.Value olmalı (useNativeDriver: true):
// hepsi transform/opacity, hareket tamamen yerel iş parçacığında.

import React from "react";
import { Animated, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Kararıp bittiği kaydırma mesafesi; bu sürede yalnız HERO_RISE kadar yukarı kayar.
export const HERO_FADE_AT = 300;
export const HERO_RISE = 80;
// Kararma: önce siyah örtü koyulaşır, son bölümde görsel tamamen söner.
const HERO_DARKEN_MAX = 0.7;
// Ölçüler bu yükseklikteki bir görsele göre ayarlı (film/dizi 16:9 yuvası ≈ 290 px).
const HERO_REFERENCE_HEIGHT = 290;

/**
 * Görsel boyuna orantılı ayar: uzun görsel (oyuncu portresi) aynı HİSSİ versin
 * diye daha uzun mesafede kararır ve daha çok yükselir. Referanstan kısa
 * görsellerde temel değerlerin altına inmez.
 * @returns {{ fadeAt:number, rise:number }}
 */
export function heroMotionTuning(height) {
  const ratio = Math.max(1, (Number(height) || 0) / HERO_REFERENCE_HEIGHT);
  return { fadeAt: Math.round(HERO_FADE_AT * ratio), rise: Math.round(HERO_RISE * ratio) };
}

const opacityOf = (scrollY, fadeAt) =>
  scrollY.interpolate({
    inputRange: [0, fadeAt * 0.55, fadeAt],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

// Yalnız çekmede esner; aşağı kaydırırken ölçek 1'de kalır.
const scaleOf = (scrollY, h) =>
  scrollY.interpolate({ inputRange: [-h, 0], outputRange: [2, 1], extrapolate: "clamp" });

/** Ekrana sabit görsel. Çekmede ölçek merkezden büyür → yarısı kadar aşağı itilir. */
export function fixedHeroMotion(scrollY, height, { fadeAt = HERO_FADE_AT, rise = HERO_RISE } = {}) {
  if (!scrollY) return null;
  const h = Math.max(1, height);
  return {
    opacity: opacityOf(scrollY, fadeAt),
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [-h, 0, fadeAt],
          outputRange: [h / 2, 0, -rise],
          extrapolate: "clamp",
        }),
      },
      { scale: scaleOf(scrollY, h) },
    ],
  };
}

/**
 * Kaydırılan içeriğin İÇİNDEKİ görsel: içerik `y` kadar yukarı giderken görsel
 * `y - rise` kadar aşağı ötelenir → ekranda yalnız `rise` kadar yükselmiş olur.
 * Çekmede içerik `p` kadar iner; `-p/2` öteleme + merkezden ölçek üst kenarı 0'da tutar.
 */
export function inContentHeroMotion(scrollY, height, { fadeAt = HERO_FADE_AT, rise = HERO_RISE } = {}) {
  if (!scrollY) return null;
  const h = Math.max(1, height);
  return {
    opacity: opacityOf(scrollY, fadeAt),
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [-h, 0, fadeAt],
          outputRange: [-h / 2, 0, fadeAt - rise],
          extrapolate: "clamp",
        }),
      },
      { scale: scaleOf(scrollY, h) },
    ],
  };
}

/**
 * Kararma örtüsü (görselin üstüne, mutlak). Alt kenarda saydamlaşır: görselin tema
 * zeminine erimesi (açık temada da) gri bir şeride dönmesin.
 */
export function HeroDarkenOverlay({ scrollY, fadeAt = HERO_FADE_AT }) {
  if (!scrollY) return null;
  const opacity = scrollY.interpolate({
    inputRange: [0, fadeAt * 0.8],
    outputRange: [0, HERO_DARKEN_MAX],
    extrapolate: "clamp",
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <LinearGradient
        colors={["#000", "#000", "rgba(0,0,0,0)"]}
        locations={[0, 0.45, 0.95]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}
