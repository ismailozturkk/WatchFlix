import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";

/* Film istatistik satırı: tarih (kalan süre) / süre / hasılat. */
export default function MovieStatsRow({ dateInfo, runtime, revenue }) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <View
      style={[
        styles.statRow,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <View style={styles.statPill}>
        <View
          style={[styles.statIconWrap, { backgroundColor: theme.accent + "18" }]}
        >
          <Ionicons name="calendar-outline" size={16} color={theme.accent} />
        </View>
        <Text
          allowFontScaling={false}
          style={[styles.statVal, { color: theme.text.primary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {dateInfo?.text || "?"}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.statLbl, { color: theme.text.muted }]}
        >
          {t.date}
        </Text>
      </View>

      <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

      <View style={styles.statPill}>
        <View
          style={[
            styles.statIconWrap,
            { backgroundColor: (theme.colors?.blue || theme.accent) + "18" },
          ]}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={theme.colors?.blue || theme.accent}
          />
        </View>
        <Text
          allowFontScaling={false}
          style={[styles.statVal, { color: theme.text.primary }]}
        >
          {runtime ? `${runtime} dk` : "?"}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.statLbl, { color: theme.text.muted }]}
        >
          {t.duration}
        </Text>
      </View>

      <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

      <View style={styles.statPill}>
        <View
          style={[
            styles.statIconWrap,
            { backgroundColor: (theme.colors?.green || theme.accent) + "18" },
          ]}
        >
          <Ionicons
            name="cash-outline"
            size={16}
            color={theme.colors?.green || theme.accent}
          />
        </View>
        <Text
          allowFontScaling={false}
          style={[styles.statVal, { color: theme.text.primary }]}
        >
          {revenue > 0 ? `${(revenue / 1_000_000).toFixed(0)}M$` : "?"}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.statLbl, { color: theme.text.muted }]}
        >
          {t.revenue}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 16,
    marginBottom: 16,
  },
  statPill: { flex: 1, alignItems: "center", gap: 5 },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statVal: { fontSize: 15, fontWeight: "700" },
  statLbl: { fontSize: 11 },
  statDivider: { width: 1, height: 44, opacity: 0.4 },
});
