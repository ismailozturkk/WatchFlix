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
import { useMovie } from "../../context/MovieContex";
import RatingStars from "../../components/RatingStars";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import ListBadges from "../../components/ListBadges";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
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

// Stable, module-scope item component → no remount → no flicker.
const MovieTrendCard = memo(function MovieTrendCard({
  item,
  index,
  navigation,
  theme,
  getTmdbUrl,
  scrollX,
}) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.timing(pressScale, { toValue: 0.9, duration: 200, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(pressScale, { toValue: 1, duration: 200, useNativeDriver: true }).start();

  const rating = item.vote_average;

  const inputRange = [
    (index - 2) * ITEM_SIZE,
    (index - 1) * ITEM_SIZE,
    index * ITEM_SIZE,
  ];

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.7, 1, 0.7],
    extrapolate: "clamp",
  });

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.5, 1, 0.5],
    extrapolate: "clamp",
  });

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
        onPress={() => navigation.navigate("MovieDetails", { id: item.id })}
      >
        <Animated.View
          style={[
            styles.cardContainer,
            {
              shadowColor: theme.shadow,
              transform: [{ scale }],
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
        </Animated.View>
        <Animated.View
          style={[
            styles.infoContainer,
            {
              shadowColor: theme.shadow,
              transform: [
                { scale },
                {
                  translateY: scale.interpolate({
                    inputRange: [0.9, 1],
                    outputRange: [1, 20],
                  }),
                },
              ],
              opacity,
            },
          ]}
        >
          <View
            style={{
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
            }}
          >
            <RatingStars rating={item.vote_average} />
            <Text
              allowFontScaling={false}
              style={{ fontSize: 14, color: theme.colors.orange }}
            >
              {rating.toFixed(1)}
            </Text>
            <Text
              allowFontScaling={false}
              style={{ fontSize: 14, color: theme.text.secondary }}
            >
              •
            </Text>
            <FontAwesome name="user" size={14} color={theme.colors.blue} />
            <Text
              allowFontScaling={false}
              style={{ fontSize: 14, color: theme.colors.blue }}
            >
              {item.vote_count}
            </Text>
          </View>
          <ListBadges
            mediaId={item.id}
            mediaType="movie"
            theme={theme}
            style={{ position: "absolute", left: 10, bottom: 30 }}
          />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function MovieTrends({ navigation }) {
  const { theme } = useTheme();
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const { t } = useLanguage();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
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

  useEffect(() => {
    activateMovieSection("trends");
  }, [activateMovieSection]);

  const renderCategory = ({ item }) => (
    <TouchableOpacity
      onPress={() => setSelectedCategoryTrends(item)}
      style={[
        styles.categoryItem,
        {
          justifyContent: "flex-end",
        },
      ]}
    >
      <Text
        style={[
          selectedCategoryTrends === item
            ? styles.selectedCategoryText
            : styles.categoryText,
          {
            color:
              selectedCategoryTrends === item
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
    if (item.id === "left-spacer" || item.id === "right-spacer") {
      return <View style={{ width: EMPTY_ITEM_SIZE }} />;
    }

    return (
      <MovieTrendCard
        item={item}
        index={index}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        scrollX={scrollX}
      />
    );
  };
  if (loadingTrends) {
    return (
      <View style={{ flex: 1, marginTop: 10 }}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <FlatList
            data={categoriesTrends}
            renderItem={renderCategory}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          />
        </View>
        <Animated.FlatList
          data={[1, 2, 3]}
          renderItem={(index) => <MovieCardSkeleton index={index} />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: EMPTY_ITEM_SIZE }}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews
        />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, marginTop: 10 }}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <FlatList
          data={categoriesTrends}
          renderItem={renderCategory}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />
      </View>
      <Animated.FlatList
        data={movieTrends}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
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
        onEndReached={handleTrendsEndReached}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        maxToRenderPerBatch={INITIAL_CARD_RENDER_COUNT}
        windowSize={5}
        initialNumToRender={INITIAL_CARD_RENDER_COUNT}
        getItemLayout={(_, index) => ({
          length: ITEM_SIZE,
          offset: ITEM_SIZE * index,
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
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginLeft: 15,
    marginBottom: 15,
  },
  categoriesList: {
    paddingHorizontal: 15,
  },
  categoryItem: {
    marginRight: 5,
    paddingVertical: 5,
  },

  categoryText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
  },
  selectedCategoryText: {
    color: "#666",
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
  title: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "bold",
  },
  genre: {
    color: "#fff",
    fontSize: 14,
  },
  genreCount: {
    color: "#666",
    fontSize: 14,
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
