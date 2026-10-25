// screens/tabs/DiscoverScreen.js
//
// Film + Dizi TEK sekme. Alt çubukta iki ayrı sekme (Diziler, Filmler) vardı; artık
// tek "Film & Dizi" sekmesi ve ekranın tepesinde yüzen bir cam anahtar (MediaTypeSwitch)
// ikisi arasında geçirir. Alt çubuktaki yer yapay zeka düğmesine kaldı.
//
// KEŞFET: anahtarın SOLUNDA tek simgeli yuvarlak cam düğme (DiscoverExploreAction) durur; "Ne izlesem?"
// ekranını açar (süre/puan/tür/platform süzgeçleri, hazır süzgeçler, Şaşırt beni). Eskiden listenin başında
// çok yer kaplayan bir kart vardı. Düğme ile arama düğmesi anahtarın iki yanında SİMETRİK; dar ekranda
// (320–367 pt) üçü birden sığsın diye anahtarın bölmeleri daralır (utils/discoverHeaderLayout.js).
//
// ARAMA: anahtarın hemen yanında yuvarlak cam bir düğme (DiscoverSearchAction) durur. Eskiden
// listelerin başında tam genişlikte iki ayrı arama hapı vardı; ikisi aynı arama ekranını
// (UnifiedSearch) açtığı için tek düğme anahtarla aynı satıra alındı ve seçili bölümün
// türüyle (Dizi/Film) açar.
//
// İKİ SAYFA, BİRBİRİNİ SÖKMEZ: Dizi ve Film listeleri aynı ekranda yan yana kurulur,
// görünmeyen `display: "none"` olur. Anahtarla geçince kaydırma konumu, yüklenmiş
// raflar ve çekerek-yenile durumu korunur (eski iki sekmede de böyleydi). Sayfalar
// opaklıkla SOLDURULMAZ: raflardaki cam yüzeylerin atalarında `opacity` animasyonu
// olmamalı (components/common/GlassSurface.js, kural 1) — geçiş anidir, anahtardaki
// vurgu hapı yaylanarak kayar.
//
// AÇILIŞ MALİYETİ AYNI: yalnız görünen bölüm kurulur; öteki bölüm eskiden diğer
// sekmelerle aynı gecikmeyle (AdaptiveTabShell, ~6 sn sonra) arka planda ısıtılır,
// yoksa ilk geçişte anahtar boş sayfa gösterirdi. Son seçilen bölüm saklanır
// (Keys.homeMediaType) ve uygulama onunla açılır.
//
// iOS SEKME ÇUBUĞU KAYDIRMA İŞARETLEYİCİSİ: iki liste de TabScrollMarker ile sarılı;
// UIKit yalnız SON kaydıranı tanır. `display: none` sayfa yerel ağaçtan çıkıp geri
// gelince işaretleyici yeniden kayıt olur — hangisi görünüyorsa o (cihazda doğrulanmadı;
// kayıt yanlış listeye düşerse yalnız sistemin kenar efekti etkilenir, çubuk ölçeği
// JS'ten sürülür ve iki listede de çalışır).
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { InteractionManager, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withTiming } from "react-native-reanimated";
import TvShowScreen from "./TvShowScreen";
import MovieScreen from "./MovieScreen";
import MediaTypeSwitch, { MEDIA_SWITCH_HEIGHT } from "../../components/home/MediaTypeSwitch";
import DiscoverSearchAction, { discoverSearchActionSize } from "../../components/home/DiscoverSearchAction";
import DiscoverExploreAction from "../../components/home/DiscoverExploreAction";
import { DISCOVER_TOP_MIN } from "../../components/home/DiscoverHeaderSpacer";
import { MovieProvider } from "../../context/MovieContex";
import { useLanguage } from "../../context/LanguageContext";
import { useTabBarLayout } from "../../context/TabBarLayoutContext";
import { useTheme } from "../../context/ThemeContext";
import useReduceMotion from "../../hooks/useReduceMotion";
import { useGlassShape } from "../../services/liquidGlass";
import { Keys, get, set } from "../../services/storage";
import { getDiscoverFiltersCopy } from "../shared/discoverFiltersCopy";
import { ROW_GAP, discoverRowLayout } from "../../utils/discoverHeaderLayout";
import { MEDIA_TYPES, normalizeMediaType } from "../../utils/discoverMedia";
import { TAB_BAR_SCROLL_UNSET } from "../../utils/tabBarCollapse";
import { tabTitleTopSpacing } from "../../utils/screenTopSpacing";

/** Öteki bölümün arka planda kurulacağı gecikme (diğer sekmelerin ısınmasıyla aynı). */
export const WARM_OTHER_MEDIA_MS = 6000;
/**
 * Yüzen satır (keşfet düğmesi + anahtar + arama düğmesi) ile listenin ilk rafı arasındaki boşluk. Cam OLMAYAN
 * yolda anahtarın 1 px çerçevesi 2 px ekler, o yüzden orada boşluk 10, camda 12 olur.
 */
