import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StyleSheet,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../../context/ThemeContext";
import { MovieSkeleton } from "../../components/Skeleton";
//import { API_KEY } from "@env";
import { useTvShow } from "../../context/TvShowContex";
import { useListStatus } from "../../modules/UseListStatus";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
const { width } = Dimensions.get("window");

export default function TvShowsProvders({ navigation }) {
  const { theme } = useTheme();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
  const {
    providers,
    selectedProvider,
    moviesProviders,
    loadingMoviesByProvider,
    loadingProvider,
    fetchMoviesByProvider,
    activateTvSection,
  } = useTvShow();

  useEffect(() => {
    activateTvSection("providers");
  }, [activateTvSection]);

  // Animated import'unun eklendiğinden emin olun
  const scaleValuesRef = useRef({});
  const getScaleValue = (itemId) => {
    if (!scaleValuesRef.current[itemId]) {
      scaleValuesRef.current[itemId] = new Animated.Value(1);
    }
    return scaleValuesRef.current[itemId];
  };

  const onPressIn = (itemId) => {
    Animated.timing(getScaleValue(itemId), {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = (itemId) => {
    Animated.timing(getScaleValue(itemId), {
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
        source={{
          uri: getTmdbUrl(item.logo_path, 'logo', 150),
        }}
        style={{ width: 30, height: 30, borderRadius: 10 }}
        cachePolicy="memory-disk"
        transition={120}
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
              transform: [{ scale: getScaleValue(item.id) }],
            },
          ]}
        >
          <Image
            source={
              item.poster_path
                ? {
                    uri: getTmdbUrl(item.poster_path, 'poster', 200),
                  }
                : require("../../assets/image/no_image.png")
            }
            style={[styles.similarPoster, { shadowColor: theme.shadow }]}
            cachePolicy="memory-disk"
            transition={120}
          />

          <View
            style={[
              styles.similarRating,
              { backgroundColor: theme.secondaryt },
            ]}
          >
            <Text allowFontScaling={false} style={styles.similarRatingText}>
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
          data={[1, 2, 3]}
          renderItem={() => <MovieSkeleton />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews
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
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews
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
