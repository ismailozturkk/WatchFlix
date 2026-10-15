import {
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MovieOscar from "../movie/MovieOscar";
import MovieProviders from "../movie/MovieProvders";
import MovieNowPlaying from "../movie/MovieNowPlaying";
import MovieGenres from "../movie/MovieGenres";
import MovieUpcoming from "../movie/MovieUpcoming";
import { useTheme } from "../../context/ThemeContext";
import { useTabBarLayout } from "../../context/TabBarLayoutContext";
import MovieBests from "../movie/MovieBests";
import MovieTrends from "../movie/MovieTrends";
import MovieCollection from "../movie/MovieCollection";
import { useLanguage } from "../../context/LanguageContext";
import { useMovie } from "../../context/MovieContex";
import ScreenDecor from "../../components/ScreenDecor";
import DiscoverSearchButton from "../../components/home/DiscoverSearchButton";
import usePullToRefresh from "../../hooks/usePullToRefresh";
import { markTabScroll } from "../../components/navigation/TabScrollMarker";
import DiscoveryMediaRail from "../../components/DiscoveryMediaRail";
import {
  useDiscoveryPreferenceSettings,
  useStreamingProviderSettings,
} from "../../context/AppSettingsContext";
import { useProfileStats } from "../../context/ProfileStatsContext";
import { resolveOnboardingGenreIds } from "../../utils/onboardingPreferences";

const INITIAL_SECTION_COUNT = 2;

// Arama çubuğunun üst boşluğu: güvenli alanın en az SEARCH_TOP_GAP altında,
// ama eski değerin (50) hiçbir cihazda üstüne çıkmadan.
const SEARCH_TOP_PADDING_MIN = 50;
const SEARCH_TOP_GAP = 16;

// iOS sekme çubuğunun "aşağı kaydırınca küçül" davranışı için listeyi sekme
// ekranına tanıtır (bkz. components/navigation/TabScrollMarker.js). Modül
// kapsamında: render içinde kurulursa liste her render'da sökülür.
const MarkedFlatList = markTabScroll(Animated.FlatList);

export default function MovieScreen({ navigation }) {
  const { contentBottom } = useTabBarLayout();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { refreshAllMovies } = useMovie();
  // Ekran kenardan kenara; arama çubuğu durum çubuğuna/çentiğe yapışmasın diye
  // üst boşluk güvenli alana bağlı (eski sabit 50, Dynamic Island'da yetmiyordu).
  const insets = useSafeAreaInsets();
  const searchTopPadding = Math.max(SEARCH_TOP_PADDING_MIN, insets.top + SEARCH_TOP_GAP);

  const { streamingProviderIds } = useStreamingProviderSettings();
  const { onboardingGenreKeys } = useDiscoveryPreferenceSettings();
  const onboardingGenreIds = useMemo(
    () => resolveOnboardingGenreIds(onboardingGenreKeys, "movie"),
    [onboardingGenreKeys],
  );
  const { topMovieGenres } = useProfileStats();
  const searchInputRef = useRef(null);
  const openSearch = useCallback(() => {
    const navigateToSearch = (searchOrigin) => {
      navigation.navigate("UnifiedSearch", {
        initialType: "movie",
        autoFocus: true,
        searchOrigin,
      });
    };

    if (searchInputRef.current?.measureInWindow) {
      searchInputRef.current.measureInWindow((x, y, width, height) => {
        navigateToSearch({ x, y, width, height });
      });
      return;
    }

    navigateToSearch(undefined);
  }, [navigation]);
  const { refreshing, animatedSearchStyle, onScroll, handleRefresh } =
    usePullToRefresh(refreshAllMovies);

  const sections = useMemo(
    () => [
      { key: "trends", Component: MovieTrends },
      { key: "bests", Component: MovieBests },
      ...(streamingProviderIds.length > 0
        ? [{ key: "subscriptions", Component: DiscoveryMediaRail, preset: "subscriptions" }]
        : []),
      ...(topMovieGenres?.length === 3
        ? [{ key: "topGenres", Component: DiscoveryMediaRail, preset: "topGenres", genreNames: topMovieGenres }]
        : onboardingGenreIds.length > 0
          ? [{ key: "topGenres", Component: DiscoveryMediaRail, preset: "topGenres", genreIds: onboardingGenreIds }]
          : []),
      { key: "recentFavorites", Component: DiscoveryMediaRail, preset: "recentFavorites" },
      { key: "hiddenGems", Component: DiscoveryMediaRail, preset: "hiddenGems" },
      { key: "nowPlaying", Component: MovieNowPlaying },
      { key: "oscar", Component: MovieOscar },
      { key: "collection", Component: MovieCollection },
      { key: "providers", Component: MovieProviders },
      { key: "genres", Component: MovieGenres },
      { key: "upcoming", Component: MovieUpcoming },
    ],
    [onboardingGenreIds, streamingProviderIds, topMovieGenres],
  );

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
          mediaType="movie"
          preset={item.preset}
          genreNames={item.genreNames}
          genreIds={item.genreIds}
        />
      );
    },
    [navigation],
  );

  const renderHeader = useCallback(
    () => (
      <View style={[styles.fakeSearchContainer, { paddingTop: searchTopPadding }]}>
        <DiscoverSearchButton
          ref={searchInputRef}
          onPress={openSearch}
          placeholder={t.SearchScreen.searchMovies}
          animatedStyle={animatedSearchStyle}
        />
      </View>
    ),
    [animatedSearchStyle, openSearch, searchTopPadding, t.SearchScreen.searchMovies],
  );

  const revealNextSection = useCallback(() => {
    setVisibleSectionCount((current) =>
      Math.min(current + 1, sections.length),
    );
  }, [sections.length]);

  return (
    <View style={[{ backgroundColor: theme.primary, flex: 1 }]}>
      <ScreenDecor scope="home" iconOpacity={0.3} />
      <MarkedFlatList
        data={visibleSections}
        keyExtractor={(item) => item.key}
        renderItem={renderSection}
        ListHeaderComponent={renderHeader}
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
  fakeSearchContainer: {
    // paddingTop render'da güvenli alana göre verilir (searchTopPadding).
    paddingHorizontal: 15,
    zIndex: 10, // Listenin üstünde kalması için
  },
});
