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
export default function MovieOscar({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { moviesOscar, loadingOscar, errorOscar } = useMovie();

  // Animated import'unun eklendiğinden emin olun
  const [scaleValues, setScaleValues] = useState({});

  useEffect(() => {
    const newScaleValues = {};
    if (moviesOscar && moviesOscar.length > 0) {
      moviesOscar.forEach((item) => {
        newScaleValues[item.id] = new Animated.Value(1);
      });
      setScaleValues(newScaleValues);
    }
  }, [moviesOscar]);

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

  if (loadingOscar) {
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

  if (errorOscar) {
    return <Text>Error: {errorOscar}</Text>;
  }
  const DikeyMetin = ({ metin }) => {
    return (
      <View style={styles.containerYears}>
        {metin.split("").map((karakter, index) => (
          <Text key={index} style={styles.text}>
            {karakter}
          </Text>
        ))}
      </View>
    );
  };
  const MovieItem = ({ item, index }) => {
    const { inWatchList, inFavorites, isWatched, isInOtherLists } =
      useListStatus(item.id, "movie");
    return (
      <TouchableOpacity
        style={styles.similarItem}
        activeOpacity={0.8}
        onPressIn={() => onPressIn(item.id)}
        onPressOut={() => onPressOut(item.id)}
        onPress={() => navigation.push("MovieDetails", { id: item.id })}
      >
        <Animated.View
          style={[
            {
              transform: [{ scale: scaleValues[item.id] || 1 }],
            },
          ]}
        >
          <View style={{ flexDirection: "row" }}>
            <View style={{ justifyContent: "space-around" }}>
              <Image
                source={require("../../assets/image/pngwing.com.png")}
                style={{ width: 10, height: 40 }}
              />
              <DikeyMetin metin={`${2025 - index}`} />
            </View>
            <Image
              source={
                item.poster_path
                  ? {
                      uri: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
                    }
                  : require("../../assets/image/no_image.png")
              }
              style={[styles.similarPoster, { shadowColor: theme.shadow }]}
            />
            <View
              style={[
                styles.similarRating,
                { backgroundColor: theme.secondaryt },
              ]}
            >
              <Text style={styles.similarRatingText}>
                {item.vote_average.toFixed(1)}
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
        {t.movieScreens.oscar}
      </Text>
      <FlatList
        data={moviesOscar}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        showsHorizontalScrollIndicator={false}
        renderItem={renderMovieItem}
        keyExtractor={(item) => item.id.toString()}
        horizontal
      />
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
    width: width * 0.44,
    height: width * 0.62,
    marginRight: 15,
  },
  similarPoster: {
    width: width * 0.4,
    height: width * 0.6,
    borderRadius: 15,
    marginBottom: 5,
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
    bottom: 8,
    right: 3,
    width: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  similarRatingText: {
    color: "#ffd700",
    fontSize: 12,
    marginBottom: 2,
  },
  text: {
    fontSize: 26,
    lineHeight: 33, // Karakterler arasındaki boşluğu ayarlamak için kullanılabilir
    fontWeight: "bold",
    color: "#ffd700",
    textAlign: "center",
  },
});
