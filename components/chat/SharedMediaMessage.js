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
  media,
  text,
  accent,
  getTmdbUrl,
  onOpenTrailer,
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const isPerson = media?.media_type === "person";
  const poster = media?.poster_path || media?.profile_path;
  const summary =
    media?.overview || (isPerson ? media?.known_for_department : "") || "";

  const toggleSummary = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSummaryOpen((o) => !o);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {/* Eğik poster (basınca dış balon yönlendirir) */}
        <View style={styles.posterTilt}>
          {poster ? (
            <Image
              source={{ uri: getTmdbUrl(poster, "poster", 200) }}
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

        {/* Sağ sütun: tür + başlık + çipler */}
        <View style={styles.side}>
          {!!typeLabel(media?.media_type) && (
            <Text allowFontScaling={false} style={styles.type}>
              {typeLabel(media?.media_type)}
            </Text>
          )}
          <Text style={styles.title} numberOfLines={3}>
            {text}
          </Text>

          <View style={styles.chips}>
            <TouchableOpacity
              onPress={toggleSummary}
              activeOpacity={0.85}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={[styles.chip, { backgroundColor: accent }]}
            >
              <Ionicons
                name={summaryOpen ? "chevron-up" : "sparkles"}
                size={14}
                color="#fff"
              />
              <Text allowFontScaling={false} style={styles.chipText}>
                {i18nText("autoI18n.ozet", "Özet")}
              </Text>
            </TouchableOpacity>

            {!isPerson && (
              <TouchableOpacity
                onPress={onOpenTrailer}
                activeOpacity={0.85}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={[styles.chip, { backgroundColor: accent }]}
              >
                <Ionicons name="play-circle" size={15} color="#fff" />
                <Text allowFontScaling={false} style={styles.chipText}>
                  {i18nText("autoI18n.fragman", "Fragman")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Animasyonlu genel özet */}
      {summaryOpen && (
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
  row: { flexDirection: "row", alignItems: "flex-start", gap: 14 },

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
  poster: {
    width: 72,
    height: 108,
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

  side: { flex: 1, flexShrink: 1, justifyContent: "center", gap: 4 },
  type: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  title: { fontSize: 14, fontWeight: "800", color: "#fff", lineHeight: 18 },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
    marginTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  chipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 15,
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
