// components/badges/BadgeControls.js
//
// Rozet ekranının arama çubuğu ve süzgeçleri: durum (Tümü / Açık / Kilitli,
// duyuru varken + Yeni) ve bölüm (Başlangıç, Kilometre taşları, Ritim…).
// Üçü birlikte çalışır — "Türler" bölümünde arama yaparken yalnızca kilitliler gibi.
//
// BÖLÜM ÇİPİ KAYDIRMAZ, SÜZER. 140+ rozetlik, başlıkları ve satırları farklı
// yükseklikte bir FlatList'te bir bölüme atlamak getItemLayout ister; satır
// yükseklikleri sabit olmadığı için atlama kayardı. Süzmek hem sağlam hem de
// küçük ekranda bir bölümün tamamını tek bakışta gösterir.
//
// Çiplerdeki sayı KADEME düzeyinde (badgeInsights.bolumOzetleri): "Türler 4/9".

import React, { memo } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import { getBadgeShowcaseCopy } from "@utils/badgeShowcaseCopy";
import { withAlpha } from "@components/profile/StatsComponents";
import GlassTouchable from "../common/GlassTouchable";
import GlassBox from "../common/GlassBox";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

export const DURUM_FILTRELERI = [
  { id: "tumu", key: "autoI18n.rozet_filtre_tumu", fallback: "Tümü" },
  { id: "acik", key: "autoI18n.rozet_filtre_acik", fallback: "Açık" },
  { id: "kilitli", key: "autoI18n.rozet_filtre_kilitli", fallback: "Kilitli" },
];

// Dördüncü segment YALNIZ yeni-rozet duyurusu görünürken eklenir: duyuru kartındaki
// "yenileri göster" bağının düşeceği süzgeç. Duyuru kapanınca segment de kalkar
// (kalıcı bir "Yeni" sekmesi, ilk haftadan sonra hep boş/anlamsız kalırdı).
export const YENI_FILTRE = { id: "yeni", key: "autoI18n.rozet_filtre_yeni", fallback: "Yeni" };

function BadgeControls({
  filtre,
  onFiltre,
  bolum,
  onBolum,
  ozetler,
  bolumAd,
  yeniVar = false,
  arama = "",
  onArama,
  sonucSayisi = null,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getBadgeShowcaseCopy(language);
  const filtreler = yeniVar ? [...DURUM_FILTRELERI, YENI_FILTRE] : DURUM_FILTRELERI;
  const aramaAktif = Boolean(String(arama || "").trim());

  return (
    <View style={styles.kap}>
      {typeof onArama === "function" ? (
        <GlassBox
          role="field"
          style={[
            styles.aramaKap,
            {
              backgroundColor: theme.secondary,
              borderColor: aramaAktif ? withAlpha(theme.accent, 0.65) : theme.border,
            },
          ]}
        >
          <AppIcon
            family="Ionicons"
            name="search-outline"
            size={17}
            color={aramaAktif ? theme.accent : theme.text.muted}
          />
          <TextInput
            value={arama}
            onChangeText={onArama}
            placeholder={copy.searchPlaceholder}
            placeholderTextColor={theme.text.muted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            allowFontScaling={false}
            style={[styles.aramaGirdi, { color: theme.text.primary }]}
          />
          {aramaAktif && typeof sonucSayisi === "number" ? (
            <View
              style={[
                styles.aramaSayac,
                { backgroundColor: withAlpha(theme.accent, 0.14) },
              ]}
            >
              <Text allowFontScaling={false} style={[styles.aramaSayacYazi, { color: theme.accent }]}>
                {sonucSayisi}
              </Text>
            </View>
          ) : null}
          {aramaAktif ? (
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={copy.searchClear}
              onPress={() => onArama("")}
              style={styles.aramaTemizle}
            >
              <AppIcon
                family="Ionicons"
                name="close-circle"
                size={18}
                color={theme.text.muted}
              />
            </TouchableOpacity>
          ) : null}
        </GlassBox>
      ) : null}

      <View style={[styles.segment, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        {filtreler.map((f) => {
          const secili = filtre === f.id;
          return (
            <GlassTouchable
              key={f.id}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: secili }}
              onPress={() => onFiltre(f.id)}
              style={[styles.segmentOge, secili && { backgroundColor: withAlpha(theme.accent, 0.18) }]}
            >
              {/* Tek satır + küçülme: dört segmentte ("Desbloqueadas" gibi uzun İspanyolca
                  etiket) metin komşusuna taşıyordu. Kompakt kipte punto da bir kademe düşer. */}
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[
                  styles.segmentYazi,
                  filtreler.length > 3 && styles.segmentYaziKompakt,
                  { color: secili ? theme.accent : theme.text.muted },
                ]}
              >
                {i18nText(f.key, f.fallback)}
              </Text>
            </GlassTouchable>
          );
        })}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.cipKaydirma}
        contentContainerStyle={styles.cipSatir}
      >
        {[{ bolum: null }, ...(ozetler || [])].map((o) => {
          const secili = (bolum || null) === o.bolum;
          const ad = o.bolum === null ? i18nText("autoI18n.rozet_filtre_tumu", "Tümü") : bolumAd(o.bolum);
          return (
            <GlassTouchable
              key={o.bolum || "tumu"}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: secili }}
              onPress={() => onBolum(o.bolum)}
              style={[
                styles.cip,
                {
                  backgroundColor: secili ? withAlpha(theme.accent, 0.16) : theme.secondary,
                  borderColor: secili ? theme.accent : theme.border,
                },
              ]}
            >
              <Text allowFontScaling={false} style={[styles.cipAd, { color: secili ? theme.accent : theme.text.primary }]}>
                {ad}
              </Text>
              {o.bolum !== null ? (
                <Text allowFontScaling={false} style={[styles.cipSayi, { color: secili ? theme.accent : theme.text.muted }]}>
                  {o.acik}/{o.toplam}
                </Text>
              ) : null}
            </GlassTouchable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kap: { marginTop: 22, gap: 12 },
  aramaKap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    height: 44,
    paddingHorizontal: 13,
    borderRadius: 15,
    borderWidth: 1,
    gap: 9,
  },
  aramaGirdi: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "700",
    paddingVertical: 0,
  },
  aramaSayac: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  aramaSayacYazi: {
    fontSize: 11,
    fontWeight: "900",
  },
  aramaTemizle: {
    padding: 2,
  },
  segment: {
    flexDirection: "row",
    marginHorizontal: 14,
    padding: 3,
    borderRadius: 15,
    borderWidth: 1,
  },
  segmentOge: { flex: 1, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  segmentYazi: { fontSize: 13, fontWeight: "900" },
  segmentYaziKompakt: { fontSize: 11.5 },
  // Basılan cam çip satırın kırpma sınırında kesilmesin (utils/liquidGlass GLASS_PRESS_ROOM).
  cipKaydirma: { marginVertical: -GLASS_PRESS_ROOM },
  cipSatir: { paddingHorizontal: 14, paddingVertical: GLASS_PRESS_ROOM, gap: 8 },
  cip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    borderWidth: 1,
  },
  cipAd: { fontSize: 12.5, fontWeight: "850" },
  cipSayi: { fontSize: 11, fontWeight: "800" },
});

export default memo(BadgeControls);
