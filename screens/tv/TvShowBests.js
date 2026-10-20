import {
  StyleSheet,
  View,
  Dimensions,
  TouchableOpacity,
  Animated,
} from "react-native";
import PosterImage from "../../components/PosterImage";
import { useTheme } from "../../context/ThemeContext";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
//import { API_KEY } from "@env";
const { width } = Dimensions.get("window");
import { RailSkeleton } from "../../components/Skeleton";
import PaginatedRail from "../../components/PaginatedRail";
import SectionHeader from "../../components/home/SectionHeader";
import { SectionChipRail } from "../../components/home/SectionChips";
import DiscoverFilterChip from "../../components/home/DiscoverFilterChip";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import { i18nText } from "../../utils/i18nText";
import { useTvShow } from "../../context/TvShowContex";
import { memo, useEffect, useRef } from "react";

import ListBadges from "../../components/ListBadges";
import { RatingBadge, ReleaseDateBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
import { useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
//import { API_KEY } from "@env";

// Stable, module-scope item component. Hoisted out of the parent so its
// component type never changes between renders → FlatList re-renders cells
// instead of unmounting/remounting them → no poster flicker.
const TvBestCard = memo(function TvBestCard({ item, navigation, theme, getTmdbUrl }) {
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
      activeOpacity={0.8}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.similarItem, { width: rp.itemWidth, height: rp.itemHeight }]}
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
          size={200}
          style={[
            styles.similarPoster,
            { width: rp.posterWidth, height: rp.posterHeight, borderRadius: rp.radius, shadowColor: theme.shadow },
          ]}
          cachePolicy="memory-disk"
          recyclingKey={`tvbest-${item.id}`}
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

export default function TvShowBests({ navigation }) {
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();
  const {
    seriesBest,
    setSelectedCategoryBest,
    selectedCategoryBest,
    pageBest,
    totalPagesBest,
    loadingBest,
    loadMoreBest,
    loadingMoreBest,
    categoriesBest,
    getCategoryTitleBest,
    activateTvSection,
  } = useTvShow();

  useEffect(() => {
    activateTvSection("best");
  }, [activateTvSection]);

  // Başlık yükleme sırasında da AYNI kurguyla çizilir (kategori çipleri + "Tümü"): iskeletten veriye
  // geçerken çipler yana kaymasın, altındaki ray zıplamasın. Eskiden bu raf başlıksızdı.
  const bestsTitle = i18nText("autoI18n.en_iyi_diziler", "En İyi Diziler");
  const bestsHeader = (
    <SectionHeader
      section="bests"
      mediaType="tv"
      title={bestsTitle}
      onPressAction={() =>
        navigation.navigate("SeeAllScreen", {
          mediaType: "tv",
          section: "best",
          title: bestsTitle,
        })
      }
    >
      <SectionChipRail
        data={categoriesBest}
        keyExtractor={(item) => item}
        extraData={selectedCategoryBest}
        renderChip={(item) => (
          <DiscoverFilterChip
            label={getCategoryTitleBest(item)}
            selected={selectedCategoryBest === item}
            onPress={() => setSelectedCategoryBest(item)}
          />
        )}
      />
    </SectionHeader>
  );

  if (loadingBest) {
    return (
      <View style={styles.container}>
        {bestsHeader}
        <RailSkeleton showReleaseDate />
      </View>
    );
  }

  const renderMovieItem = ({ item }) => {
    if (!item.poster_path) return null;
    return (
      <TvBestCard
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
        data={seriesBest}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
        onLoadMore={loadMoreBest}
        loadingMore={loadingMoreBest}
        hasMore={pageBest < totalPagesBest}
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
