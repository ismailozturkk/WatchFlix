// SeeAllScreen — TV & Film ana ekranlarındaki bölümlerin "Tümünü Gör" hedefi.
//
// Dikey bir poster grid'i gösterir (sütun sayısı ve köşe yuvarlaklığı
// Ayarlar'dan veya header sağındaki kontrollerden seçilir — seeAll* ayarları).
// Aşağı indikçe (onEndReached) mevcut bölümün sonraki sayfasını doğal şekilde
// sona ekler (sonsuz kaydırma). Veri ve sayfalama tamamen ilgili context'in
// (MovieContex / TvShowContex) kendi fetch/pagination mantığından gelir.
//
// Route params: { mediaType: "movie" | "tv", section: string, title: string,
//                 genreIds?: number[], providerId?: number }
//   movie section: "trends" | "bests" | "nowPlaying" | "upcoming"
//   tv    section: "trends" | "best"  | "airingToday" | "onTheAir"
//   ortak: "genres" (genreIds ile) | "providers" (providerId ile) |
//          "subscriptions" | "recentFavorites" | "hiddenGems" — bunlar
//          context yerine bağımsız discover isteğiyle yüklenir (bkz. DiscoverSeeAll).
//
// Not: MovieProvider yalnız Movies sekmesini sardığı için (uygulama kökünde
// değil), film dalı kendi MovieProvider örneğiyle sarılır — bağımsız olarak
// 1. sayfadan yükler. TvShowProvider uygulama kökünde olduğundan dizi dalı
// doğrudan mevcut context'i kullanır.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Animated,
} from "react-native";
import axios from "axios";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/BackButton";
import PosterImage from "@components/PosterImage";
import ListBadges from "../../components/ListBadges";
import ScreenDecor from "../../components/ScreenDecor";
import { useTheme } from "@context/ThemeContext";
import { MovieProvider, useMovie } from "@context/MovieContex";
import { useTvShow } from "@context/TvShowContex";
import {
  useListLayoutSettings,
  useApiSettings,
  useStreamingProviderSettings,
} from "@context/AppSettingsContext";
import { useLanguage } from "@context/LanguageContext";

const { width } = Dimensions.get("window");
const SIDE = 12;
const COL_GAP = 10;
// Sütun sayısına göre afiş genişliği (poster oranı 2:3 → yükseklik = genişlik*1.5)
const itemWidthFor = (columns) =>
  (width - SIDE * 2 - COL_GAP * (columns - 1)) / columns;

const isSpacer = (x) =>
  !x || x.id === "left-spacer" || x.id === "right-spacer" || !x.poster_path;

