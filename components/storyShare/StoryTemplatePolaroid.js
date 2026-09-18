// components/storyShare/StoryTemplatePolaroid.js
//
// Şablon 3: Polaroid Minimal.
// Klasik analog fotoğraf çerçevesi, el yazısı havasında film alıntısı ve yıldızlar.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import AppIcon from "../AppIcon";

export default function StoryTemplatePolaroid({
  media,
  userRating,
  userNote,
  watchedDate,
}) {
  const posterUri = media?.poster_path
    ? `https://image.tmdb.org/t/p/w780${media.poster_path}`
    : null;

  const year = media?.release_date ? media.release_date.split("-")[0] : "";
  const dateStr = watchedDate || new Date().toLocaleDateString("tr-TR");

  return (
    <View style={styles.polaroidFrame}>
      {/* Photo Area */}
      <View style={styles.photoContainer}>
        {posterUri && (
          <Image
            source={{ uri: posterUri }}
            style={styles.photo}
            contentFit="cover"
          />
        )}
      </View>

      {/* Caption Bottom Area */}
      <View style={styles.captionArea}>
        <View style={styles.titleRow}>
          <Text style={styles.movieTitle} numberOfLines={1}>
            {media?.title || media?.name || "Film Adı"}
          </Text>
          {year ? <Text style={styles.movieYear}>({year})</Text> : null}
        </View>

        {userNote ? (
          <Text style={styles.handwrittenNote} numberOfLines={2}>
            "{userNote}"
          </Text>
        ) : null}

        <View style={styles.footerRow}>
          {userRating ? (
            <View style={styles.starsRow}>
              {[...Array(5)].map((_, i) => (
                <AppIcon
                  key={i}
                  family="Ionicons"
                  name={i < Math.round((userRating || 0) / 2) ? "star" : "star-outline"}
                  size={14}
                  color="#E5A00D"
                />
              ))}
              <Text style={styles.ratingDigit}>{userRating}/10</Text>
            </View>
          ) : (
            <Text style={styles.dateText}>{dateStr}</Text>
          )}

          <Text style={styles.brandWatermark}>seelogd</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  polaroidFrame: {
    width: 310,
    backgroundColor: "#FDFDFD",
    borderRadius: 12,
    padding: 14,
    paddingBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  photoContainer: {
    width: "100%",
    height: 330,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#1A1A1D",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  captionArea: {
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 4,
  },
  movieTitle: {
    color: "#18181A",
    fontSize: 16,
    fontWeight: "800",
    flexShrink: 1,
  },
  movieYear: {
    color: "#777780",
    fontSize: 12,
    fontWeight: "600",
  },
  handwrittenNote: {
    color: "#3A3A40",
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 16,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingDigit: {
    color: "#555560",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
  },
  dateText: {
    color: "#888892",
    fontSize: 11,
    fontWeight: "600",
  },
  brandWatermark: {
    color: "#A0A0AA",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
});
