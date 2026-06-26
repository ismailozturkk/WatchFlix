// components/BackButton.js
//
// Ekran içine yerleştirilen tutarlı geri butonu. Native header oku yerine
// kullanılır (ilgili ekranlarda headerShown:false yapılır).
//
// İki varyant:
//   variant="solid" (varsayılan) → düz/temalı zeminler için theme.secondary kutu
//   variant="blur"               → backdrop görsel üzeri ekranlar için koyu blur
//
// Varsayılan olarak SafeArea üst boşluğuna göre absolute konumlanır (sol üst).
// `absolute={false}` verilirse satır içi (header içinde) kullanılabilir.

import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";

export default function BackButton({
  onPress,
  iconName = "chevron-back",
  variant = "solid",
  color,
  absolute = true,
  top,
  style,
}) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  // Geri gidilemiyorsa (ör. tab kökü / ilk ekran) ve özel onPress yoksa gizle.
  const canGoBack = navigation?.canGoBack?.() ?? true;
  if (!onPress && !canGoBack) return null;

  const handlePress = onPress || (() => navigation.goBack());
  const positionStyle = absolute
    ? {
        position: "absolute",
        top: top != null ? top : insets.top + 8,
        left: 16,
        zIndex: 50,
        elevation: 50,
      }
    : null;

  if (variant === "blur") {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[positionStyle, style]}
      >
        <BlurView tint="dark" intensity={60} style={styles.blurBox}>
          <Ionicons name={iconName} size={22} color={color || "#fff"} />
        </BlurView>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        styles.solidBox,
        { backgroundColor: theme.secondary, borderColor: theme.border },
        positionStyle,
        style,
      ]}
    >
      <Ionicons name={iconName} size={22} color={color || theme.text.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  solidBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  blurBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
