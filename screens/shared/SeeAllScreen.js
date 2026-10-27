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
//          "subscriptions" | "recentFavorites" | "worldTour" (originalLanguage ile) — bunlar
//          context yerine bağımsız discover isteğiyle yüklenir (bkz. DiscoverSeeAll).
//          "fromFavorites" — dört favoriden türeyen öneriler (bkz. FavoritesSeeAll).
//
// Not: MovieProvider yalnız Movies sekmesini sardığı için (uygulama kökünde
// değil), film dalı kendi MovieProvider örneğiyle sarılır — bağımsız olarak
// 1. sayfadan yükler. TvShowProvider uygulama kökünde olduğundan dizi dalı
// doğrudan mevcut context'i kullanır.

import { tmdbLanguageOf, tmdbRegionOf } from "../../utils/appLanguages";
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
// Ekran kökü: Premium şeridi yüzerken üst boşluğu ona göre büyür.
import SafeAreaView from "@components/common/ScreenSafeAreaView";
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
import { useMediaQuickActions } from "@context/MediaQuickActionsContext";
import AppIcon from "../../components/AppIcon";
import { LinearGradient } from "expo-linear-gradient";
import { toast } from "../../components/AppToast";
import { i18nText } from "../../utils/i18nText";
import { useUserProfile } from "../../context/UserProfileContext";
import { useListStatusContext } from "../../context/ListStatusContext";
import { fetchFavoriteRecommendations } from "../../services/favoriteRecommendations";
import { getFavoritesCopy } from "../../utils/favoritesCopy";
import { readProfileFavorites, recommendationSources } from "../../utils/fourFavorites";
import GlassTouchable from "../../components/common/GlassTouchable";
import { useLiquidGlass } from "../../services/liquidGlass";
import { worldTourDiscoverParams } from "../../utils/worldTour";
import UpcomingFilterChips from "../../components/home/UpcomingFilterChips";
import UpcomingFilterSheet from "../../components/home/UpcomingFilterSheet";
import UpcomingEmptyState from "../../components/home/UpcomingEmptyState";
import useUpcomingFilterControls from "../../hooks/useUpcomingFilterControls";
import { isUpcomingCustomized } from "../../utils/upcomingFilters";

const { width } = Dimensions.get("window");
const SIDE = 12;
const COL_GAP = 10;
// Sütun sayısına göre afiş genişliği (poster oranı 2:3 → yükseklik = genişlik*1.5)
const itemWidthFor = (columns) =>
  (width - SIDE * 2 - COL_GAP * (columns - 1)) / columns;

const isSpacer = (x) =>
  !x || x.id === "left-spacer" || x.id === "right-spacer" || (!x.poster_path && !x.isPending);

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
  const { openQuickActions } = useMediaQuickActions();
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.92, duration: 150, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();

  if (item?.isPending) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => {
          const year = String(item.year || 2027);
          const pendingToastMsg =
            mediaType === "tv"
              ? i18nText("autoI18n.emmy_pending_toast", "{{year}} yılı Emmy kazananı henüz açıklanmadı.", { year })
              : i18nText("autoI18n.oscar_pending_toast", "{{year}} yılı Oscar kazananı henüz açıklanmadı.", { year });
          toast.info(pendingToastMsg);
        }}
        style={[styles.item, { width: itemW }]}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <LinearGradient
            colors={["#2c2411", "#1a1608", "#0d0b04"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.poster,
              {
                width: itemW,
                height: itemH,
                borderRadius: radius,
                borderWidth: 1,
                borderColor: "rgba(255, 215, 0, 0.4)",
                justifyContent: "center",
                alignItems: "center",
                padding: 4,
              },
            ]}
          >
            <AppIcon
              family="MaterialCommunityIcons"
              name="trophy-award"
              size={Math.max(18, itemW * 0.26)}
              color="#ffd700"
            />
            <Text
              allowFontScaling={false}
              style={{
                color: "#ffd700",
                fontWeight: "800",
                fontSize: Math.max(10, itemW * 0.13),
                marginTop: 3,
              }}
            >
              {item.year}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={{
                color: "#e6c65c",
                fontSize: Math.max(8, itemW * 0.08),
                textAlign: "center",
                marginTop: 2,
                fontWeight: "600",
              }}
            >
              {mediaType === "tv"
                ? i18nText("autoI18n.emmy_pending_title", "Emmy Ödülleri")
                : i18nText("autoI18n.oscar_pending_title", "Oscar En İyi Film")}
            </Text>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  }

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
      onLongPress={() => openQuickActions({ item, mediaType, navigation })}
      delayLongPress={350}
      style={[styles.item, { width: itemW }]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <PosterImage
          path={item.poster_path}
          type={mediaType}
          mediaId={item.id}
          size={200}
          style={[
            styles.poster,
            { width: itemW, height: itemH, borderRadius: radius, shadowColor: theme.shadow },
          ]}
          cachePolicy="memory-disk"
          recyclingKey={`seeall-${mediaType}-${item.year ? `award-${item.year}-${item.categoryKey || ""}-` : ""}${item.id}`}
          transition={120}
        />
        {item?.year ? (
          <View style={styles.oscarYearBadge}>
            <Text allowFontScaling={false} style={styles.oscarYearBadgeText}>
              {item.year}
            </Text>
          </View>
        ) : null}
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
          posterWidth={itemW}
          style={styles.listBadges}
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
  // Camda kap KIRPMAZ: seçili hücrenin camı kabın çocuğu, basılınca kap sınırında kesilirdi.
  // Köşeler bu yüzden hücrede (kabın iç köşesi = 10 − 1 pt çerçeve).
  const glass = useLiquidGlass();
  const segStyle = [styles.seg, !glass && styles.segClip, { backgroundColor: theme.secondary, borderColor: theme.border }];
  const cellStyle = [styles.segCell, glass && styles.segCellGlass];
  return (
    <View style={styles.controls}>
      <View style={segStyle}>
        {[3, 4].map((c) => {
          const active = columns === c;
          return (
            <GlassTouchable
              key={c}
              activeOpacity={0.7}
              onPress={() => onColumns(c)}
              style={[cellStyle, active && { backgroundColor: theme.accent }]}
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
            </GlassTouchable>
          );
        })}
      </View>
      <View style={segStyle}>
        {RADIUS_OPTS.map((opt) => {
          const active = radius === opt.value;
          return (
            <GlassTouchable
              key={opt.value}
              activeOpacity={0.7}
              onPress={() => onRadius(opt.value)}
              style={[cellStyle, active && { backgroundColor: theme.accent }]}
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
            </GlassTouchable>
          );
        })}
      </View>
    </View>
  );
});

