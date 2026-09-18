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
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { alpha } from "../../theme/colors";

const POSTER_WIDTH = 70;
const POSTER_HEIGHT = 105;
const MEDIA_GAP = 12;

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

export default function SharedMediaMessage({
  item,
  getTmdbUrl,
  accent: propAccent,
  onOpenTrailer,
  isOutgoing = false,
}) {
  const { theme } = useTheme();
  const accent = propAccent || theme.accent || "#6C63FF";
  const [summaryOpen, setSummaryOpen] = useState(false);

  const media = item?.media;
  const poster = media?.poster_path || media?.profile_path;
  const isPerson = media?.media_type === "person";
  const text = item?.text || media?.title || media?.name || "";
  const summary = media?.overview;

  const rawDate = media?.release_date || media?.first_air_date;
  const releaseDateText = rawDate ? String(rawDate).slice(0, 4) : "";
  const releaseDateLabel =
    media?.media_type === "movie"
      ? i18nText("autoI18n.vizyon", "Vizyon")
      : i18nText("autoI18n.yayin", "Yayın");

  const toggleSummary = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSummaryOpen((o) => !o);
  };

  const primaryTextColor = isOutgoing ? "#fff" : theme.text.primary;
  const secondaryTextColor = isOutgoing ? "rgba(255,255,255,0.75)" : theme.text.secondary;
  const mutedTextColor = isOutgoing ? "rgba(255,255,255,0.65)" : theme.text.muted;

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
            <View
              style={[
                styles.poster,
                styles.posterPlaceholder,
                {
                  backgroundColor: isOutgoing
                    ? "rgba(255,255,255,0.1)"
                    : theme.between,
                  borderColor: isOutgoing
                    ? "rgba(255,255,255,0.2)"
                    : theme.border,
                },
              ]}
            >
              <Ionicons
                name={isPerson ? "person" : "film-outline"}
                size={26}
                color={mutedTextColor}
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
              style={[styles.personPosterName, { color: primaryTextColor }]}
              numberOfLines={2}
            >
              {text}
            </Text>
          )}
        </View>

        {/* Sağ sütun: tür + başlık + çipler */}
        <View style={[styles.side, !isPerson && styles.sideWithActions, isOutgoing && styles.sideOutgoing, !isPerson && isOutgoing && styles.sideOutgoingWithActions]}>
          {!!typeLabel(media?.media_type) && (
            <Text
              allowFontScaling={false}
              style={[
                styles.type,
                { color: mutedTextColor },
                isOutgoing && styles.textOutgoing,
              ]}
            >
              {typeLabel(media?.media_type)}
            </Text>
          )}
          {!isPerson && (
            <Text
              style={[
                styles.title,
                { color: primaryTextColor },
                isOutgoing && styles.textOutgoing,
              ]}
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
                color={mutedTextColor}
              />
              <Text
                allowFontScaling={false}
                style={[styles.releaseText, { color: secondaryTextColor }]}
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
                { backgroundColor: isOutgoing ? "rgba(255,255,255,0.2)" : accent },
                summaryOpen && styles.chipPrimaryActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.ozet", "Özet")}
              accessibilityState={{ expanded: summaryOpen }}
            >
              <Ionicons
                name={summaryOpen ? "chevron-up-outline" : "document-text-outline"}
                size={14}
                color="#fff"
                style={styles.chipIcon}
              />

            </TouchableOpacity>

              <TouchableOpacity
                onPress={onOpenTrailer}
                activeOpacity={0.85}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={[
                  styles.chip,
                  styles.chipOutline,
                  {
                    backgroundColor: isOutgoing
                      ? "rgba(255,255,255,0.12)"
                      : theme.between,
                    borderColor: isOutgoing
                      ? "rgba(255,255,255,0.3)"
                      : alpha(accent, 0.45),
                  },
                  ]}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.fragman", "Fragman")}
              >
                <Ionicons
                  name="play-circle-outline"
                  size={14}
                  color={isOutgoing ? "#fff" : accent}
                  style={styles.chipIcon}
                />

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
            {
              borderColor: isOutgoing
                ? "rgba(255,255,255,0.3)"
                : alpha(accent, 0.4),
              backgroundColor: isOutgoing
                ? "rgba(255,255,255,0.1)"
                : theme.between,
            },
          ]}
        >
          <Text style={[styles.summaryText, { color: primaryTextColor }]}>
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
    alignItems: "stretch",
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
    minWidth: 0,
    minHeight: POSTER_HEIGHT + 4,
    justifyContent: "flex-start",
    paddingTop: 2,
    gap: 4,
  },
  sideWithActions: {
    paddingLeft: 36,
  },
  sideOutgoingWithActions: {
    paddingLeft: 0,
    paddingRight: 36,
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

  // Aksiyonlar metnin altına eklenmez; sütunun alt kenarına sabitlenir.
  // Metinde ayrılan yan boşluk uzun başlıklarla çakışmayı önler.
  chips: {
    position: "absolute",
    bottom: 0,
    left: 0,
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  chipsOutgoing: {
    left: "auto",
    right: 0,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    gap: 3,
    height: 28,
    width: 28,
    borderRadius: 14,
    flexShrink: 0,
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
