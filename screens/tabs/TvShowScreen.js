import {
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { useTabBarLayout } from "../../context/TabBarLayoutContext";
import TvShowsOnTheAir from "../tv/TvShowsOnTheAir";
import TvShowsAiringToday from "../tv/TvShowsAiringToday";
import TvShowsGenres from "../tv/TvShowsGenres";
import TvShowsProvders from "../tv/TvShowsProvders";
import TvShowsTrends from "../tv/TvShowsTrends";
import TvShowBests from "../tv/TvShowBests";
import TvShowsEmmy from "../tv/TvShowsEmmy";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useTvShow } from "../../context/TvShowContex";
import { DeviceEventEmitter } from "react-native";
import ScreenDecor from "../../components/ScreenDecor";
import DiscoverHeaderSpacer from "../../components/home/DiscoverHeaderSpacer";
import SectionsHiddenNotice from "../../components/home/SectionsHiddenNotice";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import useScreenSections from "../../hooks/useSectionVisibility";
import { markTabScroll } from "../../components/navigation/TabScrollMarker";
import DiscoveryMediaRail from "../../components/DiscoveryMediaRail";
import { useStreamingProviderSettings } from "../../context/AppSettingsContext";
import { useDiscoveryPreferenceSettings } from "../../context/AppSettingsContext";
import { useProfileStats } from "../../context/ProfileStatsContext";
import { resolveOnboardingGenreIds } from "../../utils/onboardingPreferences";
import FavoritesRecommendationRail from "../../components/favorites/FavoritesRecommendationRail";
import FollowedUpcomingRail from "../../components/person/FollowedUpcomingRail";
import useFollowedPeople from "../../hooks/useFollowedPeople";
import { useUserProfile } from "../../context/UserProfileContext";
import { hasRecommendationSignal, readProfileFavorites } from "../../utils/fourFavorites";

const INITIAL_SECTION_COUNT = 2;

// iOS sekme çubuğunun "aşağı kaydırınca küçül" davranışı için listeyi sekme
// ekranına tanıtır (bkz. components/navigation/TabScrollMarker.js). Modül
// kapsamında: render içinde kurulursa liste her render'da sökülür.
const MarkedFlatList = markTabScroll(Animated.FlatList);

