// components/cineswipe/CineSegmented.js
//
// Kayan göstergeli segment kontrolü (Solo/Duo geçişi ve içerik türü seçimi).
// Gösterge seçili parçaya yaylanarak kayar; eski sürüm rengi anında değiştiriyordu.
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import AppIcon from "../AppIcon";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";

const PAD = 4;
const SPRING = { damping: 18, stiffness: 230, mass: 0.8 };

/**
 * @param {{ id: string, label: string, icon?: string }[]} options
 * @param {string} value
 * @param {(id: string) => void} onChange
 * @param {boolean} [disabled]  Tüm kontrol pasif (ör. kaynak içerik türünü sabitliyor).
 * @param {"md"|"lg"} [size]
 */
export default function CineSegmented({ options, value, onChange, disabled = false, colors, size = "md", style }) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.id === value));
  const position = useSharedValue(index);

  useEffect(() => {
    position.value = withSpring(index, SPRING);
  }, [index, position]);

  const segmentWidth = width > 0 ? (width - PAD * 2) / options.length : 0;
  const indicator = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: position.value * segmentWidth }],
  }));
  const large = size === "lg";

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        styles.track,
        { backgroundColor: alpha(colors.surface, 0.75), opacity: disabled ? 0.55 : 1 },
        style,
      ]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { backgroundColor: colors.accent }, indicator]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.id === value;
        const tint = selected ? colors.onAccent : colors.textSecondary;
        return (
          <Pressable
            key={option.id}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={option.label}
            onPress={() => {
              if (selected) return;
              triggerHaptic("selection");
              onChange(option.id);
            }}
            style={[styles.segment, large ? styles.segmentLarge : null]}
          >
            {option.icon ? <AppIcon family="Ionicons" name={option.icon} size={large ? 17 : 15} color={tint} /> : null}
            <Text numberOfLines={1} style={[styles.label, large ? styles.labelLarge : null, { color: tint }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: 16,
    padding: PAD,
  },
  indicator: {
    position: "absolute",
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: 12,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  segmentLarge: {
    paddingVertical: 11,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
  },
  labelLarge: {
    fontSize: 14,
    fontWeight: "800",
  },
});
