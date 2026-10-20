// components/game/GameTile.js
//
// Bir oyunun vitrin kartı (Hub modülü + Oyun Merkezi). İki oyun yan yana
// durabilsin diye kare-ye-yakın; oyunun rengini gradyan taşır, rekor/durum
// altta okunur.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";
import { resolveGameAccentColors } from "@screens/game/gameRegistry";
import { PressableScale } from "./ui";

export default function GameTile({ game, theme, bestScore = 0, onPress, style }) {
  const colors = resolveGameAccentColors(game, theme);
  const title = i18nText(game.titleKey, game.id);
  const hasScore = bestScore > 0;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={[styles.shadow, { shadowColor: colors[1] }, style]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View pointerEvents="none" style={styles.glow} />
        <View pointerEvents="none" style={styles.artwork}>
          <AppIcon family="Ionicons" name={game.artwork.icon} size={92} color="rgba(255,255,255,0.14)" />
        </View>

        <View style={styles.iconWrap}>
          <AppIcon family={game.icon.family} name={game.icon.name} size={20} color="#FFFFFF" />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title} allowFontScaling={false} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.metaRow}>
            <AppIcon family="Ionicons" name={hasScore ? "trophy" : "sparkles"} size={12} color={hasScore ? "#FFD76A" : "#FFFFFF"} />
            <Text style={styles.meta} allowFontScaling={false} numberOfLines={1}>
              {hasScore
                ? i18nText("autoI18n.oyun_rekor_deger", "Rekor {{score}}", { score: bestScore })
                : i18nText("autoI18n.oyun_yeni_etiket", "Yeni")}
            </Text>
          </View>
        </View>

        <View style={styles.play}>
          <AppIcon family="Ionicons" name="play" size={13} color={colors[1]} />
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  shadow: {
    flex: 1,
    borderRadius: 22,
    elevation: 7,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  card: {
    minHeight: 148,
    borderRadius: 22,
    padding: 14,
    overflow: "hidden",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  glow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    right: -40,
    top: -50,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  artwork: { position: "absolute", right: -14, bottom: -12, transform: [{ rotate: "-10deg" }] },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { marginTop: 14, paddingRight: 34 },
  title: { color: "#FFFFFF", fontSize: 16, lineHeight: 20, fontWeight: "900" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  meta: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "800", flexShrink: 1 },
  play: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
