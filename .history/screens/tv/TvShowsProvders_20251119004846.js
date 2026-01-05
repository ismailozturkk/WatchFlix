import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  StyleSheet,
  Animated,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { MovieSkeleton } from "../../components/Skeleton";
//import { API_KEY } from "@env";
import { useTvShow } from "../../context/TvShowContex";
const { width } = Dimensions.get("window");

export default function TvShowsProvders({ navigation }) {
  const { theme } = useTheme();
  const {
    providers,
    selectedProvider,
    moviesProviders,
    loadingMoviesByProvider,
    loadingProvider,
    fetchMoviesByProvider,
  } = useTvShow();

  // Animated import'unun eklendiğinden emin olun
  const [scaleValues, setScaleValues] = useState({});

  useEffect(() => {
    const newScaleValues = {};
    if (moviesProviders && moviesProviders.length > 0) {
      moviesProviders.forEach((item) => {
        newScaleValues[item.id] = new Animated.Value(1);
      });
      setScaleValues(newScaleValues);
    }
  }, [moviesProviders]);

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
  const renderProvider = ({ item }) => (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 5,
        marginRight: 5,
        gap: 5,
        backgroundColor:
          selectedProvider === item.provider_id
            ? theme.accent
            : theme.secondary,
        borderRadius: 15,
      }}
      activeOpacity={0.8}
      onPress={() => fetchMoviesByProvider(item.provider_id)}
    >
      <Image
        source={{ uri: `https://image.tmdb.org/t/p/w200${item.logo_path}` }}
        style={{ width: 30, height: 30, borderRadius: 10 }}
      />
      <View
        style={{
          justifyContent: "center",
          alignItems: "center",
          height: 40,
        }}
      >
        <Text
          style={{
            color: theme.text.primary,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {item.provider_name}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const MovieItem = ({ item }) => {
    const { inWatchList, inFavorites, isWatched, isInOtherLists } =
      useListStatus(item.id, "tv");
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPressIn={() => onPressIn(item.id)}
        onPressOut={() => onPressOut(item.id)}
        style={styles.similarItem}
        onPress={() => navigation.push("TvShowsDetails", { id: item.id })}
      >
        <Animated.View
          style={[
            {
              transform: [{ scale: scaleValues[item.id] || 1 }],
            },
          ]}
        >
          <Image
            source={
              item.poster_path
                ? { uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }
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

  const renderMovieItem = ({ item }) => {
    if (!item.poster_path) return null;
    return <MovieItem item={item} navigation={navigation} />;
  };
  if (loadingMoviesByProvider || loadingProvider) {
    return (
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <FlatList
          data={providers}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.provider_id.toString()}
          renderItem={renderProvider}
          contentContainerStyle={{
            paddingHorizontal: 15,
            marginRight: 10,
            marginBottom: 20,
          }}
        />
        <FlatList
          data={[1, 2, 3, 4, 5, 6, 7, 8, 9]}
          renderItem={() => <MovieSkeleton />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingVertical: 10 }}>
      {/* İzleme sağlayıcıları */}

      <FlatList
        data={providers}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.provider_id.toString()}
        renderItem={renderProvider}
        contentContainerStyle={{ paddingHorizontal: 15 }}
      />

      <FlatList
        data={moviesProviders}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
        contentContainerStyle={{ paddingHorizontal: 15, marginTop: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  genreButton: {
    marginVertical: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  genreText: {
    color: "white",
    fontWeight: "bold",
  },
  similarItem: {
    width: width * 0.4,
    height: width * 0.62,
    marginRight: 10,
    marginBottom: 5,
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
  similarTitle: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 5,
  },
  similarRating: {
    position: "absolute",
    bottom: 10,
    right: 5,
    width: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  similarRatingText: {
    color: "#ffd700",
    fontSize: 12,
    marginBottom: 2,
  },
  errorText: {
    color: "red",
    fontSize: 16,
    fontWeight: "bold",
  },
});
