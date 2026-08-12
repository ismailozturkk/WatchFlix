import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@context/ThemeContext";

export default function ChatCreateFab({ icon, label, onPress }) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.fab, { backgroundColor: theme.accent }]}
    >
      <Ionicons name={icon} size={22} color="#fff" />
      <Text allowFontScaling={false} numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 18,
    bottom: 18,
    zIndex: 20,
    minHeight: 54,
    maxWidth: "72%",
    paddingHorizontal: 18,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 9,
  },
  label: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
