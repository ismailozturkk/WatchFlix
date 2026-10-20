import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "@services/hapticsService";

/**
 * RatingInput — interaktif yıldız puanlama (0-10 ölçeği, yarım yıldız destekli).
 *
 * 5 yıldız; her yıldızın sol yarısı = yarım puan (i*2-1), sağ yarısı = tam (i*2).
 * Böylece 1,2,3,...,10 (0.5 yıldız = 1 puan) adımlarıyla puanlanır.
 *
 * @param {number} value     Mevcut puan (0-10)
 * @param {Function} onChange (newValue:0-10) => void
 * @param {number} [size=36]
 * @param {string} [color="#FFB300"]
 * @param {string} [emptyColor="rgba(255,255,255,0.25)"]
 * @param {number} [count=5]
 */
export default function RatingInput({
  value = 0,
  onChange,
  size = 36,
  color = "#FFB300",
  emptyColor = "rgba(255,255,255,0.25)",
  count = 5,
}) {
  const set = (v) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    onChange?.(v);
  };

  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => {
        const starValue = i + 1;
        const full = value >= starValue * 2;
        const half = !full && value >= starValue * 2 - 1;
        const name = full ? "star" : half ? "star-half" : "star-outline";
        return (
          <View key={i} style={[styles.starWrap, { width: size, height: size, marginRight: 4 }]}>
            <Ionicons
              name={name}
              size={size}
              color={full || half ? color : emptyColor}
            />
            {/* Görünmez dokunma bölgeleri: sol yarı = ½, sağ yarı = tam */}
            <Pressable
              style={[styles.half, { left: 0, width: size / 2 }]}
              onPress={() => set(starValue * 2 - 1)}
              hitSlop={{ top: 8, bottom: 8 }}
            />
            <Pressable
              style={[styles.half, { right: 0, width: size / 2 }]}
              onPress={() => set(starValue * 2)}
              hitSlop={{ top: 8, bottom: 8 }}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  starWrap: { position: "relative", justifyContent: "center", alignItems: "center" },
  half: { position: "absolute", top: 0, bottom: 0 },
});
