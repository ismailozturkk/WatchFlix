import React from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Film ve dizi detayındaki liste işlemlerinin ortak dokunma alanı.
export default function DetailListActionTile({
  label,
  color,
  active = false,
  theme,
  compact = false,
  scale,
  opacity,
  badge,
  onPress,
  children,
}) {
  const content = (
    <>
      <Animated.View
        style={[
          styles.iconWell,
          compact && styles.iconWellCompact,
          { backgroundColor: color + (active ? "24" : "13") },
          {
            transform: [{ scale: scale || 1 }],
            opacity: opacity === undefined ? 1 : opacity,
          },
        ]}
      >
        {children}
        {badge > 0 && (
          <View style={[styles.badge, { backgroundColor: color, borderColor: theme.secondary }]}>
            <Text allowFontScaling={false} style={styles.badgeText}>
              {badge}
            </Text>
          </View>
        )}
      </Animated.View>
      <Text
        allowFontScaling={false}
        numberOfLines={2}
        style={[
          styles.label,
          compact && styles.labelCompact,
          { color: active ? color : theme.text.secondary },
        ]}
      >
        {label}
      </Text>
    </>
  );
  const tileStyle = [
    styles.tile,
    compact && styles.tileCompact,
    {
      backgroundColor: active ? color + "10" : theme.primary,
      borderColor: active ? color + "55" : theme.border,
    },
  ];

  if (!onPress) return <View style={tileStyle}>{content}</View>;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={tileStyle}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 98,
    paddingHorizontal: 3,
    paddingTop: 11,
    paddingBottom: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 16,
  },
  tileCompact: {
    minHeight: 76,
    paddingTop: 7,
    paddingBottom: 5,
    gap: 4,
    borderRadius: 13,
  },
  iconWell: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWellCompact: {
    width: 34,
    height: 34,
    borderRadius: 11,
  },
  label: {
    minHeight: 27,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    textAlign: "center",
    textAlignVertical: "center",
  },
  labelCompact: {
    minHeight: 23,
    fontSize: 9,
    lineHeight: 11,
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -7,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
