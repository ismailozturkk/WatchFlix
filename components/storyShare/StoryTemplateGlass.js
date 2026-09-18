// components/storyShare/StoryTemplateGlass.js
//
// Şablon 2: Cyber Neon Cam (Neon Glass).
// Buzlu cam efekti, şık gradyan parlama, tür rozetleri ve modern tipografi.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "../AppIcon";
import { alpha } from "../../theme/colors";

export default function StoryTemplateGlass({
  media,
  userRating,
  userNote,
  theme,
}) {
  const posterUri = media?.poster_path
    ? `https://image.tmdb.org/t/p/w780${media.poster_path}`
    : null;

  const backdropUri = media?.backdrop_path
    ? `https://image.tmdb.org/t/p/w780${media.backdrop_path}`
    : posterUri;

  const year = media?.release_date ? media.release_date.split("-")[0] : "";
  const accent = theme.accent || "#138DF0";

  return (
    <View style={styles.glassContainer}>
      {/* Background Image with Blur */}
      {backdropUri && (
        <Image
          source={{ uri: backdropUri }}
          style={styles.bgImage}
          contentFit="cover"
          blurRadius={20}
        />
      )}

      <LinearGradient
        colors={["rgba(10,10,18,0.65)", "rgba(10,10,18,0.92)"]}
        style={styles.gradientOverlay}
      />

      {/* Floating Glass Card */}
      <View style={[styles.glassCard, { borderColor: alpha(accent, 0.4) }]}>
        <View style={styles.posterContainer}>
          {posterUri && (
            <Image
              source={{ uri: posterUri }}
              style={styles.poster}
              contentFit="cover"
            />
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.6)"]}
            style={styles.posterGradient}
          />
        </View>

        <View style={styles.infoArea}>
          <Text style={styles.title} numberOfLines={2}>
            {media?.title || media?.name || "Film Adı"}
          </Text>

          <View style={styles.metaRow}>
            {year ? <Text style={styles.yearText}>{year}</Text> : null}
            <View style={[styles.pillBadge, { backgroundColor: alpha(accent, 0.2) }]}>
              <Text style={[styles.pillText, { color: accent }]}>SEELOGD</Text>
            </View>
          </View>

          {userRating ? (
            <View style={[styles.ratingBadge, { borderColor: alpha("#FFD700", 0.5) }]}>
              <AppIcon family="Ionicons" name="star" size={15} color="#FFD700" />
              <Text style={styles.ratingText}>{userRating}/10</Text>
            </View>
          ) : null}

          {userNote ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteText} numberOfLines={2}>
                "{userNote}"
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glassContainer: {
    width: 320,
    height: 440,
    borderRadius: 24,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  glassCard: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    padding: 14,
    alignItems: "center",
    justifyContent: "space-between",
  },
  posterContainer: {
    width: 170,
    height: 245,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#1F1F24",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  posterGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "40%",
  },
  infoArea: {
    width: "100%",
    alignItems: "center",
    paddingTop: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  yearText: {
    color: "#AAAAAA",
    fontSize: 12,
    fontWeight: "600",
  },
  pillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  ratingText: {
    color: "#FFD700",
    fontSize: 13,
    fontWeight: "800",
  },
  noteBox: {
    marginTop: 6,
    paddingHorizontal: 12,
  },
  noteText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
  },
});
