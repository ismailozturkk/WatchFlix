import {
  RefreshControl,
  StyleSheet,
  Pressable,
  TextInput,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import TvShowsOnTheAir from "../tv/TvShowsOnTheAir";
import TvShowsAiringToday from "../tv/TvShowsAiringToday";
import TvShowsGenres from "../tv/TvShowsGenres";
import TvShowsProvders from "../tv/TvShowsProvders";
import TvShowsTrends from "../tv/TvShowsTrends";
import TvShowBests from "../tv/TvShowBests";
import TvOngoingSection from "../tv/TvOngoingSection";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useTvShow } from "../../context/TvShowContex";
import { DeviceEventEmitter } from "react-native";
import {
  useOngoingTvShowsSettings,
} from "../../context/AppSettingsContext";
import { useLanguage } from "../../context/LanguageContext";
import AppIcon from "../../components/AppIcon";
import ScreenDecor from "../../components/ScreenDecor";
import usePullToSearch from "../../hooks/usePullToSearch";
import DiscoveryMediaRail from "../../components/DiscoveryMediaRail";
import { useStreamingProviderSettings } from "../../context/AppSettingsContext";
import { useProfileStats } from "../../context/ProfileStatsContext";

const INITIAL_SECTION_COUNT = 2;

export default function TvShowScreen({ navigation }) {
  const { theme } = useTheme();
  const { showOngoingTvShows } = useOngoingTvShowsSettings();
  const { streamingProviderIds } = useStreamingProviderSettings();
  const { topTvGenres } = useProfileStats();
  const { t } = useLanguage();
  const { loadingTrend } = useTvShow();
  const searchInputRef = useRef(null);
  const openSearch = useCallback(() => {
    const navigateToSearch = (searchOrigin) => {
      navigation.navigate("UnifiedSearch", {
        initialType: "tv",
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

  useEffect(() => {
    if (!loadingTrend) {
      DeviceEventEmitter.emit("APP_READY");
    }
  }, [loadingTrend]);

  const sections = useMemo(() => {
    const items = [
      { key: "trends", Component: TvShowsTrends },
      showOngoingTvShows
        ? { key: "ongoing", Component: TvOngoingSection }
        : null,
      { key: "best", Component: TvShowBests },
      ...(streamingProviderIds.length > 0
        ? [{ key: "subscriptions", Component: DiscoveryMediaRail, preset: "subscriptions" }]
        : []),
      ...(topTvGenres?.length === 3
        ? [{ key: "topGenres", Component: DiscoveryMediaRail, preset: "topGenres", genreNames: topTvGenres }]
        : []),
      { key: "recentFavorites", Component: DiscoveryMediaRail, preset: "recentFavorites" },
      { key: "hiddenGems", Component: DiscoveryMediaRail, preset: "hiddenGems" },
      { key: "providers", Component: TvShowsProvders },
      { key: "genres", Component: TvShowsGenres },
      { key: "onTheAir", Component: TvShowsOnTheAir },
      { key: "airingToday", Component: TvShowsAiringToday },
    ];

    return items.filter(Boolean);
  }, [showOngoingTvShows, streamingProviderIds, topTvGenres]);

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
            placeholder={t.SearchScreen.searchTvShows}
            placeholderTextColor={theme.text.muted}
          />
        </Animated.View>
      </Pressable>
    ),
    [animatedSearchStyle, openSearch, t.SearchScreen.searchTvShows, theme.secondary, theme.text.muted],
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
    zIndex: 10,
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
