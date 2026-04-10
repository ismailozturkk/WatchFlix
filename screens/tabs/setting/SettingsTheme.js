import React, { useEffect } from "react";
import { StyleSheet, View, Text, Pressable, ScrollView } from "react-native";
import { useLanguage } from "../../../context/LanguageContext";
import { useTheme } from "../../../context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { themes } from "../../../theme/colors";

const THEME_CONFIGS = [
  { key: "gray", icon: "contrast", labelKey: "grayTheme" },
  { key: "blue", icon: "water", labelKey: "blueTheme" },
  { key: "green", icon: "leaf", labelKey: "greenTheme" },
  { key: "dark", icon: "moon", labelKey: "darkTheme" },
  { key: "light", icon: "sunny", labelKey: "lightTheme" },
];

const ThemeCard = ({ themeKey, isSelected, onPress, label, icon }) => {
  const p = themes[themeKey];

  const scale = useSharedValue(isSelected ? 1.07 : 1);
  const borderWidth = useSharedValue(isSelected ? 2 : 1);
  const checkOpacity = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(isSelected ? 1.07 : 1, {
      mass: 0.4,
      damping: 12,
      stiffness: 140,
    });
    borderWidth.value = withTiming(isSelected ? 2.5 : 1, { duration: 200 });
    checkOpacity.value = withTiming(isSelected ? 1 : 0, { duration: 180 });
  }, [isSelected]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderWidth: borderWidth.value,
    borderColor: isSelected ? p.accent : p.border,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkOpacity.value }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.cardWrapper}>
      <Animated.View style={[styles.card, cardStyle]}>
        {/* Üst renk şeridi */}
        <LinearGradient
          colors={[p.accent, p.bold || p.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topStrip}
        />

        {/* Mini UI mockup */}
        <View style={[styles.mockup, { backgroundColor: p.primary }]}>
          {/* Navbar */}
          <View style={[styles.mockNav, { backgroundColor: p.secondary }]}>
            <View style={[styles.mockNavDot, { backgroundColor: p.accent }]} />
            <View style={[styles.mockNavLine, { backgroundColor: p.border }]} />
          </View>

          {/* İçerik satırları */}
          <View style={styles.mockContent}>
            <View
              style={[
                styles.mockRow,
                { backgroundColor: p.between, width: "75%" },
              ]}
            />
            <View
              style={[
                styles.mockRow,
                { backgroundColor: p.secondary, width: "90%" },
              ]}
            />
            <View
              style={[
                styles.mockRow,
                { backgroundColor: p.secondary, width: "55%" },
              ]}
            />
            <View
              style={[
                styles.mockRow,
                { backgroundColor: p.between, width: "80%" },
              ]}
            />
          </View>

          {/* Accent buton */}
          <View style={[styles.mockFab, { backgroundColor: p.accent }]} />

          {/* Alt tab bar */}
          <View
            style={[
              styles.mockTabBar,
              { backgroundColor: p.secondary, borderTopColor: p.border },
            ]}
          >
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.mockTabDot,
                  { backgroundColor: i === 1 ? p.accent : p.border },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Tema adı ve ikonu */}
        <View style={[styles.cardFooter, { backgroundColor: p.secondary }]}>
          <Ionicons name={icon} size={13} color={p.text.secondary} />
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.cardLabel, { color: p.text.primary }]}
          >
            {label}
          </Text>
        </View>

        {/* Seçim rozeti */}
        <Animated.View
          style={[styles.checkBadge, { backgroundColor: p.accent }, checkStyle]}
        >
          <Ionicons name="checkmark" size={11} color="#fff" />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
};

export default function SettingsTheme() {
  const { t } = useLanguage();
  const { selectedTheme, changeTheme, theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
      >
        {THEME_CONFIGS.map((cfg) => (
          <ThemeCard
            key={cfg.key}
            themeKey={cfg.key}
            isSelected={selectedTheme === cfg.key}
            onPress={() => changeTheme(cfg.key)}
            label={t[cfg.labelKey] || cfg.key}
            icon={cfg.icon}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
    overflow: "hidden",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
    alignItems: "center",
  },

  /* Kart */
  cardWrapper: {
    padding: 4, // scale animasyonu için boşluk
  },
  card: {
    width: 100,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },

  /* Üst renk şeridi */
  topStrip: {
    height: 5,
    width: "100%",
  },

  /* Mockup alanı */
  mockup: {
    height: 120,
    paddingBottom: 0,
    overflow: "hidden",
  },
  mockNav: {
    height: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 5,
  },
  mockNavDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  mockNavLine: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  mockContent: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 6,
  },
  mockRow: {
    height: 7,
    borderRadius: 4,
  },
  mockFab: {
    position: "absolute",
    bottom: 26,
    right: 8,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  mockTabBar: {
    height: 22,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    borderTopWidth: 1,
  },
  mockTabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  /* Alt footer */
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },

  /* Checkmark rozeti */
  checkBadge: {
    position: "absolute",
    top: 10,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
});
