import React, { memo, useEffect, useRef } from "react";
import {
  TouchableOpacity,
  StyleSheet,
  View,
  Dimensions,
  Animated,
} from "react-native";
import PosterImage from "../../components/PosterImage";
import { useTheme } from "../../context/ThemeContext";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
import { RailSkeleton } from "../../components/Skeleton";
import PaginatedRail from "../../components/PaginatedRail";
import SectionHeader from "../../components/home/SectionHeader";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
//import { API_KEY } from "@env";
import { useTvShow } from "../../context/TvShowContex";
import { useLanguage } from "../../context/LanguageContext";
import ListBadges from "../../components/ListBadges";
import { RatingBadge, ReleaseDateBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
import { useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";

const { width } = Dimensions.get("window");

// Stable, module-scope item component → no remount → no flicker.
const TvAiringTodayCard = memo(function TvAiringTodayCard({ item, navigation, theme, getTmdbUrl }) {
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
      onPress={() => navigation.push("TvShowsDetails", { id: item.id })}
      onLongPress={() =>
        openQuickActions({ item, mediaType: "tv", navigation })
      }
      delayLongPress={350}
    >
      <Animated.View style={[{ transform: [{ scale }] }]}>
        <PosterImage
          path={item.poster_path}
          type="tv"
          mediaId={item.id}
          size={200}
          style={[
            styles.similarPoster,
            { width: rp.posterWidth, height: rp.posterHeight, borderRadius: rp.radius, shadowColor: theme.shadow },
          ]}
          cachePolicy="memory-disk"
          recyclingKey={`tvairing-${item.id}`}
          transition={120}
        />

        {posterBadges?.releaseDate !== false && (
          <ReleaseDateBadge date={item.first_air_date} variant="year" style={POSTER_BADGE_POS.topRight} />
        )}
        {posterBadges?.tmdbRating !== false && (
          <RatingBadge value={item.vote_average} votes={item.vote_count} style={POSTER_BADGE_POS.bottomRight} />
        )}
        <ListBadges
          mediaId={item.id}
          mediaType="tv"
          theme={theme}
          style={{ position: "absolute", left: 2, bottom: 8 }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function TvShowsAiringToday({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const {
    moviesAiringToday,
    totalPagesAiringToday,
    loadingAiringToday,
    loadMoreAiringToday,
    loadingMoreAiringToday,
    pageAiringToday,
    activateTvSection,
  } = useTvShow();

  useEffect(() => {
    activateTvSection("airingToday");
  }, [activateTvSection]);
  // Film türlerini API'den almak
  const { getTmdbUrl } = useImageQualitySettings();

  // Başlık iki durumda da AYNI bileşenden gelir (bkz. TvShowsOnTheAir): düz
  // Text ile "tümünü gör" haplı satırın yüksekliği farklı, aradaki fark ray'ı
  // zıplatıyordu.
  const airingTodayHeader = (
    <SectionHeader
      section="airingToday"
      mediaType="tv"
      title={t.tvShowScreens.airingToday}
      onPressAction={() =>
        navigation.navigate("SeeAllScreen", {
          mediaType: "tv",
          section: "airingToday",
          title: t.tvShowScreens.airingToday,
        })
      }
    />
  );

  if (loadingAiringToday) {
    return (
      <View style={styles.container}>
        {airingTodayHeader}
        <RailSkeleton showReleaseDate />
      </View>
    );
  }
  const renderMovieItem = ({ item }) => {
    if (!item.poster_path) return null;
    return (
      <TvAiringTodayCard
        item={item}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
      />
    );
  };
  return (
    <View style={styles.container}>
      {airingTodayHeader}
      <PaginatedRail
        data={moviesAiringToday}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
        onLoadMore={loadMoreAiringToday}
        loadingMore={loadingMoreAiringToday}
        hasMore={pageAiringToday < totalPagesAiringToday}
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
