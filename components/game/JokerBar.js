// components/game/JokerBar.js
//
// Joker kontrolleri (Part 12.3 / Part 19): kalan joker sayısı, %50 jokeri ve
// (varsa) görsel değiştirme jokeri. Saf gösterim; joker mantığı
// (useFiftyFiftyJoker/useChangeImageJoker) hook'ta kalır.
//
// Hap şeklinde tek grup: [★ 3 | %50 | 🖼]. Joker bitince/kullanılamazken sönük.

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";
import { alpha } from "../../theme/colors";

export default function JokerBar({
  theme,
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
    <View style={[styles.group, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={[styles.count, { backgroundColor: alpha(gold, 0.16) }]}>
        <AppIcon family="Ionicons" name="sparkles" size={12} color={gold} />
        <Text style={[styles.countText, { color: gold }]} allowFontScaling={false}>
          {jokers}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onFiftyFiftyPress}
        activeOpacity={0.7}
        disabled={fiftyDisabled}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={i18nText("autoI18n.joker_yuzde_elli", "Yüzde 50 joker")}
        style={[styles.btn, { opacity: fiftyDisabled ? 0.3 : 1 }]}
      >
        <Text style={[styles.btnText, { color: theme.text.primary }]} allowFontScaling={false}>
          %50
        </Text>
      </TouchableOpacity>
      {hasImageHint ? (
        <TouchableOpacity
          onPress={onHintPress}
          activeOpacity={0.7}
          disabled={jokers <= 0}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.joker_gorsel_degistir", "Görseli değiştir jokeri")}
          style={[styles.btn, { opacity: jokers <= 0 ? 0.3 : 1 }]}
        >
          <AppIcon family="Ionicons" name="images-outline" size={16} color={theme.text.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: "row", alignItems: "center", gap: 2, height: 34, borderRadius: 17, borderWidth: 1, paddingLeft: 3, paddingRight: 4 },
  count: { flexDirection: "row", alignItems: "center", gap: 4, height: 26, paddingHorizontal: 8, borderRadius: 13 },
  countText: { fontSize: 12, fontWeight: "900" },
  btn: { minWidth: 34, height: 28, paddingHorizontal: 8, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 12, fontWeight: "900" },
});
