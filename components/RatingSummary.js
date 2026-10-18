// components/RatingSummary.js
//
// Detay ekranlarında puan özeti — IMDb'deki gibi SADE: tek altın yıldız + "7.8/10" + altında kısa oy sayısı,
// sağda "Puan ver" düğmesi (puan verdiysen kendi puanın). Eskiden beş yıldız şeridi, TMDB kişi sayacı, Seelogd
// rozeti ve ikinci bir yıldızlı kullanıcı puanı yan yana duruyordu; satır çok yer kaplıyor ve karışık görünüyordu.
//
// PUAN: HYBRID skoru (TMDB + Seelogd oyları, canlı dinlenir — services/ratingsService.computeHybrid). Oy sayısı
// iki kaynağın TOPLAMIDIR ve kısa biçimdedir (12.3K). IMDb puanı ayrıca altındaki çipte (components/detail/
// ExternalRatingsRow). Biçim yardımcıları saf: utils/ratingSummaryModel.js.
//
//   <RatingSummary
//     mediaType="movie"          // 'movie' | 'tv'
//     mediaId={id}
//     tmdbAvg={details.vote_average}
//     tmdbCount={details.vote_count}
//     onPressRate={() => setRatingVisible(true)}
//   />
//
// Düğmenin üç hâli: Yayınlanmadı (kilitli) · Puan ver · Senin puanın (accent yıldız + sayı).

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "@components/AppToast";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { i18nText } from "@utils/i18nText";
import { isUnreleased } from "@utils/watchState";
import { formatMyRating, formatScore, summarizeVotes } from "@utils/ratingSummaryModel";
import { getRatingSummaryCopy } from "@utils/ratingSummaryCopy";
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
  releaseDate,
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { language } = useLanguage();
  const copy = getRatingSummaryCopy(language);
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
  const score = formatScore(hybrid);
  const votes = summarizeVotes(tmdbCount, agg.count);
  const mine = formatMyRating(myRating);
  const hasMine = mine !== null;
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

  const action = locked ? copy.locked : hasMine ? copy.rated(mine) : copy.rate;
  const summary = score ? copy.score(score, votes) : copy.noScore;

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${summary}. ${action}`}
    >
      {/* Puan bloğu: altın yıldız + 7.8/10, altında kısa oy sayısı */}
      <View style={styles.scoreBlock}>
        <Ionicons name="star" size={26} color={score ? theme.colors.yellow : theme.text.muted} />
        <View>
          <Text allowFontScaling={false} style={styles.scoreLine}>
            <Text style={[styles.score, { color: theme.text.primary }]}>{score ?? "–"}</Text>
            {score ? <Text style={[styles.outOf, { color: theme.text.muted }]}>/10</Text> : null}
          </Text>
          {votes ? (
            <Text allowFontScaling={false} style={[styles.votes, { color: theme.text.muted }]}>
              {votes}
            </Text>
          ) : null}
        </View>
      </View>

      {locked ? (
        <View style={[styles.pill, { borderColor: theme.text.muted + "55", backgroundColor: theme.text.muted + "1A" }]}>
          <Ionicons name="lock-closed" size={13} color={theme.text.muted} />
          <Text allowFontScaling={false} style={[styles.pillText, { color: theme.text.muted }]}>
            {i18nText("autoI18n.yayinlanmadi", "Yayınlanmadı")}
          </Text>
        </View>
      ) : hasMine ? (
        // Kendi puanın: tek dolu accent yıldız + sayı (IMDb'deki mavi yıldız gibi)
        <View style={[styles.pill, { borderColor: theme.accent, backgroundColor: theme.accent + "1A" }]}>
          <Ionicons name="star" size={14} color={theme.accent} />
          <Text allowFontScaling={false} style={[styles.pillText, { color: theme.accent }]}>
            {mine}
          </Text>
        </View>
      ) : (
        <View style={[styles.pill, { borderColor: theme.accent + "66", backgroundColor: "transparent" }]}>
          <Ionicons name="star-outline" size={14} color={theme.accent} />
          <Text allowFontScaling={false} style={[styles.pillText, { color: theme.accent }]}>
            {i18nText("autoI18n.puan_ver", "Puan ver")}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  scoreBlock: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  scoreLine: { includeFontPadding: false },
  score: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  outOf: { fontSize: 13, fontWeight: "600" },
  votes: { fontSize: 11, fontWeight: "600", marginTop: -1 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
  pillText: { fontSize: 13, fontWeight: "700" },
});
