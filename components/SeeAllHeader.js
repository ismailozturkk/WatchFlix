// Bölüm başlığı + sağda "Tümünü Gör" bağlantısı. TV & Film ana ekranlarındaki
// yatay rail'lerin üstünde kullanılır; onPress verilince SeeAllScreen'e gider.
//
// "Tümünü Gör" artık metin yerine yalnızca bir genişletme ikonu; arka planı
// soldan şeffaf başlayıp sağa doğru koyulaşan yatay bir degrade.

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { alpha } from "../theme/colors";

// Soldan şeffaf → sağa koyulaşan degrade zeminli, yalnızca ikonlu genişletme
// düğmesi. Hem başlık içinde hem tek başına (Bests/Trends sekmelerinde) kullanılır.
function ExpandPill({ onPress, style }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.pill, style]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
    >
      <LinearGradient
        colors={[alpha(theme.primary, 0), theme.primary]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <Ionicons name="expand-outline" size={18} color={theme.accent} />
    </TouchableOpacity>
  );
}

// Başlıksız, tek başına genişletme düğmesi — kategori sekmeli bölümlerde
// (Bests/Trends) sekme satırının sağında kullanılır.
export function SeeAllButton({ onPress, style }) {
  return <ExpandPill onPress={onPress} style={style} />;
}

export default function SeeAllHeader({ title, onPress, style, titleStyle }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, style]}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.title, { color: theme.text.secondary }, titleStyle]}
      >
        {title}
      </Text>
      {onPress ? <ExpandPill onPress={onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
  },
  pill: {
    width: 58,
    height: 32,
    borderRadius: 10,
    marginLeft: 10,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: 10,
  },
});
