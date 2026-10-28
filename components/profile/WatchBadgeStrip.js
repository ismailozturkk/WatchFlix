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

import { copyLanguage, pickByLanguage } from "../../utils/appLanguages";
import React, { memo, useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "@components/AppIcon";
import AppBadge from "@components/badges/AppBadge";
import WatchBadgeDetailModal from "@components/badges/WatchBadgeDetailModal";
import Toast from "@components/AppToast";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useBadgeShowcase from "@hooks/useBadgeShowcase";
import * as Haptics from "@services/hapticsService";
import { kademeRengi, kademeSekli, RARITY_ORDER } from "@theme/badgeTokens";
import { badgeAd } from "@components/badges/watchBadgeCatalog";
import { sortUnlockedWithShowcaseFirst } from "@utils/badgeShowcase";
import { getBadgeShowcaseCopy } from "@utils/badgeShowcaseCopy";
import { withAlpha } from "./StatsComponents";
import GlassTouchable from "../common/GlassTouchable";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

const ROZET_BOYUT = 44;
const KOMPAKT_ROZET_BOYUT = 30;

function WatchBadgeStrip({ progress, onPress, compact = false }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const lang = copyLanguage(language, ["tr", "en", "es", "pt", "de"]);
  const copy = getBadgeShowcaseCopy(lang);
  const { loading, kartlar, acikSayisi, toplamRozet } = progress || {};
  const { showcaseIds, toggleBadge, isShowcased } = useBadgeShowcase();

  // Simgeye dokunmak DETAY MODALINI açar, Rozetler ekranına GİTMEZ. Gezinme
  // sonundaki sayaç çipinde kalır: raf bir vitrin, her simge kendi hikâyesini
  // anlatabilmeli — dokununca ekran değiştirmek o hikâyeyi atlamak olurdu.
  const [secili, setSecili] = useState(null);

  const acikRozetler = useMemo(() => {
    if (!kartlar?.length) return [];
    const sadeceAcik = kartlar.filter((k) => k.acik);
    return sortUnlockedWithShowcaseFirst(sadeceAcik, showcaseIds, RARITY_ORDER);
  }, [kartlar, showcaseIds]);

  const handleToggleVitrin = useCallback(
    (badge) => {
      const res = toggleBadge(badge);
      if (res.action === "added" || res.action === "removed") {
        Haptics.selectionAsync();
      } else if (res.action === "full") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Toast.show({
          type: "info",
          text1: copy.showcaseFullTitle,
          text2: copy.showcaseFullBody,
        });
      }
    },
    [toggleBadge, copy],
  );

  // Açılış penceresinde (useStartupGate 3200 ms) ve hiç rozet yokken şerit
  // TAMAMEN gizlenir. Boş bir raf ya da iskelet göstermek, hemen üstündeki
  // profil kimlik alanında anlamsız bir boşluk oluştururdu.
  if (loading || !acikRozetler.length) return null;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={[styles.row, compact && styles.rowCompact]}
      >
        {/* Sayaç + giriş oku vitrinin başında kalır; rozetler sayfasına geçiş
            yatay listenin sonuna kadar kaydırmayı gerektirmemeli. */}
        <GlassTouchable
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={pickByLanguage(lang, {
            tr: "Tüm rozetler",
            en: "All badges",
            es: "Todas las insignias",
            pt: "Todos os emblemas",
            de: "Alle Abzeichen",
          })}
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
        </GlassTouchable>

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
              {/* Son 7 günde kazanılan rozetin köşesinde küçük bir nokta: raf bir
                  vitrin ama "yeni bir şey var" bilgisi sıfır maliyetle taşınır. */}
              {b.yeni ? (
                <View
                  pointerEvents="none"
                  style={[styles.yeniNokta, { backgroundColor: theme.accent, borderColor: theme.primary }]}
                />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <WatchBadgeDetailModal
        badge={secili}
        visible={!!secili}
        onClose={() => setSecili(null)}
        vitrinde={secili ? isShowcased(secili) : false}
        vitrinSayisi={showcaseIds.length}
        onToggleVitrin={handleToggleVitrin}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Genişlik 90%: Wrapped kartı ve istatistik bölümleriyle aynı kolon. Tam
  // genişlik (full-bleed) daha akıcı kaydırırdı ama ilk rozet üstteki kartın
  // kenarıyla hizasız kalırdı.
  wrap: { width: "90%", marginBottom: 14 },
  wrapCompact: { width: "100%", marginTop: 7, marginBottom: 7 },
  // Baştaki cam "Tüm rozetler" düğmesi basılınca kırpma sınırında kesilmesin: dört yanda
  // GLASS_PRESS_ROOM (dolgu + eşit negatif dış boşluk; yerleşim aynı).
  scroll: { margin: -GLASS_PRESS_ROOM },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: GLASS_PRESS_ROOM,
    paddingLeft: GLASS_PRESS_ROOM,
    paddingRight: 2 + GLASS_PRESS_ROOM,
  },
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
  yeniNokta: { position: "absolute", top: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});

export default memo(WatchBadgeStrip);
