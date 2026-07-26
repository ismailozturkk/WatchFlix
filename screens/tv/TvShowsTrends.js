import React, { memo, useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Dimensions,
  Animated,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { MovieCardSkeleton } from "../../components/Skeleton";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
//import { API_KEY } from "@env";
import { useTvShow } from "../../context/TvShowContex";
import ListBadges from "../../components/ListBadges";
import { RatingBadge } from "../../components/PosterInfoBadges";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SeeAllButton } from "../../components/SeeAllHeader";
import { useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
const { width, height } = Dimensions.get("window");
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

// Spacer'lar poster verisinin parçası değildir. Fabric'in farklı genişlikteki
// sahte liste hücrelerini yeniden sıralamasını önlemek için header/footer kullan.
const TrendEdgeSpacer = memo(function TrendEdgeSpacer() {
  return <View style={{ width: EMPTY_ITEM_SIZE }} />;
});

// Stable, module-scope item component. Hoisted out of the parent so its
// component type never changes between renders → no remount → no flicker.
const TvTrendCard = memo(function TvTrendCard({
  item,
  index,
  navigation,
  theme,
  getTmdbUrl,
  scrollX,
  shrink,
  focusedPos,
}) {
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

  const pressScale = useRef(new Animated.Value(1)).current;
  const { posterBadges } = useListLayoutSettings();
  const onPressIn = () =>
    Animated.timing(pressScale, { toValue: 0.9, duration: 200, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(pressScale, { toValue: 1, duration: 200, useNativeDriver: true }).start();

  const source = useMemo(
    () => ({ uri: getTmdbUrl(item.poster_path, "poster", 200) }),
    [item.poster_path, getTmdbUrl]
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
        style={{ width: ITEM_SIZE }}
        onPress={() => navigation.navigate("TvShowsDetails", { id: item.id })}
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
            recyclingKey={`tvtrend-${item.id}`}
            transition={120}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.infoContainer,
            {
              shadowColor: theme.shadow,
              transform: [
                { scale: finalScale },
                {
                  translateY: finalScale.interpolate({
                    inputRange: [0.9, 1],
                    outputRange: [1, 20],
                  }),
                },
              ],
              opacity,
            },
          ]}
        >
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
            mediaType="tv"
            theme={theme}
            style={{ position: "absolute", left: 10, bottom: 30 }}
          />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function TvShowsTrends({ navigation }) {
  const scrollX = React.useRef(new Animated.Value(0)).current;
  // Odak posteri: kaydırırken FOCUS_PEAK'e büyür, settle olunca `shrink` 0→1 ile
  // normale iner. `focusedPos` odaktaki kartın merkez scroll konumu (Animated →
  // React state yok, yeniden render yok).
  const shrink = React.useRef(new Animated.Value(1)).current;
  const focusedPos = React.useRef(new Animated.Value(0)).current;
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
  const {
    seriesTrend,
    loadingTrend,
    setSelectedCategoryTrend,
    selectedCategoryTrend,
    getCategoryTitleTrends,
    categoriesTrends,
    activateTvSection,
    loadMoreTrend,
    loadingMoreTrend,
    pageTrend,
    totalPagesTrend,
  } = useTvShow();

  useEffect(() => {
    activateTvSection("trends");
  }, [activateTvSection]);

  // onEndReached'in mount'ta gereksiz tetiklenmesini engeller.
  const canTrigger = React.useRef(false);
  const handleTrendsEndReached = () => {
    if (!canTrigger.current) return;
    canTrigger.current = false;
    if (pageTrend < totalPagesTrend && !loadingMoreTrend) loadMoreTrend();
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

  const renderCategory = ({ item }) => (
    <TouchableOpacity
      onPress={() => setSelectedCategoryTrend(item)}
      style={[
        styles.categoryItem,
        {
          justifyContent: "flex-end",
        },
      ]}
    >
      <Text
        style={[
          selectedCategoryTrend === item
            ? styles.selectedCategoryText
            : styles.categoryText,
          {
            color:
              selectedCategoryTrend === item
                ? theme.text.primary
                : theme.text.secondary,
          },
        ]}
      >
        {getCategoryTitleTrends(item)}
      </Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item, index }) => {
    return (
      <TvTrendCard
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

  const trendHeader = (
    <View style={styles.header}>
      <View style={styles.categoryRail}>
        <FlatList
          data={categoriesTrends}
          renderItem={renderCategory}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />
      </View>
      <SeeAllButton
        onPress={() =>
          navigation.navigate("SeeAllScreen", {
            mediaType: "tv",
            section: "trends",
            title: t.tvShowScreens.title,
          })
        }
      />
    </View>
  );

  if (loadingTrend) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        {trendHeader}
        <View style={styles.skeletonRow}>
          {[0, 1, 2].map((index) => (
            <MovieCardSkeleton key={index} index={{ index }} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {trendHeader}
      <Animated.FlatList
        data={seriesTrend}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={TrendEdgeSpacer}
        ListFooterComponent={TrendEdgeSpacer}
        getItemLayout={(_, index) => ({
          length: ITEM_SIZE,
          offset: EMPTY_ITEM_SIZE + ITEM_SIZE * index,
          index,
        })}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: FOCUS_HEADROOM }}
        snapToInterval={ITEM_SIZE}
        snapToAlignment="start"
        decelerationRate="normal"
        bounces={true}
        initialNumToRender={INITIAL_CARD_RENDER_COUNT}
        maxToRenderPerBatch={INITIAL_CARD_RENDER_COUNT}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews={false}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 10,
  },

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
  header: {
    marginBottom: 8,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  categoryRail: { flex: 1, justifyContent: "center" },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginLeft: 15,
    marginBottom: 15,
  },
  categoriesList: {
    paddingLeft: 15,
    paddingRight: 4,
  },
  skeletonRow: {
    flexDirection: "row",
    paddingHorizontal: EMPTY_ITEM_SIZE,
    overflow: "hidden",
  },
  categoryItem: {
    marginRight: 5,
    paddingVertical: 5,
  },

  categoryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  selectedCategoryText: {
    fontSize: 20,
    fontWeight: "600",
  },

  poster: {
    width: "100%",
    height: "100%",
  },
  infoContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  trendRating: {
    position: "absolute",
    top: -42,
    right: 6,
  },
  title: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "bold",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  starImage: {
    width: 12,
    height: 12,
    marginRight: 1,
  },
});
