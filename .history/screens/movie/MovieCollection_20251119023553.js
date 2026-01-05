import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Image,
  Animated,
} from "react-native";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTheme } from "../../context/ThemeContext";
import RatingStars from "../../components/RatingStars";
import { useLanguage } from "../../context/LanguageContext";
import { MovieOscarSkeleton } from "../../components/Skeleton";
//import { API_KEY } from "@env";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useMovie } from "../../context/MovieContex";
import { useListStatus } from "../../modules/UseListStatus";
import Ionicons from "@expo/vector-icons/Ionicons";

const { width } = Dimensions.get("window");
export default function MovieCollection({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { moviesCollection, loadingCollection, errorCollection } = useMovie();

  const [selectedMovieCollection, setSelectedMovieCollection] = useState(null);
  // Animated import'unun eklendiğinden emin olun
  const [scaleValues, setScaleValues] = useState({});
  useEffect(() => {
    const newScaleValues = {};
    if (selectedMovieCollection && selectedMovieCollection.length > 0) {
      selectedMovieCollection.forEach((item) => {
        newScaleValues[item.id] = new Animated.Value(1);
      });
      setScaleValues(newScaleValues);
    }
  }, [selectedMovieCollection]);

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

  if (loadingCollection) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.text.secondary }]}>
          {t.movieScreens.oscar}
        </Text>

        <FlatList
          data={[1, 2, 3, 4, 5, 6, 7, 8, 9]}
          renderItem={() => <MovieOscarSkeleton />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
        />
      </View>
    );
  }

  if (errorCollection) {
    return <Text>Error: {errorCollection}</Text>;
  }

  const MovieItem = ({ item, index, navigation }) => {
    const { inWatchList, inFavorites, isWatched, isInOtherLists } =
      useListStatus(item.id, "movie");
    return (
      <TouchableOpacity
        key={index}
        style={styles.movieCollectionItem}
        activeOpacity={0.8}
        onPressIn={() => onPressIn(item.id)}
        onPressOut={() => onPressOut(item.id)}
        onPress={() => navigation.navigate("MovieDetails", { id: item.id })}
      >
        <Animated.View
          style={[
            {
              transform: [{ scale: scaleValues[item.id] || 1 }],
            },
          ]}
        >
          <View style={{ flexDirection: "row" }}>
            <Image
              source={
                item.poster_path
                  ? {
                      uri: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
                    }
                  : require("../../assets/image/no_image.png")
              }
              style={[
                styles.movieCollectionPoster,
                { shadowColor: theme.shadow },
              ]}
            />
            <View
              style={[
                styles.similarRating,
                { backgroundColor: theme.secondaryt },
              ]}
            >
              <Text style={styles.similarRatingText}>
                {item.vote_average?.toFixed(1) ?? ""}
              </Text>
            </View>
          </View>
          <View
            style={{
              justifyContent: "center",
              alignItems: "center",
              position: "absolute",
              left: 2,
              bottom: 8,
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
                  <Ionicons name="grid" size={12} color={theme.colors.orange} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderMovieItem = ({ item, index, navigation }) => {
    if (!item.poster_path) return null;
    return <MovieItem item={item} index={index} navigation={navigation} />;
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text.secondary }]}>
        Seri Filmler
      </Text>

      {selectedMovieCollection === null ? (
        <FlatList
          data={moviesCollection}
          contentContainerStyle={{ paddingHorizontal: 15 }}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.similarItem}
              activeOpacity={0.8}
              onPressIn={() => onPressIn(item.id)}
              onPressOut={() => onPressOut(item.id)}
              onPress={() => setSelectedMovieCollection(item)}
            >
              <Animated.View
                style={[
                  {
                    transform: [{ scale: scaleValues[item.id] || 1 }],
                  },
                ]}
              >
                <View
                  style={[
                    {
                      flexDirection: "row",
                    },
                  ]}
                >
                  <Image
                    source={
                      item.poster_path
                        ? {
                            uri: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
                          }
                        : require("../../assets/image/no_image.png")
                    }
                    style={[
                      styles.similarPoster,
                      { shadowColor: theme.shadow },
                    ]}
                  />
                </View>
              </Animated.View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
          horizontal
        />
      ) : (
        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity
            style={styles.movieCollectionSeriesItem}
            activeOpacity={0.8}
            onPressIn={() => onPressIn(selectedMovieCollection.id)}
            onPressOut={() => onPressOut(selectedMovieCollection.id)}
            onPress={() => setSelectedMovieCollection(null)}
          >
            <Animated.View
              style={[
                {
                  transform: [
                    { scale: scaleValues[selectedMovieCollection.id] || 1 },
                  ],
                },
              ]}
            >
              <View
                style={[
                  {
                    flexDirection: "row",
                  },
                ]}
              >
                <Image
                  source={
                    selectedMovieCollection.poster_path
                      ? {
                          uri: `https://image.tmdb.org/t/p/w500${selectedMovieCollection.poster_path}`,
                        }
                      : require("../../assets/image/no_image.png")
                  }
                  style={[styles.similarPoster, { shadowColor: theme.shadow }]}
                />
              </View>
            </Animated.View>
          </TouchableOpacity>
          <FlatList
            data={selectedMovieCollection.parts}
            contentContainerStyle={{ paddingHorizontal: 20 }}
            showsHorizontalScrollIndicator={false}
            renderItem={renderMovieItem}
            horizontal
            keyExtractor={(item) => item?.id}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  containerYears: {
    marginRight: 5,
    justifyContent: "center",
  },
  movieItem: {
    width: 200,
    margin: 10,
    padding: 10,
    backgroundColor: "#ddd",
    borderRadius: 5,
  },
  similarItem: {
    width: width * 0.4,
    height: width * 0.62,
    marginRight: 15,
  },
  movieCollectionItem: {
    width: width * 0.3,
    height: width * 0.6,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  movieCollectionSeriesItem: {
    width: width * 0.4,
    height: width * 0.6,
    marginLeft: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  similarPoster: {
    width: width * 0.4,
    height: width * 0.6,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  movieCollectionPoster: {
    width: "100%",
    height: width * 0.45,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    uppercase: true,
    marginBottom: 15,
    marginLeft: 15,
    fontWeight: "700",
  },
  similarTitle: {
    color: "#fff",
    fontSize: 14,
    paddingLeft: width * 0.05,
  },
  similarRating: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  similarRatingText: {
    color: "#ffd700",
    fontSize: 12,
  },
  text: {
    fontSize: 10,
    lineHeight: 10, // Karakterler arasındaki boşluğu ayarlamak için kullanılabilir
    fontWeight: "500",
    color: "#ffd700",
    textAlign: "center",
  },
});
