import React, { memo, useEffect, useRef } from "react";
import {
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
import { MovieUpComingSkeleton } from "../../components/Skeleton";
import PaginatedRail from "../../components/PaginatedRail";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import { useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
import { useMovie } from "../../context/MovieContex";
import ListBadges from "../../components/ListBadges";
import { CountdownBadge, ReleaseDateBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
import SectionHeader from "../../components/home/SectionHeader";
import UpcomingFilterChips from "../../components/home/UpcomingFilterChips";
import UpcomingFilterSheet from "../../components/home/UpcomingFilterSheet";
import UpcomingEmptyState from "../../components/home/UpcomingEmptyState";
import useUpcomingFilterControls from "../../hooks/useUpcomingFilterControls";
import { isUpcomingCustomized } from "../../utils/upcomingFilters";
import { upcomingSummary } from "../../utils/upcomingFiltersCopy";

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
          mediaId={item.id}
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
  const { t, language } = useLanguage();
  const {
    moviesUpcoming,
    loadingUpcoming,
    pageUpcoming,
    totalPagesUpcoming,
    loadMoreUpcoming,
    loadingMoreUpcoming,
    RelaseCount,
    activateMovieSection,
  } = useMovie();
  const { getTmdbUrl } = useImageQualitySettings();
  const rp = useRailPosterStyle();
  const {
    filters,
    region,
    sheetVisible,
    openSheet,
    closeSheet,
    selectRange,
    applyFromSheet,
    reset,
  } = useUpcomingFilterControls("rail");

  useEffect(() => {
    activateMovieSection("upcoming");
  }, [activateMovieSection]);

  // Etkin süzgeç özeti alt başlığın yerini alır ("Sinemada · Korku · Tarihe göre"); süzgeç yoksa
  // undefined → SectionHeader kendi alt başlığını (homeSectionCopy) gösterir.
  const summary = upcomingSummary(filters, language);

  const headerComponent = (
    <SectionHeader
      section="upcoming"
      mediaType="movie"
      title={t.movieScreens.movieUpcaming.upcaming}
      subtitle={summary || undefined}
      onPressAction={() =>
        navigation.navigate("SeeAllScreen", {
          mediaType: "movie",
          section: "upcoming",
          title: t.movieScreens.movieUpcaming.upcaming,
        })
      }
    >
      <UpcomingFilterChips filters={filters} onOpenFilters={openSheet} onSelectRange={selectRange} />
    </SectionHeader>
  );

  const filterSheet = (
    <UpcomingFilterSheet
      visible={sheetVisible}
      onClose={closeSheet}
      filters={filters}
      onApply={applyFromSheet}
      region={region}
    />
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
        {filterSheet}
      </View>
    );
  }

  // Süzgeç sonuç vermediyse raf boş kalmaz: neden + sıfırla. (Varsayılan süzgeçte boş liste = ağ
  // hatası; eski davranış korunur, kart çizilmez.)
  const hasPosters = moviesUpcoming.some((item) => item?.poster_path);
  if (!hasPosters && isUpcomingCustomized(filters)) {
    return (
      <View style={styles.container}>
        {headerComponent}
        <UpcomingEmptyState onReset={reset} minHeight={rp.itemHeight} style={styles.empty} />
        {filterSheet}
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
      {filterSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  empty: { marginHorizontal: 15 },
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
