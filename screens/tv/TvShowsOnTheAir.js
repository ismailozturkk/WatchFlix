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
import { SectionChipRail } from "../../components/home/SectionChips";
import DiscoverFilterChip from "../../components/home/DiscoverFilterChip";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
//import { API_KEY } from "@env";
import { useTvShow } from "../../context/TvShowContex";
import { useLanguage } from "../../context/LanguageContext";
import ListBadges from "../../components/ListBadges";
import { RatingBadge, ReleaseDateBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
import { useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
const { width } = Dimensions.get("window");

// Stable, module-scope item component → no remount → no flicker.
const TvOnTheAirCard = memo(function TvOnTheAirCard({ item, navigation, theme, getTmdbUrl }) {
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

// "Yayında" rafı: eskiden iki ayrı raf olan "Bugün Yayında" (tv/airing_today) ile "Bu Hafta Yayında"
// (tv/on_the_air) tek rafta, başlık altındaki çiple seçilir. İki uç bağlamda ayrı bölüm olarak kaldı
// (önbellek anahtarları, "Tümü" ekranı); yalnız SEÇİLİ çipin bölümü etkinleştirilir → seçilmeyen uç istek atmaz.
const AIRING_RANGES = ["today", "week"];
const RANGE_SECTION = { today: "airingToday", week: "onTheAir" };

export default function TvShowsOnTheAir({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { getTmdbUrl } = useImageQualitySettings();
  const {
    pageOnTheAir,
    moviesOnTheAir,
    totalPagesOnTheAir,
    loadingOnTheAir,
    loadMoreOnTheAir,
    loadingMoreOnTheAir,
    moviesAiringToday,
    totalPagesAiringToday,
    loadingAiringToday,
    loadMoreAiringToday,
    loadingMoreAiringToday,
    pageAiringToday,
    selectedAiringRange,
    setSelectedAiringRange,
    activateTvSection,
  } = useTvShow();

  const range = selectedAiringRange === "week" ? "week" : "today";
  const isToday = range === "today";

  useEffect(() => {
    activateTvSection(RANGE_SECTION[range]);
  }, [activateTvSection, range]);

  const rangeLabel = (id) =>
    id === "today" ? t.tvShowScreens.airingRangeToday : t.tvShowScreens.airingRangeWeek;

  // Başlık iki durumda da AYNI bileşenden gelir: yükleme sırasında düz bir
  // Text, sonrasında "tümünü gör" hapı olan bir satır çizilirse başlık yüksekliği
  // değişir ve ray aşağı zıplar.
  const onTheAirHeader = (
    <SectionHeader
      section="onTheAir"
      mediaType="tv"
      title={t.tvShowScreens.onAir}
      onPressAction={() =>
        navigation.navigate("SeeAllScreen", {
          mediaType: "tv",
          section: RANGE_SECTION[range],
          title: isToday ? t.tvShowScreens.airingToday : t.tvShowScreens.onTheAir,
        })
      }
    >
      <SectionChipRail
        data={AIRING_RANGES}
        keyExtractor={(item) => item}
        extraData={range}
        renderChip={(item) => (
          <DiscoverFilterChip
            label={rangeLabel(item)}
            selected={range === item}
            onPress={() => setSelectedAiringRange(item)}
          />
        )}
      />
    </SectionHeader>
  );

  const loading = isToday ? loadingAiringToday : loadingOnTheAir;
  if (loading) {
    return (
      <View style={styles.container}>
        {onTheAirHeader}
        <RailSkeleton showReleaseDate />
      </View>
    );
  }
  const renderMovieItem = ({ item }) => {
    if (!item.poster_path) return null;
    return (
      <TvOnTheAirCard
        item={item}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
      />
    );
  };
  return (
    <View style={styles.container}>
      {onTheAirHeader}
      <PaginatedRail
        // Çip değişince ray baştan kurulur: öteki listenin kaydırma konumu yeni veride kalmasın.
        key={range}
        data={isToday ? moviesAiringToday : moviesOnTheAir}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
        onLoadMore={isToday ? loadMoreAiringToday : loadMoreOnTheAir}
        loadingMore={isToday ? loadingMoreAiringToday : loadingMoreOnTheAir}
        hasMore={isToday ? pageAiringToday < totalPagesAiringToday : pageOnTheAir < totalPagesOnTheAir}
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
