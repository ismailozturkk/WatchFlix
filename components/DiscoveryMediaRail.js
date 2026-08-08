import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import axios from "axios";
import { Image } from "expo-image";
import PosterImage from "./PosterImage";
import ListBadges from "./ListBadges";
import { RatingBadge, POSTER_BADGE_POS } from "./PosterInfoBadges";
import PaginatedRail from "./PaginatedRail";
import SeeAllHeader from "./SeeAllHeader";
import { RailSkeleton } from "./Skeleton";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import {
  useApiSettings,
  useImageQualitySettings,
  useListLayoutSettings,
  useStreamingProviderSettings,
} from "../context/AppSettingsContext";
import useRailPosterStyle from "../hooks/useRailPosterStyle";
import { useMediaQuickActions } from "../context/MediaQuickActionsContext";
import { getCachedValue, setCachedValue, TTL } from "../utils/apiCache";
import {
  mergeProviderResults,
  resolveGenreIds,
} from "../utils/discoveryPersonalization";

const mergeUnique = (current, incoming) => {
  const byId = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    if (!item?.id) return;
    const previous = byId.get(item.id);
    if (!previous) {
      byId.set(item.id, item);
      return;
    }
    byId.set(item.id, {
      ...previous,
      _subscriptionProviderIds: [...new Set([
        ...(previous._subscriptionProviderIds || []),
        ...(item._subscriptionProviderIds || []),
      ])],
    });
  });
  return [...byId.values()];
};

