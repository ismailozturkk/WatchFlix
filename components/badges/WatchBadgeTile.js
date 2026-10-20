// components/badges/WatchBadgeTile.js
//
// Rozet ızgarasının karosu (üç sütun). Eski `compact` kart dört sütunda 40 px'lik
// rozet, 9,5 px başlık ve 7,5 px ilerleme yazısıyla çiziliyordu — rozet ekranının
// asıl işi (hangisi açık, sıradaki ne) okunmuyordu. Karo üç sütuna geçti: 58 px
// rozet, 12 px ad, 10,5 px durum satırı.
//
// KARO NE SÖYLER (yukarıdan aşağı):
//   1. Rozetin kendisi — şekil = aile kademesi, renk = kademe/nadirlik (AppBadge).
//   2. Kademe şeridi — ailenin her basamağı kendi renginde bir çubuk; ulaşılanlar
//      dolu. Şekil/renk "neredesin"i söylüyor, şerit "kaç basamak var, kaçı
//      geçildi"yi. Ailesiz rozette boş yer ayrılır ki bir satırdaki başlıklar hizalı kalsın.
//   3. Ad.
//   4. Durum — kilitliyse ilerleme ("60/150"), açık tekilse nadirlik adı, bitmiş
//      ailede "Tamamlandı".
//   5. İlerleme çubuğu — yalnız peşinde koşulan bir hedef varken.
// Köşelerde: sol üstte prestij (★n) ya da çerçeveli "YENİ" (kataloğa yeni eklendi),
// sağ üstte dolgulu "YENİ" (son 7 günde kazanıldı).
//
// GİZLİ ROZET: kilitliyken ne adı ne hedefi görünür ("???" + "Gizli"). İlerleme
// çubuğu da çizilmez — oran, rozetin ne ölçtüğünü ele verirdi.

import { copyLanguage } from "../../utils/appLanguages";
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppBadge from "@components/badges/AppBadge";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { kademeRengi, kademeSekli, rarityStyle, GOLD } from "@theme/badgeTokens";
import { i18nText } from "@utils/i18nText";
import { withAlpha } from "@components/profile/StatsComponents";
import { badgeAd, formatBadgeAralik } from "./watchBadgeCatalog";
import { nadirlikAdi } from "./badgeFormat";

export const TILE_YUKSEKLIK = 164;

