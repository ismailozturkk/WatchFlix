import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { i18nText } from "@utils/i18nText";

export default function MessageReplyPreview({ reply, onPress, composer = false }) {
  if (!reply) return null;
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
      style={[styles.container, composer && styles.composer]}
    >
      <View style={styles.accent} />
      <View style={styles.copy}>
        <Text allowFontScaling={false} style={styles.sender} numberOfLines={1}>
          {reply.senderName || i18nText("autoI18n.sohbet_mesaji", "Mesaj")}
        </Text>
        <Text allowFontScaling={false} style={styles.preview} numberOfLines={composer ? 2 : 1}>
          {reply.preview || i18nText("autoI18n.sohbet_mesaji", "Mesaj")}
        </Text>
      </View>
      {composer ? <Ionicons name="return-up-back" size={16} color="rgba(255,255,255,0.42)" /> : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 150,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 11,
    overflow: "hidden",
    marginBottom: 7,
    paddingRight: 9,
  },
  composer: {
    flex: 1,
    backgroundColor: "rgba(108,99,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(108,99,255,0.2)",
    marginBottom: 9,
  },
  accent: { alignSelf: "stretch", width: 3, backgroundColor: "#8A83FF" },
  copy: { flex: 1, paddingHorizontal: 9, paddingVertical: 7 },
  sender: { color: "#A9A5FF", fontSize: 11, fontWeight: "800", marginBottom: 2 },
  preview: { color: "rgba(255,255,255,0.62)", fontSize: 11.5, lineHeight: 16 },
});
