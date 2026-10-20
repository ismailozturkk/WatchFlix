// components/friends/FriendsScreenHeader.js
//
// Arkadaş / mesaj / istek ekranlarının ortak üst başlığı: geri butonu + SOLA
// yaslı büyük başlık + altında tek satır özet (ör. "12 arkadaş").
//
// Eskiden dört ekran dört ayrı başlık yazıyordu: üçü ortalı, Mesajlar solda;
// özet satırı hiçbirinde yoktu. Artık hepsi aynı yerden, aynı ritimle çizilir.

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import BackButton from "@components/BackButton";
import { useTheme } from "@context/ThemeContext";

export default function FriendsScreenHeader({ title, subtitle, right }) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [anim]);

  return (
    <View style={styles.row}>
      <BackButton absolute={false} />
      <Animated.View
        style={[
          styles.copy,
          {
            opacity: anim,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
            ],
          },
        ]}
      >
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[styles.title, { color: theme.text?.primary ?? "#fff" }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.subtitle, { color: theme.text?.muted ?? "#888" }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: "600", marginTop: 1 },
  right: { flexShrink: 0 },
});
