import React, { memo, useEffect, useMemo, useRef } from "react";
import {
  View,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Animated,
} from "react-native";
import PosterImage from "../../components/PosterImage";
import { useTheme } from "../../context/ThemeContext";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
import { ChipRowSkeleton, RailSkeleton } from "../../components/Skeleton";
//import { API_KEY } from "@env";
import { useTvShow } from "../../context/TvShowContex";
import ListBadges from "../../components/ListBadges";
import { RatingBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
import PaginatedRail from "../../components/PaginatedRail";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import SectionHeader from "../../components/home/SectionHeader";
import {
  SectionChipRail,
  SECTION_CHIP_GAP,
  SECTION_CHIP_HEIGHT_LOGO,
  SECTION_RAIL_PADDING,
} from "../../components/home/SectionChips";
import ProviderChip from "../../components/home/ProviderChip";
import { i18nText } from "../../utils/i18nText";
import {
  useImageQualitySettings,
  useListLayoutSettings,
  useStreamingProviderSettings,
} from "../../context/AppSettingsContext";
const { width } = Dimensions.get("window");

// Stable, module-scope item component → no remount → no flicker.
const TvProvidersCard = memo(function TvProvidersCard({ item, navigation, theme, getTmdbUrl }) {
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
          mediaId={item.id}
          size={200}
          style={[
            styles.similarPoster,
            { width: rp.posterWidth, height: rp.posterHeight, borderRadius: rp.radius, shadowColor: theme.shadow },
          ]}
          cachePolicy="memory-disk"
          recyclingKey={`tvprovider-${item.id}`}
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

export default function TvShowsProvders({ navigation }) {
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();
  const { streamingProviderIds } = useStreamingProviderSettings();
  const {
    providers,
    selectedProvider,
    moviesProviders,
    loadingMoviesByProvider,
    loadingProvider,
    fetchMoviesByProvider,
    activateTvSection,
    loadMoreProvider,
    loadingMoreProvider,
    pageProvider,
    totalPagesProvider,
  } = useTvShow();

  const displayedProviders = useMemo(
    () =>
      [...providers].sort((a, b) => {
        const aSubscribed = streamingProviderIds.includes(a.provider_id) ? 1 : 0;
        const bSubscribed = streamingProviderIds.includes(b.provider_id) ? 1 : 0;
        return (
          bSubscribed - aSubscribed ||
          Number(a.display_priority ?? 9999) - Number(b.display_priority ?? 9999)
        );
      }),
    [providers, streamingProviderIds],
  );

  useEffect(() => {
    activateTvSection("providers");
  }, [activateTvSection]);

  const renderMovieItem = ({ item }) => {
    if (!item.poster_path) return null;
    return (
      <TvProvidersCard
        item={item}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
      />
    );
  };
  const providerName =
    providers.find((p) => p.provider_id === selectedProvider)?.provider_name ||
    i18nText("autoI18n.saglayicilar", "Sağlayıcılar");

  // Başlık yükleme sırasında da AYNI öğedir: "Platformlar" + çipler + "Tümü". Sağlayıcılar henüz
  // gelmediyse yerlerini aynı yükseklikte iskelet çipler tutar. Aksi hâlde ray, çipler düştükçe
  // aşağı kayıyordu.
  const providerHeader = (
    <SectionHeader
      section="providers"
      mediaType="tv"
      title={i18nText("autoI18n.saglayicilar", "Sağlayıcılar")}
      onPressAction={() =>
        navigation.navigate("SeeAllScreen", {
          mediaType: "tv",
          section: "providers",
          title: providerName,
          providerId: selectedProvider,
        })
      }
    >
      {displayedProviders.length > 0 ? (
        <SectionChipRail
          data={displayedProviders}
          keyExtractor={(item) => item.provider_id.toString()}
          extraData={selectedProvider}
          renderChip={(item) => (
            <ProviderChip
              provider={item}
              selected={selectedProvider === item.provider_id}
              subscribed={streamingProviderIds.includes(item.provider_id)}
              onPress={() => fetchMoviesByProvider(item.provider_id)}
            />
          )}
        />
      ) : (
        <ChipRowSkeleton
          chipHeight={SECTION_CHIP_HEIGHT_LOGO}
          radius={SECTION_CHIP_HEIGHT_LOGO / 2}
          gap={SECTION_CHIP_GAP}
          style={styles.chipSkeleton}
        />
      )}
    </SectionHeader>
  );

  if (loadingMoviesByProvider || loadingProvider) {
    return (
      <View style={styles.container}>
        {providerHeader}
        <RailSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* İzleme sağlayıcıları */}
      {providerHeader}

      <PaginatedRail
        data={moviesProviders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        onLoadMore={loadMoreProvider}
        loadingMore={loadingMoreProvider}
        hasMore={pageProvider < totalPagesProvider}
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
