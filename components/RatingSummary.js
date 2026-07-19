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
import Toast from "react-native-toast-message";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { i18nText } from "@utils/i18nText";
import { isUnreleased } from "@utils/watchState";
import RatingStars from "@components/RatingStars";
import {
  mediaKey,
  subscribeToAggregate,
  subscribeToMyRating,
  computeHybrid,
} from "@services/ratingsService";

// Yayın tarihini kullanıcının cihaz diline göre okunur biçime çevirir.
const formatReleaseDate = (str) => {
  if (!str) return "";
  const d = new Date(str);
  if (isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (e) {
    return str;
  }
};

export default function RatingSummary({
  mediaType,
  mediaId,
  tmdbAvg = 0,
  tmdbCount = 0,
  onPressRate,
  starSize = 16,
  releaseDate,
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const uid = user?.uid;
  const [agg, setAgg] = useState({ count: 0, sum: 0 });
  const [myRating, setMyRating] = useState(null); // kullanıcının kendi oyu (0-10) | null

  useEffect(() => {
    if (mediaId == null) return;
    const key = mediaKey(mediaType, mediaId);
    const unsubAgg = subscribeToAggregate(key, setAgg);
    if (!uid) {
      setMyRating(null);
      return () => unsubAgg();
    }
    const unsubMine = subscribeToMyRating(key, uid, setMyRating);
    return () => {
      unsubAgg();
      unsubMine();
    };
  }, [mediaType, mediaId, uid]);

  const hybrid = computeHybrid({ tmdbAvg, tmdbCount, count: agg.count, sum: agg.sum });
  const hasMine = myRating != null && myRating > 0;
  // İçerik henüz yayınlanmadıysa puanlama kilitli. (Kendi oyu olan kullanıcıyı
  // kilitlemeyiz; tarihler geriye gitmese de mevcut oyunu yönetebilsin.)
  const locked = isUnreleased(releaseDate) && !hasMine;

  const handlePress = () => {
    if (locked) {
      const relText = formatReleaseDate(releaseDate);
      Toast.show({
        type: "info",
        text1: i18nText("autoI18n.henuz_yayinlanmadi", "Henüz yayınlanmadı"),
        text2: relText
          ? i18nText(
              "autoI18n.puanlama_su_tarihte_acilir",
              "Puanlama {{date}} tarihinde açılır",
              { date: relText },
            )
          : i18nText(
              "autoI18n.yayinlandiginda_puan_verebilirsin",
              "Yayınlandığında puan verebilirsin",
            ),
      });
      return;
    }
    onPressRate?.();
  };

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={handlePress}
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

      {/* Yayın tarihi gelecekteyse puanlama kilitli */}
      {locked ? (
        <View style={[styles.rateBtn, { borderColor: theme.text.muted + "55", backgroundColor: theme.text.muted + "1A" }]}>
          <Ionicons name="lock-closed" size={12} color={theme.text.muted} />
          <Text allowFontScaling={false} style={[styles.rateBtnText, { color: theme.text.muted }]}>
            {i18nText("autoI18n.yayinlanmadi", "Yayınlanmadı")}
          </Text>
        </View>
      ) : /* Kullanıcının kendi oyu: VERDİYSE belli et (dolu yıldız + puan), aksi halde "Puan ver" */
      hasMine ? (
        <View style={[styles.rateBtn, { borderColor: theme.accent, backgroundColor: theme.accent }]}>
          <Ionicons name="checkmark-circle" size={13} color="#fff" />
          <RatingStars rating={myRating} max={10} count={5} size={11} color="#fff" spacing={0.5} />
          <Text allowFontScaling={false} style={[styles.rateBtnText, { color: "#fff" }]}>
            {myRating.toFixed(1)}
          </Text>
        </View>
      ) : (
        <View style={[styles.rateBtn, { borderColor: theme.accent + "55", backgroundColor: theme.accent + "1A" }]}>
          <Ionicons name="star" size={12} color={theme.accent} />
          <Text allowFontScaling={false} style={[styles.rateBtnText, { color: theme.accent }]}>
            {i18nText("autoI18n.puan_ver", "Puan ver")}
          </Text>
        </View>
      )}
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
