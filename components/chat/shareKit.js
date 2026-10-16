// components/chat/shareKit.js
//
// Sohbete gönderilen zengin içerik balonlarının (SharedListMessage,
// SharedAiMessage) ortak yapı taşları: renk paleti ve açılır/kapanır animasyon.
//
// Palet kuralı SharedMediaMessage ile aynı: GİDEN balon tema vurgusu üzerinde
// durur → yazı beyaz, yüzeyler beyaz-şeffaf; GELEN balon ikincil yüzeyde →
// tema renkleri, vurgu rengi aksan olarak.

import { LayoutAnimation, Platform, StyleSheet, UIManager, View } from "react-native";
import React from "react";
import { alpha } from "../../theme/colors";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Bir sonraki yerleşim değişimini yumuşakça animasyonla (aç/kapa için). */
export const easeLayout = () =>
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

/**
 * @param {object}  theme
 * @param {boolean} isOutgoing
 * @param {string}  accent       Balonun vurgusu (liste rengi / tema vurgusu).
 */
export function sharePalette({ theme, isOutgoing, accent }) {
  if (isOutgoing) {
    return {
      primary: "#fff",
      secondary: "rgba(255,255,255,0.86)",
      muted: "rgba(255,255,255,0.66)",
      // Küçük rozet / ikon karosu zemini
      tile: "rgba(255,255,255,0.22)",
      tileInk: "#fff",
      // Kart içi yüzey (satır, özet kutusu)
      surface: "rgba(255,255,255,0.12)",
      surfaceBorder: "rgba(255,255,255,0.28)",
      // Poster çerçevesi / yer tutucu
      posterBg: "rgba(255,255,255,0.1)",
      posterEdge: "rgba(255,255,255,0.28)",
      // Birincil düğme (balon vurgusu üstünde: beyaz-şeffaf dolgu)
      buttonBg: "rgba(255,255,255,0.26)",
      buttonInk: "#fff",
      // İkincil (çerçeveli) düğme
      ghostBg: "rgba(255,255,255,0.08)",
      ghostBorder: "rgba(255,255,255,0.4)",
      ghostInk: "#fff",
      divider: "rgba(255,255,255,0.22)",
    };
  }
  return {
    primary: theme.text.primary,
    secondary: theme.text.secondary,
    muted: theme.text.muted,
    tile: alpha(accent, 0.18),
    tileInk: accent,
    surface: theme.between,
    surfaceBorder: alpha(accent, 0.4),
    posterBg: theme.between,
    posterEdge: alpha(theme.text.primary, 0.14),
    buttonBg: accent,
    buttonInk: "#fff",
    ghostBg: "transparent",
    ghostBorder: alpha(accent, 0.5),
    ghostInk: accent,
    divider: theme.border,
  };
}

/**
 * Afişin ince kenar çizgisi: görselin ÜSTÜNE çizilir (mutlak, dokunmaz). Afiş
 * kutusuna `borderWidth` vermek görseli çerçevenin İÇİNE sıkıştırıp iç oranı
 * 2:3'ten saptırıyor (`cover` kenarlardan kırpıyor) ve kalın koyu bir halka
 * bırakıyordu; bu yüzden çerçeve ayrı katman.
 */
export function PosterEdge({ radius, color, width = 1 }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, borderWidth: width, borderColor: color },
      ]}
    />
  );
}

// Tür renkleri SharedMediaMessage / SharedMediaCollection ile aynı: aynı içerik
// her yerde aynı renkte tanınır.
export const MEDIA_TYPE_COLOR = { movie: "#FF8A65", tv: "#64B5F6", person: "#CE93D8" };
