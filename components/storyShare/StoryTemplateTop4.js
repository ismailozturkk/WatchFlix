// components/storyShare/StoryTemplateTop4.js
//
// Şablon 4: Favori 4'lü Vitrini (Top 4 Showcase).
// Kullanıcı adı, avatarı ve 4 favori filmini sergileyen 2x2 estetik ızgara kartı.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import AppIcon from "../AppIcon";
import { alpha } from "../../theme/colors";
import UserAvatar from "../common/UserAvatar";

export default function StoryTemplateTop4({
  user,
  topMovies = [],
  theme,
}) {
  const movies = (topMovies || []).slice(0, 4);

  return (
    <View style={[styles.top4Container, { backgroundColor: "#141417" }]}>
      {/* Header Profile Info */}
      <View style={styles.header}>
        <UserAvatar avatarIndex={user?.avatarIndex} photoURL={user?.photoURL} isCustomPhoto size={40} />

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.displayName || "Sinemasever"}</Text>
          <Text style={styles.userHandle}>@seelogd</Text>
        </View>

        <View style={[styles.brandBadge, { backgroundColor: alpha(theme.accent || "#138DF0", 0.2) }]}>
          <Text style={[styles.brandBadgeText, { color: theme.accent || "#138DF0" }]}>TOP 4</Text>
        </View>
      </View>

      <Text style={styles.showcaseTitle}>FAVORİ 4 FİLMİM</Text>

      {/* 2x2 Posters Grid */}
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((idx) => {
          const item = movies[idx];
          const posterUri = item?.imagePath || item?.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.imagePath || item.poster_path}`
            : null;

          return (
            <View key={idx} style={styles.posterSlot}>
              {posterUri ? (
                <Image source={{ uri: posterUri }} style={styles.gridPoster} contentFit="cover" />
              ) : (
                <View style={styles.emptySlot}>
                  <AppIcon family="MaterialCommunityIcons" name="filmstrip" size={28} color="#444" />
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <AppIcon family="Ionicons" name="film-outline" size={14} color="#777" />
        <Text style={styles.footerText}>Senin favorilerin neler? seelogd.com</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top4Container: {
    width: 320,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#28282E",
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  userHandle: {
    color: "#888890",
    fontSize: 11,
  },
  brandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  brandBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  showcaseTitle: {
    color: "#DDDDE5",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    textAlign: "center",
    marginBottom: 14,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  posterSlot: {
    width: "48%",
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#202026",
  },
  gridPoster: {
    width: "100%",
    height: "100%",
  },
  emptySlot: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  footerText: {
    color: "#777780",
    fontSize: 11,
    fontWeight: "600",
  },
});
