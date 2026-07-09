import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";

/* Detay ekranı bölüm başlığı: sol renk çubuğu + başlık + opsiyonel sağ öğe.
   MovieDetail ve TvShowsDetails aynı stili paylaşır. */
export default function SectionHeader({ title, right }) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={[styles.sectionAccent, { backgroundColor: theme.accent }]} />
      <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sectionAccent: { width: 3, height: 18, borderRadius: 2 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    flex: 1,
  },
});
