// screens/tabs/HubScreen.js
//
// "Hub" sekmesinin yapısı. Eskiden bu sekme doğrudan
// sosyal feed'i (ShareContentScreen) gösteriyordu; artık feed ayrı bir stack
// ekranına taşındı ve buradan modern bir widget ile açılıyor. Profildeki oyun
// modülü de (ProfileGamesModule) buraya taşındı.
//
// İçerik:
//   • Selamlama başlığı + avatar
//   • Sosyal: Paylaşımlar kartı (components/hub/FeedWidget) — feed'e gider;
//     içinde hızlı paylaşım çubuğu + tür karoları (İnceleme/Liste/Sohbet/Anket)
//   • Turnuva (2. sıra), CineSwipe, Bingo ve Günün Sorusu kartları (components/hub/*)
//   • Oyunlar: taşınan ProfileGamesModule (öne çıkan oyun + istatistik)
//
// Üç vitrin bölümü aynı SectionHeader'ı kullanır (Oyunlar modülüyle aynı başlık
// dili); kartların ortak kabuğu components/hub/HubCard.js.
// (Wrapped / yıllık arşiv Kütüphane sekmesine taşındı: screens/tabs/LibraryScreen.js)

import React, { useMemo } from "react";
import { useTabBarLayout } from "../../context/TabBarLayoutContext";
import useTabBarScrollSync from "../../hooks/useTabBarScrollSync";
import useScreenSections from "../../hooks/useSectionVisibility";
import SectionsHiddenNotice from "../../components/home/SectionsHiddenNotice";
import { markTabScroll } from "../../components/navigation/TabScrollMarker";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
// Üst boşluk kaydırılan içeriğin içinde (diğer sekmeler gibi): Premium şeridi
// yüzerken içerik onun ALTINDAN geçer; büyütülmüş insets.top şeridi de kapsar.
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import ScreenDecor from "@components/ScreenDecor";
import ProfileGamesModule from "@components/profile/ProfileGamesModule";
import FeedWidget from "@components/hub/FeedWidget";
import TournamentWidget from "@components/hub/TournamentWidget";
import CineSwipeWidget from "@components/hub/CineSwipeWidget";
import BingoWidget from "@components/hub/BingoWidget";
import DailyPollWidget from "@components/hub/DailyPollWidget";
import Top100Widget from "@components/hub/Top100Widget";
import ChallengesWidget from "@components/hub/ChallengesWidget";
import LeagueWidget from "@components/hub/LeagueWidget";
import TierListWidget from "@components/hub/TierListWidget";
import { SectionHeader } from "@components/game/ui";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useAuth } from "@context/AuthContext";
import { useProfileUi } from "@context/ProfileUiContext";
import { i18nText } from "@utils/i18nText";
import { getWatchChallengesCopy } from "@utils/watchChallengesCopy";
import { getTierListCopy } from "@utils/tierListCopy";

// Başlık + kart: bölüm genişliği ve başlık hizası tek yerde.
function HubSection({ title, theme, children }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} theme={theme} style={styles.sectionHeader} />
      {children}
    </View>
  );
}

// iOS sekme çubuğunun "aşağı kaydırınca küçül" davranışı için kaydırma
// görünümünü sekme ekranına tanıtır (bkz. components/navigation/TabScrollMarker.js).
// Modül kapsamında: render içinde kurulursa içerik her render'da sökülür.
const MarkedScrollView = markTabScroll(ScrollView);

