import {
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import Animated from "react-native-reanimated";

//import {  } from "react-native-safe-area-context";
import MovieOscar from "../movie/MovieOscar";
import MovieProviders from "../movie/MovieProvders";
import MovieNowPlaying from "../movie/MovieNowPlaying";
import MovieGenres from "../movie/MovieGenres";
import MovieUpcoming from "../movie/MovieUpcoming";
import { useTheme } from "../../context/ThemeContext";
import MovieBests from "../movie/MovieBests";
import MovieTrends from "../movie/MovieTrends";
import MovieCollection from "../movie/MovieCollection";
import { useLanguage } from "../../context/LanguageContext";
import ScreenDecor from "../../components/ScreenDecor";
import DiscoverSearchButton from "../../components/home/DiscoverSearchButton";
import usePullToSearch from "../../hooks/usePullToSearch";
import DiscoveryMediaRail from "../../components/DiscoveryMediaRail";
import {
  useDiscoveryPreferenceSettings,
  useStreamingProviderSettings,
} from "../../context/AppSettingsContext";
import { useProfileStats } from "../../context/ProfileStatsContext";
import { resolveOnboardingGenreIds } from "../../utils/onboardingPreferences";

const INITIAL_SECTION_COUNT = 2;

export default function MovieScreen({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();

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
  const { animatedSearchStyle, onScroll, triggerSearch } =
    usePullToSearch(openSearch);

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
      <View style={styles.fakeSearchContainer}>
        <DiscoverSearchButton
          ref={searchInputRef}
          onPress={openSearch}
          placeholder={t.SearchScreen.searchMovies}
          animatedStyle={animatedSearchStyle}
        />
      </View>
    ),
    [animatedSearchStyle, openSearch, t.SearchScreen.searchMovies],
  );

  const revealNextSection = useCallback(() => {
    setVisibleSectionCount((current) =>
      Math.min(current + 1, sections.length),
    );
  }, [sections.length]);

  return (
    <View style={[{ backgroundColor: theme.primary, flex: 1 }]}>
      <ScreenDecor iconOpacity={0.3} />
      <Animated.FlatList
        data={visibleSections}
        keyExtractor={(item) => item.key}
        renderItem={renderSection}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
        initialNumToRender={INITIAL_SECTION_COUNT}
        onEndReached={revealNextSection}
        onEndReachedThreshold={0.6}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={triggerSearch}
            colors={["transparent"]}
            progressBackgroundColor="transparent"
            tintColor="transparent"
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
    paddingTop: 50,
    paddingHorizontal: 15,
    zIndex: 10, // Listenin üstünde kalması için
  },
});