const SWITCH_GAP = 12;
/** Anahtar ile düğmeler arasındaki yatay boşluk (utils/discoverHeaderLayout.js ROW_GAP ile aynı). */
const ACTION_GAP = ROW_GAP;
/** Listelerin başlığına bırakılan yer: satırın yüksekliği + boşluk. */
export const DISCOVER_HEADER_OFFSET = MEDIA_SWITCH_HEIGHT + SWITCH_GAP;

export default function DiscoverScreen({ navigation }) {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  // Arama/keşfet dairesinin çapı cam ŞEKLİNE bağlı (gerçek cam + Android buzlu cam).
  const glassShape = useGlassShape();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { tabBarCollapse, tabBarLastScrollY } = useTabBarLayout();

  // Son seçilen bölüm (MMKV senkron okuma): ilk karede doğru sayfa kurulur.
  const [mediaType, setMediaType] = useState(() => normalizeMediaType(get(Keys.homeMediaType)));
  // Kurulmuş sayfalar. Bir kez kurulan sayfa bir daha sökülmez.
  const [mounted, setMounted] = useState(() => new Set([mediaType]));

  useEffect(() => {
    let timer;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        setMounted((current) => (current.size === MEDIA_TYPES.length ? current : new Set(MEDIA_TYPES)));
      }, WARM_OTHER_MEDIA_MS);
    });
    return () => {
      task.cancel?.();
      clearTimeout(timer);
    };
  }, []);

  const labels = useMemo(() => ({ tv: t.tvShows, movie: t.movies }), [t.tvShows, t.movies]);
  // Arama düğmesinin erişilebilirlik etiketi seçili bölümü söyler ("Dizi Ara" / "Film Ara").
  const searchLabel = mediaType === "tv" ? t.SearchScreen?.searchTvShows : t.SearchScreen?.searchMovies;
  const exploreLabel = getDiscoverFiltersCopy(language).ui.title;
  // Dar ekranda üçü birden sığsın diye anahtarın bölme genişliği (ve kompakt kip) ekrana göre.
  const row = useMemo(
    () => discoverRowLayout({ width, buttonSize: discoverSearchActionSize(glassShape), switchHeight: MEDIA_SWITCH_HEIGHT }),
    [width, glassShape],
  );

  const handleChange = useCallback(
    (next) => {
      const type = normalizeMediaType(next);
      setMediaType(type);
      setMounted((current) => (current.has(type) ? current : new Set(current).add(type)));
      set(Keys.homeMediaType, type);
      // Sekme değişiminde olduğu gibi (AdaptiveTabShell): her sayfanın kaydırma
      // konumu ayrı; öncekinin konumunu delta sanıp çubuğu birden kapatmasın.
      tabBarLastScrollY.value = TAB_BAR_SCROLL_UNSET;
      tabBarCollapse.value = reduceMotion ? 0 : withTiming(0, { duration: 200 });
    },
    [reduceMotion, tabBarCollapse, tabBarLastScrollY],
  );

  const switchTop = tabTitleTopSpacing(insets.top, { min: DISCOVER_TOP_MIN });

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      {mounted.has("tv") && (
        <View style={mediaType === "tv" ? styles.page : styles.hidden} testID="discover-page-tv">
          <TvShowScreen navigation={navigation} headerTopOffset={DISCOVER_HEADER_OFFSET} />
        </View>
      )}
      {mounted.has("movie") && (
        <View style={mediaType === "movie" ? styles.page : styles.hidden} testID="discover-page-movie">
          <MovieProvider>
            <MovieScreen navigation={navigation} headerTopOffset={DISCOVER_HEADER_OFFSET} />
          </MovieProvider>
        </View>
      )}
      {/* Listelerin ÜSTÜNDE yüzer; kenarlardaki boş alan dokunuşu listeye geçirir. */}
      <View pointerEvents="box-none" style={[styles.switchLayer, { top: switchTop }]}>
        <DiscoverExploreAction navigation={navigation} mediaType={mediaType} label={exploreLabel} />
        <MediaTypeSwitch value={mediaType} onChange={handleChange} labels={labels} segmentWidth={row.segmentWidth} />
        <DiscoverSearchAction navigation={navigation} mediaType={mediaType} label={searchLabel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { ...StyleSheet.absoluteFill },
  hidden: { ...StyleSheet.absoluteFill, display: "none" },
  // Keşfet düğmesi + anahtar + arama düğmesi yan yana, ortalı. Düğmeler anahtarın yüksekliğinde (cam: 46,
  // eski yol: 48); `alignItems: "center"` üçünü aynı eksende tutar.
  switchLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ACTION_GAP,
  },
});
