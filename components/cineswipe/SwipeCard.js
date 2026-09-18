// components/cineswipe/SwipeCard.js
//
// Reanimated 4 ve PanGesture ile 60/120 FPS akıcılıkta kaydırılabilir film kartı.
// Üzerinde ListBadges rozetleri, yıl/puan meta satırı ve basıldığında genişleyen
// akıcı özet (expandable overview) metni barındırır.

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import AppIcon from "../AppIcon";
import ListBadges from "../ListBadges";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 36;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.64;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

export default function SwipeCard({
  media,
  isTop,
  disabled = false,
  onSwipeLeft,
  onSwipeRight,
  theme,
}) {
  const [expanded, setExpanded] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const toggleExpand = () => {
    triggerHaptic("selection");
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const panGesture = Gesture.Pan()
    .enabled(isTop && !disabled)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (translateX.value > SWIPE_THRESHOLD) {
        // Sağa Fırlat (Beğen)
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 250 }, () => {
          runOnJS(onSwipeRight)(media);
        });
        runOnJS(triggerHaptic)("impact");
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        // Sola Fırlat (Pas)
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 250 }, () => {
          runOnJS(onSwipeLeft)(media);
        });
        runOnJS(triggerHaptic)("selection");
      } else {
        // Merkeze Dön
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-12, 0, 12],
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  // Beğen Rozeti (Sağa çekince yeşil yanar)
  const likeBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD * 0.7], [0, 1]),
    transform: [
      {
        scale: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0.8, 1.1]),
      },
    ],
  }));

  // Pas Rozeti (Sola çekince kırmızı yanar)
  const nopeBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD * 0.7, 0], [1, 0]),
    transform: [
      {
        scale: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1.1, 0.8]),
      },
    ],
  }));

  const posterUri = media?.poster_path
    ? `https://image.tmdb.org/t/p/w780${media.poster_path}`
    : null;

  const year = media?.release_date ? media.release_date.split("-")[0] : "";
  const rating = media?.vote_average ? Number(media.vote_average).toFixed(1) : "";
  const mediaTypeLabel = media?.mediaType === "tv" ? "Dizi" : "Film";

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        {/* Poster Image */}
        {posterUri ? (
          <Image
            source={{ uri: posterUri }}
            style={styles.poster}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.noPoster, { backgroundColor: "#2A2A2E" }]}>
            <AppIcon family="MaterialCommunityIcons" name="movie-outline" size={64} color="#666" />
          </View>
        )}

        {/* List Badges (İzleme Durumu Rozeti) */}
        {media?.id ? (
          <View style={styles.badgeOverlay}>
            <ListBadges
              mediaId={media.id}
              mediaType={media.mediaType || "movie"}
              variant="chip"
              vertical={false}
              chipSize={22}
              iconSize={12}
            />
          </View>
        ) : null}

        {/* Gradient Overlay for Text Readability */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.95)"]}
          style={[styles.gradient, expanded && { height: "70%" }]}
        />

        {/* LIKE Stamp */}
        <Animated.View style={[styles.badge, styles.likeBadge, likeBadgeStyle]}>
          <Text style={styles.likeBadgeText}>BEĞEN</Text>
        </Animated.View>

        {/* NOPE Stamp */}
        <Animated.View style={[styles.badge, styles.nopeBadge, nopeBadgeStyle]}>
          <Text style={styles.nopeBadgeText}>PAS</Text>
        </Animated.View>

        {/* Media Details & Expandable Overview */}
        <View style={styles.infoContainer}>
          {/* Title */}
          <Text style={styles.title} numberOfLines={expanded ? 3 : 2}>
            {media.title || media.name}
          </Text>

          {/* Subtitle: Yıl + Puan + Tür */}
          <View style={styles.metaRow}>
            {year ? (
              <View style={styles.metaPill}>
                <AppIcon family="Ionicons" name="calendar-outline" size={12} color="#FFF" />
                <Text style={styles.metaPillText}>{year}</Text>
              </View>
            ) : null}

            {rating && rating !== "0.0" ? (
              <View style={[styles.metaPill, styles.ratingPill]}>
                <AppIcon family="Ionicons" name="star" size={12} color="#FFD700" />
                <Text style={styles.ratingText}>{rating}</Text>
              </View>
            ) : null}

            <View style={[styles.metaPill, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
              <Text style={styles.metaPillText}>{mediaTypeLabel}</Text>
            </View>
          </View>

          {/* Basılınca Genişleyen Açıklama (Expandable Overview) */}
          {media.overview ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={toggleExpand}
              style={styles.overviewBox}
            >
              <Text
                style={styles.overview}
                numberOfLines={expanded ? undefined : 2}
              >
                {media.overview}
              </Text>
              <View style={styles.expandHintRow}>
                <Text style={styles.expandHintText}>
                  {expanded ? "Daha az göster" : "Özeti oku"}
                </Text>
                <AppIcon
                  family="Ionicons"
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={12}
                  color="rgba(255,255,255,0.6)"
                />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#1C1C1E",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  poster: {
    ...StyleSheet.absoluteFillObject,
  },
  noPoster: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeOverlay: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "58%",
  },
  badge: {
    position: "absolute",
    top: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 3,
    zIndex: 10,
  },
  likeBadge: {
    left: 20,
    borderColor: "#4CD964",
    backgroundColor: "rgba(76, 217, 100, 0.25)",
    transform: [{ rotate: "-15deg" }],
  },
  likeBadgeText: {
    color: "#4CD964",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  nopeBadge: {
    right: 20,
    borderColor: "#FF3B30",
    backgroundColor: "rgba(255, 59, 48, 0.25)",
    transform: [{ rotate: "15deg" }],
  },
  nopeBadgeText: {
    color: "#FF3B30",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  infoContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    zIndex: 5,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26,
    letterSpacing: -0.3,
    marginBottom: 8,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  metaPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  ratingPill: {
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    borderColor: "rgba(255, 215, 0, 0.3)",
  },
  ratingText: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "800",
  },
  overviewBox: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  overview: {
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: 12,
    lineHeight: 17,
  },
  expandHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4,
  },
  expandHintText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "600",
  },
});
