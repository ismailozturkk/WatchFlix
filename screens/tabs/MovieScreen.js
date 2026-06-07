import {
  FlatList,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  Pressable,
} from "react-native";
import React, { useCallback, useMemo, useState } from "react";

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
import { useMovie } from "../../context/MovieContex";
import { useSnowSettings } from "../../context/AppSettingsContext";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import IconBacground from "../../components/IconBacground";

const INITIAL_SECTION_COUNT = 3;

export default function MovieScreen({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const { showSnow } = useSnowSettings();
  const [refreshing, setRefreshing] = useState(false);

  const {
    fetchSeriesTrends,
    fetchMoviesBests,
    fetchMoviesOscar,
    fetchMoviesCollection,
    fetchProviders,
    fetchMoviesByGenres,
    fetchMovieUpcoming,
    fetchMoviNowPlaying,
  } = useMovie();

  const sections = useMemo(
    () => [
      { key: "trends", Component: MovieTrends },
      { key: "bests", Component: MovieBests },
      { key: "nowPlaying", Component: MovieNowPlaying },
      { key: "oscar", Component: MovieOscar },
      { key: "collection", Component: MovieCollection },
      { key: "providers", Component: MovieProviders },
      { key: "genres", Component: MovieGenres },
      { key: "upcoming", Component: MovieUpcoming },
    ],
    [],
  );

  const [visibleSectionCount, setVisibleSectionCount] = useState(
    Math.min(INITIAL_SECTION_COUNT, sections.length),
  );

  const visibleSections = useMemo(
    () => sections.slice(0, visibleSectionCount),
    [sections, visibleSectionCount],
  );

  const renderSection = useCallback(
    ({ item }) => {
      const SectionComponent = item.Component;
      return <SectionComponent navigation={navigation} />;
    },
    [navigation],
  );

  const renderHeader = useCallback(
    () => (
      <Pressable
        onPress={() =>
          navigation.navigate("MovieSearch", { autoFocus: true })
        }
        style={styles.fakeSearchContainer}
      >
        <View
          style={[styles.searchInput, { backgroundColor: theme.secondary }]}
          placeholderTextColor={theme.text.muted}
          placeholder={t.SearchScreen.searchMovies}
        >
          <Ionicons name="search" size={20} color={theme.text.muted} />
          <Text allowFontScaling={false} style={{ color: theme.text.muted }}>
            {t.searchMovies}
          </Text>
        </View>
      </Pressable>
    ),
    [navigation, t.SearchScreen.searchMovies, t.searchMovies, theme.secondary, theme.text.muted],
  );

  const revealNextSection = useCallback(() => {
    setVisibleSectionCount((current) =>
      Math.min(current + 1, sections.length),
    );
  }, [sections.length]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const refreshTasks = visibleSections
        .map(({ key }) => {
          switch (key) {
            case "trends":
              return fetchSeriesTrends();
            case "bests":
              return fetchMoviesBests();
            case "nowPlaying":
              return fetchMoviNowPlaying();
            case "oscar":
              return fetchMoviesOscar();
            case "collection":
              return fetchMoviesCollection();
            case "providers":
              return fetchProviders();
            case "genres":
              return fetchMoviesByGenres();
            case "upcoming":
              return fetchMovieUpcoming();
            default:
              return null;
          }
        })
        .filter(Boolean);
      await Promise.allSettled(refreshTasks);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={[{ backgroundColor: theme.primary, flex: 1 }]}>
      <IconBacground opacity={0.3} />
      <FlatList
        data={visibleSections}
        keyExtractor={(item) => item.key}
        renderItem={renderSection}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
        initialNumToRender={INITIAL_SECTION_COUNT}
        maxToRenderPerBatch={1}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        onEndReached={revealNextSection}
        onEndReachedThreshold={0.6}
        removeClippedSubviews
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      {showSnow && (
        <View style={styles.snowOverlay} pointerEvents="none">
          <LottieView
            style={{ flex: 1 }}
            source={require("../../LottieJson/snow.json")}
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
});
