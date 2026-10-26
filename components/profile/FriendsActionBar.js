// components/profile/FriendsActionBar.js
//
// Profil ekranındaki arkadaş aksiyon şeridi: Ara / Arkadaşlar / Mesajlar / İstekler.
//
// Tasarım: TEK hafif kapsayıcı, dört eşit sütun, aralarında ince ayraç. Her
// sütunda küçük renkli ikon karosu ve altında tek satır etiket var (~75 px;
// önceki dört ayrı kartlı sürüm ~105 px'ti). Basılı sütun kendi renginde
// hafifçe aydınlanır.
//
// Sayılar (model: utils/friendsBarModel.js):
//   • Gerçek rozet — ikon karosunun köşesinde, kırmızı, kapsayıcı rengiyle
//     halkalı: YALNIZ eylem bekleyen sayılar (okunmamış mesaj, gelen istek).
//   • Arkadaş sayısı — "Arkadaşlar" karosunda İKONUN YERİNDE düz rakam (karonun
//     kendi rengiyle). Arkadaş yoksa rakam yerine ikon durur. Rozet gibi durmaz.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { useLanguage } from "../../context/LanguageContext";
import {
  buildFriendsBarModel,
  formatBadge,
  formatFriendCount,
} from "../../utils/friendsBarModel";
import GlassPressable from "../common/GlassPressable";

// Gerçek bildirim rozeti rengi: temadan bağımsız, her zemin üstünde okunur.
const BADGE_COLOR = "#FF3B30";

// Sekme renkleri — profil ekranının eski şeridindeki tonlar korunur.
const COLOR_FRIENDS = "#64b4ff";
const COLOR_MESSAGES = "#6C63FF";
const COLOR_REQUESTS = "#29b864";

// Rakam karoya (32 px) sığsın: hane sayısına göre punto.
const countFontSize = (text) => (text.length <= 2 ? 15 : text.length === 3 ? 12.5 : 10.5);

const Item = memo(function Item({
  theme,
  color,
  iconName,
  label,
  count,
  badge,
  onPress,
}) {
  const badgeText = formatBadge(badge);
  // count verilmiş ve sıfırdan büyükse ikonun yerine rakam çizilir.
  const countText = count > 0 ? formatFriendCount(count) : "";
  const accessibilityLabel = [label, countText, badgeText].filter(Boolean).join(", ");

  return (
    <GlassPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.item,
        pressed && { backgroundColor: alpha(color, 0.12) },
      ]}
    >
      <View style={styles.iconSlot}>
        <View style={[styles.iconWrap, { backgroundColor: alpha(color, 0.15) }]}>
          {countText ? (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.countText, { color, fontSize: countFontSize(countText) }]}
            >
              {countText}
            </Text>
          ) : (
            <AppIcon family="Ionicons" name={iconName} size={18} color={color} />
          )}
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
    </GlassPressable>
  );
});

function Divider({ theme }) {
  return <View style={[styles.divider, { backgroundColor: alpha(theme.border, 0.8) }]} />;
}

function FriendsActionBar({
  theme,
  friendCount,
  unreadMessages,
  incomingRequests,
  onSearch,
  onFriends,
  onMessages,
  onRequests,
}) {
  // Etiketler i18nText'ten (global i18n): memo'lu çubuk dil değişince
  // yeniden çizilsin diye dile abone (T3 B8).
  useLanguage();
  const model = buildFriendsBarModel({ friendCount, unreadMessages, incomingRequests });

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.secondary, borderColor: alpha(theme.border, 0.7) },
      ]}
    >
      <Item
        theme={theme}
        color={theme.accent}
        iconName="search"
        label={i18nText("autoI18n.ara_2", "Ara")}
        badge={model.search.badge}
        onPress={onSearch}
      />
      <Divider theme={theme} />
      <Item
        theme={theme}
        color={COLOR_FRIENDS}
        iconName="people"
        label={i18nText("autoI18n.arkadaslar", "Arkadaşlar")}
        count={model.friends.count}
        badge={model.friends.badge}
        onPress={onFriends}
      />
      <Divider theme={theme} />
      <Item
        theme={theme}
        color={COLOR_MESSAGES}
        iconName="chatbubble-ellipses"
        label={i18nText("autoI18n.mesajlar", "Mesajlar")}
        badge={model.messages.badge}
        onPress={onMessages}
      />
      <Divider theme={theme} />
      <Item
        theme={theme}
        color={COLOR_REQUESTS}
        iconName="mail"
        label={i18nText("autoI18n.istekler", "İstekler")}
        badge={model.requests.badge}
        onPress={onRequests}
      />
    </View>
  );
}

export default memo(FriendsActionBar);

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  item: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingTop: 7,
    paddingBottom: 6,
    paddingHorizontal: 2,
    borderRadius: 15,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 30,
  },
  // Rozet ikon karosunun köşesine taşar; bu sarmalayıcı kırpmaz.
  iconSlot: {
    width: 32,
    height: 32,
    marginBottom: 5,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -9,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 12,
  },
  label: {
    alignSelf: "stretch",
    textAlign: "center",
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  // Arkadaş sayısı: ikon karosunun içinde, ikonun yerinde.
  countText: {
    fontWeight: "800",
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
});
