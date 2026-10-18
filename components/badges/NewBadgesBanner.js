// components/badges/NewBadgesBanner.js
//
// "N yeni rozet eklendi" duyurusu. Katalog genişlediğinde rozet ekranının
// tepesinde bir kez durur; kullanıcı kapatınca (ya da "yenileri göster"e basınca)
// o katalog sürümü için bir daha çıkmaz (services/storage → watchCatalogSeen).
//
// NEDEN VAR: katalog genişleme koruması (watchBadgeCatalog.js 0. kural) mevcut
// kullanıcıya hak ettiği yeni rozetleri SESSİZCE verir — konfeti yağmuru olmasın
// diye. Bedeli, kullanıcının "kataloğa 60 rozet eklendi" haberini hiç almaması ve
// ekranın değiştiğini fark etmemesidir. Bu kart o haberi tek yerden, sakin bir
// dille verir ve iki şeyi söyler: (1) önünde yeni hedefler var, (2) bir kısmına
// zaten sahip (hak edilmiş ödül). Kutlama değil duyuru: toast yok, titreşim yok.
//
// Animasyon YOK (Reanimated ilk-değer tuzağı; bkz. reanimated-initial-value-vanish):
// kart FlatList'in ListHeaderComponent'inde duruyor.

import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import { withAlpha } from "@components/profile/StatsComponents";

function NewBadgesBanner({ toplam, acik, onGoster, onKapat, style }) {
  const { theme } = useTheme();
  if (!(toplam > 0)) return null;

  const baslik = i18nText("autoI18n.rozet_yeni_duyuru_baslik", `${toplam} yeni rozet eklendi`, { n: toplam });
  const alt =
    acik > 0
      ? i18nText(
          "autoI18n.rozet_yeni_duyuru_alt_sahip",
          `${acik} tanesine şimdiden sahipsin — gerisi seni bekliyor`,
          { acik },
        )
      : i18nText(
          "autoI18n.rozet_yeni_duyuru_alt_bos",
          "Yeni hedefler, türler, seriler ve gizli sürprizler seni bekliyor",
        );

  return (
    <View
      style={[styles.kart, { backgroundColor: theme.secondary, borderColor: withAlpha(theme.accent, 0.45) }, style]}
      accessible
      accessibilityLabel={`${baslik}. ${alt}`}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(theme.accent, 0.2), withAlpha(theme.accent, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.ust}>
        <View style={[styles.ikon, { backgroundColor: withAlpha(theme.accent, 0.18) }]}>
          <AppIcon family="Ionicons" name="sparkles" size={22} color={theme.accent} />
        </View>
        <View style={styles.metin}>
          <Text allowFontScaling={false} style={[styles.baslik, { color: theme.text.primary }]}>
            {baslik}
          </Text>
          <Text allowFontScaling={false} style={[styles.alt, { color: theme.text.muted }]}>
            {alt}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          hitSlop={10}
          onPress={onKapat}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.rozet_yeni_duyuru_kapat", "Duyuruyu kapat")}
          style={styles.kapat}
        >
          <AppIcon family="Ionicons" name="close" size={18} color={theme.text.muted} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onGoster}
        accessibilityRole="button"
        style={[styles.dugme, { backgroundColor: theme.accent }]}
      >
        <Text allowFontScaling={false} style={styles.dugmeYazi}>
          {i18nText("autoI18n.rozet_yeni_duyuru_goster", "Yenileri göster")}
        </Text>
        <AppIcon family="Ionicons" name="arrow-forward" size={15} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  kart: { borderRadius: 22, borderWidth: 1, padding: 14, overflow: "hidden" },
  ust: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  ikon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  metin: { flex: 1, minWidth: 0 },
  baslik: { fontSize: 15.5, fontWeight: "900", letterSpacing: -0.2 },
  alt: { marginTop: 3, fontSize: 12.5, lineHeight: 17, fontWeight: "700" },
  kapat: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  // Vurgu rengi üstünde yazı BEYAZ (Tema Stüdyosu kuralı): vurgu açık temalarda
  // bile okunur kalacak biçimde seçiliyor, koyu yazı sarı bantta kayboluyordu.
  dugme: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  dugmeYazi: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
});

export default memo(NewBadgesBanner);
