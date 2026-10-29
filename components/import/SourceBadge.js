// components/import/SourceBadge.js
//
// Aktarım kaynağının küçük simgesi: Letterboxd için üç renkli nokta, IMDb için sarı
// etiket. Analiz başlığında ve aktarım geçmişi kartında kullanılır.

import React from "react";
import { StyleSheet, Text, View } from "react-native";

const LETTERBOXD_DOTS = ["#FF8000", "#00E054", "#40BCF4"];

export default function SourceBadge({ source, size = 34 }) {
  if (source === "imdb") {
    return (
      <View style={[styles.box, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: "#F5C518" }]}>
        <Text allowFontScaling={false} style={[styles.imdb, { fontSize: size * 0.3 }]}>IMDb</Text>
      </View>
    );
  }
  if (source === "mixed") {
    return (
      <View style={{ width: size, height: size }}>
        <View style={styles.stackBack}>
          <SourceBadge source="imdb" size={size * 0.72} />
        </View>
        <View style={styles.stackFront}>
          <SourceBadge source="letterboxd" size={size * 0.72} />
        </View>
      </View>
    );
  }
  const dot = Math.max(5, Math.round(size * 0.22));
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: "#14181C" }]}>
      <View style={styles.dots}>
        {LETTERBOXD_DOTS.map((color, index) => (
          <View
            key={color}
            style={{
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: color,
              marginLeft: index === 0 ? 0 : -dot * 0.18,
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  dots: { flexDirection: "row", alignItems: "center" },
  imdb: { color: "#000000", fontWeight: "900", letterSpacing: -0.3 },
  stackBack: { position: "absolute", right: 0, top: 0 },
  stackFront: { position: "absolute", left: 0, bottom: 0 },
});
