// components/TrendCarousel.js
//
// TV & Film ana ekranlarındaki "Trendler" carousel'inin ORTAK implementasyonu.
// (Önceden MovieTrends.js ve TvShowsTrends.js içinde birebir kopyaydı.)
//
// Performans + doğruluk stratejisi:
//  • ANİMASYON (scale / opacity / merkeze bindirme kayması) tamamen UI thread'de
//    Reanimated worklet'leriyle hesaplanır → scroll sırasında JS thread'e inilmez,
//    kare düşmez.
//  • KATMAN SIRASI (odak posteri en üstte) ise ASLA animasyonla sürülmez.
//    Animasyonla sürülen zIndex Android/Fabric'te çizim sırasını güvenilir
//    güncellemez; bu yüzden sağdaki (sonraki kardeş) kart odaktakinin üstüne
//    biner. Çözüm: odak indeksini UI thread'deki scroll handler'dan yalnızca
//    indeks DEĞİŞTİĞİNDE runOnJS ile React state'e taşıyıp, hücreye STATİK
//    zIndex + elevation vermek. Statik prop'lar Fabric'te sıralamayı kesin
//    uygular; runOnJS yalnızca kart geçişinde (nadiren) çalıştığı için maliyeti
//    ihmal edilebilir.
//  • Sabit hücre ölçüsü (getItemLayout) → sayfalama sonrası snap/yerleşim kayması
//    olmaz. removeClippedSubviews KAPALI: Android'de klipslenip yeniden bağlanan
//    hücrelerde çizim sırası tazelenmeyebiliyor (bindirmenin ikinci kaynağı);
//    windowSize=5 ile canlı hücre sayısı zaten küçük.

import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import RatingStars from "./RatingStars";
import ListBadges from "./ListBadges";

const { width } = Dimensions.get("window");
export const CARD_WIDTH = width * 0.6;
// Yan kartların merkeze görsel bindirme miktarı
const CARD_OVERLAP = CARD_WIDTH * 0.24;
// +50: puan/liste rozetlerinin sığması için pay (poster oranı 2:3)
const CARD_HEIGHT = CARD_WIDTH * 1.5 + 50;
const SPACING = width * 0.02;
const ITEM_SIZE = CARD_WIDTH;
export const EMPTY_ITEM_SIZE = (width - CARD_WIDTH) / 2;
const INITIAL_CARD_RENDER_COUNT = 4;

const TrendEdgeSpacer = memo(function TrendEdgeSpacer() {
  return <View style={{ width: EMPTY_ITEM_SIZE }} />;
});

// Odak indeksini hücrelere taşır (statik zIndex için). Değeri yalnızca kart
// geçişinde değişir → hücreler yalnızca o an yeniden render olur.
const FocusContext = createContext(0);

// Katman sırası hücre (sibling) seviyesinde uygulanmalı; kart içi zIndex yalnız
// kendi hücresinde geçerli olurdu. STATİK zIndex + elevation: Fabric'te sıralamayı
// kesin uygular (animated zIndex'in aksine).
const TrendCellRenderer = memo(function TrendCellRenderer({
  index,
  style,
  onLayout,
  onFocusCapture,
  children,
}) {
  const focusedIndex = useContext(FocusContext);
  const distance = Math.abs(index - focusedIndex);
  const depth = distance === 0 ? 30 : Math.max(1, 10 - distance);
  return (
    <View
      collapsable={false}
      onLayout={onLayout}
      onFocusCapture={onFocusCapture}
      style={[style, { position: "relative", zIndex: depth, elevation: depth }]}
    >
      {children}
    </View>
  );
});

