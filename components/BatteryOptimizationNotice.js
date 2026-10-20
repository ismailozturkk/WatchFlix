// components/BatteryOptimizationNotice.js
//
// SADECE ANDROID. Yerel hatırlatma bildirimleri (film/dizi/not) OS'un alarm
// sistemiyle uygulama kapalıyken de çalışır — AMA bazı üreticilerin (Xiaomi,
// Huawei, Samsung, Oppo…) agresif pil optimizasyonu, "force stop" sonrası bu
// alarmları iptal edebilir. Bu satır kullanıcıyı pil optimizasyonu ekranına
// yönlendirir ki uygulamayı "optimize etme" olarak işaretleyebilsin.
//
// Yeni bağımlılık yok: React Native'in Linking.sendIntent'i ile standart Android
// ayar action'ı açılır (izin gerektirmez). OEM'de yoksa uygulama ayarlarına düşer.

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
} from "react-native";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";

const BATTERY_INTENT = "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS";

async function openBatterySettings() {
  try {
    await Linking.sendIntent(BATTERY_INTENT);
  } catch {
    // Bazı OEM ROM'larında bu action yok → uygulama detay ayarlarına düş.
    Linking.openSettings().catch(() => {});
  }
}

export default function BatteryOptimizationNotice({ colors: C }) {
  if (Platform.OS !== "android") return null;

  return (
    <View style={[bs.row, { borderTopColor: C.borderMuted }]}>
      <View style={[bs.iconWrap, { backgroundColor: C.iconAmber }]}>
        <AppIcon
          family="MaterialCommunityIcons"
          name="battery-alert"
          size={16}
          color={C.amber}
        />
      </View>
      <View style={bs.texts}>
        <Text allowFontScaling={false} style={[bs.title, { color: C.text }]}>
          {i18nText("autoI18n.pilArkaPlanBaslik", "Arka plan hatırlatmaları")}
        </Text>
        <Text allowFontScaling={false} style={[bs.sub, { color: C.muted }]}>
          {i18nText(
            "autoI18n.pilArkaPlanAlt",
            "Bazı telefonlar pil tasarrufu için hatırlatmaları engelleyebilir. Bildirimlerin kapalıyken de gelmesi için pil optimizasyonunu kapat.",
          )}
        </Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={openBatterySettings}
        activeOpacity={0.7}
        style={bs.action}
        hitSlop={6}
      >
        <Text allowFontScaling={false} style={[bs.actionText, { color: C.amber }]}>
          {i18nText("autoI18n.pilAyariniAc", "Pil ayarı")}
        </Text>
        <AppIcon name="chevron-forward" size={12} color={C.amber} />
      </TouchableOpacity>
    </View>
  );
}

const bs = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
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
