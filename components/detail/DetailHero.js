import React from "react";
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useImageQualitySettings } from "../../context/AppSettingsContext";

const { width } = Dimensions.get("window");
const BACKDROP_HEIGHT = width * (9 / 16);

/* Detay ekranı hero alanı: backdrop görseli + alt gradient.
   Backdrop yoksa fallbackIcon ile boş durum gösterir. */
export default function DetailHero({ backdropPath, fallbackIcon, onPress }) {
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();

  return (
    <View style={styles.heroContainer}>
      {backdropPath ? (
        <TouchableOpacity activeOpacity={0.95} onPress={onPress}>
          <Image
            source={{ uri: getTmdbUrl(backdropPath, "backdrop", 1000) }}
            style={styles.backdrop}
          />
        </TouchableOpacity>
      ) : (
        <View style={[styles.noBackdrop, { backgroundColor: theme.secondary }]}>
          <Ionicons name={fallbackIcon} size={64} color={theme.text.muted} />
        </View>
      )}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.15)", theme.primary]}
        locations={[0.3, 0.65, 1]}
        style={styles.heroGradient}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heroContainer: { height: BACKDROP_HEIGHT, position: "relative" },
  backdrop: { width: "100%", height: "100%", resizeMode: "cover" },
  noBackdrop: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  heroGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: BACKDROP_HEIGHT * 0.7,
  },
});
