// components/chat/SharedMediaMessage.js
//
// Sohbette paylaşılan dizi/film/kişi mesajının gövdesi: hafif EĞİK poster +
// yanında çip butonlar. "Özet" çipi genel özeti animasyonlu açar; "Fragman"
// çipi (yalnızca dizi/film) fragman modalını açar. Postere/balona basınca
// yönlendirme dış TouchableOpacity tarafından yapılır (poster düz View'dir).

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { i18nText } from "../../utils/i18nText";

const POSTER_WIDTH = 108;
const POSTER_HEIGHT = 162;
const MEDIA_GAP = 10;

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const typeLabel = (mt) =>
  mt === "movie"
    ? i18nText("autoI18n.film", "Film")
    : mt === "tv"
      ? i18nText("autoI18n.dizi", "Dizi")
      : mt === "person"
        ? i18nText("autoI18n.oyuncu", "Oyuncu")
        : "";

const formatReleaseDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function SharedMediaMessage({
  media,
  text,
  accent,
  getTmdbUrl,
  onOpenTrailer,
  isOutgoing = false,
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const isPerson = media?.media_type === "person";
  const poster = media?.poster_path || media?.profile_path;
  const summary =
    media?.overview || (isPerson ? media?.known_for_department : "") || "";
  const releaseDateText = formatReleaseDate(media?.release_date);
  const releaseDateLabel =
    media?.media_type === "tv"
      ? i18nText("autoI18n.ilk_yayin", "İlk yayın")
      : i18nText("autoI18n.yayin", "Yayın");

  const toggleSummary = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSummaryOpen((o) => !o);
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, isOutgoing && styles.rowOutgoing]}>
        <View style={styles.posterColumn}>
          {/* Eğik poster (basınca dış balon yönlendirir) */}
          <View style={[styles.posterTilt, isOutgoing && styles.posterTiltOutgoing]}>
          {poster ? (
            <Image
              source={{ uri: getTmdbUrl(poster, "poster", 500) }}
              style={styles.poster}
              cachePolicy="memory-disk"
              transition={120}
            />
          ) : (
            <View style={[styles.poster, styles.posterPlaceholder]}>
              <Ionicons
                name={isPerson ? "person" : "film-outline"}
                size={26}
                color="rgba(255,255,255,0.35)"
              />
            </View>
          )}
          {media?.vote_average > 0 && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={9} color="#FFD54F" />
              <Text allowFontScaling={false} style={styles.ratingText}>
                {media.vote_average.toFixed(1)}
              </Text>
            </View>
          )}
          </View>

          {isPerson && (
            <Text
              style={styles.personPosterName}
              numberOfLines={2}
            >
              {text}
            </Text>
          )}
        </View>

        {/* Sağ sütun: tür + başlık + çipler */}
        <View style={[styles.side, isOutgoing && styles.sideOutgoing]}>
          {!!typeLabel(media?.media_type) && (
            <Text
              allowFontScaling={false}
              style={[styles.type, isOutgoing && styles.textOutgoing]}
            >
              {typeLabel(media?.media_type)}
            </Text>
          )}
          {!isPerson && (
            <Text
              style={[styles.title, isOutgoing && styles.textOutgoing]}
              numberOfLines={3}
            >
              {text}
            </Text>
          )}

          {!!releaseDateText && (
            <View style={[styles.releaseRow, isOutgoing && styles.releaseRowOutgoing]}>
              <Ionicons
                name="calendar-outline"
                size={12}
                color="rgba(255,255,255,0.56)"
              />
              <Text
                allowFontScaling={false}
                style={styles.releaseText}
                numberOfLines={1}
              >
                {releaseDateLabel}: {releaseDateText}
              </Text>
            </View>
          )}

          {!isPerson && (
            <View style={[styles.chips, isOutgoing && styles.chipsOutgoing]}>
            <TouchableOpacity
              onPress={toggleSummary}
              activeOpacity={0.85}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={[
                styles.chip,
                styles.chipPrimary,
                { backgroundColor: accent },
                summaryOpen && styles.chipExpanded,
                summaryOpen && styles.chipPrimaryActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.ozet", "Özet")}
            >
              <Ionicons
                name={summaryOpen ? "chevron-up-outline" : "document-text-outline"}
                size={14}
                color="#fff"
                style={styles.chipIcon}
              />
              {summaryOpen && (
                <Text allowFontScaling={false} style={styles.chipText}>
                  {i18nText("autoI18n.ozet", "Özet")}
                </Text>
              )}
            </TouchableOpacity>

              <TouchableOpacity
                onPress={onOpenTrailer}
                activeOpacity={0.85}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={[
                  styles.chip,
                  styles.chipOutline,
                  { borderColor: accent + "88" },
                  summaryOpen && styles.chipExpanded,
                ]}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.fragman", "Fragman")}
              >
                <Ionicons
                  name="play-circle-outline"
                  size={14}
                  color={accent}
                  style={styles.chipIcon}
                />
                {summaryOpen && (
                  <Text
                    allowFontScaling={false}
                    style={[styles.chipText, { color: accent }]}
                  >
                    {i18nText("autoI18n.fragman", "Fragman")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>

      {/* Animasyonlu genel özet */}
      {!isPerson && summaryOpen && (
        <View
          style={[
            styles.summaryBox,
            { borderColor: accent + "55", backgroundColor: "rgba(255,255,255,0.06)" },
          ]}
        >
          <Text style={styles.summaryText}>
            {summary || i18nText("autoI18n.ozet_yok", "Özet bulunmuyor.")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", marginBottom: 9 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: MEDIA_GAP,
  },
  rowOutgoing: {
    flexDirection: "row-reverse",
  },

  posterColumn: {
    width: POSTER_WIDTH + 8,
    flexShrink: 0,
    alignItems: "center",
  },
  posterTilt: {
    flexShrink: 0,
    marginTop: 4,
    marginLeft: 2,
    transform: [{ rotate: "-5deg" }],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  posterTiltOutgoing: {
    marginLeft: 0,
    marginRight: 2,
    transform: [{ rotate: "5deg" }],
  },
  poster: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  posterPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  personPosterName: {
    width: "100%",
    marginTop: 8,
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 15,
    textAlign: "center",
  },

  side: {
    flex: 1,
    flexShrink: 1,
    justifyContent: "flex-start",
    paddingTop: 2,
    gap: 4,
  },
  sideOutgoing: {
    alignItems: "stretch",
  },
  textOutgoing: {
    textAlign: "right",
  },
  type: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  title: { fontSize: 14, fontWeight: "800", color: "#fff", lineHeight: 18 },
  releaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  releaseRowOutgoing: {
    justifyContent: "flex-end",
  },
  releaseText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 13,
    includeFontPadding: false,
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 4,
    rowGap: 4,
    marginTop: 6,
  },
  chipsOutgoing: {
    justifyContent: "flex-end",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    gap: 3,
    minHeight: 28,
    minWidth: 28,
    borderRadius: 14,
    flexShrink: 0,
  },
  chipExpanded: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  // Birincil aksiyon (Özet): dolu accent + hafif gölge
  chipPrimary: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 2,
  },
  chipPrimaryActive: {
    opacity: 0.9,
  },
  // İkincil aksiyon (Fragman): accent dış-çizgili, şeffaf zemin
  chipOutline: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
  },
  chipIcon: {
    flexShrink: 0,
  },
  chipText: {
    color: "#fff",
    fontSize: 11.5,
    fontWeight: "800",
    lineHeight: 14,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  summaryBox: {
    marginTop: 9,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    lineHeight: 17,
  },
});
