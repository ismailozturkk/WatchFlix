import { isLightSurface } from "@utils/colorUtils";
import React, { memo, useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  Dimensions,
  Animated,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { TrendRailSkeleton } from "../../components/Skeleton";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useMovie } from "../../context/MovieContex";
import ListBadges from "../../components/ListBadges";
import { RatingBadge } from "../../components/PosterInfoBadges";
import SectionHeader from "../../components/home/SectionHeader";
import { SectionChipRail } from "../../components/home/SectionChips";
import DiscoverFilterChip from "../../components/home/DiscoverFilterChip";
import { useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
import usePosterUri from "../../hooks/usePosterUri";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.6;
// Sarmalayıcı yüksekliği poster yüksekliğinden türetilir (ekran yüksekliğinden
// değil); böylece farklı en/boy oranlı cihazlarda posterin altı kesilmez.
// +50: derece/liste rozetlerinin sığması için pay.
const CARD_HEIHGT = CARD_WIDTH * 1.5 + 50;
const SPACING = width * 0.02;
const ITEM_SIZE = CARD_WIDTH;
const EMPTY_ITEM_SIZE = (width - CARD_WIDTH) / 2;
const INITIAL_CARD_RENDER_COUNT = 4;
// Kaydırırken odağa gelen posterin ulaştığı boyut; settle olunca 1.0'a iner.
const FOCUS_PEAK = 1.15;
const FOCUS_EXTRA = FOCUS_PEAK - 1;
// Büyüyen posterin üstten taşan payı; dikey kırpılmayı önlemek için FlatList
// içeriğine bu kadar üst boşluk verilir.
const FOCUS_HEADROOM = Math.ceil((CARD_WIDTH * 1.5 * FOCUS_EXTRA) / 2) + 4;
// Yükleme iskeleti gerçek kartın ölçülerini birebir kullanır (bkz. TvShowsTrends).
const TREND_SKELETON_METRICS = {
  itemSize: ITEM_SIZE,
  cardWidth: CARD_WIDTH,
  cardHeight: CARD_HEIHGT,
  spacing: SPACING,
  edge: EMPTY_ITEM_SIZE,
  headroom: FOCUS_HEADROOM,
};

// Spacer'lar poster verisinin parçası değildir. Fabric'in farklı genişlikteki
// sahte liste hücrelerini yeniden sıralamasını önlemek için header/footer kullan.
const TrendEdgeSpacer = memo(function TrendEdgeSpacer() {
  return <View style={{ width: EMPTY_ITEM_SIZE }} />;
});

// Stable, module-scope item component → no remount → no flicker.
const MovieTrendCard = memo(function MovieTrendCard({
  item,
  index,
  navigation,
  theme,
  getTmdbUrl,
  scrollX,
  shrink,
  focusedPos,
}) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const { posterBadges } = useListLayoutSettings();
  const { openQuickActions } = useMediaQuickActions();
  const onPressIn = () =>
    Animated.timing(pressScale, { toValue: 0.9, duration: 200, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(pressScale, { toValue: 1, duration: 200, useNativeDriver: true }).start();

  const inputRange = [
    (index - 1) * ITEM_SIZE,
    index * ITEM_SIZE,
    (index + 1) * ITEM_SIZE,
  ];

  // Kaydırırken poster odağa yaklaştıkça FOCUS_PEAK'e (1.15) kadar büyür.
  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.7, FOCUS_PEAK, 0.7],
    extrapolate: "clamp",
  });

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.5, 1, 0.5],
    extrapolate: "clamp",
  });

  // Merkeze yakınlık (0 → kenar, 1 → tam ortada).
  const centerness = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });
  // Bu kart o an odaktaki (settle olmuş) kart mı? `focusedPos` bu kartın merkez
  // scroll konumuna eşitse 1 olur. React state yerine Animated ile yürütülür →
  // yeniden render yok, "addViewAt" çökmesi olmaz.
  const center = index * ITEM_SIZE;
  const focusMatch = focusedPos
    ? focusedPos.interpolate({
        inputRange: [center - ITEM_SIZE / 2, center, center + ITEM_SIZE / 2],
        outputRange: [0, 1, 0],
        extrapolate: "clamp",
      })
    : 0;
  // Büyüme kaydırma sırasında (scroll'a bağlı) olur. Yalnızca odak kartı `shrink`
  // 0→1 animasyonuyla 1.15'ten normale iner (küçük bounce'lu). Diğer kartlar salt
  // scroll ölçeğini izler → kalkan poster sıçramaz.
  const finalScale =
    shrink && focusedPos
      ? Animated.subtract(
          scale,
          Animated.multiply(
            Animated.multiply(centerness, focusMatch),
            Animated.multiply(shrink, FOCUS_EXTRA),
          ),
        )
      : scale;

  const posterUri = usePosterUri();
  const source = useMemo(
    () => ({ uri: posterUri("movie", item.id, item.poster_path) }),
    [item.id, item.poster_path, posterUri]
  );

  return (
    <Animated.View
      style={{
        width: ITEM_SIZE,
        height: CARD_HEIHGT,
        transform: [{ scale: pressScale }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => navigation.navigate("MovieDetails", { id: item.id })}
        onLongPress={() =>
          openQuickActions({ item, mediaType: "movie", navigation })
        }
        delayLongPress={350}
      >
        <Animated.View
          style={[
            styles.cardContainer,
            {
              shadowColor: theme.shadow,
              transform: [{ scale: finalScale }],
              opacity,
            },
          ]}
        >
          <Image
            style={styles.poster}
            source={source}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={`movietrend-${item.id}`}
            transition={120}
          />
          {posterBadges?.tmdbRating !== false && (
            <RatingBadge
              value={item.vote_average}
              votes={item.vote_count}
              scale={1}
              style={styles.trendRating}
            />
          )}
          <ListBadges
            mediaId={item.id}
            mediaType="movie"
            theme={theme}
            style={styles.trendListBadges}
          />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function MovieTrends({ navigation }) {
  const { theme } = useTheme();
  const scrollX = React.useRef(new Animated.Value(0)).current;
  // Odak posteri: kaydırırken FOCUS_PEAK'e büyür, settle olunca `shrink` 0→1 ile
  // normale iner. `focusedPos` odaktaki kartın merkez scroll konumu (Animated →
  // React state yok, yeniden render yok).
  const shrink = React.useRef(new Animated.Value(1)).current;
  const focusedPos = React.useRef(new Animated.Value(0)).current;
  const { t } = useLanguage();
  const { getTmdbUrl } = useImageQualitySettings();
  const {
    loadingTrends,
    movieTrends,
    selectedCategoryTrends,
    setSelectedCategoryTrends,
    getCategoryTitleTrends,
    categoriesTrends,
    activateMovieSection,
    loadMoreTrends,
    loadingMoreTrends,
    pageTrends,
    totalPagesTrends,
  } = useMovie();

  // onEndReached'in mount'ta gereksiz tetiklenmesini engeller (PaginatedRail ile aynı mantık).
  const canTrigger = useRef(false);
  const handleTrendsEndReached = () => {
    if (!canTrigger.current) return;
    canTrigger.current = false;
    if (pageTrends < totalPagesTrends && !loadingMoreTrends) loadMoreTrends();
  };

  // Poster odağa oturunca (settle): odak kartını `focusedPos` ile işaretle ve o
  // kartı büyümüş hâlden (1.15) yumuşak bir spring ile normale indir. Spring'in
  // hafif overshoot'u küçük bir bounce verir. Tümü Animated → React re-render yok.
  const handleMomentumEnd = (e) => {
    const snapped = Math.round(e.nativeEvent.contentOffset.x / ITEM_SIZE) * ITEM_SIZE;
    focusedPos.setValue(snapped);
    shrink.setValue(0); // büyümüş (1.15) hâlden başla
    Animated.spring(shrink, {
      toValue: 1,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    activateMovieSection("trends");
  }, [activateMovieSection]);

  const renderItem = ({ item, index }) => {
    return (
      <MovieTrendCard
        item={item}
        index={index}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        scrollX={scrollX}
        shrink={shrink}
        focusedPos={focusedPos}
      />
    );
  };

  // Başlık yükleme sırasında da AYNI öğedir (ray başlığın altında; yükseklik değişirse zıplar).
  // Eskiden bu raf başlıksızdı: yalnız kategori sekmeleri vardı, bölümün adı hiç yazmıyordu.
  const trendHeader = (
    <SectionHeader
      section="trends"
      mediaType="movie"
      title={t.movieScreens.title}
      onPressAction={() =>
        navigation.navigate("SeeAllScreen", {
          mediaType: "movie",
          section: "trends",
          title: t.movieScreens.title,
        })
      }
    >
      <SectionChipRail
        data={categoriesTrends}
        keyExtractor={(item) => item}
        extraData={selectedCategoryTrends}
        renderChip={(item) => (
          <DiscoverFilterChip
            label={getCategoryTitleTrends(item)}
            selected={selectedCategoryTrends === item}
            onPress={() => setSelectedCategoryTrends(item)}
          />
        )}
      />
    </SectionHeader>
  );

  if (loadingTrends) {
    return (
      <View style={{ flex: 1, marginTop: 10 }}>
        <StatusBar barStyle={isLightSurface(theme.primary) ? "dark-content" : "light-content"} />
        {trendHeader}
        <TrendRailSkeleton metrics={TREND_SKELETON_METRICS} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, marginTop: 10 }}>
      <StatusBar barStyle={isLightSurface(theme.primary) ? "dark-content" : "light-content"} />
      {trendHeader}
      <Animated.FlatList
        data={movieTrends}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={TrendEdgeSpacer}
        ListFooterComponent={TrendEdgeSpacer}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: FOCUS_HEADROOM }}
        snapToInterval={ITEM_SIZE}
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        onMomentumScrollBegin={() => {
          canTrigger.current = true;
        }}
        onMomentumScrollEnd={handleMomentumEnd}
        onEndReached={handleTrendsEndReached}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={false}
        maxToRenderPerBatch={INITIAL_CARD_RENDER_COUNT}
        windowSize={5}
        initialNumToRender={INITIAL_CARD_RENDER_COUNT}
        getItemLayout={(_, index) => ({
          length: ITEM_SIZE,
          offset: EMPTY_ITEM_SIZE + ITEM_SIZE * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: SPACING,
    alignItems: "center",
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.5,
    borderRadius: 25,
    backgroundColor: "#2a2a2a",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  trendRating: {
    position: "absolute",
    right: 8,
    bottom: 8,
  },
  trendListBadges: { position: "absolute", left: 8, bottom: 8 },
});