// `headerTopOffset`: ekranın tepesinde yüzen satırın (Film/Dizi anahtarı + arama düğmesi)
// yüksekliği (screens/tabs/DiscoverScreen.js); ilk raf onun altından başlar.
export default function TvShowScreen({ navigation, headerTopOffset = 0 }) {
  const { contentBottom } = useTabBarLayout();
  const { theme } = useTheme();
  const { streamingProviderIds } = useStreamingProviderSettings();
  const { onboardingGenreKeys } = useDiscoveryPreferenceSettings();
  const onboardingGenreIds = useMemo(
    () => resolveOnboardingGenreIds(onboardingGenreKeys, "tv"),
    [onboardingGenreKeys],
  );
  const { topTvGenres } = useProfileStats();
  // Dört favoriden (dizi + oyuncu) öneri kaynağı var mı? Boolean: profildeki
  // ilgisiz değişiklikler bölüm listesini yeniden kurmaz.
  const { profile } = useUserProfile();
  const hasFavoriteSignal = useMemo(
    () => hasRecommendationSignal(readProfileFavorites(profile), "tv"),
    [profile],
  );
  // Takip edilen kişi var mı? Yoksa raf bölüm listesine hiç girmez (boş bölüm sayacı şişirmesin).
  const { count: followedCount } = useFollowedPeople();
  const { loadingTrend, refreshAllTvShows } = useTvShow();
  const { refreshing, onScroll, handleRefresh } =
    usePullToRefresh(refreshAllTvShows);
  // Ayarlar > Kişiselleştirme > Ekran bölümleri'nde gizlenen raflar (utils/sectionVisibility.js).
  const { filter: filterHiddenSections } = useScreenSections("tv");

  useEffect(() => {
    if (!loadingTrend) {
      DeviceEventEmitter.emit("APP_READY");
    }
  }, [loadingTrend]);

  const sections = useMemo(() => {
    const items = [
      { key: "trends", Component: TvShowsTrends },
      { key: "best", Component: TvShowBests },
      ...(followedCount > 0
        ? [{ key: "followedPeople", Component: FollowedUpcomingRail }]
        : []),
      ...(hasFavoriteSignal
        ? [{ key: "fromFavorites", Component: FavoritesRecommendationRail }]
        : []),
      ...(streamingProviderIds.length > 0
        ? [{ key: "subscriptions", Component: DiscoveryMediaRail, preset: "subscriptions" }]
        : []),
      ...(topTvGenres?.length === 3
        ? [{ key: "topGenres", Component: DiscoveryMediaRail, preset: "topGenres", genreNames: topTvGenres }]
        : onboardingGenreIds.length > 0
          ? [{ key: "topGenres", Component: DiscoveryMediaRail, preset: "topGenres", genreIds: onboardingGenreIds }]
          : []),
      { key: "recentFavorites", Component: DiscoveryMediaRail, preset: "recentFavorites" },
      { key: "worldTour", Component: DiscoveryMediaRail, preset: "worldTour" },
      { key: "emmy", Component: TvShowsEmmy },
      { key: "providers", Component: TvShowsProvders },
      { key: "genres", Component: TvShowsGenres },
      { key: "onTheAir", Component: TvShowsOnTheAir },
      { key: "airingToday", Component: TvShowsAiringToday },
    ];

    // Raf kimlikleri (`key`) utils/sectionVisibility.js'teki "tv" bölümleriyle aynı.
    // Devam eden diziler rafı buradan kalktı: Kütüphane sekmesindeki "Sıradaki" taşıyor.
    return filterHiddenSections(items.filter(Boolean));
  }, [filterHiddenSections, followedCount, hasFavoriteSignal, onboardingGenreIds, streamingProviderIds, topTvGenres]);

  const [visibleSectionCount, setVisibleSectionCount] = useState(INITIAL_SECTION_COUNT);

  const visibleSections = useMemo(
    () => sections.slice(0, visibleSectionCount),
    [sections, visibleSectionCount],
  );

  const renderSection = useCallback(
    ({ item }) => {
      const SectionComponent = item.Component;
      return (
        <SectionComponent
          navigation={navigation}
          mediaType="tv"
          preset={item.preset}
          genreNames={item.genreNames}
          genreIds={item.genreIds}
        />
      );
    },
    [navigation],
  );

  // Liste başlığı: yüzen Film/Dizi satırının (anahtar + arama düğmesi) altında kalan boşluk.
  // ELEMENT olarak verilir (geri çağrı değil): FlatList fonksiyonu bileşen tipi sayar,
  // kimliği değişince başlık sökülüp yeniden kurulur.
  const listHeader = useMemo(
    () => <DiscoverHeaderSpacer topOffset={headerTopOffset} />,
    [headerTopOffset],
  );

  const revealNextSection = useCallback(() => {
    setVisibleSectionCount((current) =>
      Math.min(current + 1, sections.length),
    );
  }, [sections.length]);

  // Tüm raflar gizliyse (ya da kalanlar veri/ayar yüzünden çizilmiyorsa) boş ekran yerine
  // nedenini söyleyen kart. ELEMENT olarak verilir (geri çağrı değil), başlıktaki gibi.
  const emptyNotice = useMemo(
    () => <SectionsHiddenNotice navigation={navigation} screen="tv" />,
    [navigation],
  );

  return (
    <View style={[{ backgroundColor: theme.primary, flex: 1 }]}>
      <ScreenDecor scope="home" iconOpacity={0.3} />
      <MarkedFlatList
        data={visibleSections}
        keyExtractor={(item) => item.key}
        renderItem={renderSection}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyNotice}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.container, { paddingBottom: contentBottom }]}
        initialNumToRender={INITIAL_SECTION_COUNT}
        onEndReached={revealNextSection}
        onEndReachedThreshold={0.6}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.accent || "#E50914"]}
            tintColor={theme.accent || "#E50914"}
          />
        }
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 75,
  },
});
