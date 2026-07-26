import React, { memo, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import PosterImage from "../../components/PosterImage";
import axios from "axios";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { MovieSkeleton } from "../../components/Skeleton";
//import { API_KEY } from "@env";
import { useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
import { useMovie } from "../../context/MovieContex";
import ListBadges from "../../components/ListBadges";
import PaginatedRail from "../../components/PaginatedRail";
import SeeAllHeader from "../../components/SeeAllHeader";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RatingBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
const { width } = Dimensions.get("window");

// Stable, module-scope item component → no remount → no flicker.
const MovieNowPlayingCard = memo(function MovieNowPlayingCard({ item, navigation, theme, getTmdbUrl }) {
  const rp = useRailPosterStyle();
  const { posterBadges } = useListLayoutSettings();
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
          recyclingKey={`movienowplaying-${item.id}`}
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

export default function MovieNowPlaying({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const {
    moviesNowPlaying,
    loadingNowPlaying,
    activateMovieSection,
    loadMoreNowPlaying,
    loadingMoreNowPlaying,
    pageNowPlaying,
    totalPagesNowPlaying,
  } = useMovie();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();

  useEffect(() => {
    activateMovieSection("nowPlaying");
  }, [activateMovieSection]);

  if (loadingNowPlaying) {
    return (
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <Text
          allowFontScaling={false}
          style={[styles.title, { color: theme.text.secondary }]}
        >
          {t.movieScreens.theaters}
        </Text>

        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <MovieSkeleton />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews
        />
      </View>
    );
  }
  const renderMovieItem = ({ item }) => {
    if (!item.poster_path) return null;
    return (
      <MovieNowPlayingCard
        item={item}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
      />
    );
  };
  return (
    <View style={{ flex: 1, paddingVertical: 10 }}>
      <SeeAllHeader
        title={t.movieScreens.theaters}
        onPress={() =>
          navigation.navigate("SeeAllScreen", {
            mediaType: "movie",
            section: "nowPlaying",
            title: t.movieScreens.theaters,
          })
        }
      />

      <PaginatedRail
        data={moviesNowPlaying}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        onLoadMore={loadMoreNowPlaying}
        loadingMore={loadingMoreNowPlaying}
        hasMore={pageNowPlaying < totalPagesNowPlaying}
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
  genreButton: {
    marginVertical: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
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
  title: {
    fontSize: 18,
    uppercase: true,
    marginBottom: 15,
    marginLeft: 15,
    fontWeight: "700",
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
