import React, { memo, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StyleSheet,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import PosterImage from "../../components/PosterImage";
import { useTheme } from "../../context/ThemeContext";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
import { useLanguage } from "../../context/LanguageContext";
import { ChipRowSkeleton, RailSkeleton } from "../../components/Skeleton";
//import { API_KEY } from "@env";
import { useTvShow } from "../../context/TvShowContex";
import ListBadges from "../../components/ListBadges";
import { RatingBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
import PaginatedRail from "../../components/PaginatedRail";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SeeAllButton } from "../../components/SeeAllHeader";
import { i18nText } from "../../utils/i18nText";
import {
  useImageQualitySettings,
  useListLayoutSettings,
  useStreamingProviderSettings,
} from "../../context/AppSettingsContext";
const { width } = Dimensions.get("window");
// Sağlayıcı çipi: içindeki logo/ad sütunu 40 yüksekliğinde sabit.
const PROVIDER_CHIP_HEIGHT = 40;

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
  const { t } = useLanguage();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
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

  const renderProvider = ({ item }) => (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 5,
        marginRight: 5,
        gap: 5,
        backgroundColor:
          selectedProvider === item.provider_id
            ? theme.accent
            : streamingProviderIds.includes(item.provider_id)
              ? theme.between
              : theme.secondary,
        borderRadius: 15,
      }}
      activeOpacity={0.8}
      onPress={() => fetchMoviesByProvider(item.provider_id)}
    >
      <Image
        source={{
          uri: getTmdbUrl(item.logo_path, 'logo', 150),
        }}
        style={{ width: 30, height: 30, borderRadius: 10 }}
        cachePolicy="memory-disk"
        transition={120}
      />
      <View
        style={{
          justifyContent: "center",
          alignItems: "center",
          height: 40,
        }}
      >
        {streamingProviderIds.includes(item.provider_id) && (
          <Ionicons
            name="checkmark-circle"
            size={14}
            color={selectedProvider === item.provider_id ? "#FFFFFF" : theme.accent}
          />
        )}
        <Text
          style={{
            color: theme.text.primary,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {item.provider_name}
        </Text>
      </View>
    </TouchableOpacity>
  );

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

  // Sağlayıcı satırı + JustWatch atfı yükleme sırasında da AYNI kurguda çizilir;
  // sağlayıcılar henüz gelmediyse yerlerini aynı yükseklikte (40) iskelet çipler
  // tutar. Aksi hâlde ray, çipler düştükçe aşağı kayıyordu.
  const providerHeader = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", paddingRight: 12 }}>
        <View style={{ flex: 1 }}>
          {displayedProviders.length > 0 ? (
            <FlatList
              data={displayedProviders}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.provider_id.toString()}
              renderItem={renderProvider}
              contentContainerStyle={{ paddingHorizontal: 15 }}
            />
          ) : (
            <ChipRowSkeleton
              chipHeight={PROVIDER_CHIP_HEIGHT}
              radius={15}
              style={{ paddingHorizontal: 15 }}
            />
          )}
        </View>
        <SeeAllButton
          onPress={() =>
            navigation.navigate("SeeAllScreen", {
              mediaType: "tv",
              section: "providers",
              title: providerName,
              providerId: selectedProvider,
            })
          }
        />
      </View>

      {/* TMDB koşulları: watch-provider verisi için zorunlu JustWatch atfı */}
      <Text
        allowFontScaling={false}
        style={{
          color: theme.text.muted,
          fontSize: 10,
          paddingHorizontal: 15,
          marginTop: 6,
        }}
      >
        {t.justwatchAttribution}
      </Text>
    </>
  );

  if (loadingMoviesByProvider || loadingProvider) {
    return (
      <View style={styles.container}>
        {providerHeader}
        {/* marginTop 20: gerçek rayın contentContainerStyle'ındaki üst boşluk */}
        <RailSkeleton style={{ marginTop: 20 }} />
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
        contentContainerStyle={{ paddingHorizontal: 15, marginTop: 20 }}
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
