// components/badges/WatchBadgeCard.js
//
// Rozet ekranının satır kartı. AppBadge'i SARAR, DEĞİŞTİRMEZ — AppBadge'in prop
// yüzeyi kapalı bir sözleşmedir (oyun başarımları da onu kullanıyor); izleme
// rozetlerine özgü hiçbir davranış oraya sızmamalı.
//
// Geometri bilinçli olarak GameAchievementsScreen ile birebir aynı: minHeight
// 84, radius 18, padding 14, gap 13, AppBadge size 52. İki ekran aynı kart
// dilini konuşur, kullanıcı iki ayrı sistem görmez.

import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "@components/AppIcon";
import AppBadge from "@components/badges/AppBadge";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { kademeRengi, kademeSekli, rarityStyle } from "@theme/badgeTokens";
import { i18nText } from "@utils/i18nText";
import { withAlpha } from "@components/profile/StatsComponents";
import { badgeAciklama, badgeAd, formatBadgeAralik } from "./watchBadgeCatalog";

const sayi = (n, lang) => Math.round(Number(n) || 0).toLocaleString(lang === "tr" ? "tr-TR" : "en-US");

function WatchBadgeCard({ badge, onPress, compact = false }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const tr = language !== "en";
  const lang = tr ? "tr" : "en";

  const acik = badge.acik;
  const nadirlik = rarityStyle(badge.rarity, theme);

  // GİZLİ ROZET: kilitliyken ne adı ne hedefi görünür. İlerleme çubuğu da
  // çizilmez — "18/25" göstermek rozetin ne ölçtüğünü ele verir ve gizliliğin
  // tek anlamı olan sürprizi öldürür.
  const gizliKilitli = badge.hidden && !acik;
  const baslik = gizliKilitli ? "???" : badgeAd(badge, lang);
  // Kademeli ailede başlık ULAŞILAN kademedir, açıklama ise BİR SONRAKİ hedef:
  // "Sürekli Müşteri" (kazanıldı) · "150 film izle" (sıradaki). Kart hem nerede
  // olduğunu hem nereye gittiğini söyler.
  // "Sıradaki:" öneki ZORUNLU. Önek olmadan kart, kazanılmış kademenin yeşil
  // tikiyle birlikte kazanılMAMIŞ kademenin açıklamasını gösteriyordu
  // ("Sürekli Müşteri ✓ · 150 film izle") ve bu "150 film rozetini kazandım"
  // diye okunuyordu.
  const aciklama = gizliKilitli
    ? i18nText("autoI18n.rozet_gizli_baslik", "Gizli rozet")
    : acik && badge.sonrakiHedef
      ? `${i18nText("autoI18n.rozet_siradaki", "Sıradaki")}: ${badgeAciklama(badge.sonrakiHedef, lang)}`
      : badgeAciklama(badge, lang);

  const kademeliMi = badge.aileUyeleri?.length > 1;

  // SİLUET = ULAŞILAN kademe. Kart kimliğini zaten ulaşılan kademeden aldığı
  // için (gruplaAileler), kullanıcı ilerledikçe kartın şekli kare → beşgen →
  // altıgen diye DEĞİŞİR. Kilitli aile kartı `uyeler[0]`dan kimlik alır, yani
  // kareden başlar; ailesiz rozetler altıgen kalır.
  const sekil = kademeSekli(badge.tier, badge.aileToplam);
  // Kademeli rozette gövde rengi KADEMEDEN, ailesiz rozette nadirlikten gelir
  // (kademeRengi 0'da null döner ve AppBadge nadirliğe düşer).
  const kadRenk = kademeRengi(sekil.kademe, theme);
  // Kart çerçevesi de aynı rengi kullanmalı: gövde zümrüt, çerçeve mor olsaydı
  // kart iki farklı kademeden bahsediyor gibi görünürdü.
  const cerceveRenk = kadRenk || nadirlik.color;

  // İlerleme çubuğu İKİ ayrı durumu çizer:
  //   • kilitli tekil rozet  → kendi hedefine ilerleme
  //   • kademeli aile karti  → BİR SONRAKİ kademeye ilerleme (kart açık olsa da)
  // İkincisi olmadan, 2/4 kademesi açık bir aile kartı hiç ilerleme göstermez
  // ve kullanıcı sıradaki hedefi göremez.
  const sonraki = badge.sonrakiHedef;
  const ilerlemeKaynagi = sonraki || (!acik && badge.target > 1 ? badge : null);
  const ilerlemeGoster = !gizliKilitli && !!ilerlemeKaynagi;

  // `onPress` verilmezse kart eskisi gibi düz bir View kalır. Her zaman
  // TouchableOpacity kullanıp `disabled` geçmek, dokunulamaz kartlara da buton
  // erişilebilirlik rolü verirdi.
  const Sarmal = onPress ? TouchableOpacity : View;
  const sarmalProps = onPress
    ? { onPress, activeOpacity: 0.75, accessibilityRole: "button", accessibilityLabel: baslik }
    : {};

  return (
    <Sarmal
      {...sarmalProps}
      style={[
        styles.card,
        compact && styles.cardCompact,
        {
          backgroundColor: theme.secondary,
          borderColor: acik ? cerceveRenk : theme.border,
        },
      ]}
    >
      {compact ? (
        <View
          pointerEvents="none"
          style={[
            styles.compactTint,
            {
              backgroundColor: withAlpha(
                gizliKilitli ? theme.text.muted : cerceveRenk,
                acik ? 0.12 : 0.055,
              ),
            },
          ]}
        />
      ) : null}

      <AppBadge
        glyph={gizliKilitli ? "help-outline" : badge.icon}
        glyphSolid={gizliKilitli ? "help" : badge.iconSolid}
        rarity={badge.rarity}
        unlocked={acik}
        progress={gizliKilitli ? 0 : badge.oran}
        size={compact ? 40 : 52}
        sides={sekil.kenar}
        color={kadRenk}
        ornate={sekil.ornate && acik}
        accessibilityLabel={baslik}
      />

      <View style={[styles.copy, compact && styles.copyCompact]}>
        <View style={[styles.titleRow, compact && styles.titleRowCompact]}>
          <Text
            allowFontScaling={false}
            numberOfLines={compact ? 2 : 1}
            style={[
              styles.title,
              compact && styles.titleCompact,
              { color: theme.text.primary },
            ]}
          >
            {baslik}
          </Text>
          {/* withAlpha ZORUNLU, `renk + "22"` DEĞİL: rarityStyle common için
              theme.text.muted, uncommon için theme.accent döndürüyor ve özel
              temada bu değer hex olmayabilir — düz birleştirme "hsl(...)22"
              gibi geçersiz bir renk üretip rozeti şeffaf bırakır. */}
          {/* "2/4" çipi KADEMEYİ anlatıyor, nadirliği değil — rengi de oradan
              almalı ki gövdeyle aynı şeyi söylesin. */}
          {kademeliMi ? (
            <View style={[styles.tier, compact && styles.tierCompact, { backgroundColor: withAlpha(cerceveRenk, 0.13), borderColor: withAlpha(cerceveRenk, 0.33) }]}>
              <Text allowFontScaling={false} style={[styles.tierText, compact && styles.tierTextCompact, { color: cerceveRenk }]}>
                {badge.aileKademe}/{badge.aileToplam}
              </Text>
            </View>
          ) : null}
          {/* PRESTİJ — yalnız aile tamamlandıktan sonra ve yalnız sınırsız
              ölçütlerde görünür. Kademe çipinin yanında ayrı bir işaret olarak
              durur: kademe "neredesin", prestij "zirveden ne kadar öteye
              gittin" der; ikisini tek çipte birleştirmek ikisini de bulanıklaştırır. */}
          {badge.prestij > 0 ? (
            <View style={[styles.tier, compact && styles.tierCompact, { backgroundColor: withAlpha("#F5C518", 0.16), borderColor: withAlpha("#F5C518", 0.4) }]}>
              <Text allowFontScaling={false} style={[styles.tierText, compact && styles.tierTextCompact, { color: "#F5C518" }]}>
                ★{badge.prestij}
              </Text>
            </View>
          ) : null}
        </View>

        {!compact ? (
          <Text allowFontScaling={false} style={[styles.description, { color: theme.text.muted }]}> 
            {aciklama}
          </Text>
        ) : null}

        {ilerlemeGoster ? (
          <View style={[styles.progressWrap, compact && styles.progressWrapCompact]}>
            <View style={[styles.progressTrack, compact && styles.progressTrackCompact, { backgroundColor: theme.primary }]}>
              {/* Dolgu rengi theme.accent: nadirlik rengi common'da theme.text.muted
                  oluyor ve açık temada dolgu ile boş kanal ayırt edilemiyordu. */}
              <View style={[styles.progressFill, {
                backgroundColor: theme.accent,
                width: `${Math.round(ilerlemeKaynagi.oran * 100)}%`,
              }]} />
            </View>
            {/* Tek satır + gerekirse küçülme: dakika gösteriminde dize
                "525.600/525.600 dk"e kadar uzayabiliyor ve kompakt kartın
                yüksekliği sabit (124) — ikinci satır düzeni taşırırdı. */}
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} allowFontScaling={false} style={[styles.progressText, compact && styles.progressTextCompact, { color: theme.text.muted }]}>
              {formatBadgeAralik(ilerlemeKaynagi, ilerlemeKaynagi.ilerleme, ilerlemeKaynagi.target, lang)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* NADİRLİK NOKTASI. Gövde rengi artık KADEMEYİ anlattığı için nadirlik
          renk kanalını kaybetti ve ölçüldü: `perde_20` (legendary, sistemin en
          tepe rozeti) ile `film_150` (rare) aynı moru paylaşıyordu. Bu 7px'lik
          nokta nadirliğe kendi kanalını geri verir; kademe rengiyle yarışmaz
          çünkü ayrı bir yüzeyde ve çok küçük. Kilitliyken çizilmez — kilitli
          kartta zaten hiçbir renk iddiası yok. */}
      {acik ? (
        <View
          pointerEvents="none"
          style={[styles.nadirlikNokta, {
            backgroundColor: nadirlik.color,
            borderColor: withAlpha(theme.secondary, 0.9),
          }]}
        />
      ) : null}

      {acik ? (
        <AppIcon
          family="Ionicons"
          name="checkmark-circle"
          size={compact ? 15 : 22}
          color="#2ECC71"
          style={compact ? styles.checkCompact : undefined}
        />
      ) : null}
    </Sarmal>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 84, borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 13 },
  cardCompact: {
    height: 124,
    borderRadius: 14,
    overflow: "hidden",
    paddingVertical: 9,
    paddingHorizontal: 4,
    flexDirection: "column",
    justifyContent: "flex-start",
    gap: 5,
    position: "relative",
  },
  compactTint: {
    ...StyleSheet.absoluteFill,
  },
  copy: { flex: 1 },
  copyCompact: { flex: 0, width: "100%", alignItems: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  titleRowCompact: { flexDirection: "column", justifyContent: "flex-start", gap: 3 },
  title: { flexShrink: 1, fontSize: 15, fontWeight: "850" },
  titleCompact: { minHeight: 24, fontSize: 9.5, lineHeight: 12, textAlign: "center" },
  tier: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  tierCompact: { borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  tierText: { fontSize: 9, fontWeight: "900" },
  tierTextCompact: { fontSize: 7.5 },
  description: { fontSize: 11, lineHeight: 16, fontWeight: "650", marginTop: 3 },
  progressWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  progressWrapCompact: { width: "100%", flexDirection: "column", gap: 2, marginTop: 4 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  // BUG: compact'ta kapsayıcı `flexDirection: "column"` olduğu için ANA EKSEN
  // dikey. `flex: 1` RN'de flexBasis'i 0 yapar ve o eksende `height: 6`yı ezer;
  // kapsayıcının yüksekliği `auto` olduğundan dağıtılacak boş alan da yok, yani
  // çubuk 0 piksel yükseklikte çiziliyordu — ilerleme hiç görünmüyordu.
  // Çözüm: dikey eksende esneme yok (`flex: 0`), genişlik `alignSelf` ile.
  progressTrackCompact: { flex: 0, alignSelf: "stretch", height: 5, borderRadius: 2.5 },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { fontSize: 10, fontWeight: "800" },
  progressTextCompact: { fontSize: 7.5 },
  checkCompact: { position: "absolute", top: 5, right: 5 },
  // SOL üst köşe: sağ üst köşe compact modda yeşil tike ait. İnce halka,
  // noktanın koyu ve açık temada da kart zemininden ayrılmasını sağlar.
  nadirlikNokta: {
    position: "absolute", top: 6, left: 6,
    width: 7, height: 7, borderRadius: 4, borderWidth: 1,
  },
});

export default memo(WatchBadgeCard);
