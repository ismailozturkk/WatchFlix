import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Reanimated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import { cleanReplyPreview } from "@utils/chatReply";
import { alpha } from "../../theme/colors";
import ComposerBlur from "./ComposerBlur";
import { ReplyGlyph, ReplyThumb } from "./MessageReplyPreview";

const RADIUS = 18;

// Mesaj kutusunun hemen üstünde duran "şuna yanıt veriyorsun" kartı. Mesaj
// kutusuyla AYNI cam yüzeyi (ComposerBlur) kullanır: eskiden saydam bir tonla
// çiziliyordu ve altından kayan mesajlar kartın içinden okunuyordu.
//
// Çıkış animasyonu yalnız solma: kart yerleşimden hemen çıkar, kayarak
// çıkan bir kart mesaj kutusunun üstüne binerdi.
export default function ComposerReplyBar({
  reply,
  isSelf = false,
  onClose,
  onPress,
  blurTarget,
  getTmdbUrl,
}) {
  const { theme } = useTheme();
  if (!reply) return null;

  const tint = theme.accent;
  const title = isSelf
    ? i18nText("autoI18n.kendi_mesajina_yanit", "Kendi mesajına yanıt")
    : i18nText("autoI18n.replying_to_user", "{{name}} kişisine yanıt", {
        name: reply.senderName || i18nText("autoI18n.sohbet_mesaji", "Mesaj"),
      });
  const body =
    cleanReplyPreview(reply.preview, reply.kind) ||
    i18nText("autoI18n.sohbet_mesaji", "Mesaj");
  const hasThumb = Boolean(reply.thumb) && typeof getTmdbUrl === "function";

  return (
    <Reanimated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(110)}
      style={[styles.card, { borderColor: alpha(tint, 0.35) }]}
    >
      <ComposerBlur target={blurTarget} theme={theme} radius={RADIUS} />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: alpha(tint, 0.1) }]}
      />
      <View style={[styles.stripe, { backgroundColor: tint }]} />

      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={i18nText("autoI18n.alintilanan_mesaja_git", "Alıntılanan mesaja git")}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Ionicons name="arrow-undo" size={13} color={tint} />
            <Text
              allowFontScaling={false}
              style={[styles.title, { color: tint }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
          <View style={styles.bodyRow}>
            <ReplyGlyph reply={reply} color={theme.text.muted} size={13} />
            <Text
              allowFontScaling={false}
              style={[styles.preview, { color: theme.text.secondary }]}
              numberOfLines={2}
            >
              {body}
            </Text>
          </View>
        </View>
        {hasThumb ? <ReplyThumb reply={reply} getTmdbUrl={getTmdbUrl} style={styles.thumb} /> : null}
      </Pressable>

      <Pressable
        onPress={onClose}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={i18nText("autoI18n.alintiyi_iptal_et", "Alıntıyı iptal et")}
        style={({ pressed }) => [
          styles.close,
          { backgroundColor: alpha(theme.text.primary, pressed ? 0.2 : 0.1) },
        ]}
      >
        <Ionicons name="close" size={16} color={theme.text.secondary} />
      </Pressable>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 8,
  },
  stripe: { alignSelf: "stretch", width: 4 },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 11,
    paddingVertical: 9,
  },
  pressed: { opacity: 0.7 },
  copy: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  title: { flexShrink: 1, fontSize: 12.5, fontWeight: "800" },
  bodyRow: { flexDirection: "row", alignItems: "center" },
  preview: { flexShrink: 1, fontSize: 13, lineHeight: 18 },
  thumb: { marginLeft: 10 },
  close: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
  },
});
