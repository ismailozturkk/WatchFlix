// components/profile/FriendsActionBar.js
//
// Profil ekranındaki arkadaş aksiyon şeridi: Ara / Arkadaşlar / Mesajlar / İstekler.
//
// Tasarım (7 Kas): film/dizi detayındaki liste düğmeleriyle
// (components/detail/DetailListActionTile.js) AYNI dil — tek yatay satırda dört
// ayrı kompakt hücre (~64 dp). Her hücrenin KENDİ rengi var: zemin ve çerçeve o
// renge hafifçe boyanır, üstte aynı renkte ikon kutusu, altta tek satır etiket.
// Basılı hücre kendi renginde koyulaşır.
//
// Sayılar (model: utils/friendsBarModel.js):
//   • Gerçek rozet — hücrenin sağ üst köşesinde, kırmızı: YALNIZ eylem bekleyen
//     sayılar. "Mesajlar" tekil + grup okunmamış TOPLAMINI tek rozette gösterir;
//     "İstekler" gelen istekleri.
//   • Hücrelerde her zaman ikon durur; arkadaş sayısı şeritte gösterilmez.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import { alpha } from "../../theme/colors";
import { isLightSurface } from "../../utils/colorUtils";
import { i18nText } from "../../utils/i18nText";
import { useLanguage } from "../../context/LanguageContext";
import { buildFriendsBarModel, formatBadge } from "../../utils/friendsBarModel";
import GlassPressable from "../common/GlassPressable";

// Gerçek bildirim rozeti rengi: temadan bağımsız, her zemin üstünde okunur.
const BADGE_COLOR = "#FF3B30";

// Her hücrenin kendine has rengi (temadan bağımsız, dördü birbirinden ayrışır).
// Arkadaşlar / Mesajlar / İstekler eski şeridin tonlarını korur.
const COLOR_SEARCH = "#FF9F0A";
const COLOR_FRIENDS = "#64b4ff";
const COLOR_MESSAGES = "#6C63FF";
const COLOR_REQUESTS = "#29b864";

const Item = memo(function Item({ theme, light, color, iconName, label, badge, onPress }) {
  const badgeText = formatBadge(badge);
  const accessibilityLabel = [label, badgeText].filter(Boolean).join(", ");

  return (
    <GlassPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.item,
        {
          backgroundColor: alpha(
            color,
            pressed ? (light ? 0.2 : 0.24) : light ? 0.1 : 0.12,
          ),
          borderColor: alpha(color, light ? 0.34 : 0.4),
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: alpha(color, light ? 0.18 : 0.22) }]}>
        <AppIcon family="Ionicons" name={iconName} size={18} color={color} />
      </View>

      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.78}
        style={[styles.label, { color: theme.text.primary }]}
      >
        {label}
      </Text>

      {badgeText ? (
        <View pointerEvents="none" style={[styles.badge, { backgroundColor: BADGE_COLOR }]}>
          <Text allowFontScaling={false} style={styles.badgeText}>
            {badgeText}
          </Text>
        </View>
      ) : null}
    </GlassPressable>
  );
});

function FriendsActionBar({
  theme,
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
  const model = buildFriendsBarModel({ unreadMessages, incomingRequests });
  const light = isLightSurface(theme.primary || "#000000");

  return (
    <View style={styles.bar}>
      <Item
        theme={theme}
        light={light}
        color={COLOR_SEARCH}
        iconName="search"
        label={i18nText("autoI18n.ara_2", "Ara")}
        badge={model.search.badge}
        onPress={onSearch}
      />
      <Item
        theme={theme}
        light={light}
        color={COLOR_FRIENDS}
        iconName="people"
        label={i18nText("autoI18n.arkadaslar", "Arkadaşlar")}
        badge={model.friends.badge}
        onPress={onFriends}
      />
      <Item
        theme={theme}
        light={light}
        color={COLOR_MESSAGES}
        iconName="chatbubble-ellipses"
        label={i18nText("autoI18n.mesajlar", "Mesajlar")}
        badge={model.messages.badge}
        onPress={onMessages}
      />
      <Item
        theme={theme}
        light={light}
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
    alignItems: "stretch",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  // Ölçüler DetailListActionTile ile aynı (tek satır, dört hücre).
  item: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    paddingTop: 9,
    paddingBottom: 8,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 16,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  // Rozet hücrenin İÇİNDE, sağ üst köşede: cam hücre kırpsa da kesilmez.
  badge: {
    position: "absolute",
    top: 5,
    right: 5,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "800",
    lineHeight: 11,
  },
  label: {
    alignSelf: "stretch",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: -0.15,
  },
});
