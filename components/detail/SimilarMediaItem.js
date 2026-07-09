import React, { memo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import PosterImage from "../PosterImage";
import ListBadges from "../ListBadges";
import { useTheme } from "../../context/ThemeContext";

const { width } = Dimensions.get("window");

/* Benzer/önerilen içerik kartı: poster + puan rozeti + liste rozetleri.
   mediaType'a göre film ya da dizi detayına push eder. */
const SimilarMediaItem = memo(function SimilarMediaItem({
  item,
  mediaType,
  navigation,
}) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.93,
      friction: 4,
      useNativeDriver: true,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.9}
        style={styles.similarItem}
        onPress={() =>
          navigation.push(
            mediaType === "movie" ? "MovieDetails" : "TvShowsDetails",
            { id: item.id },
          )
        }
      >
        <PosterImage
          path={item.poster_path}
          type={mediaType}
          size={200}
          iconSize={46}
          style={[styles.similarPoster, { borderColor: theme.border + "55" }]}
        />
        {/* Rating pill */}
        <View
          style={[styles.ratingPill, { backgroundColor: "rgba(0,0,0,0.72)" }]}
        >
          <Ionicons name="star" size={9} color="#FFD700" />
          <Text allowFontScaling={false} style={styles.ratingPillText}>
            {item.vote_average.toFixed(1)}
          </Text>
        </View>
        {/* List indicators */}
        <View style={styles.stats}>
          <ListBadges
            mediaId={item.id}
            mediaType={mediaType}
            theme={theme}
            style={{
              gap: 3,
              paddingVertical: 4,
              paddingHorizontal: 2,
              borderRadius: 10,
              backgroundColor: "rgba(0,0,0,0.72)",
            }}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default SimilarMediaItem;

const styles = StyleSheet.create({
  similarItem: { width: width * 0.38 },
  similarPoster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 14,
    borderWidth: 1,
  },
  ratingPill: {
    position: "absolute",
    bottom: 8,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ratingPillText: { color: "#FFD700", fontSize: 11, fontWeight: "700" },
  stats: {
    position: "absolute",
    bottom: 8,
    left: 6,
    zIndex: 10,
  },
});
