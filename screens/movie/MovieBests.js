import React, { memo, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Animated,
} from "react-native";
import PosterImage from "../../components/PosterImage";
import { useTheme } from "../../context/ThemeContext";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
const { width } = Dimensions.get("window");
import { MovieBestsSkeleton } from "../../components/Skeleton";
import { useMovie } from "../../context/MovieContex";
import ListBadges from "../../components/ListBadges";
import PaginatedRail from "../../components/PaginatedRail";
import SectionHeader from "../../components/home/SectionHeader";
import { SectionChipRail } from "../../components/home/SectionChips";
import DiscoverFilterChip from "../../components/home/DiscoverFilterChip";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import { i18nText } from "../../utils/i18nText";
import { useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
import { RatingBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";

// Stable, module-scope item component → no remount → no flicker.
const MovieBestCard = memo(function MovieBestCard({ item, navigation, theme, getTmdbUrl }) {
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
          recyclingKey={`moviebest-${item.id}`}
          transition={120}
        />

        {posterBadges?.tmdbRating !== false && (
          <RatingBadge
            value={item.vote_average}
            votes={item.vote_count}
            style={POSTER_BADGE_POS.bottomRight}
          />
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

export default function MovieBests({ navigation }) {
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();

  const {
    loadingBests,
    movieBests,
    categorieBests,
    selectedCategoryBests,
    setSelectedCategoryBests,
    getCategoryTitleBests,
    pageBest,
    totalPagesBest,
    loadMoreBests,
    loadingMoreBests,
    activateMovieSection,
  } = useMovie();

  useEffect(() => {
    activateMovieSection("bests");
  }, [activateMovieSection]);

  // Başlık yükleme sırasında da AYNI öğedir (kategori çipleri + "Tümü"): iskeletten veriye geçerken
  // çipler yana kaymasın, altındaki ray zıplamasın. Eskiden bu raf başlıksızdı; yalnız kategori vardı.
  const bestsTitle = i18nText("autoI18n.en_iyi_filmler", "En İyi Filmler");
  const bestsHeader = (
    <SectionHeader
      section="bests"
      mediaType="movie"
      title={bestsTitle}
      onPressAction={() =>
        navigation.navigate("SeeAllScreen", {
          mediaType: "movie",
          section: "bests",
          title: bestsTitle,
        })
      }
    >
      <SectionChipRail
        data={categorieBests}
        keyExtractor={(item) => item}
        extraData={selectedCategoryBests}
        renderChip={(item) => (
          <DiscoverFilterChip
            label={getCategoryTitleBests(item)}
            selected={selectedCategoryBests === item}
            onPress={() => setSelectedCategoryBests(item)}
          />
        )}
      />
    </SectionHeader>
  );

  if (loadingBests) {
    return (
      <View style={styles.container}>
        {bestsHeader}

        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <MovieBestsSkeleton />}
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
      <MovieBestCard
        item={item}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
      />
    );
  };

  return (
    <View style={styles.container}>
      {bestsHeader}
      <PaginatedRail
        data={movieBests}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
        onLoadMore={loadMoreBests}
        loadingMore={loadingMoreBests}
        hasMore={pageBest < totalPagesBest}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  similarItem: {
    width: width * 0.4,
    height: width * 0.6,
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
