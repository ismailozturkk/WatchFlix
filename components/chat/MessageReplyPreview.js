import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import { alpha } from "../../theme/colors";

export default function MessageReplyPreview({ reply, onPress, composer = false }) {
  if (!reply) return null;
  const { theme } = useTheme();
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      {...(onPress
        ? {
            onPress: (event) => {
              event.stopPropagation?.();
              onPress();
            },
            accessibilityRole: "button",
            accessibilityLabel: i18nText("autoI18n.alintilanan_mesaja_git", "Alıntılanan mesaja git"),
          }
        : {})}
      style={[
        styles.container,
        {
          backgroundColor: composer
            ? alpha(theme.accent, 0.12)
            : alpha(theme.primary, 0.35),
          borderColor: composer ? alpha(theme.accent, 0.25) : "transparent",
        },
        composer && styles.composer,
      ]}
    >
      <View style={[styles.accent, { backgroundColor: theme.accent }]} />
      <View style={styles.copy}>
        <Text allowFontScaling={false} style={[styles.sender, { color: theme.accent }]} numberOfLines={1}>
          {reply.senderName || i18nText("autoI18n.sohbet_mesaji", "Mesaj")}
        </Text>
        <Text
          allowFontScaling={false}
          style={[
            styles.preview,
            { color: composer ? theme.text.secondary : "rgba(255,255,255,0.8)" },
          ]}
          numberOfLines={composer ? 2 : 1}
        >
          {reply.preview || i18nText("autoI18n.sohbet_mesaji", "Mesaj")}
        </Text>
      </View>
      {composer ? (
        <Ionicons name="return-up-back" size={16} color={theme.text.muted} />
      ) : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 150,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 11,
    overflow: "hidden",
    marginBottom: 7,
    paddingRight: 9,
  },
  composer: {
    flex: 1,
    borderWidth: 1,
    marginBottom: 9,
  },
  accent: { alignSelf: "stretch", width: 3 },
  copy: { flex: 1, paddingHorizontal: 9, paddingVertical: 7 },
  sender: { fontSize: 11, fontWeight: "800", marginBottom: 2 },
  preview: { fontSize: 11.5, lineHeight: 16 },
});
