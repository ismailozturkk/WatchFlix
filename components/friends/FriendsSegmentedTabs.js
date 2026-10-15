// components/friends/FriendsSegmentedTabs.js
//
// Sohbetler/Gruplar ve Gelen/Gönderilen sekmelerinin ORTAK kayan sekme çubuğu.
// İki ekran eskiden iki ayrı çubuk yazıyordu; biri genişliği ekran boyundan
// (Dimensions) tahmin ediyor, döndürme / bölünmüş ekranda kayıyordu. Burada
// genişlik çubuğun KENDİ ölçüsünden (onLayout) geliyor.
//
//   tabs: [{ key, label, icon?, badge?, badgeColor? }]
//   badge → sayı (0/boş = gösterilmez; 99 üstü "99+")

import React, { memo, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "@theme/colors";
import { formatBadge } from "@utils/friendsBarModel";

const PAD = 4;

function FriendsSegmentedTabs({ tabs, value, onChange }) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === value),
  );
  const anim = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: activeIndex,
      speed: 18,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, anim]);

  const tabWidth = width > 0 ? (width - PAD * 2) / tabs.length : 0;
  const canSlide = tabWidth > 0 && tabs.length > 1;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        styles.track,
        { backgroundColor: theme.secondary, borderColor: alpha(theme.border, 0.7) },
      ]}
    >
      {canSlide ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: tabWidth,
              backgroundColor: alpha(theme.accent, 0.16),
              borderColor: alpha(theme.accent, 0.4),
              transform: [
                {
                  translateX: anim.interpolate({
                    inputRange: tabs.map((_, i) => i),
                    outputRange: tabs.map((_, i) => i * tabWidth),
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}

      {tabs.map((tab) => {
        const selected = tab.key === value;
        const badgeText = formatBadge(tab.badge);
        const color = selected ? theme.text?.primary ?? "#fff" : theme.text?.muted ?? "#888";
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={[tab.label, badgeText].filter(Boolean).join(", ")}
            style={styles.tab}
          >
            {tab.icon ? (
              <Ionicons name={tab.icon} size={16} color={selected ? theme.accent : color} />
            ) : null}
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.label, { color, fontWeight: selected ? "800" : "600" }]}
            >
              {tab.label}
            </Text>
            {badgeText ? (
              <View style={[styles.badge, { backgroundColor: tab.badgeColor || theme.accent }]}>
                <Text allowFontScaling={false} style={styles.badgeText}>
                  {badgeText}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default memo(FriendsSegmentedTabs);

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    height: 48,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: PAD,
    borderRadius: 16,
    borderWidth: 1,
  },
  indicator: {
    position: "absolute",
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: 12,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 6,
  },
  label: { fontSize: 13.5, flexShrink: 1 },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800", lineHeight: 12 },
});
