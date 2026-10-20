// components/badges/WatchBadgeCard.js
//
// Rozet satır kartı. AppBadge'i SARAR, DEĞİŞTİRMEZ — AppBadge'in prop yüzeyi kapalı
// bir sözleşmedir (oyun başarımları da onu kullanıyor); izleme rozetlerine özgü
// hiçbir davranış oraya sızmamalı.
//
// İKİ BİÇİM:
//   • compact → ızgara KAROSU (WatchBadgeTile.js). Rozet ekranı bunu kullanır.
//   • varsayılan → tam genişlikte SATIR kartı. Geometri bilinçli olarak
//     GameAchievementsScreen ile birebir aynı: minHeight 84, radius 18, padding 14,
//     gap 13, AppBadge size 52 — iki ekran aynı kart dilini konuşur.
//
// Karo eskiden bu dosyanın içinde `compact` dalıydı ve satır kartıyla stil/mantık
// paylaşıyordu; iki biçim ayrı kararlar (3 sütun, kademe şeridi, YENİ etiketi)
// gerektirince tek dosyada birbirine dolanmıştı. Artık ayrı bileşenler.

import { copyLanguage } from "../../utils/appLanguages";
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "@components/AppIcon";
import AppBadge from "@components/badges/AppBadge";
import WatchBadgeTile from "@components/badges/WatchBadgeTile";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { kademeRengi, kademeSekli, rarityStyle } from "@theme/badgeTokens";
import { i18nText } from "@utils/i18nText";
import { withAlpha } from "@components/profile/StatsComponents";
import { badgeAciklama, badgeAd, formatBadgeAralik } from "./watchBadgeCatalog";

