// components/profile/WatchBadgeStrip.js
//
// Profil başlığındaki yatay rozet vitrini.
//
// NE GÖSTERİR: yalnızca KAZANILMIŞ rozetler, simge olarak, metinsiz. Bu bir
// vitrin; hedef listesi değil. Hedefleri zaten iki yer gösteriyor: WatchLevelCard
// ("az kaldı" şeridi, en yakın 2 rozet) ve Rozetler ekranının kendisi. Üçüncü
// bir hedef yüzeyi eklemek aynı bilgiyi üç kez tekrarlardı.
//
// KAYNAK `kartlar`, ham `rozetler` DEĞİL. Ekran kademeli aileleri tek karta
// indiriyor ve kimlik olarak ULAŞILAN kademeyi gösteriyor; ham listeyi
// kullansaydık raf "İlk Bilet + Sürekli Müşteri + Salon Sakini" diye aynı ailenin
// üç ikonunu yan yana basar, üstelik hiçbiri rozet ekranında o adla bulunmazdı.
//
// PROP OLARAK `progress` ALIR, useWatchProgress'i KENDİ ÇAĞIRMAZ. Hook ikinci kez
// çağrılsaydı iki şey birden bozulurdu: (a) 512 film + 3.400 bölümlük tek geçiş
// hesabı iki kez koşardı, (b) İKİ ayrı defter mutabakatı effect'i aynı
// AsyncStorage anahtarı üzerinde yarışırdı — tohumlama geri alınamaz olduğu için
// bu yarışın bedeli kalıcı olurdu.

import React, { memo, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "@components/AppIcon";
import AppBadge from "@components/badges/AppBadge";
import WatchBadgeDetailModal from "@components/badges/WatchBadgeDetailModal";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { kademeRengi, kademeSekli, RARITY_ORDER } from "@theme/badgeTokens";
import { badgeAd } from "@components/badges/watchBadgeCatalog";
import { withAlpha } from "./StatsComponents";

const ROZET_BOYUT = 44;
const KOMPAKT_ROZET_BOYUT = 30;

function WatchBadgeStrip({ progress, onPress, compact = false }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const lang = language === "en" ? "en" : "tr";
  const { loading, kartlar, acikSayisi, toplamRozet } = progress || {};
  // Simgeye dokunmak DETAY MODALINI açar, Rozetler ekranına GİTMEZ. Gezinme
  // sonundaki sayaç çipinde kalır: raf bir vitrin, her simge kendi hikâyesini
  // anlatabilmeli — dokununca ekran değiştirmek o hikâyeyi atlamak olurdu.
  const [secili, setSecili] = useState(null);

  const acikRozetler = useMemo(() => {
    if (!kartlar?.length) return [];
    return kartlar
      .filter((k) => k.acik)
      // Nadir olan başta: rafın ilk gördüğün ucu en iyi parçan olmalı. Katalog
      // sırası bıraksaydık raf "İlk Kare, İlk Bilet, Sezon Başı…" diye en ucuz
      // üç rozetle açılırdı.
      .sort((a, b) => {
        const fark = RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
        // Eşit nadirlikte ilerlemişi öne al (4/4 tamamlanmış aile, 1/4'ten önce).
        return fark !== 0 ? fark : (b.aileKademe || 0) - (a.aileKademe || 0);
      });
  }, [kartlar]);

  // Açılış penceresinde (useStartupGate 3200 ms) ve hiç rozet yokken şerit
  // TAMAMEN gizlenir. Boş bir raf ya da iskelet göstermek, hemen üstündeki
  // profil kimlik alanında anlamsız bir boşluk oluştururdu.
  if (loading || !acikRozetler.length) return null;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, compact && styles.rowCompact]}
      >
        {/* Sayaç + giriş oku vitrinin başında kalır; rozetler sayfasına geçiş
            yatay listenin sonuna kadar kaydırmayı gerektirmemeli. */}
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={lang === "tr" ? "Tüm rozetler" : "All badges"}
          onPress={onPress}
          style={[
            styles.hepsi,
            compact && styles.hepsiCompact,
            {
              backgroundColor: withAlpha(theme.accent, 0.11),
              borderColor: withAlpha(theme.accent, 0.38),
            },
          ]}
        >
          <View
            style={[
              styles.hepsiIcon,
              compact && styles.hepsiIconCompact,
              { backgroundColor: withAlpha(theme.accent, 0.18) },
            ]}
          >
            <AppIcon
              family="Ionicons"
              name="ribbon-outline"
              size={compact ? 12 : 15}
              color={theme.accent}
            />
          </View>
          <View
            style={[
              styles.hepsiCount,
              compact && styles.hepsiCountCompact,
              { backgroundColor: withAlpha(theme.accent, 0.16) },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.hepsiCountText,
                compact && styles.hepsiCountTextCompact,
                { color: theme.accent },
              ]}
            >
              {acikSayisi}/{toplamRozet}
            </Text>
          </View>
          <AppIcon
            family="Ionicons"
            name="chevron-forward"
            size={compact ? 12 : 14}
            color={theme.accent}
          />
        </TouchableOpacity>

        {acikRozetler.map((b) => {
          const sekil = kademeSekli(b.tier, b.aileToplam);
          return (
            <TouchableOpacity
              key={b.id}
              activeOpacity={0.7}
              accessibilityRole="button"
              // Simge metinsiz duruyor; ekran okuyucu için ad ŞART.
              accessibilityLabel={badgeAd(b, lang)}
              onPress={() => setSecili(b)}
            >
              <AppBadge
                glyph={b.icon}
                glyphSolid={b.iconSolid}
                rarity={b.rarity}
                unlocked
                size={compact ? KOMPAKT_ROZET_BOYUT : ROZET_BOYUT}
                sides={sekil.kenar}
                color={kademeRengi(sekil.kademe, theme)}
                ornate={sekil.ornate}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <WatchBadgeDetailModal badge={secili} visible={!!secili} onClose={() => setSecili(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Genişlik 90%: Wrapped kartı ve istatistik bölümleriyle aynı kolon. Tam
  // genişlik (full-bleed) daha akıcı kaydırırdı ama ilk rozet üstteki kartın
  // kenarıyla hizasız kalırdı.
  wrap: { width: "90%", marginBottom: 14 },
  wrapCompact: { width: "100%", marginTop: 7, marginBottom: 7 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingRight: 2 },
  rowCompact: { gap: 5 },
  hepsi: {
    flexDirection: "row", alignItems: "center", gap: 5,
    height: 44, paddingHorizontal: 7, borderRadius: 14, borderWidth: 1,
    marginRight: 2,
  },
  hepsiCompact: { height: 30, paddingHorizontal: 5, borderRadius: 11, gap: 4, marginRight: 1 },
  hepsiIcon: {
    width: 28, height: 28, borderRadius: 9,
    justifyContent: "center", alignItems: "center",
  },
  hepsiIconCompact: { width: 22, height: 22, borderRadius: 7 },
  hepsiCount: {
    minWidth: 34, height: 22, paddingHorizontal: 6, borderRadius: 8,
    justifyContent: "center", alignItems: "center",
  },
  hepsiCountCompact: { minWidth: 30, height: 20, paddingHorizontal: 5, borderRadius: 7 },
  hepsiCountText: { fontSize: 10, fontWeight: "900" },
  hepsiCountTextCompact: { fontSize: 8.5 },
});

export default memo(WatchBadgeStrip);
