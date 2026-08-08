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
import { useTheme } from "../../context/ThemeContext";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
import { MovieSkeleton } from "../../components/Skeleton";
//import { API_KEY } from "@env";
import { useMovie } from "../../context/MovieContex";
import ListBadges from "../../components/ListBadges";
import { RatingBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
import PaginatedRail from "../../components/PaginatedRail";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import { SeeAllButton } from "../../components/SeeAllHeader";
import { i18nText } from "../../utils/i18nText";
import { useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
const { width, height } = Dimensions.get("window");

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
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();

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

  if (loadingGenres || moviesGenres.length < 1) {
    return (
      <View style={styles.container}>
        <FlatList
          data={genres}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.genreButton,
                {
                  backgroundColor: selectedGenres.includes(item.id)
                    ? theme.accent
                    : theme.secondary,
                },
              ]}
              onPress={() => toggleGenre(item.id)}
            >
              <Text
                allowFontScaling={false}
                style={[styles.genreText, { color: theme.text.primary }]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
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
  const genreTitle = selectedGenres.length
    ? genres
        .filter((g) => selectedGenres.includes(g.id))
        .map((g) => g.name)
        .join(", ")
    : i18nText("autoI18n.turler", "Türler");
  return (
    <View style={styles.container}>
      <View style={styles.genreHeaderRow}>
        <View style={styles.genreListWrap}>
          <FlatList
            data={genres}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.genreListContent}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.genreButton,
                  {
                    backgroundColor: selectedGenres.includes(item.id)
                      ? theme.accent
                      : theme.secondary,
                  },
                ]}
                onPress={() => toggleGenre(item.id)}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.genreText, { color: theme.text.primary }]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
        <SeeAllButton
          style={styles.genreSeeAllButton}
          onPress={() =>
            navigation.navigate("SeeAllScreen", {
              mediaType: "movie",
              section: "genres",
              title: genreTitle,
              genreIds: selectedGenres,
            })
          }
        />
      </View>
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
  genreHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    marginBottom: 20,
  },
  genreListWrap: {
    flex: 1,
    justifyContent: "center",
  },
  genreListContent: {
    paddingHorizontal: 15,
    alignItems: "center",
  },
  genreSeeAllButton: {
    marginTop: 0,
    marginBottom: 0,
  },
  genreButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  genreText: {
    color: "white",
    fontWeight: "bold",
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
  similarTitle: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 5,
  },
  similarRating: {
    position: "absolute",
    bottom: 10,
    right: 5,
    width: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  similarRatingText: {
    color: "#ffd700",
    fontSize: 12,
    marginBottom: 2,
  },
  errorText: {
    color: "red",
    fontSize: 16,
    fontWeight: "bold",
  },
});
