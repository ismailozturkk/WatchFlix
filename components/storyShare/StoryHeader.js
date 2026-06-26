import React, { memo } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";

function StoryHeaderComponent({ busy, onBack, onOpenDrafts, onSaveDraft }) {
  const { theme } = useTheme();
  const btn = [styles.btn, { backgroundColor: theme.secondary, opacity: busy ? 0.5 : 1 }];
  return (
    <View style={styles.header}>
      <TouchableOpacity activeOpacity={0.8} onPress={onBack} style={btn}>
        <Ionicons name="close" size={22} color={theme.text.primary} />
      </TouchableOpacity>
      <Text
        allowFontScaling={false}
        style={[styles.title, { color: theme.text.primary }]}
        numberOfLines={1}
      >
        Story Tasarla
      </Text>
      <View style={styles.right}>
        <TouchableOpacity activeOpacity={0.8} onPress={onOpenDrafts} disabled={busy} style={btn}>
          <Ionicons name="folder-open-outline" size={19} color={theme.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} onPress={onSaveDraft} disabled={busy} style={btn}>
          <Ionicons name="save-outline" size={19} color={theme.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const StoryHeader = memo(StoryHeaderComponent);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 10,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontSize: 17, fontWeight: "900" },
  right: { flexDirection: "row", gap: 10 },
});