const DiscoveryCard = memo(function DiscoveryCard({
  item,
  mediaType,
  navigation,
  providerCatalog,
}) {
  const { theme } = useTheme();
  const { posterBadges } = useListLayoutSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const rail = useRailPosterStyle();
  const { openQuickActions } = useMediaQuickActions();
  const scale = useRef(new Animated.Value(1)).current;
  const itemProviders = (item._subscriptionProviderIds || [])
    .map((id) => providerCatalog[id])
    .filter(Boolean);

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      style={[styles.item, { width: rail.itemWidth, height: rail.itemHeight }]}
      onPressIn={() =>
        Animated.timing(scale, { toValue: 0.94, duration: 120, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start()
      }
      onPress={() =>
        navigation.push(mediaType === "movie" ? "MovieDetails" : "TvShowsDetails", {
          id: item.id,
        })
      }
      onLongPress={() => openQuickActions({ item, mediaType, navigation })}
      delayLongPress={350}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <PosterImage
          path={item.poster_path}
          type={mediaType}
          size={200}
          style={{
            width: rail.posterWidth,
            height: rail.posterHeight,
            borderRadius: rail.radius,
            backgroundColor: theme.secondary,
          }}
          cachePolicy="memory-disk"
          recyclingKey={`discovery-${mediaType}-${item.id}`}
          transition={120}
        />
        {posterBadges?.tmdbRating !== false && Number(item.vote_average) > 0 && (
          <RatingBadge
            value={item.vote_average}
            votes={item.vote_count}
            style={POSTER_BADGE_POS.bottomRight}
          />
        )}
        <ListBadges
          mediaId={item.id}
          mediaType={mediaType}
          theme={theme}
          style={styles.badges}
        />
        {itemProviders.length > 0 && (
          <View
            pointerEvents="none"
            accessible
            style={styles.providerBadges}
            accessibilityLabel={itemProviders.map((provider) => provider.provider_name).join(", ")}
          >
            {itemProviders.slice(0, 3).map((provider, index) => (
              <View
                key={provider.provider_id}
                style={[
                  styles.providerBadge,
                  {
                    borderColor: theme.border,
                    marginLeft: index === 0 ? 0 : -6,
                    zIndex: 4 - index,
                  },
                ]}
              >
                <Image
                  source={{ uri: getTmdbUrl(provider.logo_path, "logo", 150) }}
                  style={styles.providerLogo}
                  cachePolicy="memory-disk"
                />
              </View>
            ))}
            {itemProviders.length > 3 && (
              <View style={[styles.providerMore, { backgroundColor: theme.secondary }]}>
                <Text allowFontScaling={false} style={[styles.providerMoreText, { color: theme.text.primary }]}>
                  +{itemProviders.length - 3}
                </Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function DiscoveryMediaRail({ mediaType, preset, navigation, genreNames = [] }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { streamingProviderIds } = useStreamingProviderSettings();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [providerCatalog, setProviderCatalog] = useState({});
  const [genreIds, setGenreIds] = useState([]);
  const [genreResolutionComplete, setGenreResolutionComplete] = useState(preset !== "topGenres");

  const isTr = language === "tr";
  const normalizedGenreNames = useMemo(
    () => [...new Set((genreNames || []).filter((name) => name && name !== "-"))].slice(0, 3),
    [genreNames],
  );
  const section = useMemo(() => {
    if (preset === "subscriptions") {
      return {
        title: isTr ? "Üyeliklerimde popüler" : "Popular with my subscriptions",
        subtitle: isTr
          ? "Seçtiğin platformlarda izleyebileceğin içerikler"
          : "Titles available on your selected services",
      };
    }
    if (preset === "hiddenGems") {
      return {
        title: isTr ? "Gizli cevherler" : "Hidden gems",
        subtitle: isTr ? "Az bilinen, yüksek puanlı seçimler" : "Lesser-known, highly rated picks",
      };
    }
    if (preset === "topGenres") {
      return {
        title: isTr ? "Favori türlerinden seçtik" : "Inspired by your favorite genres",
        subtitle: normalizedGenreNames.join("  •  "),
      };
    }
    return {
      title: isTr ? "Son yılların beğenilenleri" : "Recent favorites",
      subtitle: isTr ? "Yeni ve güçlü izleyici puanına sahip" : "Recent titles with strong audience scores",
    };
  }, [isTr, normalizedGenreNames, preset]);

  useEffect(() => {
    if (preset !== "subscriptions" || streamingProviderIds.length === 0) return;
    let active = true;
    const loadProviderCatalog = async () => {
      const cacheKey = `provider_catalog_${mediaType}_${language}`;
      try {
        let data = await getCachedValue(cacheKey, TTL.PROVIDERS);
        if (!data) {
          data = (await axios.get(`https://api.themoviedb.org/3/watch/providers/${mediaType}`, {
            params: {
              language: isTr ? "tr-TR" : "en-US",
              watch_region: isTr ? "TR" : "US",
            },
            headers: { accept: "application/json", Authorization: API_KEY },
          })).data;
          setCachedValue(cacheKey, data);
        }
        if (!active) return;
        setProviderCatalog(Object.fromEntries(
          (data.results || [])
            .filter((provider) => streamingProviderIds.includes(provider.provider_id))
            .map((provider) => [provider.provider_id, provider]),
        ));
      } catch (error) {
        if (__DEV__) console.error("Discovery provider catalog:", error?.message || error);
      }
    };
    loadProviderCatalog();
    return () => { active = false; };
  }, [API_KEY, isTr, language, mediaType, preset, streamingProviderIds]);

  useEffect(() => {
    if (preset !== "topGenres") return;
    let active = true;
    setGenreResolutionComplete(false);
    setGenreIds([]);

    if (normalizedGenreNames.length !== 3) {
      setGenreResolutionComplete(true);
      return () => { active = false; };
    }

    const loadGenreIds = async () => {
      try {
        const catalogs = await Promise.all(["tr-TR", "en-US"].map(async (locale) => {
          const cacheKey = `genre_catalog_${mediaType}_${locale}`;
          const cached = await getCachedValue(cacheKey, TTL.GENRES);
          if (cached) return cached.genres || [];
          const data = (await axios.get(`https://api.themoviedb.org/3/genre/${mediaType}/list`, {
            params: { language: locale },
            headers: { accept: "application/json", Authorization: API_KEY },
          })).data;
          setCachedValue(cacheKey, data);
          return data.genres || [];
        }));
        if (active) setGenreIds(resolveGenreIds(normalizedGenreNames, ...catalogs));
      } catch (error) {
        if (__DEV__) console.error("Discovery genre resolver:", error?.message || error);
      } finally {
        if (active) setGenreResolutionComplete(true);
      }
    };
    loadGenreIds();
    return () => { active = false; };
  }, [API_KEY, mediaType, normalizedGenreNames, preset]);

  const buildParams = useCallback(
    (requestedPage) => {
      const params = {
        language: isTr ? "tr-TR" : "en-US",
        page: requestedPage,
        include_adult: false,
        sort_by: preset === "hiddenGems" ? "vote_average.desc" : "popularity.desc",
        "vote_count.gte": preset === "hiddenGems" ? 120 : 300,
      };

      if (preset === "subscriptions") {
        params.watch_region = isTr ? "TR" : "US";
        params.with_watch_providers = streamingProviderIds.join("|");
        params.with_watch_monetization_types = "flatrate";
      }

      if (preset === "recentFavorites") {
        const date = new Date();
        date.setFullYear(date.getFullYear() - 5);
        const dateKey = mediaType === "movie" ? "primary_release_date.gte" : "first_air_date.gte";
        params[dateKey] = date.toISOString().slice(0, 10);
        params["vote_average.gte"] = 7;
      }

      if (preset === "topGenres") {
        params.with_genres = genreIds.join("|");
      }

      return params;
    },
    [genreIds, isTr, mediaType, preset, streamingProviderIds],
  );

  const load = useCallback(
    async (requestedPage = 1, append = false) => {
      if (preset === "subscriptions" && streamingProviderIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      if (preset === "topGenres" && genreIds.length !== 3) {
        setItems([]);
        setLoading(false);
        return;
      }

      append ? setLoadingMore(true) : setLoading(true);
      const filterKey = preset === "subscriptions"
        ? streamingProviderIds.join("-")
        : preset === "topGenres"
          ? genreIds.join("-")
          : "all";
      const cacheKey = `discovery_v2_${mediaType}_${preset}_${language}_${filterKey}_${requestedPage}`;
      try {
        const cached = await getCachedValue(cacheKey, TTL.TREND);
        let data = cached;
        if (!data && preset === "subscriptions") {
          const responses = await Promise.all(streamingProviderIds.map(async (providerId) => {
            const params = {
              ...buildParams(requestedPage),
              with_watch_providers: providerId,
            };
            const response = await axios.get(`https://api.themoviedb.org/3/discover/${mediaType}`, {
              params,
              headers: { accept: "application/json", Authorization: API_KEY },
            });
            return {
              providerId,
              results: response.data.results || [],
              totalPages: response.data.total_pages || 1,
            };
          }));
          data = {
            results: mergeProviderResults(responses),
            total_pages: Math.max(...responses.map((response) => response.totalPages), 1),
          };
        } else if (!data) {
          data = (await axios.get(`https://api.themoviedb.org/3/discover/${mediaType}`, {
            params: buildParams(requestedPage),
            headers: { accept: "application/json", Authorization: API_KEY },
          })).data;
        }
        const results = (data.results || []).filter((item) => item.poster_path);
        setItems((current) => (append ? mergeUnique(current, results) : results));
        setPage(requestedPage);
        setTotalPages(Math.min(data.total_pages || 1, 20));
        if (!cached) setCachedValue(cacheKey, data);
      } catch (error) {
        if (__DEV__) console.error("DiscoveryMediaRail:", error?.message || error);
        if (!append) setItems([]);
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [API_KEY, buildParams, genreIds, language, mediaType, preset, streamingProviderIds],
  );

  useEffect(() => {
    if (preset === "topGenres" && !genreResolutionComplete) return;
    setPage(1);
    load(1, false);
  }, [genreResolutionComplete, load, preset]);

  const renderItem = useCallback(
    ({ item }) => (
      <DiscoveryCard
        item={item}
        mediaType={mediaType}
        navigation={navigation}
        providerCatalog={providerCatalog}
      />
    ),
    [mediaType, navigation, providerCatalog],
  );

  if (preset === "subscriptions" && streamingProviderIds.length === 0) return null;
  if (preset === "topGenres" && (normalizedGenreNames.length !== 3 || (genreResolutionComplete && genreIds.length !== 3))) return null;
  if (!loading && items.length === 0) return null;

  return (
    <View style={styles.section}>
      <SeeAllHeader
        title={section.title}
        onPress={() =>
          navigation.navigate("SeeAllScreen", {
            mediaType,
            section: preset,
            title: section.title,
            genreIds: preset === "topGenres" ? genreIds : undefined,
          })
        }
      />
      <Text allowFontScaling={false} style={[styles.subtitle, { color: theme.text.muted }]}>
        {section.subtitle}
      </Text>
      {preset === "subscriptions" && (
        <Text allowFontScaling={false} style={[styles.attribution, { color: theme.text.muted }]}>
          Watch provider data by JustWatch
        </Text>
      )}
      {loading ? (
        <RailSkeleton />
      ) : (
        <PaginatedRail
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.rail}
          onLoadMore={() => load(page + 1, true)}
          loadingMore={loadingMore}
          hasMore={page < totalPages}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: 12 },
  subtitle: { fontSize: 11, marginTop: -10, paddingHorizontal: 15, marginBottom: 12 },
  attribution: { fontSize: 9, paddingHorizontal: 15, marginTop: -7, marginBottom: 12 },
  rail: { paddingHorizontal: 15 },
  item: { marginRight: 10, marginBottom: 5 },
  rating: { position: "absolute", right: 5, bottom: 10, minWidth: 30, borderRadius: 10, alignItems: "center" },
  ratingText: { color: "#FFD700", fontSize: 12, paddingHorizontal: 4, paddingBottom: 2 },
  badges: { position: "absolute", left: 2, bottom: 8 },
  providerBadges: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  providerBadge: {
    width: 27,
    height: 27,
    padding: 2,
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 4,
    elevation: 4,
  },
  providerLogo: { width: "100%", height: "100%", borderRadius: 6 },
  providerMore: {
    minWidth: 24,
    height: 24,
    marginLeft: -5,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  providerMoreText: { fontSize: 9, fontWeight: "800" },
});