export default function HubScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { contentBottom } = useTabBarLayout();
  const onTabBarScroll = useTabBarScrollSync();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { avatar } = useProfileUi();
  // Ayarlar > Kişiselleştirme > Ekran bölümleri'nde gizlenen kartlar
  // (utils/sectionVisibility.js "hub"). Selamlama başlığı her zaman görünür.
  const { isVisible: show, allHidden } = useScreenSections("hub");

  // language dependency'de olmalı; yoksa dil değişince selamlama eski dilde kalır.
  const greeting = useMemo(() => {
    const name = user?.displayName?.split(" ")[0] || "";
    const hi = i18nText("autoI18n.merhaba", "Merhaba");
    return name ? `${hi}, ${name}` : hi;
  }, [user?.displayName, language]);

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor scope="home" iconOpacity={0.15} />
      <View style={styles.container}>
        <MarkedScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + SCROLL_TOP, paddingBottom: contentBottom },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={onTabBarScroll}
          scrollEventThrottle={16}
        >
        {/* Başlık */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: theme.text.primary }]}>{greeting}</Text>
            <Text style={[styles.greetingSub, { color: theme.text.secondary }]}>
              {i18nText("autoI18n.hub_alt_baslik", "Paylaşımlar ve oyunlar tek yerde")}
            </Text>
          </View>
          {avatar ? (
            <Image source={avatar} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: theme.secondary,
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: theme.border,
                },
              ]}
            >
              <AppIcon family="Ionicons" name="person" size={22} color={theme.text.muted} />
            </View>
          )}
        </View>

        {/* Haftalık Lig — en üstte: sıran, XP'n, kalan süre */}
        {show("league") && (
          <HubSection title={i18nText("autoI18n.haftalik_lig_bolum", "Haftalık Lig")} theme={theme}>
            <LeagueWidget navigation={navigation} />
          </HubSection>
        )}

        {/* Sosyal */}
        {show("feed") && (
          <HubSection title={i18nText("autoI18n.sosyal", "Sosyal")} theme={theme}>
            <FeedWidget navigation={navigation} />
          </HubSection>
        )}

        {/* Turnuva — Sosyal'in hemen altında (2. sıra) */}
        {show("tournament") && (
          <HubSection title={i18nText("autoI18n.tournament_section", "Turnuva")} theme={theme}>
            <TournamentWidget navigation={navigation} />
          </HubSection>
        )}

        {/* CineSwipe (Birlikte Ne İzlesek?) */}
        {show("cineswipe") && (
          <HubSection title="CINESWIPE" theme={theme}>
            <CineSwipeWidget navigation={navigation} />
          </HubSection>
        )}

        {/* Sinema Bingosu (haftalık kart) */}
        {show("bingo") && (
          <HubSection title="BINGO" theme={theme}>
            <BingoWidget navigation={navigation} />
          </HubSection>
        )}

        {/* Günün Sorusu (iki seçenekli günlük anket) */}
        {show("poll") && (
          <HubSection title={i18nText("autoI18n.gunun_sorusu_bolum", "Günün sorusu")} theme={theme}>
            <DailyPollWidget />
          </HubSection>
        )}

        {/* Seelogd Top 100 (film + dizi topluluk sıralaması; oy, liste kaydı, sohbete gönder) */}
        {show("top100") && (
          <HubSection title="SEELOGD TOP 100" theme={theme}>
            <Top100Widget navigation={navigation} />
          </HubSection>
        )}

        {/* Meydan okumalar (52 haftada 52 film, her on yıldan bir film, yönetmen filmografisi…) */}
        {show("challenges") && (
          <HubSection title={getWatchChallengesCopy(language).sectionTitle} theme={theme}>
            <ChallengesWidget navigation={navigation} />
          </HubSection>
        )}

        {/* Tier list (film / dizi kademeli sıralama; görsel ve sohbet paylaşımı) */}
        {show("tierlist") && (
          <HubSection title={getTierListCopy(language).sectionTitle} theme={theme}>
            <TierListWidget navigation={navigation} />
          </HubSection>
        )}

        {/* Oyunlar */}
        {show("games") && <ProfileGamesModule navigation={navigation} />}

        {allHidden && <SectionsHiddenNotice navigation={navigation} screen="hub" />}
        </MarkedScrollView>
      </View>
    </View>
  );
}

const SCROLL_TOP = 10;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { alignItems: "center", paddingBottom: 110 },

  headerRow: {
    width: "90%",
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 18,
  },
  greeting: { fontSize: 22, fontWeight: "800" },
  greetingSub: { fontSize: 13, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginLeft: 12 },

  // Vitrin bölümü: başlık + kart, ekranın %90'ı (Oyunlar/Wrapped ile aynı genişlik).
  section: { width: "90%", marginBottom: 20 },
  sectionHeader: { marginTop: 0, marginBottom: 10, paddingHorizontal: 10 },
});
