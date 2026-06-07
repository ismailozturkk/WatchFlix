import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Pressable,
  Text,
  View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import LottieView from "lottie-react-native";
import TvShowsOnTheAir from "../tv/TvShowsOnTheAir";
import TvShowsAiringToday from "../tv/TvShowsAiringToday";
import TvShowsGenres from "../tv/TvShowsGenres";
import TvShowsProvders from "../tv/TvShowsProvders";
import TvShowsTrends from "../tv/TvShowsTrends";
import TvShowBests from "../tv/TvShowBests";
import TvOngoingSection from "../tv/TvOngoingSection";
import { useCallback, useMemo, useState } from "react";
import { useTvShow } from "../../context/TvShowContex";
import {
  useOngoingTvShowsSettings,
  useSnowSettings,
} from "../../context/AppSettingsContext";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import IconBacground from "../../components/IconBacground";

const INITIAL_SECTION_COUNT = 3;

export default function TvShowScreen({ navigation }) {
  const { theme } = useTheme();
  const { showSnow } = useSnowSettings();
  const { showOngoingTvShows } = useOngoingTvShowsSettings();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);

  const {
    fetchSeriesTrends,
    fetchSeriesBest,
    fetchAiringToday,
    fetchProviders,
    fetchTvByGenres,
    fetchOnTheAir,
  } = useTvShow();

  const sections = useMemo(() => {
    const items = [
      { key: "trends", Component: TvShowsTrends },
      showOngoingTvShows
        ? { key: "ongoing", Component: TvOngoingSection }
        : null,
      { key: "best", Component: TvShowBests },
      { key: "providers", Component: TvShowsProvders },
      { key: "genres", Component: TvShowsGenres },
      { key: "onTheAir", Component: TvShowsOnTheAir },
      { key: "airingToday", Component: TvShowsAiringToday },
    ];

    return items.filter(Boolean);
  }, [showOngoingTvShows]);

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
          navigation.navigate("TvShowSearch", { autoFocus: true })
        }
        style={styles.fakeSearchContainer}
      >
        <View
          style={[styles.searchInput, { backgroundColor: theme.secondary }]}
          placeholderTextColor={theme.text.muted}
          placeholder={t.SearchScreen.searchTvShows}
        >
          <Ionicons name="search" size={20} color={theme.text.muted} />
          <Text allowFontScaling={false} style={{ color: theme.text.muted }}>
            {t.SearchScreen.searchTvShows}
          </Text>
        </View>
      </Pressable>
    ),
    [navigation, t.SearchScreen.searchTvShows, theme.secondary, theme.text.muted],
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
            case "best":
              return fetchSeriesBest();
            case "providers":
              return fetchProviders();
            case "genres":
              return fetchTvByGenres();
            case "onTheAir":
              return fetchOnTheAir();
            case "airingToday":
              return fetchAiringToday();
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
});
