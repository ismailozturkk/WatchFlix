// components/detail/DetailLoadError.js
//
// Film/dizi detayı yüklenemediğinde (çoğunlukla çevrimdışı) gösterilen durum.
// Eskiden istek düşünce ekranda kalıcı "Yükleniyor…" yazıyordu: hata metni,
// tekrar dene ve geri düğmesi yoktu; iOS'ta yalnız kaydırarak çıkılabiliyordu
// (T3 B10). İki detay ekranı aynı durumu paylaşsın diye tek bileşen.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlassIconButton from "../common/GlassIconButton";
import GlassPillButton from "../common/GlassPillButton";
import { i18nText } from "../../utils/i18nText";

export default function DetailLoadError({ theme, onRetry, onBack }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <GlassIconButton
        size={38}
        icon="chevron-back"
        accessibilityLabel={i18nText("autoI18n.geri", "Geri")}
        onPress={onBack}
        style={[styles.back, { top: insets.top + 8 }]}
      />
      <Ionicons name="cloud-offline-outline" size={44} color={theme.text.muted} />
      <Text style={[styles.title, { color: theme.text.primary }]}>
        {i18nText("autoI18n.detay_yuklenemedi", "Bu sayfa yüklenemedi")}
      </Text>
      <Text style={[styles.subtitle, { color: theme.text.muted }]}>
        {i18nText("autoI18n.detay_baglanti_kontrol", "Bağlantını kontrol edip yeniden dene.")}
      </Text>
      <GlassPillButton
        icon="refresh"
        label={i18nText("autoI18n.tekrar_dene", "Tekrar Dene")}
        onPress={onRetry}
        tint={theme.accent}
        fallbackStyle={{ backgroundColor: theme.accent }}
        style={styles.retry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  back: { position: "absolute", left: 16 },
  title: { fontSize: 18, fontWeight: "700", textAlign: "center", marginTop: 8 },
  subtitle: { fontSize: 14, textAlign: "center" },
  retry: { marginTop: 16 },
});
