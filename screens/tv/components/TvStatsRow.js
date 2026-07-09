import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";

/* Dizi istatistik satırı: sezon / bölüm (izlenen sayısıyla) / yayın tarihi. */
export default function TvStatsRow({
  seasons,
  episodes,
  watchedEpisodeCount,
  firstAirDate,
}) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();

  const formatDate = (ts) => {
    if (!ts) return "";
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(ts));
  };

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
          <Ionicons name="layers-outline" size={16} color={theme.accent} />
        </View>
        <Text
          allowFontScaling={false}
          style={[styles.statVal, { color: theme.text.primary }]}
        >
          {seasons || 0}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.statLbl, { color: theme.text.muted }]}
        >
          {t.seasons}
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
            name="play-circle-outline"
            size={16}
            color={theme.colors?.blue || theme.accent}
          />
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
          <Text
            allowFontScaling={false}
            style={[styles.statVal, { color: theme.text.primary }]}
          >
            {episodes || 0}
          </Text>
          {watchedEpisodeCount > 0 && (
            <Text
              allowFontScaling={false}
              style={[styles.statValSub, { color: theme.text.muted }]}
            >
              /{watchedEpisodeCount}
            </Text>
          )}
        </View>
        <Text
          allowFontScaling={false}
          style={[styles.statLbl, { color: theme.text.muted }]}
        >
          {t.episode}
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
            name="calendar-outline"
            size={16}
            color={theme.colors?.green || theme.accent}
          />
        </View>
        <Text
          allowFontScaling={false}
          style={[styles.statVal, { color: theme.text.primary, fontSize: 13 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatDate(firstAirDate)}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.statLbl, { color: theme.text.muted }]}
        >
          {t.tvShowsDetails?.airDate}
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
  statValSub: { fontSize: 11, marginBottom: 2 },
  statLbl: { fontSize: 11 },
  statDivider: { width: 1, height: 44, opacity: 0.4 },
});
