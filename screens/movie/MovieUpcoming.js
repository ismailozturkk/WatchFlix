import React, { memo, useEffect, useRef } from "react";
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  View,
  Dimensions,
  Animated,
} from "react-native";
import PosterImage from "../../components/PosterImage";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MovieUpComingSkeleton } from "../../components/Skeleton";
import PaginatedRail from "../../components/PaginatedRail";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import { useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
import { useMovie } from "../../context/MovieContex";
import ListBadges from "../../components/ListBadges";
import { CountdownBadge, ReleaseDateBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
import { SeeAllButton } from "../../components/SeeAllHeader";
import { triggerHaptic } from "../../services/hapticsService";

const { width } = Dimensions.get("window");

// Stable, module-scope item component → no remount → no flicker.
const MovieUpcomingCard = memo(function MovieUpcomingCard({ item, navigation, theme, getTmdbUrl, RelaseCount }) {
  const rp = useRailPosterStyle();
  const { posterBadges } = useListLayoutSettings();
  const { openQuickActions } = useMediaQuickActions();
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.9, duration: 200, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }).start();

  return (
    <TouchableOpacity
      style={[styles.similarItem, { width: rp.itemWidth, height: rp.itemHeight }]}
      activeOpacity={0.8}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => navigation.push("MovieDetails", { id: item.id })}
      onLongPress={() =>
        openQuickActions({ item, mediaType: "movie", navigation })
      }
      delayLongPress={350}
    >
      <Animated.View style={[{ transform: [{ scale }] }]}>
        <PosterImage
          path={item.poster_path}
          type="movie"
          size={200}
          style={[
            styles.similarPoster,
            { width: rp.posterWidth, height: rp.posterHeight, borderRadius: rp.radius, shadowColor: theme.shadow },
          ]}
          cachePolicy="memory-disk"
          recyclingKey={`movieupcoming-${item.id}`}
          transition={120}
        />

        {posterBadges?.countdown !== false && (
          <CountdownBadge date={item.release_date} style={POSTER_BADGE_POS.topLeft} />
        )}
        {posterBadges?.releaseDate !== false && (
          <ReleaseDateBadge date={item.release_date} style={POSTER_BADGE_POS.topRight} />
        )}
        <ListBadges
          mediaId={item.id}
          mediaType="movie"
          theme={theme}
          style={{ position: "absolute", left: 2, bottom: 8 }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function MovieUpcoming({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const {
    dateData,
    addTimeToDate,
    moviesUpcoming,
    loadingUpcoming,
    setValueUpcoming,
    pageUpcoming,
    totalPagesUpcoming,
    loadMoreUpcoming,
    loadingMoreUpcoming,
    valueUpcoming,
    RelaseCount,
    activateMovieSection,
  } = useMovie();
  const { getTmdbUrl } = useImageQualitySettings();

  useEffect(() => {
    activateMovieSection("upcoming");
  }, [activateMovieSection]);

  const handleSelectDate = (val) => {
    if (val === valueUpcoming) return;
    try { triggerHaptic("selection"); } catch (e) {}
    setValueUpcoming?.(val);
    addTimeToDate?.(val);
  };

  const renderDateFilterItem = ({ item }) => {
    const isSelected = valueUpcoming === item.value;
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => handleSelectDate(item.value)}
        style={[
          styles.chip,
          {
            backgroundColor: isSelected ? theme.accent : (theme.secondary || "rgba(255,255,255,0.06)"),
            borderColor: isSelected ? theme.accent : (theme.border || "rgba(255,255,255,0.12)"),
          },
          isSelected && {
            shadowColor: theme.accent,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.35,
            shadowRadius: 4,
            elevation: 3,
          },
        ]}
      >
        <Ionicons
          name="calendar-outline"
          size={13}
          color={isSelected ? "#fff" : theme.text.muted}
          style={{ marginRight: 5 }}
        />
        <Text
          style={[
            styles.chipText,
            {
              color: isSelected ? "#fff" : theme.text.secondary,
              fontWeight: isSelected ? "700" : "500",
            },
          ]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const headerComponent = (
    <View style={styles.headerContainer}>
      <View style={styles.titleRow}>
        <Text
          allowFontScaling={false}
          style={[styles.title, { color: theme.text.secondary }]}
        >
          {t.movieScreens.movieUpcaming.upcaming}
        </Text>
        <SeeAllButton
          onPress={() =>
            navigation.navigate("SeeAllScreen", {
              mediaType: "movie",
              section: "upcoming",
              title: t.movieScreens.movieUpcaming.upcaming,
            })
          }
        />
      </View>

      <FlatList
        data={dateData}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={renderDateFilterItem}
        keyExtractor={(item) => item.value}
        contentContainerStyle={styles.chipsContent}
        style={styles.chipsList}
      />
    </View>
  );

  if (loadingUpcoming) {
    return (
      <View style={styles.container}>
        {headerComponent}
        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <MovieUpComingSkeleton />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
        />
      </View>
    );
  }

  const renderMovieItem = ({ item }) => {
    if (!item.poster_path) return null;
    return (
      <MovieUpcomingCard
        item={item}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        RelaseCount={RelaseCount}
      />
    );
  };

  return (
    <View style={styles.container}>
      {headerComponent}
      <PaginatedRail
        data={moviesUpcoming}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
        onLoadMore={loadMoreUpcoming}
        loadingMore={loadingMoreUpcoming}
        hasMore={pageUpcoming < totalPagesUpcoming}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={80}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  headerContainer: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 15,
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    uppercase: true,
    marginLeft: 15,
    fontWeight: "700",
  },
  chipsList: {
    marginBottom: 4,
  },
  chipsContent: {
    paddingHorizontal: 15,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  similarItem: {
    width: width * 0.4,
    height: width * 0.62,
    marginRight: 10,
    marginBottom: 5,
  },
  similarPoster: {
    width: width * 0.4,
    height: width * 0.6,
    borderRadius: 15,
    marginBottom: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
});
