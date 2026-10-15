import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import { cleanReplyPreview, replyGlyph } from "@utils/chatReply";
import { alpha } from "../../theme/colors";

// Alıntı kartlarının (balon içi + yazma alanı üstü) ortak parçaları.
export const REPLY_THUMB_WIDTH = 34;
export const REPLY_THUMB_HEIGHT = 48;

export function ReplyThumb({ reply, getTmdbUrl, style }) {
  const { theme } = useTheme();
  if (!reply?.thumb || typeof getTmdbUrl !== "function") return null;
  return (
    <Image
      source={{ uri: getTmdbUrl(reply.thumb, "poster", 200) }}
      style={[
        styles.thumb,
        { backgroundColor: alpha(theme.text.primary, 0.08) },
        style,
      ]}
      contentFit="cover"
      transition={120}
      recyclingKey={reply.thumb}
    />
  );
}

// Düz metin dışındaki alıntılarda (anket, film/dizi, koleksiyon) metnin önüne
// tür simgesi koyar; neyin alıntılandığı ilk bakışta anlaşılsın.
export function ReplyGlyph({ reply, color, size = 12 }) {
  const name = replyGlyph(reply?.kind, reply?.mediaType);
  if (!name) return null;
  return <Ionicons name={name} size={size} color={color} style={styles.glyph} />;
}

// `isOutgoing`: alıntı, vurgu renkli GİDEN balonun içinde duruyor. Orada tema
// vurgusuyla çizilen şerit/ad balonun kendi zemininde kaybolur ve açık
// temalarda sabit beyaz metin okunmazdı; bu yüzden beyaz-üstü-koyu-cam
// paleti kullanılır.
// `isSelf`: alıntılanan mesaj benim; kayıtlı ad eski olabilir (profil adı
// değişmiş), bu yüzden "Sen" yazılır.
// `accentColor`: gelen balonda şerit/ad rengi (gruplarda gönderenin rengi).
export default function MessageReplyPreview({
  reply,
  onPress,
  isOutgoing = false,
  isSelf = false,
  accentColor,
  getTmdbUrl,
}) {
  const { theme } = useTheme();
  if (!reply) return null;
  const Wrapper = onPress ? Pressable : View;

  const stripe = isOutgoing ? "rgba(255,255,255,0.9)" : accentColor || theme.accent;
  const nameColor = isOutgoing ? "#fff" : stripe;
  const bodyColor = isOutgoing ? "rgba(255,255,255,0.88)" : theme.text.secondary;
  const name = isSelf
    ? i18nText("autoI18n.sen", "Sen")
    : reply.senderName || i18nText("autoI18n.sohbet_mesaji", "Mesaj");
  const body =
    cleanReplyPreview(reply.preview, reply.kind) ||
    i18nText("autoI18n.sohbet_mesaji", "Mesaj");
  const hasThumb = Boolean(reply.thumb) && typeof getTmdbUrl === "function";

  const baseStyle = [
    styles.container,
    { backgroundColor: isOutgoing ? "rgba(0,0,0,0.2)" : alpha(stripe, 0.16) },
  ];

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
      style={onPress ? ({ pressed }) => [baseStyle, pressed && styles.pressed] : baseStyle}
    >
      <View style={[styles.stripe, { backgroundColor: stripe }]} />
      <View style={[styles.copy, hasThumb && styles.copyWithThumb]}>
        <Text
          allowFontScaling={false}
          style={[styles.sender, { color: nameColor }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <View style={styles.bodyRow}>
          <ReplyGlyph reply={reply} color={bodyColor} />
          <Text
            allowFontScaling={false}
            style={[styles.preview, { color: bodyColor }]}
            numberOfLines={hasThumb ? 2 : 1}
          >
            {body}
          </Text>
        </View>
      </View>
      {hasThumb ? <ReplyThumb reply={reply} getTmdbUrl={getTmdbUrl} style={styles.bubbleThumb} /> : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 160,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 7,
  },
  pressed: { opacity: 0.72 },
  stripe: { alignSelf: "stretch", width: 3.5 },
  copy: { flex: 1, paddingLeft: 9, paddingRight: 10, paddingVertical: 7 },
  copyWithThumb: { paddingRight: 8 },
  sender: { fontSize: 11.5, fontWeight: "800", marginBottom: 2 },
  bodyRow: { flexDirection: "row", alignItems: "center" },
  glyph: { marginRight: 5 },
  preview: { flexShrink: 1, fontSize: 12, lineHeight: 16 },
  thumb: {
    width: REPLY_THUMB_WIDTH,
    height: REPLY_THUMB_HEIGHT,
    borderRadius: 6,
  },
  bubbleThumb: { marginVertical: 6, marginRight: 6 },
});
