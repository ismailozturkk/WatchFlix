// components/notifications/NotificationPrimingSheet.js
//
// Sistem bildirim izni diyaloğundan ÖNCE gösterilen tek seferlik açıklama.
//
// NEDEN: sistem diyaloğu iOS'ta bir kez açılır ve "İzin verme" o hakkı yakar.
// Kullanıcı neyin karşılığında izin verdiğini bilirse "evet" oranı artar,
// bilmezse kalıcı bir "hayır" alırız. Buradaki "Şimdi değil" ise bedava:
// hiçbir sistem hakkını harcamaz, Ayarlar'dan her zaman geri dönülebilir.
//
// KARAR BURADA DEĞİL: sayfanın açılıp açılmayacağını
// utils/notificationPriming.js belirler; bu dosya yalnız görünüm.
//
// TEK ÖRNEK: sayfa DeviceNotificationsProvider tarafından çiziliyor, çağrı
// yerleri yalnız "aç" diyor. İç içe modal olmaması için çağıran taraf kendi
// sayfasını ÖNCE kapatmalı (bkz. MediaQuickActionsSheet'teki closeThen).

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "../common/BottomSheetModal";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";

// Kullanıcının izinle ne kazandığı — soyut "bildirim al" yerine somut karşılık.
const BENEFITS = [
  {
    icon: "alarm-outline",
    key: "bildirim_on_fayda_hatirlatma",
    tr: "Takip ettiğin film ve bölümler yayınlanmadan haber ver",
  },
  {
    icon: "people-outline",
    key: "bildirim_on_fayda_arkadas",
    tr: "Arkadaş istekleri ve mesajlar anında ulaşsın",
  },
];

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onAllow    "İzin ver" — sistem diyaloğunu açacak.
 * @param {() => void} props.onDismiss  "Şimdi değil" + dışarı dokunuş/geri tuşu.
 */
export default function NotificationPrimingSheet({ visible, onAllow, onDismiss }) {
  const { theme } = useTheme();

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onDismiss}
      sheetStyle={[styles.sheet, { backgroundColor: theme.primary }]}
    >
      <View style={[styles.grabber, { backgroundColor: theme.border }]} />

      <View style={[styles.iconWrap, { backgroundColor: theme.secondary }]}>
        <Ionicons name="notifications-outline" size={24} color={theme.accent} />
      </View>

      <Text style={[styles.title, { color: theme.text.primary }]}>
        {i18nText("autoI18n.bildirim_on_baslik", "Bildirimlere izin verelim mi?")}
      </Text>
      <Text style={[styles.subtitle, { color: theme.text.muted }]}>
        {i18nText(
          "autoI18n.bildirim_on_aciklama",
          "Kurduğun hatırlatmaların telefonuna düşebilmesi için bildirim izni gerekiyor. İzin vermezsen hatırlatmalar sessizce hiç çalışmaz.",
        )}
      </Text>

      <View style={styles.benefits}>
        {BENEFITS.map((item) => (
          <View key={item.key} style={styles.benefitRow}>
            <Ionicons name={item.icon} size={17} color={theme.text.muted} />
            <Text style={[styles.benefitText, { color: theme.text.secondary }]}>
              {i18nText(`autoI18n.${item.key}`, item.tr)}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onAllow}
        style={({ pressed }) => [
          styles.primary,
          { backgroundColor: theme.accent },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.primaryText}>
          {i18nText("autoI18n.bildirim_on_izin_ver", "İzin ver")}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={onDismiss}
        style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
      >
        <Text style={[styles.ghostText, { color: theme.text.muted }]}>
          {i18nText("autoI18n.bildirim_on_simdi_degil", "Şimdi değil")}
        </Text>
      </Pressable>

      {/* Geri dönüş yolunu baştan söylüyoruz: "Şimdi değil" bir kapı kapatmıyor.
          Adres, NotificationPermissionNotice'ın durduğu ekran
          (screens/tabs/settings/ReminderNotificationsScreen.js). */}
      <Text style={[styles.footnote, { color: theme.text.muted }]}>
        {i18nText(
          "autoI18n.bildirim_on_dipnot",
          "Bunu daha sonra Ayarlar › Hatırlatıcılar'dan açabilirsin.",
        )}
      </Text>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  grabber: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: { fontSize: 19, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 13, lineHeight: 19 },
  benefits: { marginTop: 16, gap: 10 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitText: { flex: 1, fontSize: 13, lineHeight: 18 },
  primary: {
    marginTop: 22,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#FFFFFF", fontSize: 15.5, fontWeight: "700" },
  ghost: {
    marginTop: 6,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { fontSize: 14, fontWeight: "600" },
  footnote: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 2,
    opacity: 0.8,
  },
  pressed: { opacity: 0.7 },
});