function WatchBadgeTile({ badge, onPress }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const lang = copyLanguage(language, ["tr", "en", "es", "pt", "de"]);

  const acik = badge.acik;
  const nadirlik = rarityStyle(badge.rarity, theme);
  const gizliKilitli = badge.hidden && !acik;
  const baslik = gizliKilitli ? "???" : badgeAd(badge, lang);

  const kademeli = badge.aileUyeleri?.length > 1;
  const sekil = kademeSekli(badge.tier, badge.aileToplam);
  const kadRenk = kademeRengi(sekil.kademe, theme);
  // Kademeli rozette renk KADEMEDEN, ailesizde nadirlikten: karonun çerçevesi,
  // lekesi ve rozet gövdesi aynı rengi konuşur.
  const vurgu = kadRenk || nadirlik.color;

  // Peşinde koşulan hedef: kilitli tekil rozetin kendisi ya da ailenin sıradaki kademesi.
  const hedef = badge.sonrakiHedef || (!acik && badge.target > 1 ? badge : null);
  const ilerlemeGoster = !gizliKilitli && !!hedef;
  const tamamlandi = kademeli && acik && !badge.sonrakiHedef;

  let durum;
  let durumRenk = theme.text.muted;
  if (gizliKilitli) {
    durum = i18nText("autoI18n.rozet_bolum_gizli", "Gizli");
  } else if (ilerlemeGoster) {
    durum = formatBadgeAralik(hedef, hedef.ilerleme, hedef.target, lang);
  } else if (tamamlandi) {
    durum = i18nText("autoI18n.rozet_tamamlandi", "Tamamlandı");
    durumRenk = GOLD;
  } else if (acik) {
    durum = nadirlikAdi(badge.rarity, lang);
    durumRenk = nadirlik.color;
  } else {
    durum = i18nText("autoI18n.rozet_kilitli_etiket", "Kilitli");
  }

  const durumAd = acik
    ? i18nText("autoI18n.rozet_kazanildi_etiket", "Kazanıldı")
    : i18nText("autoI18n.rozet_kilitli_etiket", "Kilitli");
  const etiket = gizliKilitli
    ? `${i18nText("autoI18n.rozet_gizli_baslik", "Gizli rozet")}, ${durumAd}`
    : `${baslik}, ${durumAd}${ilerlemeGoster ? `, ${durum}` : ""}`;

  const Sarmal = onPress ? TouchableOpacity : View;
  const sarmalProps = onPress
    ? { onPress, activeOpacity: 0.78, accessibilityRole: "button", accessibilityLabel: etiket }
    : {};

  return (
    <Sarmal
      {...sarmalProps}
      style={[
        styles.tile,
        {
          backgroundColor: theme.secondary,
          borderColor: acik ? withAlpha(vurgu, 0.5) : theme.border,
        },
      ]}
    >
      {/* Üstten sönen renk lekesi: açık rozetin "yanık" olduğunu söyler, kilitlide
          neredeyse yok. Çerçeve ve gövdeyle aynı renk. */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          withAlpha(gizliKilitli ? theme.text.muted : vurgu, acik ? 0.24 : 0.06),
          withAlpha(vurgu, 0),
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.wash}
      />

      {badge.prestij > 0 ? (
        <View style={[styles.kose, styles.koseSol, { backgroundColor: withAlpha(GOLD, 0.18), borderColor: withAlpha(GOLD, 0.5) }]}>
          <Text allowFontScaling={false} style={[styles.koseText, { color: GOLD }]}>
            ★{badge.prestij}
          </Text>
        </View>
      ) : null}
      {/* KATALOGA YENİ EKLENEN rozet (sol üst, ÇERÇEVELİ): "burada yeni bir hedef var".
          Sağ üstteki dolgulu YENİ ise KAZANILDI (son 7 gün). İkisi de aynı anda
          sağda/solda durabilir; kazanılmış ve yeni etiketli kartta tek YENİ yeter,
          bu yüzden son 7 günde kazanılmışsa çerçeveli olan çizilmez. Prestij
          rozeti solda öncelikli (tamamlanmış ailede yeni kademe yoktur zaten). */}
      {!(badge.prestij > 0) && badge.yeniKatalog && !badge.yeni ? (
        <View style={[styles.kose, styles.koseSol, { backgroundColor: withAlpha(theme.accent, 0.12), borderColor: withAlpha(theme.accent, 0.7) }]}>
          <Text allowFontScaling={false} style={[styles.koseText, { color: theme.accent }]}>
            {i18nText("autoI18n.rozet_yeni", "YENİ")}
          </Text>
        </View>
      ) : null}
      {badge.yeni ? (
        <View style={[styles.kose, styles.koseSag, { backgroundColor: theme.accent, borderColor: theme.accent }]}>
          <Text allowFontScaling={false} style={[styles.koseText, { color: "#FFFFFF" }]}>
            {i18nText("autoI18n.rozet_yeni", "YENİ")}
          </Text>
        </View>
      ) : null}

      <AppBadge
        glyph={gizliKilitli ? "help-outline" : badge.icon}
        glyphSolid={gizliKilitli ? "help" : badge.iconSolid}
        rarity={badge.rarity}
        unlocked={acik}
        progress={gizliKilitli ? 0 : badge.oran}
        size={58}
        sides={sekil.kenar}
        color={kadRenk}
        ornate={sekil.ornate && acik}
      />

      {/* Kademe şeridi. Yeri HER ZAMAN ayrılır (ailesizde boş): satırdaki karoların
          başlıkları aynı yükseklikten başlasın. */}
      <View style={styles.seritYer}>
        {kademeli
          ? Array.from({ length: badge.aileToplam }).map((_, i) => {
              const dolu = i < badge.aileKademe;
              const renk = kademeRengi(kademeSekli(i + 1, badge.aileToplam).kademe, theme);
              return (
                <View
                  key={i}
                  style={[
                    styles.serit,
                    { backgroundColor: dolu ? renk : withAlpha(theme.text.muted, 0.24) },
                  ]}
                />
              );
            })
          : null}
      </View>

      <Text
        allowFontScaling={false}
        numberOfLines={2}
        style={[styles.ad, { color: acik ? theme.text.primary : theme.text.muted }]}
      >
        {baslik}
      </Text>

      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={[styles.durum, { color: durumRenk }]}
      >
        {durum}
      </Text>

      <View style={styles.cubukYer}>
        {ilerlemeGoster ? (
          <View style={[styles.iz, { backgroundColor: withAlpha(theme.text.muted, 0.2) }]}>
            <View
              style={[
                styles.dolgu,
                { backgroundColor: theme.accent, width: `${Math.max(3, Math.round(hedef.oran * 100))}%` },
              ]}
            />
          </View>
        ) : null}
      </View>
    </Sarmal>
  );
}

const styles = StyleSheet.create({
  tile: {
    height: TILE_YUKSEKLIK,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    paddingTop: 14,
    paddingHorizontal: 8,
    paddingBottom: 11,
  },
  wash: { position: "absolute", top: 0, left: 0, right: 0, height: "72%" },
  seritYer: {
    height: 4,
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  serit: { width: 11, height: 4, borderRadius: 2 },
  ad: {
    marginTop: 7,
    minHeight: 30,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  // Süre ailesinin ilerlemesi "140.000/259.200 dk"ya kadar uzar: 8 px'lik yan boşluğu
  // metne bırakıp (marginHorizontal -4) gerekirse küçültüyoruz (adjustsFontSizeToFit).
  durum: { marginTop: 3, fontSize: 10.5, fontWeight: "800", textAlign: "center", alignSelf: "stretch", marginHorizontal: -4 },
  cubukYer: { height: 4, marginTop: 5, alignSelf: "stretch", paddingHorizontal: 4, justifyContent: "center" },
  iz: { height: 4, borderRadius: 2, overflow: "hidden" },
  dolgu: { height: "100%", borderRadius: 2 },
  kose: {
    position: "absolute",
    top: 7,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  koseSol: { left: 7 },
  koseSag: { right: 7 },
  koseText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
});

export default memo(WatchBadgeTile);
