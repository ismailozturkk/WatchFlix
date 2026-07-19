import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import RatingSummary from "../RatingSummary";
import { useTheme } from "../../context/ThemeContext";
import { useImageQualitySettings } from "../../context/AppSettingsContext";

const { width } = Dimensions.get("window");
const BACKDROP_HEIGHT = width * (9 / 16);

/* Poster + başlık bloğu: poster, başlık, alternatif başlık (film),
   tagline, tür çipleri ve hibrit puan satırı. */
export default function DetailInfoHeader({
  posterPath,
  title,
  altTitle,
  tagline,
  genres,
  mediaType,
  mediaId,
  tmdbAvg,
  tmdbCount,
  releaseDate,
  onPosterPress,
  onPressRate,
}) {
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();

  return (
    <View style={styles.infoHeader}>
      {/* Poster */}
      <TouchableOpacity
        style={styles.posterShadow}
        onPress={onPosterPress}
        activeOpacity={0.92}
      >
        {posterPath ? (
          <Image
            source={{ uri: getTmdbUrl(posterPath, "poster", 200) }}
            style={[styles.poster, { borderColor: theme.border + "80" }]}
          />
        ) : (
          <View style={[styles.noPoster, { backgroundColor: theme.secondary }]}>
            <Ionicons name="image-outline" size={40} color={theme.text.muted} />
          </View>
        )}
      </TouchableOpacity>

      {/* Title block */}
      <View style={styles.titleBlock}>
        <Text
          allowFontScaling={false}
          style={[styles.title, { color: theme.text.primary }]}
        >
          {title}
        </Text>
        {altTitle ? (
          <Text
            allowFontScaling={false}
            style={[styles.altTitle, { color: theme.text.muted }]}
          >
            {altTitle}
          </Text>
        ) : null}
        {tagline ? (
          <Text
            allowFontScaling={false}
            style={[styles.tagline, { color: theme.accent }]}
            numberOfLines={2}
          >
            "{tagline}"
          </Text>
        ) : null}

        {/* Genres */}
        <View style={styles.genreRow}>
          {(genres || []).slice(0, 3).map((g) => (
            <View
              key={g.id}
              style={[
                styles.genreChip,
                {
                  backgroundColor: theme.accent + "22",
                  borderColor: theme.accent + "44",
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[styles.genreChipText, { color: theme.accent }]}
              >
                {g.name}
              </Text>
            </View>
          ))}
        </View>

        {/* Rating row — hybrid (TMDB + uygulama oyları), dokununca puan ver */}
        <View style={styles.ratingRow}>
          <RatingSummary
            mediaType={mediaType}
            mediaId={mediaId}
            tmdbAvg={tmdbAvg}
            tmdbCount={tmdbCount}
            releaseDate={releaseDate}
            onPressRate={onPressRate}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  infoHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: -BACKDROP_HEIGHT * 0.28,
    gap: 14,
    alignItems: "flex-end",
    marginBottom: 20,
  },
  posterShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  poster: { width: 110, height: 110 * 1.5, borderRadius: 14, borderWidth: 1.5 },
  noPoster: {
    width: 110,
    height: 110 * 1.5,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  titleBlock: { flex: 1, paddingBottom: 4, gap: 4 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  altTitle: { fontSize: 12, fontStyle: "italic" },
  tagline: { fontSize: 12, fontStyle: "italic", lineHeight: 17 },
  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  genreChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  genreChipText: { fontSize: 11, fontWeight: "600" },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
});
