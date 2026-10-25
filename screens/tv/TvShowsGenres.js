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
import { useTvShow } from "../../context/TvShowContex";
import { ChipRowSkeleton, RailSkeleton } from "../../components/Skeleton";
import PaginatedRail from "../../components/PaginatedRail";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import ListBadges from "../../components/ListBadges";
import { RatingBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
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
const TvGenresCard = memo(function TvGenresCard({ item, navigation, theme, getTmdbUrl }) {
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
          recyclingKey={`tvgenres-${item.id}`}
          transition={120}
        />

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

export default function TvShowsGenres({ navigation }) {
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();

  const {
    selectedGenres,
    pageGenres,
    totalPagesGenres,
    moviesGenres,
    genres,
    loadingGenres,
    loadMoreGenres,
    loadingMoreGenres,
    setSelectedGenres,
    activateTvSection,
  } = useTvShow();

  useEffect(() => {
    activateTvSection("genres");
  }, [activateTvSection]);

  const toggleGenre = (genreId) => {
    setSelectedGenres(
      (prev) =>
        prev.includes(genreId)
          ? prev.filter((id) => id !== genreId) // Seçiliyse kaldır
          : [...prev, genreId], // Seçili değilse ekle
    );
  };

  const genreTitle = selectedGenres.length
    ? genres
        .filter((g) => selectedGenres.includes(g.id))
        .map((g) => g.name)
        .join(", ")
    : i18nText("autoI18n.turler", "Türler");

  // Başlık yükleme sırasında da AYNI kurguda: "Türler" + çipler + "Tümü". Türler henüz gelmediyse
  // yerlerini aynı yükseklikte iskelet çipler tutar — yoksa satır 0'dan gerçek yüksekliğe sıçrıyor,
  // ray zıplıyordu. Alt başlık: seçim yokken ipucu ("bir ya da birden fazla tür seç"), seçim varsa
  // seçilen türlerin adları.
  const genreHeader = (
    <SectionHeader
      section="genres"
      mediaType="tv"
      subtitle={selectedGenres.length ? genreTitle : undefined}
      onPressAction={() =>
        navigation.navigate("SeeAllScreen", {
          mediaType: "tv",
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
        {/* Bu bölümün kartında alt boşluk yok (similarItem) */}
        <RailSkeleton cellMarginBottom={0} />
      </View>
    );
  }

  const renderMovieItem = ({ item }) => {
    if (!item.poster_path) return null;
    return (
      <TvGenresCard
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
