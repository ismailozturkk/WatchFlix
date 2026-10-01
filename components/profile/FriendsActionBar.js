// components/profile/FriendsActionBar.js
//
// Profil ekranındaki arkadaş aksiyon şeridi: Ara / Arkadaşlar / Mesajlar / İstekler.
//
// Tasarım: dört bağımsız kart. Her kartta renkli ikon karosu, etiket ve altında
// sönük bir bilgi satırı var. Eskiden tek bir şerit içinde dikey çizgilerle
// ayrılmış butonlar vardı ve HER sayı (arkadaş sayısı, gönderilen istek dahil)
// aynı bildirim rozetiyle çiziliyordu.
//
// Ayrım (model: utils/friendsBarModel.js):
//   • Gerçek rozet — ikon karosunun köşesinde, kırmızı, kart rengiyle halkalı:
//     YALNIZ eylem bekleyen sayılar (okunmamış mesaj, gelen istek).
//   • Bilgi — etiketin altında sönük metin: arkadaş sayısı, gönderilen istek.
//     Rozet gibi durmaz, sıfırlanması beklenmez.

import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { buildFriendsBarModel, formatBadge } from "../../utils/friendsBarModel";

// Gerçek bildirim rozeti rengi: temadan bağımsız, her zemin üstünde okunur.
const BADGE_COLOR = "#FF3B30";

// Sekme renkleri — profil ekranının eski şeridindeki tonlar korunur.
const COLOR_FRIENDS = "#64b4ff";
const COLOR_MESSAGES = "#6C63FF";
const COLOR_REQUESTS = "#29b864";

// Bilgi satırı metinleri. Çoğul eki dile göre değişen İngilizce için tek/çok ayrı.
const CAPTIONS = {
  searchHint: ["autoI18n.friendsbar_search_hint", "Kişi bul"],
  friendsNone: ["autoI18n.friendsbar_friends_none", "Henüz yok"],
  friendsOne: ["autoI18n.friendsbar_friends_one", "{{n}} kişi"],
  friendsMany: ["autoI18n.friendsbar_friends_many", "{{n}} kişi"],
  messagesIdle: ["autoI18n.friendsbar_messages_idle", "Sohbetler"],
  requestsSent: ["autoI18n.friendsbar_requests_sent", "{{n}} gönderildi"],
  requestsIdle: ["autoI18n.friendsbar_requests_idle", "Bekleyen yok"],
};

function captionText(caption) {
  const entry = CAPTIONS[caption?.key];
  if (!entry) return "";
  return i18nText(entry[0], entry[1], { n: caption.count });
}

const Tile = memo(function Tile({
  theme,
  color,
  iconName,
  label,
  badge,
  caption,
  onPress,
}) {
  const badgeText = formatBadge(badge);
  const accessibilityLabel = [label, badgeText, caption].filter(Boolean).join(", ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: theme.secondary,
          borderColor: alpha(theme.border, 0.7),
        },
        pressed && styles.tilePressed,
      ]}
    >
      <View style={styles.iconSlot}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: alpha(color, 0.14),
              borderColor: alpha(color, 0.28),
            },
          ]}
        >
          <AppIcon family="Ionicons" name={iconName} size={21} color={color} />
        </View>
        {badgeText ? (
          <View
            pointerEvents="none"
            style={[
              styles.badge,
              { backgroundColor: BADGE_COLOR, borderColor: theme.secondary },
            ]}
          >
            <Text allowFontScaling={false} style={styles.badgeText}>
              {badgeText}
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[styles.label, { color: theme.text.primary }]}
      >
        {label}
      </Text>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[styles.caption, { color: theme.text.muted }]}
      >
        {caption}
      </Text>
    </Pressable>
  );
});

function FriendsActionBar({
  theme,
  friendCount,
  unreadMessages,
  incomingRequests,
  outgoingRequests,
  onSearch,
  onFriends,
  onMessages,
  onRequests,
}) {
  const model = buildFriendsBarModel({
    friendCount,
    unreadMessages,
    incomingRequests,
    outgoingRequests,
  });

  return (
    <View style={styles.row}>
      <Tile
        theme={theme}
        color={theme.accent}
        iconName="search"
        label={i18nText("autoI18n.ara_2", "Ara")}
        badge={model.search.badge}
        caption={captionText(model.search.caption)}
        onPress={onSearch}
      />
      <Tile
        theme={theme}
        color={COLOR_FRIENDS}
        iconName="people"
        label={i18nText("autoI18n.arkadaslar", "Arkadaşlar")}
        badge={model.friends.badge}
        caption={captionText(model.friends.caption)}
        onPress={onFriends}
      />
      <Tile
        theme={theme}
        color={COLOR_MESSAGES}
        iconName="chatbubble-ellipses"
        label={i18nText("autoI18n.mesajlar", "Mesajlar")}
        badge={model.messages.badge}
        caption={captionText(model.messages.caption)}
        onPress={onMessages}
      />
      <Tile
        theme={theme}
        color={COLOR_REQUESTS}
        iconName="mail"
        label={i18nText("autoI18n.istekler", "İstekler")}
        badge={model.requests.badge}
        caption={captionText(model.requests.caption)}
        onPress={onRequests}
      />
    </View>
  );
}

export default memo(FriendsActionBar);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  tilePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  // Rozet ikon karosunun köşesine taşar; bu sarmalayıcı kırpmaz.
  iconSlot: {
    width: 44,
    height: 44,
    marginBottom: 8,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "800",
    lineHeight: 13,
    letterSpacing: 0.2,
  },
  label: {
    alignSelf: "stretch",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  caption: {
    alignSelf: "stretch",
    textAlign: "center",
    marginTop: 2,
    fontSize: 10,
    fontWeight: "500",
  },
});
