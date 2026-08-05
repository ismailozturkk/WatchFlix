// Bölüm başlığı + sağda "Tümünü Gör" bağlantısı. TV & Film ana ekranlarındaki
// yatay rail'lerin üstünde kullanılır; onPress verilince SeeAllScreen'e gider.
//
// "Tümünü Gör" metin yerine soldan şeffaflaşan bir fade alanı ve sağda
// cam hissi veren kompakt genişletme ikonu olarak gösterilir.

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { alpha } from "../theme/colors";

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
        colors={[
          alpha(theme.primary, 0),
          alpha(theme.primary, 0.68),
          alpha(theme.primary, 0.96),
        ]}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.pillFade}
      />
      <View
        style={[
          styles.iconBubble,
          {
            backgroundColor: alpha(theme.secondary, 0.92),
            borderColor: alpha(theme.accent, 0.34),
          },
        ]}
      >
        <Ionicons name="expand-outline" size={18} color={theme.accent} />
      </View>
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
    width: 46,
    height: 38,
    borderRadius: 16,
    marginLeft: 4,
    alignSelf: "center",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: 2,
  },
  pillFade: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
});
