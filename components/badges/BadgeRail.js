// components/badges/BadgeRail.js
//
// Rozet ekranındaki YATAY RAFLAR: "Sıradaki hedefler" ve "Son kazanılanlar".
//
// NEDEN RAF: ızgara 80 rozeti bölüm bölüm gösterir, envanter dilidir. Kullanıcının
// iki acil sorusu ise ızgaranın dibinde kalıyordu: "şimdi neyin peşinde
// koşmalıyım?" ve "en son ne kazandım?". Raflar bu iki soruyu ekranın tepesine
// çıkarır; ızgara arşiv olarak altta kalır.
//
// Raf içeriği KÜÇÜK (en çok 6-8 öğe) olduğu için FlatList değil ScrollView:
// sanallaştırma 8 kart için yük bindirir, kazandırmaz.

import React, { memo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppBadge from "@components/badges/AppBadge";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { kademeRengi, kademeSekli, rarityStyle } from "@theme/badgeTokens";
import { i18nText } from "@utils/i18nText";
import { withAlpha } from "@components/profile/StatsComponents";
import { badgeAd, formatBadgeAralik, formatBadgeDeger } from "./watchBadgeCatalog";
import { hedefUyesi, kalanMiktar, kacGunOnce } from "./badgeInsights";
import { formatTarih, yuzdeMetni } from "./badgeFormat";

export function BadgeRail({ baslik, altBaslik, children }) {
  const { theme } = useTheme();
  return (
    <View style={styles.raf}>
      <View style={styles.rafBaslikSatir}>
        <Text allowFontScaling={false} style={[styles.rafBaslik, { color: theme.text.primary }]}>
          {baslik}
        </Text>
        {altBaslik ? (
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.rafAlt, { color: theme.text.muted }]}>
            {altBaslik}
          </Text>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rafIcerik}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * Hedef kartı. Rozet HEDEFİN şeklinde/renginde çizilir (sıradaki kademe kareden
 * beşgene geçer): "neye doğru gidiyorum"u kullanıcının mevcut kademesi değil,
 * kazanacağı rozet gösterir. Halka ilerlemeyi çizer.
 */
export const HedefKarti = memo(function HedefKarti({ kart, onPress }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const lang = language === "en" ? "en" : "tr";
  const uye = hedefUyesi(kart);
  if (!uye) return null;

  const sekil = kademeSekli(uye.tier, kart.aileToplam || kart.aileUyeleri?.length || 0);
  const kadRenk = kademeRengi(sekil.kademe, theme);
  const vurgu = kadRenk || rarityStyle(uye.rarity, theme).color;
  const oran = Number(uye.oran) || 0;
  const kalan = kalanMiktar(uye);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${badgeAd(uye, lang)}, ${formatBadgeAralik(uye, uye.ilerleme, uye.target, lang)}`}
      style={[styles.hedef, { backgroundColor: theme.secondary, borderColor: withAlpha(vurgu, 0.4) }]}
    >
      <View style={styles.hedefUst}>
        <AppBadge
          glyph={uye.icon}
          glyphSolid={uye.iconSolid}
          rarity={uye.rarity}
          unlocked={false}
          progress={oran}
          size={52}
          sides={sekil.kenar}
          color={kadRenk}
        />
        <Text allowFontScaling={false} style={[styles.hedefYuzde, { color: theme.accent }]}>
          {yuzdeMetni(oran, lang)}
        </Text>
      </View>
      <Text allowFontScaling={false} numberOfLines={2} style={[styles.hedefAd, { color: theme.text.primary }]}>
        {badgeAd(uye, lang)}
      </Text>
      <View style={[styles.iz, { backgroundColor: withAlpha(theme.text.muted, 0.2) }]}>
        <View style={[styles.dolgu, { backgroundColor: theme.accent, width: `${Math.max(3, Math.round(oran * 100))}%` }]} />
      </View>
      <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.hedefKalan, { color: theme.text.muted }]}>
        {i18nText("autoI18n.rozet_kalan", `${formatBadgeDeger(uye, kalan, lang)} kaldı`, {
          deger: formatBadgeDeger(uye, kalan, lang),
        })}
      </Text>
    </TouchableOpacity>
  );
});

/** Son kazanılan kartı: açık rozet + göreli tarih ("Bugün", "3 gün önce"). */
export const SonKarti = memo(function SonKarti({ kart, onPress, simdi }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const lang = language === "en" ? "en" : "tr";

  const sekil = kademeSekli(kart.tier, kart.aileToplam);
  const kadRenk = kademeRengi(sekil.kademe, theme);
  const vurgu = kadRenk || rarityStyle(kart.rarity, theme).color;
  const once = kacGunOnce(kart.kazanmaTarihi, simdi);

  let zaman = formatTarih(kart.kazanmaTarihi, lang) || "";
  if (once === 0) zaman = i18nText("autoI18n.rozet_bugun", "Bugün");
  else if (once === 1) zaman = i18nText("autoI18n.rozet_dun", "Dün");
  else if (once !== null && once < 7) zaman = i18nText("autoI18n.rozet_gun_once", `${once} gün önce`, { n: once });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${badgeAd(kart, lang)}, ${zaman}`}
      style={[styles.son, { backgroundColor: theme.secondary, borderColor: withAlpha(vurgu, 0.5) }]}
    >
      <AppBadge
        glyph={kart.icon}
        glyphSolid={kart.iconSolid}
        rarity={kart.rarity}
        unlocked
        size={54}
        sides={sekil.kenar}
        color={kadRenk}
        ornate={sekil.ornate}
      />
      <Text allowFontScaling={false} numberOfLines={2} style={[styles.sonAd, { color: theme.text.primary }]}>
        {badgeAd(kart, lang)}
      </Text>
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.sonZaman, { color: vurgu }]}>
        {zaman}
      </Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  raf: { marginTop: 22 },
  rafBaslikSatir: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  rafBaslik: { fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },
  rafAlt: { flexShrink: 1, fontSize: 11.5, fontWeight: "700" },
  rafIcerik: { paddingHorizontal: 14, gap: 10 },

  hedef: { width: 148, borderRadius: 20, borderWidth: 1, padding: 12 },
  hedefUst: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hedefYuzde: { fontSize: 18, fontWeight: "900", letterSpacing: -0.4 },
  hedefAd: { marginTop: 9, minHeight: 31, fontSize: 12.5, lineHeight: 15.5, fontWeight: "800" },
  iz: { height: 5, borderRadius: 3, overflow: "hidden", marginTop: 8 },
  dolgu: { height: "100%", borderRadius: 3 },
  hedefKalan: { marginTop: 6, fontSize: 11, fontWeight: "700" },

  son: { width: 112, borderRadius: 20, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center" },
  sonAd: { marginTop: 9, minHeight: 30, fontSize: 12, lineHeight: 15, fontWeight: "800", textAlign: "center" },
  sonZaman: { marginTop: 4, fontSize: 10.5, fontWeight: "800" },
});
