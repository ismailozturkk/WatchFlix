import React from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../context/ThemeContext";
import { useImageQualitySettings } from "../context/AppSettingsContext";

/**
 * Poster/afiş görseli için tek kaynak.
 *
 * Path varsa TMDB görselini, yoksa tema uyumlu bir İKON yer tutucusu gösterir
 * (eski `assets/image/no_image.png` görselinin yerine). Kutu boyutu her iki
 * durumda da `style` ile aynı kalır; yer tutucu ortalanmış bir ikon içerir.
 *
 * @param {string|null} path     TMDB poster yolu (yoksa ikon gösterilir)
 * @param {"movie"|"tv"} type    İkon seçimi (film / dizi)
 * @param {object|array} style   Kutu stili (görsele ve yer tutucuya uygulanır)
 * @param {number} size          TMDB görsel boyutu (varsayılan 200)
 * @param {number} iconSize      İkon boyutu override (yoksa style.width'ten türetilir)
 * @param {string} iconName      İkon adı override (varsayılan film-outline / tv-outline)
 */
export default function PosterImage({
  path,
  type = "movie",
  style,
  size = 200,
  iconSize,
  iconName,
  ...rest
}) {
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();

  if (path) {
    return (
      <Image
        source={{ uri: getTmdbUrl(path, "poster", size) }}
        style={style}
        {...rest}
      />
    );
  }

  // İkon yer tutucu — kutu boyutu style ile aynı kalır.
  const flat = StyleSheet.flatten(style) || {};
  const resolvedIconSize =
    iconSize ||
    (typeof flat.width === "number" ? Math.round(flat.width * 0.42) : 34);

  return (
    <View
      style={[
        style,
        styles.placeholder,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <Ionicons
        name={iconName || (type === "tv" ? "tv-outline" : "film-outline")}
        size={resolvedIconSize}
        color={theme.text.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