function WatchBadgeRow({ badge, onPress }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const lang = copyLanguage(language, ["tr", "en", "es", "pt", "de"]);

  const acik = badge.acik;
  const nadirlik = rarityStyle(badge.rarity, theme);

  // GİZLİ ROZET: kilitliyken ne adı ne hedefi görünür. İlerleme çubuğu da
  // çizilmez — "18/25" göstermek rozetin ne ölçtüğünü ele verir ve gizliliğin
  // tek anlamı olan sürprizi öldürür.
  const gizliKilitli = badge.hidden && !acik;
  const baslik = gizliKilitli ? "???" : badgeAd(badge, lang);
  // Kademeli ailede başlık ULAŞILAN kademedir, açıklama ise BİR SONRAKİ hedef:
  // "Sürekli Müşteri" (kazanıldı) · "150 film izle" (sıradaki). "Sıradaki:" öneki
  // ZORUNLU; önek olmadan kart, kazanılmış kademenin yeşil tikiyle birlikte
  // kazanılMAMIŞ kademenin açıklamasını gösteriyordu ve "150 film rozetini
  // kazandım" diye okunuyordu.
  const aciklama = gizliKilitli
    ? i18nText("autoI18n.rozet_gizli_baslik", "Gizli rozet")
    : acik && badge.sonrakiHedef
      ? `${i18nText("autoI18n.rozet_siradaki", "Sıradaki")}: ${badgeAciklama(badge.sonrakiHedef, lang)}`
      : badgeAciklama(badge, lang);

  const kademeliMi = badge.aileUyeleri?.length > 1;
  // SİLUET = ULAŞILAN kademe (kart kimliğini gruplaAileler'de oradan alıyor).
  const sekil = kademeSekli(badge.tier, badge.aileToplam);
  const kadRenk = kademeRengi(sekil.kademe, theme);
  // Kart çerçevesi de aynı rengi kullanmalı: gövde zümrüt, çerçeve mor olsaydı
  // kart iki farklı kademeden bahsediyor gibi görünürdü.
  const cerceveRenk = kadRenk || nadirlik.color;

  // İlerleme çubuğu İKİ ayrı durumu çizer: kilitli tekil rozetin kendi hedefi ve
  // kademeli ailenin BİR SONRAKİ kademesi (kart açık olsa da).
  const sonraki = badge.sonrakiHedef;
  const ilerlemeKaynagi = sonraki || (!acik && badge.target > 1 ? badge : null);
  const ilerlemeGoster = !gizliKilitli && !!ilerlemeKaynagi;

  // `onPress` verilmezse kart düz bir View kalır; her zaman TouchableOpacity
  // kullanmak dokunulamaz kartlara da buton erişilebilirlik rolü verirdi.
  const Sarmal = onPress ? TouchableOpacity : View;
  const sarmalProps = onPress
    ? { onPress, activeOpacity: 0.75, accessibilityRole: "button", accessibilityLabel: baslik }
    : {};

  return (
    <Sarmal
      {...sarmalProps}
      style={[
        styles.card,
        { backgroundColor: theme.secondary, borderColor: acik ? cerceveRenk : theme.border },
      ]}
    >
      <AppBadge
        glyph={gizliKilitli ? "help-outline" : badge.icon}
        glyphSolid={gizliKilitli ? "help" : badge.iconSolid}
        rarity={badge.rarity}
        unlocked={acik}
        progress={gizliKilitli ? 0 : badge.oran}
        size={52}
        sides={sekil.kenar}
        color={kadRenk}
        ornate={sekil.ornate && acik}
        accessibilityLabel={baslik}
      />

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.title, { color: theme.text.primary }]}
          >
            {baslik}
          </Text>
          {/* withAlpha ZORUNLU, `renk + "22"` DEĞİL: özel temada renk hex olmayabilir —
              düz birleştirme "hsl(...)22" gibi geçersiz bir renk üretip rozeti
              şeffaf bırakırdı. "2/4" çipi KADEMEYİ anlatıyor, nadirliği değil. */}
          {kademeliMi ? (
            <View style={[styles.tier, { backgroundColor: withAlpha(cerceveRenk, 0.13), borderColor: withAlpha(cerceveRenk, 0.33) }]}>
              <Text allowFontScaling={false} style={[styles.tierText, { color: cerceveRenk }]}>
                {badge.aileKademe}/{badge.aileToplam}
              </Text>
            </View>
          ) : null}
          {/* PRESTİJ: kademe "neredesin", prestij "zirveden ne kadar öteye gittin"
              der; ikisini tek çipte birleştirmek ikisini de bulanıklaştırır. */}
          {badge.prestij > 0 ? (
            <View style={[styles.tier, { backgroundColor: withAlpha("#F5C518", 0.16), borderColor: withAlpha("#F5C518", 0.4) }]}>
              <Text allowFontScaling={false} style={[styles.tierText, { color: "#F5C518" }]}>
                ★{badge.prestij}
              </Text>
            </View>
          ) : null}
        </View>

        <Text allowFontScaling={false} style={[styles.description, { color: theme.text.muted }]}>
          {aciklama}
        </Text>

        {ilerlemeGoster ? (
          <View style={styles.progressWrap}>
            <View style={[styles.progressTrack, { backgroundColor: theme.primary }]}>
              {/* Dolgu rengi theme.accent: nadirlik rengi common'da theme.text.muted
                  oluyor ve açık temada dolgu ile boş kanal ayırt edilemiyordu. */}
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: theme.accent, width: `${Math.round(ilerlemeKaynagi.oran * 100)}%` },
                ]}
              />
            </View>
            {/* Tek satır + gerekirse küçülme: dakika gösteriminde dize
                "525.600/525.600 dk"e kadar uzayabiliyor. */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              allowFontScaling={false}
              style={[styles.progressText, { color: theme.text.muted }]}
            >
              {formatBadgeAralik(ilerlemeKaynagi, ilerlemeKaynagi.ilerleme, ilerlemeKaynagi.target, lang)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* NADİRLİK NOKTASI: gövde rengi artık KADEMEYİ anlattığı için nadirlik renk
          kanalını kaybetti; bu küçük nokta ona kendi kanalını geri verir. */}
      {acik ? (
        <View
          pointerEvents="none"
          style={[styles.nadirlikNokta, { backgroundColor: nadirlik.color, borderColor: withAlpha(theme.secondary, 0.9) }]}
        />
      ) : null}

      {acik ? <AppIcon family="Ionicons" name="checkmark-circle" size={22} color="#2ECC71" /> : null}
    </Sarmal>
  );
}

function WatchBadgeCard(props) {
  return props.compact ? <WatchBadgeTile {...props} /> : <WatchBadgeRow {...props} />;
}

const styles = StyleSheet.create({
  card: { minHeight: 84, borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 13 },
  copy: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { flexShrink: 1, fontSize: 15, fontWeight: "850" },
  tier: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  tierText: { fontSize: 9, fontWeight: "900" },
  description: { fontSize: 11, lineHeight: 16, fontWeight: "650", marginTop: 3 },
  progressWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { fontSize: 10, fontWeight: "800" },
  nadirlikNokta: {
    position: "absolute", top: 6, left: 6,
    width: 7, height: 7, borderRadius: 4, borderWidth: 1,
  },
});

export default memo(WatchBadgeCard);
