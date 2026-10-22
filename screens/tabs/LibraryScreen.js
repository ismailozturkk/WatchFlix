// screens/tabs/LibraryScreen.js
//
// "Kütüphane" sekmesi: günlük işler tek yerde. Eskiden Ayarlar'ın durduğu sekme yeri;
// Ayarlar artık Profil'in sağ üstündeki dişli düğmesinden açılıyor (ProfileScreen).
//
// İçerik, olduğu gibi TAŞINMIŞ bileşenlerdir — tasarımları değişmedi:
//   1. Sıradaki       — TV ana ekranındaki "Devam Edenler" rafı (screens/tv/TvOngoingSection)
//   2. Listeler       — Profil'den (screens/tabs/profile/ProfileLists)
//   3. Hatırlatmalar  — Profil'den (RemindersPreviewButton: yaklaşanlar + Takvim girişi)
//   4. Notlar         — Profil'den (NotesCard)
//   5. Wrapped        — Eğlence (Hub) sekmesinden (components/hub/HubWrappedModule)
//
// BÖLÜM GÖRÜNÜRLÜĞÜ: Ayarlar > Kişiselleştirme > Ekran bölümleri > Kütüphane
// (utils/sectionVisibility.js "library"). "Sıradaki" TV rafıyla AYNI ayarı
// (showOngoingTvShows, Ayarlar > Dil ve içerik) paylaşır — iki doğruluk kaynağı yok.
//
// BOŞ DURUM: yalnız film izleyen ya da henüz dizisi olmayan biri için "Sıradaki" hiç
// çizilmez (TvOngoingSection devam eden dizi yoksa null döner); sayfa Listeler ile açılır.
//
// ÖLÇÜM: sekme `tab_viewed`, raftaki işaretleme `up_next_completed` (surface: "library").
// Sekme önceden ısıtıldığı için rafın "görüntülendi" olayı bu yüzeyde ATILMAZ
// (hooks/useUpNextQueue).
import React, { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenDecor from "../../components/ScreenDecor";
import SectionsHiddenNotice from "../../components/home/SectionsHiddenNotice";
import HubWrappedModule from "../../components/hub/HubWrappedModule";
import { markTabScroll } from "../../components/navigation/TabScrollMarker";
import { useLanguage } from "../../context/LanguageContext";
import { useOngoingTvShowsSettings } from "../../context/AppSettingsContext";
import { useTabBarLayout } from "../../context/TabBarLayoutContext";
import { useTheme } from "../../context/ThemeContext";
import useScreenSections from "../../hooks/useSectionVisibility";
import useTabBarScrollSync from "../../hooks/useTabBarScrollSync";
import { tabTitleTopSpacing } from "../../utils/screenTopSpacing";
import TvOngoingSection from "../tv/TvOngoingSection";
import ProfileLists from "./profile/ProfileLists";
import RemindersPreviewButton from "./profile/RemindersPreviewButton";
import NotesCard from "./profile/NotesCard";

// iOS sekme çubuğunun "aşağı kaydırınca küçül" davranışı için kaydırma görünümünü
// sekme ekranına tanıtır (bkz. components/navigation/TabScrollMarker.js). Modül
// kapsamında: render içinde kurulursa içerik her render'da sökülür.
const MarkedScrollView = markTabScroll(ScrollView);

export default function LibraryScreen({ navigation }) {
  const { contentBottom } = useTabBarLayout();
  const onTabBarScroll = useTabBarScrollSync();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOngoingTvShows } = useOngoingTvShowsSettings();
  // Ayarlar > Kişiselleştirme > Ekran bölümleri'nde gizlenen bölümler. "Sıradaki"
  // (eski tek anahtarlı bölüm) görünürlüğünü showOngoingTvShows'tan alır.
  const { isVisible: show, allHidden } = useScreenSections("library");

  // Wrapped modülü sayfanın alt yarısında: giriş animasyonu mount anında değil,
  // kart ekrana girerken oynamalı. Bayrak yalnız bir kez açılır (state tek
  // sefer değişir), kaydırma başına yeniden çizim yok.
  const [wrappedSeen, setWrappedSeen] = useState(false);
  const wrappedTop = useRef(null); // modülün içerik içindeki y'si
  const viewportH = useRef(0); // ScrollView'ın görünür yüksekliği
  const scrollTop = useRef(0);
  const checkWrappedSeen = useCallback(() => {
    if (wrappedTop.current == null || !viewportH.current) return;
    // Kartın üstünden ~120px içeri girince başlar.
    if (scrollTop.current + viewportH.current > wrappedTop.current + 120) setWrappedSeen(true);
  }, []);
  const handleScroll = useCallback(
    (event) => {
      onTabBarScroll(event);
      scrollTop.current = event?.nativeEvent?.contentOffset?.y ?? 0;
      if (!wrappedSeen) checkWrappedSeen();
    },
    [onTabBarScroll, wrappedSeen, checkWrappedSeen],
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor scope="lists" iconOpacity={0.15} />
      <MarkedScrollView
        contentContainerStyle={{ paddingBottom: contentBottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        onLayout={(e) => {
          viewportH.current = e.nativeEvent.layout.height;
          checkWrappedSeen();
        }}
        scrollEventThrottle={16}
      >
        <Text
          allowFontScaling={false}
          style={[styles.pageTitle, { color: theme.text.primary, marginTop: tabTitleTopSpacing(insets.top) }]}
        >
          {t.library}
        </Text>

        {showOngoingTvShows && <TvOngoingSection navigation={navigation} surface="library" />}
        {show("lists") && <ProfileLists navigation={navigation} />}
        {show("reminders") && <RemindersPreviewButton navigation={navigation} />}
        {show("notes") && <NotesCard navigation={navigation} />}

        {/* Wrapped ve Yıllık Arşiv (Eğlence'den taşındı). Gizliyken hiç çizilmez; yeniden
            gösterilince `onLayout` konumu tazeler (giriş animasyonu bayrağı tek yönlüdür). */}
        {show("wrapped") && (
          <View
            style={styles.wrappedHost}
            onLayout={(e) => {
              wrappedTop.current = e.nativeEvent.layout.y;
              checkWrappedSeen();
            }}
          >
            <HubWrappedModule navigation={navigation} revealed={wrappedSeen} />
          </View>
        )}

        {allHidden && <SectionsHiddenNotice navigation={navigation} screen="library" />}
      </MarkedScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  wrappedHost: { width: "100%" },
  // Sekme başlığı: Ayarlar'ın eski başlığıyla aynı ölçü (bu sekmenin yerini aldı).
  // Üst boşluk güvenli alandan gelir, sabit değil (utils/screenTopSpacing.js).
  pageTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
});
