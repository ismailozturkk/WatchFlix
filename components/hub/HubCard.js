// components/hub/HubCard.js
//
// Hub'daki vitrin kartlarının (Paylaşımlar, CineSwipe, Turnuva) ortak kabuğu ve
// küçük yapı taşları. Amaç: üç kart farklı renkte olsa da aynı dili konuşsun —
// aynı köşe yuvarlaklığı, aynı gölge, aynı cam çip, aynı "beyaz eylem" düğmesi
// (Oyunlar modülündeki oyun ızgarası/DailyChallengeCard ile de uyumlu).
//
//   • HubCard   — gölge + gradyan + iki ışık küresi. `onPress` verilirse kartın
//                 tamamı yayla küçülen bir düğme olur; verilmezse düz kabuktur
//                 (içindeki parçalar kendi basma davranışını taşır).
//   • GlassPill — ikon + metinli yarı saydam çip (rozet, sayaç, durum).
//   • HubArrow  — beyaz yuvarlak "aç" düğmesi; ok rengi kartın rengidir.
//   • HubSendButton — cam yuvarlak "sohbete gönder" düğmesi; kartın içinde kendi
//                 basmasını taşır (kartın geri kalanı hâlâ kartı açar).

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { PressableScale } from "@components/game/ui";
import GlassPressable from "../common/GlassPressable";

export default function HubCard({
  colors,
  shadowColor,
  onPress,
  scaleTo = 0.98,
  style,
  cardStyle,
  children,
  ...rest
}) {
  const body = (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, cardStyle]}
    >
      <View pointerEvents="none" style={styles.glowOne} />
      <View pointerEvents="none" style={styles.glowTwo} />
      {children}
    </LinearGradient>
  );

  if (onPress) {
    return (
      <PressableScale
        {...rest}
        onPress={onPress}
        scaleTo={scaleTo}
        style={[styles.shadow, { shadowColor }, style]}
      >
        {body}
      </PressableScale>
    );
  }
  return <View style={[styles.shadow, { shadowColor }, style]}>{body}</View>;
}

/** İkon + metin: cam çip. `tone="dark"` koyu cam, varsayılan açık cam. */
export function GlassPill({ icon, iconColor = "#FFFFFF", text, tone = "light", style, textStyle }) {
  return (
    <View style={[styles.pill, tone === "dark" ? styles.pillDark : styles.pillLight, style]}>
      {icon ? <AppIcon family="Ionicons" name={icon} size={12} color={iconColor} /> : null}
      <Text style={[styles.pillText, textStyle]} allowFontScaling={false} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** Beyaz yuvarlak ok düğmesi — kart dokunulabilir olduğunu söyler. */
export function HubArrow({ color, size = 36 }) {
  return (
    <View
      style={[styles.arrow, { width: size, height: size, borderRadius: size / 2 }]}
      pointerEvents="none"
    >
      <AppIcon family="Ionicons" name="arrow-forward" size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}

/** Cam yuvarlak "sohbete gönder" düğmesi; basış kartın kendi basışına geçmez. */
export function HubSendButton({ onPress, size = 36, label }) {
  return (
    <GlassPressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.send,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.sendPressed,
      ]}
    >
      <AppIcon family="Ionicons" name="paper-plane-outline" size={Math.round(size * 0.5)} color="#FFFFFF" />
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 26,
    elevation: 9,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  card: {
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  glowOne: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -70,
    top: -90,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  glowTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    left: -40,
    bottom: -50,
    backgroundColor: "rgba(0,0,0,0.12)",
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillLight: { backgroundColor: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.26)" },
  pillDark: { backgroundColor: "rgba(0,0,0,0.24)", borderColor: "rgba(255,255,255,0.14)" },
  pillText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "900", letterSpacing: 0.6, flexShrink: 1 },

  send: {
    backgroundColor: "rgba(255,255,255,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  sendPressed: { backgroundColor: "rgba(255,255,255,0.34)" },

  arrow: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
