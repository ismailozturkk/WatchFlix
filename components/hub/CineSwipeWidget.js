// components/hub/CineSwipeWidget.js
//
// Hub sekmesindeki modern, gösterişli ve animasyonlu CineSwipe banner widget'ı.
// Üst üste binen mini kartlar, parlama efektleri ve yay etkileşimi içerir.

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import AppIcon from "../AppIcon";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING_CONFIG = { mass: 0.4, damping: 12, stiffness: 180 };

export default function CineSwipeWidget({ navigation, theme }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, SPRING_CONFIG);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
  };

  const handleOpen = (initialMode = "solo") => {
    triggerHaptic("impact");
    navigation.navigate("CineSwipeScreen", { initialMode });
  };

  const accent = theme.accent || "#138DF0";
  const bold = theme.bold || "#0A65B7";

  return (
    <AnimatedPressable
      style={[styles.wrapper, animStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => handleOpen("solo")}
    >
      <LinearGradient
        colors={[
          "#E50914",
          "#B81D24",
          "#221F1F",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        {/* Ambient Glows */}
        <View style={styles.ambientGlow} />

        {/* Content Area */}
        <View style={styles.content}>
          {/* Top Pill */}
          <View style={styles.topBadgeRow}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>CINESWIPE</Text>
            </View>
            <View style={styles.modeBadge}>
              <AppIcon family="Ionicons" name="sparkles" size={12} color="#FFD700" />
              <Text style={styles.modeBadgeText}>YENİ</Text>
            </View>
          </View>

          {/* Main Title & Subtitle */}
          <Text style={styles.title}>Birlikte Ne İzlesek?</Text>
          <Text style={styles.subtitle}>
            Arkadaşınla oda kurup sağa kaydırarak eşleş veya tek başına bu akşamki filmini seç!
          </Text>

          {/* Quick Action Buttons */}
          <View style={styles.actionRow}>
            <Pressable
              style={styles.actionChip}
              onPress={() => handleOpen("solo")}
            >
              <AppIcon family="Ionicons" name="person" size={13} color="#FFF" />
              <Text style={styles.actionChipText}>Tek Başına</Text>
            </Pressable>

            <Pressable
              style={[styles.actionChip, styles.actionChipDuo]}
              onPress={() => handleOpen("duo")}
            >
              <AppIcon family="Ionicons" name="people" size={13} color="#FFF" />
              <Text style={styles.actionChipText}>Arkadaşınla</Text>
            </Pressable>
          </View>
        </View>

        {/* Decorative Floating Mini Cards (Right Side) */}
        <View style={styles.cardsVisualContainer}>
          {/* Back Card */}
          <View style={[styles.miniCard, styles.miniCardBack]}>
            <AppIcon family="Ionicons" name="film" size={24} color="rgba(255,255,255,0.4)" />
          </View>
          {/* Front Card */}
          <View style={[styles.miniCard, styles.miniCardFront]}>
            <AppIcon family="Ionicons" name="heart" size={28} color="#FF3B5C" />
            <View style={styles.miniCardHeartGlow} />
          </View>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "90%",
    borderRadius: 24,
    shadowColor: "#E50914",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 8,
  },
  container: {
    borderRadius: 24,
    padding: 20,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    minHeight: 160,
    justifyContent: "center",
  },
  ambientGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255, 75, 75, 0.25)",
  },
  content: {
    width: "72%",
    zIndex: 2,
  },
  topBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#64FF64",
  },
  liveText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255, 215, 0, 0.18)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.35)",
  },
  modeBadgeText: {
    color: "#FFD700",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  actionChipDuo: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderColor: "rgba(255,255,255,0.15)",
  },
  actionChipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  cardsVisualContainer: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: [{ translateY: -40 }],
    width: 80,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  miniCard: {
    width: 58,
    height: 80,
    borderRadius: 12,
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  miniCardBack: {
    backgroundColor: "#1F1F24",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    transform: [{ rotate: "-14deg" }, { translateX: -8 }],
  },
  miniCardFront: {
    backgroundColor: "#2C2C34",
    borderWidth: 1.5,
    borderColor: "rgba(255, 59, 92, 0.4)",
    transform: [{ rotate: "10deg" }, { translateX: 6 }],
  },
  miniCardHeartGlow: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 59, 92, 0.2)",
  },
});