// Ortak sunum bileşeni — hangi context'ten geldiğinden bağımsız grid.
// `emptyComponent`: liste boşken gösterilecek öğe (varsayılan: yükleniyor göstergesi). Filtreli Keşif
// (screens/shared/DiscoverFiltersScreen.js) "sonuç yok" ve "yüklenemedi" durumlarını buradan verir.
export function SeeAllGrid({
  title,
  mediaType,
  navigation,
  data,
  loadMore,
  loadingMore,
  hasMore,
  onActivate,
  headerExtra,
  emptyComponent,
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
      const key = x.year ? `oscar-${x.year}-${x.categoryKey || ""}-${x.id}` : String(x.id);
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
    ({ item: row, index: rIdx }) => (
      <View style={[styles.row, { marginBottom: COL_GAP + 4 }]}>
        {row.map((it, cIdx) => (
          <PosterCard
            key={it.year ? `oscar-${it.year}-${it.categoryKey || ""}-${it.id || `${rIdx}_${cIdx}`}` : `${it.id || `${rIdx}_${cIdx}`}`}
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
      <ScreenDecor scope="home" iconOpacity={0.3} />
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

        {headerExtra ? <View style={{ paddingBottom: 6 }}>{headerExtra}</View> : null}

        <FlatList
          data={rows}
          keyExtractor={(row, i) =>
            `${row[0] ? (row[0].year ? `oscar-${row[0].year}-${row[0].categoryKey || ""}-${row[0].id}` : row[0].id) : "r"}-${i}`
          }
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
          onScrollBeginDrag={() => {
            canTrigger.current = true;
          }}
          onMomentumScrollBegin={() => {
            canTrigger.current = true;
          }}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.8}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={false}
          ListEmptyComponent={
            emptyComponent ?? (
              <View style={styles.empty}>
                <ActivityIndicator size="large" color={theme.accent} />
              </View>
            )
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
    oscar: {
      data: ctx.moviesOscar,
      loadMore: ctx.loadMoreOscar,
      loadingMore: ctx.loadingMoreOscar,
      hasMore: ctx.hasMoreOscar,
    },
  }[section];

  const { theme } = useTheme();

  const onActivate = useCallback(() => {
    ctx.activateMovieSection?.(section);
  }, [ctx.activateMovieSection, section]);

  const headerExtra = useMemo(() => {
    if (section !== "oscar" || !ctx.OSCAR_CATEGORIES) return null;
    return (
      <FlatList
        data={ctx.OSCAR_CATEGORIES}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        renderItem={({ item }) => {
          const isSelected = ctx.selectedOscarCategory === item.key;
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                ctx.changeOscarCategory?.(item.key);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 14,
                borderWidth: 1,
                backgroundColor: isSelected ? theme.accent : theme.secondary,
                borderColor: isSelected ? theme.accent : theme.border,
              }}
            >
              <AppIcon
                family="MaterialCommunityIcons"
                name={item.icon || "trophy"}
                size={13}
                color={isSelected ? "#ffffff" : theme.text.secondary}
              />
              <Text
                allowFontScaling={false}
                style={{
                  fontSize: 11,
                  color: isSelected ? "#ffffff" : theme.text.secondary,
                  fontWeight: isSelected ? "700" : "500",
                }}
              >
                {i18nText(item.labelKey, item.tr)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    );
  }, [section, ctx.OSCAR_CATEGORIES, ctx.selectedOscarCategory, ctx.changeOscarCategory, theme]);

  // Yaklaşan Filmler: raftakiyle AYNI çip satırı + filtre sayfası. Süzgeç depoda (useUpcomingFilters):
  // burada değişince ana ekrandaki raf da güncellenir.
  const upcoming = useUpcomingFilterControls("see_all");
  const isUpcoming = section === "upcoming";
  const upcomingEmpty =
    isUpcoming && !ctx.loadingUpcoming && isUpcomingCustomized(upcoming.filters) ? (
      <UpcomingEmptyState onReset={upcoming.reset} style={styles.upcomingEmpty} />
    ) : undefined;

  return (
    <>
      <SeeAllGrid
        title={title}
        mediaType="movie"
        navigation={navigation}
        data={cfg?.data}
        loadMore={cfg?.loadMore}
        loadingMore={cfg?.loadingMore}
        hasMore={!!cfg?.hasMore}
        onActivate={onActivate}
        headerExtra={
          isUpcoming ? (
            <UpcomingFilterChips
              filters={upcoming.filters}
              onOpenFilters={upcoming.openSheet}
              onSelectRange={upcoming.selectRange}
            />
          ) : (
            headerExtra
          )
        }
        emptyComponent={upcomingEmpty}
      />
      {isUpcoming ? (
        <UpcomingFilterSheet
          visible={upcoming.sheetVisible}
          onClose={upcoming.closeSheet}
          filters={upcoming.filters}
          onApply={upcoming.applyFromSheet}
          region={upcoming.region}
        />
      ) : null}
    </>
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
    emmy: {
      data: ctx.tvShowsEmmy,
      loadMore: ctx.loadMoreEmmy,
      loadingMore: ctx.loadingMoreEmmy,
      hasMore: ctx.hasMoreEmmy,
    },
  }[section];

  const { theme } = useTheme();

  const onActivate = useCallback(() => {
    ctx.activateTvSection?.(section);
  }, [ctx.activateTvSection, section]);

  const headerExtra = useMemo(() => {
    if (section !== "emmy" || !ctx.EMMY_CATEGORIES) return null;
    return (
      <FlatList
        data={ctx.EMMY_CATEGORIES}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        renderItem={({ item }) => {
          const isSelected = ctx.selectedEmmyCategory === item.key;
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                ctx.changeEmmyCategory?.(item.key);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 14,
                borderWidth: 1,
                backgroundColor: isSelected ? theme.accent : theme.secondary,
                borderColor: isSelected ? theme.accent : theme.border,
              }}
            >
              <AppIcon
                family="MaterialCommunityIcons"
                name={item.icon || "trophy"}
                size={13}
                color={isSelected ? "#ffffff" : theme.text.secondary}
              />
              <Text
                allowFontScaling={false}
                style={{
                  fontSize: 11,
                  color: isSelected ? "#ffffff" : theme.text.secondary,
                  fontWeight: isSelected ? "700" : "500",
                }}
              >
                {i18nText(item.labelKey, item.tr)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    );
  }, [section, ctx.EMMY_CATEGORIES, ctx.selectedEmmyCategory, ctx.changeEmmyCategory, theme]);

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
      headerExtra={headerExtra}
    />
  );
}

// ── Tür / Sağlayıcı dalı — kendi kendine yeten sayfalı discover isteği ──
// Genres ve Providers bölümlerinin ana context'i (Film tarafında sekmeye özel,
// üstelik SeeAllScreen kök yığında olduğundan erişilemez) yerine, seçilen
// filtreyi (genreIds / providerId) doğrudan TMDB discover'a vererek bağımsız
// yükler. Böylece taze MovieProvider'ın ilk sağlayıcıyı otomatik seçmesi gibi
// yan etkiler tamamen atlanır.
function useDiscoverPagination({ mediaType, genreIds, providerId, preset, originalLanguage }) {
  const { API_KEY } = useApiSettings();
  const { language } = useLanguage();
  const { streamingProviderIds } = useStreamingProviderSettings();
  const tmdbLanguage = tmdbLanguageOf(language);
  const tmdbRegion = tmdbRegionOf(language);

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
          sort_by: "popularity.desc",
          "vote_count.gte": "300",
        });

        // Dünya Turu: ray (components/DiscoveryMediaRail) ile AYNI sıralama ve eşikler.
        if (preset === "worldTour") {
          for (const [key, value] of Object.entries(worldTourDiscoverParams(originalLanguage))) {
            params.set(key, String(value));
          }
        }

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
      originalLanguage,
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

// ── Favorilerine Göre dalı ──
// Ray (components/favorites/FavoritesRecommendationRail) ile AYNI kaynak ve aynı elemeyi kullanır:
// dört favoriden türeyen öneriler, izlenmişler çıkarılmış. Önerilerin TMDB'de sayfalaması yok (her
// kaynak tek liste, istemcide harmanlanıyor) — ray 20 gösterir, burada hepsi tek seferde gelir.
// URL başına 12 saatlik önbellek paylaşıldığı için ray açıkken bu ekran ağa çıkmaz.
const FAVORITES_SEE_ALL_LIMIT = 100;

function FavoritesSeeAll({ mediaType, title, navigation }) {
  const { theme } = useTheme();
  const { API_KEY } = useApiSettings();
  const { language } = useLanguage();
  const { profile } = useUserProfile();
  const { statusIndex } = useListStatusContext() || {};
  const copy = getFavoritesCopy(language);

  const favorites = useMemo(() => readProfileFavorites(profile), [profile]);
  // Profil belgesi her anlık görüntüde yeni nesne olur; isteği nesneye değil kaynak kimliğine bağla.
  const sourceKey = useMemo(
    () => recommendationSources(favorites, mediaType).map((source) => source.key).join("|"),
    [favorites, mediaType],
  );

  const [feed, setFeed] = useState({ status: "loading", items: [] });
  useEffect(() => {
    if (!sourceKey || !API_KEY) {
      setFeed({ status: "ready", items: [] });
      return undefined;
    }
    let active = true;
    fetchFavoriteRecommendations({
      favorites,
      mediaType,
      apiKey: API_KEY,
      language,
      limit: FAVORITES_SEE_ALL_LIMIT,
    })
      .then(({ items }) => {
        if (active) setFeed({ status: "ready", items });
      })
      .catch(() => {
        if (active) setFeed((current) => (current.items.length ? current : { status: "error", items: [] }));
      });
    return () => {
      active = false;
    };
    // `favorites` kimliği sourceKey'den türüyor (yukarıdaki not).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_KEY, language, mediaType, sourceKey]);

  const data = useMemo(() => {
    const seen = statusIndex?.[mediaType] || {};
    return feed.items.filter((item) => !seen[item.id]?.isWatched);
  }, [feed.items, mediaType, statusIndex]);

  const emptyMessage =
    feed.status === "error"
      ? copy.picker.loadError
      : feed.status === "ready"
        ? copy.picker.noResults
        : null;

  return (
    <SeeAllGrid
      title={title}
      mediaType={mediaType}
      navigation={navigation}
      data={data}
      hasMore={false}
      emptyComponent={
        emptyMessage ? (
          <View style={styles.empty}>
            <Text allowFontScaling={false} style={{ color: theme.text.muted, fontSize: 14 }}>
              {emptyMessage}
            </Text>
          </View>
        ) : undefined
      }
    />
  );
}

function DiscoverSeeAll({
  mediaType,
  title,
  genreIds,
  providerId,
  preset,
  originalLanguage,
  navigation,
}) {
  const feed = useDiscoverPagination({ mediaType, genreIds, providerId, preset, originalLanguage });
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
  const { mediaType, section, title, genreIds, providerId, originalLanguage } = route.params || {};

  // Favorilerine Göre: öneriler favorilerden istemcide türetilir, discover/context akışı yok.
  if (section === "fromFavorites") {
    return <FavoritesSeeAll mediaType={mediaType} title={title} navigation={navigation} />;
  }

  // Genres / Providers: taze context yerine bağımsız discover akışı.
  if (
    section === "genres" ||
    section === "providers" ||
    section === "subscriptions" ||
    section === "topGenres" ||
    section === "recentFavorites" ||
    section === "worldTour"
  ) {
    return (
      <DiscoverSeeAll
        mediaType={mediaType}
        title={title}
        genreIds={genreIds}
        providerId={providerId}
        originalLanguage={originalLanguage}
        preset={
          section === "subscriptions" ||
          section === "topGenres" ||
          section === "recentFavorites" ||
          section === "worldTour"
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
  },
  segClip: { overflow: "hidden" },
  segCellGlass: { borderRadius: 9 },
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
  upcomingEmpty: { marginTop: 40 },
  oscarYearBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255, 215, 0, 0.5)",
    zIndex: 2,
  },
  oscarYearBadgeText: {
    color: "#ffd700",
    fontSize: 10,
    fontWeight: "800",
  },
  listBadges: {
    position: "absolute",
    left: 4,
    bottom: 6,
    zIndex: 2,
  },
});
