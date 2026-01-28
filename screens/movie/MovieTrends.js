import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Image,
  Dimensions,
  Animated,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { MovieCardSkeleton } from "../../components/Skeleton";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useMovie } from "../../context/MovieContex";
import RatingStars from "../../components/RatingStars";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useListStatus } from "../../modules/UseListStatus";
import Ionicons from "@expo/vector-icons/Ionicons";
const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width * 0.6;
const CARD_HEIHGT = height * 0.45;
const SPACING = width * 0.02;
const ITEM_SIZE = CARD_WIDTH;
const EMPTY_ITEM_SIZE = (width - CARD_WIDTH) / 2;

export default function MovieTrends({ navigation }) {
  const { theme } = useTheme();
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const { t } = useLanguage();

  const {
    loadingTrends,
    movieTrends,
    selectedCategoryTrends,
    setSelectedCategoryTrends,
    getCategoryTitleTrends,
    categoriesTrends,
  } = useMovie();

  // Animated import'unun eklendiğinden emin olun
  const [scaleValues, setScaleValues] = useState({});

  useEffect(() => {
    const newScaleValues = {};
    if (movieTrends && movieTrends.length > 0) {
      movieTrends.forEach((item) => {
        newScaleValues[item.id] = new Animated.Value(1);
      });
      setScaleValues(newScaleValues);
    }
  }, [movieTrends]);

  const onPressIn = (itemId) => {
    if (!scaleValues[itemId]) return;
    Animated.timing(scaleValues[itemId], {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = (itemId) => {
    if (!scaleValues[itemId]) return;
    Animated.timing(scaleValues[itemId], {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

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

  const TrendCard = ({ item, index }) => {
    if (item.id === "left-spacer" || item.id === "right-spacer") {
      return <View style={{ width: EMPTY_ITEM_SIZE }} />;
    }
    const { inWatchList, inFavorites, isWatched, isInOtherLists } =
      useListStatus(item.id, "movie");

    const rating = item.vote_average;
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;

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

    return (
      <Animated.View
        style={{
          width: ITEM_SIZE,
          height: CARD_HEIHGT,
          transform: [{ scale: scaleValues[item.id] || 1 }],
        }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPressIn={() => onPressIn(item.id)}
          onPressOut={() => onPressOut(item.id)}
          onPress={() =>
            navigation.navigate("MovieDetails", {
              id: item.id,
            })
          }
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
              source={{
                uri: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
              }}
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
              <Text style={{ fontSize: 14, color: theme.colors.orange }}>
                {rating.toFixed(1)}
              </Text>
              <Text style={{ fontSize: 14, color: theme.text.secondary }}>
                •
              </Text>
              <FontAwesome name="user" size={14} color={theme.colors.blue} />
              <Text style={{ fontSize: 14, color: theme.colors.blue }}>
                {item.vote_count}
              </Text>
            </View>
            <View
              style={{
                justifyContent: "center",
                alignItems: "center",
                position: "absolute",
                left: 10,
                bottom: 30,
              }}
            >
              <View
                style={{
                  gap: 3,
                  backgroundColor: theme.secondaryt,
                  paddingVertical: 3,
                  paddingHorizontal: 1,
                  borderRadius: 7,
                }}
              >
                {inWatchList && (
                  <TouchableOpacity
                    onPress={() => {
                      //updateTvSeriesList("watchList", "tv");
                    }}
                  >
                    <Ionicons
                      name="bookmark"
                      size={12}
                      color={theme.colors.blue}
                    />
                  </TouchableOpacity>
                )}
                {isWatched && (
                  <TouchableOpacity
                    onPress={() => {
                      //updateTvSeriesList("watchedTv", "tv");
                    }}
                  >
                    <Ionicons name="eye" size={12} color={theme.colors.green} />
                  </TouchableOpacity>
                )}
                {inFavorites && (
                  <TouchableOpacity
                    onPress={() => {
                      //updateTvSeriesList("favorites", "tv");
                    }}
                  >
                    <Ionicons name="heart" size={12} color={theme.colors.red} />
                  </TouchableOpacity>
                )}
                {isInOtherLists && (
                  <TouchableOpacity
                    onPress={() => {
                      //updateMovieList("favorites", "movie");
                    }}
                  >
                    <Ionicons
                      name="grid"
                      size={12}
                      color={theme.colors.orange}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  const renderItem = ({ item, index }) => {
    if (item.id === "left-spacer" || item.id === "right-spacer") {
      return <View style={{ width: EMPTY_ITEM_SIZE }} />;
    }

    return <TrendCard item={item} index={index} />;
  };
  if (loadingTrends) {
    return (
      <View style={{ flex: 1, marginTop: 40 }}>
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
          data={[1, 2, 3, 4, 5]}
          renderItem={(index) => <MovieCardSkeleton index={index} />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: EMPTY_ITEM_SIZE }}
        />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, marginTop: 40 }}>
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
    resizeMode: "cover",
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
