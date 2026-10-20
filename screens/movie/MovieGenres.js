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
import { useTheme } from "../../context/ThemeContext";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
import { ChipRowSkeleton, MovieSkeleton } from "../../components/Skeleton";
//import { API_KEY } from "@env";
import { useMovie } from "../../context/MovieContex";
import ListBadges from "../../components/ListBadges";
import { RatingBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
import PaginatedRail from "../../components/PaginatedRail";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import SectionHeader from "../../components/home/SectionHeader";
import {
  SectionChipRail,
  SECTION_CHIP_GAP,
  SECTION_CHIP_HEIGHT,
  SECTION_RAIL_PADDING,
} from "../../components/home/SectionChips";
import DiscoverFilterChip from "../../components/home/DiscoverFilterChip";
import { i18nText } from "../../utils/i18nText";
import { useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
const { width } = Dimensions.get("window");

// Stable, module-scope item component → no remount → no flicker.
const MovieGenresCard = memo(function MovieGenresCard({ item, navigation, theme, getTmdbUrl }) {
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
      activeOpacity={1}
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
          recyclingKey={`moviegenres-${item.id}`}
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

export default function MovieGenres({ navigation }) {
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();

  const {
    genres,
    toggleGenre,
    loadingGenres,
    moviesGenres,
    pageGenres,
    totalPagesGenres,
    loadMoreGenres,
    loadingMoreGenres,
    selectedGenres,
    activateMovieSection,
  } = useMovie();

  useEffect(() => {
    activateMovieSection("genres");
  }, [activateMovieSection]);

  const genreTitle = selectedGenres.length
    ? genres
        .filter((g) => selectedGenres.includes(g.id))
        .map((g) => g.name)
        .join(", ")
    : i18nText("autoI18n.turler", "Türler");

  // Başlık yükleme sırasında da AYNI öğedir (bkz. TvShowsGenres): "Türler" + çipler + "Tümü". Alt başlık:
  // seçim yokken ipucu ("bir ya da birden fazla tür seç"), seçim varsa seçilen türlerin adları.
  const genreHeader = (
    <SectionHeader
      section="genres"
      mediaType="movie"
      subtitle={selectedGenres.length ? genreTitle : undefined}
      onPressAction={() =>
        navigation.navigate("SeeAllScreen", {
          mediaType: "movie",
          section: "genres",
          title: genreTitle,
          genreIds: selectedGenres,
        })
      }
    >
      {genres.length > 0 ? (
        <SectionChipRail
          data={genres}
          keyExtractor={(item) => item.id.toString()}
          extraData={selectedGenres}
          renderChip={(item) => (
            <DiscoverFilterChip
              label={item.name}
              selected={selectedGenres.includes(item.id)}
              onPress={() => toggleGenre(item.id)}
            />
          )}
        />
      ) : (
        <ChipRowSkeleton
          chipHeight={SECTION_CHIP_HEIGHT}
          radius={SECTION_CHIP_HEIGHT / 2}
          gap={SECTION_CHIP_GAP}
          style={styles.chipSkeleton}
        />
      )}
    </SectionHeader>
  );

  if (loadingGenres || moviesGenres.length < 1) {
    return (
      <View style={styles.container}>
        {genreHeader}
        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <MovieSkeleton />}
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
      <MovieGenresCard
        item={item}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
      />
    );
  };
  return (
    <View style={styles.container}>
      {genreHeader}
      <PaginatedRail
        data={moviesGenres}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
        onLoadMore={loadMoreGenres}
        loadingMore={loadingMoreGenres}
        hasMore={pageGenres < totalPagesGenres}
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
  chipSkeleton: {
    paddingHorizontal: SECTION_RAIL_PADDING,
  },
  similarItem: {
    width: width * 0.4,
    height: width * 0.62,
    marginRight: 10,
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