// Kart — modül kapsamında memo'lu: tip sabit → remount/flicker yok.
const TrendCard = memo(function TrendCard({
  item,
  index,
  mediaType,
  navigation,
  theme,
  getTmdbUrl,
  scrollX,
}) {
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.9, { duration: 200 });
  };
  const onPressOut = () => {
    pressScale.value = withTiming(1, { duration: 200 });
  };

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  // Poster katmanı: yan kartlar küçülür, soluklaşır ve merkeze doğru çekilir
  // (coverflow bindirmesi). Tümü UI thread'de.
  const cardStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * ITEM_SIZE,
      index * ITEM_SIZE,
      (index + 1) * ITEM_SIZE,
    ];
    const scale = interpolate(scrollX.value, inputRange, [0.84, 1, 0.84], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.58, 1, 0.58], Extrapolation.CLAMP);
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [-CARD_OVERLAP, 0, CARD_OVERLAP],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ translateX }, { scale }] };
  });

  // Bilgi katmanı (puan pili + rozetler): posterle aynı hareket + hafif dikey kayma.
  const infoStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * ITEM_SIZE,
      index * ITEM_SIZE,
      (index + 1) * ITEM_SIZE,
    ];
    const scale = interpolate(scrollX.value, inputRange, [0.84, 1, 0.84], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.58, 1, 0.58], Extrapolation.CLAMP);
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [-CARD_OVERLAP, 0, CARD_OVERLAP],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(scale, [0.9, 1], [1, 20], Extrapolation.CLAMP);
    return { opacity, transform: [{ translateX }, { scale }, { translateY }] };
  });

  const rating = item.vote_average ?? 0;

  return (
    <Animated.View
      collapsable={false}
      style={[{ width: ITEM_SIZE, height: CARD_HEIGHT }, pressStyle]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{ width: ITEM_SIZE }}
        onPress={() =>
          navigation.navigate(
            mediaType === "movie" ? "MovieDetails" : "TvShowsDetails",
            { id: item.id },
          )
        }
      >
        <Animated.View
          style={[styles.cardContainer, { shadowColor: theme.shadow }, cardStyle]}
        >
          <Image
            style={styles.poster}
            source={{ uri: getTmdbUrl(item.poster_path, "poster", 200) }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={`${mediaType}trend-${item.id}`}
            transition={120}
          />
        </Animated.View>
        <Animated.View style={[styles.infoContainer, infoStyle]}>
          <View style={styles.ratingPill}>
            <RatingStars rating={rating} />
            <Text allowFontScaling={false} style={{ fontSize: 14, color: theme.colors.orange }}>
              {rating.toFixed(1)}
            </Text>
            <Text allowFontScaling={false} style={{ fontSize: 14, color: theme.text.secondary }}>
              •
            </Text>
            <FontAwesome name="user" size={14} color={theme.colors.blue} />
            <Text allowFontScaling={false} style={{ fontSize: 14, color: theme.colors.blue }}>
              {item.vote_count}
            </Text>
          </View>
          <ListBadges
            mediaId={item.id}
            mediaType={mediaType}
            theme={theme}
            style={{ position: "absolute", left: 10, bottom: 30 }}
          />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// Sabit hücre ölçüsü: sayfalama sonrası ölçüm/snap kayması olmaz.
const getItemLayout = (_, index) => ({
  length: ITEM_SIZE,
  offset: EMPTY_ITEM_SIZE + ITEM_SIZE * index,
  index,
});

/**
 * items: spacer'sız trend öğeleri (poster_path'li gerçek kayıtlar)
 * onEndReached: sayfalama callback'i — page/total/loading kontrolü çağırana ait.
 * resetKey: değiştiğinde odak baştan (0) alınır — kategori değişimi için.
 */
export default function TrendCarousel({
  items,
  mediaType,
  navigation,
  theme,
  getTmdbUrl,
  onEndReached,
  resetKey,
}) {
  const listRef = useRef(null);
  const scrollX = useSharedValue(0);
  // UI thread'de son odak indeksi (runOnJS'i tekrarsız tetiklemek için).
  const focusedShared = useSharedValue(0);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
    const idx = Math.round(e.contentOffset.x / ITEM_SIZE);
    if (idx !== focusedShared.value) {
      focusedShared.value = idx;
      runOnJS(setFocusedIndex)(idx);
    }
  });

  // Kategori değişince listeyi başa sar; scrollX/odak da anında sıfırlanır ki
  // gerçek konum ile animasyon/z-order uyuşsun.
  useEffect(() => {
    listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
    focusedShared.value = 0;
    scrollX.value = 0;
    setFocusedIndex(0);
  }, [resetKey]);

  // onEndReached yalnız gerçek bir kaydırma jestinden sonra tetiklenir.
  const canTrigger = useRef(false);
  const handleEndReached = useCallback(() => {
    if (!canTrigger.current) return;
    canTrigger.current = false;
    onEndReached?.();
  }, [onEndReached]);

  const renderItem = useCallback(
    ({ item, index }) => (
      <TrendCard
        item={item}
        index={index}
        mediaType={mediaType}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        scrollX={scrollX}
      />
    ),
    [mediaType, navigation, theme, getTmdbUrl, scrollX],
  );

  return (
    <FocusContext.Provider value={focusedIndex}>
      <Animated.FlatList
        ref={listRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        CellRendererComponent={TrendCellRenderer}
        ListHeaderComponent={TrendEdgeSpacer}
        ListFooterComponent={TrendEdgeSpacer}
        getItemLayout={getItemLayout}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_SIZE}
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollBegin={() => {
          canTrigger.current = true;
        }}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={false}
        initialNumToRender={INITIAL_CARD_RENDER_COUNT}
        maxToRenderPerBatch={INITIAL_CARD_RENDER_COUNT}
        updateCellsBatchingPeriod={60}
        windowSize={5}
      />
    </FocusContext.Provider>
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  infoContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  ratingPill: {
    position: "absolute",
    top: -45,
    right: 0,
    borderRadius: 25,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
});
