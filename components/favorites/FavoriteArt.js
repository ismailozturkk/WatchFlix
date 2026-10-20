// components/favorites/FavoriteArt.js
//
// Bir favorinin görseli: film/dizi için poster, oyuncu için yuvarlak portre.
// Görsel yolu yoksa ya da yüklenemezse tür ikonlu yer tutucu — kutu boyutu her
// iki durumda da aynı kalır.

import React from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useImageQualitySettings } from "../../context/AppSettingsContext";

const PLACEHOLDER_ICON = {
  movies: "film-outline",
  shows: "tv-outline",
  people: "person-outline",
};

/**
 * @param {string|null} path   TMDB görsel yolu (`/abc.jpg`)
 * @param {"movies"|"shows"|"people"} kind
 * @param {number} width
 * @param {number} height
 * @param {number} [radius]    Köşe; oyuncuda yarıçap otomatik yuvarlak
 */
export default function FavoriteArt({ path, kind, width, height, radius = 12, style }) {
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();
  const round = kind === "people";
  const box = {
    width,
    height,
    borderRadius: round ? Math.min(width, height) / 2 : radius,
    backgroundColor: theme.primary,
    overflow: "hidden",
  };

  if (path) {
    // 2x: yoğun ekranda keskin kalsın (getTmdbUrl en yakın TMDB boyutunu seçer).
    const uri = getTmdbUrl(path, round ? "profile" : "poster", Math.round(width * 2));
    return (
      <Image
        source={{ uri }}
        style={[box, style]}
        contentFit="cover"
        transition={120}
        cachePolicy="memory-disk"
        recyclingKey={`favorite-${kind}-${path}`}
      />
    );
  }

  return (
    <View style={[box, styles.placeholder, { borderColor: theme.border }, style]}>
      <Ionicons
        name={PLACEHOLDER_ICON[kind] || "image-outline"}
        size={Math.max(16, Math.round(Math.min(width, height) * 0.42))}
        color={theme.text.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
