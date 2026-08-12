import React, { forwardRef, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "../AppIcon";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PRESS_SPRING = { damping: 15, stiffness: 240, mass: 0.45 };

/** Film ve dizi ana ekranlarının ortak, animasyonlu arama girişi. */
const DiscoverSearchButton = forwardRef(function DiscoverSearchButton(
  { placeholder, onPress, animatedStyle },
  ref,
) {
  const { theme } = useTheme();
  const pressScale = useSharedValue(1);
  const arrowX = useSharedValue(0);
  const entrance = useSharedValue(0);
  const accent = theme.accent ?? theme.colors?.blue ?? "#3B82F6";

  useEffect(() => {
    entrance.value = withDelay(70, withTiming(1, { duration: 360 }));
  }, [entrance]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 8 }],
  }));
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowX.value }],
  }));

  const onPressIn = () => {
    pressScale.value = withSpring(0.985, PRESS_SPRING);
    arrowX.value = withSpring(2, PRESS_SPRING);
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, PRESS_SPRING);
    arrowX.value = withSpring(0, PRESS_SPRING);
  };

  return (
    <Animated.View
      ref={ref}
      collapsable={false}
      style={[styles.measureShell, entranceStyle, animatedStyle]}
    >
      <AnimatedPressable
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          styles.button,
          {
            backgroundColor: theme.secondary,
            borderColor: alpha(accent, 0.22),
            shadowColor: accent,
          },
          pressStyle,
        ]}
      >
        <LinearGradient
          colors={[alpha(accent, 0.98), alpha(accent, 0.72)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconBox}
        >
          <AppIcon family="Ionicons" name="search" size={19} color="#fff" />
        </LinearGradient>

        <View style={styles.copy}>
          <Text
            numberOfLines={1}
            style={[styles.placeholder, { color: theme.text?.secondary ?? theme.text?.muted }]}
          >
            {placeholder}
          </Text>
          <View style={styles.accentLine}>
            <View style={[styles.accentLineFill, { backgroundColor: alpha(accent, 0.72) }]} />
          </View>
        </View>

        <Animated.View
          style={[
            styles.arrowBox,
            { backgroundColor: alpha(accent, 0.1), borderColor: alpha(accent, 0.16) },
            arrowStyle,
          ]}
        >
          <AppIcon family="Ionicons" name="arrow-forward" size={17} color={accent} />
        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
  );
});

export default DiscoverSearchButton;

const styles = StyleSheet.create({
  measureShell: { borderRadius: 18 },
  button: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 8,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, paddingHorizontal: 12 },
  placeholder: { fontSize: 15, fontWeight: "600", letterSpacing: 0.1 },
  accentLine: {
    width: 38,
    height: 2,
    marginTop: 5,
    borderRadius: 999,
    overflow: "hidden",
    opacity: 0.65,
  },
  accentLineFill: { flex: 1, borderRadius: 999 },
  arrowBox: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
