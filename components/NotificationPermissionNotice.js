// components/NotificationPermissionNotice.js
//
// OS bildirim izni verilmediğinde ayar ekranlarında görünen EYLEMLİ uyarı.
// İzin verilmişse hiçbir şey çizmez.
//
// Neden gerekli: uygulama içindeki "Tüm bildirimler" anahtarı varsayılan olarak
// AÇIK. Kullanıcı ayarlarda her şeyi açık görüp bildirim beklerken OS izni
// kapalıysa hiçbir hatırlatma zamanlanmaz — arada sessiz bir uçurum oluşur.
// Bu satır o farkı görünür kılar ve tek dokunuşla çözer:
//   • OS hâlâ soruyorsa  → sistem izin diyaloğunu açar,
//   • kalıcı reddedildiyse → uygulamanın OS ayar sayfasına götürür.

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import AppIcon from "@components/AppIcon";
import { useDeviceNotifications } from "@context/DeviceNotificationsContext";
import { i18nText } from "@utils/i18nText";

export default function NotificationPermissionNotice({ colors: C }) {
  const { permissionStatus, canAskPermission, requestPermission } =
    useDeviceNotifications();

  if (permissionStatus === "granted") return null;

  const onPress = async () => {
    if (canAskPermission) {
      const granted = await requestPermission();
      if (granted) return;
    }
    Linking.openSettings().catch(() => {});
  };

  return (
    <View
      style={[
        ps.row,
        { backgroundColor: C.card, borderColor: C.danger },
      ]}
    >
      <View style={[ps.iconWrap, { backgroundColor: C.dangerDim }]}>
        <AppIcon name="notifications-off-outline" size={16} color={C.danger} />
      </View>
      <View style={ps.texts}>
        <Text allowFontScaling={false} style={[ps.title, { color: C.text }]}>
          {i18nText("autoI18n.bildirimIzniBaslik", "Bildirim izni kapalı")}
        </Text>
        <Text allowFontScaling={false} style={[ps.sub, { color: C.muted }]}>
          {i18nText(
            "autoI18n.bildirimIzniAlt",
            "Hatırlatmaların telefona düşebilmesi için bu uygulamaya bildirim izni vermen gerekiyor.",
          )}
        </Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onPress}
        activeOpacity={0.7}
        style={ps.action}
        hitSlop={6}
      >
        <Text allowFontScaling={false} style={[ps.actionText, { color: C.danger }]}>
          {canAskPermission
            ? i18nText("autoI18n.bildirimIzniVer", "İzin ver")
            : i18nText("autoI18n.bildirimIzniAyarlar", "Ayarları aç")}
        </Text>
        <AppIcon name="chevron-forward" size={12} color={C.danger} />
      </TouchableOpacity>
    </View>
  );
}

const ps = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  texts: {
    flex: 1,
    paddingRight: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
  },
  sub: {
    fontSize: 10.5,
    marginTop: 2,
    lineHeight: 14,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    flexShrink: 0,
  },
  actionText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
