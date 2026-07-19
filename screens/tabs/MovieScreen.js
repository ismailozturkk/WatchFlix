import {
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
  Pressable,
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
import LottieView from "lottie-react-native";
import MovieBests from "../movie/MovieBests";
import MovieTrends from "../movie/MovieTrends";
import MovieCollection from "../movie/MovieCollection";
import { useSnowSettings } from "../../context/AppSettingsContext";
import { useLanguage } from "../../context/LanguageContext";
import AppIcon from "../../components/AppIcon";
import IconBacground from "../../components/IconBacground";
import usePullToSearch from "../../hooks/usePullToSearch";
import DiscoveryMediaRail from "../../components/DiscoveryMediaRail";
import { useStreamingProviderSettings } from "../../context/AppSettingsContext";
import { useProfileStats } from "../../context/ProfileStatsContext";

const INITIAL_SECTION_COUNT = 2;

export default function MovieScreen({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const { showSnow } = useSnowSettings();
  const { streamingProviderIds } = useStreamingProviderSettings();
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
    [streamingProviderIds, topMovieGenres],
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
        />
      );
    },
    [navigation],
  );

  const renderHeader = useCallback(
    () => (
      <Pressable
        onPress={openSearch}
        style={styles.fakeSearchContainer}
      >
        <Animated.View
          ref={searchInputRef}
          collapsable={false}
          style={[
            styles.searchInput,
            { backgroundColor: theme.secondary },
            animatedSearchStyle,
          ]}
        >
          <AppIcon family="Ionicons" name="search" size={20} color={theme.text.muted} />
          <TextInput
            editable={false}
            pointerEvents="none"
            style={[styles.searchTextInput, { color: theme.text.muted }]}
            placeholder={t.SearchScreen.searchMovies}
            placeholderTextColor={theme.text.muted}
          />
        </Animated.View>
      </Pressable>
    ),
    [animatedSearchStyle, openSearch, t.SearchScreen.searchMovies, theme.secondary, theme.text.muted],
  );

  const revealNextSection = useCallback(() => {
    setVisibleSectionCount((current) =>
      Math.min(current + 1, sections.length),
    );
  }, [sections.length]);

  return (
    <View style={[{ backgroundColor: theme.primary, flex: 1 }]}>
      <IconBacground opacity={0.3} />
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

      {showSnow && (
        <View style={styles.snowOverlay} pointerEvents="none">
          <LottieView
            style={{ flex: 1 }}
            source={require("@lottie/snow.json")}
            autoPlay
            loop
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 75,
  },
  snowOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  fakeSearchContainer: {
    paddingTop: 50,
    paddingHorizontal: 15,
    zIndex: 10, // Listenin üstünde kalması için
  },
  searchInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    gap: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  searchTextInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 14,
  },
});