// Diziyi `size`'lık satırlara böler.
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Tek poster kartı — modül kapsamında memo → yeniden mount/flicker olmaz.
const PosterCard = React.memo(function PosterCard({
  item,
  mediaType,
  theme,
  radius,
  itemW,
  itemH,
  navigation,
}) {
  const { posterBadges } = useListLayoutSettings();
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.92, duration: 150, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() =>
        navigation.push(
          mediaType === "movie" ? "MovieDetails" : "TvShowsDetails",
          { id: item.id },
        )
      }
      style={[styles.item, { width: itemW }]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <PosterImage
          path={item.poster_path}
          type={mediaType}
          size={200}
          style={[
            styles.poster,
            { width: itemW, height: itemH, borderRadius: radius, shadowColor: theme.shadow },
          ]}
          cachePolicy="memory-disk"
          recyclingKey={`seeall-${mediaType}-${item.id}`}
          transition={120}
        />
        {posterBadges?.tmdbRating !== false && typeof item.vote_average === "number" ? (
          <View style={[styles.rating, { backgroundColor: theme.secondaryt }]}>
            <Text allowFontScaling={false} style={styles.ratingText}>
              {item.vote_average.toFixed(1)}
            </Text>
          </View>
        ) : null}
        <ListBadges
          mediaId={item.id}
          mediaType={mediaType}
          theme={theme}
          style={{ position: "absolute", left: 2, bottom: 8 }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
});

// Header sağındaki kompakt görünüm kontrolleri: sütun (3|4) ve köşe (3 önizleme).
const RADIUS_OPTS = [
  { value: 2, preview: 2 },
  { value: 10, preview: 5 },
  { value: 20, preview: 9 },
];
const LayoutControls = React.memo(function LayoutControls({
  theme,
  columns,
  radius,
  onColumns,
  onRadius,
}) {
  return (
    <View style={styles.controls}>
      <View style={[styles.seg, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        {[3, 4].map((c) => {
          const active = columns === c;
          return (
            <TouchableOpacity
              key={c}
              activeOpacity={0.7}
              onPress={() => onColumns(c)}
              style={[styles.segCell, active && { backgroundColor: theme.accent }]}
            >
              <Text
                allowFontScaling={false}
                style={[
                  styles.segCellText,
                  { color: active ? "#fff" : theme.text.secondary },
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={[styles.seg, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        {RADIUS_OPTS.map((opt) => {
          const active = radius === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              activeOpacity={0.7}
              onPress={() => onRadius(opt.value)}
              style={[styles.segCell, active && { backgroundColor: theme.accent }]}
            >
              <View
                style={{
                  width: 13,
                  height: 16,
                  borderRadius: opt.preview,
                  borderWidth: 1.5,
                  borderColor: active ? "#fff" : theme.text.secondary,
                }}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

// Ortak sunum bileşeni — hangi context'ten geldiğinden bağımsız grid.
function SeeAllGrid({
  title,
  mediaType,
  navigation,
  data,
  loadMore,
  loadingMore,
  hasMore,
  onActivate,
}) {
  const { theme } = useTheme();
  const {
    seeAllGridColumns: columns,
    changeSeeAllGridColumns,
    seeAllPosterRadius: radius,
    changeSeeAllPosterRadius,
  } = useListLayoutSettings();

  const itemW = itemWidthFor(columns);
  const itemH = itemW * 1.5;

  useEffect(() => {
    onActivate?.();
  }, [onActivate]);

  // Spacer/eksik posterleri ele ve id bazında tekilleştir.
  const items = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const x of data || []) {
      if (isSpacer(x)) continue;
      const key = String(x.id);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(x);
    }
    return out;
  }, [data]);

  // Android'de dinamik numColumns'lu FlatList "addViewAt: failed to insert view"
  // çökmesine yol açtığından, çok sütunlu görünümü numColumns yerine elle satırlara
  // bölüp tek sütunlu bir listede satır satır render ediyoruz.
  const rows = useMemo(() => chunk(items, columns), [items, columns]);

  // onEndReached'in mount'ta gereksiz tetiklenmesini engeller — yalnız gerçek
  // bir kaydırma jestinden sonra bir kez çalışır (PaginatedRail ile aynı mantık).
  const canTrigger = useRef(false);
  const handleEndReached = useCallback(() => {
    if (!canTrigger.current) return;
    canTrigger.current = false;
    if (hasMore && !loadingMore) loadMore?.();
  }, [hasMore, loadingMore, loadMore]);

  // Otomatik doldurma: içerik ekranı doldurmuyorsa (ör. 4 sütunda tek sayfa tam
  // sığıyor) liste kaydırılamaz ve onEndReached hiç tetiklenmez. Bu durumda
  // içerik yüksekliği görüntü yüksekliğini aşana kadar sonraki sayfa(lar)
  // otomatik çekilir. Guard: aynı öğe sayısı için yalnız bir kez tetiklenir.
  const listHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const filledAtRef = useRef(-1);
  // onLayout ve onContentSizeChange sırası garanti olmadığından her ikisi de
  // bu kontrolü çağırır; ölçümler ref'te tutulur.
  const runAutoFill = useCallback(() => {
    const listH = listHeightRef.current;
    const contentH = contentHeightRef.current;
    if (!listH || !contentH) return;
    if (
      contentH <= listH + 40 &&
      hasMore &&
      !loadingMore &&
      filledAtRef.current !== items.length
    ) {
      filledAtRef.current = items.length;
      loadMore?.();
    }
  }, [hasMore, loadingMore, items.length, loadMore]);

  // Sütun değişince (poster boyutu → içerik yüksekliği değişir) guard sıfırlanır.
  useEffect(() => {
    filledAtRef.current = -1;
  }, [columns]);

  const renderRow = useCallback(
    ({ item: row }) => (
      <View style={[styles.row, { marginBottom: COL_GAP + 4 }]}>
        {row.map((it) => (
          <PosterCard
            key={String(it.id)}
            item={it}
            mediaType={mediaType}
            theme={theme}
            radius={radius}
            itemW={itemW}
            itemH={itemH}
            navigation={navigation}
          />
        ))}
      </View>
    ),
    [mediaType, theme, radius, itemW, itemH, navigation],
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.primary }]}>
      <ScreenDecor iconOpacity={0.3} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <BackButton absolute={false} />
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.title, { color: theme.text.primary }]}
          >
            {title}
          </Text>
          <LayoutControls
            theme={theme}
            columns={columns}
            radius={radius}
            onColumns={changeSeeAllGridColumns}
            onRadius={changeSeeAllPosterRadius}
          />
        </View>

        <FlatList
          data={rows}
          keyExtractor={(row, i) => `${row[0] ? row[0].id : "r"}-${i}`}
          renderItem={renderRow}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onLayout={(e) => {
            listHeightRef.current = e.nativeEvent.layout.height;
            runAutoFill();
          }}
          onContentSizeChange={(w, h) => {
            contentHeightRef.current = h;
            runAutoFill();
          }}
          onMomentumScrollBegin={() => {
            canTrigger.current = true;
          }}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={theme.accent} />
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </View>
  );
}

// ── Film dalı — kendi MovieProvider örneğiyle sarılı (bkz. dosya başı notu) ──
function MovieSeeAll({ section, title, navigation }) {
  const ctx = useMovie();
  const cfg = {
    trends: {
      data: ctx.movieTrends,
      loadMore: ctx.loadMoreTrends,
      loadingMore: ctx.loadingMoreTrends,
      hasMore: ctx.pageTrends < ctx.totalPagesTrends,
    },
    bests: {
      data: ctx.movieBests,
      loadMore: ctx.loadMoreBests,
      loadingMore: ctx.loadingMoreBests,
      hasMore: ctx.pageBest < ctx.totalPagesBest,
    },
    nowPlaying: {
      data: ctx.moviesNowPlaying,
      loadMore: ctx.loadMoreNowPlaying,
      loadingMore: ctx.loadingMoreNowPlaying,
      hasMore: ctx.pageNowPlaying < ctx.totalPagesNowPlaying,
    },
    upcoming: {
      data: ctx.moviesUpcoming,
      loadMore: ctx.loadMoreUpcoming,
      loadingMore: ctx.loadingMoreUpcoming,
      hasMore: ctx.pageUpcoming < ctx.totalPagesUpcoming,
    },
  }[section];

  const onActivate = useCallback(() => {
    ctx.activateMovieSection?.(section);
  }, [ctx.activateMovieSection, section]);

  return (
    <SeeAllGrid
      title={title}
      mediaType="movie"
      navigation={navigation}
      data={cfg?.data}
      loadMore={cfg?.loadMore}
      loadingMore={cfg?.loadingMore}
      hasMore={!!cfg?.hasMore}
      onActivate={onActivate}
    />
  );
}

// ── Dizi dalı — uygulama kökündeki TvShowProvider'ı kullanır ──
function TvSeeAll({ section, title, navigation }) {
  const ctx = useTvShow();
  const cfg = {
    trends: {
      data: ctx.seriesTrend,
      loadMore: ctx.loadMoreTrend,
      loadingMore: ctx.loadingMoreTrend,
      hasMore: ctx.pageTrend < ctx.totalPagesTrend,
    },
    best: {
      data: ctx.seriesBest,
      loadMore: ctx.loadMoreBest,
      loadingMore: ctx.loadingMoreBest,
      hasMore: ctx.pageBest < ctx.totalPagesBest,
    },
    airingToday: {
      data: ctx.moviesAiringToday,
      loadMore: ctx.loadMoreAiringToday,
      loadingMore: ctx.loadingMoreAiringToday,
      hasMore: ctx.pageAiringToday < ctx.totalPagesAiringToday,
    },
    onTheAir: {
      data: ctx.moviesOnTheAir,
      loadMore: ctx.loadMoreOnTheAir,
      loadingMore: ctx.loadingMoreOnTheAir,
      hasMore: ctx.pageOnTheAir < ctx.totalPagesOnTheAir,
    },
  }[section];

  const onActivate = useCallback(() => {
    ctx.activateTvSection?.(section);
  }, [ctx.activateTvSection, section]);

  return (
    <SeeAllGrid
      title={title}
      mediaType="tv"
      navigation={navigation}
      data={cfg?.data}
      loadMore={cfg?.loadMore}
      loadingMore={cfg?.loadingMore}
      hasMore={!!cfg?.hasMore}
      onActivate={onActivate}
    />
  );
}

// ── Tür / Sağlayıcı dalı — kendi kendine yeten sayfalı discover isteği ──
// Genres ve Providers bölümlerinin ana context'i (Film tarafında sekmeye özel,
// üstelik SeeAllScreen kök yığında olduğundan erişilemez) yerine, seçilen
// filtreyi (genreIds / providerId) doğrudan TMDB discover'a vererek bağımsız
// yükler. Böylece taze MovieProvider'ın ilk sağlayıcıyı otomatik seçmesi gibi
// yan etkiler tamamen atlanır.
function useDiscoverPagination({ mediaType, genreIds, providerId, preset }) {
  const { API_KEY } = useApiSettings();
  const { language } = useLanguage();
  const { streamingProviderIds } = useStreamingProviderSettings();
  const tmdbLanguage = language === "tr" ? "tr-TR" : "en-US";
  const tmdbRegion = language === "tr" ? "TR" : "US";

  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const isProviders = providerId != null;
  const genresKey = Array.isArray(genreIds) ? [...genreIds].sort().join(",") : "";

  const buildUrl = useCallback(
    (pageNum) => {
      const base = mediaType === "movie" ? "movie" : "tv";
      if (preset) {
        const params = new URLSearchParams({
          language: tmdbLanguage,
          page: String(pageNum),
          include_adult: "false",
          sort_by: preset === "hiddenGems" ? "vote_average.desc" : "popularity.desc",
          "vote_count.gte": preset === "hiddenGems" ? "120" : "300",
        });

        if (preset === "subscriptions") {
          params.set("watch_region", tmdbRegion);
          params.set("with_watch_providers", streamingProviderIds.join("|"));
          params.set("with_watch_monetization_types", "flatrate");
        }

        if (preset === "recentFavorites") {
          const date = new Date();
          date.setFullYear(date.getFullYear() - 5);
          params.set(
            mediaType === "movie" ? "primary_release_date.gte" : "first_air_date.gte",
            date.toISOString().slice(0, 10),
          );
          params.set("vote_average.gte", "7");
        }

        if (preset === "topGenres" && genresKey) {
          params.set("with_genres", genresKey.replaceAll(",", "|"));
        }

        return `https://api.themoviedb.org/3/discover/${base}?${params.toString()}`;
      }
      if (isProviders) {
        return `https://api.themoviedb.org/3/discover/${base}?language=${tmdbLanguage}&watch_region=${tmdbRegion}&with_watch_providers=${providerId}&sort_by=vote_count.desc&page=${pageNum}`;
      }
      let url = `https://api.themoviedb.org/3/discover/${base}?language=${tmdbLanguage}&page=${pageNum}`;
      if (genresKey) url += `&with_genres=${genresKey}`;
      return url;
    },
    [
      mediaType,
      preset,
      isProviders,
      providerId,
      genresKey,
      tmdbLanguage,
      tmdbRegion,
      streamingProviderIds,
    ],
  );

  const fetchPage = useCallback(
    async (pageNum, append) => {
      if (preset === "subscriptions" && streamingProviderIds.length === 0) {
        if (mounted.current) {
          setData([]);
          setTotalPages(1);
        }
        return false;
      }
      try {
        const res = await axios.get(buildUrl(pageNum), {
          headers: { Authorization: API_KEY },
        });
        if (!mounted.current) return false;
        const results = res.data.results || [];
        setTotalPages(res.data.total_pages || 1);
        setData((prev) => {
          if (!append) return results;
          const seen = new Set(prev.map((x) => x && x.id));
          return [...prev, ...results.filter((x) => x && !seen.has(x.id))];
        });
        return true;
      } catch (e) {
        if (__DEV__) console.error("DiscoverSeeAll:", e?.message || e);
        return false;
      }
    },
    [buildUrl, API_KEY, preset, streamingProviderIds.length],
  );

  // İlk sayfa — filtre (buildUrl) değişince baştan yükle.
  useEffect(() => {
    setData([]);
    setPage(1);
    setTotalPages(1);
    fetchPage(1, false);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;
    const next = page + 1;
    setLoadingMore(true);
    // Sayaç yalnızca başarılı fetch'te ilerler; aksi halde geçici bir ağ
    // hatası o sayfayı kalıcı olarak atlatır (bir sonraki scroll page+2 çeker).
    const ok = await fetchPage(next, true);
    if (mounted.current) {
      if (ok) setPage(next);
      setLoadingMore(false);
    }
  }, [loadingMore, page, totalPages, fetchPage]);

  return { data, loadMore, loadingMore, hasMore: page < totalPages };
}

function DiscoverSeeAll({
  mediaType,
  title,
  genreIds,
  providerId,
  preset,
  navigation,
}) {
  const feed = useDiscoverPagination({ mediaType, genreIds, providerId, preset });
  return (
    <SeeAllGrid
      title={title}
      mediaType={mediaType}
      navigation={navigation}
      data={feed.data}
      loadMore={feed.loadMore}
      loadingMore={feed.loadingMore}
      hasMore={feed.hasMore}
    />
  );
}

export default function SeeAllScreen({ route, navigation }) {
  const { mediaType, section, title, genreIds, providerId } = route.params || {};

  // Genres / Providers: taze context yerine bağımsız discover akışı.
  if (
    section === "genres" ||
    section === "providers" ||
    section === "subscriptions" ||
    section === "topGenres" ||
    section === "recentFavorites" ||
    section === "hiddenGems"
  ) {
    return (
      <DiscoverSeeAll
        mediaType={mediaType}
        title={title}
        genreIds={genreIds}
        providerId={providerId}
        preset={
          section === "subscriptions" ||
          section === "topGenres" ||
          section === "recentFavorites" ||
          section === "hiddenGems"
            ? section
            : undefined
        }
        navigation={navigation}
      />
    );
  }

  if (mediaType === "movie") {
    return (
      <MovieProvider>
        <MovieSeeAll section={section} title={title} navigation={navigation} />
      </MovieProvider>
    );
  }
  return <TvSeeAll section={section} title={title} navigation={navigation} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: SIDE,
    paddingTop: 6,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
  },
  controls: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  seg: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  segCell: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  segCellText: {
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: SIDE,
    paddingBottom: 90,
  },
  row: {
    flexDirection: "row",
    gap: COL_GAP,
  },
  item: {
    marginBottom: 0,
  },
  poster: {
    borderRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  rating: {
    position: "absolute",
    bottom: 8,
    right: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  ratingText: {
    color: "#ffd700",
    fontSize: 11,
    fontWeight: "700",
  },
  footer: {
    paddingVertical: 20,
    alignItems: "center",
    width: "100%",
  },
  empty: {
    paddingTop: 80,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
});
