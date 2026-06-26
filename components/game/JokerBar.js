// components/game/JokerBar.js
//
// Soru basligi yanindaki joker kontrolleri (Part 12.3 / Part 19): joker
// sayaci, %50 jokeri ve (varsa) gorsel degistirme jokeri. Saf gosterim;
// joker mantigi (useFiftyFiftyJoker/useChangeImageJoker) hook'ta kalir.

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";

export default function JokerBar({
  gameTokens,
  jokers,
  eliminatedCount,
  hasImageHint,
  onFiftyFiftyPress,
  onHintPress,
}) {
  const fiftyDisabled = jokers <= 0 || eliminatedCount > 0;
  const gold = gameTokens?.gold || "#FFD700";

  return (
    <View style={styles.jokerBar}>
      <View style={styles.jokerCountWrap}>
        <AppIcon family="Ionicons" name="star" size={12} color={gold} />
        <Text style={[styles.jokerCountText, { color: gold }]}>{jokers}</Text>
      </View>
      <TouchableOpacity
        onPress={onFiftyFiftyPress}
        activeOpacity={0.7}
        disabled={fiftyDisabled}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={i18nText("autoI18n.joker_yuzde_elli", "Yüzde 50 joker")}
        style={[styles.jokerBtn, { opacity: fiftyDisabled ? 0.3 : 1 }]}
      >
        <Text style={[styles.jokerBtnText, { color: gold }]}>%50</Text>
      </TouchableOpacity>
      {hasImageHint && (
        <TouchableOpacity
          onPress={onHintPress}
          activeOpacity={0.7}
          disabled={jokers <= 0}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.joker_gorsel_degistir", "Görseli değiştir jokeri")}
          style={[styles.jokerBtn, { opacity: jokers <= 0 ? 0.3 : 1 }]}
        >
          <AppIcon family="Ionicons" name="image-outline" size={14} color={gold} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  jokerBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  jokerCountWrap: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,215,0,0.15)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  jokerCountText: { fontSize: 12, fontWeight: "800" },
  jokerBtn: { backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  jokerBtnText: { fontSize: 12, fontWeight: "800" },
});
