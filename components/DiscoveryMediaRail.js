import {
  APP_LANGUAGES,
  pickByLanguage,
  tmdbLanguageOf,
  tmdbRegionOf,
} from "../utils/appLanguages";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import axios from "axios";
import { Image } from "expo-image";
import PosterImage from "./PosterImage";
import ListBadges from "./ListBadges";
import { RatingBadge, POSTER_BADGE_POS } from "./PosterInfoBadges";
import PaginatedRail from "./PaginatedRail";
import SectionHeader from "./home/SectionHeader";
import { SectionChipRail } from "./home/SectionChips";
import DiscoverFilterChip from "./home/DiscoverFilterChip";
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
import { sameListIdentity } from "../utils/sameData";
import { adultScoped, dropAdult } from "../utils/homeContentSettings";
import { useHomeDataSettings } from "../hooks/useHomeContentSettings";
import {
  WORLD_TOUR_DEFAULT,
  WORLD_TOUR_LANGUAGES,
  worldTourChipLabel,
  worldTourDiscoverParams,
  worldTourEmptyText,
  worldTourSeeAllTitle,
  worldTourTitle,
} from "../utils/worldTour";

const EMPTY_GENRES = Object.freeze([]);

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

// Dışarıya açık: "Favorilerine Göre" rayı (components/favorites) aynı posteri,
// aynı rozet/uzun basma davranışıyla kullanıyor. `onOpen` açılıştan hemen önce
// çağrılır (ölçüm için); sağlanmazsa davranış aynı.
export const DiscoveryCard = memo(function DiscoveryCard({
  item,
  mediaType,
  navigation,
  providerCatalog,
  onOpen,
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
      onPress={() => {
        onOpen?.(item);
        navigation.push(mediaType === "movie" ? "MovieDetails" : "TvShowsDetails", {
          id: item.id,
        });
      }}
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

export default function DiscoveryMediaRail({
  mediaType,
  preset,
  navigation,
  genreNames = EMPTY_GENRES,
  genreIds: preferredGenreIds = EMPTY_GENRES,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { streamingProviderIds } = useStreamingProviderSettings();
  // Yetişkin izni: `/discover` sonucunu değiştirir. Önbellek anahtarı kapsamlanır ve
  // `load` bu değere bağlıdır — ayar değişince ray yeniden yüklenir
  // (bkz. utils/homeContentSettings.js).
  const { adultContent } = useHomeDataSettings();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [providerCatalog, setProviderCatalog] = useState({});
  const itemsRef = useRef([]);
  const loadGenRef = useRef(0);
  // Effect bağımlılıklarını dizi referansına değil içeriğine bağla. Context aynı
  // üç türü yeni bir Array olarak yayınladığında bunu tercih değişikliği sanmak,
  // tür çözümünü tekrar başlatıp posterleri sürekli skeleton'a çeviriyordu.
  const preferredGenreIdsKey = [...new Set((preferredGenreIds || []).map(Number))]
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 3)
    .join("|");
  const normalizedPreferredGenreIds = useMemo(
    () => preferredGenreIdsKey
      ? preferredGenreIdsKey.split("|").map(Number)
      : EMPTY_GENRES,
    [preferredGenreIdsKey],
  );
  const [resolvedGenreIds, setResolvedGenreIds] = useState(normalizedPreferredGenreIds);
  const [genreResolutionComplete, setGenreResolutionComplete] = useState(preset !== "topGenres");
  // Dünya Turu: seçili özgün dil (çip satırı). Diğer preset'lerde kullanılmaz.
  const [worldLanguage, setWorldLanguage] = useState(WORLD_TOUR_DEFAULT);

  // Metinler tr/en/es; bilinmeyen dil İngilizce (utils/appLanguages.pickByLanguage).
  const L = (tr, en, es, pt, de) => pickByLanguage(language, { tr, en, es, pt: pt ?? en, de: de ?? en });
  const genreNamesKey = JSON.stringify(
    [...new Set((genreNames || []).filter((name) => name && name !== "-"))].slice(0, 3),
  );
  const normalizedGenreNames = useMemo(
    () => JSON.parse(genreNamesKey),
    [genreNamesKey],
  );
  // Başlıklar burada; alt başlıklar utils/homeSectionCopy tablosunda (SectionHeader `section` ile alır).
  // Tek istisna "Favori Türlerin": alt başlık kullanıcının üç türünün adı (yoksa tablodaki cümle).
  const section = useMemo(() => {
    if (preset === "subscriptions") {
      return { title: L("Platform Favorileri", "Service Favorites", "Favoritos de tus plataformas", "Favoritos dos seus serviços", "Favoriten der Dienste") };
    }
    if (preset === "worldTour") {
      return { title: worldTourTitle(language) };
    }
    if (preset === "topGenres") {
      return {
        title: L("Favori Türlerin", "Favorite Genres", "Tus géneros favoritos", "Seus gêneros favoritos", "Lieblingsgenres"),
        subtitle: normalizedGenreNames.join("  •  ") || undefined,
      };
    }
    return { title: L("Yeni Beğenilenler", "Recent Favorites", "Favoritos recientes", "Favoritos recentes", "Aktuelle Favoriten") };
  }, [language, normalizedGenreNames, preset]);

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
              language: tmdbLanguageOf(language),
              watch_region: tmdbRegionOf(language),
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
  }, [API_KEY, language, mediaType, preset, streamingProviderIds]);

  useEffect(() => {
    if (preset !== "topGenres") return;
    let active = true;
    setGenreResolutionComplete(false);
    setResolvedGenreIds(normalizedPreferredGenreIds);

    if (normalizedPreferredGenreIds.length > 0) {
      setGenreResolutionComplete(true);
      return () => { active = false; };
    }

    if (normalizedGenreNames.length !== 3) {
      setGenreResolutionComplete(true);
      return () => { active = false; };
    }

    const loadGenreIds = async () => {
      try {
        // Tür adları, kaydedildiği andaki uygulama dilinde gelebilir: desteklenen HER dilin kataloğu.
        const catalogs = await Promise.all(APP_LANGUAGES.map((entry) => entry.tmdbLanguage).map(async (locale) => {
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
        if (active) setResolvedGenreIds(resolveGenreIds(normalizedGenreNames, ...catalogs));
      } catch (error) {
        if (__DEV__) console.error("Discovery genre resolver:", error?.message || error);
      } finally {
        if (active) setGenreResolutionComplete(true);
      }
    };
    loadGenreIds();
    return () => { active = false; };
  }, [API_KEY, mediaType, normalizedGenreNames, normalizedPreferredGenreIds, preset]);

  const buildParams = useCallback(
    (requestedPage) => {
      const params = {
        language: tmdbLanguageOf(language),
        page: requestedPage,
        sort_by: "popularity.desc",
        "vote_count.gte": 300,
      };

      // Dünya Turu: sıralama ve eşikler utils/worldTour'dan (Tümü ekranıyla aynı kural).
      if (preset === "worldTour") Object.assign(params, worldTourDiscoverParams(worldLanguage));

      if (preset === "subscriptions") {
        params.watch_region = tmdbRegionOf(language);
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
        params.with_genres = resolvedGenreIds.join("|");
      }

      return params;
    },
    [resolvedGenreIds, language, mediaType, preset, streamingProviderIds, worldLanguage],
  );

  const load = useCallback(
    async (requestedPage = 1, append = false) => {
      // İSTEK JENERASYONU. Ayar (platform, yetişkin izni) hızlı art arda değişince
      // birkaç yükleme aynı anda uçuşta olur; yavaş gelen ESKİ sonuç, daha yeni
      // seçimin sonucunun üstüne yazılıyordu. Tazelemeler jenerasyonu artırır,
      // sayfa ekleme (append) mevcut jenerasyona bağlı kalır; eskimiş sonuç
      // yalnız önbelleğe (kendi doğru anahtarına) yazılır, ekrana yansımaz.
      const gen = append ? loadGenRef.current : ++loadGenRef.current;
      const isCurrent = () => gen === loadGenRef.current;
      if (preset === "subscriptions" && streamingProviderIds.length === 0) {
        itemsRef.current = [];
        setItems([]);
        setLoading(false);
        return;
      }
      if (preset === "topGenres" && resolvedGenreIds.length === 0) {
        itemsRef.current = [];
        setItems([]);
        setLoading(false);
        return;
      }

      if (append) setLoadingMore(true);
      else if (itemsRef.current.length === 0) setLoading(true);
      const filterKey = preset === "subscriptions"
        ? streamingProviderIds.join("-")
        : preset === "topGenres"
          ? resolvedGenreIds.join("-")
          : preset === "worldTour"
            ? worldLanguage
            : "all";
      const cacheKey = adultScoped(
        `discovery_v2_${mediaType}_${preset}_${language}_${filterKey}_${requestedPage}`,
        adultContent,
      );
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
        // Önbelleğe, isteğin BAŞINDA hesaplanan anahtara yazılır; ekran artık
        // başka bir ayardaysa bile kayıt kendi kapsamında doğru kalır.
        if (!cached) setCachedValue(cacheKey, data);
        if (!isCurrent()) return;
        const results = dropAdult(data.results || [], adultContent).filter(
          (item) => item.poster_path,
        );
        setItems((current) => {
          const next = append ? mergeUnique(current, results) : results;
          if (sameListIdentity(current, next)) {
            itemsRef.current = current;
            return current;
          }
          itemsRef.current = next;
          return next;
        });
        setPage(requestedPage);
        setTotalPages(Math.min(data.total_pages || 1, 20));
      } catch (error) {
        if (__DEV__) console.error("DiscoveryMediaRail:", error?.message || error);
        // Önceden çizilmiş önerileri geçici ağ hatasında koru. İlk yükleme
        // başarısızsa zaten boş kalır; yenilemede posterler yanıp sönmez.
        if (isCurrent() && !append && itemsRef.current.length === 0) setItems([]);
      } finally {
        // Ekleme göstergesi kendi isteğine ait: eskimiş olsa da kapanmalı. Ana
        // yükleme göstergesini ise yalnız GÜNCEL yükleme kapatır — yoksa daha
        // yeni bir yükleme sürerken ray boş görünürdü.
        if (append) setLoadingMore(false);
        else if (isCurrent()) setLoading(false);
      }
    },
    [
      API_KEY,
      adultContent,
      buildParams,
      resolvedGenreIds,
      language,
      mediaType,
      preset,
      streamingProviderIds,
      worldLanguage,
    ],
  );

  // Çip değişince eski dilin posterleri yeni dilin yüklenmesi sürerken görünmesin: liste boşaltılıp
  // iskelet gösterilir (yükleme jenerasyonu `load` içinde artar, eski dilin geç yanıtı ekrana yazmaz).
  const pickWorldLanguage = useCallback(
    (code) => {
      if (code === worldLanguage) return;
      itemsRef.current = [];
      setItems([]);
      setLoading(true);
      setWorldLanguage(code);
    },
    [worldLanguage],
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
  if (
    preset === "topGenres" &&
    normalizedPreferredGenreIds.length === 0 &&
    (normalizedGenreNames.length !== 3 ||
      (genreResolutionComplete && resolvedGenreIds.length !== 3))
  ) return null;
  // Dünya Turu boş kalsa bile çipler görünür kalır: seçilen dilde sonuç yoksa kullanıcı başka dile
  // geçebilmeli (rafı tümden gizlemek onu çıkışsız bırakırdı).
  const isWorldTour = preset === "worldTour";
  if (!loading && items.length === 0 && !isWorldTour) return null;

  return (
    <View style={styles.section}>
      <SectionHeader
        title={section.title}
        subtitle={section.subtitle}
        section={preset}
        mediaType={mediaType}
        onPressAction={() =>
          navigation.navigate("SeeAllScreen", {
            mediaType,
            section: preset,
            title: isWorldTour ? worldTourSeeAllTitle(worldLanguage, language) : section.title,
            genreIds: preset === "topGenres" ? resolvedGenreIds : undefined,
            originalLanguage: isWorldTour ? worldLanguage : undefined,
          })
        }
      >
        {isWorldTour ? (
          <SectionChipRail
            data={WORLD_TOUR_LANGUAGES}
            keyExtractor={(entry) => entry.code}
            extraData={worldLanguage}
            renderChip={(entry) => (
              <DiscoverFilterChip
                label={worldTourChipLabel(entry.code, language)}
                selected={worldLanguage === entry.code}
                onPress={() => pickWorldLanguage(entry.code)}
              />
            )}
          />
        ) : null}
      </SectionHeader>
      {loading ? (
        <RailSkeleton />
      ) : isWorldTour && items.length === 0 ? (
        <Text
          allowFontScaling={false}
          style={[styles.empty, { color: theme.text.muted }]}
        >
          {worldTourEmptyText(language)}
        </Text>
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
  section: { paddingVertical: 10 },
  rail: { paddingHorizontal: 15 },
  empty: { paddingHorizontal: 15, paddingVertical: 24, fontSize: 13 },
  item: { marginRight: 10, marginBottom: 5 },
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
