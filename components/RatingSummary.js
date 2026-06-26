// components/RatingSummary.js
//
// Detay ekranlarında derecelendirme özeti: HYBRID skoru (TMDB + uygulama oyları)
// canlı dinler, yıldız + puan gösterir, dokununca puan verme sheet'ini açar.
//
//   <RatingSummary
//     mediaType="movie"          // 'movie' | 'tv'
//     mediaId={id}
//     tmdbAvg={details.vote_average}
//     tmdbCount={details.vote_count}
//     onPressRate={() => setRatingVisible(true)}
//   />

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons, FontAwesome } from "@expo/vector-icons";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import RatingStars from "@components/RatingStars";
import {
  mediaKey,
  subscribeToAggregate,
  computeHybrid,
} from "@services/ratingsService";

export default function RatingSummary({
  mediaType,
  mediaId,
  tmdbAvg = 0,
  tmdbCount = 0,
  onPressRate,
  starSize = 16,
}) {
  const { theme } = useTheme();
  const [agg, setAgg] = useState({ count: 0, sum: 0 });

  useEffect(() => {
    if (mediaId == null) return;
    const unsub = subscribeToAggregate(mediaKey(mediaType, mediaId), setAgg);
    return () => unsub();
  }, [mediaType, mediaId]);

  const hybrid = computeHybrid({ tmdbAvg, tmdbCount, count: agg.count, sum: agg.sum });

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={onPressRate}
    >
      <RatingStars rating={hybrid} max={10} size={starSize} color={theme.colors.orange} />
      <Text allowFontScaling={false} style={[styles.score, { color: theme.colors.orange }]}>
        {hybrid.toFixed(1)}
      </Text>

      {/* TMDB oy sayısı */}
      <View style={styles.voteRow}>
        <FontAwesome name="user" size={11} color={theme.colors.blue} />
        <Text allowFontScaling={false} style={[styles.voteCount, { color: theme.colors.blue }]}>
          {Number(tmdbCount || 0).toLocaleString()}
        </Text>
      </View>

      {/* Uygulama oyu varsa rozet */}
      {agg.count > 0 && (
        <View style={[styles.appBadge, { backgroundColor: theme.colors.green + "22" }]}>
          <Ionicons name="people" size={10} color={theme.colors.green} />
          <Text allowFontScaling={false} style={[styles.appBadgeText, { color: theme.colors.green }]}>
            {agg.count}
          </Text>
        </View>
      )}

      {/* Puan ver çağrısı */}
      <View style={[styles.rateBtn, { borderColor: theme.accent + "55", backgroundColor: theme.accent + "1A" }]}>
        <Ionicons name="star" size={12} color={theme.accent} />
        <Text allowFontScaling={false} style={[styles.rateBtnText, { color: theme.accent }]}>
          {i18nText("autoI18n.puan_ver", "Puan ver")}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  score: { fontSize: 16, fontWeight: "700" },
  voteRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  voteCount: { fontSize: 12, fontWeight: "600" },
  appBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  appBadgeText: { fontSize: 11, fontWeight: "700" },
  rateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  rateBtnText: { fontSize: 12, fontWeight: "700" },
});
