// components/storyShare/StoryTemplateTicket.js
//
// Şablon 1: Nostaljik Sinema Bileti (Vintage Cinema Ticket).
// Perforajlı kenarlar, barkod, damga, kullanıcı puanı ve izleme tarihi.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import AppIcon from "../AppIcon";

export default function StoryTemplateTicket({
  media,
  userRating,
  watchedDate,
  userNote,
  theme,
}) {
  const posterUri = media?.poster_path
    ? `https://image.tmdb.org/t/p/w780${media.poster_path}`
    : null;

  const year = media?.release_date ? media.release_date.split("-")[0] : "";
  const dateStr = watchedDate || new Date().toISOString().split("T")[0];

  return (
    <View style={[styles.ticketContainer, { backgroundColor: "#18181A" }]}>
      {/* Top Banner with Cutouts */}
      <View style={styles.topSection}>
        <View style={styles.posterWrap}>
          {posterUri && (
            <Image
              source={{ uri: posterUri }}
              style={styles.poster}
              contentFit="cover"
            />
          )}
        </View>

        <View style={styles.ticketDetails}>
          <Text style={styles.cinemaBrand}>SEELOGD CINEMA</Text>
          <Text style={styles.movieTitle} numberOfLines={2}>
            {media?.title || media?.name || "Film Adı"}
          </Text>
          <Text style={styles.metaText}>
            {year ? `${year} · ` : ""}ADMIT ONE
          </Text>

          {userRating ? (
            <View style={styles.ratingRow}>
              <AppIcon family="Ionicons" name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingValue}>{userRating}/10</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Perforated Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.leftHole} />
        <View style={styles.dashLine} />
        <View style={styles.rightHole} />
      </View>

      {/* Bottom Stub */}
      <View style={styles.bottomStub}>
        <View style={styles.stubInfo}>
          <Text style={styles.stubLabel}>TARİH</Text>
          <Text style={styles.stubVal}>{dateStr}</Text>

          {userNote ? (
            <Text style={styles.userNote} numberOfLines={2}>
              "{userNote}"
            </Text>
          ) : null}
        </View>

        {/* Faux Barcode */}
        <View style={styles.barcodeBox}>
          <View style={styles.barcodeBars}>
            {[2, 4, 1, 3, 2, 5, 1, 4, 3, 2, 4, 1, 3, 2, 4, 2, 3, 1, 4].map((w, i) => (
              <View
                key={i}
                style={[styles.barLine, { width: w, marginRight: 2 }]}
              />
            ))}
          </View>
          <Text style={styles.barcodeNumber}>*SLGD-{media?.id || "0000"}*</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ticketContainer: {
    width: 320,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#333338",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  topSection: {
    flexDirection: "row",
    padding: 16,
    gap: 14,
  },
  posterWrap: {
    width: 90,
    height: 135,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#252528",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  ticketDetails: {
    flex: 1,
    justifyContent: "center",
  },
  cinemaBrand: {
    color: "#E50914",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 4,
  },
  movieTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22,
    marginBottom: 4,
  },
  metaText: {
    color: "#888890",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#24242A",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratingValue: {
    color: "#FFD700",
    fontSize: 13,
    fontWeight: "800",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 24,
    overflow: "hidden",
  },
  leftHole: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0A0A0C", // Arka planla kaynaşır
    marginLeft: -12,
  },
  rightHole: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0A0A0C",
    marginRight: -12,
  },
  dashLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: "#333338",
    borderStyle: "dashed",
  },
  bottomStub: {
    padding: 16,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  stubInfo: {
    flex: 1,
  },
  stubLabel: {
    color: "#666670",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  stubVal: {
    color: "#DDDDE5",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  userNote: {
    color: "#AAAAAF",
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 6,
    lineHeight: 15,
  },
  barcodeBox: {
    alignItems: "center",
    marginLeft: 12,
  },
  barcodeBars: {
    flexDirection: "row",
    height: 32,
    alignItems: "stretch",
  },
  barLine: {
    backgroundColor: "#EEEEEE",
    height: "100%",
  },
  barcodeNumber: {
    color: "#777780",
    fontSize: 9,
    letterSpacing: 1.5,
    marginTop: 3,
  },
});
