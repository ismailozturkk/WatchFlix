import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@context/ThemeContext";
import GlassSurface from "@components/common/GlassSurface";
import { useLiquidGlass } from "@services/liquidGlass";

const HEIGHT = 54;

// iOS 26+: vurgu rengiyle tonlanmış, dokununca esneyen Liquid Glass hap. Diğer
// yerlerde eski dolu accent kutusu + gölge (cam kendi gölgesini çizdiği için
// gölge YALNIZ eski yolda).
export default function ChatCreateFab({ icon, label, onPress }) {
  const { theme } = useTheme();
  const glass = useLiquidGlass();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      // Cam üstünde opaklık değişimi efekti bozar; basma geri bildirimi yalnız eski yolda.
      style={({ pressed }) => [styles.anchor, !glass && pressed && styles.pressedFallback]}
    >
      <GlassSurface
        radius={glass ? HEIGHT / 2 : 18}
        tint={theme.accent}
        interactive
        fallbackStyle={[styles.fallbackBox, { backgroundColor: theme.accent }]}
        style={styles.fab}
      >
        <Ionicons name={icon} size={22} color="#fff" />
        <Text allowFontScaling={false} numberOfLines={1} style={styles.label}>
          {label}
        </Text>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    right: 18,
    bottom: 18,
    zIndex: 20,
    maxWidth: "72%",
  },
  fab: {
    height: HEIGHT,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  fallbackBox: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 9,
  },
  pressedFallback: { opacity: 0.88 },
  label: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
