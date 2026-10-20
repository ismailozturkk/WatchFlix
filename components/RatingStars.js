import React from "react";
import { View, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

/**
 * RatingStars — salt-okunur kesirli yıldız gösterimi.
 *
 * Ölçek bağımsız: `rating` değeri `max` ölçeğinde gelir, her zaman `count`
 * (varsayılan 5) yıldıza normalize edilir. Yarım yıldız desteklenir.
 *
 *   <RatingStars rating={7.4} />            // 0-10 (TMDB) → 5 yıldız
 *   <RatingStars rating={4} max={5} />      // 1-5 (post.userRating)
 *
 * @param {number} rating   Puan (0..max)
 * @param {number} [max=10] Ölçek tavanı
 * @param {number} [count=5] Yıldız adedi
 * @param {number} [size=14]
 * @param {string} [color="#FFB300"]
 * @param {number} [spacing=1]
 */
export default function RatingStars({
  rating = 0,
  max = 10,
  count = 5,
  size = 14,
  color = "#FFB300",
  spacing = 1,
}) {
  const safeMax = max > 0 ? max : 10;
  // rating'i count yıldıza ölçekle, 0.5 adımına yuvarla
  const scaled = Math.max(0, Math.min(count, (Number(rating) || 0) / safeMax * count));
  const rounded = Math.round(scaled * 2) / 2;

  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => {
        const starValue = i + 1;
        let name = "star-outline";
        if (rounded >= starValue) name = "star";
        else if (rounded >= starValue - 0.5) name = "star-half";
        return (
          <Ionicons
            key={i}
            name={name}
            size={size}
            color={color}
            style={{ marginRight: i === count - 1 ? 0 : spacing }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});
