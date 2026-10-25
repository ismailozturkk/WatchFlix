import React, { memo, useEffect, useRef } from "react";
import {
  View,
  TouchableOpacity,
  FlatList,
  Dimensions,
    StyleSheet,
  Animated,
} from "react-native";
import PosterImage from "../../components/PosterImage";
import { useTheme } from "../../context/ThemeContext";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
import { useLanguage } from "../../context/LanguageContext";
import { MovieSkeleton } from "../../components/Skeleton";
//import { API_KEY } from "@env";
import { useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
import { useMovie } from "../../context/MovieContex";
import ListBadges from "../../components/ListBadges";
import PaginatedRail from "../../components/PaginatedRail";
import SectionHeader from "../../components/home/SectionHeader";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import { RatingBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
const { width } = Dimensions.get("window");

// Stable, module-scope item component → no remount → no flicker.
const MovieNowPlayingCard = memo(function MovieNowPlayingCard({ item, navigation, theme, getTmdbUrl }) {
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
  const { getTmdbUrl } = useImageQualitySettings();

  useEffect(() => {
    activateMovieSection("nowPlaying");
  }, [activateMovieSection]);

  // Başlık yüklenirken de AYNI bileşenden gelir: düz bir Text ile "Tümü" düğmeli satırın yüksekliği
  // farklıdır, ray veri gelince aşağı zıplar.
  const nowPlayingHeader = (
    <SectionHeader
      section="nowPlaying"
      mediaType="movie"
      title={t.movieScreens.theaters}
      onPressAction={() =>
        navigation.navigate("SeeAllScreen", {
          mediaType: "movie",
          section: "nowPlaying",
          title: t.movieScreens.theaters,
        })
      }
    />
  );

  if (loadingNowPlaying) {
    return (
      <View style={{ flex: 1, paddingVertical: 10 }}>
        {nowPlayingHeader}

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
      {nowPlayingHeader}

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
